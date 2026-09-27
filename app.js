const modules = [
  {
    id: "governance",
    label: "Urban Governance",
    category: "Institutions",
    description: "How city institutions coordinate, budget, regulate, and adapt policy across public and private actors.",
    prompts: [
      "What governance models best support cross-sector innovation?",
      "How can metrics reduce policy siloing between city departments?",
      "Which public participation approaches improve trust and legitimacy?"
    ],
    facts: [
      "Report theme: smart city governance works best when policy, procurement, and data strategy are coordinated.",
      "Report theme: city-level experimentation should be linked to measurable social outcomes.",
      "Report theme: multi-stakeholder governance helps scale pilots into long-term programs."
    ]
  },
  {
    id: "mobility",
    label: "Mobility and Access",
    category: "Infrastructure",
    description: "Movement of people and goods through multimodal, safe, and inclusive transportation networks.",
    prompts: [
      "How can mobility data lower commute inequality?",
      "Which interventions reduce congestion and emissions together?",
      "What incentives shift travel behavior without excluding users?"
    ],
    facts: [
      "Report theme: connected mobility systems need interoperability across operators and datasets.",
      "Report theme: transport innovation should be assessed against inclusion and affordability indicators.",
      "Report theme: digital tools improve routing, but require robust data governance."
    ]
  },
  {
    id: "environment",
    label: "Climate and Environment",
    category: "Resilience",
    description: "City strategies for air quality, adaptation, biodiversity, and carbon reduction.",
    prompts: [
      "Which indicators capture both climate risk and social vulnerability?",
      "How should green infrastructure be prioritized by neighborhood?",
      "What policy tools accelerate adaptation investments?"
    ],
    facts: [
      "Report theme: AI-supported environmental monitoring can improve early warning and adaptation planning.",
      "Report theme: resilience policy is strongest when environmental and social datasets are integrated.",
      "Report theme: public transparency is crucial when deploying predictive tools for risk management."
    ]
  },
  {
    id: "energy",
    label: "Energy Systems",
    category: "Utilities",
    description: "Decarbonized, reliable, and affordable energy systems for buildings, transport, and industry.",
    prompts: [
      "Where can demand-response reduce peak strain most effectively?",
      "How can local grids be designed for outage resilience?",
      "What financing models help retrofit legacy districts?"
    ],
    facts: [
      "Report theme: urban AI applications can improve demand forecasting and optimize energy use.",
      "Report theme: digital infrastructure and clean-energy transitions should be planned together.",
      "Report theme: governance capacity matters as much as technical capacity for deployment success."
    ]
  },
  {
    id: "housing",
    label: "Housing and Urban Form",
    category: "Livability",
    description: "Affordability, density, spatial planning, and equitable access to services.",
    prompts: [
      "How can zoning reforms improve affordability without displacement?",
      "What mixed-use patterns best support 15-minute city goals?",
      "How can public land policy unlock inclusive housing supply?"
    ],
    facts: [
      "Report theme: inclusive digital planning requires neighborhood-level evidence and participatory inputs.",
      "Report theme: equitable service access is a core benchmark of smart city progress.",
      "Report theme: policy design should account for heterogeneous local contexts."
    ]
  },
  {
    id: "digital",
    label: "Digital Public Infrastructure",
    category: "Technology",
    description: "Data platforms, standards, cybersecurity, and digital identity foundations for city services.",
    prompts: [
      "What open standards improve interoperability across city systems?",
      "How can privacy-by-design be enforced in procurement?",
      "Which governance patterns avoid platform lock-in?"
    ],
    facts: [
      "Report theme: trustworthy digital infrastructure is foundational for AI-enabled city services.",
      "Report theme: governance and standards determine whether digital transformation scales safely.",
      "Report theme: cybersecurity and privacy safeguards must be embedded by design."
    ]
  },
  {
    id: "equity",
    label: "Inclusion and Equity",
    category: "Social Outcomes",
    description: "Distributional fairness of benefits, risks, opportunities, and voice in smart city programs.",
    prompts: [
      "Which neighborhoods are most excluded from digital services?",
      "How should impact assessments account for disability access?",
      "What indicators make equity outcomes accountable over time?"
    ],
    facts: [
      "Report theme: AI adoption should be evaluated against inclusion, not only efficiency metrics.",
      "Report theme: participatory design helps reduce digital exclusion.",
      "Report theme: social legitimacy depends on transparent accountability mechanisms."
    ]
  },
  {
    id: "economy",
    label: "Innovation Economy",
    category: "Growth",
    description: "Entrepreneurship, talent, and local industry transition in a data-enabled urban economy.",
    prompts: [
      "How can city pilots scale into durable economic value?",
      "What workforce pathways match emerging city-tech demand?",
      "How should procurement support local innovation ecosystems?"
    ],
    facts: [
      "Report theme: public innovation ecosystems need institutional support, skills, and interoperable data.",
      "Report theme: workforce development is critical for equitable AI-led growth.",
      "Report theme: scalable impact requires alignment between policy, capability, and financing."
    ]
  }
];

