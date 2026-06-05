let currentFilter = "all";
let selectedId = null;

/* INIT */
document.addEventListener("DOMContentLoaded", function() {
  // guard: only initialize when budget page elements are present
  if (!document.getElementById || !document.getElementById("budgetList")) return;
  load();
});

/* STORAGE */
function getData() {
  let data = JSON.parse(localStorage.getItem("bp")) || [];
  let normalized = normalizePeriods(data);

  if (normalized.changed) {
    localStorage.setItem("bp", JSON.stringify(normalized.data));
  }

  return normalized.data;
}

function saveData(data) {
  let normalized = normalizePeriods(data);
  localStorage.setItem("bp", JSON.stringify(normalized.data));
}

function toDateOnly(date) {
  let d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToKey(date) {
  let d = new Date(date);
  return d.toISOString().split("T")[0];
}

function getEffectiveEndDate(period, referenceDate = new Date()) {
  let end = period && period.end ? new Date(period.end) : new Date(referenceDate);
  end = toDateOnly(end);

  let extraDays = Math.max(0, parseInt((period && period.extraDays) || 0, 10) || 0);
  end.setDate(end.getDate() + extraDays);
  return end;
}

function normalizePeriods(data, referenceDate = new Date()) {
  let today = toDateOnly(referenceDate);
  let changed = false;

  let safe = Array.isArray(data) ? data : [];

  let normalized = safe.map(item => {
    let p = item && typeof item === "object" ? { ...item } : item;
    if (!p || typeof p !== "object") return p;

    if (p.status === "active") {
      let effectiveEnd = getEffectiveEndDate(p, today);
      if (effectiveEnd < today) {
        p.status = "closed";
        p.end = dateToKey(effectiveEnd);
        changed = true;
      }
    }

    return p;
  });

  // Keep only one active period: latest start date wins.
  let active = normalized
    .filter(p => p && typeof p === "object" && p.status === "active")
    .sort((a, b) => {
      let as = toDateOnly(a.start || 0).getTime();
      let bs = toDateOnly(b.start || 0).getTime();
      if (as !== bs) return bs - as;
      return String(b.id || "").localeCompare(String(a.id || ""));
    });

  if (active.length > 1) {
    let keepId = active[0].id;
    normalized = normalized.map(p => {
      if (!p || typeof p !== "object") return p;
      if (p.status !== "active" || p.id === keepId) return p;
      changed = true;
      return {
        ...p,
        status: "closed",
        end: p.end || dateToKey(today)
      };
    });
  }

  return { data: normalized, changed };
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
function saveBudgetPeriod() {

  // guard: ensure form elements exist
  if (!document.getElementById || !document.getElementById("bpStartDate")) return;

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

  if (status === "active" && end) {
    let today = toDateOnly(new Date());
    let selectedEnd = toDateOnly(end);

    if (selectedEnd < today) {
      end = dateToKey(today);
    }
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

// Expose page-specific action without colliding with dashboard `saveBudget`.
if (typeof window !== 'undefined') {
  window.saveBudgetPeriod = saveBudgetPeriod;
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
    let today = toDateOnly(new Date());
    let end = d.end ? toDateOnly(d.end) : null;

    d.end = end && end >= today ? dateToKey(end) : null;
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

  if (!document.getElementById || !document.getElementById("bpStartDate")) return;

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

  if (typeof validateBudgetPeriodDeletion === "function") {
    let check = validateBudgetPeriodDeletion(selectedId);
    if (check && check.blocked) {
      alert("Cannot delete budget period. " + check.summary);
      return;
    }
  }

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