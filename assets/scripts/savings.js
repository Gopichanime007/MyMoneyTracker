/*
====================================================================================================
SAVINGS MODULE
MASTER BUSINESS LOGIC + ANDROID MIGRATION DOCUMENTATION
====================================================================================================

MODULE PURPOSE
----------------------------------------------------------------------------------------------------
The Savings Module acts as:
1. Savings Ledger System
2. Source-based Financial Allocation Engine
3. Budget Allocation Engine
4. Settlement & Recovery Tracker
5. Financial Analytics System

This module is NOT a simple savings screen.

It behaves like:
----------------------------------------------------------------------------------------------------
Mini Accounting Ledger System

====================================================================================================
HIGH LEVEL ARCHITECTURE
====================================================================================================

Savings Module
│
├── Income Management
│
├── Transfer Management
│
├── Settlement Management
│
├── Budget Allocation Management
│
├── Savings History
│
├── Source Tracking
│
├── Graph Analytics
│
├── Category Management
│
├── Person Management
│
└── PDF Export System

====================================================================================================
CORE FINANCIAL CONCEPT
====================================================================================================

The Savings Module uses:
----------------------------------------------------------------------------------------------------
SOURCE-BASED LEDGER ARCHITECTURE

Meaning:
----------------------------------------------------------------------------------------------------
Every expense allocation originates from a source.

Example:
----------------------------------------------------------------------------------------------------

Salary
   ↓
Savings Source
   ↓
Transfer / Budget / Settlement
   ↓
Tracking + Remaining Balance

This architecture enables:
----------------------------------------------------------------------------------------------------
✔ Source tracking
✔ Remaining calculations
✔ Budget linking
✔ Settlement tracking
✔ Audit history
✔ Financial analytics

====================================================================================================
CORE DATA FLOW
====================================================================================================

Income Entry
│
├── Creates Source
│
├── Source becomes available
│
└── Other transactions consume source

----------------------------------------------------------------------------------------------------

Transfer Entry
│
├── Reduces Source Balance
│
├── Assigns Person
│
└── Tracks Pending Settlement

----------------------------------------------------------------------------------------------------

Settlement Entry
│
├── Linked to Transfer
│
├── Recovers Amount
│
└── Updates Pending Balance

----------------------------------------------------------------------------------------------------

Budget Allocation
│
├── Converts Savings → Budget
│
├── Creates Budget Allocation
│
└── Updates Budget Records

====================================================================================================
APPLICATION FLOW
====================================================================================================

Page Load
│
├── Load Savings
├── Load Sources
├── Load Categories
├── Load Persons
├── Load Budget Years
├── Apply Theme
└── Render History

====================================================================================================
STORAGE ARCHITECTURE
====================================================================================================

Primary Storage:
----------------------------------------------------------------------------------------------------
localStorage

Storage Keys:
----------------------------------------------------------------------------------------------------

savingsTransactions
→ Main savings ledger

budgets
→ Budget allocation records

categories
→ Savings categories

persons
→ Person registry

theme
→ Dynamic theme system

====================================================================================================
ANDROID STORAGE MIGRATION
====================================================================================================

HTML / JS
----------------------------------------------------------------------------------------------------
localStorage

Android Equivalent:
----------------------------------------------------------------------------------------------------
Room Database
+
SharedPreferences

----------------------------------------------------------------------------------------------------
savingsTransactions
→ SavingsRepository

budgets
→ BudgetRepository

theme
→ SettingsManager

====================================================================================================
ENTRY FACTORY ARCHITECTURE
====================================================================================================

createSavingsEntry()

Purpose:
----------------------------------------------------------------------------------------------------
Creates standardized ledger entries.

Responsibilities:
----------------------------------------------------------------------------------------------------
✔ Generates ID
✔ Applies timestamps
✔ Applies monthKey
✔ Applies periodKey
✔ Standardizes structure

IMPORTANT:
----------------------------------------------------------------------------------------------------
ALL transactions MUST pass through this factory.

Android Equivalent:
----------------------------------------------------------------------------------------------------
SavingsEntryFactory
or
SavingsManager.createEntry()

====================================================================================================
TRANSACTION TYPES
====================================================================================================

Supported Types:
----------------------------------------------------------------------------------------------------

income
→ Adds savings source

transfer
→ Deducts money from source

settlement
→ Recovers pending transfer amount

budget_allocation
→ Allocates savings into budget

====================================================================================================
ANDROID DOMAIN MODEL
====================================================================================================

SavingsEntity
│
├── id
├── type
├── amount
├── sourceId
├── entity
├── paymentType
├── person
├── note
├── date
├── monthKey
├── periodKey
├── createdAt
└── updatedAt

====================================================================================================
SOURCE ARCHITECTURE
====================================================================================================

Income entries act as:
----------------------------------------------------------------------------------------------------
Financial Sources

Meaning:
----------------------------------------------------------------------------------------------------
Income itself becomes a reusable financial container.

Example:
----------------------------------------------------------------------------------------------------

Salary ₹50,000
│
├── Budget Allocation ₹20,000
├── Transfer ₹5,000
├── Settlement Recovery ₹1,000
│
└── Remaining ₹26,000

====================================================================================================
BUDGET PERIOD ARCHITECTURE
====================================================================================================

Savings module integrates with:
----------------------------------------------------------------------------------------------------
Budget Period Module

Through:
----------------------------------------------------------------------------------------------------
periodKey

Purpose:
----------------------------------------------------------------------------------------------------
Allows:
✔ period-based savings
✔ period-based budgets
✔ scoped analytics
✔ scoped calculations

IMPORTANT:
----------------------------------------------------------------------------------------------------
Budget Period acts as:
MASTER FINANCIAL CONTEXT

====================================================================================================
SCOPED DATA ARCHITECTURE
====================================================================================================

getScopedSavings()

Purpose:
----------------------------------------------------------------------------------------------------
Returns ONLY savings related to:
- active budget period
OR
- current month fallback

This prevents:
----------------------------------------------------------------------------------------------------
cross-period data pollution

Android Equivalent:
----------------------------------------------------------------------------------------------------
SavingsRepository.getScopedSavings()

====================================================================================================
LOAD SAVINGS ARCHITECTURE
====================================================================================================

loadSavings()

Purpose:
----------------------------------------------------------------------------------------------------
Main dashboard calculation engine.

Responsibilities:
----------------------------------------------------------------------------------------------------
✔ Total savings calculation
✔ Allocated amount calculation
✔ Available balance calculation
✔ Daily budget calculation
✔ History rendering

IMPORTANT:
----------------------------------------------------------------------------------------------------
This function acts as:
SAVINGS DASHBOARD CONTROLLER

Android Equivalent:
----------------------------------------------------------------------------------------------------
SavingsDashboardManager

====================================================================================================
HISTORY ARCHITECTURE
====================================================================================================

renderSavingsHistory()

Purpose:
----------------------------------------------------------------------------------------------------
Renders transaction history.

Displays:
----------------------------------------------------------------------------------------------------
✔ Type
✔ Amount
✔ Date
✔ Source
✔ Payment
✔ Person
✔ Notes

Android Equivalent:
----------------------------------------------------------------------------------------------------
RecyclerView Adapter

Recommended:
----------------------------------------------------------------------------------------------------
SavingsHistoryAdapter

====================================================================================================
FILTER ARCHITECTURE
====================================================================================================

handleSavingsFilter()

Supported Filters:
----------------------------------------------------------------------------------------------------
today
week
month
period
all

Purpose:
----------------------------------------------------------------------------------------------------
Scoped historical analysis.

Android Equivalent:
----------------------------------------------------------------------------------------------------
FilterManager
or
SavingsFilterManager

====================================================================================================
ANALYTICS ARCHITECTURE
====================================================================================================

loadSavingsGraph()

Purpose:
----------------------------------------------------------------------------------------------------
Creates:
Income vs Expense analytics

Library:
----------------------------------------------------------------------------------------------------
Chart.js

Android Equivalent:
----------------------------------------------------------------------------------------------------
MPAndroidChart

Android Fragment:
----------------------------------------------------------------------------------------------------
SavingsAnalyticsFragment

====================================================================================================
SOURCE DETAILS ARCHITECTURE
====================================================================================================

renderSourceDetails()

Purpose:
----------------------------------------------------------------------------------------------------
Displays:
FULL source financial breakdown

Includes:
----------------------------------------------------------------------------------------------------
✔ Total
✔ Used
✔ Credited
✔ Remaining
✔ Related transactions

This acts like:
----------------------------------------------------------------------------------------------------
Mini ledger statement screen

Android Equivalent:
----------------------------------------------------------------------------------------------------
SavingsDetailsFragment

====================================================================================================
CATEGORY ARCHITECTURE
====================================================================================================

Categories represent:
----------------------------------------------------------------------------------------------------
Savings ownership or grouping.

Examples:
----------------------------------------------------------------------------------------------------
Self
Family
Friend
Company
Charity

Storage:
----------------------------------------------------------------------------------------------------
localStorage.categories

Android Equivalent:
----------------------------------------------------------------------------------------------------
CategoryRepository

====================================================================================================
PERSON ARCHITECTURE
====================================================================================================

Persons represent:
----------------------------------------------------------------------------------------------------
Transfer-related people.

Used for:
----------------------------------------------------------------------------------------------------
✔ Borrowing
✔ Lending
✔ Settlements
✔ Transfer tracking

Android Equivalent:
----------------------------------------------------------------------------------------------------
PersonRepository

====================================================================================================
MODAL ARCHITECTURE
====================================================================================================

HTML MODAL
----------------------------------------------------------------------------------------------------
categoryModal
personModal
backupModal
importModal
splitModal

Android Equivalent:
----------------------------------------------------------------------------------------------------
DialogFragment

----------------------------------------------------------------------------------------------------
HTML MODAL → ANDROID DIALOG MAPPING
----------------------------------------------------------------------------------------------------

categoryModal
→ CategoryDialogFragment

personModal
→ PersonDialogFragment

backupModal
→ BackupDialogFragment

importModal
→ ImportDialogFragment

splitModal
→ SplitAllocationDialogFragment

====================================================================================================
PDF EXPORT ARCHITECTURE
====================================================================================================

exportSavingsPDF()

Purpose:
----------------------------------------------------------------------------------------------------
Generates financial reports.

Contains:
----------------------------------------------------------------------------------------------------
✔ Header
✔ Transactions
✔ Summary
✔ Net balance

Android Equivalent:
----------------------------------------------------------------------------------------------------
PdfExportManager

Suggested Android Libraries:
----------------------------------------------------------------------------------------------------
iTextPDF
or
Android PdfDocument

====================================================================================================
THEME ARCHITECTURE
====================================================================================================

Theme Source:
----------------------------------------------------------------------------------------------------
localStorage.theme

Applied Using:
----------------------------------------------------------------------------------------------------
CSS Variable:
--theme

Android Equivalent:
----------------------------------------------------------------------------------------------------
ThemeManager

IMPORTANT:
----------------------------------------------------------------------------------------------------
NO HARDCODED COLORS

Android must support:
----------------------------------------------------------------------------------------------------
✔ Dynamic accent colors
✔ HEX colors
✔ Runtime updates
✔ Theme persistence

====================================================================================================
NAVIGATION ARCHITECTURE
====================================================================================================

showSavingsScreen()

Purpose:
----------------------------------------------------------------------------------------------------
Internal screen router.

Controls:
----------------------------------------------------------------------------------------------------
✔ Dashboard
✔ Graph
✔ Income Details
✔ History

Android Equivalent:
----------------------------------------------------------------------------------------------------
NavController
or
Fragment navigation

IMPORTANT:
----------------------------------------------------------------------------------------------------
Each HTML screen should become:
ONE Fragment

====================================================================================================
ANDROID MIGRATION ARCHITECTURE
====================================================================================================

Recommended Android Feature Structure:
----------------------------------------------------------------------------------------------------

features/
└── savings/
     ├── adapters/
     ├── data/
     ├── domain/
     ├── models/
     └── ui/

====================================================================================================
ANDROID CLASS MAPPING
====================================================================================================

HTML / JS
----------------------------------------------------------------------------------------------------
loadSavings()
→ SavingsDashboardManager

addSavings()
→ SavingsManager

createSavingsEntry()
→ SavingsEntryFactory

renderSavingsHistory()
→ SavingsHistoryAdapter

loadSavingsGraph()
→ SavingsAnalyticsManager

renderSourceDetails()
→ SavingsDetailsManager

====================================================================================================
ANDROID FRAGMENT MAPPING
====================================================================================================

Savings Dashboard
→ SavingsDashboardFragment

Savings History
→ SavingsHistoryFragment

Savings Analytics
→ SavingsAnalyticsFragment

Savings Details
→ SavingsDetailsFragment

====================================================================================================
IMPORTANT ENGINEERING RULES
====================================================================================================

1.
DO NOT place financial calculations inside UI.

2.
Fragments should ONLY render data.

3.
Business logic belongs inside:
- Managers
- Domain layer
- Repositories

4.
RecyclerView replaces:
dynamic HTML list rendering.

5.
DialogFragment replaces:
HTML modals.

6.
Room Database should replace:
localStorage.

7.
ThemeManager should replace:
CSS variables.

8.
Every transaction MUST contain:
periodKey OR monthKey

9.
Savings must remain isolated from:
Expense internal logic.

10.
Budget Period acts as:
Global financial scope controller.

====================================================================================================
FUTURE SCALING CAPABILITIES
====================================================================================================

This architecture already supports:
----------------------------------------------------------------------------------------------------
✔ Multi-period accounting
✔ Source accounting
✔ Ledger tracking
✔ Settlement workflows
✔ Budget allocations
✔ Analytics
✔ PDF exports
✔ Dynamic theming
✔ Multi-user tracking

Meaning:
----------------------------------------------------------------------------------------------------
The architecture is scalable enough for:
- production Android app
- finance SaaS
- advanced accounting workflows

====================================================================================================
AUTHOR NOTES
====================================================================================================

Architecture Designed By:
----------------------------------------------------------------------------------------------------
Gopichanime 🐉

Purpose:
----------------------------------------------------------------------------------------------------
To maintain synchronized:
✔ HTML architecture
✔ Android architecture
✔ Business workflows
✔ Financial logic

====================================================================================================
END OF SAVINGS MODULE DOCUMENTATION
====================================================================================================
*/
// Savings Module Start savings.js
document.addEventListener("DOMContentLoaded", () => {
    try {
        console.log("DOM ready ✅");
    } catch (e) {
        console.error("Init error:", e);
    }
});