const links = [
  ["governance", "digital"],
  ["governance", "equity"],
  ["governance", "economy"],
  ["mobility", "environment"],
  ["mobility", "housing"],
  ["mobility", "energy"],
  ["environment", "energy"],
  ["environment", "housing"],
  ["housing", "equity"],
  ["digital", "mobility"],
  ["digital", "economy"],
  ["economy", "energy"]
];

const canvas = document.getElementById("networkCanvas");
const ctx = canvas.getContext("2d");

const selectedModuleTitle = document.getElementById("selectedModuleTitle");
const selectedModuleDescription = document.getElementById("selectedModuleDescription");
const selectedModulePrompts = document.getElementById("selectedModulePrompts");
const selectedModuleFacts = document.getElementById("selectedModuleFacts");
const commentForm = document.getElementById("commentForm");
const commentList = document.getElementById("commentList");
const exportCommentsBtn = document.getElementById("exportCommentsBtn");
const clearModuleCommentsBtn = document.getElementById("clearModuleCommentsBtn");
const resetViewBtn = document.getElementById("resetViewBtn");
const nodeFocusPanel = document.getElementById("nodeFocusPanel");

let selectedModuleId = modules[0].id;
let hoverNode = null;
let width = 0;
let height = 0;
let isDragging = false;
let dragMoved = false;
let lastPointer = { x: 0, y: 0 };
let focusMode = true;

const camera = {
  x: 0,
  y: 0,
  scale: 1,
  targetX: 0,
  targetY: 0,
  targetScale: 1,
  manualControl: false
};

const STORAGE_KEY = "smart-city-module-comments-v1";
const commentsByModule = loadComments();
const nodes = initializeNodes(modules);
const nodeMap = new Map(nodes.map((node) => [node.id, node]));
const starField = createStarField(130);

initialize();
animate();

async function initialize() {
  setupCanvasSize();
  window.addEventListener("resize", setupCanvasSize);

  await seedModulesToApi();
  setSelectedModule(selectedModuleId, true);
  wireEvents();
}

function initializeNodes(moduleData) {
  return moduleData.map((module, index) => {
    const angle = (index / moduleData.length) * Math.PI * 2;
    return {
      ...module,
      x: 0,
      y: 0,
      vx: Math.cos(angle) * 0.1,
      vy: Math.sin(angle) * 0.1,
      radius: 18
    };
  });
}

function createStarField(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 2 + 0.35,
    alpha: Math.random() * 0.4 + 0.15
  }));
}

function setupCanvasSize() {
  const parent = canvas.parentElement;
  width = canvas.width = parent.clientWidth;
  height = canvas.height = parent.clientHeight;

  if (!nodes.some((node) => node.seeded)) {
    const radiusX = Math.min(width, height) * 0.29;
    const radiusY = Math.min(width, height) * 0.24;

    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      node.x = width / 2 + Math.cos(angle) * radiusX;
      node.y = height / 2 + Math.sin(angle) * radiusY;
      node.seeded = true;
    });
  }

  if (camera.targetScale === 1) {
    camera.x = width / 2;
    camera.y = height / 2;
    camera.targetX = width / 2;
    camera.targetY = height / 2;
  }
}

function wireEvents() {
  canvas.addEventListener("mousemove", onCanvasMove);
  canvas.addEventListener("mouseleave", () => {
    hoverNode = null;
    if (!isDragging) canvas.classList.remove("is-grabbing");
  });

  canvas.addEventListener("click", onCanvasClick);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheelZoom, { passive: false });

  commentForm.addEventListener("submit", onCommentSubmit);
  exportCommentsBtn.addEventListener("click", exportComments);
  clearModuleCommentsBtn.addEventListener("click", clearSelectedModuleComments);
  resetViewBtn.addEventListener("click", resetConstellationView);
}

