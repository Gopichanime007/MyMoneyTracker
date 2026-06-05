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
async function addSavings() {

    if (!document.getElementById || !document.getElementById("sType")) return;

    const rawType = document.getElementById("sType") ? document.getElementById("sType").value : null;
    const type = rawType === "income" ? "deposit" : rawType;
    const amount = document.getElementById("sAmount") ? Number(document.getElementById("sAmount").value) : 0;
    const note = document.getElementById("sNote") ? document.getElementById("sNote").value : "";
    const dateInput = document.getElementById("sDate") ? document.getElementById("sDate").value : "";
    const entity = document.getElementById("sEntity") ? document.getElementById("sEntity").value : "";
    const payment = document.getElementById("sPayment") ? document.getElementById("sPayment").value : null;
    const sourceSelect = document.getElementById("sourceSelect");
    const destinationType = document.getElementById("destinationType")?.value || null;
    const destination = document.getElementById("destinationSelect")?.value || null;

    if (!amount || amount <= 0) {
        showToast("Enter valid amount ❗", "warning");
        return;
    }

    let date;
    if (!dateInput) {
        date = new Date().toISOString();
    } else {
        let todayStr = new Date().toISOString().split("T")[0];
        date = dateInput === todayStr ? new Date().toISOString() : `${dateInput}T12:00:00`;
    }

    let data = getSavings();

    const sAttachmentId = await (window.storeAttachmentFromInput ? storeAttachmentFromInput('sAttachment') : (async ()=>{
        const fileInput = document.getElementById('sAttachment');
        const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if(!file) return null;
        const store = window.reMoAttachments && window.reMoAttachments.storeImage ? window.reMoAttachments.storeImage : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.storeImage);
        if(!store) return null;
        try{ const res = await store(null,file); return res && res.id ? res.id : null; }catch(e){console.warn('Attachment save failed',e); return null; }
    })());

    if (type === "deposit") {
        const entry = createSavingsEntry({
            type: "deposit",
            amount: Math.abs(amount),
            entity,
            payment,
            note,
            date
        });
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }

    else if (type === "transfer") {
        const sourceId = String(sourceSelect?.value || "");

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let remaining = getSourceRemainingById(sourceId, data);
        if (Math.abs(amount) > remaining) {
            showToast(`Insufficient source balance (₹${remaining} available)`, "warning");
            return;
        }

        if (!destinationType || !destination) {
            showToast("Select destination type and destination ❗", "warning");
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
        entry.destinationType = destinationType;
        entry.destination = destination;
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }

    else if (type === "refund") {
        const refundValue = String(document.getElementById("refundSelect")?.value || "");
        if (!refundValue) {
            showToast("Select refund transaction ❗", "warning");
            return;
        }

        const refId = refundValue.includes(":") ? refundValue.split(":")[1] : refundValue;
        let original = data.find(t => String(t.id) === String(refId));

        if (!original || original.type !== "transfer") {
            showToast("Only transfer transactions are refundable in Savings Wallet", "warning");
            return;
        }

        let alreadyRefunded = data
            .filter(t => t.type === "refund" && String(t.linkedTransactionId) === String(refId))
            .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

        let pending = Math.max(0, Math.abs(Number(original.amount || 0)) - alreadyRefunded);
        if (Math.abs(amount) > pending) {
            showToast(`Only ₹${pending} refundable for this transaction`, "warning");
            return;
        }

        const entry = createSavingsEntry({
            type: "refund",
            amount: Math.abs(amount),
            sourceId: original.sourceId || null,
            entity,
            payment,
            note,
            date
        });
        entry.linkedTransactionId = original.id;
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }

    else if (type === "withdraw_budget") {
        const sourceId = String(sourceSelect?.value || "");

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let remaining = getSourceRemainingById(sourceId, data);
        if (Math.abs(amount) > remaining) {
            showToast(`Insufficient source balance (₹${remaining} available)`, "warning");
            return;
        }

        const activePeriod = (typeof getActiveBudgetPeriod === "function") ? getActiveBudgetPeriod() : null;
        if (!activePeriod) {
            showToast("Please create or activate a Budget Period before moving funds into Budget.", "warning");
            return;
        }

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

        const wallet = upsertActiveBudgetWalletFromSavings(entry);
        if (!wallet || !wallet.budgetId) {
            showToast("Budget Wallet allocation failed", "error");
            return;
        }

        entry.targetBudgetId = wallet.budgetId;
        entry.budgetWalletId = wallet.budgetId;
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }

    else {
        showToast("Unsupported savings transaction type", "warning");
        return;
    }

    saveSavings(data);
    loadSavings();
    loadSourceOptions();
    loadBudgetTargetOptions();
    loadRefundCandidates();
    renderIncomeList();

    showToast("Saved successfully ✅", "success");

    resetSavingsForm();
}
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

