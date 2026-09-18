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

let selectedModuleId = modules[0].id;
let hoverNode = null;
let width = 0;
let height = 0;

const STORAGE_KEY = "smart-city-module-comments-v1";
const commentsByModule = loadComments();
const nodes = initializeNodes(modules);

initialize();
animate();

function initialize() {
  setupCanvasSize();
  window.addEventListener("resize", setupCanvasSize);

  createModuleButtons();
  setSelectedModule(selectedModuleId);
  wireEvents();
}

function initializeNodes(moduleData) {
  return moduleData.map((module, index) => {
    const angle = (index / moduleData.length) * Math.PI * 2;
    return {
      ...module,
      x: 0,
      y: 0,
      vx: Math.cos(angle) * 0.4,
      vy: Math.sin(angle) * 0.4,
      radius: 24
    };
  });
}

function setupCanvasSize() {
  const parent = canvas.parentElement;
  width = canvas.width = parent.clientWidth;
  height = canvas.height = parent.clientHeight;

  if (!nodes.some((node) => node.seeded)) {
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * Math.PI * 2;
      node.x = width / 2 + Math.cos(angle) * Math.min(width, height) * 0.3;
      node.y = height / 2 + Math.sin(angle) * Math.min(width, height) * 0.28;
      node.seeded = true;
    });
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
      centerNode(node);
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
}

function onCanvasMove(event) {
  const rect = canvas.getBoundingClientRect();
  const mouseX = event.clientX - rect.left;
  const mouseY = event.clientY - rect.top;

  hoverNode = nodes.find((node) => {
    const dx = mouseX - node.x;
    const dy = mouseY - node.y;
    return Math.hypot(dx, dy) <= node.radius + 7;
  }) || null;

  canvas.style.cursor = hoverNode ? "pointer" : "default";
}

function setSelectedModule(moduleId) {
  selectedModuleId = moduleId;
  const module = modules.find((entry) => entry.id === moduleId);
  if (!module) return;

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
}

function centerNode(node) {
  const targetX = width / 2;
  const targetY = height / 2;
  node.vx += (targetX - node.x) * 0.002;
  node.vy += (targetY - node.y) * 0.002;
}

function stepPhysics() {
  links.forEach(([sourceId, targetId]) => {
    const source = nodes.find((node) => node.id === sourceId);
    const target = nodes.find((node) => node.id === targetId);
    if (!source || !target) return;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy) || 1;
    const desired = 160;
    const pull = (distance - desired) * 0.00075;

    source.vx += dx * pull;
    source.vy += dy * pull;
    target.vx -= dx * pull;
    target.vy -= dy * pull;
  });

  nodes.forEach((node) => {
    node.vx += (Math.random() - 0.5) * 0.02;
    node.vy += (Math.random() - 0.5) * 0.02;

    node.vx *= 0.985;
    node.vy *= 0.985;

    node.x += node.vx;
    node.y += node.vy;

    if (node.x < node.radius + 24 || node.x > width - node.radius - 24) node.vx *= -1;
    if (node.y < node.radius + 24 || node.y > height - node.radius - 24) node.vy *= -1;

    node.x = clamp(node.x, node.radius + 24, width - node.radius - 24);
    node.y = clamp(node.y, node.radius + 24, height - node.radius - 24);
  });
}

function render() {
  ctx.clearRect(0, 0, width, height);

  links.forEach(([sourceId, targetId]) => {
    const source = nodes.find((node) => node.id === sourceId);
    const target = nodes.find((node) => node.id === targetId);
    if (!source || !target) return;

    const isActive = source.id === selectedModuleId || target.id === selectedModuleId;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);
    ctx.lineWidth = isActive ? 2.4 : 1.5;
    ctx.strokeStyle = isActive ? "rgba(244, 169, 0, 0.72)" : "rgba(142, 185, 235, 0.35)";
    ctx.stroke();
  });

  nodes.forEach((node) => {
    const selected = node.id === selectedModuleId;
    const hovered = hoverNode && hoverNode.id === node.id;

    if (selected || hovered) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius + 13, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "rgba(244, 169, 0, 0.22)" : "rgba(0, 166, 147, 0.22)";
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
    ctx.fillStyle = selected ? "#f4a900" : "#00a693";
    ctx.strokeStyle = "#f7fbff";
    ctx.lineWidth = hovered ? 2.8 : 2.1;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = selected ? "700 13px Space Grotesk" : "600 12px Space Grotesk";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(node.label, node.x, node.y);

    if (hovered) {
      ctx.fillStyle = "#f8c95b";
      ctx.font = "500 11px Space Grotesk";
      ctx.fillText(node.category, node.x, node.y + node.radius + 14);
    }
  });
}

function animate() {
  stepPhysics();
  render();
  requestAnimationFrame(animate);
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

  comments.forEach((comment) => {
    const item = document.createElement("li");
    item.className = "comment-item";

    const time = new Date(comment.createdAt).toLocaleString();
    item.innerHTML = `
      <p><strong>${escapeHtml(comment.type)}</strong>: ${escapeHtml(comment.note)}</p>
      <p class="comment-meta">By ${escapeHtml(comment.name)} on ${escapeHtml(time)}</p>
    `;

    commentList.appendChild(item);
  });
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