function onPointerDown(event) {
  isDragging = true;
  dragMoved = false;
  lastPointer = { x: event.clientX, y: event.clientY };
  camera.manualControl = true;
  canvas.classList.add("is-grabbing");
  canvas.setPointerCapture(event.pointerId);
}

function onPointerMove(event) {
  if (!isDragging) return;

  const dx = event.clientX - lastPointer.x;
  const dy = event.clientY - lastPointer.y;

  if (Math.hypot(dx, dy) > 1.2) dragMoved = true;

  camera.x -= dx / camera.scale;
  camera.y -= dy / camera.scale;
  camera.targetX = camera.x;
  camera.targetY = camera.y;

  lastPointer = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  isDragging = false;
  canvas.classList.remove("is-grabbing");
  if (canvas.hasPointerCapture(event.pointerId)) {
    canvas.releasePointerCapture(event.pointerId);
  }
}

function onWheelZoom(event) {
  event.preventDefault();
  camera.manualControl = true;

  const zoomDelta = event.deltaY * -0.0012;
  const nextScale = clamp(camera.targetScale * (1 + zoomDelta), 0.7, 2.8);

  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  const before = screenToWorld(sx, sy);
  camera.targetScale = nextScale;
  camera.scale = nextScale;
  const after = screenToWorld(sx, sy);

  camera.x += before.x - after.x;
  camera.y += before.y - after.y;
  camera.targetX = camera.x;
  camera.targetY = camera.y;
}

function onCanvasClick() {
  if (dragMoved) return;
  if (!hoverNode) return;
  setSelectedModule(hoverNode.id);
}

function onCanvasMove(event) {
  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;
  const world = screenToWorld(sx, sy);

  hoverNode = nodes.find((node) => {
    const dx = world.x - node.x;
    const dy = world.y - node.y;
    return Math.hypot(dx, dy) <= node.radius + 8;
  }) || null;

  if (!isDragging) {
    canvas.style.cursor = hoverNode ? "pointer" : "grab";
  }
}

function setSelectedModule(moduleId, skipCameraTransition = false) {
  selectedModuleId = moduleId;
  focusMode = true;

  const module = modules.find((entry) => entry.id === moduleId);
  const selectedNode = nodeMap.get(moduleId);
  if (!module || !selectedNode) return;

  selectedModuleTitle.textContent = module.label;
  selectedModuleDescription.textContent = module.description;

  selectedModulePrompts.innerHTML = "";
  for (const prompt of module.prompts) {
    const item = document.createElement("li");
    item.textContent = prompt;
    selectedModulePrompts.appendChild(item);
  }

  selectedModuleFacts.innerHTML = "";
  for (const fact of module.facts || []) {
    const item = document.createElement("li");
    item.textContent = fact;
    selectedModuleFacts.appendChild(item);
  }

  if (skipCameraTransition) {
    camera.x = selectedNode.x;
    camera.y = selectedNode.y;
    camera.scale = 1.72;
  }

  camera.manualControl = false;
  camera.targetX = selectedNode.x;
  camera.targetY = selectedNode.y;
  camera.targetScale = 1.72;

  renderCommentsForModule(moduleId);
  loadDiscussionFromApi(moduleId);

  if (nodeFocusPanel) nodeFocusPanel.classList.remove("hidden");
}

function resetConstellationView() {
  focusMode = false;
  camera.manualControl = false;
  camera.targetX = width / 2;
  camera.targetY = height / 2;
  camera.targetScale = 1;

  if (nodeFocusPanel) nodeFocusPanel.classList.add("hidden");
}

function stepPhysics() {
  applyLinkForces();
  applyRepulsion();
  applyCenterForce();
  integrateAndConstrain();
  resolveCollisions();
  updateCamera();
}

function applyLinkForces() {
  for (const [sourceId, targetId] of links) {
    const source = nodeMap.get(sourceId);
    const target = nodeMap.get(targetId);
    if (!source || !target) continue;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const desiredLength = 226;
    const springStrength = 0.001;
    const stretch = distance - desiredLength;
    const force = stretch * springStrength;

    source.vx += (dx / distance) * force;
    source.vy += (dy / distance) * force;
    target.vx -= (dx / distance) * force;
    target.vy -= (dy / distance) * force;
  }
}