// 🔥 FIX MODAL CLOSE (SAFE CLICK ONLY ON BACKDROP)

document.getElementById("categoryModal").addEventListener("click", function (e) {
    if (e.target === this) {
        closeCategoryModal();
    }
});

document.getElementById("personModal").addEventListener("click", function (e) {
    if (e.target === this) {
        closePersonModal();
    }
});

// =========================
// 🚀 INIT
// =========================
// Initializes page: loads data, sets date, loads sources, applies theme
window.addEventListener("load", function () {
    loadSavings();
    setTodayDate();
    loadSourceOptions();
    handleSavingsTypeChange();
    loadBudgetYears();
    loadCategoryOptions();
    loadPersonOptions();
    renderCategoryList();
    renderPersonList();
    loadSettlementOptions();
    setTimeout(() => {
        loadSavings();
    }, 50);

    renderSavingsHistory(getSavings());

    let theme = localStorage.getItem("theme") || "#4caf50";
    document.documentElement.style.setProperty("--theme", theme);
});

/* =========================
   🧠 MASTER LEDGER (SAVINGS)
========================= */
//Show Toast
let activeToast = null;

// Shows a single temporary toast message (replaces previous one to avoid spam)
function showToast(message, type = "info") {
    if (activeToast) activeToast.remove();

    let toast = document.createElement("div");
    toast.className = "simple-toast";
    toast.innerText = message;

    const colors = {
        success: "#4caf50",
        error: "#e53935",
        warning: "#fb8c00",
        info: "#333"
    };

    toast.style.background = colors[type] || "#333";

    document.body.appendChild(toast);
    activeToast = toast;

    setTimeout(() => {
        toast.remove();
        activeToast = null;
    }, 1500);
}
// =========================
// 📦 STORAGE
// =========================

