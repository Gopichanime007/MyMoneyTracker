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
        if (!person) {
            showToast("Select person ❗", "warning");
            return;
        }
            showToast(`Insufficient source balance (${formatSavingsAmount(remaining)} available)`, "warning");
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
            let snapshot = getSavingsResolutionSnapshot(refId);
            let pending = Number(snapshot.remainingRefundable || 0);
            if (pending <= 0) {
                showToast("This transfer is already fully resolved", "warning");
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
            showToast(`Only ${formatSavingsAmount(pending)} refundable for this transaction`, "warning");
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
            showToast(`Insufficient source balance (${formatSavingsAmount(remaining)} available)`, "warning");
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
    refreshSavingsRefundGuidance();

    let refundTypeEl = document.getElementById("sRefundType");
    if (refundTypeEl) refundTypeEl.addEventListener("change", refreshSavingsRefundGuidance);

    let resolutionEl = document.getElementById("sRefundResolutionType");
    if (resolutionEl) resolutionEl.addEventListener("change", refreshSavingsRefundGuidance);

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
    window.showToast = function (message, type = "info") {
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
    refundType = null,
    resolutionType = null,
    resolvedAmount = 0,
    lossAmount = 0
}) {

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

        monthKey: date.slice(0, 7),
        // Savings is intentionally independent from budget period scope.
        periodKey: null,

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachmentId: attachmentId || null,
        linkedTransactionId: linkedTransactionId || null,
        refundType: (type === "refund" || refundType) ? (typeof normalizeRefundType === "function" ? normalizeRefundType(refundType) : String(refundType || "custom")) : null,
        resolutionType: resolutionType ? (typeof normalizeResolutionType === "function" ? normalizeResolutionType(resolutionType) : String(resolutionType)) : null,
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

    let consumed = resolutionEntries.some(e => (typeof normalizeResolutionType === "function" ? normalizeResolutionType(e.resolutionType) : e.resolutionType) === "consumed");
    let cancelledWithCharges = resolutionEntries.some(e => (typeof normalizeResolutionType === "function" ? normalizeResolutionType(e.resolutionType) : e.resolutionType) === "cancelled_with_charges");
    let writtenOff = resolutionEntries.some(e => (typeof normalizeResolutionType === "function" ? normalizeResolutionType(e.resolutionType) : e.resolutionType) === "written_off");
    let settled = resolutionEntries.some(e => (typeof normalizeResolutionType === "function" ? normalizeResolutionType(e.resolutionType) : e.resolutionType) === "settled");

    let status = "OPEN";
    if (consumed) status = "CONSUMED";
    else if (cancelledWithCharges) status = "CANCELLED_WITH_CHARGES";
    else if (writtenOff) status = "WRITTEN_OFF";
    else if (settled) status = "SETTLED";
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
        WRITTEN_OFF: "Written Off",
        SETTLED: "Settled",
        CANCELLED_WITH_CHARGES: "Cancelled With Charges",
        UNKNOWN: "-"
    };
    return map[status] || String(status || "-");
}