function applyRepulsion() {
  const charge = 14500;

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = Math.max(980, dx * dx + dy * dy);
      const distance = Math.sqrt(distanceSq);
      const force = charge / distanceSq;

      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }
}

function applyCenterForce() {
  const cx = width / 2;
  const cy = height / 2;

  for (const node of nodes) {
    node.vx += (cx - node.x) * 0.0002;
    node.vy += (cy - node.y) * 0.0002;
  }
}

function integrateAndConstrain() {
  const margin = 42;
  const maxSpeed = 0.52;

  for (const node of nodes) {
    node.vx *= 0.948;
    node.vy *= 0.948;

    const speed = Math.hypot(node.vx, node.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      node.vx *= scale;
      node.vy *= scale;
    }

    node.x += node.vx;
    node.y += node.vy;

    if (node.x < node.radius + margin || node.x > width - node.radius - margin) node.vx *= -0.72;
    if (node.y < node.radius + margin || node.y > height - node.radius - margin) node.vy *= -0.72;

    node.x = clamp(node.x, node.radius + margin, width - node.radius - margin);
    node.y = clamp(node.y, node.radius + margin, height - node.radius - margin);
  }
}

function resolveCollisions() {
  const bounce = 0.06;

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 0.001;
      const minDistance = a.radius + b.radius + 16;

      if (distance >= minDistance) continue;

      const overlap = minDistance - distance;
      const nx = dx / distance;
      const ny = dy / distance;
      const shift = overlap * 0.5;

      a.x -= nx * shift;
      a.y -= ny * shift;
      b.x += nx * shift;
      b.y += ny * shift;

      a.vx -= nx * bounce;
      a.vy -= ny * bounce;
      b.vx += nx * bounce;
      b.vy += ny * bounce;
    }
  }
}

function updateCamera() {
  if (!camera.manualControl && focusMode) {
    const selectedNode = nodeMap.get(selectedModuleId);
    if (selectedNode) {
      camera.targetX = selectedNode.x;
      camera.targetY = selectedNode.y;
    }
  }

  camera.x += (camera.targetX - camera.x) * 0.08;
  camera.y += (camera.targetY - camera.y) * 0.08;
  camera.scale += (camera.targetScale - camera.scale) * 0.08;
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);

  renderStars();

  ctx.setTransform(
    camera.scale,
    0,
    0,
    camera.scale,
    width / 2 - camera.x * camera.scale,
    height / 2 - camera.y * camera.scale
  );

  renderLinks();
  renderNodes();
}

