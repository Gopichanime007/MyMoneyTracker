/*
====================================================================================================
BUDGET PERIOD ENGINE
MASTER ARCHITECTURE + ANDROID MIGRATION DOCUMENTATION
====================================================================================================

FILE NAME
----------------------------------------------------------------------------------------------------
BudgetPeriod.js

ROLE
----------------------------------------------------------------------------------------------------
This file acts as:
1. Financial Period Controller
2. Accounting Cycle Manager
3. Budget Timeline Engine
4. Period Lifecycle System
5. Active Financial Scope Engine
6. Budget Period UI Controller
7. Financial State Coordinator

IMPORTANT:
----------------------------------------------------------------------------------------------------
This is NOT just a UI file.

This file controls:
----------------------------------------------------------------------------------------------------
THE ENTIRE FINANCIAL TIME SYSTEM

of the application.

====================================================================================================
CORE FINANCIAL PHILOSOPHY
====================================================================================================

The application does NOT operate:
----------------------------------------------------------------------------------------------------
month-by-month only

Instead:
----------------------------------------------------------------------------------------------------
Everything belongs to:
BUDGET PERIODS

A Budget Period represents:
----------------------------------------------------------------------------------------------------
A controlled financial timeline.

Examples:
----------------------------------------------------------------------------------------------------
✔ Salary cycle
✔ Monthly cycle
✔ Weekly budget cycle
✔ Custom financial window
✔ Academic budget period
✔ Travel budget period

====================================================================================================
WHY BUDGET PERIODS EXIST
====================================================================================================

Purpose:
----------------------------------------------------------------------------------------------------
To solve real-world budgeting problems.

Traditional apps:
----------------------------------------------------------------------------------------------------
Only track calendar months.

This system:
----------------------------------------------------------------------------------------------------
Tracks:
✔ Custom date ranges
✔ Running periods
✔ Dynamic financial windows
✔ Flexible accounting cycles

====================================================================================================
CORE PERIOD STATES
====================================================================================================

A Budget Period can be:
----------------------------------------------------------------------------------------------------

1.
ACTIVE

Meaning:
----------------------------------------------------------------------------------------------------
Current financial tracking period.

2.
CLOSED

Meaning:
----------------------------------------------------------------------------------------------------
Historical archived period.

====================================================================================================
IMPORTANT BUSINESS RULE
====================================================================================================

Only:
----------------------------------------------------------------------------------------------------
ONE ACTIVE PERIOD

should exist at a time.

Reason:
----------------------------------------------------------------------------------------------------
All dashboards,
graphs,
budgets,
daily limits,
and analytics

depend on:
----------------------------------------------------------------------------------------------------
CURRENT ACTIVE PERIOD

====================================================================================================
STORAGE ARCHITECTURE
====================================================================================================

Current Storage:
----------------------------------------------------------------------------------------------------
localStorage

Storage Key:
----------------------------------------------------------------------------------------------------
bp

Structure:
----------------------------------------------------------------------------------------------------

[
    {
        id,
        start,
        end,
        status,
        extraDays
    }
]

====================================================================================================
ANDROID STORAGE MIGRATION
====================================================================================================

HTML localStorage
----------------------------------------------------------------------------------------------------
→ Room Database

Recommended Android Entity:
----------------------------------------------------------------------------------------------------
BudgetPeriodEntity.java

====================================================================================================
ANDROID ENTITY ARCHITECTURE
====================================================================================================

BudgetPeriodEntity
----------------------------------------------------------------------------------------------------

id
startDate
endDate
status
extraDays
createdAt
updatedAt
isArchived
isCurrent

====================================================================================================
CORE ENGINE FUNCTIONS
====================================================================================================

getData()
saveData()
render()
saveBudget()
openDetails()
toggleStatus()
closeBudget()

====================================================================================================
FINANCIAL PERIOD FLOW
====================================================================================================

User Creates Period
        ↓
Stored in bp
        ↓
Period becomes ACTIVE
        ↓
Expenses use ACTIVE PERIOD
        ↓
Budgets attach to PERIOD KEY
        ↓
Dashboard filters by ACTIVE PERIOD
        ↓
Analytics filter by ACTIVE PERIOD
        ↓
Daily Limit uses ACTIVE PERIOD
        ↓
Period closes
        ↓
Historical analytics preserved

====================================================================================================
PERIOD KEY ARCHITECTURE
====================================================================================================

This module indirectly powers:
----------------------------------------------------------------------------------------------------
periodKey

Format:
----------------------------------------------------------------------------------------------------

YYYY-MM-DD_to_YYYY-MM-DD

Example:
----------------------------------------------------------------------------------------------------

2026-01-01_to_2026-01-31

Purpose:
----------------------------------------------------------------------------------------------------
Links:
✔ budgets
✔ expenses
✔ analytics
✔ graphs

to:
ONE financial cycle

====================================================================================================
ACTIVE PERIOD ENGINE
====================================================================================================

Core Concept:
----------------------------------------------------------------------------------------------------
The ACTIVE period controls:
----------------------------------------------------------------------------------------------------
✔ Current budget
✔ Current spending
✔ Current analytics
✔ Daily limits
✔ Remaining budget

Without active period:
----------------------------------------------------------------------------------------------------
Application falls back to:
current month logic

====================================================================================================
EXTRA DAYS SYSTEM
====================================================================================================

Purpose:
----------------------------------------------------------------------------------------------------
Allows:
period extension

Example:
----------------------------------------------------------------------------------------------------
Budget ends on:
31 Jan

Extra days:
----------------------------------------------------------------------------------------------------
2

Actual operational end:
----------------------------------------------------------------------------------------------------
2 Feb

Purpose:
----------------------------------------------------------------------------------------------------
Grace period for:
✔ late payments
✔ carry-forward spending
✔ delayed salary cycles

====================================================================================================
DATE ENGINE ARCHITECTURE
====================================================================================================

Core Function:
----------------------------------------------------------------------------------------------------
calculateEndDate()

Purpose:
----------------------------------------------------------------------------------------------------
Automatically calculates:
----------------------------------------------------------------------------------------------------
endDate

using:
----------------------------------------------------------------------------------------------------
startDate + duration

====================================================================================================
WEEKEND ADJUSTMENT ENGINE
====================================================================================================

Core Function:
----------------------------------------------------------------------------------------------------
adjustToNextMonday()

Purpose:
----------------------------------------------------------------------------------------------------
Avoids:
budget periods ending on weekends

Logic:
----------------------------------------------------------------------------------------------------
Saturday
→ Monday

Sunday
→ Monday

====================================================================================================
UI RENDER ENGINE
====================================================================================================

Core Function:
----------------------------------------------------------------------------------------------------
render()

Purpose:
----------------------------------------------------------------------------------------------------
Dynamically builds:
----------------------------------------------------------------------------------------------------
Budget Period cards

Each card displays:
----------------------------------------------------------------------------------------------------
✔ Start date
✔ End date
✔ Status
✔ Spent amount
✔ Action buttons

====================================================================================================
UI STATE ARCHITECTURE
====================================================================================================

Budget Card States:
----------------------------------------------------------------------------------------------------

1.
Collapsed

2.
Expanded

Controlled By:
----------------------------------------------------------------------------------------------------
toggle()

====================================================================================================
FILTER ENGINE
====================================================================================================

Core Function:
----------------------------------------------------------------------------------------------------
filterBudgets()

Supported Filters:
----------------------------------------------------------------------------------------------------
✔ all
✔ active
✔ closed

====================================================================================================
DETAIL VIEW ENGINE
====================================================================================================

Core Function:
----------------------------------------------------------------------------------------------------
openDetails()

Purpose:
----------------------------------------------------------------------------------------------------
Displays:
✔ Budget amount
✔ Total spent
✔ Status
✔ Extra days

====================================================================================================
STATUS ENGINE
====================================================================================================

Core Functions:
----------------------------------------------------------------------------------------------------
toggleStatus()
closeBudget()

Purpose:
----------------------------------------------------------------------------------------------------
Controls:
ACTIVE ↔ CLOSED transitions

====================================================================================================
IMPORTANT FINANCIAL BEHAVIOR
====================================================================================================

When Period Closes:
----------------------------------------------------------------------------------------------------
endDate becomes:
today's date

When Reopened:
----------------------------------------------------------------------------------------------------
endDate becomes:
null

====================================================================================================
SPENDING CALCULATION ENGINE
====================================================================================================

Core Function:
----------------------------------------------------------------------------------------------------
calculateSpentForPeriod()

Purpose:
----------------------------------------------------------------------------------------------------
Calculates:
total expenses

between:
----------------------------------------------------------------------------------------------------
startDate → endDate

====================================================================================================
BUDGET LINKING ARCHITECTURE
====================================================================================================

Budget Periods connect to:
----------------------------------------------------------------------------------------------------
Budget Engine

via:
----------------------------------------------------------------------------------------------------
periodKey

This enables:
----------------------------------------------------------------------------------------------------
✔ isolated analytics
✔ historical tracking
✔ multi-period budgeting

====================================================================================================
NAVIGATION ARCHITECTURE
====================================================================================================

Current HTML Navigation:
----------------------------------------------------------------------------------------------------
goToHome()
goToSavings()

Uses:
----------------------------------------------------------------------------------------------------
window.location.href

====================================================================================================
ANDROID NAVIGATION MIGRATION
====================================================================================================

HTML Navigation
----------------------------------------------------------------------------------------------------
→ Navigation Component

Recommended Android:
----------------------------------------------------------------------------------------------------
MainActivity
+
NavController
+
Fragments

====================================================================================================
ANDROID FRAGMENT MAPPING
====================================================================================================

BudgetPeriod.js Screen
----------------------------------------------------------------------------------------------------
→ BudgetPeriodFragment

Budget Details Modal
----------------------------------------------------------------------------------------------------
→ BudgetPeriodDetailsFragment

Budget Form Modal
----------------------------------------------------------------------------------------------------
→ BottomSheetDialogFragment

====================================================================================================
MODAL ARCHITECTURE
====================================================================================================

Current HTML:
----------------------------------------------------------------------------------------------------
CSS Modal System

Android Migration:
----------------------------------------------------------------------------------------------------
DialogFragment
or
BottomSheetDialogFragment

====================================================================================================
ANDROID MANAGER MAPPING
====================================================================================================

BudgetPeriod.js Logic
----------------------------------------------------------------------------------------------------
→ BudgetPeriodManager.java

Responsibilities:
----------------------------------------------------------------------------------------------------
✔ Active period management
✔ Status transitions
✔ Date calculations
✔ Period filtering
✔ Spending calculations

====================================================================================================
ANDROID REPOSITORY MAPPING
====================================================================================================

Storage Layer:
----------------------------------------------------------------------------------------------------
BudgetPeriodRepository.java

Responsibilities:
----------------------------------------------------------------------------------------------------
✔ Save periods
✔ Fetch periods
✔ Update status
✔ Delete periods

====================================================================================================
ANDROID ADAPTER MAPPING
====================================================================================================

render()
----------------------------------------------------------------------------------------------------
→ RecyclerView Adapter

Recommended:
----------------------------------------------------------------------------------------------------
BudgetPeriodAdapter.java

====================================================================================================
RECOMMENDED CLEAN ARCHITECTURE
====================================================================================================

UI Layer
----------------------------------------------------------------------------------------------------
BudgetPeriodFragment

Domain Layer
----------------------------------------------------------------------------------------------------
BudgetPeriodManager

Data Layer
----------------------------------------------------------------------------------------------------
BudgetPeriodRepository

Database Layer
----------------------------------------------------------------------------------------------------
Room Database

====================================================================================================
IMPORTANT ENGINEERING RULES
====================================================================================================

1.
Never hardcode:
financial month logic

2.
Always use:
ACTIVE PERIOD

3.
Daily limits must be:
PERIOD-BASED

4.
Analytics must be:
PERIOD AWARE

5.
Budget calculations must:
respect ACTIVE PERIOD

6.
One active period only.

7.
Historical periods should never:
mutate financial history

====================================================================================================
FUTURE SCALABILITY
====================================================================================================

This architecture supports:
----------------------------------------------------------------------------------------------------
✔ Fiscal year budgeting
✔ Weekly budgeting
✔ Payroll cycles
✔ Multi-company periods
✔ Subscription budgeting
✔ AI financial forecasting
✔ Historical financial analytics

====================================================================================================
HTML → ANDROID CONVERSION STRATEGY
====================================================================================================

HTML Component
----------------------------------------------------------------------------------------------------
Modal
→ BottomSheetDialogFragment

Card Rendering
→ RecyclerView

localStorage
→ Room Database

window.location
→ Navigation Component

DOM Manipulation
→ ViewBinding / RecyclerView

====================================================================================================
AUTHOR NOTES
====================================================================================================

Budget Period Architecture Designed By:
----------------------------------------------------------------------------------------------------
Gopichanime 🐉

Purpose:
----------------------------------------------------------------------------------------------------
To create:
enterprise-style financial period management

inside:
personal finance tracking.

====================================================================================================
END OF BUDGET PERIOD ENGINE DOCUMENTATION
====================================================================================================
*/
// Budget Period Module Start BudgetPeriod.js
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
  //let duration = parseInt(document.getElementById("bpDuration").value || 30);

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

  let duplicate = data.some(p => {
    if (!p || typeof p !== "object") return false;
    return String(p.start || "") === String(start || "")
      && String(p.end || "") === String(end || "");
  });

  if (duplicate) {
    alert("This budget period already exists");
    return;
  }

  data.push({
    id: Date.now(),
    start: start,
    end: end || null,   // 🔥 always defined (stable)
    status: status,
    //duration: duration,
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

  let today = toDateOnly(new Date());
  let startDate = toDateOnly(d.start);
  let endDate = getEffectiveEndDate(d, today);

  let remainingDays = 0;
  if (d.status === "active") {
    remainingDays = Math.max(0, Math.ceil((endDate - today) / (1000 * 60 * 60 * 24)) + 1);
  }

  let durationDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  if (!Number.isFinite(durationDays) || durationDays < 1) durationDays = 1;

  document.getElementById("detailsTitle").innerText =
    format(d.start) + " → " + (d.status === "active" ? "Running" : format(d.end));

  document.getElementById("detailsContent").innerHTML = `
    <div class="details-grid">
      <p><strong>Start Date:</strong> ${format(d.start)}</p>
      <p><strong>End Date:</strong> ${format(endDate)}</p>
      <p><strong>Status:</strong> ${d.status}</p>
      <p><strong>Remaining Days:</strong> ${d.status === "active" ? remainingDays : 0}</p>
    </div>
    <p><strong>Budget:</strong> ${formatCurrency(budgetAmount)}</p>
    <p><strong>Spent:</strong> ${formatCurrency(spent)}</p>
<p>
  <strong>Total Duration:</strong>
  ${durationDays}
  Days
</p>
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
    if (typeof reactivateBudgetPeriodLifecycle === "function") {
      let result = reactivateBudgetPeriodLifecycle(selectedId, new Date());

      if (!result || result.ok !== true) {
        alert((result && result.error) || "Reactivation failed");
        return;
      }

      if (typeof showToast === "function") {
        showToast("Budget period reactivated and data links refreshed");
      }

      closeDetails();
      render();
      return;
    }

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
// Budget Period Module End BudgetPeriod.js