const _catModal = document.getElementById("categoryModal");
if (_catModal) {
    _catModal.addEventListener("click", function (e) {
        if (e.target === this) closeCategoryModal();
    });
}

const _personModal = document.getElementById("personModal");
if (_personModal) {
    _personModal.addEventListener("click", function (e) {
        if (e.target === this) closePersonModal();
    });
}

// =========================
// 🚀 INIT
// =========================
// Initializes page: loads data, sets date, loads sources, applies theme
window.addEventListener("load", function () {
    // Only run savings initialization when savings form element exists
    if (!document.getElementById || !document.getElementById("sType")) return;

    loadSavings();
    setTodayDate();
    loadSourceOptions();
    loadRefundCandidates();
    handleSavingsTypeChange();
    loadBudgetYears();
    loadCategoryOptions();
    loadPersonOptions();
    renderCategoryList();
    renderPersonList();
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
// Toast helper: define only if not already present to avoid overriding global app toast
if (typeof window.showToast !== 'function') {
    let activeToast = null;
    window.showToast = function(message, type = "info") {
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
    };
}
// =========================
// 📦 STORAGE
// =========================

// Fetch all savings transactions from localStorage (define only if not present)
if (typeof window.getSavings !== 'function') {
    window.getSavings = function () {
        return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
    };
}
// Save updated savings transactions into localStorage (define only if not present)
if (typeof window.saveSavings !== 'function') {
    window.saveSavings = function (data) {
        try { localStorage.setItem("savingsTransactions", JSON.stringify(data)); } catch (e) { console.error('saveSavings failed', e); }
    };
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
    date = new Date().toISOString(),
    attachmentId = null,
    linkedTransactionId = null,
    resolutionType = null,
    resolvedAmount = 0,
    lossAmount = 0
}) {

    let periodKey = (typeof getActivePeriodKey === 'function') ? getActivePeriodKey() : null; // safe call

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
        attachmentId: attachmentId || null,
        linkedTransactionId: linkedTransactionId || null,
        resolutionType: resolutionType || null,
        resolvedAmount: Number(resolvedAmount || 0),
        lossAmount: Number(lossAmount || 0)
    };
}

function getSavingsResolutionSnapshot(originalId, savingsList) {
    let entries = Array.isArray(savingsList)
        ? savingsList
        : ((typeof getScopedSavings === "function") ? getScopedSavings() : (getSavings() || []));

    let root = entries.find(e => String(e.id) === String(originalId));
    if (!root || root.type !== "transfer" || Number(root.amount || 0) >= 0) {
        return {
            exists: false,
            originalAmount: 0,
            refunded: 0,
            loss: 0,
            remainingRefundable: 0,
            status: "UNKNOWN"
        };
    }

    let originalAmount = Math.abs(Number(root.amount || 0));

    let refunded = entries
        .filter(e => e.type === "refund" && String(e.linkedTransactionId) === String(originalId))
        .reduce((sum, e) => sum + Math.abs(Number(e.amount || 0)), 0);

    let resolutionEntries = entries
        .filter(e => e.type === "expense_resolution" && String(e.linkedTransactionId) === String(originalId));

    let loss = resolutionEntries
        .reduce((sum, e) => sum + Math.abs(Number(e.lossAmount || 0)), 0);

    let remainingRefundable = Math.max(0, originalAmount - refunded - loss);

    let consumed = resolutionEntries.some(e => e.resolutionType === "consumed");
    let cancelledWithCharges = resolutionEntries.some(e => e.resolutionType === "cancelled_with_charges");

    let status = "OPEN";
    if (consumed) status = "CONSUMED";
    else if (cancelledWithCharges) status = "CANCELLED_WITH_CHARGES";
    else if (remainingRefundable <= 0 && refunded > 0) status = "FULLY_REFUNDED";
    else if (refunded > 0) status = "PARTIALLY_REFUNDED";

    return {
        exists: true,
        originalAmount,
        refunded,
        loss,
        remainingRefundable,
        status
    };
}

function formatSavingsResolutionStatus(status) {
    let map = {
        OPEN: "Open",
        PARTIALLY_REFUNDED: "Partially Refunded",
        FULLY_REFUNDED: "Fully Refunded",
        CONSUMED: "Consumed",
        CANCELLED_WITH_CHARGES: "Cancelled With Charges",
        UNKNOWN: "-"
    };
    return map[status] || String(status || "-");
}

