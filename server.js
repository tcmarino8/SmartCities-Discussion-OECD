const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const neo4j = require("neo4j-driver");

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname)));

const dbName = process.env.NEO4J_DATABASE || "neo4j";
let driver = null;
const openAiApiKey = process.env.OPENAI_API_KEY || "";
const openAiModel = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const mcpBridgeUrl = process.env.MCP_BRIDGE_URL || "";
const mcpBridgeApiKey = process.env.MCP_BRIDGE_API_KEY || "";
const defaultOecdScope = process.env.OECD_SITE_SCOPE || "https://www.oecd.org";

const allowedNodeLabels = new Set(["Person", "Comment", "ReportText", "Module"]);
const allowedRelations = new Set([
  "FOLLOWS_PERSON",
  "FOLLOWS_MODULE",
  "POSTED_COMMENT",
  "BELONGS_TO_MODULE",
  "SOURCE_TEXT_BELONGS_TO_MODULE",
  "COMMENT_REFERENCES_SOURCE_TEXT",
  "PERSON_MENTIONS_MODULE"
]);

function hasNeo4jConfig() {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD);
}

if (hasNeo4jConfig()) {
  driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USERNAME, process.env.NEO4J_PASSWORD)
  );
}

async function runQuery(query, params = {}) {
  if (!driver) {
    throw new Error("Neo4j driver is not initialized");
  }

  const session = driver.session({ database: dbName });

  try {
    return await session.run(query, params);
  } finally {
    await session.close();
  }
}

function sanitizeRelationType(type) {
  if (!allowedRelations.has(type)) {
    throw new Error("Unsupported relationType");
  }

  return type;
}

function mapRecordValue(value) {
  if (neo4j.isInt(value)) return value.toNumber();

  if (Array.isArray(value)) return value.map(mapRecordValue);

  if (value && typeof value === "object") {
    if (value.properties) {
      const mappedProps = {};
      for (const [key, propValue] of Object.entries(value.properties)) {
        mappedProps[key] = mapRecordValue(propValue);
      }
      return mappedProps;
    }

    const mappedObj = {};
    for (const [key, child] of Object.entries(value)) {
      mappedObj[key] = mapRecordValue(child);
    }

    return mappedObj;
  }

  return value;
}

function firstRecordOrNull(result) {
  if (!result.records.length) return null;

  const record = result.records[0];
  const mapped = {};
  for (const [key, value] of Object.entries(record.toObject())) {
    mapped[key] = mapRecordValue(value);
  }

  return mapped;
}

app.get("/api/health", async (req, res) => {
  if (!hasNeo4jConfig()) {
    return res.status(200).json({
      ok: true,
      neo4j: "not-configured",
      message: "Server running without Neo4j credentials."
    });
  }

  try {
    await runQuery("RETURN 'ok' AS status");
    return res.status(200).json({ ok: true, neo4j: "connected" });
  } catch (error) {
    return res.status(500).json({ ok: false, neo4j: "error", error: error.message });
  }
});

