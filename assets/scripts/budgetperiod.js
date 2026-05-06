let currentFilter = "all";
let selectedId = null;

/* INIT */
document.addEventListener("DOMContentLoaded", load);

/* STORAGE */
function getData() {
  return JSON.parse(localStorage.getItem("bp")) || [];
}

function saveData(data) {
  localStorage.setItem("bp", JSON.stringify(data));
}

/* LOAD */
function load() {
  render();
}

/* RENDER */
function render() {
  let data = getData();

  if (currentFilter !== "all") {
    data = data.filter(d => d.status === currentFilter);
  }

  document.getElementById("periodHeader").innerText =
    currentFilter === "all"
      ? "All Periods"
      : currentFilter === "active"
        ? "Active Periods"
        : "Closed Periods";

  let container = document.getElementById("budgetList");
  container.innerHTML = "";

  data.forEach(d => {

    let div = document.createElement("div");
    div.className = "budget-card " + d.status;

    // 🔥 Dynamic spent (real source of truth)
    let spent = typeof calculateSpentForPeriod === "function"
      ? calculateSpentForPeriod(d.start, d.end)
      : 0;

    div.innerHTML = `
      <div class="budget-header" onclick="toggle(this)">
        <span>
          ${format(d.start)} → ${d.status === "active" ? "Running" : format(d.end)}
        </span>
        <span>▼</span>
      </div>

      <div class="budget-body">

        <p>Spent: ${formatCurrency(spent)}</p>

        <div class="card-actions">

          <button class="view-btn" onclick="openDetails('${d.id}')">
            View
          </button>

          ${d.status === "active" ? `
            <button class="danger-btn" onclick="closeBudget('${d.id}')">
              Close
            </button>
          ` : ""}

        </div>

      </div>
    `;

    container.appendChild(div);
  });
}

/* TOGGLE */
function toggle(el) {
  el.parentElement.classList.toggle("open");
}

/* FILTER */
function filterBudgets(type) {
  currentFilter = type;
  render();
}

/* MODALS */
function openBudgetForm() {
  document.getElementById("budgetModal").classList.add("show");
}

function closeBudgetForm() {
  document.getElementById("budgetModal").classList.remove("show");
}

/* SAVE */
function saveBudget() {

  let start = document.getElementById("bpStartDate").value;
  let end = document.getElementById("bpEndDate").value;
  let status = document.getElementById("bpStatus").value;
  let extraDays = parseInt(document.getElementById("bpExtraDays").value || 0);

  // 🔥 FIX HERE
  extraDays = Math.max(0, extraDays);

  if (!start) {
    alert("Select start date");
    return;
  }

  if (status === "closed" && !end) {
    alert("End date required for closed budget");
    return;
  }

  let data = getData();

  data.push({
    id: Date.now(),
    start: start,
    end: end || null,   // 🔥 always defined (stable)
    status: status,
    extraDays: extraDays
  });

  saveData(data);

  closeBudgetForm();
  render();
}

/* DETAILS */
function openDetails(id) {

  let data = getData();
  let d = data.find(x => x.id == id);

  if (!d) return;

  selectedId = id;

  // 🔥 Budget from main system
  let budgetObj = typeof getBudgetForPeriod === "function"
    ? getBudgetForPeriod(d.start, d.end)
    : null;

  let budgetAmount = budgetObj
    ? (budgetObj.totalAllocated || 0)
    : 0;

  // 🔥 Dynamic spent
  let spent = typeof calculateSpentForPeriod === "function"
    ? calculateSpentForPeriod(d.start, d.end)
    : 0;

  document.getElementById("detailsTitle").innerText =
    format(d.start) + " → " + (d.status === "active" ? "Running" : format(d.end));

  document.getElementById("detailsContent").innerHTML = `
    <p><strong>Budget:</strong> ${formatCurrency(budgetAmount)}</p>
    <p><strong>Spent:</strong> ${formatCurrency(spent)}</p>
    <p><strong>Status:</strong> ${d.status}</p>
    <p><strong>Extra Days:</strong> ${d.extraDays || 0}</p>
  `;

  document.getElementById("detailsModal").classList.add("show");
}

function closeDetails() {
  document.getElementById("detailsModal").classList.remove("show");
}

/* TOGGLE STATUS */
function toggleStatus() {
  let data = getData();
  let d = data.find(x => x.id == selectedId);

  if (!d) return;

  if (d.status === "active") {
    d.status = "closed";
    d.end = new Date().toISOString().split("T")[0];
  } else {
    d.status = "active";
    d.end = null; // 🔥 keep structure consistent
  }

  saveData(data);
  closeDetails();
  render();
}

/* HELPERS */
function format(date) {
  return new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// function calculateEndDate() {

//   let start = document.getElementById("bpStartDate").value;
//   let duration = parseInt(document.getElementById("bpDuration").value || 30);

//   if (!start) return;

//   let d = new Date(start);

//   // 🔥 Fix: avoid +1 day bug
//   d.setDate(d.getDate() + duration - 1);

//   document.getElementById("bpEndDate").value =
//     d.toISOString().split("T")[0];
// }

function calculateEndDate() {

  let start = document.getElementById("bpStartDate").value;
  let duration = parseInt(document.getElementById("bpDuration").value || 30);

  if (!start) return;

  let d = new Date(start);

  // ✅ base calculation
  d.setDate(d.getDate() + duration - 1);

  // 🔥 NEW: adjust to Monday if weekend
  d = adjustToNextMonday(d);

  document.getElementById("bpEndDate").value =
    d.toISOString().split("T")[0];
}
function goToHome() {
  window.location.href = "../index.html"; // adjust path if needed
}

function goToSavings() {
  window.location.href = "savings.html"; // adjust path
}
function deleteBudget() {

  let data = getData();

  data = data.filter(d => d.id != selectedId);

  saveData(data);

  closeDetails();
  render();
}
function closeBudget(id) {
  let data = getData();
  let d = data.find(x => x.id == id);

  if (!d) return;

  d.status = "closed";
  d.end = new Date().toISOString().split("T")[0];

  saveData(data);
  render();
}

function adjustToNextMonday(date) {
  let d = new Date(date);
  let day = d.getDay(); // 0=Sun, 6=Sat

  if (day === 6) {
    // Saturday → Monday
    d.setDate(d.getDate() + 2);
  }
  else if (day === 0) {
    // Sunday → Monday
    d.setDate(d.getDate() + 1);
  }

  return d;
}