function handleSavingsRefundResolutionChange() {
    let wrapper = document.getElementById("refundWrapper");
    if (!wrapper || wrapper.style.display === "none") return;

    let amountEl = document.getElementById("sAmount");
    let selectEl = document.getElementById("refundSelect");
    let resolutionEl = document.getElementById("sRefundResolutionType");
    let infoEl = document.getElementById("sRefundInfo");
    if (!amountEl || !selectEl || !resolutionEl || !infoEl) return;

    let raw = String(selectEl.value || "");
    if (!raw) {
        amountEl.disabled = false;
        amountEl.placeholder = "Amount";
        infoEl.textContent = "";
        return;
    }

    let refId = raw.includes(":") ? raw.split(":")[1] : raw;
    let snapshot = getSavingsResolutionSnapshot(refId);
    if (!snapshot.exists) {
        amountEl.disabled = false;
        amountEl.placeholder = "Amount";
        infoEl.textContent = "";
        return;
    }

    let mode = resolutionEl.value || "partial_refund";
    let pending = Number(snapshot.remainingRefundable || 0);

    if (mode === "complete_refund") {
        amountEl.value = pending ? String(pending) : "";
        amountEl.disabled = true;
        amountEl.placeholder = "Auto-filled complete refund";
    } else if (mode === "consumed") {
        amountEl.value = "0";
        amountEl.disabled = true;
        amountEl.placeholder = "No wallet credit for consumed";
    } else {
        amountEl.disabled = false;
        amountEl.placeholder = "Amount";
    }

    infoEl.textContent = `Original: ₹${snapshot.originalAmount.toFixed(2)} | Refunded: ₹${snapshot.refunded.toFixed(2)} | Remaining Refundable: ₹${snapshot.remainingRefundable.toFixed(2)} | Loss: ₹${snapshot.loss.toFixed(2)} | Status: ${formatSavingsResolutionStatus(snapshot.status)}`;
}