app.post("/api/nodes", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const { type, id, properties = {} } = req.body || {};
  if (!allowedNodeLabels.has(type)) return res.status(400).json({ error: "Unsupported node type" });
  if (!id || typeof id !== "string") return res.status(400).json({ error: "id is required" });

  try {
    const result = await runQuery(
      `
      MERGE (n:${type} {id: $id})
      SET n += $properties
      SET n.updatedAt = datetime()
      SET n.createdAt = coalesce(n.createdAt, datetime())
      RETURN n
      `,
      { id, properties }
    );

    return res.status(200).json({ node: firstRecordOrNull(result)?.n || null });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/links", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const { fromType, fromId, toType, toId, relationType, properties = {} } = req.body || {};

  if (!allowedNodeLabels.has(fromType) || !allowedNodeLabels.has(toType)) {
    return res.status(400).json({ error: "Unsupported node label in link" });
  }

  if (!fromId || !toId || !relationType) {
    return res.status(400).json({ error: "fromId, toId, and relationType are required" });
  }

  try {
    const safeRelationType = sanitizeRelationType(relationType);

    const query = `
      MATCH (a:${fromType} {id: $fromId})
      MATCH (b:${toType} {id: $toId})
      MERGE (a)-[r:${safeRelationType}]->(b)
      SET r += $properties
      SET r.updatedAt = datetime()
      SET r.createdAt = coalesce(r.createdAt, datetime())
      RETURN a, r, b
    `;

    const result = await runQuery(query, { fromId, toId, properties });
    return res.status(200).json({ link: firstRecordOrNull(result) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/follows", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const { followerPersonId, targetType, targetId } = req.body || {};
  if (!followerPersonId || !targetType || !targetId) {
    return res.status(400).json({ error: "followerPersonId, targetType, and targetId are required" });
  }

  let relationType = "";
  let targetLabel = "";

  if (targetType === "Person") {
    relationType = "FOLLOWS_PERSON";
    targetLabel = "Person";
  } else if (targetType === "Module") {
    relationType = "FOLLOWS_MODULE";
    targetLabel = "Module";
  } else {
    return res.status(400).json({ error: "targetType must be Person or Module" });
  }

  try {
    const query = `
      MATCH (f:Person {id: $followerPersonId})
      MATCH (t:${targetLabel} {id: $targetId})
      MERGE (f)-[r:${relationType}]->(t)
      SET r.createdAt = coalesce(r.createdAt, datetime())
      SET r.updatedAt = datetime()
      RETURN f, r, t
    `;

    const result = await runQuery(query, { followerPersonId, targetId });
    return res.status(200).json({ follow: firstRecordOrNull(result) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/comments", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const {
    commentId,
    personId,
    personName,
    moduleId,
    body,
    kind = "Comment",
    sourceTextId
  } = req.body || {};

  if (!moduleId || !body) return res.status(400).json({ error: "moduleId and body are required" });

  const resolvedPersonId = personId || (personName ? `person-${normalizeId(personName)}` : null);
  if (!resolvedPersonId) {
    return res.status(400).json({ error: "personId or personName is required" });
  }

  const resolvedCommentId = commentId || `comment-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

  try {
    const query = `
      MERGE (p:Person {id: $personId})
      ON CREATE SET p.name = coalesce($personName, $personId), p.createdAt = datetime()
      SET p.updatedAt = datetime()

      MERGE (m:Module {id: $moduleId})
      ON CREATE SET m.createdAt = datetime()
      SET m.updatedAt = datetime()

      MERGE (c:Comment {id: $commentId})
      SET c.body = $body,
          c.kind = $kind,
          c.createdAt = coalesce(c.createdAt, datetime()),
          c.updatedAt = datetime()

      MERGE (p)-[pc:POSTED_COMMENT]->(c)
      SET pc.updatedAt = datetime(), pc.createdAt = coalesce(pc.createdAt, datetime())

      MERGE (c)-[cm:BELONGS_TO_MODULE]->(m)
      SET cm.updatedAt = datetime(), cm.createdAt = coalesce(cm.createdAt, datetime())

      WITH p, m, c
      OPTIONAL MATCH (s:ReportText {id: $sourceTextId})
      FOREACH (_ IN CASE WHEN s IS NULL THEN [] ELSE [1] END |
        MERGE (c)-[cr:COMMENT_REFERENCES_SOURCE_TEXT]->(s)
        SET cr.updatedAt = datetime(), cr.createdAt = coalesce(cr.createdAt, datetime())
      )
      RETURN p, c, m
    `;

    const result = await runQuery(query, {
      personId: resolvedPersonId,
      personName: personName || resolvedPersonId,
      moduleId,
      commentId: resolvedCommentId,
      body,
      kind,
      sourceTextId: sourceTextId || null
    });

    return res.status(201).json({ created: firstRecordOrNull(result) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/modules/:moduleId/discussion", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(200).json({ comments: [], facts: [] });

  const { moduleId } = req.params;

  try {
    const result = await runQuery(
      `
      MATCH (m:Module {id: $moduleId})
      OPTIONAL MATCH (rt:ReportText)-[:SOURCE_TEXT_BELONGS_TO_MODULE]->(m)
      OPTIONAL MATCH (c:Comment)-[:BELONGS_TO_MODULE]->(m)
      OPTIONAL MATCH (author:Person)-[:POSTED_COMMENT]->(c)
      RETURN
        m,
        collect(DISTINCT rt) AS facts,
        collect(DISTINCT {
          id: c.id,
          body: c.body,
          kind: c.kind,
          createdAt: toString(c.createdAt),
          authorName: author.name
        }) AS comments
      `,
      { moduleId }
    );

    const row = firstRecordOrNull(result);
    if (!row) return res.status(404).json({ error: "Module not found" });

    const facts = (row.facts || []).filter((entry) => entry && entry.id);
    const comments = (row.comments || []).filter((entry) => entry && entry.id);

    return res.status(200).json({ module: row.m || null, facts, comments });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/seed/modules", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const { modules: payloadModules } = req.body || {};
  if (!Array.isArray(payloadModules) || payloadModules.length === 0) {
    return res.status(400).json({ error: "modules array is required" });
  }

  const session = driver.session({ database: dbName });
  const tx = session.beginTransaction();

  try {
    for (const module of payloadModules) {
      const moduleId = String(module.id || "").trim();
      if (!moduleId) continue;

      await tx.run(
        `
        MERGE (m:Module {id: $id})
        SET m.name = $name,
            m.category = $category,
            m.description = $description,
            m.updatedAt = datetime(),
            m.createdAt = coalesce(m.createdAt, datetime())
        `,
        {
          id: moduleId,
          name: module.label || moduleId,
          category: module.category || null,
          description: module.description || null
        }
      );

      const facts = Array.isArray(module.facts) ? module.facts : [];
      for (const factEntry of facts) {
        const factText = typeof factEntry === "string" ? factEntry : String(factEntry?.text || "").trim();
        if (!factText) continue;

        const factId = `source-${moduleId}-${normalizeId(String(factText).slice(0, 60))}`;
        const page = typeof factEntry === "object" ? String(factEntry.page || "") : "";
        const section = typeof factEntry === "object" ? String(factEntry.section || "") : "";
        const sourceUrl = typeof factEntry === "object" ? String(factEntry.url || "") : "";
        const sourceLabel = typeof factEntry === "object" ? String(factEntry.sourceLabel || "") : "";
        const tags = Array.isArray(factEntry?.tags)
          ? factEntry.tags.filter((tag) => typeof tag === "string").slice(0, 15)
          : [];

        await tx.run(
          `
          MERGE (s:ReportText {id: $factId})
          SET s.text = $text,
              s.page = $page,
              s.section = $section,
              s.sourceUrl = $sourceUrl,
              s.sourceLabel = $sourceLabel,
              s.tags = $tags,
              s.sourceType = coalesce(s.sourceType, 'seed-fact'),
              s.updatedAt = datetime(),
              s.createdAt = coalesce(s.createdAt, datetime())
          WITH s
          MATCH (m:Module {id: $moduleId})
          MERGE (s)-[r:SOURCE_TEXT_BELONGS_TO_MODULE]->(m)
          SET r.updatedAt = datetime(),
              r.createdAt = coalesce(r.createdAt, datetime())
          `,
          {
            factId,
            text: factText,
            page,
            section,
            sourceUrl,
            sourceLabel,
            tags,
            moduleId
          }
        );
      }
    }

    await tx.commit();
    await session.close();
    return res.status(200).json({ seeded: payloadModules.length });
  } catch (error) {
    await tx.rollback();
    await session.close();
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/reporttext/anchors/import", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const { moduleId, anchors } = req.body || {};
  if (!moduleId || typeof moduleId !== "string") {
    return res.status(400).json({ error: "moduleId is required" });
  }

  if (!Array.isArray(anchors) || anchors.length === 0) {
    return res.status(400).json({ error: "anchors array is required" });
  }

  const session = driver.session({ database: dbName });
  const tx = session.beginTransaction();

  try {
    await tx.run(
      `
      MERGE (m:Module {id: $moduleId})
      SET m.updatedAt = datetime(),
          m.createdAt = coalesce(m.createdAt, datetime())
      `,
      { moduleId }
    );

    let imported = 0;

    for (const anchor of anchors) {
      const text = String(anchor?.text || "").trim();
      if (!text) continue;

      const sourceTextId = String(anchor?.id || `source-${moduleId}-${normalizeId(text.slice(0, 80))}`).trim();
      if (!sourceTextId) continue;

      const page = String(anchor?.page || "").trim();
      const section = String(anchor?.section || "").trim();
      const sourceUrl = String(anchor?.url || "").trim();
      const sourceLabel = String(anchor?.sourceLabel || "AI for Advancing Smart Cities").trim();
      const tags = Array.isArray(anchor?.tags)
        ? anchor.tags.filter((tag) => typeof tag === "string").slice(0, 20)
        : [];

      await tx.run(
        `
        MERGE (s:ReportText {id: $sourceTextId})
        SET s.text = $text,
            s.page = $page,
            s.section = $section,
            s.sourceUrl = $sourceUrl,
            s.sourceLabel = $sourceLabel,
            s.tags = $tags,
            s.sourceType = 'pdf-anchor',
            s.updatedAt = datetime(),
            s.createdAt = coalesce(s.createdAt, datetime())
        WITH s
        MATCH (m:Module {id: $moduleId})
        MERGE (s)-[r:SOURCE_TEXT_BELONGS_TO_MODULE]->(m)
        SET r.updatedAt = datetime(),
            r.createdAt = coalesce(r.createdAt, datetime())
        `,
        {
          sourceTextId,
          text,
          page,
          section,
          sourceUrl,
          sourceLabel,
          tags,
          moduleId
        }
      );

      imported += 1;
    }

    await tx.commit();
    await session.close();
    return res.status(200).json({ imported, moduleId });
  } catch (error) {
    await tx.rollback();
    await session.close();
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/schema/init", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(503).json({ error: "Neo4j credentials not configured" });

  const statements = [
    "CREATE CONSTRAINT person_id_unique IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE",
    "CREATE CONSTRAINT comment_id_unique IF NOT EXISTS FOR (c:Comment) REQUIRE c.id IS UNIQUE",
    "CREATE CONSTRAINT module_id_unique IF NOT EXISTS FOR (m:Module) REQUIRE m.id IS UNIQUE",
    "CREATE CONSTRAINT source_id_unique IF NOT EXISTS FOR (s:ReportText) REQUIRE s.id IS UNIQUE"
  ];

  try {
    for (const query of statements) {
      await runQuery(query);
    }

    return res.status(200).json({ initialized: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/graph", async (req, res) => {
  if (!hasNeo4jConfig()) return res.status(200).json({ nodes: [], links: [] });

  try {
    const result = await runQuery(
      `
      MATCH (a)-[r]->(b)
      RETURN
        collect(DISTINCT a) AS aNodes,
        collect(DISTINCT b) AS bNodes,
        collect(DISTINCT {
          type: type(r),
          fromId: a.id,
          toId: b.id
        }) AS links
      `
    );

    const row = firstRecordOrNull(result) || {};
    const combined = [...(row.aNodes || []), ...(row.bNodes || [])];
    const nodeMap = new Map();

    for (const node of combined) {
      if (node && node.id) nodeMap.set(node.id, node);
    }

    return res.status(200).json({
      nodes: Array.from(nodeMap.values()),
      links: row.links || []
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/chatbot/query", async (req, res) => {
  const { moduleId, question, history = [] } = req.body || {};

  if (!moduleId || typeof moduleId !== "string") {
    return res.status(400).json({ error: "moduleId is required" });
  }

  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "question is required" });
  }

  const moduleContext = getModuleFallbackContext(moduleId);
  let graphContext = { facts: [], comments: [] };
  let moduleAnchors = [];

  if (hasNeo4jConfig()) {
    try {
      graphContext = await getModuleContextFromGraph(moduleId);
      moduleAnchors = await getRankedModuleAnchors(moduleId, question);
    } catch (error) {
      console.warn("Failed to load graph context for chatbot:", error.message);
    }
  }

  let externalKnowledge = [];
  if (mcpBridgeUrl) {
    try {
      externalKnowledge = await queryMcpBridge({ moduleId, question, history });
    } catch (error) {
      console.warn("MCP bridge query failed:", error.message);
    }
  }

  const contextBlock = buildContextBlock({
    moduleId,
    moduleContext,
    graphContext,
    moduleAnchors,
    externalKnowledge
  });

  const citations = buildCitations(moduleContext, moduleAnchors, externalKnowledge);

  if (!openAiApiKey) {
    const fallback = buildFallbackAnswer({ question, moduleContext, graphContext, moduleAnchors, externalKnowledge });
    return res.status(200).json({
      answer: fallback,
      citations,
      mode: "fallback"
    });
  }

  try {
    const answer = await queryOpenAi({
      question,
      history,
      contextBlock
    });

    return res.status(200).json({
      answer,
      citations,
      mode: "model"
    });
  } catch (error) {
    console.warn("Model response failed, using fallback answer:", error.message);
    const fallback = buildFallbackAnswer({ question, moduleContext, graphContext, moduleAnchors, externalKnowledge });
    return res.status(200).json({
      answer: fallback,
      citations,
      mode: "fallback",
      warning: error.message
    });
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected server error" });
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

function normalizeId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreAnchorForQuestion(anchor, questionTokens) {
  const textTokens = tokenize(anchor.text);
  const sectionTokens = tokenize(anchor.section);
  const tagTokens = Array.isArray(anchor.tags) ? anchor.tags.flatMap((tag) => tokenize(tag)) : [];
  const bag = new Set([...textTokens, ...sectionTokens, ...tagTokens]);

  let score = 0;
  for (const token of questionTokens) {
    if (bag.has(token)) score += 1;
  }

  if (anchor.section) score += 0.2;
  if (anchor.page) score += 0.2;
  if (anchor.sourceUrl) score += 0.2;
  return score;
}

function getModuleFallbackContext(moduleId) {
  const moduleLibrary = {
    governance: {
      label: "Urban Governance",
      facts: [
        "Coordinated procurement, policy, and data strategies improve smart city outcomes.",
        "Governance approaches should link experimentation to measurable social impact.",
        "Multi-stakeholder collaboration increases the chance of scaling pilots."
      ]
    },
    mobility: {
      label: "Mobility and Access",
      facts: [
        "Interoperability between mobility operators and datasets is important for connected systems.",
        "Inclusion and affordability are key criteria for transport innovation.",
        "Data governance is needed when digital routing tools are deployed at scale."
      ]
    },
    environment: {
      label: "Climate and Environment",
      facts: [
        "AI-assisted monitoring can help adaptation planning and early warning.",
        "Resilience policies are stronger when environmental and social data are combined.",
        "Transparency builds trust in predictive environmental tools."
      ]
    },
    energy: {
      label: "Energy Systems",
      facts: [
        "AI can support demand forecasting and energy optimization.",
        "Digital and clean-energy infrastructure planning should be coordinated.",
        "Institutional capacity is as important as technical readiness."
      ]
    },
    housing: {
      label: "Housing and Urban Form",
      facts: [
        "Neighborhood-level data improves inclusive planning decisions.",
        "Equitable service access is a core benchmark for smart city programs.",
        "Policy design should account for diverse local conditions."
      ]
    },
    digital: {
      label: "Digital Public Infrastructure",
      facts: [
        "Trustworthy digital infrastructure is foundational for AI-enabled services.",
        "Standards and governance shape the safety and scalability of digital programs.",
        "Privacy and cybersecurity protections should be built in from the start."
      ]
    },
    equity: {
      label: "Inclusion and Equity",
      facts: [
        "AI initiatives should be judged by inclusion outcomes, not only efficiency.",
        "Participatory design can reduce digital exclusion.",
        "Transparent accountability supports social legitimacy."
      ]
    },
    economy: {
      label: "Innovation Economy",
      facts: [
        "Public innovation ecosystems need skills, institutions, and interoperable data.",
        "Workforce development is central for equitable AI-led growth.",
        "Policy, capability, and financing alignment are required for scalable impact."
      ]
    }
  };

  return moduleLibrary[moduleId] || { label: moduleId, facts: [] };
}

async function getModuleContextFromGraph(moduleId) {
  const result = await runQuery(
    `
    MATCH (m:Module {id: $moduleId})
    OPTIONAL MATCH (rt:ReportText)-[:SOURCE_TEXT_BELONGS_TO_MODULE]->(m)
    OPTIONAL MATCH (c:Comment)-[:BELONGS_TO_MODULE]->(m)
    OPTIONAL MATCH (author:Person)-[:POSTED_COMMENT]->(c)
    RETURN
      collect(DISTINCT rt.text)[0..8] AS facts,
      collect(DISTINCT {
        body: c.body,
        kind: c.kind,
        author: author.name,
        createdAt: toString(c.createdAt)
      })[0..10] AS comments
    `,
    { moduleId }
  );

  const row = firstRecordOrNull(result) || {};
  const facts = Array.isArray(row.facts) ? row.facts.filter(Boolean) : [];
  const comments = Array.isArray(row.comments)
    ? row.comments.filter((entry) => entry && entry.body)
    : [];

  return { facts, comments };
}

async function getRankedModuleAnchors(moduleId, question) {
  const result = await runQuery(
    `
    MATCH (m:Module {id: $moduleId})
    OPTIONAL MATCH (rt:ReportText)-[:SOURCE_TEXT_BELONGS_TO_MODULE]->(m)
    RETURN collect(DISTINCT {
      id: rt.id,
      text: rt.text,
      page: rt.page,
      section: rt.section,
      sourceUrl: rt.sourceUrl,
      sourceLabel: rt.sourceLabel,
      tags: rt.tags
    }) AS anchors
    `,
    { moduleId }
  );

  const row = firstRecordOrNull(result) || {};
  const rawAnchors = Array.isArray(row.anchors) ? row.anchors : [];
  const anchors = rawAnchors.filter((entry) => entry && entry.text);
  if (!anchors.length) return [];

  const questionTokens = tokenize(question);
  return anchors
    .map((anchor) => ({
      ...anchor,
      score: scoreAnchorForQuestion(anchor, questionTokens)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

async function queryMcpBridge({ moduleId, question, history }) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (mcpBridgeApiKey) {
    headers.Authorization = `Bearer ${mcpBridgeApiKey}`;
  }

  const response = await fetch(mcpBridgeUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      moduleId,
      question,
      history,
      scope: defaultOecdScope,
      limit: 8
    })
  });

  if (!response.ok) {
    throw new Error(`MCP bridge failed with status ${response.status}`);
  }

  const payload = await response.json();
  const snippets = Array.isArray(payload.snippets) ? payload.snippets : [];

  return snippets
    .filter((entry) => entry && entry.text)
    .map((entry) => ({
      title: String(entry.title || "OECD source"),
      text: String(entry.text || ""),
      url: String(entry.url || "")
    }));
}

function buildContextBlock({ moduleId, moduleContext, graphContext, moduleAnchors, externalKnowledge }) {
  const moduleFacts = moduleContext.facts || [];
  const graphFacts = graphContext.facts || [];
  const graphComments = graphContext.comments || [];

  const lines = [];
  lines.push(`Module id: ${moduleId}`);
  lines.push(`Module label: ${moduleContext.label || moduleId}`);
  lines.push("Module facts:");
  for (const fact of moduleFacts.slice(0, 6)) lines.push(`- ${fact}`);

  if (graphFacts.length) {
    lines.push("Report text snippets from graph:");
    for (const fact of graphFacts.slice(0, 8)) lines.push(`- ${fact}`);
  }

  if (graphComments.length) {
    lines.push("Community comments from this module discussion:");
    for (const comment of graphComments.slice(0, 6)) {
      const author = comment.author || "Unknown";
      const kind = comment.kind || "Comment";
      lines.push(`- [${kind}] ${author}: ${comment.body}`);
    }
  }

  if (moduleAnchors.length) {
    lines.push("Module-matched report anchors with citations:");
    for (const anchor of moduleAnchors.slice(0, 5)) {
      const citationBits = [];
      if (anchor.page) citationBits.push(`page ${anchor.page}`);
      if (anchor.section) citationBits.push(`section ${anchor.section}`);
      if (anchor.sourceLabel) citationBits.push(anchor.sourceLabel);

      lines.push(`- ${anchor.text}`);
      if (citationBits.length) lines.push(`  citation: ${citationBits.join(" | ")}`);
      if (anchor.sourceUrl) lines.push(`  url: ${anchor.sourceUrl}`);
    }
  }

  if (externalKnowledge.length) {
    lines.push("External OECD knowledge snippets:");
    for (const snippet of externalKnowledge.slice(0, 8)) {
      lines.push(`- ${snippet.title}: ${snippet.text}`);
      if (snippet.url) lines.push(`  URL: ${snippet.url}`);
    }
  }

  return lines.join("\n");
}

function buildCitations(moduleContext, moduleAnchors, externalKnowledge) {
  const citations = [];

  citations.push({ label: `Module facts: ${moduleContext.label || "selected module"}`, url: "AI_for_advancing_smart_cities.pdf" });

  for (const anchor of moduleAnchors.slice(0, 5)) {
    const labelBits = [];
    if (anchor.section) labelBits.push(anchor.section);
    if (anchor.page) labelBits.push(`p.${anchor.page}`);
    const labelSuffix = labelBits.length ? ` (${labelBits.join(", ")})` : "";

    citations.push({
      label: `${anchor.sourceLabel || "Report anchor"}${labelSuffix}`,
      url: anchor.sourceUrl || "AI_for_advancing_smart_cities.pdf"
    });
  }

  for (const snippet of externalKnowledge.slice(0, 8)) {
    if (!snippet.url) continue;
    citations.push({
      label: snippet.title,
      url: snippet.url
    });
  }

  return citations;
}

function buildFallbackAnswer({ question, moduleContext, graphContext, moduleAnchors, externalKnowledge }) {
  const facts = [
    ...(moduleContext.facts || []),
    ...(graphContext.facts || []),
    ...moduleAnchors.map((entry) => entry.text),
    ...externalKnowledge.map((entry) => entry.text)
  ].filter(Boolean);

  if (!facts.length) {
    return [
      "I do not have enough OECD-specific source context yet.",
      "To improve this answer, configure MCP_BRIDGE_URL to an OECD retrieval MCP adapter and set OPENAI_API_KEY.",
      `Question received: ${question}`
    ].join(" ");
  }

  const topFacts = facts.slice(0, 3).map((fact, index) => `${index + 1}. ${fact}`).join(" ");
  const anchorHint = moduleAnchors.length
    ? ` Most relevant anchors: ${moduleAnchors
        .slice(0, 2)
        .map((entry) => `${entry.section || "section n/a"}${entry.page ? `, page ${entry.page}` : ""}`)
        .join("; ")}.`
    : "";

  return `Based on available OECD and report context for ${moduleContext.label || "this module"}: ${topFacts}${anchorHint}`;
}

async function queryOpenAi({ question, history, contextBlock }) {
  const safeHistory = Array.isArray(history)
    ? history
        .filter((entry) => entry && typeof entry.content === "string")
        .slice(-8)
        .map((entry) => ({
          role: entry.role === "assistant" ? "assistant" : "user",
          content: entry.content
        }))
    : [];

  const systemInstruction = [
    "You are an OECD smart cities research assistant.",
    "Ground every answer in the provided context only.",
    "If context is insufficient, say what is missing and do not hallucinate.",
    "Be concise and practical."
  ].join(" ");

  const messages = [
    { role: "system", content: systemInstruction },
    {
      role: "system",
      content: `Context for grounding:\n${contextBlock}`
    },
    ...safeHistory,
    { role: "user", content: question }
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`
    },
    body: JSON.stringify({
      model: openAiModel,
      temperature: 0.2,
      messages
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI request failed (${response.status}): ${errorBody}`);
  }

  const payload = await response.json();
  const message = payload?.choices?.[0]?.message?.content;
  if (!message) {
    throw new Error("Model did not return an answer");
  }

  return String(message).trim();
}