function renderStars() {
  for (const star of starField) {
    const x = star.x * width;
    const y = star.y * height;

    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(201, 229, 255, ${star.alpha})`;
    ctx.fill();
  }
}

function renderLinks() {
  for (const [sourceId, targetId] of links) {
    const source = nodeMap.get(sourceId);
    const target = nodeMap.get(targetId);
    if (!source || !target) continue;

    const isActive = source.id === selectedModuleId || target.id === selectedModuleId;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.lineWidth = isActive ? 1.8 : 1;
    ctx.strokeStyle = isActive ? "rgba(163, 240, 232, 0.88)" : "rgba(171, 204, 255, 0.24)";
    ctx.stroke();
  }
}

function renderNodes() {
  for (const node of nodes) {
    const selected = node.id === selectedModuleId;
    const hovered = hoverNode && hoverNode.id === node.id;

    const ringRadius = selected ? node.radius + 11 : node.radius + 6;

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = selected ? 2.5 : 1.25;
    ctx.strokeStyle = selected ? "rgba(170, 247, 239, 0.95)" : "rgba(168, 204, 255, 0.8)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "rgba(167, 250, 241, 0.98)" : "rgba(191, 221, 255, 0.86)";
    ctx.fill();

    if (hovered || selected) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, ringRadius + 8, 0, Math.PI * 2);
      ctx.lineWidth = 0.85;
      ctx.strokeStyle = selected ? "rgba(135, 246, 229, 0.5)" : "rgba(160, 197, 255, 0.4)";
      ctx.stroke();
    }

    ctx.fillStyle = "#e9f3ff";
    ctx.font = selected ? "700 11px Space Grotesk" : "600 10px Space Grotesk";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(node.label, node.x, node.y + ringRadius + 6);

    if (hovered) {
      ctx.fillStyle = "rgba(176, 229, 255, 0.9)";
      ctx.font = "500 9px Space Grotesk";
      ctx.fillText(node.category, node.x, node.y + ringRadius + 20);
    }
  }
}

function animate() {
  stepPhysics();
  render();
  requestAnimationFrame(animate);
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - width / 2) / camera.scale + camera.x,
    y: (screenY - height / 2) / camera.scale + camera.y
  };
}

async function onCommentSubmit(event) {
  event.preventDefault();
  if (!selectedModuleId) return;

  const formData = new FormData(commentForm);
  const name = String(formData.get("contributorName") || "").trim();
  const type = String(formData.get("ideaType") || "").trim();
  const note = String(formData.get("ideaText") || "").trim();

  if (!name || !type || !note) return;

  const entry = {
    id: crypto.randomUUID(),
    name,
    type,
    note,
    createdAt: new Date().toISOString()
  };

  if (!commentsByModule[selectedModuleId]) commentsByModule[selectedModuleId] = [];
  commentsByModule[selectedModuleId].unshift(entry);
  persistComments();
  renderCommentsForModule(selectedModuleId);

  await postCommentToApi({
    personName: name,
    moduleId: selectedModuleId,
    body: note,
    kind: type
  });

  commentForm.reset();
}

function renderCommentsForModule(moduleId) {
  commentList.innerHTML = "";

  const comments = commentsByModule[moduleId] || [];
  if (comments.length === 0) {
    const item = document.createElement("li");
    item.className = "empty-state";
    item.textContent = "No comments for this module yet. Be the first to contribute.";
    commentList.appendChild(item);
    return;
  }

  for (const comment of comments) {
    const item = document.createElement("li");
    item.className = "comment-item";

    const time = new Date(comment.createdAt).toLocaleString();
    item.innerHTML = `
      <p><strong>${escapeHtml(comment.type)}</strong>: ${escapeHtml(comment.note)}</p>
      <p class="comment-meta">By ${escapeHtml(comment.name)} on ${escapeHtml(time)}</p>
    `;

    commentList.appendChild(item);
  }
}

function clearSelectedModuleComments() {
  if (!selectedModuleId) return;

  const confirmClear = window.confirm("Delete all comments for the selected module?");
  if (!confirmClear) return;

  commentsByModule[selectedModuleId] = [];
  persistComments();
  renderCommentsForModule(selectedModuleId);
}

function exportComments() {
  const payload = {
    exportedAt: new Date().toISOString(),
    commentsByModule
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "smart-city-comments.json";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function loadDiscussionFromApi(moduleId) {
  try {
    const response = await fetch(`/api/modules/${encodeURIComponent(moduleId)}/discussion`);
    if (!response.ok) {
      console.warn(`Discussion API returned ${response.status} for module ${moduleId}`);
      return;
    }

    const payload = await response.json();
    const apiComments = Array.isArray(payload.comments) ? payload.comments : [];

    const transformed = apiComments.map((entry) => ({
      id: entry.id || crypto.randomUUID(),
      name: entry.authorName || "Unknown",
      type: entry.kind || "Comment",
      note: entry.body || "",
      createdAt: entry.createdAt || new Date().toISOString()
    }));

    commentsByModule[moduleId] = dedupeComments([...(commentsByModule[moduleId] || []), ...transformed]);
    persistComments();
    renderCommentsForModule(moduleId);
  } catch (error) {
    console.warn("Discussion API unavailable; running in local mode.", error);
  }
}

async function seedModulesToApi() {
  try {
    const response = await fetch("/api/seed/modules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modules })
    });

    if (!response.ok) {
      console.warn("Module seed failed; API may be unavailable.", response.status);
    } else {
      console.log("Modules seeded to Neo4j successfully.");
    }
  } catch (error) {
    console.warn("Module seed request failed; running in local mode.", error);
  }
}

async function postCommentToApi({ personName, moduleId, body, kind }) {
  try {
    await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personName,
        moduleId,
        body,
        kind
      })
    });
  } catch {
    // Local mode fallback is intentional when API is unavailable.
  }
}

function dedupeComments(comments) {
  const map = new Map();

  for (const entry of comments) {
    const key = `${entry.name}|${entry.type}|${entry.note}|${entry.createdAt}`;
    if (!map.has(key)) map.set(key, entry);
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function loadComments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistComments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(commentsByModule));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