function refreshSavingsRefundGuidance() {
    let refundTypeEl = document.getElementById("sRefundType");
    let resolutionEl = document.getElementById("sRefundResolutionType");
    let refundTypeHelpEl = document.getElementById("sRefundTypeHelp");
    let resolutionHelpEl = document.getElementById("sRefundResolutionHelp");

    if (refundTypeHelpEl && refundTypeEl) {
        let label = (typeof formatRefundType === "function")
            ? formatRefundType(refundTypeEl.value)
            : String(refundTypeEl.value || "Custom");
        let desc = (typeof getRefundTypeGuidance === "function")
            ? getRefundTypeGuidance(refundTypeEl.value)
            : "Any refund not covered above.";
        refundTypeHelpEl.textContent = `${label}: ${desc}`;
    }

    if (resolutionHelpEl && resolutionEl) {
        let normalized = (typeof normalizeResolutionType === "function")
            ? normalizeResolutionType(resolutionEl.value)
            : String(resolutionEl.value || "open");
        let label = (typeof RESOLUTION_TYPE_LABELS === "object" && RESOLUTION_TYPE_LABELS[normalized])
            ? RESOLUTION_TYPE_LABELS[normalized]
            : "Open";
        let desc = (typeof getResolutionTypeGuidance === "function")
            ? getResolutionTypeGuidance(resolutionEl.value)
            : "Refund is still in progress.";
        resolutionHelpEl.textContent = `${label}: ${desc}`;
    }
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

    let mode = (typeof normalizeResolutionType === "function")
        ? normalizeResolutionType(resolutionEl.value || "open")
        : (resolutionEl.value || "open");
    let pending = Number(snapshot.remainingRefundable || 0);

    if (mode === "fully_refunded") {
        amountEl.value = pending ? String(pending) : "";
        amountEl.disabled = true;
        amountEl.placeholder = "Auto-filled complete refund";
    } else if (mode === "consumed" || mode === "written_off") {
        amountEl.value = "0";
        amountEl.disabled = true;
        amountEl.placeholder = "No wallet credit for this closure";
    } else {
        amountEl.disabled = false;
        amountEl.placeholder = "Amount";
    }

    infoEl.textContent = `Original: ${formatSavingsAmount(snapshot.originalAmount)} | Refunded: ${formatSavingsAmount(snapshot.refunded)} | Remaining Refundable: ${formatSavingsAmount(snapshot.remainingRefundable)} | Loss: ${formatSavingsAmount(snapshot.loss)} | Status: ${formatSavingsResolutionStatus(snapshot.status)}`;
    refreshSavingsRefundGuidance();
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
    const destinationTypeEl = document.getElementById("destinationType");
    const destinationSelectEl = document.getElementById("destinationSelect");

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

    let attachmentMeta = { attachmentId: null, status: "none", error: null };
    try {
        if (typeof window.storeAttachmentWithStatus === "function") {
            attachmentMeta = await window.storeAttachmentWithStatus("sAttachment");
        } else if (typeof window.storeAttachmentFromInput === "function") {
            const attachmentId = await window.storeAttachmentFromInput("sAttachment");
            attachmentMeta = {
                attachmentId,
                status: attachmentId ? "linked" : "none",
                error: attachmentId ? null : null
            };
        }
    } catch (err) {
        attachmentMeta = {
            attachmentId: null,
            status: "failed",
            error: err && err.message ? err.message : "Attachment save failed"
        };
    }

    if (type === "deposit") {
        const entry = createSavingsEntry({
            type: "deposit",
            amount: Math.abs(amount),
            entity,
            payment,
            note,
            date
        });
        if (attachmentMeta.attachmentId) entry.attachmentId = attachmentMeta.attachmentId;
        entry.attachmentStatus = attachmentMeta.status;
        entry.attachmentError = attachmentMeta.error;
        data.push(entry);
    }
    else if (type === "transfer") {
        const sourceId = String(sourceSelect?.value || "");
        const person = personSelect?.value || null;
        const destinationType = destinationTypeEl?.value || null;
        const destination = destinationSelectEl?.value || null;

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let remaining = getSourceRemainingById(sourceId, data);
        if (Math.abs(amount) > remaining) {
            showToast(`Insufficient source balance (${formatSavingsAmount(remaining)} available)`, "warning");
            return;
        }

        if (destinationTypeEl && destinationSelectEl && (!destinationType || !destination)) {
            showToast("Select destination type and destination ❗", "warning");
            return;
        }

        if (!person) {
            showToast("Select person ❗", "warning");
            return;
        }

        const entry = createSavingsEntry({
            type: "transfer",
            amount: -Math.abs(amount),
            sourceId,
            entity,
            payment,
            person,
            note,
            date
        });
        if (destinationType) entry.destinationType = destinationType;
        if (destination) entry.destination = destination;
        if (attachmentMeta.attachmentId) entry.attachmentId = attachmentMeta.attachmentId;
        entry.attachmentStatus = attachmentMeta.status;
        entry.attachmentError = attachmentMeta.error;
        data.push(entry);
    }
    else if (type === "refund") {
        const person = personSelect?.value || null;
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

        let resolutionType = (typeof normalizeResolutionType === "function")
            ? normalizeResolutionType(document.getElementById("sRefundResolutionType")?.value || "open")
            : (document.getElementById("sRefundResolutionType")?.value || "open");
        let refundType = (typeof normalizeRefundType === "function")
            ? normalizeRefundType(document.getElementById("sRefundType")?.value || "custom")
            : String(document.getElementById("sRefundType")?.value || "custom");
        let creditAmount = Math.abs(Number(amount || 0));

        if (refundType === "loan_recovery" && !person) {
            showToast("Select person for Loan Recovery ❗", "warning");
            return;
        }

        if (resolutionType === "fully_refunded") {
            creditAmount = pending;
        }
        if (resolutionType === "consumed" || resolutionType === "written_off") {
            creditAmount = 0;
        }

        if (creditAmount > pending) {
            showToast(`Only ${formatSavingsAmount(pending)} refundable for this transaction`, "warning");
            return;
        }

        if (["open", "partially_refunded", "fully_refunded", "cancelled_with_charges", "settled"].includes(resolutionType)) {
            if (creditAmount > 0) {
                const refundEntry = createSavingsEntry({
                    type: "refund",
                    amount: Math.abs(creditAmount),
                    sourceId: original.sourceId || null,
                    entity,
                    payment,
                    person,
                    note,
                    date,
                    linkedTransactionId: refId,
                    refundType,
                    resolutionType,
                    resolvedAmount: creditAmount,
                    lossAmount: 0
                });
                if (attachmentMeta.attachmentId) refundEntry.attachmentId = attachmentMeta.attachmentId;
                refundEntry.attachmentStatus = attachmentMeta.status;
                refundEntry.attachmentError = attachmentMeta.error;
                data.push(refundEntry);
            }
        }

        if (["consumed", "cancelled_with_charges", "written_off", "settled"].includes(resolutionType)) {
            let lossAmount = resolutionType === "cancelled_with_charges"
                ? Math.max(0, pending - creditAmount)
                : (resolutionType === "written_off" ? pending : 0);

            const resolutionEntry = createSavingsEntry({
                type: "expense_resolution",
                amount: 0,
                sourceId: original.sourceId || null,
                entity,
                payment,
                person,
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
            showToast(`Insufficient source balance (${formatSavingsAmount(remaining)} available)`, "warning");
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
        if (attachmentMeta.attachmentId) entry.attachmentId = attachmentMeta.attachmentId;
        entry.attachmentStatus = attachmentMeta.status;
        entry.attachmentError = attachmentMeta.error;
        data.push(entry);
    }
    else if (type === "adjustment") {
        const sourceId = String(sourceSelect?.value || "");
        const direction = document.getElementById("sAdjustmentDirection")?.value || "increase";

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        if (!note || !note.trim()) {
            showToast("Reason is required for adjustment ❗", "warning");
            return;
        }

        const signedAmount = direction === "decrease" ? -Math.abs(amount) : Math.abs(amount);

        const entry = createSavingsEntry({
            type: "adjustment",
            amount: signedAmount,
            sourceId,
            entity,
            payment,
            note,
            date
        });
        if (attachmentMeta.attachmentId) entry.attachmentId = attachmentMeta.attachmentId;
        entry.attachmentStatus = attachmentMeta.status;
        entry.attachmentError = attachmentMeta.error;
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
    let sourceId = String(entry && entry.sourceId ? entry.sourceId : "savings_wallet");

    if (!periodKey) return null;

    // ⚠️ FIX (Issue 02): A Budget Wallet's identity is the Budget Period
    // ALONE. sourceId must never participate in this lookup — one Budget
    // Period has exactly one Budget Wallet, no matter how many different
    // Savings sources fund it over time.
    let wallet = budgets.find(b => b && b.periodKey === periodKey && b.isBudgetWallet === true);

    if (!wallet) {
        // Legacy-data fallback: older rows may lack the isBudgetWallet flag.
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
            sourceId: null,
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

function formatSavingsAmount(value) {
    let n = Number(value || 0);
    if (!Number.isFinite(n)) n = 0;
    if (typeof formatCurrency === "function") return formatCurrency(n);
    return `Rs. ${n.toFixed(2)}`;
}

function setTextById(id, value) {
    let el = document.getElementById(id);
    if (!el) return;
    el.textContent = value;
}

function normalizeSavingsAggregationType(type) {
    const normalized = String(type || "").toLowerCase();
    if (normalized === "income") return "deposit";
    return normalized;
}

function isSavingsDepositBucket(entry) {
    if (!entry || typeof entry !== "object") return false;
    return normalizeSavingsAggregationType(entry.type) === "deposit";
}

function isValidSavingsDashboardEntry(entry) {
    if (!entry || typeof entry !== "object") return false;
    if (entry.isArchived === true || entry.archived === true || String(entry.status || "").toLowerCase() === "archived") return false;
    let amount = Number(entry.amount);
    return Number.isFinite(amount) && amount !== 0 && !Number.isNaN(new Date(entry.date || entry.createdAt).getTime());
}

function getPeriodEntriesForSavingsDashboard(allRows, activePeriod, periodKey) {
    let rows = (Array.isArray(allRows) ? allRows : []).filter(isValidSavingsDashboardEntry);
    if (activePeriod && activePeriod.start) {
        let start = new Date(activePeriod.start);
        let end = activePeriod.end ? new Date(activePeriod.end) : new Date();
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return rows.filter(entry => {
            if (periodKey && entry.periodKey === periodKey) return true;
            let date = new Date(entry.date || entry.createdAt);
            return date >= start && date <= end;
        });
    }

    let now = new Date();
    return rows.filter(entry => {
        let date = new Date(entry.date || entry.createdAt);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
}

// Calculates totals and updates savings dashboard UI
function loadSavings() {
    let storedRows = (typeof getSavings === "function") ? (getSavings() || []) : [];
    let allRows = storedRows.filter(isValidSavingsDashboardEntry);
    let scoped = allRows;
    let now = new Date();
    let activePeriod = typeof getActiveBudgetPeriod === "function" ? getActiveBudgetPeriod() : null;
    let periodKey = typeof resolveActivePeriodKeyForSavings === "function" ? resolveActivePeriodKeyForSavings() : null;
    let periodRows = getPeriodEntriesForSavingsDashboard(allRows, activePeriod, periodKey);

    let daily = getDailyBudget();
    let dailyEl = document.getElementById("dailyBudget");
    if (dailyEl) dailyEl.innerText = formatSavingsAmount(daily);

    let totalBalance = allRows.reduce((sum, t) => sum + Number(t && t.amount || 0), 0);
    let totalDeposits = allRows.filter(isSavingsDepositBucket).reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    let totalTransfers = allRows.filter(t => t && (t.type === "transfer" || t.type === "budget_allocation")).reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    let totalRefunds = allRows.filter(t => t && t.type === "refund").reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    let netMovement = allRows.reduce((sum, t) => sum + Number(t && t.amount || 0), 0);
    let allocated = allRows.filter(t => t && t.type === "budget_allocation").reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    let available = totalBalance;

    let sortedByDate = allRows.slice().sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
    let latest = sortedByDate[0] || null;

    let largestTransfer = allRows
        .filter(t => t && (t.type === "transfer" || t.type === "budget_allocation") && Number(t.amount || 0) < 0)
        .reduce((mx, t) => Math.max(mx, Math.abs(Number(t.amount || 0))), 0);

    let largestRefund = allRows
        .filter(t => t && t.type === "refund")
        .reduce((mx, t) => Math.max(mx, Math.abs(Number(t.amount || 0))), 0);

    let periodLabel = activePeriod ? (periodKey || "Active Period") : "Current Month";
    let periodStart = activePeriod && activePeriod.start ? new Date(activePeriod.start).toLocaleDateString("en-IN") : new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-IN");
    let periodEnd = activePeriod && activePeriod.end ? new Date(activePeriod.end).toLocaleDateString("en-IN") : new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString("en-IN");
    let daysRemaining = activePeriod && activePeriod.end
        ? Math.max(0, Math.ceil((new Date(activePeriod.end).setHours(23, 59, 59, 999) - Date.now()) / 86400000))
        : Math.max(0, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate());

    setTextById("savingsBalance", formatSavingsAmount(totalBalance));
    setTextById("totalDeposits", formatSavingsAmount(totalDeposits));
    setTextById("totalTransfers", formatSavingsAmount(totalTransfers));
    setTextById("totalRefunds", formatSavingsAmount(totalRefunds));
    setTextById("netSavingsMovement", formatSavingsAmount(netMovement));
    setTextById("allocatedToBudget", formatSavingsAmount(allocated));
    setTextById("availableBalance", formatSavingsAmount(available));

    setTextById("currentBudgetPeriodLabel", periodLabel);
    setTextById("currentBudgetPeriodStart", periodStart);
    setTextById("currentBudgetPeriodEnd", periodEnd);
    let remainingLabel = "-";
    if (daysRemaining === "Closed") remainingLabel = "Closed";
    else if (daysRemaining !== "-") remainingLabel = `${daysRemaining} days`;
    setTextById("currentBudgetPeriodRemaining", remainingLabel);

    setTextById("transactionsThisPeriod", String(periodRows.length));
    setTextById("largestExpenseTransfer", formatSavingsAmount(largestTransfer));
    setTextById("largestRefund", formatSavingsAmount(largestRefund));

    if (latest) {
        setTextById("latestTransactionValue", formatSavingsAmount(Number(latest.amount || 0)));
        let latestMeta = `${latest.type || "entry"} • ${new Date(latest.date || Date.now()).toLocaleString("en-IN")}`;
        setTextById("latestTransactionMeta", latestMeta);
    } else {
        setTextById("latestTransactionValue", "-");
        setTextById("latestTransactionMeta", "No transactions");
    }

    setTextById("savingsHealthBalance", formatSavingsAmount(totalBalance));
    setTextById("savingsHealthAllocated", formatSavingsAmount(allocated));
    setTextById("savingsHealthNet", formatSavingsAmount(netMovement));
    setTextById("savingsHealthTransactions", String(periodRows.length));

    renderSavingsHistory(scoped);
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

function escapeSavingsHtml(value) {
    if (typeof escapeHtml === "function") {
        return escapeHtml(value);
    }

    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderSavingsHistory(data) {
    let container = document.getElementById("savingsHistory");
    if (!container) return;

    let sourceData = applySavingsSearch((Array.isArray(data) ? data : []).filter(isValidSavingsDashboardEntry));
    renderSavingsQueryChips();
    updateSavingsSortIndicator();

    container.innerHTML = "";

    if (!Array.isArray(sourceData) || !sourceData.length) {
        container.innerHTML = `<p class="empty-state">No data yet</p>`;
        return;
    }

    let persisted = ((typeof getSavings === "function") ? getSavings() : []) || [];
    let persistedById = new Map(persisted.map(x => [String(x && x.id), x]));

    let withRunning = sourceData.map(t => {
        let p = persistedById.get(String(t.id));
        let persistedAfter = Number(p && p.BalanceAfterTransaction);
        if (Number.isFinite(persistedAfter)) {
            return Object.assign({}, t, { runningBalance: persistedAfter });
        }
        let fallback = Number(t.runningBalance);
        return Object.assign({}, t, { runningBalance: Number.isFinite(fallback) ? fallback : Number(t.amount || 0) });
    });

    withRunning.forEach((t) => {

        let div = document.createElement("div");
        div.className = "expense-item transaction-card";

        let labelMap = {
            income: "💰 Deposit",
            deposit: "💰 Deposit",
            transfer: "🔁 Transfer",
            budget_allocation: "📦 Budget",
            refund: "💵 Refund",
            expense_resolution: "🧾 Closure"
        };

        let label = labelMap[t.type] || t.type;
        let amountClass = t.amount < 0 ? "negative" : "positive";
        let date = new Date(t.date).toLocaleString("en-IN");
        let runningBalance = formatCurrency(Number(t.runningBalance || 0));
        let meta = [];
        if (t.type === "refund" && typeof formatRefundType === "function") meta.push(`Refund Type: ${formatRefundType(t.refundType)}`);
        if (t.resolutionType && typeof normalizeResolutionType === "function") {
            const key = normalizeResolutionType(t.resolutionType);
            meta.push(`Resolution: ${(typeof RESOLUTION_TYPE_LABELS === "object" && RESOLUTION_TYPE_LABELS[key]) ? RESOLUTION_TYPE_LABELS[key] : key}`);
        }

        div.innerHTML = `
            <div class="transaction-card-head">
                <div class="history-type">${escapeSavingsHtml(label)}</div>
                ${meta.length ? `<div class="transaction-title">${escapeSavingsHtml(meta.join(" • "))}</div>` : ""}
            </div>

            <div class="transaction-meta-grid">
                <span class="entry-label">Source</span>
                <span class="entry-value">${escapeSavingsHtml(t.entity || t.paymentType || "Wallet")}</span>
                <span class="entry-label">Date</span>
                <span class="entry-value">${escapeSavingsHtml(date)}</span>
                <span class="entry-label">Running Balance</span>
                <span class="entry-value">${escapeSavingsHtml(runningBalance)}</span>
            </div>

            <div class="transaction-card-foot">
                <div class="history-amount ${amountClass}">${escapeSavingsHtml(formatCurrency(Math.abs(Number(t.amount || 0))))}</div>
                <div class="history-actions">
                    <button class="delete-btn" title="Delete">🗑</button>
                </div>
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

// Returns all source-seed entries (used as available sources)
function getAvailableSources() {
    let data = getSavings() || [];
    return data.filter(isSavingsSourceSeed);
}

function loadSourceOptions({
    showAll = true,
    includeUsed = true,
    includeArchived = false
} = {}) {

    let select = document.getElementById("sourceSelect");
    if (!select) return;

    let data = getSavings() || [];

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
        if (!includeArchived && s.status === "archived") return;

        let option = document.createElement("option");
        option.value = s.id;
        option.dataset.remaining = String(remaining);

        let status = remaining <= 0
            ? "Used"
            : `${formatSavingsAmount(remaining)} left`;

        if (s.status === "archived") {
            status += s.archiveReason === "depleted" ? " • Archived (Depleted)" : " • Archived";
        }

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
    if (document.getElementById("sRefundResolutionType")) document.getElementById("sRefundResolutionType").value = "open";
    if (document.getElementById("sRefundType")) document.getElementById("sRefundType").value = "custom";
    if (document.getElementById("sPerson")) document.getElementById("sPerson").value = "";
    if (document.getElementById("sRefundInfo")) document.getElementById("sRefundInfo").textContent = "";
    if (document.getElementById("sPersonHelp")) document.getElementById("sPersonHelp").textContent = "";
    if (document.getElementById("sAmount")) {
        document.getElementById("sAmount").disabled = false;
        document.getElementById("sAmount").placeholder = "Amount";
    }
    if (typeof window.clearSavingsAttachmentState === "function") {
        window.clearSavingsAttachmentState();
    } else {
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
    }
    document.getElementById("sType").value = "deposit";

    setTodayDate();
    handleSavingsTypeChange();
    refreshSavingsRefundGuidance();
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

function applySavingsSearch(rows) {
    let list = Array.isArray(rows) ? rows : [];
    if (!window.SearchService || typeof window.SearchService.applyModuleSearch !== "function") {
        return list;
    }

    let queryResult = window.SearchService.applyModuleSearch("savings", list);
    return Array.isArray(queryResult.results) ? queryResult.results : list;
}

function openSavingsFilterModal() {
    initializeSavingsFilterBuilder();
    if (window.SearchService && typeof window.SearchService.getState === "function" && savingsFilterBuilderInstance) {
        let state = window.SearchService.getState("savings");
        savingsFilterBuilderInstance.setFromFilters(Array.isArray(state.filters) ? state.filters : []);
    }
    let modal = document.getElementById("savingsFilterModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }
}

function closeSavingsFilterModal() {
    let modal = document.getElementById("savingsFilterModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

let savingsFilterBuilderInstance = null;

function getSavingsFilterTemplates() {
    return [
        { key: "date", label: "Date", field: "date", type: "date", hint: "Use Equals, Before, After, or Between" },
        { key: "category", label: "Category", field: "type", type: "text", hint: "Savings, reserve, emergency" },
        { key: "type", label: "Type", field: "type", type: "text", hint: "deposit, withdrawal" },
        { key: "amount", label: "Amount", field: "amount", type: "number", hint: "5000, 10000, 25000" },
        { key: "payment", label: "Payment Type", field: "paymentType", type: "enum", hint: "UPI, Cash, Debit Card, Credit Card" },
        { key: "budget", label: "Budget", field: "sourceId", type: "text", hint: "Budget or source id" },
        { key: "savings", label: "Savings", field: "note", type: "text", hint: "Goal or note tags" },
        { key: "source", label: "Source", field: "entity", type: "text", hint: "Bank or source entity" },
        { key: "person", label: "Person", field: "person", type: "text", hint: "Person names" },
        { key: "attachment", label: "Attachment", field: "attachmentName", type: "presence", hint: "Has any attachment" }
    ];
}

function initializeSavingsFilterBuilder() {
    let root = document.getElementById("savingsFilterBuilderRoot");
    if (!root || savingsFilterBuilderInstance || !window.FilterBuilder || typeof window.FilterBuilder.create !== "function") {
        return;
    }

    savingsFilterBuilderInstance = window.FilterBuilder.create({
        module: "savings",
        dateField: "date",
        templates: getSavingsFilterTemplates(),
        onClose: function () {
            closeSavingsFilterModal();
        },
        onApply: function (filters) {
            applySavingsFilterModal(filters);
        },
        onClear: function () {
            clearSavingsFilterModal(false);
        },
        onSave: function () {
            saveSavingsFilterModal();
        }
    });

    savingsFilterBuilderInstance.mount(root);
}

function buildSavingsFilterDescriptorsFromModal() {
    initializeSavingsFilterBuilder();
    if (!savingsFilterBuilderInstance) {
        return [];
    }
    return savingsFilterBuilderInstance.getDescriptors();
}

function applySavingsFilterModal(explicitFilters) {
    if (window.SearchService && typeof window.SearchService.setFilters === "function") {
        let filters = Array.isArray(explicitFilters) ? explicitFilters : buildSavingsFilterDescriptorsFromModal();
        window.SearchService.setFilters("savings", filters);
    }

    closeSavingsFilterModal();
    let base = filteredSavingsData.length ? filteredSavingsData : getScopedSavings();
    filteredSavingsData = applySavingsSearch(base);
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
    renderSavingsQueryChips();
}

async function saveSavingsFilterModal() {
    if (!window.SearchService || typeof window.SearchService.saveView !== "function") {
        return;
    }
    let name = await window.AppDialog.prompt("Filter name", "Savings Filter", "Save Filter");
    if (!name || !name.trim()) {
        return;
    }
    window.SearchService.saveView({ name: name.trim(), module: "savings", scope: "module" });
}

function clearSavingsFilterModal(closeAfterClear = true) {
    initializeSavingsFilterBuilder();
    if (savingsFilterBuilderInstance) {
        savingsFilterBuilderInstance.clearAll();
    }

    if (window.SearchService && typeof window.SearchService.clearFilters === "function") {
        window.SearchService.clearFilters("savings");
    }

    if (closeAfterClear) {
        closeSavingsFilterModal();
    }
    filteredSavingsData = applySavingsSearch(getScopedSavings());
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
    renderSavingsQueryChips();
}

function countSavingsFilterConditions(filters) {
    if (!Array.isArray(filters)) return 0;
    return filters.reduce((sum, filter) => {
        if (!filter || typeof filter !== "object") return sum;
        if (String(filter.op || "") === "group_any" && Array.isArray(filter.conditions)) {
            return sum + countSavingsFilterConditions(filter.conditions);
        }
        return sum + 1;
    }, 0);
}

function isDefaultSavingsSort(sortItem) {
    if (!sortItem || typeof sortItem !== "object") return true;
    let field = String(sortItem.field || "date").toLowerCase();
    let direction = String(sortItem.direction || "desc").toLowerCase();
    return field === "date" && direction === "desc";
}

function getSavingsSortChipLabel(sortItem) {
    let fieldRaw = String((sortItem && sortItem.field) || "date").toLowerCase();
    let directionRaw = String((sortItem && sortItem.direction) || "desc").toLowerCase();
    let fieldLabel = fieldRaw === "date"
        ? "Date"
        : (fieldRaw === "amount" ? "Amount" : fieldRaw.replace(/\b\w/g, c => c.toUpperCase()));
    let arrow = directionRaw === "asc" ? "↑" : "↓";
    return `Sort: ${fieldLabel} ${arrow}`;
}

function updateSavingsSortIndicator() {
    let filterBtn = document.getElementById("savingsFilterActionBtn");
    if (!filterBtn || !window.SearchService || typeof window.SearchService.getState !== "function") {
        return;
    }

    let state = window.SearchService.getState("savings");
    let filters = Array.isArray(state.filters) ? state.filters : [];
    let count = countSavingsFilterConditions(filters);
    filterBtn.textContent = count > 0 ? `Filter (${count})` : "Filter";
}

function getSavingsFilterChipLabel(filter) {
    if (!filter || typeof filter !== "object") return "Filter";
    if (filter.op === "period" && filter.value && typeof filter.value === "object") {
        let type = String(filter.value.type || "custom");
        if (type === "custom") {
            return `Period: ${filter.value.from || "-"} to ${filter.value.to || "-"}`;
        }
        return `Period: ${type}`;
    }
    return `${String(filter.field || "field")} ${String(filter.op || "eq")} ${String(filter.value || "")}`;
}

function renderSavingsQueryChips() {
    let host = document.getElementById("savingsQueryChips");
    if (!host || !window.SearchService || typeof window.SearchService.getState !== "function") {
        return;
    }

    let state = window.SearchService.getState("savings");
    let filters = Array.isArray(state.filters) ? state.filters : [];
    let sort = Array.isArray(state.sort) ? state.sort : [];

    host.innerHTML = "";

    filters.forEach((filter, index) => {
        let chip = document.createElement("button");
        chip.className = "secondary query-chip";
        chip.type = "button";
        chip.textContent = `${getSavingsFilterChipLabel(filter)} ×`;
        chip.addEventListener("click", () => removeSavingsFilterChip(index));
        host.appendChild(chip);
    });

    if (sort.length) {
        let first = sort[0];
        if (!isDefaultSavingsSort(first)) {
            let chip = document.createElement("button");
            chip.className = "secondary query-chip";
            chip.type = "button";
            chip.textContent = `${getSavingsSortChipLabel(first)} ×`;
            chip.addEventListener("click", clearSavingsSortChip);
            host.appendChild(chip);
        }
    }
}

function removeSavingsFilterChip(index) {
    if (!window.SearchService || typeof window.SearchService.getState !== "function") return;
    let state = window.SearchService.getState("savings");
    let filters = Array.isArray(state.filters) ? state.filters.slice() : [];
    filters.splice(index, 1);
    if (typeof window.SearchService.setFilters === "function") {
        window.SearchService.setFilters("savings", filters);
    }
    let base = filteredSavingsData.length ? filteredSavingsData : getScopedSavings();
    filteredSavingsData = applySavingsSearch(base);
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
    renderSavingsQueryChips();
}

function clearSavingsSortChip() {
    if (window.SearchService && typeof window.SearchService.clearSort === "function") {
        window.SearchService.clearSort("savings");
    }
    let base = filteredSavingsData.length ? filteredSavingsData : getScopedSavings();
    filteredSavingsData = applySavingsSearch(base);
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
}

function clearSavingsQueryChips() {
    if (window.SearchService) {
        if (typeof window.SearchService.clearFilters === "function") {
            window.SearchService.clearFilters("savings");
        }
        if (typeof window.SearchService.clearSort === "function") {
            window.SearchService.clearSort("savings");
        }
    }
    filteredSavingsData = applySavingsSearch(getScopedSavings());
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
    renderSavingsQueryChips();
}

function openSavingsSortModal() {
    let modal = document.getElementById("savingsSortModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }
}

function closeSavingsSortModal() {
    let modal = document.getElementById("savingsSortModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

function applySavingsSortModal() {
    let field = document.getElementById("savingsSortField")?.value || "date";
    let direction = document.getElementById("savingsSortDirection")?.value || "desc";
    let type = field === "amount" ? "number" : (field === "date" ? "date" : "string");

    if (window.SearchService && typeof window.SearchService.setSort === "function") {
        window.SearchService.setSort("savings", [{ field: field, direction: direction, type: type }]);
    }

    closeSavingsSortModal();
    updateSavingsSortIndicator();
    let base = filteredSavingsData.length ? filteredSavingsData : getScopedSavings();
    filteredSavingsData = applySavingsSearch(base);
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
    renderSavingsQueryChips();
}

function clearSavingsSortModal() {
    let fieldEl = document.getElementById("savingsSortField");
    let directionEl = document.getElementById("savingsSortDirection");
    if (fieldEl) fieldEl.value = "date";
    if (directionEl) directionEl.value = "desc";

    if (window.SearchService && typeof window.SearchService.clearSort === "function") {
        window.SearchService.clearSort("savings");
    }

    closeSavingsSortModal();
    updateSavingsSortIndicator();
    let base = filteredSavingsData.length ? filteredSavingsData : getScopedSavings();
    filteredSavingsData = applySavingsSearch(base);
    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
    renderSavingsQueryChips();
}

// Filters savings data by time (today, week, month, all) and updates UI
function handleSavingsFilter(type) {

    let data = getSavings() || [];

    let now = new Date();

    let baseData = [...data];

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
        if (modal) {
            modal.classList.remove("hidden");
            modal.style.display = "flex";
        }
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

        result = baseData.filter(t => {
            let d = getSafeDate(t.date);
            return d && d >= start && d <= end;
        });
    }

    // 🔥 MONTH
    else if (type === "month") {
        let monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        let monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        result = baseData.filter(t => {
            let d = getSafeDate(t.date);
            return d && d >= monthStart && d <= monthEnd;
        });
    }

    // 🔥 ALL
    else {
        result = [...baseData];
    }

    // =========================
    // 📊 STORE + UPDATE UI
    // =========================
    filteredSavingsData = applySavingsSearch(result);

    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
}
// Generates income vs expense chart using filtered or full data
function loadSavingsGraph(data) {

    if (!window.Chart) {
        console.warn("Chart.js not loaded; skipping savings graph render");
        return;
    }

    let d = (Array.isArray(data) ? data : (getSavings() || [])).filter(isValidSavingsDashboardEntry);

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
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
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
        container.innerHTML = `<p class="empty-state">No data found for this source</p>`;
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
        entriesHTML = `<p class="empty-state">No transactions yet</p>`;
    } else {
        related.slice().reverse().forEach(t => {

            let labelMap = {
                transfer: "🔁 Transfer",
                budget_allocation: "📦 Budget",
                income: "💰 Deposit",
                deposit: "💰 Deposit",
                withdrawal: "📤 Withdrawal",
                refund: "💵 Refund"
            };

            let label = labelMap[t.type] || t.type;

            let amountClass = Number(t.amount || 0) < 0 ? "negative" : "positive";
            let dateText = new Date(t.date).toLocaleString("en-IN");

            entriesHTML += `
                <div class="expense-item transaction-card">
                    <div class="transaction-card-head">
                        <div class="history-type">${escapeSavingsHtml(label)}</div>
                        <div class="transaction-title">${escapeSavingsHtml(t.note || t.person || "Entry")}</div>
                    </div>

                    <div class="transaction-meta-grid">
                        <span class="entry-label">Source</span>
                        <span class="entry-value">${escapeSavingsHtml(income.note || income.entity || "Savings Source")}</span>
                        <span class="entry-label">Date</span>
                        <span class="entry-value">${escapeSavingsHtml(dateText)}</span>
                        <span class="entry-label">Notes</span>
                        <span class="entry-value">${escapeSavingsHtml(t.note || "-")}</span>
                    </div>

                    <div class="transaction-card-foot">
                        <div class="history-amount ${amountClass}">${escapeSavingsHtml(formatCurrency(Math.abs(Number(t.amount || 0))))}</div>
                    </div>
                </div>
            `;
        });
    }

    // 📦 FINAL UI
    container.innerHTML = `
        <div class="entry-details-shell">
            <div class="entry-details-header">
                <div>
                    <h3>${escapeSavingsHtml(income.note || "Income Source")}</h3>
                    <small>${escapeSavingsHtml(new Date(income.date || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }))}</small>
                </div>
            </div>

            <div class="entry-summary-grid">
                <div>
                    <small>Total</small>
                    <strong>${escapeSavingsHtml(formatCurrency(income.amount))}</strong>
                </div>
                <div>
                    <small>Used</small>
                    <strong>${escapeSavingsHtml(formatCurrency(used))}</strong>
                </div>
                <div>
                    <small>Credited</small>
                    <strong>${escapeSavingsHtml(formatCurrency(credited))}</strong>
                </div>
                <div>
                    <small>Remaining</small>
                    <strong>${escapeSavingsHtml(formatCurrency(remaining))}</strong>
                </div>
            </div>

            <h4>Transactions</h4>
            <div class="entry-details-transactions">${entriesHTML}</div>
        </div>
    `;
}

let savingsSourceFilter = "active";

function setSavingsSourceFilter(filter) {
    savingsSourceFilter = filter;
    renderIncomeList();
}

function renderIncomeList() {

    let data = getSavings() || [];
    let scoped = [...data];
    let allSources = scoped.filter(isSavingsSourceSeed);
    let activeCount = allSources.filter(s => s.status !== "archived").length;
    let archivedSources = allSources.filter(s => s.status === "archived");
    let depletedCount = archivedSources.filter(s => s.archiveReason === "depleted").length;

    let sources = allSources.filter(s => {
        if (savingsSourceFilter === "all") return true;
        if (savingsSourceFilter === "archived") return s.status === "archived";
        return s.status !== "archived";
    });

    let container = document.getElementById("incomeList");
    if (!container) return;

    let filterBar = document.getElementById("savingsSourceFilterBar");
    if (filterBar) {
        filterBar.classList.add("is-prominent");
        filterBar.innerHTML = ["active", "archived", "all"].map(key => {
            let label = key === "active" ? "Active" : (key === "archived" ? "Archived" : "All");
            let activeClass = savingsSourceFilter === key ? "is-active" : "";
            return `<button type="button" class="tab-bar-btn ${activeClass}" onclick="setSavingsSourceFilter('${key}')">${label}</button>`;
        }).join("");
    }

    container.innerHTML = "";
    let summary = document.getElementById("sourceSummary");
    if (!summary) {
        container.insertAdjacentHTML("beforebegin", '<p id="sourceSummary" class="source-summary"></p>');
        summary = document.getElementById("sourceSummary");
    }
    if (summary) summary.textContent = `${activeCount} active · ${archivedSources.length} archived (${depletedCount} depleted)`;

    if (!sources.length) {
        container.innerHTML = `<p class="empty-state">No savings sources ${savingsSourceFilter === "all" ? "yet" : "in this view"}</p>`;
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
        div.className = "income-card entry-card";

        let date = new Date(i.date);

        let monthYear = date.toLocaleString("en-IN", {
            month: "short",
            year: "numeric"
        });

        let name = i.note || `${monthYear} Source`;

        let isArchived = i.status === "archived";
        let statusText = isArchived
            ? (i.archiveReason === "depleted" ? "Archived (Depleted)" : "Archived")
            : (remaining <= 0 ? "Exhausted" : "Active");
        let statusClass = isArchived ? "is-exhausted" : (remaining <= 0 ? "is-exhausted" : "is-active");

        let txCount = scoped.filter(t => String(t.sourceId) === String(i.id)).length;
        let createdDate = new Date(i.createdAt || i.date || Date.now()).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });

        div.innerHTML = `
            <div class="entry-card-head">
                <div class="entry-title-wrap">
                    <h4 class="entry-title">${escapeSavingsHtml(name)}</h4>
                    <small class="entry-subtitle">${escapeSavingsHtml(monthYear)}</small>
                </div>
                <span class="entry-status-pill ${statusClass}">${statusText}</span>
            </div>

            <div class="source-entry-details">
                <div class="source-entry-row">
                    <span class="source-entry-key">Target Amount</span>
                    <span class="source-entry-value">${escapeSavingsHtml(formatCurrency(i.amount))}</span>
                </div>
                <div class="source-entry-row">
                    <span class="source-entry-key">Saved Amount</span>
                    <span class="source-entry-value">${escapeSavingsHtml(formatCurrency(Number(i.amount || 0) - Math.max(0, remaining)))}</span>
                </div>
                <div class="source-entry-row">
                    <span class="source-entry-key">Remaining</span>
                    <span class="source-entry-value">${escapeSavingsHtml(formatCurrency(remaining))}</span>
                </div>
                <div class="source-entry-row">
                    <span class="source-entry-key">Transactions</span>
                    <span class="source-entry-value">${escapeSavingsHtml(String(txCount))}</span>
                </div>
                <div class="source-entry-row">
                    <span class="source-entry-key">Created Date</span>
                    <span class="source-entry-value">${escapeSavingsHtml(createdDate)}</span>
                </div>
            </div>

            <div class="entry-actions">
                <button type="button" class="entry-action-btn" data-action="view">View Transactions</button>
                <button type="button" class="entry-action-btn is-muted" disabled>Edit</button>
                ${isArchived
                ? `<button type="button" class="entry-action-btn" data-action="unarchive">Unarchive</button>`
                : `<button type="button" class="entry-action-btn" data-action="archive">Archive</button>`
            }
                <button type="button" class="entry-action-btn is-danger" data-action="delete">Delete</button>
            </div>
        `;

        let viewDetails = () => {
            let id = String(i.id);
            showSavingsScreen("details");
            requestAnimationFrame(() => {
                renderSourceDetails(id);
            });
        };

        div.addEventListener("click", viewDetails);

        let viewBtn = div.querySelector('[data-action="view"]');
        if (viewBtn) {
            viewBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                viewDetails();
            });
        }

        let archiveBtn = div.querySelector('[data-action="archive"]');
        if (archiveBtn) {
            archiveBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                archiveSourceManually(i.id);
                loadSavings();
                renderIncomeList();
                showToast("Source archived 🗄", "success");
            });
        }

        let unarchiveBtn = div.querySelector('[data-action="unarchive"]');
        if (unarchiveBtn) {
            unarchiveBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                let result = unarchiveSource(i.id);
                if (!result.ok) {
                    showToast(result.error, "warning");
                    return;
                }
                loadSavings();
                renderIncomeList();
                showToast("Source reactivated ✅", "success");
            });
        }

        let deleteBtn = div.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                await deleteSavings(i.id);
            });
        }

        container.appendChild(div);
    });
}
// Closes the savings date filter modal
function closeSavingsModal() {
    let modal = document.getElementById("savingsDateModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSavingsModal();
});

// Controls UI fields based on selected type (income / transfer / budget)
function handleSavingsTypeChange() {

    let rawType = document.getElementById("sType")?.value || "deposit";
    let type = rawType === "income" ? "deposit" : rawType;

    let source = document.getElementById("sourceWrapper");
    let refund = document.getElementById("refundWrapper");
    let person = document.getElementById("sPersonWrapper");
    let personHelp = document.getElementById("sPersonHelp");
    let adjustmentDirection = document.getElementById("sAdjustmentDirectionWrapper");

    // reset
    [source, refund, person, adjustmentDirection]
        .filter(Boolean)
        .forEach(el => { el.style.display = "none"; });

    if (type === "transfer") {
        if (source) source.style.display = "block";
        if (person) person.style.display = "block";
        if (personHelp) personHelp.textContent = "Person is required for transfer transactions.";
        loadSourceOptions({ includeUsed: false });
        return;
    }

    if (type === "withdraw_budget") {
        if (source) source.style.display = "block";
        loadSourceOptions({ includeUsed: false });
        return;
    }

    if (type === "adjustment") {
        if (source) source.style.display = "block";
        if (adjustmentDirection) adjustmentDirection.style.display = "block";
        // Archived (including Depleted) sources must stay pickable here —
        // this is the only way a Depleted source becomes Active again.
        loadSourceOptions({ includeUsed: true, includeArchived: true });
        return;
    }
    if (type === "refund") {
        if (refund) refund.style.display = "block";
        if (person) person.style.display = "block";
        if (personHelp) personHelp.textContent = "Person is optional for refunds. Select it only when needed.";
        loadRefundCandidates();
        handleSavingsRefundResolutionChange();
        refreshSavingsRefundGuidance();
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

    let scoped = data.filter(t => {
        let d = new Date(t.date).toISOString().slice(0, 10);

        if (from && !to) return d === from;
        if (!from && to) return d <= to;
        if (from && to) return d >= from && d <= to;

        return true;
    });

    filteredSavingsData = applySavingsSearch(scoped);

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

    let data = applySavingsSearch(getSavings());

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
        let details = [];
        if (t.type === "refund" && typeof formatRefundType === "function") details.push(`Type: ${formatRefundType(t.refundType)}`);
        if (t.resolutionType && typeof normalizeResolutionType === "function") {
            const key = normalizeResolutionType(t.resolutionType);
            const label = (typeof RESOLUTION_TYPE_LABELS === "object" && RESOLUTION_TYPE_LABELS[key]) ? RESOLUTION_TYPE_LABELS[key] : key;
            details.push(`Resolution: ${label}`);
        }
        let purpose = [t.note || "-"].concat(details).join(" | ");
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
    doc.text(`Total Income: ${formatSavingsAmount(totalIncome)}`, 14, y);

    y += 7;

    doc.setTextColor(200, 0, 0);
    doc.text(`Total Outgoing: ${formatSavingsAmount(totalExpense)}`, 14, y);

    y += 7;

    doc.setTextColor(0);
    doc.text(`Net Balance: ${formatSavingsAmount(totalIncome - totalExpense)}`, 14, y);

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

    // ⚠️ Archive System: a SOURCE with dependents gets archived instead
    // of destructively deleted — preserves funding history that's
    // already been spent against, rather than erasing it.
    if (isSavingsSourceSeed(entry)) {
        let safePlan = (typeof validateTransactionDependencies === "function")
            ? validateTransactionDependencies("savings", rootIds, false)
            : { blocked: false };

        if (safePlan.blocked) {
            let proceed = await window.AppDialog.confirm(
                `This source has related records (${safePlan.summary}) and can't be deleted.\n\n` +
                `Archive it instead? It stops appearing as an active source, but all its history stays intact.`
            );
            if (!proceed) return;

            archiveSourceManually(entry.id);
            loadSavings();
            if (typeof renderIncomeList === "function") renderIncomeList();
            showToast("Source archived 🗄", "success");
            return;
        }
    } else if (typeof validateTransactionDependencies === "function") {
        let safePlan = validateTransactionDependencies("savings", rootIds, false);
        if (safePlan.blocked) {
            let proceed = await window.AppDialog.confirm(
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

    // No dependents — clean hard delete, exactly as before.
    const deletedId = String(id);
    data = data.filter(e => String(e.id) != deletedId);

    saveSavings(data);

    if (entry.budgetWalletId) {
        adjustBudgetAfterDelete(entry);
    }

    loadSavings();

    showToast("Deleted successfully 🗑", "success");
}
// ⚠️ FIX: match by budgetWalletId — the real, precise link — instead of
// entity+period guesswork. Also now covers every funding entry type
// (normal Move-to-Budget AND resolved Unassigned Top-Ups), not just one.
function adjustBudgetAfterDelete(entry) {
    if (!entry || !entry.budgetWalletId) return;

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
    let budget = budgets.find(b => b && String(b.budgetId || b.id || "") === String(entry.budgetWalletId));

    if (budget) {
        budget.totalAllocated = Math.max(0, Number(budget.totalAllocated || 0) - Math.abs(Number(entry.amount) || 0));
        budget.updatedAt = new Date().toISOString();
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
    // Display/retrieval scope intentionally includes all persisted entries.
    // Period-specific analytics should use explicit period helpers.
    return getSavings() || [];
}

function getActiveBudgetPeriodFull() {
    return null;
}

function getEffectiveDays() {
    let now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getDailyBudget() {

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

    let currentMonth = new Date().toISOString().slice(0, 7);

    let total = budgets
        .filter(b => {
            if (!b || typeof b !== "object") return false;
            if (String(b.monthKey || "") === currentMonth) return true;
            let dateKey = String(b.date || "").slice(0, 7);
            return dateKey === currentMonth;
        })
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

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
        opt.textContent = `Transfer • ${t.note || t.destination || "-"} • ${formatSavingsAmount(pending)} pending • ${formatSavingsResolutionStatus(snapshot.status)}`;
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
            opt.textContent = `${e.category || "Expense"} • ${e.purpose || "-"} • ${formatSavingsAmount(pending)} recoverable`;
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