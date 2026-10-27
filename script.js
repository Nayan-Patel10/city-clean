// EcoCity frontend logic + REST API integration.
// The page and API are served from the same Express server, so relative URLs work on hosting too.

const API = "/api";
const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
const reportForm = document.getElementById("reportForm");
const formMessage = document.getElementById("formMessage");
const pointSearch = document.getElementById("pointSearch");
const pointsGrid = document.getElementById("pointsGrid");
const noPoints = document.getElementById("noPoints");
const topBtn = document.getElementById("topBtn");

const quizItems = [
  { emoji: "🥤", name: "Plastic Bottle", hint: "Where should an empty plastic bottle go?", answer: "dry", explanation: "Clean plastic bottles are commonly placed in dry/recyclable waste. Follow local rules." },
  { emoji: "🍌", name: "Banana Peel", hint: "Where should a banana peel go?", answer: "wet", explanation: "Food scraps are generally wet/organic waste." },
  { emoji: "🔋", name: "Used Battery", hint: "Where should a used battery go?", answer: "hazardous", explanation: "Batteries need a designated collection point; don't mix them with ordinary waste." },
  { emoji: "🧻", name: "Used Tissue", hint: "Where should a used tissue go?", answer: "residual", explanation: "Used tissues are often residual waste; local rules can vary." },
  { emoji: "📦", name: "Cardboard Box", hint: "Where should clean cardboard go?", answer: "dry", explanation: "Clean cardboard is usually recyclable dry waste." }
];
let quizIndex = 0;
let quizAnswered = false;

function showQuizItem() {
  const item = quizItems[quizIndex];
  document.getElementById("itemEmoji").textContent = item.emoji;
  document.getElementById("itemName").textContent = item.name;
  document.getElementById("itemHint").textContent = item.hint;
  document.getElementById("quizResult").textContent = "";
  document.getElementById("quizResult").className = "quiz-result";
  document.getElementById("nextItem").classList.add("hidden");
  quizAnswered = false;
  document.querySelectorAll(".category-btn").forEach(button => {
    button.disabled = false;
    button.style.opacity = "1";
  });
}

document.querySelectorAll(".category-btn").forEach(button => {
  button.addEventListener("click", () => {
    if (quizAnswered) return;
    quizAnswered = true;
    const item = quizItems[quizIndex];
    const result = document.getElementById("quizResult");
    const correct = button.dataset.answer === item.answer;
    result.textContent = `${correct ? "Correct! " : "Not quite. "}${item.explanation}`;
    result.classList.add(correct ? "good" : "bad");
    document.querySelectorAll(".category-btn").forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = "0.65";
    });
    document.getElementById("nextItem").classList.remove("hidden");
  });
});

document.getElementById("nextItem").addEventListener("click", () => {
  quizIndex = (quizIndex + 1) % quizItems.length;
  showQuizItem();
});

async function loadServerStatus() {
  try {
    const response = await fetch(`${API}/status`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Server unavailable");
    // Add a small status message without changing the design significantly.
    let status = document.getElementById("backendStatus");
    if (!status) {
      status = document.createElement("p");
      status.id = "backendStatus";
      status.style.cssText = "text-align:center;padding:8px;background:#f0fdf4;color:#14532d;font-size:.85rem";
      document.querySelector("footer").prepend(status);
    }
    status.textContent = "✓ Connected to EcoCity backend";
  } catch (error) {
    console.error("Backend status error:", error);
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[character]));
}

async function loadCollectionPoints(search = "") {
  try {
    const url = search
      ? `${API}/collection-points?search=${encodeURIComponent(search)}`
      : `${API}/collection-points`;
    const response = await fetch(url);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load collection points");

    pointsGrid.innerHTML = result.data.map(point => `
      <article class="point-card" data-search="${escapeHTML(point.search)}">
        <span class="point-icon">${escapeHTML(point.icon)}</span>
        <h3>${escapeHTML(point.name)}</h3>
        <p>${escapeHTML(point.wasteTypes)}</p>
        <small>🕘 ${escapeHTML(point.hours)}</small>
        <button class="text-btn" type="button" data-point="${escapeHTML(point.name)}">View details →</button>
      </article>
    `).join("");

    noPoints.classList.toggle("hidden", result.data.length !== 0);
  } catch (error) {
    pointsGrid.innerHTML = '<p class="empty">Collection points could not be loaded. Please try again.</p>';
    noPoints.classList.add("hidden");
    console.error(error);
  }
}

pointsGrid.addEventListener("click", event => {
  const button = event.target.closest("[data-point]");
  if (!button) return;
  alert(`${button.dataset.point}\n\nThis is sample educational data. Verify the address and opening hours with your local authority before visiting.`);
});

let searchTimer;
pointSearch.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => loadCollectionPoints(pointSearch.value.trim()), 200);
});

reportForm.addEventListener("submit", async event => {
  event.preventDefault();
  formMessage.textContent = "Submitting report…";
  formMessage.style.color = "#64748b";

  const formData = new FormData(reportForm);
  // Existing inputs do not use name attributes, so map them explicitly.
  formData.set("name", document.getElementById("name").value.trim());
  formData.set("email", document.getElementById("email").value.trim());
  formData.set("location", document.getElementById("location").value.trim());
  formData.set("wasteType", document.getElementById("wasteType").value);
  formData.set("description", document.getElementById("description").value.trim());

  try {
    const response = await fetch(`${API}/reports`, { method: "POST", body: formData });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not submit report");

    formMessage.style.color = "#16a34a";
    formMessage.textContent = `✓ ${result.message} Your demo report ID is #${result.data.id}.`;
    reportForm.reset();
    await loadStats();
  } catch (error) {
    formMessage.style.color = "#ef4444";
    formMessage.textContent = `Error: ${error.message}`;
  }
});

async function loadStats() {
  try {
    const response = await fetch(`${API}/stats`);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Could not load stats");

    const values = [
      result.data.demoReports,
      result.data.issuesResolved,
      result.data.recyclingActions,
      result.data.awarenessGoalPercent
    ];
    document.querySelectorAll(".counter").forEach((counter, index) => {
      counter.textContent = Number(values[index]).toLocaleString();
    });
  } catch (error) {
    console.error("Stats error:", error);
  }
}

if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => navLinks.classList.toggle("open"));
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => navLinks.classList.remove("open"));
  });
}

window.addEventListener("scroll", () => {
  if (topBtn) topBtn.classList.toggle("show", window.scrollY > 450);
});
if (topBtn) topBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

showQuizItem();
loadServerStatus();
loadCollectionPoints();
loadStats();