// =========================
// ➕ ADD ENTRY
// =========================
// Handles adding savings wallet transactions
async function addSavings() {

    if (!document.getElementById || !document.getElementById("sType")) return;

    const rawType = document.getElementById("sType") ? document.getElementById("sType").value : null;
    const type = rawType === "income" ? "deposit" : rawType;
    const amount = document.getElementById("sAmount") ? Number(document.getElementById("sAmount").value) : 0;
    const note = document.getElementById("sNote") ? document.getElementById("sNote").value : "";
    const dateInput = document.getElementById("sDate") ? document.getElementById("sDate").value : "";
    const entity = document.getElementById("sEntity") ? document.getElementById("sEntity").value : "";
    const payment = document.getElementById("sPayment") ? document.getElementById("sPayment").value : null;
    const sourceSelect = document.getElementById("sourceSelect");
    const personSelect = document.getElementById("sPerson");

    if (!amount || amount <= 0) {
        showToast("Enter valid amount ❗", "warning");
        return;
    }

    let date;
    if (!dateInput) {
        date = new Date().toISOString();
    } else {
        let todayStr = new Date().toISOString().split("T")[0];
        date = dateInput === todayStr ? new Date().toISOString() : `${dateInput}T12:00:00`;
    }

    let data = getSavings();

    const sAttachmentId = await (window.storeAttachmentFromInput ? storeAttachmentFromInput('sAttachment') : (async () => {
        const fileInput = document.getElementById('sAttachment');
        const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        if (!file) return null;
        const store = window.reMoAttachments && window.reMoAttachments.storeImage ? window.reMoAttachments.storeImage : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.storeImage);
        if (!store) return null;
        try { const res = await store(null, file); return res && res.id ? res.id : null; } catch (e) { console.warn('Attachment save failed', e); return null; }
    })());

    if (type === "deposit") {
        const entry = createSavingsEntry({
            type: "deposit",
            amount: Math.abs(amount),
            entity,
            payment,
            note,
            date
        });
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }
    else if (type === "transfer") {
        const sourceId = String(sourceSelect?.value || "");
        const person = personSelect?.value || null;

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let remaining = getSourceRemainingById(sourceId, data);
        if (Math.abs(amount) > remaining) {
            showToast(`Insufficient source balance (₹${remaining} available)`, "warning");
            return;
        }

        const entry = createSavingsEntry({
            type: "transfer",
            amount: -Math.abs(amount),
            sourceId,
            entity,
            payment,
            note,
            date
        });
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }
    else if (type === "refund") {
        const refundValue = String(document.getElementById("refundSelect")?.value || "");
        if (!refundValue) {
            showToast("Select refund transaction ❗", "warning");
            return;
        }

        const [, refId] = refundValue.split(":");
        let original = data.find(t => String(t.id) === String(refId));
        if (!original) {
            showToast("Original transaction not found ❗", "error");
            return;
        }

        if (original.type !== "transfer") {
            showToast("Only transfer transactions are refundable in Savings Wallet", "warning");
            return;
        }

        let snapshot = getSavingsResolutionSnapshot(refId, data);
        let pending = Number(snapshot.remainingRefundable || 0);
        if (pending <= 0) {
            showToast("This transfer is already fully resolved", "warning");
            return;
        }

        let resolutionType = document.getElementById("sRefundResolutionType")?.value || "partial_refund";
        let creditAmount = Math.abs(Number(amount || 0));

        if (resolutionType === "complete_refund") {
            creditAmount = pending;
        }
        if (resolutionType === "consumed") {
            creditAmount = 0;
        }

        if (creditAmount > pending) {
            showToast(`Only ₹${pending} refundable for this transaction`, "warning");
            return;
        }

        if (resolutionType === "partial_refund" || resolutionType === "complete_refund" || resolutionType === "cancelled_with_charges") {
            if (creditAmount > 0) {
                const refundEntry = createSavingsEntry({
                    type: "refund",
                    amount: Math.abs(creditAmount),
                    sourceId: original.sourceId || null,
                    entity,
                    payment,
                    note,
                    date,
                    linkedTransactionId: refId,
                    resolutionType,
                    resolvedAmount: creditAmount,
                    lossAmount: 0
                });
                if (sAttachmentId) refundEntry.attachmentId = sAttachmentId;
                data.push(refundEntry);
            }
        }

        if (resolutionType === "consumed" || resolutionType === "cancelled_with_charges") {
            let lossAmount = resolutionType === "cancelled_with_charges"
                ? Math.max(0, pending - creditAmount)
                : 0;

            const resolutionEntry = createSavingsEntry({
                type: "expense_resolution",
                amount: 0,
                sourceId: original.sourceId || null,
                entity,
                payment,
                note: note || (resolutionType === "consumed" ? "Transfer marked consumed" : "Transfer cancelled with charges"),
                date,
                linkedTransactionId: refId,
                resolutionType,
                resolvedAmount: pending,
                lossAmount
            });
            data.push(resolutionEntry);
        }
    }
    else if (type === "withdraw_budget") {
        const sourceId = String(sourceSelect?.value || "");

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let remaining = getSourceRemainingById(sourceId, data);
        if (Math.abs(amount) > remaining) {
            showToast(`Insufficient source balance (₹${remaining} available)`, "warning");
            return;
        }

        const activePeriod = (typeof getActiveBudgetPeriod === "function") ? getActiveBudgetPeriod() : null;
        if (!activePeriod) {
            showToast("Please create or activate a Budget Period before moving funds into Budget.", "warning");
            return;
        }

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

        const wallet = upsertActiveBudgetWalletFromSavings(entry);
        if (!wallet || !wallet.budgetId) {
            showToast("Budget Wallet allocation failed", "error");
            return;
        }

        entry.targetBudgetId = wallet.budgetId;
        entry.budgetWalletId = wallet.budgetId;
        if (sAttachmentId) entry.attachmentId = sAttachmentId;
        data.push(entry);
    }
    else {
        showToast("Unsupported savings transaction type", "warning");
        return;
    }

    saveSavings(data);
    loadSavings();
    loadSourceOptions();
    loadRefundCandidates();
    renderIncomeList();

    if (typeof loadDashboard === "function") loadDashboard();
    if (typeof loadHistory === "function") loadHistory();
    if (typeof loadGraph === "function") loadGraph();
    if (typeof renderBudgetEntries === "function") renderBudgetEntries();
    if (typeof loadBudgetOptions === "function") loadBudgetOptions();
    if (typeof updateBudgetEfficiency === "function") updateBudgetEfficiency();

    showToast("Saved successfully ✅", "success");
    resetSavingsForm();
}