// Fetch all savings transactions from localStorage
function getSavings() {
    return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}
// Save updated savings transactions into localStorage
function saveSavings(data) {
    localStorage.setItem("savingsTransactions", JSON.stringify(data));
}

// =========================
// 🏗️ ENTRY FACTORY
// =========================
// Creates a standardized savings entry object (used for all transaction types)
function createSavingsEntry({
    type,
    amount,
    sourceId = null,
    entity = "Cash",
    payment = null,
    person = null,
    note = "",
    date = new Date().toISOString()
}) {

    let periodKey = getActivePeriodKey(); // safe call

    return {
        id: Date.now(),

        type,
        amount,

        sourceId,
        entity,

        paymentType: payment,
        person,

        note,
        date,

        monthKey: date.slice(0, 7),      // fallback
        periodKey: periodKey || null,    // new system

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachmentId: obj.attachmentId || null
    };
}

// =========================
// ➕ ADD ENTRY
// =========================
// Handles adding income, transfer, or budget allocation into savings ledger
async function addSavings() {

    // =========================
    // 📥 INPUTS
    // =========================
    const type = document.getElementById("sType").value;
    const amount = Number(document.getElementById("sAmount").value);
    const note = document.getElementById("sNote").value;
    const dateInput = document.getElementById("sDate").value;
    const entity = document.getElementById("sEntity").value;
    const payment = document.getElementById("sPayment").value;
    const sourceSelect = document.getElementById("sourceSelect");
    const personSelect = document.getElementById("sPerson");

    if (!amount || amount <= 0) {
        showToast("Enter valid amount ❗", "warning");
        return;
    }

    // =========================
    // 📅 DATE HANDLING (FIXED)
    // =========================
    let date;

    if (!dateInput) {

        // current exact datetime
        date = new Date().toISOString();

    } else {

        let todayStr = new Date().toISOString().split("T")[0];

        // today's transaction → keep current time
        if (dateInput === todayStr) {

            date = new Date().toISOString();

        } else {

            // preserve exact selected date
            date = `${dateInput}T12:00:00`;
        }
    }

    let data = getSavings();

    // centralize attachment storage for this save flow
    const sAttachmentId = await (window.storeAttachmentFromInput ? storeAttachmentFromInput('sAttachment') : (async ()=>{
        const fileInput = document.getElementById('sAttachment');
        const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if(!file) return null;
        const store = window.reMoAttachments && window.reMoAttachments.storeImage ? window.reMoAttachments.storeImage : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.storeImage);
        if(!store) return null;
        try{ const res = await store(null,file); return res && res.id ? res.id : null; }catch(e){console.warn('Attachment save failed',e); return null; }
    })());
    // =========================
    // 💰 INCOME
    // =========================
    if (type === "income") {

        const entry = createSavingsEntry({
            type: "income",
            amount: Math.abs(amount),
            entity,
            payment,
            note,
            date
        });
        if(sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }

    // =========================
    // 🔁 TRANSFER
    // =========================
    else if (type === "transfer") {

        const sourceId = String(sourceSelect?.value || "");
        const person = personSelect?.value || null;

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        const entry = createSavingsEntry({
            type: "transfer",
            amount: -Math.abs(amount),
            sourceId,
            person,
            entity,
            payment,
            note,
            date
        });
        if(sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }
    // =========================
    // 💸 SETTLEMENT / RETURN
    // =========================
    else if (type === "settlement") {

        const settlementSelect =
            document.getElementById("settlementSelect");

        const transferId =
            String(settlementSelect?.value || "");

        if (!transferId) {

            showToast(
                "Select pending transfer ❗",
                "warning"
            );

            return;
        }

        // 🔥 find original transfer
        let originalTransfer = data.find(
            t => String(t.id) === transferId
        );

        if (!originalTransfer) {

            showToast(
                "Original transfer not found ❗",
                "error"
            );

            return;
        }
        // 🔥 prevent over settlement
        let alreadySettled = data
            .filter(s =>
                s.type === "settlement" &&
                String(s.linkedTransactionId) === String(originalTransfer.id)
            )
            .reduce((sum, s) => sum + Math.abs(s.amount), 0);

        let pending =
            Math.abs(originalTransfer.amount) - alreadySettled;

        if (amount > pending) {

            showToast(
                `Only ₹${pending} pending ❗`,
                "warning"
            );

            return;
        }

        const entry = createSavingsEntry({

            type: "settlement",

            amount: Math.abs(amount),

            sourceId: originalTransfer.sourceId,

            person: originalTransfer.person,

            entity,
            payment,
            note,

            date
        });

        // 🔥 link settlement
        entry.linkedTransactionId = originalTransfer.id;

        await attachFileToEntry(entry);
        data.push(entry);
    }
    // =========================
    // 📦 BUDGET ALLOCATION
    // =========================
    else if (type === "withdraw_budget") {

        const sourceId = String(sourceSelect?.value || "");

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        const periodKey =
            typeof getActivePeriodKey === "function"
                ? getActivePeriodKey()
                : null;

        const fallbackMonth = date.slice(0, 7);

        const budgetId = `budget_${periodKey || fallbackMonth}_${sourceId}`;

        const entry = createSavingsEntry({
            type: "budget_allocation",
            amount: -Math.abs(amount),
            sourceId,
            entity,
            payment,
            note,
            date,
            person: "Self"
        });

        await attachFileToEntry(entry);
        data.push(entry);

        createOrUpdateBudget(budgetId, entry);
    }

    // =========================
    // 💾 SAVE + UI
    // =========================
    console.log("Final Date:", date);

    saveSavings(data);
    loadSavings();
    loadSourceOptions();

    showToast("Saved successfully ✅", "success");

    resetSavingsForm();
}

// =========================
// 📦 BUDGET CREATION (FROM SAVINGS)
// =========================
// Creates or updates monthly budget based on savings allocation
function createOrUpdateBudget(budgetId, entry) {

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

    // 🔥 Get active period
    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    // ⚠️ Safety: if no active period → fallback to month
    let fallbackMonth = entry.monthKey || (entry.date ? entry.date.slice(0, 7) : null);

    // 🔥 Find existing budget (PERIOD-FIRST MATCH)
    // Match by generated budgetId OR legacyId OR by sourceId+period+entity (best-effort)
    let existing = budgets.find(b => {
        const samePeriod = periodKey ? b.periodKey === periodKey : b.monthKey === fallbackMonth;

        if ((b.budgetId && b.budgetId === budgetId) || (b.legacyId && b.legacyId === budgetId)) return b.entity === entry.entity && samePeriod;

        // fallback: match by source + period + entity
        if (b.sourceId === entry.sourceId && b.entity === entry.entity && samePeriod) return true;

        return false;
    });

    if (existing) {

        // ✅ Update allocation
        existing.totalAllocated += Math.abs(entry.amount);
        existing.updatedAt = new Date().toISOString();

        // ✅ Ensure keys exist
        if (!existing.periodKey && periodKey) {
            existing.periodKey = periodKey;
        }

        if (!existing.monthKey && fallbackMonth) {
            existing.monthKey = fallbackMonth;
        }

    } else {

            // 🔥 Create new budget (PERIOD FIRST)
            // Ensure globally-unique budgetId while keeping legacy traceability
            const uid = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

            const generatedBudgetId = `budget_${periodKey || fallbackMonth}_${entry.sourceId || 'manual'}_${uid}`;

            budgets.push({
                id: Date.now(),
                type: "budget",

                // store generated unique id
                budgetId: generatedBudgetId,

                // preserve original id for migration/traceability if provided
                legacyId: budgetId || null,

                sourceId: entry.sourceId,

                totalAllocated: Math.abs(entry.amount),

                entity: entry.entity,

                note: entry.note || "",
                date: entry.date || new Date().toISOString(),

                // 🔥 CORE CHANGE
                periodKey: periodKey || null,
                monthKey: periodKey ? null : fallbackMonth, // fallback only

                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
    }

    localStorage.setItem("budgets", JSON.stringify(budgets));
}
// =========================
// 🗓️ FORMAT HELPERS
// =========================
function formatMonth(monthKey) {
    if (!monthKey) return "No Date";

    let [year, month] = monthKey.split("-");
    let date = new Date(year, month - 1);

    return date.toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}

// =========================
// 📊 LOAD UI
// =========================
// =========================
// 📊 LOAD UI
// =========================

// Calculates totals and updates savings dashboard UI
function loadSavings() {

    let data = getSavings() || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);
    let daily = getDailyBudget();

    let dailyEl = document.getElementById("dailyBudget");
    if (dailyEl) dailyEl.innerText = "₹ " + daily.toFixed(2);
    // 🔥 MERGED FILTER (period + fallback)
    // let filtered = data.filter(t => {
    //     if (periodKey) {
    //         return (
    //             t.periodKey === periodKey ||
    //             (!t.periodKey && t.monthKey === currentMonth)
    //         );
    //     }
    //     return t.monthKey === currentMonth;
    // });
    let filtered = [...data];
    // 🔥 CALCULATIONS
    let total = filtered.reduce((sum, t) => sum + t.amount, 0);

    let allocated = filtered
        .filter(t => t.type === "budget_allocation")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    let available = total;

    // 🔥 UI UPDATE
    document.getElementById("savingsBalance").innerText = 'Rs. ' + total;

    let allocatedEl = document.getElementById("allocatedToBudget");
    if (allocatedEl) allocatedEl.innerText = 'Rs. ' + allocated;

    let availableEl = document.getElementById("availableBalance");
    if (availableEl) availableEl.innerText = 'Rs. ' + available;

    // 🔥 HISTORY
    renderSavingsHistory(filtered);
}

// =========================
// 📜 HISTORY
// =========================
// Renders all savings transactions into UI list (latest first)
// function renderSavingsHistory(data) {
//     let container = document.getElementById("savingsHistory");
//     if (!container) return;

//     container.innerHTML = "";

//     data.slice().reverse().forEach(t => {
//         let div = document.createElement("div");
//         div.className = "expense-item";

//         let labelMap = {
//             income: "💰 Income",
//             transfer: "🔁 Transfer",
//             budget_allocation: "📦 Budget"
//         };

//         let label = labelMap[t.type] || t.type;
//         let color = t.amount < 0 ? "red" : "green";

//         div.innerHTML = `
//       <div>
//         <strong>${t.note || t.person || "Entry"}</strong><br>
//         <small>${label} • ${new Date(t.date).toLocaleString()}</small>
//       </div>
//       <div style="color:${color}; font-weight:600;">
//         ₹${Math.abs(t.amount)}
//       </div>
//     `;

//         container.appendChild(div);
//     });
// }
function renderSavingsHistory(data) {
    let container = document.getElementById("savingsHistory");
    if (!container) return;

    container.innerHTML = "";

    data.slice().reverse().forEach((t, index) => {

        // let realIndex = data.length - 1 - index; // 🔥 FIX INDEX

        let div = document.createElement("div");
        div.className = "expense-item";

        let labelMap = {
            income: "💰 Income",
            transfer: "🔁 Transfer",
            budget_allocation: "📦 Budget",
            settlement: "💸 Settlement"
        };

        let label = labelMap[t.type] || t.type;
        let color = t.amount < 0 ? "red" : "green";

        div.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <div class="expense-thumb" data-attachment-id="${t.attachmentId||''}">
        ${t.attachmentId?'<img class="remo-attachment-thumb" src="" alt="attachment" />':''}
      </div>
      <div>
        <strong>${t.note || t.person || "Entry"}</strong><br>
        <small>
            ${label} • ${t.sourceName || t.note || t.entity || "-"} • ${t.paymentType || t.payment || "-"} • 
            ${new Date(t.date).toLocaleString()}
        </small>
      </div>
    </div>

    <div style="display:flex; align-items:center; gap:10px;">
        <span style="color:${color}; font-weight:600;">₹${Math.abs(t.amount)}</span>
        <button class="delete-btn" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑</button>
    </div>
`;

        if (t.attachmentId) {
            const thumbEl = div.querySelector('.remo-attachment-thumb');
            if(thumbEl){
                const loader = window.reMoAttachments && window.reMoAttachments.getThumbnailUrl ? window.reMoAttachments.getThumbnailUrl : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.getThumbnailUrl);
                if(loader){ loader(t.attachmentId).then(src=>{ if(src) thumbEl.src = src; }).catch(()=>{}); }
                else {
                    const prev = window.reMoAttachments && window.reMoAttachments.getPreview ? window.reMoAttachments.getPreview(t.attachmentId) : null;
                    if(prev) thumbEl.src = prev;
                }
                thumbEl.addEventListener('click', async (e)=>{ e.stopPropagation(); const loaderFull = window.reMoAttachments && window.reMoAttachments.getImageUrl ? window.reMoAttachments.getImageUrl : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.getImageUrl); if(loaderFull){ const src = await loaderFull(t.attachmentId); if(src) openAttachmentViewer(src); } });
            }
        }

        // 🔥 attach event
        let btn = div.querySelector(".delete-btn");

        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            deleteSavings(t.id);
        });

        container.appendChild(div);
    });
}
// =========================
// 🔗 SOURCES
// =========================
// Returns all income entries (used as available sources)
function getAvailableSources() {
    let data = getSavings() || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    return data.filter(t => {
        if (periodKey) return t.type === "income" && t.periodKey === periodKey;
        return t.type === "income" && t.monthKey === currentMonth;
    });
}
// Loads income sources into dropdown with remaining balance
// function loadSourceOptions() {
//     let select = document.getElementById("sourceSelect");
//     if (!select) return;

//     let data = getSavings();
//     let sources = data.filter(t => t.type === "income");

//     select.innerHTML = "";

//     if (!sources.length) {
//         let option = document.createElement("option");
//         option.value = "";
//         option.textContent = "No sources available";
//         select.appendChild(option);
//         return;
//     }

//     select.innerHTML = "<option value=''>Select Source</option>";

//     sources.forEach(s => {
//         let used = data
//             .filter(t => String(t.sourceId) === String(s.id))
//             .reduce((sum, t) => sum + Math.abs(t.amount), 0);

//         let remaining = s.amount - used;

//         if (remaining <= 0) return;

//         let option = document.createElement("option");
//         option.value = s.id;
//         option.textContent = `${s.note || "Income"} (₹${remaining} left)`;

//         select.appendChild(option);
//     });
// }
function loadSourceOptions({
    showAll = true,
    includeUsed = true
} = {}) {

    let select = document.getElementById("sourceSelect");
    if (!select) return;

    let data = getSavings() || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    // 🔥 FILTER BASE
    // let scoped = data.filter(t => {
    //     if (periodKey) return t.periodKey === periodKey;
    //     return t.monthKey === currentMonth;
    // });
    let scoped = [...data];
    let sources = scoped.filter(t => t.type === "income");

    select.innerHTML = "<option value=''>Select Source</option>";

    if (!sources.length) {
        let option = document.createElement("option");
        option.textContent = "No sources available";
        select.appendChild(option);
        return;
    }

    sources.forEach(s => {

        let used = scoped
            .filter(t => String(t.sourceId) === String(s.id) && t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        let remaining = s.amount - used;

        if (!includeUsed && remaining <= 0) return;

        let option = document.createElement("option");
        option.value = s.id;

        let status = remaining <= 0
            ? "Used"
            : `₹${remaining} left`;

        option.textContent = `${s.note || "Income"} — ${status}`;

        select.appendChild(option);
    });
}
// =========================
// 🔄 RESET FORM
// =========================
function resetSavingsForm() {
    document.getElementById("sAmount").value = "";
    document.getElementById("sNote").value = "";
    document.getElementById("sourceSelect").value = "";
    document.getElementById("sType").value = "income";

    setTodayDate();
}

// =========================
// 📅 DEFAULT DATE
// =========================
// Sets today's date as default in date input field
function setTodayDate() {
    let today = new Date().toISOString().split("T")[0];
    let dateInput = document.getElementById("sDate");

    if (dateInput) {
        dateInput.value = today;
    }
}



//Filter
let filteredSavingsData = [];
// Filters savings data by time (today, week, month, all) and updates UI
function handleSavingsFilter(type) {

    let data = getSavings() || [];

    // =========================
    // 🧠 ACTIVE PERIOD CONTEXT
    // =========================
    let period = typeof getActiveBudgetPeriod === "function"
        ? getActiveBudgetPeriod()
        : null;

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();

    // =========================
    // 🧱 BASE DATA (PERIOD FIRST)
    // =========================
    let baseData;

    // 🔥 TRUE ALL DATA
    if (type === "all") {

        baseData = [...data];

    } else {

        // normal scoped filtering
        baseData = data.filter(t => {

            if (periodKey) {
                return t.periodKey === periodKey;
            }

            let currentMonth = now.toISOString().slice(0, 7);

            return t.monthKey === currentMonth;
        });
    }

    // =========================
    // 🧠 SAFE DATE PARSER
    // =========================
    function getSafeDate(d) {
        let parsed = new Date(d);
        return isNaN(parsed) ? null : parsed;
    }

    // =========================
    // 🔥 CUSTOM PERIOD (MODAL)
    // =========================
    if (type === "period") {
        let modal = document.getElementById("savingsDateModal");
        if (modal) modal.style.display = "flex";
        return; // ⛔ STOP execution
    }

    // =========================
    // 🎯 FILTER LOGIC
    // =========================

    let result = [];

    // 🔥 TODAY
    if (type === "today") {

        let start = new Date();
        start.setHours(0, 0, 0, 0);

        let end = new Date();
        end.setHours(23, 59, 59, 999);

        result = baseData.filter(t => {
            let d = getSafeDate(t.date);
            return d && d >= start && d <= end;
        });
    }

    // 🔥 WEEK (LAST 7 DAYS)
    else if (type === "week") {

        let start = new Date(now);
        start.setDate(now.getDate() - 6);
        start.setHours(0, 0, 0, 0);

        let end = new Date(now);
        end.setHours(23, 59, 59, 999);

        // 🧠 CLAMP TO PERIOD
        if (period) {
            let pStart = getSafeDate(period.start);
            let pEnd = getSafeDate(period.end) || new Date();

            if (pStart && start < pStart) start = pStart;
            if (pEnd && end > pEnd) end = pEnd;
        }

        result = baseData.filter(t => {
            let d = getSafeDate(t.date);
            return d && d >= start && d <= end;
        });
    }

    // 🔥 MONTH / FULL PERIOD
    else if (type === "month") {
        result = [...baseData];
    }

    // 🔥 ALL
    else {
        result = [...baseData];
    }

    // =========================
    // 📊 STORE + UPDATE UI
    // =========================
    filteredSavingsData = result;

    renderSavingsHistory(result);
    loadSavingsGraph(result);
}
// Generates income vs expense chart using filtered or full data
function loadSavingsGraph(data) {

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    let d = data;

    if (!d) {
        let all = getSavings() || [];

        d = all.filter(t => {
            if (periodKey) return t.periodKey === periodKey;
            return t.monthKey === currentMonth;
        });
    }

    let income = 0;
    let expense = 0;

    d.forEach(t => {
        if (t.amount > 0) income += t.amount;
        else expense += Math.abs(t.amount);
    });

    let ctx = document.getElementById("savingsChart");
    if (!ctx) return;

    if (window.sChart) window.sChart.destroy();

    window.sChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Income", "Expense"],
            datasets: [{
                data: [income, expense],
                backgroundColor: ["#4caf50", "#ff5252"]
            }]
        }
    });
}

// Switches between different UI screens (home, graph, income, details)
function showSavingsScreen(id) {
    console.log("Switching to:", id);

    // 🔹 Reset all screens
    document.querySelectorAll(".screen").forEach(s =>
        s.classList.remove("active")
    );

    const screen = document.getElementById(id);
    if (!screen) {
        console.error("Screen NOT found:", id);
        return;
    }

    screen.classList.add("active");
    window.scrollTo(0, 0);

    // 🔹 Clear only details content
    if (id === "details") {
        const container = document.getElementById("sourceDetails");
        if (container) container.innerHTML = "";
    }

    // 🔹 Nav highlight (kept from first version)
    document.querySelectorAll(".nav button").forEach(btn =>
        btn.classList.remove("active")
    );

    const activeBtn = document.querySelector(`.nav button[data-screen="${id}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    // 🔹 Controlled rendering
    switch (id) {

        case "income":
            renderIncomeList();
            break;

        case "graph":
            // 🔥 use scoped data (fixed)
            loadSavingsGraph(
                filteredSavingsData.length
                    ? filteredSavingsData
                    : getScopedSavings()
            );
            break;
    }
}

// Calculates total used and remaining amount for a selected income source
function getSourceSummary(sourceId) {
    let data = getSavings();

    let income = data.find(t => String(t.id) === String(sourceId));
    if (!income) return null;

    let outgoing = data.filter(t => String(t.sourceId) === String(income.id));

    let totalOutgoing = outgoing.reduce(
        (sum, t) => t.amount < 0 ? sum + Math.abs(t.amount) : sum,
        0
    );

    return {
        name: income.note || "Income",
        totalIncome: income.amount,
        totalOutgoing,
        remaining: income.amount - totalOutgoing,
        entries: outgoing
    };
}

// Displays detailed breakdown of a selected income source
function renderSourceDetails(sourceId) {

    // 🔥 SINGLE SOURCE OF TRUTH
    let scoped = getSavings() || [];

    let incomeId = String(sourceId);

    // 🎯 FIND INCOME
    let income = scoped.find(t => String(t.id) === incomeId);

    let container = document.getElementById("sourceDetails");
    if (!container) return;

    // ❌ NOT FOUND
    if (!income) {
        container.innerHTML = `
            <div style="padding:16px;">
                <p style="color:#888;">No data found for this source ❌</p>
            </div>
        `;
        return;
    }

    // 🔗 RELATED TRANSACTIONS
    let related = scoped.filter(t => String(t.sourceId) === incomeId);

    // 🧮 CALCULATIONS
    let used = related
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    let credited = related
        .filter(t => t.amount > 0)
        .reduce((sum, t) => sum + t.amount, 0);

    let remaining = income.amount - used + credited;

    // 📜 BUILD ENTRIES
    let entriesHTML = "";

    if (!related.length) {
        entriesHTML = `<p style="color:#888;">No transactions yet</p>`;
    } else {
        related.slice().reverse().forEach(t => {

            let color = t.amount < 0 ? "#ff5252" : "#4caf50";

            let labelMap = {
                transfer: "🔁 Transfer",
                budget_allocation: "📦 Budget",
                income: "💰 Income",
                settlement: "💸 Settlement"
            };

            let label = labelMap[t.type] || t.type;

            entriesHTML += `
                <div style="
                    display:flex;
                    justify-content:space-between;
                    padding:8px 0;
                    border-bottom:1px solid #eee;
                ">
                    <div>
                        <strong>${t.note || t.person || "Entry"}</strong><br>
                        <small style="color:#777;">
                            ${label} • ${new Date(t.date).toLocaleString()}
                        </small>
                    </div>

                    <div style="color:${color}; font-weight:600;">
                        ₹${Math.abs(t.amount)}
                    </div>
                </div>
            `;
        });
    }

    // 📦 FINAL UI
    container.innerHTML = `

    <h3 style="margin-bottom:8px;">
        ${income.note || "Income"}
    </h3>

    <div class="summary">

        <div class="box">
            <small>Total</small>
            <div>${formatCurrency(income.amount)}</div>
        </div>

        <div class="box">
            <small>Used</small>
            <div class="red">${formatCurrency(used)}</div>
        </div>

    </div>

    <div class="summary">

        <div class="box success">
            <small>Credited</small>
            <div>${formatCurrency(credited)}</div>
        </div>

        <div class="box success">
            <small>Remaining</small>
            <div>${formatCurrency(remaining)}</div>
        </div>

    </div>

    <hr style="margin:12px 0;">

    <h4>Transactions</h4>
    ${entriesHTML}
`;
}

// Renders all income entries and allows navigation to detailed view
function renderIncomeList() {

    let data = getSavings() || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    // 🔥 GLOBAL SOURCES
    let scoped = [...data];

    // all income sources from all periods
    let sources = scoped.filter(t => t.type === "income");

    let container = document.getElementById("incomeList");
    if (!container) return;

    container.innerHTML = "";

    if (!sources.length) {
        container.innerHTML = `<p style="color:#888;">No income sources yet</p>`;
        return;
    }

    sources.slice().reverse().forEach(i => {

        let used = scoped
            .filter(t => String(t.sourceId) === String(i.id) && t.amount < 0)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        let remaining = i.amount - used;

        let div = document.createElement("div");
        div.className = "income-card";

        let date = new Date(i.date);

        let monthYear = date.toLocaleString("en-IN", {
            month: "short",
            year: "numeric"
        });

        let name = i.note || `${monthYear} Income`;

        let statusText = remaining <= 0
            ? "❌ All used"
            : `₹${remaining} left`;

        let statusClass = remaining <= 0 ? "red" : "green";

        div.innerHTML = `
            <div class="income-left">
                <strong>${name}</strong>
                <small>${monthYear}</small>
            </div>

            <div class="income-right">
                <span class="amount">₹${i.amount}</span>
                <span class="remaining ${statusClass}">
                    ${statusText}
                </span>
            </div>
        `;

        // 🔥 CLEAN CLICK FLOW (NO RACE CONDITION)
        div.addEventListener("click", () => {
            let id = String(i.id);

            showSavingsScreen("details");

            requestAnimationFrame(() => {
                renderSourceDetails(id);
            });
        });

        container.appendChild(div);
    });
}
// Closes the savings date filter modal
function closeSavingsModal() {
    let modal = document.getElementById("savingsDateModal");
    if (modal) modal.style.display = "none";
}

// Controls UI fields based on selected type (income / transfer / budget)
function handleSavingsTypeChange() {

    let type = document.getElementById("sType").value;

    let source = document.getElementById("sourceWrapper");
    let budget = document.getElementById("budgetConfig");
    let personField = document.getElementById("personWrapper");
    let settlement = document.getElementById("settlementWrapper");

    // reset
    source.style.display = "none";
    budget.style.display = "none";
    personField.style.display = "none";
    settlement.style.display = "none";

    // 🔁 TRANSFER
    if (type === "transfer") {

        source.style.display = "block";
        personField.style.display = "block";
    }

    // 📦 BUDGET
    else if (type === "withdraw_budget") {

        source.style.display = "block";
    }

    // 💸 SETTLEMENT
    else if (type === "settlement") {

        settlement.style.display = "block";

        loadSettlementOptions();
    }
}

function loadBudgetYears() {
    let yearSelect = document.getElementById("budgetYear");
    if (!yearSelect) return;

    let currentYear = new Date().getFullYear();

    for (let i = currentYear - 2; i <= currentYear + 5; i++) {
        let opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        yearSelect.appendChild(opt);
    }

    yearSelect.value = currentYear;
}

function applySavingsDateFilter() {
    let from = document.getElementById("sFromDate").value;
    let to = document.getElementById("sToDate").value;

    let data = getSavings() || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    // 🔥 BASE FILTER
    let base = data.filter(t => {
        if (periodKey) return t.periodKey === periodKey;
        return t.monthKey === currentMonth;
    });

    filteredSavingsData = base.filter(t => {
        let d = new Date(t.date).toISOString().slice(0, 10);

        if (from && !to) return d === from;
        if (!from && to) return d <= to;
        if (from && to) return d >= from && d <= to;

        return true;
    });

    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);

    closeSavingsModal();
}

function goToDashboard() {
    window.location.href = "../index.html";
}
// Navigate to transfers page (future)
function goToTransfers() {
    showToast("Transfers coming soon 🔁");
}

// =========================
// 📄 EXPORT SAVINGS PDF
// =========================
// Generates a structured savings report with header, table, and totals
// function exportSavingsPDF() {
//     const { jsPDF } = window.jspdf;
//     const doc = new jsPDF();

//     let data = getSavings();

//     if (!data.length) {
//         showToast("No data to export", "warning");
//         return;
//     }

//     let y = 20;

//     // =========================
//     // 🟢 HEADER
//     // =========================
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(16);
//     doc.text("Savings Report", 14, 15);

//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(9);
//     doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 20);

//     y = 30;

//     // =========================
//     // 🟡 TABLE HEADER
//     // =========================
//     doc.setFont("helvetica", "bold");
//     doc.setFontSize(10);

//     let purpose = t.note || "-";
//     let person = t.person || "-";

//     doc.text(date, 14, y);
//     doc.text(type, 40, y);
//     doc.text(purpose, 65, y);
//     doc.text(entity, 105, y);
//     doc.text(t.payment || "-", 135, y);
//     doc.text("Rs. " + Math.abs(amount).toLocaleString("en-IN"), 165, y);

//     y += 6;

//     doc.setDrawColor(200);
//     doc.line(14, y, 195, y);

//     y += 6;

//     // =========================
//     // 🔵 DATA ROWS
//     // =========================
//     doc.setFont("helvetica", "normal");
//     doc.setFontSize(9);

//     let totalIncome = 0;
//     let totalExpense = 0;

//     data.forEach((t) => {

//         let date = new Date(t.date).toLocaleDateString("en-IN");
//         let type = t.type || "-";
//         let entity = t.entity || "-";
//         let amount = t.amount || 0;

//         // Totals
//         if (amount > 0) totalIncome += amount;
//         else totalExpense += Math.abs(amount);

//         // Page break
//         if (y > 280) {
//             doc.addPage();
//             y = 20;
//         }

//         // Color (green for +, red for -)
//         if (amount < 0) {
//             doc.setTextColor(200, 0, 0);
//         } else {
//             doc.setTextColor(0, 150, 0);
//         }

//         doc.text(date, 14, y);
//         doc.text(type, 50, y);
//         doc.text(entity, 80, y);
//         doc.text(t.payment || "-", 110, y);
//         doc.text("Rs. " + Math.abs(amount).toLocaleString("en-IN"), 140, y);

//         doc.setTextColor(0);

//         y += 7;
//     });

//     // =========================
//     // 🟣 SUMMARY
//     // =========================
//     y += 10;

//     doc.setDrawColor(180);
//     doc.line(14, y, 195, y);

//     y += 8;

//     doc.setFont("helvetica", "bold");

//     doc.setTextColor(0, 150, 0);
//     doc.text(`Total Income: ₹${totalIncome}`, 14, y);

//     y += 7;

//     doc.setTextColor(200, 0, 0);
//     doc.text(`Total Outgoing: ₹${totalExpense}`, 14, y);

//     y += 7;

//     doc.setTextColor(0);
//     doc.text(`Net Balance: ₹${totalIncome - totalExpense}`, 14, y);

//     // =========================
//     // 💾 SAVE
//     // =========================
//     doc.save("savings-report.pdf");

//     showToast("Savings report downloaded 📄", "success");
// }
function exportSavingsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let data = getSavings();

    if (!data.length) {
        showToast("No data to export", "warning");
        return;
    }

    let y = 20;

    // =========================
    // 🟢 HEADER
    // =========================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Savings Report", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 20);

    y = 30;

    // =========================
    // 🟡 TABLE HEADER
    // =========================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text("Date", 14, y);
    doc.text("Type", 35, y);
    doc.text("Purpose", 65, y);
    doc.text("Entity", 105, y);
    doc.text("Payment", 135, y);
    doc.text("Amount", 165, y);

    y += 6;

    doc.setDrawColor(200);
    doc.line(14, y, 195, y);

    y += 6;

    // =========================
    // 🔵 DATA ROWS
    // =========================
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let totalIncome = 0;
    let totalExpense = 0;

    data.forEach((t) => {

        let date = new Date(t.date).toLocaleDateString("en-IN");
        let type = t.type || "-";
        let entity = t.entity || "-";
        let purpose = t.note || "-";
        let amount = t.amount || 0;

        // Totals
        if (amount > 0) totalIncome += amount;
        else totalExpense += Math.abs(amount);

        // Page break
        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        // Color
        if (amount < 0) {
            doc.setTextColor(200, 0, 0);
        } else {
            doc.setTextColor(0, 150, 0);
        }

        doc.text(date, 14, y);
        doc.text(type, 35, y);
        doc.text(purpose.substring(0, 15), 65, y);
        doc.text((t.sourceName || t.note || t.entity || "-"), 105, y);
        doc.text((t.paymentType || t.payment || "-"), 135, y);
        doc.text("Rs. " + Math.abs(amount).toLocaleString("en-IN"), 165, y);

        doc.setTextColor(0);

        y += 7;
    });

    // =========================
    // 🟣 SUMMARY
    // =========================
    y += 10;

    doc.setDrawColor(180);
    doc.line(14, y, 195, y);

    y += 8;

    doc.setFont("helvetica", "bold");

    doc.setTextColor(0, 150, 0);
    doc.text(`Total Income: Rs. ${totalIncome.toLocaleString("en-IN")}`, 14, y);

    y += 7;

    doc.setTextColor(200, 0, 0);
    doc.text(`Total Outgoing: Rs. ${totalExpense.toLocaleString("en-IN")}`, 14, y);

    y += 7;

    doc.setTextColor(0);
    doc.text(`Net Balance: Rs. ${(totalIncome - totalExpense).toLocaleString("en-IN")}`, 14, y);

    // =========================
    // 💾 SAVE
    // =========================
    doc.save("savings-report.pdf");

    showToast("Savings report downloaded 📄", "success");
}
// Converts HEX color to RGB (used for dynamic theming if needed)
function hexToRgb(hex) {
    hex = hex.replace("#", "");

    let bigint = parseInt(hex, 16);

    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

// =========================
// ❌ DELETE SAVINGS ENTRY
// =========================
// Removes a savings transaction by index
function deleteSavings(id) {

    let data = getSavings();

    let entry = data.find(e => e.id == id);

    if (!entry) return;

    // 🔥 remove by ID (not index)
    data = data.filter(e => e.id != id);

    saveSavings(data);

    // 🔥 adjust budget
    if (entry.type === "budget_allocation") {
        adjustBudgetAfterDelete(entry);
    }

    loadSavings();

    showToast("Deleted successfully 🗑", "success");
}
function adjustBudgetAfterDelete(entry) {

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

    let periodKey = entry.periodKey;
    let fallbackMonth = entry.monthKey;

    let budget = budgets.find(b =>
        b.entity === entry.entity &&
        (
            (periodKey && b.periodKey === periodKey) ||
            (!periodKey && b.monthKey === fallbackMonth)
        )
    );

    if (budget) {
        budget.totalAllocated -= Math.abs(entry.amount);

        if (budget.totalAllocated < 0) {
            budget.totalAllocated = 0;
        }
    }

    localStorage.setItem("budgets", JSON.stringify(budgets));
}


// function handleBudgetPeriodChange() {
//     let input = document.getElementById("budgetDate");
//     if (!input) return;

//     let period = document.getElementById("budgetPeriod").value;

//     input.type = period === "month" ? "month" : "date";

//     if (!input.value) {
//         input.valueAsDate = new Date();
//     }
// }

function generateBudgetId(period, date) {

    let d = new Date(date);

    if (period === "day") {
        return "budget_day_" + d.toLocaleDateString("en-CA");
    }

    if (period === "week") {
        let start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        return "budget_week_" + start.toLocaleDateString("en-CA");
    }

    if (period === "month") {
        let y = d.getFullYear();
        let m = String(d.getMonth() + 1).padStart(2, "0");

        let sourceId = document.getElementById("sourceSelect")?.value || "0";

        // ✅ FINAL STANDARD FORMAT
        return `budget_${y}-${m}_${sourceId}`;
    }

    return null;
}

function getCategories() {
    return JSON.parse(localStorage.getItem("categories")) ||
        ["Self", "Family", "Friend", "Company", "Charity", "Other"];
}

function saveCategories(list) {
    localStorage.setItem("categories", JSON.stringify(list));
}

function getPersons() {
    return JSON.parse(localStorage.getItem("persons")) || [];
}

function savePersons(list) {
    localStorage.setItem("persons", JSON.stringify(list));
}
function loadCategoryOptions() {
    let select = document.getElementById("sEntity");
    if (!select) return;

    let categories = getCategories();

    select.innerHTML = "";

    categories.forEach(c => {
        let opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}


function loadPersonOptions() {
    let select = document.getElementById("sPerson");
    if (!select) return;

    let persons = getPersons();

    select.innerHTML = "<option value=''>Select Person</option>";

    persons.forEach(p => {
        let opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });

    // 🔥 ADD NEW OPTION
    let addNew = document.createElement("option");
    addNew.value = "__add_new__";
    addNew.textContent = "➕ Add New Person";
    select.appendChild(addNew);
}

function addCategory() {
    let input = document.getElementById("newCategory");
    let value = input.value.trim();

    if (!value) return;

    let categories = getCategories();

    if (!categories.includes(value)) {
        categories.push(value);
        saveCategories(categories);
        loadCategoryOptions();
    }

    input.value = "";
}

function addPerson() {
    let input = document.getElementById("newPerson");
    let value = input.value.trim();

    if (!value) return;

    let persons = getPersons();

    if (!persons.includes(value)) {
        persons.push(value);
        savePersons(persons);
        loadPersonOptions();
    }

    input.value = "";
    renderPersonList();
}


function deleteCategory(value) {
    let categories = getCategories();

    categories = categories.filter(c => c !== value);

    saveCategories(categories);
    loadCategoryOptions();
    renderCategoryList(); // refresh UI
}

function deletePerson(value) {
    let persons = getPersons();

    persons = persons.filter(p => p !== value);

    savePersons(persons);
    loadPersonOptions();
    renderPersonList(); // refresh UI
}

function renderCategoryList() {
    let container = document.getElementById("categoryList");
    let categories = getCategories();

    container.innerHTML = "";

    categories.forEach(c => {
        let div = document.createElement("div");
        div.className = "chip";

        div.innerHTML = `
  <span class="chip-text">${c}</span>
  <button onclick="deleteCategory('${c}')">✖</button>
`;

        container.appendChild(div);
    });
}

function renderPersonList() {
    let container = document.getElementById("personList");
    let persons = getPersons();

    container.innerHTML = "";

    persons.forEach(p => {
        let div = document.createElement("div");
        div.className = "chip";

        div.innerHTML = `
            <span>${p}</span>
            <button onclick="deletePerson('${p}')">✖</button>
        `;

        container.appendChild(div);
    });
}
function openCategoryModal() {
    renderCategoryList();   // 🔥 ADD THIS
    document.getElementById("categoryModal").style.display = "flex";
}

function closeCategoryModal() {
    document.getElementById("categoryModal").style.display = "none";
}

function openPersonModal() {
    renderPersonList();   // load latest data
    document.getElementById("personModal").style.display = "flex";
}

function closePersonModal() {
    document.getElementById("personModal").style.display = "none";
}

function openAddPersonModal() {
    document.getElementById("addPersonModal").style.display = "flex";
}

function closeAddPersonModal() {
    document.getElementById("addPersonModal").style.display = "none";
}

function confirmAddPerson() {
    let input = document.getElementById("newPersonInput");
    let name = input.value.trim();

    //if (!name) return;

    let persons = getPersons();

    if (!persons.includes(name)) {
        persons.push(name);
        savePersons(persons);
    }

    loadPersonOptions();

    // auto select newly added person
    document.getElementById("sPerson").value = name;

    input.value = "";
    closeAddPersonModal();
}

window.addEventListener("DOMContentLoaded", function () {
    let personSelect = document.getElementById("sPerson");

    if (!personSelect) return;

    personSelect.addEventListener("change", function () {
        if (this.value === "__add_new__") {

            if (this.value === "__add_new__") {
                openAddPersonModal();
            }

            //if (!name) return;

            let persons = getPersons();

            if (!persons.includes(name)) {
                persons.push(name);
                savePersons(persons);
            }

            loadPersonOptions();
            this.value = name; // auto select
        }
    });
});
// =====================================
// Author: Gopichanime
// Created: 2026
// Description: Money Tracker Core Logic
// =====================================
/*
   ____   ___  ____  ___ ____ _   _    _    _   _ ___ __  __ _____ 
  / ___| / _ \|  _ \|_ _/ ___| | | |  / \  | \ | |_ _|  \/  | ____|
 | |  _ | | | | |_) || | |   | |_| | / _ \ |  \| || || |\/| |  _|  
 | |_| || |_| |  __/ | | |___|  _  |/ ___ \| |\  || || |  | | |___ 
  \____| \___/|_|   |___\____|_| |_/_/   \_\_| \_|___|_|  |_|_____|

   Signed by: GOPICHANIME 🐉
*/
function goToBudgetPeriods() {
    window.location.href = "../pages/budgetperiod.html";
}
// function getScopedSavings() {
//     let data = getSavings() || [];

//     let periodKey = typeof getActivePeriodKey === "function"
//         ? getActivePeriodKey()
//         : null;

//     let now = new Date();
//     let currentMonth = now.toISOString().slice(0, 7);

//     return data.filter(t => {
//         if (periodKey) {
//             return (
//                 t.periodKey === periodKey ||
//                 (!t.periodKey && t.monthKey === currentMonth)
//             );
//         }
//         return t.monthKey === currentMonth;
//     });
// }

function getScopedSavings() {

    let data = getSavings() || [];

    let periodKey =
        typeof getActivePeriodKey === "function"
            ? getActivePeriodKey()
            : null;

    // 🔥 NO ACTIVE PERIOD
    if (!periodKey) {

        let currentMonth =
            new Date().toISOString().slice(0, 7);

        return data.filter(t =>
            t.monthKey === currentMonth
        );
    }

    // 🔥 ACTIVE PERIOD EXISTS
    return data.filter(t =>
        t.periodKey === periodKey
    );
}

function getActiveBudgetPeriodFull() {
    let data = JSON.parse(localStorage.getItem("bp")) || [];
    return data.find(d => d.status === "active") || null;
}

function getEffectiveDays() {

    let period = getActiveBudgetPeriodFull();
    if (!period) return 0;

    let start = new Date(period.start);
    let end = new Date(period.end);

    let diff = end - start;

    let days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;

    let extra = period.extraDays || 0;

    return days + extra;
}

function getDailyBudget() {

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    if (!periodKey) return 0;

    let periodBudgets = budgets.filter(b => b.periodKey === periodKey);

    let total = periodBudgets.reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let days = getEffectiveDays();

    if (!days) return 0;

    return total / days;
}


function loadSettlementOptions() {

    let select = document.getElementById("settlementSelect");

    if (!select) return;

    let data = getSavings() || [];

    select.innerHTML =
        "<option value=''>Select Pending Transfer</option>";

    // 🔥 only transfers
    let transfers = data.filter(t => t.type === "transfer");

    transfers.forEach(t => {

        // total settled against this transfer
        let settled = data
            .filter(s =>
                s.type === "settlement" &&
                String(s.linkedTransactionId) === String(t.id)
            )
            .reduce((sum, s) => sum + Math.abs(s.amount), 0);

        let original = Math.abs(t.amount);

        let pending = original - settled;

        // skip fully settled
        if (pending <= 0) return;

        let option = document.createElement("option");

        option.value = t.id;

        option.textContent =
            `${t.person || "Unknown"} — ${t.note || "Transfer"} — ₹${pending} pending`;

        // 🔥 metadata
        option.dataset.sourceId = t.sourceId;
        option.dataset.person = t.person || "";
        option.dataset.pending = pending;

        select.appendChild(option);
    });
}

// Savings Module End Savings.js