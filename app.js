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

const moduleButtons = document.getElementById("moduleButtons");
const selectedModuleTitle = document.getElementById("selectedModuleTitle");
const selectedModuleDescription = document.getElementById("selectedModuleDescription");
const selectedModulePrompts = document.getElementById("selectedModulePrompts");
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

const camera = {
  x: 0,
  y: 0,
  scale: 1,
  targetX: 0,
  targetY: 0,
  targetScale: 1
};

const STORAGE_KEY = "smart-city-module-comments-v1";
const commentsByModule = loadComments();
const nodes = initializeNodes(modules);
const nodeMap = new Map(nodes.map((node) => [node.id, node]));
const starField = createStarField(120);

initialize();
animate();

function initialize() {
  setupCanvasSize();
  window.addEventListener("resize", setupCanvasSize);

  createModuleButtons();
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
      vx: Math.cos(angle) * 0.12,
      vy: Math.sin(angle) * 0.12,
      radius: 18
    };
  });
}

function createStarField(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random(),
    y: Math.random(),
    size: Math.random() * 1.8 + 0.3,
    alpha: Math.random() * 0.45 + 0.15
  }));
}

function setupCanvasSize() {
  const parent = canvas.parentElement;
  width = canvas.width = parent.clientWidth;
  height = canvas.height = parent.clientHeight;

  if (!nodes.some((node) => node.seeded)) {
    const radiusX = Math.min(width, height) * 0.28;
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

function createModuleButtons() {
  moduleButtons.innerHTML = "";

  nodes.forEach((node) => {
    const button = document.createElement("button");
    button.className = "module-button";
    button.type = "button";
    button.role = "listitem";
    button.dataset.moduleId = node.id;
    button.innerHTML = `<strong>${node.label}</strong><br><span>${node.category}</span>`;

    button.addEventListener("click", () => {
      setSelectedModule(node.id);
    });

    moduleButtons.appendChild(button);
  });
}

function wireEvents() {
  canvas.addEventListener("mousemove", onCanvasMove);
  canvas.addEventListener("mouseleave", () => {
    hoverNode = null;
    canvas.style.cursor = "default";
  });

  canvas.addEventListener("click", () => {
    if (!hoverNode) return;
    setSelectedModule(hoverNode.id);
  });

  commentForm.addEventListener("submit", onCommentSubmit);
  exportCommentsBtn.addEventListener("click", exportComments);
  clearModuleCommentsBtn.addEventListener("click", clearSelectedModuleComments);
  resetViewBtn.addEventListener("click", resetConstellationView);
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

  canvas.style.cursor = hoverNode ? "pointer" : "default";
}

function setSelectedModule(moduleId, skipCameraTransition = false) {
  selectedModuleId = moduleId;
  const module = modules.find((entry) => entry.id === moduleId);
  const selectedNode = nodeMap.get(moduleId);
  if (!module || !selectedNode) return;

  selectedModuleTitle.textContent = module.label;
  selectedModuleDescription.textContent = module.description;

  selectedModulePrompts.innerHTML = "";
  module.prompts.forEach((prompt) => {
    const item = document.createElement("li");
    item.textContent = prompt;
    selectedModulePrompts.appendChild(item);
  });

  Array.from(moduleButtons.children).forEach((button) => {
    const active = button.dataset.moduleId === moduleId;
    button.setAttribute("aria-current", active ? "true" : "false");
  });

  renderCommentsForModule(moduleId);
  nodeFocusPanel.classList.add("is-active");

  if (skipCameraTransition) {
    camera.x = selectedNode.x;
    camera.y = selectedNode.y;
    camera.scale = 1.75;
  }

  camera.targetX = selectedNode.x;
  camera.targetY = selectedNode.y;
  camera.targetScale = 1.75;
}

function resetConstellationView() {
  camera.targetX = width / 2;
  camera.targetY = height / 2;
  camera.targetScale = 1;
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
    const desiredLength = 220;
    const springStrength = 0.0011;
    const stretch = distance - desiredLength;
    const force = stretch * springStrength;

    source.vx += (dx / distance) * force;
    source.vy += (dy / distance) * force;
    target.vx -= (dx / distance) * force;
    target.vy -= (dy / distance) * force;
  }
}

function applyRepulsion() {
  const charge = 15000;

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distanceSq = Math.max(900, dx * dx + dy * dy);
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
    node.vx += (cx - node.x) * 0.00025;
    node.vy += (cy - node.y) * 0.00025;
  }
}

function integrateAndConstrain() {
  const margin = 38;
  const maxSpeed = 0.6;

  for (const node of nodes) {
    node.vx *= 0.94;
    node.vy *= 0.94;

    const speed = Math.hypot(node.vx, node.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      node.vx *= scale;
      node.vy *= scale;
    }

    node.x += node.vx;
    node.y += node.vy;

    if (node.x < node.radius + margin || node.x > width - node.radius - margin) node.vx *= -0.68;
    if (node.y < node.radius + margin || node.y > height - node.radius - margin) node.vy *= -0.68;

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
      const minDistance = a.radius + b.radius + 12;

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
  camera.x += (camera.targetX - camera.x) * 0.075;
  camera.y += (camera.targetY - camera.y) * 0.075;
  camera.scale += (camera.targetScale - camera.scale) * 0.075;
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
    ctx.lineWidth = isActive ? 1.85 : 1.1;
    ctx.strokeStyle = isActive ? "rgba(163, 240, 232, 0.9)" : "rgba(171, 204, 255, 0.26)";
    ctx.stroke();
  }
}

function renderNodes() {
  for (const node of nodes) {
    const selected = node.id === selectedModuleId;
    const hovered = hoverNode && hoverNode.id === node.id;

    const ringRadius = selected ? node.radius + 10 : node.radius + 6;

    ctx.beginPath();
    ctx.arc(node.x, node.y, ringRadius, 0, Math.PI * 2);
    ctx.lineWidth = selected ? 2.6 : 1.35;
    ctx.strokeStyle = selected ? "rgba(170, 247, 239, 0.95)" : "rgba(168, 204, 255, 0.8)";
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius * 0.34, 0, Math.PI * 2);
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

function onCommentSubmit(event) {
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