// =========================
// 📦 BUDGET CREATION (FROM SAVINGS)
// =========================
// Creates or updates monthly budget based on savings allocation
function createOrUpdateBudget(budgetId, entry, selectedBudgetId = null) {

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
        if (selectedBudgetId && (
            String(b.budgetId) === String(selectedBudgetId) ||
            String(b.id) === String(selectedBudgetId) ||
            String(b.legacyId || "") === String(selectedBudgetId)
        )) return true;

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

function resolveActivePeriodKeyForSavings() {
    if (typeof getActivePeriodKey === "function") {
        let key = getActivePeriodKey();
        if (key) return key;
    }

    if (typeof getActiveBudgetPeriod === "function") {
        let period = getActiveBudgetPeriod();
        if (period && period.start && period.end) {
            let start = new Date(period.start);
            let end = new Date(period.end);

            let s = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
            let e = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

            return `${s}_to_${e}`;
        }
    }

    return null;
}

function upsertActiveBudgetWalletFromSavings(entry) {
    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
    let periodKey = resolveActivePeriodKeyForSavings();

    if (!periodKey) return null;

    let wallet = budgets.find(b => b && b.periodKey === periodKey && b.isBudgetWallet === true);

    if (!wallet) {
        wallet = budgets.find(b => b && b.periodKey === periodKey && (String(b.entity || "").toLowerCase() === "budget wallet"));
    }

    if (!wallet) {
        let uid = (typeof crypto !== "undefined" && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

        wallet = {
            id: Date.now(),
            type: "budget",
            budgetId: `budget_wallet_${periodKey}_${uid}`,
            sourceId: "savings_wallet",
            totalAllocated: 0,
            entity: "Budget Wallet",
            note: "Auto Budget Wallet",
            periodKey,
            monthKey: null,
            isBudgetWallet: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        budgets.push(wallet);
    }

    wallet.totalAllocated = Number(wallet.totalAllocated || 0) + Math.abs(Number(entry.amount || 0));
    wallet.updatedAt = new Date().toISOString();

    localStorage.setItem("budgets", JSON.stringify(budgets));
    return wallet;
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

    let data = (typeof getScopedSavings === "function")
        ? getScopedSavings()
        : (getSavings() || []);

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

    let compareTxn = (a, b) => {
        let da = new Date(a.date || 0).getTime();
        let db = new Date(b.date || 0).getTime();
        if (da !== db) return da - db;
        return String(a.id || "").localeCompare(String(b.id || ""));
    };

    let chronological = data.slice().sort(compareTxn);
    let persisted = ((typeof getSavings === "function") ? getSavings() : []) || [];
    let persistedById = new Map(persisted.map(x => [String(x && x.id), x]));

    let withRunning = chronological.map(t => {
        let p = persistedById.get(String(t.id));
        let persistedAfter = Number(p && p.BalanceAfterTransaction);
        if (Number.isFinite(persistedAfter)) {
            return Object.assign({}, t, { runningBalance: persistedAfter });
        }
        let fallback = Number(t.runningBalance);
        return Object.assign({}, t, { runningBalance: Number.isFinite(fallback) ? fallback : Number(t.amount || 0) });
    });

    withRunning.slice().reverse().forEach((t, index) => {

        // let realIndex = data.length - 1 - index; // 🔥 FIX INDEX

        let div = document.createElement("div");
        div.className = "expense-item";

        let labelMap = {
            income: "💰 Deposit",
            deposit: "💰 Deposit",
            transfer: "🔁 Transfer",
            budget_allocation: "📦 Budget",
            refund: "💵 Refund",
            expense_resolution: "🧾 Closure"
        };

        let label = labelMap[t.type] || t.type;
        let color = t.amount < 0 ? "red" : "green";
        let attachmentCount = t.attachmentId ? 1 : 0;
                let refundStatusNote = "";

        if (t.type === "transfer" && Number(t.amount || 0) < 0) {
            let snapshot = getSavingsResolutionSnapshot(t.id, chronological);
                        refundStatusNote = `<br>Refund Status: ${formatSavingsResolutionStatus(snapshot.status)}`;
        }

        div.innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;">
      <div>
                <strong>${label}${t.note ? ` • ${t.note}` : ""}</strong><br>
        <small>
                        ${new Date(t.date).toLocaleString()}<br>
                        Running Balance: ₹${Number(t.runningBalance || 0).toFixed(2)}
                        ${refundStatusNote}
                        ${attachmentCount ? `<br>📎 Attachment` : ""}
        </small>
      </div>
    </div>

    <div style="display:flex; align-items:center; gap:10px;">
        <span style="color:${color}; font-weight:600;">₹${Math.abs(t.amount)}</span>
        <button class="delete-btn" style="background:none; border:none; cursor:pointer; font-size:16px;">🗑</button>
    </div>
`;

        div.addEventListener("click", () => {
            if (typeof openTransactionAuditDetails === "function") {
                openTransactionAuditDetails("savings", t);
            }
        });

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
function isSavingsSourceSeed(entry) {
    if (!entry) return false;
    return entry.type === "income" || entry.type === "deposit";
}

function buildSavingsSourceLedger(entries) {
    let data = Array.isArray(entries) ? entries : [];

    let sources = data.filter(isSavingsSourceSeed);

    return sources.map(s => {
        let sid = String(s.id);

        let incoming = data
            .filter(t => String(t.id) !== sid && String(t.sourceId) === sid && Number(t.amount || 0) > 0)
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        let outgoing = data
            .filter(t => String(t.id) !== sid && String(t.sourceId) === sid && Number(t.amount || 0) < 0)
            .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

        let base = Math.max(0, Number(s.amount || 0));
        let remaining = base + incoming - outgoing;

        return {
            source: s,
            incoming,
            outgoing,
            remaining
        };
    });
}

function getSourceRemainingById(sourceId, entries) {
    let scoped = (typeof getScopedSavings === "function")
        ? getScopedSavings()
        : (getSavings() || []);
    let ledger = buildSavingsSourceLedger(entries || scoped);
    let row = ledger.find(x => String(x.source.id) === String(sourceId));
    return row ? Number(row.remaining || 0) : 0;
}

// Returns all source-seed entries (used as available sources)
function getAvailableSources() {
    let data = getSavings() || [];

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    return data.filter(t => {
        if (periodKey) return isSavingsSourceSeed(t) && t.periodKey === periodKey;
        return isSavingsSourceSeed(t) && t.monthKey === currentMonth;
    });
}

function loadSourceOptions({
    showAll = true,
    includeUsed = true
} = {}) {

    let select = document.getElementById("sourceSelect");
    if (!select) return;

    let data = (typeof getScopedSavings === "function")
        ? getScopedSavings()
        : (getSavings() || []);

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    let scoped = [...data];
    let ledger = buildSavingsSourceLedger(scoped);

    select.innerHTML = "<option value=''>Select Source</option>";

    if (!ledger.length) {
        let option = document.createElement("option");
        option.textContent = "No sources available";
        select.appendChild(option);
        return;
    }

    ledger.forEach(item => {

        let s = item.source;
        let remaining = Number(item.remaining || 0);

        if (!includeUsed && remaining <= 0) return;

        let option = document.createElement("option");
        option.value = s.id;
        option.dataset.remaining = String(remaining);

        let status = remaining <= 0
            ? "Used"
            : `₹${remaining} left`;

        option.textContent = `${s.note || "Savings Source"} — ${status}`;

        select.appendChild(option);
    });
}

function loadDestinationOptions() {
    let typeEl = document.getElementById("destinationType");
    let select = document.getElementById("destinationSelect");
    if (!typeEl || !select) return;

    let type = typeEl.value;

    select.innerHTML = "<option value=''>Select Destination</option>";

    let persons = (typeof getPersons === "function") ? getPersons() : [];
    let categories = (typeof getCategories === "function") ? getCategories() : [];

    let base = [];

    if (type === "person" || type === "friend") {
        base = persons.map(p => p && p.name).filter(Boolean);
    } else if (type === "hotel" || type === "vendor" || type === "business") {
        base = categories.map(c => (typeof c === "string" ? c : c && c.name)).filter(Boolean);
    } else if (type === "bank") {
        base = ["Bank Account", "Credit Card", "Loan Account"];
    } else if (type === "wallet") {
        base = ["Cash Wallet", "UPI Wallet", "Card Wallet"];
    } else {
        base = ["Other Entity"];
    }

    let seen = new Set();
    base.forEach(name => {
        let key = String(name).trim();
        if (!key || seen.has(key.toLowerCase())) return;
        seen.add(key.toLowerCase());
        let opt = document.createElement("option");
        opt.value = key;
        opt.textContent = key;
        select.appendChild(opt);
    });
}
// =========================
// 🔄 RESET FORM
// =========================
function resetSavingsForm() {
    document.getElementById("sAmount").value = "";
    document.getElementById("sNote").value = "";
    document.getElementById("sourceSelect").value = "";
    if (document.getElementById("refundSelect")) document.getElementById("refundSelect").value = "";
    if (document.getElementById("sRefundResolutionType")) document.getElementById("sRefundResolutionType").value = "partial_refund";
    if (document.getElementById("sRefundInfo")) document.getElementById("sRefundInfo").textContent = "";
    if (document.getElementById("sAmount")) {
        document.getElementById("sAmount").disabled = false;
        document.getElementById("sAmount").placeholder = "Amount";
    }
    let sInput = document.getElementById("sAttachment");
    let sPreview = document.getElementById("sAttachmentPreview");
    let sWrapper = document.getElementById("sAttachmentPreviewWrapper");
    let sRemove = document.getElementById("sAttachmentRemove");
    if (sInput) sInput.value = "";
    if (sPreview && sPreview.dataset && sPreview.dataset._previewUrl) {
        try { URL.revokeObjectURL(sPreview.dataset._previewUrl); } catch (e) { }
        sPreview.dataset._previewUrl = "";
    }
    if (sPreview) sPreview.src = "";
    if (sWrapper) sWrapper.style.display = "none";
    if (sRemove) sRemove.style.display = "none";
    document.getElementById("sType").value = "deposit";

    setTodayDate();
    handleSavingsTypeChange();
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

    if (!window.Chart) {
        console.warn("Chart.js not loaded; skipping savings graph render");
        return;
    }

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

        case "history":
            renderSavingsHistory(
                filteredSavingsData.length
                    ? filteredSavingsData
                    : getScopedSavings()
            );
            break;

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

    let income = data.find(t => String(t.id) === String(sourceId) && isSavingsSourceSeed(t));
    if (!income) return null;

    let linked = data.filter(t => String(t.sourceId) === String(income.id));

    let totalOutgoing = linked.reduce((sum, t) =>
        Number(t.amount || 0) < 0 ? sum + Math.abs(Number(t.amount || 0)) : sum,
        0
    );

    let totalIncoming = linked.reduce((sum, t) =>
        Number(t.amount || 0) > 0 ? sum + Number(t.amount || 0) : sum,
        0
    );

    return {
        name: income.note || "Income",
        totalIncome: income.amount,
        totalOutgoing,
        remaining: Number(income.amount || 0) - totalOutgoing + totalIncoming,
        entries: linked
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
                income: "💰 Deposit",
                deposit: "💰 Deposit",
                withdrawal: "📤 Withdrawal",
                refund: "💵 Refund"
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

    let data = (typeof getScopedSavings === "function")
        ? getScopedSavings()
        : (getSavings() || []);

    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    let now = new Date();
    let currentMonth = now.toISOString().slice(0, 7);

    // 🔥 GLOBAL SOURCES
    let scoped = [...data];

    // all source seeds from all periods
    let sources = scoped.filter(isSavingsSourceSeed);

    let container = document.getElementById("incomeList");
    if (!container) return;

    container.innerHTML = "";

    if (!sources.length) {
        container.innerHTML = `<p style="color:#888;">No savings sources yet</p>`;
        return;
    }

    sources.slice().reverse().forEach(i => {

        let used = scoped
            .filter(t => String(t.sourceId) === String(i.id) && Number(t.amount || 0) < 0)
            .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);

        let credited = scoped
            .filter(t => String(t.sourceId) === String(i.id) && Number(t.amount || 0) > 0)
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        let remaining = Number(i.amount || 0) - used + credited;

        let div = document.createElement("div");
        div.className = "income-card";

        let date = new Date(i.date);

        let monthYear = date.toLocaleString("en-IN", {
            month: "short",
            year: "numeric"
        });

        let name = i.note || `${monthYear} Source`;

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

    let rawType = document.getElementById("sType")?.value || "deposit";
    let type = rawType === "income" ? "deposit" : rawType;

    let source = document.getElementById("sourceWrapper");
    let refund = document.getElementById("refundWrapper");

    // reset
    [source, refund]
        .filter(Boolean)
        .forEach(el => { el.style.display = "none"; });

    if (type === "transfer") {
        if (source) source.style.display = "block";
        loadSourceOptions({ includeUsed: false });
        return;
    }

    if (type === "withdraw_budget") {
        if (source) source.style.display = "block";
        loadSourceOptions({ includeUsed: false });
        return;
    }

    if (type === "refund") {
        if (refund) refund.style.display = "block";
        loadRefundCandidates();
        handleSavingsRefundResolutionChange();
        return;
    }

    let amountEl = document.getElementById("sAmount");
    if (amountEl) {
        amountEl.disabled = false;
        amountEl.placeholder = "Amount";
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
    const jsPdfApi = window.jspdf || {};
    const jsPDF = jsPdfApi.jsPDF;
    if (!jsPDF) {
        showToast("PDF export unavailable offline: jsPDF not loaded", "warning");
        return;
    }
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
        saveSavings(data);
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
async function deleteSavings(id) {

    let data = getSavings();

    let entry = data.find(e => e.id == id);

    if (!entry) return;

    let rootIds = [String(id)];
    if (typeof validateTransactionDependencies === "function") {
        let safePlan = validateTransactionDependencies("savings", rootIds, false);
        if (safePlan.blocked) {
            let proceed = window.confirm(
                `Cannot delete because dependent records exist (${safePlan.summary}).\n\n` +
                `Use cascade delete and remove all dependents as well?`
            );
            if (!proceed) return;

            let cascadePlan = validateTransactionDependencies("savings", rootIds, true);
            if (typeof executeDeletePlan === "function") {
                await executeDeletePlan(cascadePlan);
                loadSavings();
                if (typeof loadHistory === "function") loadHistory();
                if (typeof loadDashboard === "function") loadDashboard();
                if (typeof loadGraph === "function") loadGraph();
                if (typeof renderBudgetEntries === "function") renderBudgetEntries();
                showToast("Deleted with dependents", "success");
                return;
            }
        }
    }

    // 🔥 remove by ID (not index)
    const deletedId = String(id);
    data = data.filter(e => String(e.id) != deletedId);

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

if (typeof window.getCategories !== 'function') {
    window.getCategories = function () {
        return JSON.parse(localStorage.getItem("categories")) || ["Self", "Family", "Friend", "Company", "Charity", "Other"];
    };
}

if (typeof window.saveCategories !== 'function') {
    window.saveCategories = function (list) {
        try { localStorage.setItem("categories", JSON.stringify(list)); } catch (e) { console.error('saveCategories failed', e); }
    };
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
    let check = (typeof validateLookupDeletion === "function")
        ? validateLookupDeletion("category", value)
        : { blocked: false, summary: "" };
    if (check.blocked) {
        showToast(`Cannot delete category. ${check.summary}`, "warning");
        return;
    }

    let categories = getCategories();

    categories = categories.filter(c => c !== value);

    saveCategories(categories);
    loadCategoryOptions();
    renderCategoryList(); // refresh UI
}

function deletePerson(value) {
    let check = (typeof validateLookupDeletion === "function")
        ? validateLookupDeletion("person", value)
        : { blocked: false, summary: "" };
    if (check.blocked) {
        showToast(`Cannot delete person. ${check.summary}`, "warning");
        return;
    }

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
            openAddPersonModal();
            this.value = "";
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

function loadRefundCandidates() {
    let select = document.getElementById("refundSelect");
    if (!select) return;

    let savings = (typeof getScopedSavings === "function")
        ? getScopedSavings()
        : (getSavings() || []);

    select.innerHTML = "<option value=''>Select Transfer Transaction</option>";

    // Savings wallet refunds are only for outbound transfer entries.
    let savingsCandidates = savings.filter(t => t.type === "transfer" && Number(t.amount || 0) < 0);
    savingsCandidates.forEach(t => {
        let snapshot = getSavingsResolutionSnapshot(t.id, savings);
        let pending = Number(snapshot.remainingRefundable || 0);
        if (pending <= 0) return;

        let opt = document.createElement("option");
        opt.value = `sav:${t.id}`;
        opt.textContent = `Transfer • ${t.note || t.destination || "-"} • ₹${pending.toFixed(2)} pending • ${formatSavingsResolutionStatus(snapshot.status)}`;
        select.appendChild(opt);
    });

    handleSavingsRefundResolutionChange();
}

function loadRecoveryExpenseOptions() {
    let select = document.getElementById("recoveryExpenseSelect");
    if (!select) return;

    let expenses = (typeof getExpenses === "function") ? getExpenses() : [];

    select.innerHTML = "<option value=''>Select Expense</option>";

    expenses
        .filter(e => Number(e.amount || 0) < 0)
        .forEach(e => {
            let recovered = expenses
                .filter(x => x.type === "recovery" && String(x.linkedTransactionId) === String(e.id))
                .reduce((sum, x) => {
                    if (Array.isArray(x.allocationTrail) && x.allocationTrail.length) {
                        return sum + x.allocationTrail.reduce((s, a) => s + Math.abs(Number(a.amount || 0)), 0);
                    }
                    return sum + Math.abs(Number(x.amount || 0));
                }, 0);

            let pending = Math.max(0, Math.abs(Number(e.amount || 0)) - recovered);
            if (pending <= 0) return;

            let opt = document.createElement("option");
            opt.value = String(e.id);
            opt.textContent = `${e.category || "Expense"} • ${e.purpose || "-"} • ₹${pending} recoverable`;
            select.appendChild(opt);
        });
}


function loadSettlementOptions() {
    // Deprecated in current savings architecture.
    return;
}

if (typeof window !== "undefined") {
    window.renderSavingsHistory = window.renderSavingsHistory || renderSavingsHistory;
    window.handleSavingsFilter = window.handleSavingsFilter || handleSavingsFilter;
    window.resetSavingsForm = window.resetSavingsForm || resetSavingsForm;
    window.getSavingsResolutionSnapshot = window.getSavingsResolutionSnapshot || getSavingsResolutionSnapshot;
    window.loadRefundCandidates = window.loadRefundCandidates || loadRefundCandidates;
}

// Savings Module End Savings.js