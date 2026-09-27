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
      for (const factText of facts) {
        const factId = `source-${moduleId}-${normalizeId(String(factText).slice(0, 60))}`;

        await tx.run(
          `
          MERGE (s:ReportText {id: $factId})
          SET s.text = $text,
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
            text: String(factText),
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
