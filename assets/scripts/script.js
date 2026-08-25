const isSavingsPage = (typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string' && window.location.pathname.includes("savings")) || false;
let currentFilteredExpenses = [];
let expenseBudgetSelectionState = {
    userSelectedBudget: false,
    lastSuggestedBudgetId: ""
};
// =========================
// 💱 CURRENCY CORE SYSTEM
// =========================

// Base currency (never changes)
const BASE_CURRENCY = "INR";

// Currency symbols
const currencySymbols = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£"
};

// Static exchange rates (relative to INR)
const exchangeRates = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0095
};

// =========================
// 🧠 USER SELECTED CURRENCY
// =========================


function getCurrencyCode() {
    try {
        let code = localStorage.getItem("currencyCode") || "INR";
        return code;
    } catch (err) {
        console.warn('getCurrencyCode failed, defaulting to INR', err);
        return "INR";
    }
}

function setCurrencyCode(code) {
    try {
        localStorage.setItem("currencyCode", code);
    } catch (err) {
        console.warn('setCurrencyCode failed', err);
    }
}
// =========================
// 🔄 CONVERSION
// =========================

// Convert from BASE (INR) → Selected Currency
function convertFromBase(amount) {
    try {
        let code = getCurrencyCode();
        let rate = exchangeRates[code] || 1;
        let result = amount * rate;

        return result;
    } catch (err) {
        console.warn('convertFromBase failed', err);
        return amount;
    }
}

// Convert from Selected Currency → BASE (INR)
function convertToBase(amount) {
    try {
        let code = getCurrencyCode();
        let rate = exchangeRates[code] || 1;
        let result = amount / rate;
        return result;
    } catch (err) {
        console.warn('convertToBase failed', err);
        return amount;
    }
}

// Rounds to 2 decimal places (paise/cents) to eliminate floating-point drift
// from repeated addition/subtraction across many ledger entries.
function roundCurrency(value) {
    let num = Number(value);
    if (!Number.isFinite(num)) return 0;
    return Math.round((num + Number.EPSILON) * 100) / 100;
}


// =========================
// 💰 FORMAT (USE EVERYWHERE)
// =========================

function formatCurrency(amount) {
    try {
        let code = getCurrencyCode();
        let symbol = currencySymbols[code] || "₹";

        let converted = convertFromBase(amount);

        let result = symbol + " " + converted.toFixed(2);

        return result;

    } catch (err) {
        console.warn('formatCurrency failed', err);
        return amount;
    }
}


function changeCurrency(code) {

    try {
        setCurrencyCode(code);

        loadDashboard();
        loadHistory();
        loadBudgetScreen();
        renderBudgetEntries();
        renderCategoryBreakdown(groupByCategory(getExpenses()));


    } catch (err) {
        console.warn('changeCurrency failed', err);
    }
}

/* =========================
   📦 STORAGE LAYER
========================= */

function getExpenses() {

    try {
        let data = JSON.parse(localStorage.getItem("expenses")) || [];
        return data;
    } catch (err) {
        return [];
    }
}
function calculateSpentForPeriod(start, end) {

    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

    function parseRangeBoundary(value, isEnd) {
        if (!value) return null;
        let str = String(value);
        let hasTime = str.includes("T") || /\d{2}:\d{2}/.test(str);

        if (hasTime) {
            return new Date(str).getTime();
        }

        let day = new Date(str);
        if (Number.isNaN(day.getTime())) return null;
        if (isEnd) {
            day.setHours(23, 59, 59, 999);
        } else {
            day.setHours(0, 0, 0, 0);
        }
        return day.getTime();
    }

    let startTime = parseRangeBoundary(start, false);
    let endTime = end
        ? parseRangeBoundary(end, true)
        : new Date().getTime();

    if (startTime == null || endTime == null) return 0;

    return expenses
        .filter(e => {
            let d = new Date(e.date).getTime();
            return d >= startTime && d <= endTime && e.amount < 0;
        })
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);
}

// function getBudgetForPeriod(start, end) {

//     let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

//     // build periodKey
//     let s = new Date(start).toISOString().slice(0, 10);
//     let e = end
//         ? new Date(end).toISOString().slice(0, 10)
//         : new Date().toISOString().slice(0, 10);

//     let periodKey = `${s}_to_${e}`;

//     // find matching budgets
//     let filtered = budgets.filter(b => b.periodKey === periodKey);

//     if (!filtered.length) return null;

//     return {
//         totalAllocated: filtered.reduce((sum, b) => sum + (b.totalAllocated || 0), 0)
//     };
// }

function getBudgetForPeriod(start, end) {

    let budgets =
        JSON.parse(
            localStorage.getItem("budgets")
        ) || [];

    function safeDate(date) {

        let d = new Date(date);

        return [
            d.getFullYear(),
            String(d.getMonth() + 1)
                .padStart(2, "0"),
            String(d.getDate())
                .padStart(2, "0")
        ].join("-");
    }

    let s = safeDate(start);

    let e = end
        ? safeDate(end)
        : safeDate(new Date());

    let periodKey =
        `${s}_to_${e}`;

    let filtered = budgets.filter(
        b => b.periodKey === periodKey
    );

    if (!filtered.length)
        return null;

    return {
        totalAllocated:
            filtered.reduce(
                (sum, b) =>
                    sum + (b.totalAllocated || 0),
                0
            )
    };
}
function saveExpenses(data) {

    try {
        let safe = Array.isArray(data) ? data : [];
        let rebalanced = rebalanceExpenseLedger(safe, getBudgets());
        localStorage.setItem("expenses", JSON.stringify(rebalanced));

        const changeEvent = new CustomEvent('expenses:changed', {
            detail: { expenses: rebalanced }
        });

        if (typeof window !== 'undefined') {
            window.dispatchEvent(changeEvent);
        }
        if (typeof document !== 'undefined') {
            document.dispatchEvent(changeEvent);
        }
    } catch (err) {
        console.error('saveExpenses failed', err);
    }
}

function collectExpenseBudgetIds(entry) {
    let ids = new Set();
    if (!entry || typeof entry !== "object") return ids;

    if (entry.budgetId) ids.add(String(entry.budgetId));
    if (Array.isArray(entry.allocationTrail)) {
        entry.allocationTrail.forEach(a => {
            if (a && a.budgetId) ids.add(String(a.budgetId));
        });
    }
    return ids;
}

function resolveExpenseWalletKey(entry, budgetById) {
    if (!entry || typeof entry !== "object") return "global";

    let directBudgetId = entry.budgetId ? String(entry.budgetId) : null;
    let budgetRow = directBudgetId ? budgetById.get(directBudgetId) : null;

    if (entry.periodKey) return `period:${String(entry.periodKey)}`;
    if (budgetRow && budgetRow.periodKey) return `period:${String(budgetRow.periodKey)}`;

    if (entry.monthKey) return `month:${String(entry.monthKey)}`;
    if (budgetRow && budgetRow.monthKey) return `month:${String(budgetRow.monthKey)}`;

    if (entry.date) {
        let d = new Date(entry.date);
        if (!Number.isNaN(d.getTime())) {
            let monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return `month:${monthKey}`;
        }
    }

    return "global";
}

function rebalanceExpenseLedger(expenses, budgetsInput) {
    let list = Array.isArray(expenses) ? expenses : [];
    let budgets = Array.isArray(budgetsInput) ? budgetsInput : getBudgets();

    let budgetById = new Map(
        budgets.map(b => [String((b && (b.budgetId || b.id)) || ""), b])
    );

    let compareTxn = (a, b) => {
        let da = new Date((a && a.date) || 0).getTime();
        let db = new Date((b && b.date) || 0).getTime();
        if (da !== db) return da - db;
        return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
    };

    let cloned = list.map(e => (e && typeof e === "object") ? Object.assign({}, e) : e);
    let ordered = cloned.slice().sort(compareTxn);

    let walletMeta = new Map();
    ordered.forEach(e => {
        if (!e || typeof e !== "object") return;
        let key = resolveExpenseWalletKey(e, budgetById);
        if (!walletMeta.has(key)) walletMeta.set(key, { budgetIds: new Set() });
        let info = walletMeta.get(key);
        collectExpenseBudgetIds(e).forEach(id => info.budgetIds.add(id));
    });

    let openingByWallet = {};
    for (let [key, info] of walletMeta.entries()) {
        let opening = 0;

        if (key.startsWith("period:")) {
            let period = key.slice("period:".length);
            opening = budgets
                .filter(b => b && String(b.periodKey || "") === period)
                .reduce((sum, b) => sum + Number(b.totalAllocated || 0), 0);
        } else if (key.startsWith("month:")) {
            let month = key.slice("month:".length);
            opening = budgets
                .filter(b => {
                    if (!b) return false;
                    if (String(b.monthKey || "") === month) return true;
                    let bid = String(b.budgetId || b.id || "");
                    return info.budgetIds.has(bid);
                })
                .reduce((sum, b) => sum + Number(b.totalAllocated || 0), 0);
        } else {
            opening = budgets
                .filter(b => {
                    if (!b) return false;
                    let bid = String(b.budgetId || b.id || "");
                    return info.budgetIds.has(bid);
                })
                .reduce((sum, b) => sum + Number(b.totalAllocated || 0), 0);
        }

        openingByWallet[key] = opening;
    }

    let runningByWallet = Object.assign({}, openingByWallet);

    ordered.forEach(e => {
        if (!e || typeof e !== "object") return;
        let key = resolveExpenseWalletKey(e, budgetById);
        if (runningByWallet[key] == null) runningByWallet[key] = 0;

        let before = Number(runningByWallet[key] || 0);
        let delta = Number(e.amount || 0);
        let after = before + delta;

        e.BalanceBeforeTransaction = before;
        e.BalanceAfterTransaction = after;

        // Backward-compatible field used by some old UI paths.
        e.runningBalance = after;

        runningByWallet[key] = after;
    });

    return cloned;
}

function getBudgets() {

    try {
        let data = JSON.parse(localStorage.getItem("budgets")) || [];
        return normalizeBudgetsSchema(data);
    } catch (err) {
        return [];
    }
}
function saveBudgets(data) {

    try {
        localStorage.setItem("budgets", JSON.stringify(normalizeBudgetsSchema(data)));
    } catch (err) {
        console.error('saveBudgets failed', err);
    }
}

// Backward-compatible budget schema normalization.
// Some older backups use `amount` instead of `totalAllocated`.
function normalizeBudgetsSchema(data) {
    if (!Array.isArray(data)) return [];

    return data.map(b => {
        if (!b || typeof b !== 'object') return b;

        let next = b;

        if (next.totalAllocated == null && next.amount != null) {
            next = Object.assign({}, next, {
                totalAllocated: Number(next.amount) || 0
            });
        }

        if (typeof next.totalAllocated !== 'number') {
            next = Object.assign({}, next, {
                totalAllocated: Number(next.totalAllocated) || 0
            });
        }

        return next;
    });
}


function getSavings() {
    return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}

function resolveSavingsWalletKey(entry) {
    if (!entry || typeof entry !== "object") return "global";
    if (entry.monthKey) return `month:${String(entry.monthKey)}`;
    if (entry.date) {
        let d = new Date(entry.date);
        if (!Number.isNaN(d.getTime())) {
            return `month:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }
    }
    return "global";
}

function rebalanceSavingsLedger(entries) {
    let list = Array.isArray(entries) ? entries : [];

    let compareTxn = (a, b) => {
        let da = new Date((a && a.date) || 0).getTime();
        let db = new Date((b && b.date) || 0).getTime();
        if (da !== db) return da - db;
        return String((a && a.id) || "").localeCompare(String((b && b.id) || ""));
    };

    let cloned = list.map(e => (e && typeof e === "object") ? Object.assign({}, e) : e);
    let ordered = cloned.slice().sort(compareTxn);
    let runningByWallet = {};

    ordered.forEach(e => {
        if (!e || typeof e !== "object") return;
        let key = resolveSavingsWalletKey(e);
        if (runningByWallet[key] == null) runningByWallet[key] = 0;

        let before = Number(runningByWallet[key] || 0);
        let delta = Number(e.amount || 0);
        let after = before + delta;

        e.BalanceBeforeTransaction = before;
        e.BalanceAfterTransaction = after;
        e.runningBalance = after;

        runningByWallet[key] = after;
    });

    return cloned;
}

function saveSavings(data) {
    try {
        let safe = Array.isArray(data) ? data : [];
        let rebalanced = rebalanceSavingsLedger(safe);
        localStorage.setItem("savingsTransactions", JSON.stringify(rebalanced));
    } catch (err) {
        console.error('saveSavings failed', err);
    }
}

// =========================
// 💠 UNASSIGNED TOP-UPS (Issue 02 Part C)
// =========================
// Money added straight into a Budget Wallet without picking a Savings
// source yet. Savings is NOT touched until a source is assigned (fully
// or partially) later. Each top-up stays its own permanently traceable
// record — never merged into a single blob, per the agreed business rule.
function getUnassignedTopups() {
    try {
        return JSON.parse(localStorage.getItem("unassignedTopups")) || [];
    } catch (err) {
        return [];
    }
}

function saveUnassignedTopups(data) {
    try {
        let safe = Array.isArray(data) ? data : [];
        localStorage.setItem("unassignedTopups", JSON.stringify(safe));
    } catch (err) {
        console.error('saveUnassignedTopups failed', err);
    }
}

// Same "one wallet per period" identity rule as Issue 02's fix — reused
// here, not duplicated, so both paths can never disagree with each other.
function getOrCreateActiveBudgetWallet() {
    let periodKey = typeof getActivePeriodKey === "function" ? getActivePeriodKey() : null;
    if (!periodKey) return null;

    let budgets = getBudgets();
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
        saveBudgets(budgets);
    }

    return wallet;
}

// Creates a new unassigned top-up: adds straight to the active wallet's
// spendable total, leaves Savings completely untouched.
function createUnassignedTopup({ amount, note = "", date = new Date().toISOString() }) {
    let amt = Math.abs(Number(amount) || 0);
    if (!amt) return null;

    let wallet = getOrCreateActiveBudgetWallet();
    if (!wallet) return null;

    let budgets = getBudgets();
    let liveWallet = budgets.find(b => b && b.budgetId === wallet.budgetId);
    if (!liveWallet) return null;

    liveWallet.totalAllocated = Number(liveWallet.totalAllocated || 0) + amt;
    liveWallet.updatedAt = new Date().toISOString();
    saveBudgets(budgets);

    let topup = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `topup_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        amount: amt,
        note,
        date,
        periodKey: liveWallet.periodKey,
        budgetWalletId: liveWallet.budgetId,
        assignedAmount: 0,
        assignments: [],
        status: "unassigned",
        parked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    let topups = getUnassignedTopups();
    topups.push(topup);
    saveUnassignedTopups(topups);

    return topup;
}

// Every top-up still needing (full or partial) source assignment —
// whether it's tied to a still-open wallet or parked in the long-term
// Unresolved pool from a closed period.
function getPendingUnassignedTopups() {
    return getUnassignedTopups().filter(t => t && t.status !== "assigned");
}

function getRemainingUnassignedAmount(topup) {
    if (!topup) return 0;
    return roundCurrency(Math.max(0, Number(topup.amount || 0) - Number(topup.assignedAmount || 0)));
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
    let scoped = getSavings() || [];
    let ledger = buildSavingsSourceLedger(entries || scoped);
    let row = ledger.find(x => String(x.source.id) === String(sourceId));
    return row ? Number(row.remaining || 0) : 0;
}

// ⚠️ Funding-source traceability for a Budget Wallet (Issue 02 / Issue 01).
// Derived on demand from Savings entries — nothing new is stored, so this
// can never drift out of sync with the actual transaction history.
function getBudgetFundingSources(budgetId) {
    if (!budgetId) return [];

    let savings = (typeof getSavings === "function") ? getSavings() : [];

    return savings
        .filter(entry => entry && String(entry.budgetWalletId || entry.targetBudgetId || "") === String(budgetId))
        .map(entry => ({
            sourceId: entry.sourceId || null,
            amount: Math.abs(Number(entry.amount || 0)),
            date: entry.date || entry.createdAt || null,
            note: entry.note || ""
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// Manually (or automatically, at closure) assign part or all of an
// Unassigned Top-Up to a real Savings source. Creates a real Savings
// ledger entry (reduces that source) but does NOT touch the wallet's
// totalAllocated again — that already happened the moment the top-up
// was created.
function assignUnassignedTopupToSource(topupId, sourceId, amount, method = "manual") {
    let topups = getUnassignedTopups();
    let topup = topups.find(t => String(t.id) === String(topupId));
    if (!topup) return { ok: false, error: "Top-up not found" };

    let remaining = getRemainingUnassignedAmount(topup);
    let requested = roundCurrency(Math.abs(Number(amount) || 0));

    if (!requested || requested <= 0) {
        return { ok: false, error: "Enter a valid amount" };
    }
    if (requested > remaining) {
        return { ok: false, error: `Only ${formatCurrency(remaining)} left to assign on this top-up` };
    }

    let sourceAvailable = getSourceRemainingById(sourceId);
    if (requested > sourceAvailable) {
        return { ok: false, error: `Selected source only has ${formatCurrency(sourceAvailable)} available` };
    }

    let savings = getSavings();
    let entry = {
        id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `sav_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        type: "unassigned_topup_resolution",
        amount: -requested,
        sourceId,
        entity: "Budget Wallet",
        paymentType: null,
        person: null,
        note: `Resolved top-up${topup.note ? " — " + topup.note : ""}${method === "auto" ? " (auto-assigned)" : ""}`,
        date: new Date().toISOString(),
        monthKey: new Date().toISOString().slice(0, 7),
        periodKey: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        targetBudgetId: topup.budgetWalletId,
        budgetWalletId: topup.budgetWalletId,
        linkedTopupId: topup.id
    };
    savings.push(entry);
    saveSavings(savings);

    topup.assignedAmount = roundCurrency(Number(topup.assignedAmount || 0) + requested);
    topup.assignments.push({
        sourceId,
        amount: requested,
        date: new Date().toISOString(),
        method,
        savingsEntryId: entry.id
    });
    topup.status = topup.assignedAmount >= topup.amount ? "assigned" : "partially_assigned";
    topup.updatedAt = new Date().toISOString();

    saveUnassignedTopups(topups);

    return { ok: true, topup, entry };
}

// ⚠️ Section 12/13: try to auto-resolve every still-unassigned top-up
// in a wallet, using the most recent eligible Bank deposit first (by
// its real remaining balance), splitting across as many deposits as
// needed. Whatever can't be covered gets parked in the standing
// Unresolved Pool — never blocks anything, always stays traceable.
function autoResolveWalletTopups(wallet) {
    if (!wallet || !wallet.budgetId) return;

    let topups = getUnassignedTopups();
    let pending = topups.filter(t => t && t.budgetWalletId === wallet.budgetId && t.status !== "assigned" && !t.parked);
    if (!pending.length) return;

    pending.forEach(topup => {
        let remaining = getRemainingUnassignedAmount(topup);
        if (remaining <= 0) return;

        let savings = getSavings();
        let eligibleDeposits = savings
            .filter(e => e && e.type === "deposit" && String(e.paymentType || "") === "Bank")
            .map(e => ({ id: e.id, date: e.date, remaining: getSourceRemainingById(e.id, savings) }))
            .filter(d => d.remaining > 0)
            .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        let need = remaining;

        eligibleDeposits.forEach(dep => {
            if (need <= 0) return;
            let use = roundCurrency(Math.min(dep.remaining, need));
            if (use <= 0) return;

            let result = assignUnassignedTopupToSource(topup.id, dep.id, use, "auto");
            if (result && result.ok) {
                need = roundCurrency(need - use);
            }
        });

        let stillRemaining = getRemainingUnassignedAmount(topup);
        if (stillRemaining > 0) {
            let all = getUnassignedTopups();
            let live = all.find(t => t.id === topup.id);
            if (live) {
                live.parked = true;
                live.parkedFromBudgetId = wallet.budgetId;
                live.updatedAt = new Date().toISOString();
                saveUnassignedTopups(all);
            }
        }
    });
}

// Runs once per app load: any Budget Wallet that is no longer the
// active period's wallet (i.e. its period has closed) gets its
// still-unassigned top-ups auto-resolved. Guarded by
// topupsAutoResolved so a wallet is only ever processed once, no
// matter how many times the app is opened afterward.
function autoResolveClosedWalletTopups() {
    let activePeriodKey = typeof getActivePeriodKey === "function" ? getActivePeriodKey() : null;
    let budgets = getBudgets();
    let toProcess = budgets.filter(b => b && b.isBudgetWallet === true && b.periodKey && b.periodKey !== activePeriodKey && !b.topupsAutoResolved);

    if (!toProcess.length) return;

    toProcess.forEach(wallet => {
        autoResolveWalletTopups(wallet);
    });

    let refreshed = getBudgets();
    toProcess.forEach(processedWallet => {
        let live = refreshed.find(b => b.budgetId === processedWallet.budgetId);
        if (live) live.topupsAutoResolved = true;
    });
    saveBudgets(refreshed);
}
// =========================
// 🖥️ BUDGET WALLET SCREEN (Overview / Top-Up / Apply Source)
// =========================
function renderBudgetWalletOverview() {
    let periodKey = typeof getActivePeriodKey === "function" ? getActivePeriodKey() : null;
    let budgets = getBudgets();
    let wallet = periodKey ? budgets.find(b => b && b.periodKey === periodKey && b.isBudgetWallet === true) : null;

    let totalAllocated = wallet ? Number(wallet.totalAllocated || 0) : 0;
    let expenses = getExpenses();

    // Remaining keeps using the existing, already-correct net-spent figure
    // (adjustments included) — untouched on purpose.
    let netSpentIncludingAdjustments = wallet ? Math.max(0, getNetSpentForBudget(wallet.budgetId, expenses)) : 0;
    let remaining = totalAllocated - netSpentIncludingAdjustments;

    // What the user actually sees as "Spent" excludes adjustments.
    let realSpent = wallet ? Math.max(0, getRealSpentForBudget(wallet.budgetId, expenses)) : 0;
    let netAdjustment = wallet ? getNetAdjustmentForBudget(wallet.budgetId, expenses) : 0;

    let topups = getUnassignedTopups();
    let unassignedTotal = wallet
        ? topups
            .filter(t => t && t.budgetWalletId === wallet.budgetId && !t.parked)
            .reduce((sum, t) => sum + getRemainingUnassignedAmount(t), 0)
        : 0;

    let assignedTotal = Math.max(0, totalAllocated - unassignedTotal);

    let setText = (id, value) => {
        let el = document.getElementById(id);
        if (el) el.textContent = formatCurrency(value);
    };

    setText("walletAssignedTotal", assignedTotal);
    setText("walletUnassignedTotal", unassignedTotal);
    setText("walletSpentTotal", realSpent);
    setText("walletRemainingTotal", remaining);
    setText("walletAdjustmentTotal", netAdjustment);
}
function handleCreateUnassignedTopup() {
    let amountInput = document.getElementById("topupAmount");
    let noteInput = document.getElementById("topupNote");
    let dateInput = document.getElementById("topupDate");

    let amount = Number(amountInput ? amountInput.value : 0);
    if (!amount || amount <= 0) {
        showToast("Enter a valid amount");
        return;
    }

    let date = dateInput && dateInput.value ? new Date(dateInput.value).toISOString() : new Date().toISOString();
    let note = noteInput ? noteInput.value : "";

    let topup = createUnassignedTopup({ amount, note, date });
    if (!topup) {
        showToast("Could not create top-up. Is a Budget Period active?");
        return;
    }

    showToast("Top-up added ✅");

    if (amountInput) amountInput.value = "";
    if (noteInput) noteInput.value = "";
    prefillTopupForm();

    renderBudgetWalletOverview();
    if (typeof renderBudgetEntries === "function") renderBudgetEntries();
    if (typeof loadBudgetScreen === "function") loadBudgetScreen();
    if (typeof loadDashboard === "function") loadDashboard();
}

// Pre-fills sensible defaults when the Top-Up tab opens — the whole
// point of Top-Up is speed, so the form should already be ready to go.
// Guarded so it never overwrites something you've already started typing.
function prefillTopupForm() {
    let dateInput = document.getElementById("topupDate");
    if (dateInput && !dateInput.value) {
        dateInput.value = new Date().toISOString().split("T")[0];
    }

    let noteInput = document.getElementById("topupNote");
    if (noteInput && !noteInput.value) {
        noteInput.value = "Quick top-up";
    }
}
function renderApplySourceTab() {
    let container = document.getElementById("pendingTopupsList");
    if (!container) return;

    let pending = getPendingUnassignedTopups();

    if (!pending.length) {
        container.innerHTML = "<p class='empty-state'>No unassigned top-ups right now.</p>";
        return;
    }

    container.innerHTML = "";

    pending.slice().reverse().forEach(t => {
        let remaining = getRemainingUnassignedAmount(t);
        let dateText = new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

        let div = document.createElement("div");
        div.className = "expense-item transaction-card";
        div.innerHTML = `
            <div class="transaction-card-head">
                <div class="history-type">${t.parked ? "🗂 Unresolved Pool" : "💠 Unassigned Top-Up"}</div>
                <div class="transaction-title">${escapeHtml(t.note || "-")}</div>
            </div>
            <div class="transaction-meta-grid">
                <span class="entry-label">Date</span>
                <span class="entry-value">${escapeHtml(dateText)}</span>
                <span class="entry-label">Original Amount</span>
                <span class="entry-value">${escapeHtml(formatCurrency(t.amount))}</span>
                <span class="entry-label">Still Unassigned</span>
                <span class="entry-value">${escapeHtml(formatCurrency(remaining))}</span>
            </div>
            <div class="transaction-card-foot">
                <div class="history-actions">
                    <button class="entry-action-btn" type="button" onclick="openAssignTopupModal('${escapeHtml(t.id)}')">Assign Source</button>
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

function ensureAssignTopupModal() {
    let existing = document.getElementById("assignTopupModal");
    if (existing) return existing;

    let modal = document.createElement("div");
    modal.id = "assignTopupModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="modal-content" onclick="event.stopPropagation()">
        <h3>Assign Source</h3>
        <p class="modal-sub" id="assignTopupContext"></p>

        <label for="assignTopupSource">Savings Source</label>
        <select id="assignTopupSource"></select>

        <label for="assignTopupAmount">Amount to Assign</label>
        <input type="number" id="assignTopupAmount" placeholder="Amount">

        <div class="modal-actions">
          <button class="secondary" type="button" onclick="closeAssignTopupModal()">Cancel</button>
          <button class="primary" type="button" onclick="confirmAssignTopup()">Assign</button>
        </div>
      </div>
    `;
    modal.addEventListener("click", closeAssignTopupModal);
    document.body.appendChild(modal);
    return modal;
}

function closeAssignTopupModal() {
    let modal = document.getElementById("assignTopupModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

let currentAssignTopupId = null;

function openAssignTopupModal(topupId) {
    let topup = getUnassignedTopups().find(t => String(t.id) === String(topupId));
    if (!topup) return;

    currentAssignTopupId = topupId;
    let modal = ensureAssignTopupModal();

    let remaining = getRemainingUnassignedAmount(topup);
    let contextEl = document.getElementById("assignTopupContext");
    if (contextEl) {
        contextEl.textContent = `${formatCurrency(remaining)} still unassigned from top-up dated ${new Date(topup.date).toLocaleDateString("en-IN")}${topup.note ? " — " + topup.note : ""}`;
    }

    let sourceSelect = document.getElementById("assignTopupSource");
    if (sourceSelect) {
        let savings = getSavings();
        let ledger = buildSavingsSourceLedger(savings);
        sourceSelect.innerHTML = "<option value=''>Select Source</option>";
        ledger.forEach(item => {
            if (Number(item.remaining || 0) <= 0) return;
            let opt = document.createElement("option");
            opt.value = item.source.id;
            opt.textContent = `${item.source.note || "Savings Source"} — ${formatCurrency(item.remaining)} left`;
            sourceSelect.appendChild(opt);
        });
    }

    let amountInput = document.getElementById("assignTopupAmount");
    if (amountInput) amountInput.value = remaining ? String(remaining) : "";

    modal.classList.remove("hidden");
    modal.style.display = "flex";
}

function confirmAssignTopup() {
    if (!currentAssignTopupId) return;

    let sourceId = document.getElementById("assignTopupSource")?.value || "";
    let amount = document.getElementById("assignTopupAmount")?.value || "";

    if (!sourceId) {
        showToast("Select a source");
        return;
    }

    let result = assignUnassignedTopupToSource(currentAssignTopupId, sourceId, amount);
    if (!result.ok) {
        showToast(result.error || "Could not assign");
        return;
    }

    showToast("Source assigned ✅");
    closeAssignTopupModal();
    renderApplySourceTab();
    renderBudgetWalletOverview();
    if (typeof loadSavings === "function") loadSavings();
    if (typeof loadSourceOptions === "function") loadSourceOptions();
}

// Expose core storage helpers on `window` only if not already provided by another module.
if (typeof window !== 'undefined') {
    window.getExpenses = window.getExpenses || getExpenses;
    window.saveExpenses = window.saveExpenses || saveExpenses;
    window.getBudgets = window.getBudgets || getBudgets;
    window.saveBudgets = window.saveBudgets || saveBudgets;
    window.getSavings = window.getSavings || getSavings;
    window.saveSavings = window.saveSavings || saveSavings;
    window.getCategories = window.getCategories || (typeof getCategories === 'function' ? getCategories : undefined);
    window.setCurrencyCode = window.setCurrencyCode || setCurrencyCode;
    window.convertFromBase = window.convertFromBase || convertFromBase;
    window.convertToBase = window.convertToBase || convertToBase;
    window.calculateSpentForPeriod = window.calculateSpentForPeriod || calculateSpentForPeriod;
    window.rebalanceExpenseLedger = window.rebalanceExpenseLedger || rebalanceExpenseLedger;
    window.rebalanceSavingsLedger = window.rebalanceSavingsLedger || rebalanceSavingsLedger;
    window.getExpenseResolutionSnapshot = window.getExpenseResolutionSnapshot || getExpenseResolutionSnapshot;
    window.getNetSpentForBudget = window.getNetSpentForBudget || getNetSpentForBudget;
    window.filterDataByType = window.filterDataByType || filterDataByType;
    window.getActiveBudgetPeriod = window.getActiveBudgetPeriod || getActiveBudgetPeriod;
    window.selectActiveBudgetPeriod = window.selectActiveBudgetPeriod || selectActiveBudgetPeriod;
    window.getBudgetPeriodEffectiveEndDate = window.getBudgetPeriodEffectiveEndDate || getBudgetPeriodEffectiveEndDate;
    window.normalizeBudgetPeriods = window.normalizeBudgetPeriods || normalizeBudgetPeriods;
    window.reactivateBudgetPeriodLifecycle = window.reactivateBudgetPeriodLifecycle || reactivateBudgetPeriodLifecycle;
    window.calculateGraphAverageExpense = window.calculateGraphAverageExpense || calculateGraphAverageExpense;
    window.calculateAverageSpendingByType = window.calculateAverageSpendingByType || calculateAverageSpendingByType;
    window.loadGraph = window.loadGraph || loadGraph;
    window.updateGraphSummary = window.updateGraphSummary || updateGraphSummary;
    window.loadBudgetOptions = window.loadBudgetOptions || loadBudgetOptions;
    window.autoSelectExpenseBudget = window.autoSelectExpenseBudget || autoSelectExpenseBudget;
    window.resetExpenseBudgetSelectionState = window.resetExpenseBudgetSelectionState || resetExpenseBudgetSelectionState;
    window.markExpenseBudgetManuallySelected = window.markExpenseBudgetManuallySelected || markExpenseBudgetManuallySelected;
    window.setupAttachmentInputs = window.setupAttachmentInputs || setupAttachmentInputs;
    window.clearExpenseAttachmentState = window.clearExpenseAttachmentState || clearExpenseAttachmentState;
    window.clearSavingsAttachmentState = window.clearSavingsAttachmentState || clearSavingsAttachmentState;
    window.storeAttachmentFromInput = window.storeAttachmentFromInput || storeAttachmentFromInput;
    window.formatCurrency = window.formatCurrency || formatCurrency;
    window.addExpense = window.addExpense || addExpense;
    window.loadHistory = window.loadHistory || loadHistory;
    window.loadDashboard = window.loadDashboard || loadDashboard;
    window.resetForm = window.resetForm || resetForm;
    window.showToast = window.showToast || showToast;
}

function getSavingsSafe() {
    try {
        if (typeof getSavings === "function") return getSavings();
        return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
    } catch (err) {
        return [];
    }
}

function getUsedBudgetIdsFromExpense(entry) {
    if (!entry) return [];
    if (Array.isArray(entry.allocationTrail) && entry.allocationTrail.length) {
        return entry.allocationTrail
            .map(a => String(a && a.budgetId ? a.budgetId : ""))
            .filter(Boolean);
    }
    return entry.budgetId ? [String(entry.budgetId)] : [];
}

function intersectsSet(values, setObj) {
    return Array.isArray(values) && values.some(v => setObj.has(String(v)));
}

function summarizeDeleteImpact(plan) {
    let parts = [];
    if ((plan.childExpenses || []).length) parts.push(`${plan.childExpenses.length} linked transactions`);
    if ((plan.childSavings || []).length) parts.push(`${plan.childSavings.length} linked savings records`);
    if ((plan.childBudgets || []).length) parts.push(`${plan.childBudgets.length} linked budgets`);
    if ((plan.attachments || []).length) parts.push(`${plan.attachments.length} attachments`);
    return parts.length ? parts.join(", ") : "no dependent records";
}
// Which Budget Wallets are actually affected if these specific Savings
// entries get deleted — matched by the real budgetWalletId link on each
// funding transaction, not a wallet's own (now shared/ambiguous)
// sourceId field.
function getBudgetWalletsAffectedBySavingsIds(savingsIdSet, savingsList, budgetsList) {
    let affected = new Set();
    (Array.isArray(savingsList) ? savingsList : []).forEach(s => {
        if (!s || !s.budgetWalletId) return;
        if (!savingsIdSet.has(String(s.id))) return;
        let bid = String(s.budgetWalletId);
        let exists = (Array.isArray(budgetsList) ? budgetsList : []).some(b => String((b && (b.budgetId || b.id)) || "") === bid);
        if (exists) affected.add(bid);
    });
    return affected;
}

function validateTransactionDependencies(scope, ids, cascade) {
    let idSet = new Set((Array.isArray(ids) ? ids : [ids]).map(v => String(v)));
    let expenses = getExpenses();
    let savings = getSavingsSafe();
    let budgets = getBudgets();

    let expenseDelete = new Set();
    let savingsDelete = new Set();
    let budgetDelete = new Set();

    if (scope === "expense") {
        idSet.forEach(id => expenseDelete.add(id));

        let changed = true;
        while (changed) {
            changed = false;
            expenses.forEach(e => {
                let eid = String(e.id);
                if (expenseDelete.has(eid)) return;
                if (e.linkedTransactionId && expenseDelete.has(String(e.linkedTransactionId))) {
                    if (cascade) {
                        expenseDelete.add(eid);
                        changed = true;
                    }
                }
            });
        }

        savings.forEach(s => {
            if (s.linkedTransactionId && expenseDelete.has(String(s.linkedTransactionId))) {
                if (cascade) savingsDelete.add(String(s.id));
            }
        });
    }

    if (scope === "savings") {
        idSet.forEach(id => savingsDelete.add(id));

        let changed = true;
        while (changed) {
            changed = false;

            savings.forEach(s => {
                let sid = String(s.id);
                if (savingsDelete.has(sid)) return;

                let linked = s.linkedTransactionId && savingsDelete.has(String(s.linkedTransactionId));
                let sourced = s.sourceId && savingsDelete.has(String(s.sourceId));

                if (linked || sourced) {
                    if (cascade) {
                        savingsDelete.add(sid);
                        changed = true;
                    }
                }
            });

            // let deletedSourceIds = new Set([...savingsDelete]);

            // budgets.forEach(b => {
            //     if (!b || !b.sourceId) return;
            //     let bid = String(b.budgetId || b.id || "");
            //     if (!bid || budgetDelete.has(bid)) return;
            //     if (deletedSourceIds.has(String(b.sourceId)) && cascade) {
            //         budgetDelete.add(bid);
            //         changed = true;
            //     }
            // });

            expenses.forEach(e => {
                let eid = String(e.id);
                if (expenseDelete.has(eid)) return;

                let lineageHit =
                    (e.linkedSourceSavingsId && savingsDelete.has(String(e.linkedSourceSavingsId))) ||
                    intersectsSet(e.linkedSourceSavingsIds, savingsDelete) ||
                    (Array.isArray(e.transferBackTrail) && e.transferBackTrail.some(t => savingsDelete.has(String(t.sourceId))));

                let budgetHit = getUsedBudgetIdsFromExpense(e).some(bid => budgetDelete.has(String(bid)));

                let linkedHit = e.linkedTransactionId && expenseDelete.has(String(e.linkedTransactionId));

                if ((lineageHit || budgetHit || linkedHit) && cascade) {
                    expenseDelete.add(eid);
                    changed = true;
                }
            });
        }
    }

    let childExpenses = expenses
        .filter(e => {
            let eid = String(e.id);
            if (expenseDelete.has(eid) && idSet.has(eid)) return false;
            if (scope === "expense") {
                return e.linkedTransactionId && idSet.has(String(e.linkedTransactionId));
            }
            if (scope === "savings") {
                return (
                    (e.linkedSourceSavingsId && idSet.has(String(e.linkedSourceSavingsId))) ||
                    intersectsSet(e.linkedSourceSavingsIds, idSet) ||
                    (Array.isArray(e.transferBackTrail) && e.transferBackTrail.some(t => idSet.has(String(t.sourceId))))
                );
            }
            return false;
        })
        .map(e => String(e.id));

    let childSavings = savings
        .filter(s => {
            let sid = String(s.id);
            if (savingsDelete.has(sid) && idSet.has(sid)) return false;
            if (scope === "expense") {
                return s.linkedTransactionId && idSet.has(String(s.linkedTransactionId));
            }
            if (scope === "savings") {
                return (
                    (s.linkedTransactionId && idSet.has(String(s.linkedTransactionId))) ||
                    (s.sourceId && idSet.has(String(s.sourceId)))
                );
            }
            return false;
        })
        .map(s => String(s.id));

    // ⚠️ FIX: a Budget Wallet can be funded by several Savings entries
    // now, so "does this affect a budget" is answered by checking real
    // funding links, not a wallet's own sourceId.
    let childBudgets = scope === "savings"
        ? [...getBudgetWalletsAffectedBySavingsIds(idSet, savings, budgets)]
        : [];

    let attachments = [];
    expenses.forEach(e => { if (expenseDelete.has(String(e.id)) && e.attachmentId) attachments.push(String(e.attachmentId)); });
    savings.forEach(s => { if (savingsDelete.has(String(s.id)) && s.attachmentId) attachments.push(String(s.attachmentId)); });

    let blocked = !cascade && (childExpenses.length > 0 || childSavings.length > 0 || childBudgets.length > 0);

    return {
        blocked,
        scope,
        rootIds: [...idSet],
        childExpenses,
        childSavings,
        childBudgets,
        attachments,
        expensesToDelete: [...expenseDelete],
        savingsToDelete: [...savingsDelete],
        budgetsToDelete: [...budgetDelete],
        summary: summarizeDeleteImpact({ childExpenses, childSavings, childBudgets, attachments })
    };
}

async function executeDeletePlan(plan) {
    if (!plan) return;

    let expenseIds = new Set((plan.expensesToDelete || []).map(String));
    let savingsIds = new Set((plan.savingsToDelete || []).map(String));
    let budgetIds = new Set((plan.budgetsToDelete || []).map(String));

    let expenses = getExpenses();
    let savings = getSavingsSafe();
    let budgets = getBudgets();

    let removedSavings = savings.filter(s => savingsIds.has(String(s.id)));

    if (expenseIds.size) {
        expenses = expenses.filter(e => !expenseIds.has(String(e.id)));
    }
    if (savingsIds.size) {
        savings = savings.filter(s => !savingsIds.has(String(s.id)));
    }
    if (budgetIds.size) {
        budgets = budgets.filter(b => !budgetIds.has(String(b.budgetId || b.id || "")));
    }

    if (removedSavings.length && typeof adjustBudgetAfterDelete === "function") {
        removedSavings.forEach(entry => {
            if (entry && entry.budgetWalletId) {
                try { adjustBudgetAfterDelete(entry); } catch (e) { }
            }
        });
    }

    saveExpenses(expenses);
    if (typeof saveSavings === "function") {
        saveSavings(savings);
    } else {
        localStorage.setItem("savingsTransactions", JSON.stringify(savings));
    }
    saveBudgets(budgets);

    let at = window.reMoAttachments || window.reMoAttachmentsIndexed;
    if (at && at.remove) {
        for (let aid of (plan.attachments || [])) {
            try { await at.remove(aid); } catch (e) { }
        }
    }
}

function validateLookupDeletion(type, value) {
    let expenses = getExpenses();
    let savings = getSavingsSafe();
    let budgets = getBudgets();
    let needle = String(value || "").trim();
    if (!needle) return { blocked: false, summary: "" };

    if (type === "category") {
        let expenseHits = expenses.filter(e => String(e.category || "") === needle).length;
        let savingsHits = savings.filter(s => String(s.entity || "") === needle).length;
        let budgetHits = budgets.filter(b => String(b.entity || "") === needle).length;
        let total = expenseHits + savingsHits + budgetHits;
        return {
            blocked: total > 0,
            summary: `${total} records use this category (${expenseHits} expenses, ${savingsHits} savings, ${budgetHits} budgets).`
        };
    }

    if (type === "person") {
        let savingsHits = savings.filter(s => String(s.person || "") === needle).length;
        let total = savingsHits;
        return {
            blocked: total > 0,
            summary: `${total} records use this person (${savingsHits} savings transfers).`
        };
    }

    return { blocked: false, summary: "" };
}

function validateBudgetPeriodDeletion(periodId) {
    let bp = JSON.parse(localStorage.getItem("bp")) || [];
    let item = bp.find(x => String(x.id) === String(periodId));
    if (!item) return { blocked: false, summary: "" };

    let budgets = getBudgets();
    let expenses = getExpenses();
    let savings = getSavingsSafe();

    let start = String(item.start || "");
    let explicitKey = `${item.start}_to_${item.end}`;

    let budgetHits = budgets.filter(b => {
        let key = String(b.periodKey || "");
        return key === explicitKey || key.startsWith(`${start}_to_`);
    }).length;

    let expenseHits = expenses.filter(e => {
        let key = String(e.periodKey || "");
        return key && key.startsWith(`${start}_to_`);
    }).length;

    let savingsHits = savings.filter(s => {
        let key = String(s.periodKey || "");
        return key && key.startsWith(`${start}_to_`);
    }).length;

    let total = budgetHits + expenseHits + savingsHits;
    return {
        blocked: total > 0,
        summary: `${total} records belong to this period (${budgetHits} budgets, ${expenseHits} expenses, ${savingsHits} savings).`
    };
}

function parsePeriodKey(periodKey) {
    let key = String(periodKey || "");
    let parts = key.split("_to_");
    if (parts.length !== 2) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parts[0]) || !/^\d{4}-\d{2}-\d{2}$/.test(parts[1])) return null;
    return { start: parts[0], end: parts[1] };
}

function ensureBudgetPeriodExists(periods, periodKey) {
    let parsed = parsePeriodKey(periodKey);
    if (!parsed) return;

    let exists = periods.some(p => String(p.start) === parsed.start && String(p.end) === parsed.end);
    if (exists) return;

    periods.push({
        id: Date.now() + Math.floor(Math.random() * 1000),
        start: parsed.start,
        end: parsed.end,
        status: "closed",
        extraDays: 0,
        autoRecovered: true
    });
}

function repairDataIntegrity() {
    let expenses = getExpenses();
    let savings = getSavingsSafe();
    let budgets = getBudgets();
    let periods = JSON.parse(localStorage.getItem("bp")) || [];

    let report = {
        createdSources: 0,
        createdBudgets: 0,
        createdPeriods: 0,
        relinkedSavingsBudgetAllocations: 0,
        relinkedExpenseParents: 0,
        relinkedSavingsParents: 0,
        normalizedExpensePeriodKeys: 0,
        normalizedExpenseMonthKeys: 0,
        normalizedExpenseBudgetLinks: 0,
        removedOrphanExpenses: 0,
        removedOrphanSavings: 0
    };

    let savingsById = new Map(savings.map(s => [String(s.id), s]));
    let budgetById = new Map(budgets.map(b => [String(b.budgetId || b.id), b]));
    let expenseById = new Map(expenses.map(e => [String(e.id), e]));

    function createPlaceholderSource(sourceId) {
        if (!sourceId || savingsById.has(String(sourceId))) return;
        let now = new Date().toISOString();
        let entry = {
            id: String(sourceId),
            type: "income",
            amount: 0,
            sourceId: null,
            entity: "Recovered Source",
            paymentType: "Unknown",
            person: null,
            note: `Auto recovered source ${sourceId}`,
            date: now,
            monthKey: now.slice(0, 7),
            periodKey: null,
            createdAt: now,
            updatedAt: now,
            attachmentId: null,
            autoRecovered: true
        };
        savings.push(entry);
        savingsById.set(String(entry.id), entry);
        report.createdSources += 1;
    }

    function createPlaceholderBudget(budgetId, periodKey, sourceId) {
        if (!budgetId || budgetById.has(String(budgetId))) return;
        let now = new Date().toISOString();
        let b = {
            id: Date.now() + Math.floor(Math.random() * 1000),
            type: "budget",
            budgetId: String(budgetId),
            sourceId: sourceId ? String(sourceId) : "recovered_source",
            totalAllocated: 0,
            entity: "Recovered Budget",
            note: "Auto recovered budget link",
            date: now,
            periodKey: periodKey || null,
            monthKey: periodKey ? null : now.slice(0, 7),
            createdAt: now,
            updatedAt: now,
            autoRecovered: true
        };
        budgets.push(b);
        budgetById.set(String(b.budgetId), b);
        report.createdBudgets += 1;
    }

    // Ensure periods for budget/savings keys.
    budgets.forEach(b => {
        if (b && b.periodKey) {
            let before = periods.length;
            ensureBudgetPeriodExists(periods, b.periodKey);
            if (periods.length > before) report.createdPeriods += 1;
        }
    });
    savings.forEach(s => {
        if (s && s.periodKey) {
            let before = periods.length;
            ensureBudgetPeriodExists(periods, s.periodKey);
            if (periods.length > before) report.createdPeriods += 1;
        }
    });

    // Savings source links.
    savings.forEach(s => {
        if (s && s.sourceId && !savingsById.has(String(s.sourceId))) {
            createPlaceholderSource(String(s.sourceId));
        }
    });

    // Budget source links.
    budgets.forEach(b => {
        if (b && b.sourceId && !savingsById.has(String(b.sourceId))) {
            createPlaceholderSource(String(b.sourceId));
        }
    });

    // Expense budget links (including allocation trail).
    expenses.forEach(e => {
        let periodKey = e.periodKey || null;
        if (e.budgetId && !budgetById.has(String(e.budgetId))) {
            createPlaceholderBudget(String(e.budgetId), periodKey, null);
        }

        if (Array.isArray(e.allocationTrail)) {
            e.allocationTrail.forEach(a => {
                if (a && a.budgetId && !budgetById.has(String(a.budgetId))) {
                    createPlaceholderBudget(String(a.budgetId), periodKey, null);
                }
            });
        }
    });

    // Normalize missing expense period/month keys and align dependent budget links.
    expenses.forEach(e => {
        if (!e || typeof e !== "object") return;

        if (!e.monthKey && e.date) {
            e.monthKey = String(e.date).slice(0, 7);
            report.normalizedExpenseMonthKeys += 1;
        }

        if (!e.periodKey) {
            let fromBudget = e.budgetId ? budgetById.get(String(e.budgetId)) : null;
            if (fromBudget && fromBudget.periodKey) {
                e.periodKey = fromBudget.periodKey;
                report.normalizedExpensePeriodKeys += 1;
            } else if (e.date && Array.isArray(periods) && periods.length) {
                let ts = new Date(e.date).getTime();
                let hit = periods.find(p => {
                    if (!p || !p.start || !p.end) return false;
                    let startTs = new Date(`${p.start}T00:00:00`).getTime();
                    let endTs = new Date(`${p.end}T23:59:59`).getTime();
                    return Number.isFinite(ts) && ts >= startTs && ts <= endTs;
                });
                if (hit) {
                    e.periodKey = `${hit.start}_to_${hit.end}`;
                    report.normalizedExpensePeriodKeys += 1;
                }
            }
        }

        if (e.linkedTransactionId) {
            let parent = expenseById.get(String(e.linkedTransactionId));
            if (parent && parent.budgetId && e.budgetId !== parent.budgetId) {
                e.budgetId = parent.budgetId;
                report.normalizedExpenseBudgetLinks += 1;
            }
        }
    });

    // Relink savings budget allocations with unresolved target budget ids.
    savings.forEach(s => {
        if (!s || s.type !== "budget_allocation") return;
        let current = String(s.targetBudgetId || "");
        if (current && current !== "__auto__" && budgetById.has(current)) return;

        let candidate = budgets.find(b => {
            if (!b) return false;
            if (s.periodKey && b.periodKey !== s.periodKey) return false;
            return String(b.sourceId || "") === String(s.sourceId || "");
        });

        if (!candidate) {
            candidate = budgets.find(b => b && String(b.sourceId || "") === String(s.sourceId || ""));
        }

        if (candidate) {
            s.targetBudgetId = candidate.budgetId || candidate.id;
            s.budgetWalletId = candidate.budgetId || candidate.id;
            report.relinkedSavingsBudgetAllocations += 1;
        }
    });

    // Expense linkedTransaction integrity: remove unresolved dependents if no parent exists.
    let validExpenseIds = new Set(expenses.map(e => String(e.id)));
    expenses = expenses.filter(e => {
        if (!e.linkedTransactionId) return true;
        if (validExpenseIds.has(String(e.linkedTransactionId))) return true;
        report.removedOrphanExpenses += 1;
        return false;
    });

    // Savings linkedTransaction integrity.
    let validSavingsIds = new Set(savings.map(s => String(s.id)));
    savings = savings.filter(s => {
        if (!s.linkedTransactionId) return true;
        let id = String(s.linkedTransactionId);
        if (validSavingsIds.has(id) || expenses.some(e => String(e.id) === id)) return true;
        report.removedOrphanSavings += 1;
        return false;
    });

    saveExpenses(expenses);
    if (typeof saveSavings === "function") saveSavings(savings); else localStorage.setItem("savingsTransactions", JSON.stringify(savings));
    saveBudgets(budgets);
    localStorage.setItem("bp", JSON.stringify(periods));

    return report;
}

function runIntegrityRepairSilently() {
    try {
        return repairDataIntegrity();
    } catch (err) {
        console.warn("repairDataIntegrity failed", err);
        return null;
    }
}

if (typeof window !== "undefined") {
    window.validateDependencies = function validateDependencies(transactionId, scope = "expense", mode = "safe") {
        return validateTransactionDependencies(scope, [transactionId], mode === "cascade");
    };
    window.validateTransactionDependencies = validateTransactionDependencies;
    window.executeDeletePlan = executeDeletePlan;
    window.validateLookupDeletion = validateLookupDeletion;
    window.validateBudgetPeriodDeletion = validateBudgetPeriodDeletion;
    window.repairDataIntegrity = repairDataIntegrity;
}


/* =========================
   🧠 CORE LOGIC
========================= */

// ➕ Add Expense

function addExpense(obj) {

    try {

        let expenses = getExpenses();

        let type =
            obj.type ||
            (obj.amount < 0 ? "expense" : "income");

        let category =
            obj.category || "Others";

        // =========================
        // 💱 BASE CONVERSION
        // =========================
        let baseAmount =
            convertToBase(obj.amount);

        // =========================
        // 📅 SAFE DATE
        // =========================
        let finalDate =
            obj.date ||
            new Date().toISOString();

        let dateObj =
            new Date(finalDate);

        // =========================
        // 📦 MONTH KEY
        // =========================
        let monthKey = [
            dateObj.getFullYear(),
            String(dateObj.getMonth() + 1)
                .padStart(2, "0")
        ].join("-");

        // =========================
        // 🧠 ENTRY
        // =========================
        let newEntry = {

            id:
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : "exp_" + Date.now() + "_" + Math.random(),

            type,

            amount: baseAmount,

            category,

            purpose:
                obj.purpose || "",

            budgetId:
                obj.budgetId || null,

            paymentType:
                obj.paymentType ||
                obj.entity ||
                "Cash",

            entity:
                obj.entity ||
                obj.paymentType ||
                "Cash",

            person:
                obj.person ||
                null,

            date: finalDate,

            monthKey,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString(),

            splitId: obj.splitId || null,
            splitIndex: obj.splitIndex || null,
            isSplit: obj.isSplit || false,
            linkedTransactionId: obj.linkedTransactionId || null,
            refundType: (type === "refund" || obj.refundType) ? normalizeRefundType(obj.refundType) : null,
            resolutionType: obj.resolutionType ? normalizeResolutionType(obj.resolutionType) : null,
            resolvedAmount: Number(obj.resolvedAmount || 0),
            lossAmount: Number(obj.lossAmount || 0),

            // deep-clone allocationTrail if provided; otherwise, if budgetId provided for expense/loss,
            // create a single allocation entry for backward compatibility
            allocationTrail: obj.allocationTrail && Array.isArray(obj.allocationTrail)
                ? JSON.parse(JSON.stringify(obj.allocationTrail))
                : ((obj.budgetId && (type === "expense" || type === "loss"))
                    ? [{ budgetId: obj.budgetId, amount: Math.abs(baseAmount) }]
                    : [])
            ,
            transferBackTrail: Array.isArray(obj.transferBackTrail)
                ? JSON.parse(JSON.stringify(obj.transferBackTrail))
                : [],
            linkedSourceSavingsId: obj.linkedSourceSavingsId || null,
            linkedSourceSavingsIds: Array.isArray(obj.linkedSourceSavingsIds)
                ? obj.linkedSourceSavingsIds.map(String)
                : [],
            attachmentId: obj.attachmentId || null,
            attachmentStatus: obj.attachmentStatus || (obj.attachmentId ? "linked" : "none"),
            attachmentError: obj.attachmentError || null
        };

        expenses.push(newEntry);

        saveExpenses(expenses);

        return newEntry;

    } catch (err) {

        console.error("addExpense error:", err);

        return null;
    }
}


// ❌ Delete Expense
// function deleteExpenseByIndex(index) {

//     try {
//         let expenses = getExpenses();

//         if (index < 0 || index >= expenses.length) return;

//         expenses.splice(index, 1);

//         saveExpenses(expenses);


//     } catch (err) {
//     }
// }



// 📊 Budget Balance
function getBudgetBalance(budgetId) {
    // Use net-spent helper to correctly account for allocationTrail and recoveries
    let budgets = getBudgets();

    let allocated = budgets
        .filter(b => b.budgetId === budgetId)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let spent = getNetSpentForBudget(budgetId);

    return allocated - spent;
}

// Returns net spent amount for a budget (expenses minus recoveries),
// correctly handling `allocationTrail` entries when present.
function getNetSpentForBudget(budgetId, expensesList) {
    let expenses = Array.isArray(expensesList) ? expensesList : getExpenses();

    let net = 0;

    for (let e of expenses) {

        let contrib = 0;

        if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
            for (let a of e.allocationTrail) {
                if (String(a.budgetId) === String(budgetId)) {
                    contrib += Math.abs(a.amount || 0);
                }
            }
        } else if (String(e.budgetId) === String(budgetId)) {
            contrib += Math.abs(e.amount || 0);
        }

        if (!contrib) continue;

        // Inflows increase available budget (reduce net spent).
        if (e.type === 'recovery' || e.type === 'refund' || e.type === 'income' || e.type === 'budget_income') {
            net -= contrib;
        }
        // Budget outflows consume capacity (increase net spent).
        else if (e.type === 'transfer_back' || e.amount < 0 || e.type === 'expense' || e.type === 'loss' || e.type === 'transfer') {
            net += contrib;
        }
        // Fallback: positive unknown types are treated as inflow.
        else if (Number(e.amount || 0) > 0) {
            net -= contrib;
        }
    }

    return roundCurrency(net);
}

// "Real" spending only — excludes Adjustment entries, since a correction
// isn't the same thing as spending. getNetSpentForBudget stays untouched
// on purpose: Remaining-balance math everywhere else in the app already
// correctly factors adjustments in, and shouldn't be disturbed.
function getRealSpentForBudget(budgetId, expensesList) {
    let expenses = Array.isArray(expensesList) ? expensesList : getExpenses();
    let net = 0;

    for (let e of expenses) {
        if (!e || e.type === "adjustment") continue;

        let contrib = 0;
        if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
            for (let a of e.allocationTrail) {
                if (String(a.budgetId) === String(budgetId)) {
                    contrib += Math.abs(a.amount || 0);
                }
            }
        } else if (String(e.budgetId) === String(budgetId)) {
            contrib += Math.abs(e.amount || 0);
        }

        if (!contrib) continue;

        if (e.type === 'recovery' || e.type === 'refund' || e.type === 'income' || e.type === 'budget_income') {
            net -= contrib;
        } else if (e.type === 'transfer_back' || e.amount < 0 || e.type === 'expense' || e.type === 'loss' || e.type === 'transfer') {
            net += contrib;
        } else if (Number(e.amount || 0) > 0) {
            net -= contrib;
        }
    }

    return roundCurrency(net);
}

// Net Adjustment total for a Budget Wallet, signed — negative means
// corrected downward, positive means corrected upward.
function getNetAdjustmentForBudget(budgetId, expensesList) {
    let expenses = Array.isArray(expensesList) ? expensesList : getExpenses();
    let net = 0;

    for (let e of expenses) {
        if (!e || e.type !== "adjustment") continue;

        let contrib = 0;
        if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
            for (let a of e.allocationTrail) {
                if (String(a.budgetId) === String(budgetId)) {
                    contrib += Math.abs(Number(a.amount) || 0);
                }
            }
        } else if (String(e.budgetId) === String(budgetId)) {
            contrib += Math.abs(Number(e.amount) || 0);
        }

        if (!contrib) continue;
        net += Number(e.amount || 0) < 0 ? -contrib : contrib;
    }

    return roundCurrency(net);
}

function getNetSpentForBudgetSet(budgetIds, expensesList) {
    let ids = Array.isArray(budgetIds) ? budgetIds.map(id => String(id)) : [];
    if (!ids.length) return 0;

    return ids.reduce((sum, budgetId) => {
        return sum + Math.max(0, getNetSpentForBudget(budgetId, expensesList));
    }, 0);
}

function getBudgetContributionForEntry(entry, budgetIdSet) {
    if (!entry || !budgetIdSet || !budgetIdSet.size) return 0;

    if (Array.isArray(entry.allocationTrail) && entry.allocationTrail.length) {
        return entry.allocationTrail
            .filter(item => budgetIdSet.has(String(item.budgetId)))
            .reduce((sum, item) => sum + Math.abs(Number(item.amount) || 0), 0);
    }

    if (budgetIdSet.has(String(entry.budgetId))) {
        return Math.abs(Number(entry.amount) || 0);
    }

    return 0;
}

function summarizeBudgetLedgerFlows(budgetIds, expensesList) {
    let ids = Array.isArray(budgetIds) ? budgetIds.map(id => String(id)) : [];
    let set = new Set(ids);
    let expenses = Array.isArray(expensesList) ? expensesList : [];

    let summary = {
        income: 0,
        refundImpact: 0,
        transferBackImpact: 0,
        resolutionImpact: 0
    };

    expenses.forEach((entry) => {
        let contribution = getBudgetContributionForEntry(entry, set);
        if (!contribution) return;

        if (entry.type === "income" || entry.type === "budget_income" || entry.type === "recovery") {
            summary.income += contribution;
        }

        if (entry.type === "refund") {
            summary.refundImpact += contribution;
            summary.income += contribution;
        }

        if (entry.type === "transfer_back") {
            summary.transferBackImpact += contribution;
        }

        if (entry.type === "expense_resolution") {
            summary.resolutionImpact += Math.abs(Number(entry.lossAmount || 0));
        }
    });

    return summary;
}


/* =========================
   🔔 SIMPLE TOAST (NO SPAM)
========================= */


let toastTimeout;

function showToast(msg) {

    try {

        clearTimeout(toastTimeout);

        let el = document.getElementById("toast");

        if (!el) {

            el = document.createElement("div");
            el.id = "toast";

            document.body.appendChild(el);
        }

        el.innerText = msg;

        // ✅ show
        el.classList.add("show-toast");

        // ✅ auto hide
        toastTimeout = setTimeout(() => {

            el.classList.remove("show-toast");

        }, 1500);

    } catch (err) {

        console.error(err);
    }
}

// Unified in-app dialog helper to avoid browser-native alert/confirm/prompt overlays.
if (!window.AppDialog) {
    window.AppDialog = (function createAppDialog() {
        let overlay = null;

        function ensureDialog() {
            if (overlay) {
                return overlay;
            }

            overlay = document.createElement("div");
            overlay.id = "appDialogOverlay";
            overlay.className = "modal hidden";
            overlay.innerHTML = `
                <div class="modal-content" role="dialog" aria-modal="true" onclick="event.stopPropagation()">
                    <h3 id="appDialogTitle">Notice</h3>
                    <p id="appDialogMessage" class="modal-sub"></p>
                    <input id="appDialogInput" type="text" class="hidden" />
                    <div id="appDialogActions" class="modal-actions"></div>
                </div>
            `;
            overlay.addEventListener("click", () => hideDialog());
            document.body.appendChild(overlay);
            return overlay;
        }

        function hideDialog() {
            if (!overlay) return;
            overlay.classList.add("hidden");
            overlay.style.display = "none";
        }

        function showDialog(config) {
            return new Promise((resolve) => {
                let host = ensureDialog();
                let titleEl = host.querySelector("#appDialogTitle");
                let msgEl = host.querySelector("#appDialogMessage");
                let inputEl = host.querySelector("#appDialogInput");
                let actionsEl = host.querySelector("#appDialogActions");

                titleEl.textContent = String(config.title || "Notice");
                msgEl.textContent = String(config.message || "");

                actionsEl.innerHTML = "";

                if (config.type === "prompt") {
                    inputEl.classList.remove("hidden");
                    inputEl.value = String(config.defaultValue || "");
                    inputEl.focus();
                } else {
                    inputEl.classList.add("hidden");
                    inputEl.value = "";
                }

                function finalize(value) {
                    hideDialog();
                    resolve(value);
                }

                if (config.type === "alert") {
                    let okBtn = document.createElement("button");
                    okBtn.className = "primary";
                    okBtn.type = "button";
                    okBtn.textContent = "OK";
                    okBtn.addEventListener("click", () => finalize(true));
                    actionsEl.appendChild(okBtn);
                } else if (config.type === "confirm") {
                    let cancelBtn = document.createElement("button");
                    cancelBtn.className = "secondary";
                    cancelBtn.type = "button";
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.addEventListener("click", () => finalize(false));

                    let okBtn = document.createElement("button");
                    okBtn.className = "primary";
                    okBtn.type = "button";
                    okBtn.textContent = "Continue";
                    okBtn.addEventListener("click", () => finalize(true));

                    actionsEl.appendChild(cancelBtn);
                    actionsEl.appendChild(okBtn);
                } else {
                    let cancelBtn = document.createElement("button");
                    cancelBtn.className = "secondary";
                    cancelBtn.type = "button";
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.addEventListener("click", () => finalize(null));

                    let saveBtn = document.createElement("button");
                    saveBtn.className = "primary";
                    saveBtn.type = "button";
                    saveBtn.textContent = "Save";
                    saveBtn.addEventListener("click", () => finalize(String(inputEl.value || "")));

                    actionsEl.appendChild(cancelBtn);
                    actionsEl.appendChild(saveBtn);
                }

                host.classList.remove("hidden");
                host.style.display = "flex";
            });
        }

        return {
            alert: function (message, title) {
                return showDialog({ type: "alert", title: title || "Notice", message: message || "" });
            },
            confirm: function (message, title) {
                return showDialog({ type: "confirm", title: title || "Confirm", message: message || "" });
            },
            prompt: function (message, defaultValue, title) {
                return showDialog({ type: "prompt", title: title || "Input", message: message || "", defaultValue: defaultValue || "" });
            }
        };
    }());
}



/* =========================
   🖥️ UI FUNCTIONS
========================= */

// 📜 Load History
function loadHistory(list = getExpenses()) {

    try {
        let sourceList = Array.isArray(list) ? list : [];
        let queryResult = (window.SearchService && typeof window.SearchService.applyModuleSearch === "function")
            ? window.SearchService.applyModuleSearch("expenses", sourceList)
            : { results: sourceList };
        let finalList = Array.isArray(queryResult.results) ? queryResult.results : sourceList;

        currentFilteredExpenses = finalList;
        syncExpenseHistorySearchInput();
        updateExpenseSortIndicator();
        renderExpenseQueryChips();
        updateFilteredViewActiveIndicator();

        let container = document.getElementById("historyList");
        if (!container) return;

        container.innerHTML = "";

        if (!finalList.length) {
            container.innerHTML = `<p class="empty-state">No data yet</p>`;
            return;
        }

        let withRunning = rebalanceExpenseLedger(finalList, getBudgets());
        withRunning.forEach((e) => {

            let div = document.createElement("div");
            div.className = "expense-item transaction-card";

            let entryType = String(e.type || "entry").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
            let amount = formatCurrency(Math.abs(Number(e.amount || 0)));
            let amountClass = e.amount < 0 ? "negative" : "positive";
            let date = new Date(e.date).toLocaleString("en-IN");
            let runningBalance = formatCurrency(Number(e.BalanceAfterTransaction ?? e.runningBalance ?? 0));
            let descriptorParts = [e.category, e.purpose].filter(Boolean);
            if (e.type === "refund") descriptorParts.push(`Refund Type: ${formatRefundType(e.refundType)}`);
            if (e.resolutionType) descriptorParts.push(`Resolution: ${RESOLUTION_TYPE_LABELS[normalizeResolutionType(e.resolutionType)] || e.resolutionType}`);
            let descriptor = descriptorParts.join(" • ");
            let sourceText = e.entity || e.paymentType || "Wallet";

            div.innerHTML = `
                <div class="transaction-card-head">
                    <div class="history-type">${escapeHtml(entryType)}</div>
                    ${descriptor ? `<div class="transaction-title">${escapeHtml(descriptor)}</div>` : ""}
                </div>

                <div class="transaction-meta-grid">
                    <span class="entry-label">Source</span>
                    <span class="entry-value">${escapeHtml(sourceText)}</span>
                    <span class="entry-label">Date</span>
                    <span class="entry-value">${escapeHtml(date)}</span>
                    <span class="entry-label">Running Balance</span>
                    <span class="entry-value">${escapeHtml(runningBalance)}</span>
                </div>

                <div class="transaction-card-foot">
                    <div class="history-amount ${amountClass}">${escapeHtml(amount)}</div>
                    <div class="history-actions">
                        <button class="delete-btn" onclick="event.stopPropagation(); deleteExpenseUI('${e.id}')" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"></path>
                                <path d="M8 6V4h8v2"></path>
                                <path d="M19 6l-1 14H6L5 6"></path>
                                <path d="M10 11v6"></path>
                                <path d="M14 11v6"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            div.addEventListener("click", () => openTransactionAuditDetails("expense", e));

            container.appendChild(div);
        });

    } catch (err) {
        console.error("History error:", err);
    }
}

function syncExpenseHistorySearchInput() {
    let input = document.getElementById("historySearchInput");
    if (!input || !window.SearchService || typeof window.SearchService.getState !== "function") {
        return;
    }
    let state = window.SearchService.getState("expenses");
    let text = String((state.search && state.search.text) || "");
    if (input.value !== text) {
        input.value = text;
    }
}

function onExpenseHistorySearchInput(value) {
    if (!window.SearchService) {
        return;
    }
    if (typeof window.SearchService.scheduleSearch === "function") {
        window.SearchService.scheduleSearch("expenses", String(value || ""), null, 120, function () {
            loadHistory(getExpenses());
        });
        return;
    }
    if (typeof window.SearchService.setSearchText === "function") {
        window.SearchService.setSearchText("expenses", String(value || ""));
        loadHistory(getExpenses());
    }
}


async function deleteExpenseUI(id) {

    try {

        let expenses = getExpenses();

        let entry = getExpenses().find(e => String(e.id) === String(id));

        if (!entry) return;

        let rootIds = entry.splitId
            ? expenses.filter(e => e.splitId === entry.splitId).map(e => String(e.id))
            : [String(entry.id)];

        let safePlan = validateTransactionDependencies("expense", rootIds, false);
        if (safePlan.blocked) {
            let proceed = await window.AppDialog.confirm(
                `Cannot delete because dependent records exist (${safePlan.summary}).\n\n` +
                `Use cascade delete and remove all dependents as well?`
            );
            if (!proceed) return;

            let cascadePlan = validateTransactionDependencies("expense", rootIds, true);
            await executeDeletePlan(cascadePlan);

            loadHistory();
            loadDashboard();
            loadGraph();
            renderBudgetEntries();
            loadBudgetOptions();
            if (typeof loadSavings === "function") loadSavings();

            showToast("Deleted with dependents");
            return;
        }

        let safeDeleteSet = new Set(rootIds.map(String));
        expenses = expenses.filter(e => !safeDeleteSet.has(String(e.id)));

        saveExpenses(expenses);

        loadHistory();
        loadDashboard();
        loadGraph();
        renderBudgetEntries();
        resetExpenseBudgetSelectionState();
        loadBudgetOptions();

        showToast("Deleted");

    } catch (err) {

        console.error(err);
    }
}


/* =========================
   ➕ FORM HANDLER
========================= */

function getLinkedPendingAmount(originalId, linkedTypes) {
    let expenses = getExpenses();
    let original = expenses.find(e => String(e.id) === String(originalId));
    if (!original) return 0;

    let originalAmount = Math.abs(Number(original.amount) || 0);
    let settled = expenses
        .filter(e => linkedTypes.includes(e.type) && String(e.linkedTransactionId) === String(originalId))
        .reduce((sum, e) => sum + Math.abs(Number(e.amount) || 0), 0);

    return Math.max(0, originalAmount - settled);
}

const REFUND_TYPE_LABELS = {
    refund: "Refund",
    correction: "Correction",
    recovery: "Recovery",
    cancellation: "Cancellation",
    custom: "Custom"
};

const RESOLUTION_TYPE_LABELS = {
    open: "Open",
    partially_refunded: "Partially Refunded",
    fully_refunded: "Fully Refunded",
    cancelled_with_charges: "Cancelled With Charges",
    consumed: "Consumed",
    written_off: "Written Off",
    settled: "Settled"
};

function normalizeRefundType(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "custom";

    const mapped = {
        refund: "refund",
        refunded: "refund",
        product_return: "refund",
        return: "refund",
        returned: "refund",
        cashback: "refund",
        bank_reversal: "refund",
        reversal: "refund",

        correction: "correction",
        transfer_correction: "correction",
        adjustment: "correction",
        salary_adjustment: "correction",
        adjustment_entry: "correction",
        adjustment_entries: "correction",
        correction_entry: "correction",
        correction_entries: "correction",

        recovery: "recovery",
        expense_recovery: "recovery",
        reimbursement: "recovery",
        loan_recovery: "recovery",

        cancellation: "cancellation",
        cancelled: "cancellation",
        ticket_cancellation: "cancellation",
        booking_cancellation: "cancellation",
        order_cancellation: "cancellation",

        custom: "custom"
    };

    return mapped[raw] || "custom";
}

function formatRefundType(value) {
    const key = normalizeRefundType(value);
    return REFUND_TYPE_LABELS[key] || "Custom";
}

function normalizeResolutionType(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (!raw) return "open";

    const mapped = {
        open: "open",
        partial_refund: "partially_refunded",
        partially_refunded: "partially_refunded",
        part_refund: "partially_refunded",
        complete_refund: "fully_refunded",
        fully_refunded: "fully_refunded",
        cancelled_with_charges: "cancelled_with_charges",
        consumed: "consumed",
        written_off: "written_off",
        settled: "settled"
    };

    return mapped[raw] || "open";
}

function resolveRefundLinkTargets(snapshotOrOriginal, fallbackBudgetId = null) {
    const original = snapshotOrOriginal && snapshotOrOriginal.original
        ? snapshotOrOriginal.original
        : snapshotOrOriginal || null;

    const sourceCandidates = [];
    if (original && Array.isArray(original.linkedSourceSavingsIds) && original.linkedSourceSavingsIds.length) {
        original.linkedSourceSavingsIds.forEach(id => {
            if (id !== undefined && id !== null && id !== "") sourceCandidates.push(String(id));
        });
    }
    if (original && original.linkedSourceSavingsId) sourceCandidates.push(String(original.linkedSourceSavingsId));
    if (original && original.sourceId) sourceCandidates.push(String(original.sourceId));
    if (original && original.linkedSourceId) sourceCandidates.push(String(original.linkedSourceId));
    if (original && original.budgetWalletSourceId) sourceCandidates.push(String(original.budgetWalletSourceId));
    if (original && original.source) sourceCandidates.push(String(original.source));
    if (original && original.entity) sourceCandidates.push(String(original.entity));

    const uniqueSources = [...new Set(sourceCandidates.filter(Boolean))];

    return {
        budgetId: (original && (original.budgetId || original.targetBudgetId || original.linkedBudgetId)) || fallbackBudgetId || null,
        linkedSourceSavingsId: uniqueSources[0] || null,
        linkedSourceSavingsIds: uniqueSources,
        sourceIds: uniqueSources
    };
}

function getExpenseResolutionSnapshot(originalId, expensesList) {
    let expenses = Array.isArray(expensesList) ? expensesList : getExpenses();
    let original = expenses.find(e => String(e.id) === String(originalId));
    if (!original) {
        return {
            exists: false,
            original: null,
            originalAmount: 0,
            refunded: 0,
            loss: 0,
            remainingRefundable: 0,
            status: "UNKNOWN",
            closureType: null
        };
    }

    let originalAmount = Math.abs(Number(original.amount || 0));
    let linked = expenses.filter(e => String(e.linkedTransactionId) === String(originalId));

    let refunded = linked
        .filter(e => e.type === "refund")
        .reduce((sum, e) => sum + Math.abs(Number(e.amount || 0)), 0);

    let closure = linked
        .filter(e => e.type === "expense_resolution")
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
        .pop() || null;

    let unresolved = Math.max(0, originalAmount - refunded);
    let closureType = closure ? normalizeResolutionType(closure.resolutionType) : null;

    let status = "OPEN";
    if (closureType === "consumed") {
        status = "CONSUMED";
    } else if (closureType === "cancelled_with_charges") {
        status = "CANCELLED_WITH_CHARGES";
    } else if (closureType === "written_off") {
        status = "WRITTEN_OFF";
    } else if (closureType === "settled") {
        status = "SETTLED";
    } else if (refunded >= originalAmount && originalAmount > 0) {
        status = "FULLY_REFUNDED";
    } else if (refunded > 0 && refunded < originalAmount) {
        status = "PARTIALLY_REFUNDED";
    }

    let remainingRefundable = (status === "CONSUMED" || status === "CANCELLED_WITH_CHARGES" || status === "WRITTEN_OFF" || status === "SETTLED")
        ? 0
        : unresolved;

    return {
        exists: true,
        original,
        originalAmount,
        refunded,
        loss: unresolved,
        remainingRefundable,
        status,
        closureType
    };
}

function formatResolutionStatus(status) {
    let map = {
        SETTLED: "Settled",
        FULLY_REFUNDED: "Fully Refunded",
        PARTIALLY_REFUNDED: "Partially Refunded",
        CONSUMED: "Consumed",
        WRITTEN_OFF: "Written Off",
        CANCELLED_WITH_CHARGES: "Cancelled With Charges",
        OPEN: "Open"
    };
    return map[status] || status || "-";
}

function getRefundTypeGuidance(refundType) {
    const key = normalizeRefundType(refundType);
    const guidance = {
        refund: "Money returned from returns, cashback, or bank reversals.",
        correction: "Correction entry for an earlier accounting or transfer mistake.",
        recovery: "Money recovered from prior expenses or receivables.",
        cancellation: "Money returned because a booking/order was cancelled.",
        custom: "Any refund not covered above."
    };
    return guidance[key] || guidance.custom;
}

function getResolutionTypeGuidance(resolutionType) {
    const key = normalizeResolutionType(resolutionType);
    const guidance = {
        fully_refunded: "Got all money back.",
        partially_refunded: "Only part of the money was returned.",
        cancelled_with_charges: "Cancellation fees were deducted.",
        consumed: "Expense was used and no refund is expected.",
        open: "Refund is still in progress.",
        written_off: "Marked as non-recoverable.",
        settled: "Finalized and no more changes expected."
    };
    return guidance[key] || guidance.open;
}

function refreshExpenseRefundGuidance() {
    let refundTypeEl = document.getElementById("refundType");
    let resolutionEl = document.getElementById("refundResolutionType");
    let refundTypeHelpEl = document.getElementById("refundTypeHelp");
    let resolutionHelpEl = document.getElementById("refundResolutionHelp");

    if (refundTypeHelpEl && refundTypeEl) {
        refundTypeHelpEl.textContent = `${formatRefundType(refundTypeEl.value)}: ${getRefundTypeGuidance(refundTypeEl.value)}`;
    }

    if (resolutionHelpEl && resolutionEl) {
        let label = RESOLUTION_TYPE_LABELS[normalizeResolutionType(resolutionEl.value)] || "Open";
        resolutionHelpEl.textContent = `${label}: ${getResolutionTypeGuidance(resolutionEl.value)}`;
    }
}

function handleRefundResolutionChange() {
    let type = document.getElementById("entryType")?.value;
    if (type !== "refund") return;

    let resolutionType = normalizeResolutionType(document.getElementById("refundResolutionType")?.value || "open");
    let amountEl = document.getElementById("amount");
    let select = document.getElementById("linkedTransactionSelect");

    if (!amountEl || !select) return;

    let selectedOption = select.options[select.selectedIndex];
    let pending = Number(selectedOption?.dataset?.pending || 0);

    amountEl.disabled = false;
    amountEl.placeholder = "Amount";

    if (resolutionType === "fully_refunded") {
        if (pending > 0) amountEl.value = String(pending);
        amountEl.disabled = true;
    } else if (resolutionType === "consumed" || resolutionType === "written_off") {
        amountEl.value = "0";
        amountEl.disabled = true;
        amountEl.placeholder = "No wallet credit for this closure";
    }

    updateLinkedRemainingUI();
}

// ⚠️ FIX (Issue 01): A wallet's remaining balance can now legitimately
// come from MULTIPLE Savings sources (Issue 02 removed the old "one
// source per budget row" assumption). This walks the wallet's real
// funding history oldest → newest, consuming "spent" against the
// oldest funding first — so whatever's left over is attributed to the
// most recently added funding first (matches how spending already
// worked in practice). Returns an array of {budgetId, sourceId, amount}
// covering up to `requestAmount`.
function computeTransferBackAllocations(budgetId, requestAmount) {
    let amount = roundCurrency(Math.abs(Number(requestAmount) || 0));
    if (!amount || !budgetId) return [];

    let funding = typeof getBudgetFundingSources === "function" ? getBudgetFundingSources(budgetId) : [];
    // getBudgetFundingSources already sorts oldest → newest.

    let expenses = getExpenses();
    let spent = Math.max(0, getNetSpentForBudget(budgetId, expenses));

    let remainingPerEvent = [];
    let spendLeft = spent;

    funding.forEach(f => {
        let used = Math.min(f.amount, spendLeft);
        spendLeft = roundCurrency(Math.max(0, spendLeft - used));
        let remains = roundCurrency(f.amount - used);
        if (remains > 0) {
            remainingPerEvent.push({ sourceId: f.sourceId, amount: remains });
        }
    });

    let allocations = [];
    let need = amount;

    remainingPerEvent.forEach(r => {
        if (need <= 0) return;
        let use = roundCurrency(Math.min(r.amount, need));
        if (use > 0) {
            allocations.push({ budgetId, sourceId: r.sourceId, amount: use });
            need = roundCurrency(need - use);
        }
    });

    return allocations;
}

function buildTransferBackPlan(requestAmount, selectedBudgetId = null) {
    let amount = roundCurrency(Math.abs(Number(requestAmount) || 0));
    if (!amount) {
        return { amount: 0, allocations: [], remaining: 0, totalAvailable: 0 };
    }

    let budgets = getSelectableBudgetEntries(getBudgets());
    let selectedId = String(selectedBudgetId || "").trim();
    if (selectedId) {
        budgets = budgets.filter(b => String(b.budgetId || "") === selectedId);
    }

    let expenses = getExpenses();
    let candidates = budgets.map(b => {
        let spent = Math.max(0, getNetSpentForBudget(b.budgetId, expenses));
        let allocated = roundCurrency(Math.max(0, Number(b.totalAllocated || 0)));
        let available = roundCurrency(Math.max(0, allocated - spent));
        return { budgetId: b.budgetId, available };
    }).filter(c => c.available > 0);

    if (!candidates.length) {
        return {
            amount,
            allocations: [],
            remaining: amount,
            totalAvailable: 0,
            selectedBudgetId: selectedId || null
        };
    }

    let chosen = candidates[0];
    let use = roundCurrency(Math.min(chosen.available, amount));

    // ⚠️ FIX (Issue 01): split the return across every real source that
    // funded this wallet, instead of forcing it onto just one.
    let allocations = use > 0 ? computeTransferBackAllocations(chosen.budgetId, use) : [];
    let allocated = roundCurrency(allocations.reduce((sum, a) => sum + a.amount, 0));
    let remaining = roundCurrency(Math.max(0, amount - allocated));

    return {
        amount,
        allocations,
        remaining,
        totalAvailable: roundCurrency(candidates.reduce((sum, c) => sum + c.available, 0)),
        selectedBudgetId: chosen.budgetId
    };
}

// =========================
// 🔄 QUICK CLOSE — one-tap transfer back from a budget card
// =========================
async function quickCloseBudgetTransferBack(group, relatedBudgetIds) {
    let ids = Array.isArray(relatedBudgetIds) ? relatedBudgetIds : [];
    let totalTransferred = 0;
    let failures = [];

    for (let budgetId of ids) {
        let expenses = getExpenses();
        let spent = getNetSpentForBudget(budgetId, expenses);
        let budgetRow = getBudgets().find(b => String(b.budgetId) === String(budgetId));
        let allocated = roundCurrency(Number(budgetRow && budgetRow.totalAllocated || 0));
        let remaining = roundCurrency(Math.max(0, allocated - spent));

        if (remaining <= 0) continue;

        // ⚠️ Section 12/13: resolve any unassigned top-up money in this
        // wallet to a real source before computing the split.
        if (budgetRow && typeof autoResolveWalletTopups === "function") {
            autoResolveWalletTopups(budgetRow);
        }

        let plan = buildTransferBackPlan(remaining, budgetId);
        if (!plan.allocations.length || plan.remaining > 0) {
            failures.push(budgetId);
            continue;
        }

        let transferBackTrail = plan.allocations.map(a => ({
            budgetId: a.budgetId,
            sourceId: a.sourceId,
            amount: a.amount
        }));
        let uniqueSources = [...new Set(transferBackTrail.map(a => a.sourceId))];

        // ⚠️ FIX (Issue 01): no longer requires exactly one source —
        // transferBackTrail already supports (and the code below already
        // correctly handles) crediting several sources at once.
        if (!uniqueSources.length) {
            failures.push(budgetId);
            continue;
        }

        let nowIso = new Date().toISOString();

        let created = addExpense({
            amount: -Math.abs(plan.amount),
            category: "Transfer Back",
            purpose: "Budget Closure",
            date: nowIso,
            type: "transfer_back",
            paymentType: "Cash",
            budgetId,
            allocationTrail: transferBackTrail.map(a => ({ budgetId: a.budgetId, amount: roundCurrency(convertToBase(a.amount)) })),
            transferBackTrail,
            linkedSourceSavingsId: uniqueSources[0] || null,
            linkedSourceSavingsIds: uniqueSources
        });

        if (created && typeof getSavings === "function" && typeof saveSavings === "function") {
            let savings = getSavings();
            let grouped = {};
            transferBackTrail.forEach(a => {
                grouped[a.sourceId] = (grouped[a.sourceId] || 0) + Number(a.amount || 0);
            });
            Object.keys(grouped).forEach(sourceId => {
                let val = roundCurrency(Math.abs(Number(grouped[sourceId]) || 0));
                if (!val) return;
                savings.push({
                    id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `sav_${Date.now()}_${Math.random()}`,
                    type: "refund",
                    amount: val,
                    sourceId,
                    entity: "Budget Wallet",
                    paymentType: "Cash",
                    note: "Budget Closure",
                    date: nowIso,
                    monthKey: nowIso.slice(0, 7),
                    periodKey: (typeof getActivePeriodKey === "function") ? getActivePeriodKey() : null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    linkedTransactionId: created.id,
                    linkedSourceSavingsId: sourceId,
                    autoGenerated: true
                });
            });
            saveSavings(savings);
        }

        totalTransferred += plan.amount;
    }

    if (totalTransferred > 0) {
        showToast(`Transferred back ${formatCurrency(totalTransferred)}`);
    } else if (failures.length) {
        showToast("Unable to transfer back — check budget source links");
    } else {
        showToast("Nothing to transfer back");
    }

    loadHistory();
    loadBudgetOptions();
    loadDashboard();
    loadGraph();
    updateProgressBar();
    renderBudgetEntries();
}

if (typeof window !== "undefined") {
    window.quickCloseBudgetTransferBack = quickCloseBudgetTransferBack;
}

function loadLinkedTransactionOptions(type) {
    let select = document.getElementById("linkedTransactionSelect");
    if (!select) return;

    let expenses = getExpenses();
    select.innerHTML = "<option value=''>Select transaction</option>";

    let candidates = [];

    if (type === "refund") {
        candidates = expenses
            .filter(e => (e.type === "expense" || e.type === "transfer" || e.type === "loss") && Number(e.amount || 0) < 0)
            .filter(e => {
                let s = getExpenseResolutionSnapshot(e.id, expenses);
                return s.remainingRefundable > 0;
            });
    } else {
        candidates = [];
    }

    candidates.forEach(e => {
        let s = getExpenseResolutionSnapshot(e.id, expenses);
        let option = document.createElement("option");
        option.value = String(e.id);
        option.dataset.pending = String(s.remainingRefundable);
        option.dataset.originalAmount = String(s.originalAmount);
        option.dataset.refunded = String(s.refunded);
        option.dataset.loss = String(s.loss);
        option.dataset.status = String(s.status || "OPEN");
        option.textContent = `${e.purpose || e.category || e.type} • ${formatCurrency(s.remainingRefundable)} refundable`;
        select.appendChild(option);
    });

    updateLinkedRemainingUI();
}

function updateLinkedRemainingUI() {
    let text = document.getElementById("linkedRemainingText");
    let select = document.getElementById("linkedTransactionSelect");
    if (!text || !select) return;

    let option = select.options[select.selectedIndex];
    let pending = Number(option?.dataset?.pending || 0);
    let originalAmount = Number(option?.dataset?.originalAmount || 0);
    let refunded = Number(option?.dataset?.refunded || 0);
    let loss = Number(option?.dataset?.loss || 0);
    let status = option?.dataset?.status || "OPEN";

    if (!option || !option.value) {
        text.style.display = "none";
        text.textContent = "";
        return;
    }

    text.style.display = "block";
    text.textContent = `Original: ${formatCurrency(originalAmount)} | Refunded: ${formatCurrency(refunded)} | Remaining Refundable: ${formatCurrency(pending)} | Loss: ${formatCurrency(loss)} | Status: ${formatResolutionStatus(status)}`;
}

function handleEntryTypeUIChange() {
    let type = document.getElementById("entryType")?.value || "expense";
    let amountEl = document.getElementById("amount");
    if (amountEl) {
        amountEl.disabled = false;
        amountEl.placeholder = "Amount";
    }

    let categoryWrapper = document.getElementById("categoryWrapper");
    let budgetWrapper = document.getElementById("budgetWrapper");
    let linkedWrapper = document.getElementById("linkedTransactionWrapper");
    let paymentWrapper = document.getElementById("paymentWrapper");
    let personWrapper = document.getElementById("personWrapper");
    let adjustmentWrapper = document.getElementById("adjustmentDirectionWrapper");
    let personHelp = document.getElementById("personSelectionHelp");

    [categoryWrapper, budgetWrapper, linkedWrapper, paymentWrapper, personWrapper, adjustmentWrapper]
        .filter(Boolean)
        .forEach(el => { el.style.display = "none"; });

    if (type === "expense") {
        if (categoryWrapper) categoryWrapper.style.display = "block";
        if (budgetWrapper) budgetWrapper.style.display = "block";
        if (paymentWrapper) paymentWrapper.style.display = "block";
        return;
    }

    if (type === "transfer") {
        if (categoryWrapper) categoryWrapper.style.display = "block";
        if (budgetWrapper) budgetWrapper.style.display = "block";
        if (paymentWrapper) paymentWrapper.style.display = "block";
        if (personWrapper) personWrapper.style.display = "block";
        if (personHelp) personHelp.textContent = "Person is required for transfer transactions.";
        loadExpensePersonOptions();
        return;
    }

    if (type === "refund") {
        if (linkedWrapper) linkedWrapper.style.display = "block";
        if (paymentWrapper) paymentWrapper.style.display = "block";
        if (personWrapper) personWrapper.style.display = "block";
        if (personHelp) personHelp.textContent = "Person is optional for refunds. Select it only when needed.";
        loadExpensePersonOptions();
        loadLinkedTransactionOptions(type);
        handleRefundResolutionChange();
        refreshExpenseRefundGuidance();
        return;
    }

    if (type === "transfer_back") {
        if (budgetWrapper) budgetWrapper.style.display = "block";
        if (paymentWrapper) paymentWrapper.style.display = "block";
        if (typeof loadBudgetOptions === "function") {
            loadBudgetOptions({ mode: "transfer_back" });
        }
        return;
    }

    if (type === "adjustment") {
        if (budgetWrapper) budgetWrapper.style.display = "block";
        if (paymentWrapper) paymentWrapper.style.display = "block";
        if (adjustmentWrapper) adjustmentWrapper.style.display = "block";
        if (typeof loadBudgetOptions === "function") {
            loadBudgetOptions({ mode: "adjustment" });
        }
        return;
    }

    // income and other inflows
    if (categoryWrapper) categoryWrapper.style.display = "block";
    if (paymentWrapper) paymentWrapper.style.display = "block";
}

// Drives the Entry Type tab bar on the Add screen. Keeps the real
// (hidden) <select id="entryType"> in sync so all existing save/
// validation logic — which reads that select's value — keeps working
// completely unchanged.
function selectEntryType(type) {
    let select = document.getElementById("entryType");
    if (select) select.value = type;

    let bar = document.querySelector('.tab-bar[data-tab-group="entryTypeTabs"]');
    if (bar) {
        bar.querySelectorAll(".tab-bar-btn").forEach(btn => {
            btn.classList.toggle("is-active", btn.dataset.tabKey === type);
        });
    }

    handleEntryTypeUIChange();
}

async function handleAddExpense() {
    // guard: ensure form exists on current page
    if (!document.getElementById || !document.getElementById("amount")) return;

    let amount = Number(document.getElementById("amount")?.value);
    let category = document.getElementById("category")?.value;
    let purpose = document.getElementById("purpose")?.value;
    let date = document.getElementById("expenseDate")?.value;
    let type = document.getElementById("entryType")?.value;
    let paymentType = document.getElementById("paymentType")?.value;
    let person = document.getElementById("personSelect")?.value || null;
    let budgetId = document.getElementById("budgetSelect")?.value;
    let linkedTransactionId = document.getElementById("linkedTransactionSelect")?.value || null;
    let refundResolutionType = normalizeResolutionType(document.getElementById("refundResolutionType")?.value || "open");
    let refundType = normalizeRefundType(document.getElementById("refundType")?.value || "custom");
    let adjustmentDirection = document.getElementById("adjustmentDirection")?.value || "increase";

    // ✅ VALIDATION
    if (!(type === "refund" && (refundResolutionType === "consumed" || refundResolutionType === "written_off")) && !amount) {
        showToast("Enter amount");
        return;
    }

    if ((type === "expense" || type === "transfer" || type === "adjustment") && !budgetId) {
        showToast("Select budget");
        return;
    }

    if (type === "adjustment" && (!purpose || !purpose.trim())) {
        showToast("Reason is required for adjustment");
        return;
    }

    if (type === "transfer" && !person) {
        showToast("Select person");
        return;
    }

    if (type === "refund") {
        if (!linkedTransactionId) {
            showToast("Select linked transaction");
            return;
        }

        let snapshot = getExpenseResolutionSnapshot(linkedTransactionId);
        let pending = Number(snapshot.remainingRefundable || 0);

        if (refundResolutionType === "consumed" || refundResolutionType === "written_off") {
            amount = 0;
        } else if (refundResolutionType === "fully_refunded") {
            amount = pending;
        } else {
            amount = Math.abs(Number(amount) || 0);
        }

        if (!(refundResolutionType === "consumed" || refundResolutionType === "written_off") && amount <= 0) {
            showToast("Refund amount must be greater than zero");
            return;
        }

        if (!(refundResolutionType === "consumed" || refundResolutionType === "written_off") && amount > pending) {
            showToast(`Only ${formatCurrency(pending)} available`);
            return;
        }

    }

    // ✅ SIGN FIX
    if (type === "adjustment") {
        amount = (adjustmentDirection === "decrease") ? -Math.abs(amount) : Math.abs(amount);
    } else {
        amount = (type === "expense" || type === "transfer")
            ? -Math.abs(amount)
            : Math.abs(amount);
    }

    // =========================
    // 🧠 DATE FIX LOGIC
    // =========================
    let selectedDate = date ? new Date(date) : new Date();
    let today = new Date();

    if (selectedDate.toDateString() === today.toDateString()) {
        // ✅ TODAY → current time
        selectedDate = new Date();
    } else {
        // ✅ PAST → end of day
        selectedDate.setHours(23, 59, 59, 999);
    }

    // =========================
    // ➕ SAVE EXPENSE
    // =========================
    // addExpense({
    //     amount,
    //     category,
    //     purpose,
    //     date: selectedDate.toISOString(), // ✅ FIXED
    //     type,
    //     paymentType,
    //     budgetId
    // });

    if (type === "expense") {
        const attachmentMeta = await storeAttachmentWithStatus('expenseAttachment');
        await handleExpenseSave(Math.abs(amount), budgetId, attachmentMeta);
        return;
    }
    // non-expense flows (income, transfer, refund, transfer_back) may still have attachments
    const nonExpAttachment = await storeAttachmentWithStatus('expenseAttachment');

    if (type === "transfer") {
        category = "Transfer";
        if (!purpose) purpose = "Transfer";
    } else if (type === "refund") {
        category = "Refund";
    } else if (type === "transfer_back") {
        category = "Transfer Back";
    } else if (type === "adjustment") {
        category = "Adjustment";
    }

    if (type === "transfer_back") {
        if (!budgetId) {
            showToast("Select budget");
            return;
        }

        // ⚠️ Section 12/13: resolve any unassigned top-up money first.
        let walletForTransferBack = getBudgets().find(b => String(b.budgetId) === String(budgetId));
        if (walletForTransferBack && typeof autoResolveWalletTopups === "function") {
            autoResolveWalletTopups(walletForTransferBack);
        }

        let plan = buildTransferBackPlan(amount, budgetId);
        if (!plan.allocations.length || plan.remaining > 0) {
            showToast(`Only ${formatCurrency(plan.totalAvailable)} can be transferred back now`);
            return;
        }

        let transferBackTrail = plan.allocations.map(a => ({
            budgetId: a.budgetId,
            sourceId: a.sourceId,
            amount: a.amount
        }));

        let uniqueSources = [...new Set(transferBackTrail.map(a => a.sourceId))];

        // ⚠️ FIX (Issue 01): no longer requires exactly one source.
        if (!uniqueSources.length) {
            showToast("Unable to resolve source for selected budget");
            return;
        }

        let created = addExpense({
            amount: -Math.abs(amount),
            category,
            purpose: purpose || "Transfer Back",
            date: selectedDate.toISOString(),
            type,
            paymentType,
            person,
            budgetId,
            allocationTrail: transferBackTrail.map(a => ({ budgetId: a.budgetId, amount: a.amount })),
            transferBackTrail,
            linkedSourceSavingsId: uniqueSources[0] || null,
            linkedSourceSavingsIds: uniqueSources,
            attachmentId: nonExpAttachment.attachmentId,
            attachmentStatus: nonExpAttachment.status,
            attachmentError: nonExpAttachment.error
        });

        if (created && typeof getSavings === "function" && typeof saveSavings === "function") {
            let savings = getSavings();
            let grouped = {};

            transferBackTrail.forEach(a => {
                grouped[a.sourceId] = (grouped[a.sourceId] || 0) + Number(a.amount || 0);
            });

            Object.keys(grouped).forEach(sourceId => {
                let val = Math.abs(Number(grouped[sourceId]) || 0);
                if (!val) return;
                savings.push({
                    id: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `sav_${Date.now()}_${Math.random()}`,
                    type: "refund",
                    amount: val,
                    sourceId,
                    entity: "Budget Wallet",
                    paymentType: paymentType || "Cash",
                    note: purpose || "Transfer Back",
                    date: selectedDate.toISOString(),
                    monthKey: selectedDate.toISOString().slice(0, 7),
                    periodKey: (typeof getActivePeriodKey === "function") ? getActivePeriodKey() : null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    linkedTransactionId: created.id,
                    linkedSourceSavingsId: sourceId,
                    autoGenerated: true
                });
            });

            saveSavings(savings);
            if (typeof loadSavings === "function") loadSavings();
            if (typeof loadSourceOptions === "function") loadSourceOptions();
            if (typeof loadRefundCandidates === "function") loadRefundCandidates();
        }

        showToast("Added");
        clearExpenseAttachmentState();
        resetForm();
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        updateProgressBar();
        renderBudgetEntries();
        return;
    }

    if (type === "adjustment") {
        addExpense({
            amount,
            category,
            purpose,
            date: selectedDate.toISOString(),
            type: "adjustment",
            paymentType,
            budgetId,
            allocationTrail: [{ budgetId, amount: Math.abs(convertToBase(amount)) }],
            entity: "System Adjustment",
            attachmentId: nonExpAttachment.attachmentId,
            attachmentStatus: nonExpAttachment.status,
            attachmentError: nonExpAttachment.error
        });

        showToast("Adjustment Added");
        clearExpenseAttachmentState();
        resetForm();
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        updateProgressBar();
        renderBudgetEntries();
        return;
    }

    if (type === "refund") {
        let snapshot = getExpenseResolutionSnapshot(linkedTransactionId);
        let pending = Number(snapshot.remainingRefundable || 0);
        let refundAmount = Math.abs(Number(amount) || 0);
        let linkTargets = resolveRefundLinkTargets(snapshot, budgetId);

        if (refundResolutionType !== "consumed" && refundResolutionType !== "written_off") {
            addExpense({
                amount: refundAmount,
                category: "Refund",
                purpose: purpose || "Refund",
                date: selectedDate.toISOString(),
                type: "refund",
                paymentType,
                person,
                budgetId: linkTargets.budgetId,
                linkedTransactionId,
                linkedSourceSavingsId: linkTargets.linkedSourceSavingsId,
                linkedSourceSavingsIds: linkTargets.linkedSourceSavingsIds,
                refundType,
                entity: paymentType,
                attachmentId: nonExpAttachment.attachmentId,
                attachmentStatus: nonExpAttachment.status,
                attachmentError: nonExpAttachment.error
            });
        }

        if (["consumed", "cancelled_with_charges", "written_off", "settled"].includes(refundResolutionType)) {
            let unresolvedAfterRefund = Math.max(0, pending - refundAmount);
            addExpense({
                amount: 0,
                category: "Expense Resolution",
                purpose: purpose || formatResolutionStatus(refundResolutionType.toUpperCase()),
                date: selectedDate.toISOString(),
                type: "expense_resolution",
                paymentType: paymentType || "N/A",
                person,
                budgetId: linkTargets.budgetId,
                linkedTransactionId,
                linkedSourceSavingsId: linkTargets.linkedSourceSavingsId,
                linkedSourceSavingsIds: linkTargets.linkedSourceSavingsIds,
                entity: "System",
                attachmentId: nonExpAttachment.attachmentId,
                attachmentStatus: nonExpAttachment.status,
                attachmentError: nonExpAttachment.error,
                resolutionType: refundResolutionType,
                resolvedAmount: refundAmount,
                lossAmount: (refundResolutionType === "consumed" || refundResolutionType === "settled") ? 0 : unresolvedAfterRefund
            });
        }

        showToast("Added");
        clearExpenseAttachmentState();
        resetForm();
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        updateProgressBar();
        renderBudgetEntries();
        return;
    }

    addExpense({
        amount,
        category,
        purpose,
        date: selectedDate.toISOString(),
        type,
        paymentType,
        person,
        budgetId,
        linkedTransactionId,
        entity: paymentType,
        attachmentId: nonExpAttachment.attachmentId,
        attachmentStatus: nonExpAttachment.status,
        attachmentError: nonExpAttachment.error
    });
    // =========================
    // 🔄 UI UPDATES
    // =========================
    showToast("Added");

    clearExpenseAttachmentState();
    resetForm();
    loadHistory();
    loadBudgetOptions();
    loadDashboard();   // 🔥 important
    loadGraph();
    updateProgressBar();
    renderBudgetEntries();
    loadBudgetOptions();  // 🔥 refresh graph
}


// 🧹 Reset Form
function resetForm() {
    if (document.getElementById("amount")) document.getElementById("amount").value = "";
    if (document.getElementById("purpose")) document.getElementById("purpose").value = "";
    if (document.getElementById("linkedTransactionSelect")) document.getElementById("linkedTransactionSelect").value = "";
    if (document.getElementById("refundResolutionType")) document.getElementById("refundResolutionType").value = "open";
    if (document.getElementById("refundType")) document.getElementById("refundType").value = "custom";
    if (document.getElementById("adjustmentDirection")) document.getElementById("adjustmentDirection").value = "increase";
    if (document.getElementById("personSelect")) document.getElementById("personSelect").value = "";
    if (document.getElementById("amount")) document.getElementById("amount").disabled = false;
    if (document.getElementById("linkedRemainingText")) {
        document.getElementById("linkedRemainingText").style.display = "none";
        document.getElementById("linkedRemainingText").textContent = "";
    }

    let today = new Date().toISOString().split("T")[0];
    if (document.getElementById("expenseDate")) document.getElementById("expenseDate").value = today;

    resetExpenseBudgetSelectionState();

    clearExpenseAttachmentState();

    handleEntryTypeUIChange();
    refreshExpenseRefundGuidance();
}

function saveExpenseDirect(amount, budget) {

    addExpense({
        amount: -Math.abs(amount),
        budgetId: budget.budgetId,
        category: "General",
        purpose: "Auto Split",
        paymentType: "Auto"
    });

}

function registerOfflineServiceWorker() {
    if (!('serviceWorker' in navigator)) return;

    // Service workers do not work on file:// URLs.
    if (location.protocol === 'file:') return;

    const swPath = location.pathname.includes('/pages/') ? '../service-worker.js' : 'service-worker.js';

    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    navigator.serviceWorker.register(swPath).then((registration) => {
        if (registration.waiting) {
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        registration.addEventListener("updatefound", () => {
            const installing = registration.installing;
            if (!installing) return;

            installing.addEventListener("statechange", () => {
                if (installing.state === "installed" && navigator.serviceWorker.controller) {
                    installing.postMessage({ type: "SKIP_WAITING" });
                }
            });
        });
    }).catch(err => {
        console.warn('Service worker registration failed', err);
    });
}

registerOfflineServiceWorker();

let __responsiveLayoutBound = false;
let __responsiveLayoutFrame = null;
const ENABLE_SCREEN_LAYOUT_DEBUG = true;

function formatScreenLabel(screenId) {
    let raw = String(screenId || "").replace(/[_-]+/g, " ").trim();
    if (!raw) return "Unknown";
    return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function emitScreenSizeDebug(screenId) {
    if (!ENABLE_SCREEN_LAYOUT_DEBUG) return;

    let activeScreen = document.getElementById(screenId);
    let screenRect = activeScreen ? activeScreen.getBoundingClientRect() : { width: 0, height: 0 };
    let screenWidth = Math.round(Number(screenRect.width || 0));
    let screenHeight = Math.round(Number(screenRect.height || 0));
    let windowWidth = Number(window.innerWidth || 0);
    let windowHeight = Number(window.innerHeight || 0);
    let viewportWidth = Number(document.documentElement?.clientWidth || 0);
    let viewportHeight = Number(document.documentElement?.clientHeight || 0);
    let layoutMode = document.documentElement.getAttribute("data-layout") || "unknown";

    console.log(
        `[DEBUG SCREEN SIZE]\n\n` +
        `Screen: ${String(screenId || "unknown")}\n\n` +
        `window.innerWidth: ${windowWidth}\n` +
        `window.innerHeight: ${windowHeight}\n\n` +
        `viewportWidth: ${viewportWidth}\n` +
        `viewportHeight: ${viewportHeight}\n\n` +
        `screenWidth: ${screenWidth}\n` +
        `screenHeight: ${screenHeight}\n\n` +
        `layout: ${layoutMode}`
    );
}

function logDashboardOverflowDiagnostics(trigger = "unknown") {
    let dashboardElement = document.getElementById("home");
    if (!dashboardElement) return;

    let dashboardScrollWidth = Number(dashboardElement.scrollWidth || 0);
    let dashboardClientWidth = Number(dashboardElement.clientWidth || 0);
    let bodyScrollWidth = Number(document.body && document.body.scrollWidth || 0);
    let winInnerWidth = Number(window.innerWidth || 0);
    let htmlScrollWidth = Number(document.documentElement && document.documentElement.scrollWidth || 0);
    let htmlClientWidth = Number(document.documentElement && document.documentElement.clientWidth || 0);
    let bodyClientWidth = Number(document.body && document.body.clientWidth || 0);

    console.log("[DEBUG DASHBOARD OVERFLOW]", trigger);
    console.log(dashboardElement.scrollWidth, dashboardElement.clientWidth);
    console.log(document.body.scrollWidth, window.innerWidth);
    console.log("BODY", document.body.scrollWidth, document.body.clientWidth);
    console.log("HTML", document.documentElement.scrollWidth, document.documentElement.clientWidth);

    let selectorProbe = [
        "#home",
        "#home > .card",
        ".dashboard-grid",
        ".refund-type-card",
        ".headline-wrapper",
        ".headline-text",
        ".chart-container",
        "#budgetEntries",
        ".budget-period-card"
    ];

    selectorProbe.forEach((sel) => {
        let el = document.querySelector(sel);
        if (!el) return;
        let parentWidth = el.parentElement ? Number(el.parentElement.clientWidth || 0) : 0;
        console.log(
            "[DASHBOARD NODE]",
            sel,
            "scrollWidth",
            Number(el.scrollWidth || 0),
            "clientWidth",
            Number(el.clientWidth || 0),
            "parentWidth",
            parentWidth
        );
    });

    document
        .querySelectorAll("*")
        .forEach(el => {
            if (el.scrollWidth > el.clientWidth + 5) {
                let parentWidth = el.parentElement ? Number(el.parentElement.clientWidth || 0) : 0;
                console.log(
                    "[OVERFLOW]",
                    el.tagName,
                    el.className,
                    el.scrollWidth,
                    el.clientWidth
                );
                console.log("[OVERFLOW PARENT]", el.tagName, el.className, "parentWidth", parentWidth);
            }
        });

    let candidates = dashboardElement.querySelectorAll(
        ".card, .dashboard-grid, .dash-card, .refund-type-card, .headline-wrapper, .headline-text, #refundTypeBreakdown"
    );

    let widest = {
        selector: "#home",
        scrollWidth: dashboardScrollWidth,
        clientWidth: dashboardClientWidth,
        delta: dashboardScrollWidth - dashboardClientWidth
    };

    candidates.forEach((el) => {
        let sw = Number(el.scrollWidth || 0);
        let cw = Number(el.clientWidth || 0);
        let delta = sw - cw;
        if (delta > widest.delta || (sw > widest.scrollWidth && delta >= widest.delta)) {
            let selector = el.id
                ? `#${el.id}`
                : (el.className ? `.${String(el.className).trim().replace(/\s+/g, ".")}` : el.tagName);
            widest = {
                selector,
                scrollWidth: sw,
                clientWidth: cw,
                delta
            };
        }
    });

    if (widest.delta > 0 || bodyScrollWidth > winInnerWidth) {
        console.log(
            "[DEBUG DASHBOARD OVERFLOW CHILD]",
            `${widest.selector} => ${widest.scrollWidth} / ${widest.clientWidth} (delta ${widest.delta})`
        );
    }

    if (htmlScrollWidth > htmlClientWidth + 5 || bodyScrollWidth > bodyClientWidth + 5) {
        console.log(
            "[DEBUG ROOT OVERFLOW]",
            `HTML ${htmlScrollWidth}/${htmlClientWidth} | BODY ${bodyScrollWidth}/${bodyClientWidth} | WINDOW ${winInnerWidth}`
        );
    }
}

function getResponsiveViewportWidth() {
    try {
        if (window.visualViewport && Number(window.visualViewport.width) > 0) {
            return Number(window.visualViewport.width);
        }
    } catch (_err) {
        // ignore and continue to fallback widths
    }

    let docWidth = Number(document.documentElement && document.documentElement.clientWidth);
    let winWidth = Number(window.innerWidth);

    if (Number.isFinite(docWidth) && docWidth > 0) return docWidth;
    if (Number.isFinite(winWidth) && winWidth > 0) return winWidth;
    return 0;
}

function applyResponsiveLayout() {
    let width = getResponsiveViewportWidth();
    if (!Number.isFinite(width) || width <= 0) return;

    let isMobileLayout = width <= 820;
    let height = Number(document.documentElement && document.documentElement.clientHeight) || Number(window.innerHeight) || 0;
    let app = document.querySelector(".app");
    let detectedLayout = isMobileLayout ? "mobile" : "desktop";

    document.documentElement.setAttribute("data-layout", detectedLayout);

    if (app) {
        app.classList.toggle("layout-mobile", isMobileLayout);
        app.classList.toggle("layout-desktop", !isMobileLayout);
    }

    if (ENABLE_SCREEN_LAYOUT_DEBUG) {
        console.log(
            `[DEBUG SCREEN SIZE] applyResponsiveLayout | Current Width: ${width} | Current Height: ${height} | Detected Layout: ${detectedLayout}`
        );
    }
}

function refreshDashboardLayout() {
    if (typeof window === "undefined") return;

    if (__responsiveLayoutFrame && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(__responsiveLayoutFrame);
    }

    if (typeof requestAnimationFrame === "function") {
        __responsiveLayoutFrame = requestAnimationFrame(() => {
            applyResponsiveLayout();
            __responsiveLayoutFrame = null;
        });
        return;
    }

    applyResponsiveLayout();
}

function bindResponsiveLayoutWatchers() {
    if (__responsiveLayoutBound) return;
    __responsiveLayoutBound = true;

    window.addEventListener("resize", refreshDashboardLayout, { passive: true });
    window.addEventListener("orientationchange", refreshDashboardLayout, { passive: true });
    window.addEventListener("pageshow", refreshDashboardLayout, { passive: true });

    try {
        if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
            window.visualViewport.addEventListener("resize", refreshDashboardLayout, { passive: true });
            window.visualViewport.addEventListener("scroll", refreshDashboardLayout, { passive: true });
        }
    } catch (_err) {
        // visualViewport listeners are optional
    }
}

// ✅ ALWAYS RUN FOOTER (independent)
window.addEventListener("load", function () {
    if (isSavingsPage) {
        console.log("🚫 script.js blocked on savings page");
        return;
    }
    try {
        bindResponsiveLayoutWatchers();
        applyResponsiveLayout();
        injectGlobalFooter();

        applySchemaMigrationsToLocalStorage();

        // Keep persisted data chains tied across upgrades/legacy backups.
        runIntegrityRepairSilently();

        loadHistory();
        initCategories();
        loadExpensePersonOptions();
        loadTheme();
        updateUI();
        loadBudgetOptions();
        loadDashboard();
        loadBudgetScreen();
        loadGraph("day");

        let today = new Date().toISOString().split("T")[0];
        let dateInput = document.getElementById("expenseDate");
        if (dateInput) {
            dateInput.value = today;
            dateInput.addEventListener("change", () => {
                autoSelectExpenseBudget({ respectManual: true });
            });
        }

        handleEntryTypeUIChange();
        refreshExpenseRefundGuidance();

        let refundTypeSelect = document.getElementById("refundType");
        if (refundTypeSelect) refundTypeSelect.addEventListener("change", refreshExpenseRefundGuidance);

        let budgetSelect = document.getElementById("budgetSelect");
        if (budgetSelect) budgetSelect.addEventListener("change", markExpenseBudgetManuallySelected);

        let resolutionTypeSelect = document.getElementById("refundResolutionType");
        if (resolutionTypeSelect) resolutionTypeSelect.addEventListener("change", refreshExpenseRefundGuidance);

        renderCategoryList();
        setDefaultDate();
        bindRemainingCard();
        renderBudgetEntries();
        renderCategoryBreakdown();
        startHeadline();
        if (typeof refreshSettingsPanels === "function") refreshSettingsPanels();
        startAutoBackup();
        autoResolveClosedWalletTopups();
        refreshDashboardLayout();

    } catch (e) {
    }
});
window.showScreen = function showScreen(id) {
    const screens = document.querySelectorAll(".screen");
    const buttons = document.querySelectorAll(".nav button");

    screens.forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");

    applyResponsiveLayout();
    emitScreenSizeDebug(id);

    if (id === "home") {
        setTimeout(() => {
            logDashboardOverflowDiagnostics("showScreen(home)");
        }, 0);
    }

    buttons.forEach(btn => btn.classList.remove("active"));
    document.querySelector(`[data-screen="${id}"]`)?.classList.add("active");

    if (id === "history") loadHistory();
    if (id === "budgetEntries") {
        renderBudgetEntries();
    }
    if (id === "budget") {
        renderBudgetWalletOverview();
        if (typeof loadBudgetScreen === "function") loadBudgetScreen();
    }
    if (id === "graph") {
        loadGraph();
    }
    if (id === "settings" && typeof window.refreshSettingsPanels === "function") {
        window.refreshSettingsPanels();
    }
    refreshDashboardLayout();
}

function getCategories() {
    return JSON.parse(localStorage.getItem("categories")) || [];
}

function saveCategories(data) {
    localStorage.setItem("categories", JSON.stringify(data));
}

function initCategories() {
    let categories = getCategories();

    if (!categories.length) {
        categories = ["Food", "Travel", "Bills", "Entertainment", "Loan", "Recovery", "Others"];
        saveCategories(categories);
    }

    loadCategories();
}

function loadCategories() {
    let select = document.getElementById("category");
    if (!select) return;

    let categories = getCategories();

    select.innerHTML = "";

    //let categories = getCategories();

    if (!categories.length) {
        let option = document.createElement("option");
        option.value = "";
        option.textContent = "No categories - Add one";
        select.appendChild(option);
        return;
    }

    categories.forEach(cat => {
        let option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function getExpensePersons() {
    try {
        let data = JSON.parse(localStorage.getItem("persons")) || [];
        return Array.isArray(data) ? data : [];
    } catch (_err) {
        return [];
    }
}

function loadExpensePersonOptions() {
    let select = document.getElementById("personSelect");
    if (!select) return;

    let persons = getExpensePersons();
    select.innerHTML = "<option value=''>No specific person</option>";

    persons.forEach((p) => {
        let opt = document.createElement("option");
        opt.value = p;
        opt.textContent = p;
        select.appendChild(opt);
    });
}

function addCategory() {
    let input = document.getElementById("newCategory");
    let val = input.value.trim();

    if (!val) return;

    let categories = getCategories();

    if (categories.includes(val)) {
        showToast("Already exists");
        return;
    }

    categories.push(val);
    saveCategories(categories);

    input.value = "";

    loadCategories();
    renderCategoryList();
}

function deleteCategory(index) {
    let categories = getCategories();

    if (index < 0 || index >= categories.length) return;

    let selected = categories[index];
    let check = validateLookupDeletion("category", selected);
    if (check.blocked) {
        showToast(`Cannot delete category. ${check.summary}`);
        return;
    }

    categories.splice(index, 1);

    saveCategories(categories);

    loadCategories();
    renderCategoryList();
}

function renderCategoryList() {
    let container = document.getElementById("categoryList");
    if (!container) return;

    let categories = getCategories();

    container.innerHTML = "";

    categories.forEach((cat, i) => {
        let div = document.createElement("div");

        div.innerHTML = `
  <div class="cat-row">
    <span class="cat-name">${cat}</span>
    <button class="cat-delete" onclick="deleteCategory(${i})">✕</button>
  </div>
`;

        container.appendChild(div);
    });
}


function setDefaultDate() {
    let today = new Date().toISOString().split("T")[0];
    let el = document.getElementById("expenseDate");

    if (el) el.value = today;
}

function showDate() {
    let el = document.getElementById("dateDisplay");
    if (el) el.innerText = new Date().toLocaleString();
}

const APPEARANCE_MODES = ["metallic", "matte", "glossy", "chromium", "premium", "glass", "paper", "neon"];
const APPEARANCE_ALIASES = {
    mettalic: "metallic",
    mettlaic: "metallic",
    premium: "premium"
};
const ACCENT_PRESETS = {
    purple: "#7c3aed",
    blue: "#2196f3",
    emerald: "#10b981",
    orange: "#ff5722",
    red: "#ef4444"
};
const DEFAULT_ACCENT = "#4caf50";

function resolveAccentColor(value) {
    if (!value) return DEFAULT_ACCENT;
    if (ACCENT_PRESETS[value]) return ACCENT_PRESETS[value];
    return value;
}

function setAppearanceMode(mode) {
    let requested = String(mode || "").toLowerCase();
    let normalized = APPEARANCE_ALIASES[requested] || requested;

    let safeMode = APPEARANCE_MODES.includes(normalized)
        ? normalized
        : "metallic";

    localStorage.setItem("appearanceMode", safeMode);
    document.documentElement.dataset.appearance = safeMode;
}

function syncThemeSelectors() {
    let accentSelect = document.getElementById("accentColorSelect");
    let appearanceSelect = document.getElementById("appearanceModeSelect");

    let accent = localStorage.getItem("accentColor") || localStorage.getItem("theme") || DEFAULT_ACCENT;
    let appearance = localStorage.getItem("appearanceMode") || "metallic";

    if (appearanceSelect) appearanceSelect.value = APPEARANCE_MODES.includes(appearance) ? appearance : "metallic";

    if (accentSelect) {
        let key = Object.keys(ACCENT_PRESETS).find(k => ACCENT_PRESETS[k] === accent);
        accentSelect.value = key || "custom";
    }
}

function changeTheme(c) {
    let color = resolveAccentColor(c);
    localStorage.setItem("theme", color);
    localStorage.setItem("accentColor", color);
    document.documentElement.style.setProperty("--theme", color);
    document.documentElement.style.setProperty("--accent-color", color);
    syncThemeSelectors();
}

function loadTheme() {
    let appearance = localStorage.getItem("appearanceMode");
    if (!appearance && APPEARANCE_MODES.includes(String(localStorage.getItem("theme") || "").toLowerCase())) {
        appearance = String(localStorage.getItem("theme")).toLowerCase();
    }
    setAppearanceMode(appearance || "metallic");

    let accent = localStorage.getItem("accentColor") || localStorage.getItem("theme") || DEFAULT_ACCENT;
    changeTheme(accent);
}

function updateUI() {
    let expenses = getExpenses();

    let total = expenses.reduce((s, e) => s + e.amount, 0);

    let spent = expenses
        .filter(e => e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    let income = expenses
        .filter(e => e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    let elSpent = document.getElementById("spent");
    let elIncome = document.getElementById("income");

    if (elSpent) elSpent.innerText = formatCurrency(spent);
    if (elIncome) elIncome.innerText = formatCurrency(income);
}

// function handleFilter(type) {
//     let expenses = getExpenses();
//let now = new Date(); // ✅ rename

//     let filtered = expenses.filter(e => {
//         let d = new Date(e.date);

//         if (type === "today") return d.toDateString() === now.toDateString();

//         if (type === "month") {
//             return (
//                 d.getMonth() === now.getMonth() &&
//                 d.getFullYear() === now.getFullYear()
//             );
//         }

//         return true;
//     });

//     loadHistory(filtered);
// }

function getSelectedBudgetId() {
    let select = document.getElementById("budgetSelect");
    return select ? select.value : null;
}


function applyDateFilter() {

    const from =
        document.getElementById("fromDate").value;

    const to =
        document.getElementById("toDate").value;

    const expenses = getExpenses();

    function normalize(date) {

        let d = new Date(date);

        return new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
        ).getTime();
    }

    const fromTime =
        from ? normalize(from) : null;

    const toTime =
        to ? normalize(to) : null;

    const filtered = expenses.filter(e => {

        let d = normalize(e.date);

        if (fromTime && !toTime) {
            return d === fromTime;
        }

        if (!fromTime && toTime) {
            return d <= toTime;
        }

        if (fromTime && toTime) {
            return d >= fromTime &&
                d <= toTime;
        }

        return true;
    });

    loadHistory(filtered);

    if (typeof loadGraph === "function") {

        loadGraph(
            "custom",
            filtered,
            {
                start: from,
                end: to
            }
        );
    }

    if (typeof renderCategoryBreakdown === "function") {

        renderCategoryBreakdown(
            groupByCategory(filtered)
        );
    }
}

function applyPeriod(type) {

    let expenses = getExpenses();

    let filtered =
        filterDataByType(type, expenses);

    loadHistory(filtered);

    if (typeof loadGraph === "function") {
        loadGraph(type, filtered);
    }

    if (typeof renderCategoryBreakdown === "function") {
        renderCategoryBreakdown(
            groupByCategory(filtered)
        );
    }
}

function getInsights() {
    let data = getExpenses();

    if (!data.length) return;

    let total = data.reduce((s, e) => s + Math.abs(e.amount), 0);

    let topCategory = {};

    data.forEach(e => {
        if (!topCategory[e.category]) topCategory[e.category] = 0;
        topCategory[e.category] += Math.abs(e.amount);
    });

    let maxCat = Object.keys(topCategory).reduce((a, b) =>
        topCategory[a] > topCategory[b] ? a : b
    );

    showToast(`Top spending: ${maxCat}`);
}

function openDateModal() {
    let modal = document.getElementById("dateModal");
    if (modal) modal.style.display = "flex";
}

function closeDateModal() {
    let modal = document.getElementById("dateModal");
    if (modal) modal.style.display = "none";
}


function generatePdfReport(opts = {}) {
    // opts: { data: [] }
    const { data } = opts || {};
    const { jsPDF } = window.jspdf || {};
    const doc = jsPDF ? new jsPDF() : null;

    const dataSource = (Array.isArray(data) && data.length)
        ? data
        : getExportRows("expenses", (typeof getExpenses === 'function' ? getExpenses() : []));

    const budgetIdsFromData = new Set();
    dataSource.forEach((entry) => {
        if (entry && entry.budgetId) {
            budgetIdsFromData.add(String(entry.budgetId));
        }
        if (Array.isArray(entry && entry.allocationTrail)) {
            entry.allocationTrail.forEach((item) => {
                if (item && item.budgetId) budgetIdsFromData.add(String(item.budgetId));
            });
        }
    });

    let budgets = getBudgets().filter(b => budgetIdsFromData.has(String(b && b.budgetId)));
    if (!budgets.length) {
        budgets = getBudgets();
    }
    const budgetIds = budgets
        .map(b => b && b.budgetId)
        .filter(Boolean);

    const ledgerFlowSummary = summarizeBudgetLedgerFlows(budgetIds, dataSource);
    const ledgerNetSpent = getNetSpentForBudgetSet(budgetIds, dataSource);

    let y = 12;

    if (!doc) {
        console.warn('generatePdfReport: jsPDF not available, aborting heavy report');
        return;
    }

    // =========================
    // 🟢 HEADER CARD
    // =========================
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(10, 8, 190, 22, 3, 3, "F");

    doc.setFontSize(16); // 🔽 reduced
    doc.setFont(undefined, "bold");
    doc.text("Money Tracker Report", 14, 17);

    doc.setFontSize(8); // 🔽 reduced
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Total Entries: ${dataSource.length}`, 14, 26);

    doc.setTextColor(0);
    y = 34;

    // =========================
    // 💰 SUMMARY CARDS
    // =========================
    const drawCard = (x, title, value, r, g, b) => {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(230);
        doc.roundedRect(x, y, 60, 18, 3, 3, "FD");

        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(title, x + 5, y + 6);

        doc.setFontSize(11);
        doc.setTextColor(r, g, b);
        doc.text(`${formatCurrencyPDF(value)}`, x + 5, y + 13);
    };

    const totalIncome = budgetIds.length
        ? ledgerFlowSummary.income
        : dataSource.filter(e => e.amount > 0)
            .reduce((s, e) => s + e.amount, 0);

    const totalExpense = budgetIds.length
        ? ledgerNetSpent
        : dataSource.filter(e => e.amount < 0)
            .reduce((s, e) => s + Math.abs(e.amount), 0);

    const net = totalIncome - totalExpense;

    drawCard(10, "Income", totalIncome, 0, 150, 0);
    drawCard(75, "Expense", totalExpense, 200, 0, 0);
    drawCard(140, "Net", net, net >= 0 ? 0 : 200, net >= 0 ? 150 : 0, 0);

    y += 28;

    // =========================
    // 📊 TABLE HEADER
    // =========================
    const col = {
        date: 17,
        type: 47,
        category: 67,
        payType: 97,   // 👈 move slightly left
        amount: 137,    // 👈 move right (important)
        purpose: 147    // 👈 give space for wrapping
    };

    const theme = localStorage.getItem("theme") || "#4caf50";
    const { r, g, b } = hexToRgb(theme);

    doc.setFillColor(Math.max(0, r - 20), Math.max(0, g - 20), Math.max(0, b - 20));
    doc.rect(10, y - 5, 190, 9, "F"); // 🔽 reduced height

    doc.setTextColor(255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(9); // 🔽 reduced

    doc.text("Date", col.date, y + 2, { align: "center" });
    doc.text("Type", col.type, y + 2, { align: "center" });

    doc.text("Category", col.category, y + 2, { align: "left" });
    doc.text("PayType", col.payType, y + 2, { align: "left" });

    doc.text("Amount", col.amount, y + 2, { align: "right" });

    doc.text("Purpose", col.purpose, y + 2, { align: "left" });

    y += 9;

    // =========================
    // 📄 TABLE DATA
    // =========================
    doc.setTextColor(0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8); // 🔽 reduced

    dataSource.forEach((e, index) => {
        const date = new Date(e.date).toLocaleDateString("en-IN");
        const category = e.category || "Others";
        const amount = Number(e.amount || 0);
        const refundDetails = [];
        if (e.type === "refund") refundDetails.push(`Type: ${formatRefundType(e.refundType)}`);
        if (e.resolutionType) refundDetails.push(`Resolution: ${RESOLUTION_TYPE_LABELS[normalizeResolutionType(e.resolutionType)] || e.resolutionType}`);
        const purpose = [e.purpose || "N/A"].concat(refundDetails).join(" | ");
        const payment = e.paymentType || e.entity || "-";
        const baseType = e.type ? e.type.toUpperCase() : (amount < 0 ? "EXPENSE" : "INCOME");
        const type = (e.type === "refund")
            ? `REFUND (${formatRefundType(e.refundType).toUpperCase()})`
            : baseType;

        const formatted = new Intl.NumberFormat("en-IN").format(Math.abs(amount));

        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(10, y - 4, 190, 8, "F");
        }

        doc.text(date, col.date, y, { align: "center" });

        doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);
        doc.text(type, col.type, y, { align: "center" });

        doc.setTextColor(0);
        doc.text(category, col.category, y);

        doc.text(payment, col.payType, y);

        doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);
        doc.text(formatCurrencyPDF(amount), col.amount, y, { align: "right" });

        doc.setTextColor(0);

        // ✅ Control width for purpose column
        let maxWidth = 50;   // 👈 reduce from 40 → better fit

        let splitPurpose = doc.splitTextToSize(purpose, maxWidth);

        // ✅ Draw text
        doc.text(splitPurpose, col.purpose, y);

        // ✅ Adjust row height dynamically
        let lineHeight = 5;
        let rowHeight = Math.max(9, splitPurpose.length * lineHeight);

        y += rowHeight;
    });

    // =========================
    // 🟣 BUDGET SUMMARY
    // =========================
    // =========================
    // 🟣 BUDGET SUMMARY (PERIOD BASED)
    // =========================
    y += 8;

    doc.setDrawColor(200);
    doc.line(10, y, 200, y);

    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Budget Summary (Active Period)", 14, y);

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Overview of budget vs spending", 14, y);

    doc.setTextColor(0);
    y += 5;

    // 🔥 PERIOD-BASED TOTALS
    // ensure summaryCols exists
    const summaryCols = {
        name: 14,
        allocated: 90,
        spent: 130,
        remaining: 170
    };

    let totalBudget = budgets.reduce((sum, b) => sum + Math.abs(b.totalAllocated || 0), 0);

    let totalSpent = budgetIds.length
        ? ledgerNetSpent
        : dataSource.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);

    // Use net-spent helper to compute remaining correctly (handles allocationTrail & recoveries)
    let totalRemaining = budgets.reduce((sum, b) => {
        const allocated = Math.abs(b.totalAllocated || 0);
        const netSpent = getNetSpentForBudget(b.budgetId, dataSource);
        return sum + (allocated - netSpent);
    }, 0);

    doc.setFont(undefined, "bold");
    doc.setFontSize(9);

    doc.text("Total Budget:", 14, y);
    doc.text(formatCurrencyPDF(totalBudget), summaryCols.allocated, y, { align: 'right' });

    y += 6;

    doc.text("Spent", summaryCols.spent, y + 1, { align: "right" });
    doc.text("Remaining", summaryCols.remaining, y + 1, { align: "right" });

    y += 10;


    // =========================
    // 📦 BUDGET ALLOCATIONS
    // =========================

    // =========================
    // 📦 BUDGET ENTRIES
    // =========================

    // budgets already computed above


    // =========================
    // 💰 TOTALS
    // =========================

    //let totalBudget = 0;

    //let totalSpent = 0;

    //let totalRemaining = 0;


    // =========================
    // 📄 PRINT BUDGET ROWS
    // =========================

    budgets.forEach((b, index) => {

        // =========================
        // 💵 ALLOCATED
        // =========================

        let allocated =
            Math.abs(
                b.totalAllocated || 0
            );

        // =========================
        // 💸 SPENT
        // =========================

        let spent = Math.max(0, getNetSpentForBudget(b.budgetId, dataSource));

        // =========================
        // 📊 REMAINING
        // =========================

        let remaining =
            allocated -
            spent;


        // =========================
        // 📈 TOTALS (already computed above)
        // =========================


        // =========================
        // 🎨 ALT ROW BG
        // =========================

        if (index % 2 === 0) {

            doc.setFillColor(
                248,
                248,
                248
            );

            doc.rect(
                10,
                y - 4,
                190,
                8,
                "F"
            );
        }


        // =========================
        // 🏷 NAME
        // =========================

        doc.setTextColor(0);

        doc.setFont(
            undefined,
            "normal"
        );

        doc.text(
            b.note ||
            b.name ||
            "Budget",
            summaryCols.name,
            y
        );


        // =========================
        // 💵 ALLOCATED
        // =========================

        doc.setTextColor(
            0,
            120,
            255
        );

        doc.text(
            formatCurrencyPDF(
                allocated
            ),
            summaryCols.allocated,
            y,
            { align: "right" }
        );


        // =========================
        // 💸 SPENT
        // =========================

        doc.setTextColor(
            220,
            0,
            0
        );

        doc.text(
            formatCurrencyPDF(
                spent
            ),
            summaryCols.spent,
            y,
            { align: "right" }
        );


        // =========================
        // 💰 REMAINING
        // =========================

        doc.setTextColor(

            remaining < 0
                ? 220
                : 0,

            remaining < 0
                ? 0
                : 150,

            0
        );

        doc.text(
            formatCurrencyPDF(
                remaining
            ),
            summaryCols.remaining,
            y,
            { align: "right" }
        );

        doc.setTextColor(0);

        y += 8;
    });


    // =========================
    // 📏 TOTAL DIVIDER
    // =========================

    y += 2;

    doc.setDrawColor(180);

    doc.line(10, y, 200, y);

    y += 8;


    // =========================
    // 📊 TOTAL SUMMARY
    // =========================

    doc.setFont(
        undefined,
        "bold"
    );


    // =========================
    // 💵 TOTAL BUDGET
    // =========================

    doc.setTextColor(0);

    doc.text(
        "Total Budget",
        summaryCols.name,
        y
    );

    doc.setTextColor(
        0,
        120,
        255
    );

    doc.text(
        formatCurrencyPDF(
            totalBudget
        ),
        summaryCols.allocated,
        y,
        { align: "right" }
    );

    y += 8;


    // =========================
    // 💸 TOTAL SPENT
    // =========================

    doc.setTextColor(0);

    doc.text(
        "Total Spent",
        summaryCols.name,
        y
    );

    doc.setTextColor(
        220,
        0,
        0
    );

    doc.text(
        formatCurrencyPDF(
            totalSpent
        ),
        summaryCols.spent,
        y,
        { align: "right" }
    );

    y += 8;


    // =========================
    // 💰 TOTAL REMAINING
    // =========================

    doc.setTextColor(0);

    doc.text(
        "Remaining",
        summaryCols.name,
        y
    );

    doc.setTextColor(

        totalRemaining < 0
            ? 220
            : 0,

        totalRemaining < 0
            ? 0
            : 150,

        0
    );

    doc.text(
        formatCurrencyPDF(
            totalRemaining
        ),
        summaryCols.remaining,
        y,
        { align: "right" }
    );

    doc.setTextColor(0);
    // =========================
    // 💾 SAVE
    // =========================
    if (doc && typeof doc.save === 'function') {
        doc.save("money-tracker-report.pdf");
    } else {
        console.warn('PDF generation unavailable (jsPDF not loaded)');
    }

}

// expose generator for new wrapper
try { window.generatePdfReport = generatePdfReport; } catch (e) { /* ignore */ }
//=== COMMENTED OLD DOWNLOAD END === */

// New PDF wrapper (calls modular PDF generator when available)
function downloadPDF() {
    const dataSource = getExportRows("expenses", getExpenses());
    if (typeof window.generatePdfReport === 'function') {
        window.generatePdfReport({ data: dataSource });
        return;
    }

    // Fallback to legacy simple export if new generator not available
    const jsPdfApi = window.jspdf || {};
    const jsPDF = jsPdfApi.jsPDF;
    if (!jsPDF) {
        showToast("PDF export unavailable offline: jsPDF not loaded", "warning");
        return;
    }
    const doc = new jsPDF();
    doc.text('Money Tracker (legacy) - No advanced PDF engine available', 10, 20);
    doc.save('money-tracker-report.pdf');
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");

    if (hex.length === 3) {
        hex = hex.split("").map(x => x + x).join("");
    }

    let bigint = parseInt(hex, 16);

    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return { r, g, b };
}

// =========================
// ReMo AI — Floating Companion
// Lightweight UI + Insight engine (local fallback)
// =========================

(function registerReMoAI() {
    // Inject minimal styles so no external CSS changes required
    const css = `
    .remo-ai-bubble{position:fixed;right:18px;bottom:78px;z-index:1200;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(16,24,40,0.12);backdrop-filter:blur(6px);cursor:pointer;transition:transform .18s ease,box-shadow .18s;}
    .remo-ai-bubble:hover{transform:translateY(-4px);box-shadow:0 10px 30px rgba(16,24,40,0.16);}
    .remo-ai-bubble .icon{width:28px;height:28px}
    .remo-ai-panel{position:fixed;right:12px;bottom:12px;z-index:1200;width:360px;max-height:78vh;background:var(--remo-panel-bg,#ffffff);color:var(--remo-panel-fg,#111827);border-radius:12px;box-shadow:0 20px 50px rgba(2,6,23,0.3);overflow:hidden;display:flex;flex-direction:column;transform:translateY(12px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .22s ease}
    .remo-ai-panel.open{opacity:1;pointer-events:auto;transform:translateY(0)}
    .remo-ai-header{padding:12px 14px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:10px}
    .remo-ai-header-meta{display:flex;flex-direction:column;flex:1}
    .remo-ai-nav{display:flex;gap:6px}
    .remo-ai-nav button{border:none;border-radius:8px;padding:6px 8px;font-size:12px;background:rgba(0,0,0,0.08);cursor:pointer}
    .remo-title{font-weight:700;font-size:14px}
    .remo-sub{font-size:11px;color:rgba(0,0,0,0.5)}
    .remo-body{padding:10px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px}
    .remo-section{border:1px solid rgba(0,0,0,0.08);border-radius:10px;padding:8px}
    .remo-section h4{margin:0 0 6px;font-size:12px}
    .remo-line{font-size:12px;line-height:1.35;padding:4px 0}
    .remo-line.critical{color:#b91c1c}
    .remo-line.warning{color:#92400e}
    .remo-line.good{color:#166534}
    .remo-chips{display:flex;flex-wrap:wrap;gap:8px}
    .remo-chip{background:rgba(0,0,0,0.06);padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer}
    .remo-messages{display:flex;flex-direction:column;gap:8px}
    .remo-msg{padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.03);font-size:13px}
    .remo-input{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(0,0,0,0.06)}
    .remo-input input{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.08)}
    .remo-send{background:var(--accent,#0ea5a4);color:#fff;padding:8px 10px;border-radius:8px;cursor:pointer}
    .remo-attachment-thumb{width:36px;height:36px;border-radius:6px;object-fit:cover}
    @media (prefers-color-scheme:dark){
        .remo-ai-bubble{background:linear-gradient(180deg,#0f1724,rgba(15,23,36,0.9));}
        .remo-ai-panel{--remo-panel-bg:#0b1220;--remo-panel-fg:#e6eef7}
        .remo-chip{background:rgba(255,255,255,0.04)}
        .remo-msg{background:rgba(255,255,255,0.02)}
    }
    `;

    const style = document.createElement('style');
    style.setAttribute('data-remo-ai', '1');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // Create bubble
    function createBubble() {
        const bubble = document.createElement('button');
        bubble.className = 'remo-ai-bubble';
        bubble.setAttribute('aria-label', 'Open ReMo AI');
        bubble.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                </defs>
                <circle cx="12" cy="12" r="10" fill="url(#g)" />
                <g fill="#fff">
                    <path d="M8 11.5c0-2.5 2-4.5 4.5-4.5S17 9 17 11.5 15 16 12.5 16 8 14 8 11.5z" opacity=".95"/>
                </g>
                <defs>
                    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0" stop-color="#2b6cb0"/>
                        <stop offset="1" stop-color="#06b6d4"/>
                    </linearGradient>
                </defs>
            </svg>`;

        document.body.appendChild(bubble);
        return bubble;
    }

    // Create panel
    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'remo-ai-panel';
        panel.innerHTML = `
            <div class="remo-ai-header">
                <div style="width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#0f1724,#0ea5a4);color:#fff">R</div>
                <div class="remo-ai-header-meta">
                    <div class="remo-title">ReMo AI</div>
                    <div class="remo-sub">Context-aware finance intelligence</div>
                </div>
                <div class="remo-ai-nav">
                    <button type="button" data-back>Back</button>
                    <button type="button" data-home>Home</button>
                    <button type="button" data-close>Close</button>
                </div>
            </div>
            <div class="remo-body">
                <div class="remo-section" data-priority></div>
                <div class="remo-chips" data-chips></div>
                <div class="remo-messages" data-messages></div>
            </div>
            <div class="remo-input">
                <input placeholder="Ask ReMo (e.g. 'Where did I spend most this week?')" data-userinput />
                <button class="remo-send" data-send>Ask</button>
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    function sumRange(entries, start, end, predicate) {
        return (entries || []).filter(row => {
            const d = new Date(row && row.date ? row.date : row && row.updatedAt ? row.updatedAt : Date.now());
            if (start && d < start) return false;
            if (end && d > end) return false;
            return typeof predicate === 'function' ? predicate(row) : true;
        }).reduce((sum, row) => sum + Number(row && row.amount ? row.amount : 0), 0);
    }

    function formatCurrencyShort(v) {
        try { return formatCurrencyPDF ? formatCurrencyPDF(v) : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v); } catch (e) { return v }
    }

    function collectReMoData() {
        const expenses = typeof getExpenses === 'function' ? getExpenses() : JSON.parse(localStorage.getItem('expenses') || '[]');
        const budgets = typeof getBudgets === 'function' ? getBudgets() : JSON.parse(localStorage.getItem('budgets') || '[]');
        const savings = typeof getSavings === 'function' ? getSavings() : JSON.parse(localStorage.getItem('savingsTransactions') || '[]');
        const periods = JSON.parse(localStorage.getItem('bp') || '[]');
        const orders = JSON.parse(localStorage.getItem('orders') || '[]');
        const quotationRegistry = JSON.parse(localStorage.getItem('quotationRegistry') || '[]');
        return { expenses, budgets, savings, periods, orders, quotationRegistry };
    }

    function buildPriorityInsights() {
        const now = new Date();
        const day30 = new Date(now); day30.setDate(now.getDate() - 30);
        const data = collectReMoData();

        const critical = [];
        const budgetRisks = [];
        const savingsOps = [];
        const pendingActions = [];
        const recommendations = [];

        const activePeriod = typeof getActiveBudgetPeriod === 'function' ? getActiveBudgetPeriod() : (Array.isArray(data.periods) ? data.periods.find(p => p && p.status === 'active') : null);
        if (!activePeriod) {
            critical.push('No active Budget Period. Budget, savings transfer controls, and analytics scope can drift.');
        }

        if (Array.isArray(data.budgets) && data.budgets.length) {
            data.budgets.forEach(b => {
                const allocated = Number(b && b.totalAllocated ? b.totalAllocated : 0);
                const spent = typeof getNetSpentForBudget === 'function'
                    ? getNetSpentForBudget(b.budgetId, data.expenses)
                    : Math.abs(sumRange(data.expenses, null, null, (e) => String(e && e.budgetId || '') === String(b && b.budgetId || '') && Number(e && e.amount || 0) < 0));
                const remaining = allocated - spent;
                const name = b && (b.name || b.entity || b.note) ? (b.name || b.entity || b.note) : 'Budget';

                if (remaining < 0) {
                    critical.push(`${name} exceeded by ${formatCurrencyShort(Math.abs(remaining))}.`);
                } else if (allocated > 0 && (spent / allocated) >= 0.8) {
                    budgetRisks.push(`${name} is ${(spent / allocated * 100).toFixed(0)}% used, ${formatCurrencyShort(remaining)} remaining.`);
                }
            });
        }

        const savingsDeposits = (data.savings || []).filter(s => s && s.type === 'deposit');
        const savingsOutflow = Math.abs(sumRange(data.savings, day30, now, (s) => Number(s && s.amount || 0) < 0));
        const savingsInflow = sumRange(data.savings, day30, now, (s) => Number(s && s.amount || 0) > 0);
        if (!savingsDeposits.length) {
            pendingActions.push('No savings deposits found. Add a source to improve order/payment flexibility.');
        } else if (savingsInflow > 0 && savingsOutflow > savingsInflow) {
            savingsOps.push(`Savings outflow (${formatCurrencyShort(savingsOutflow)}) is above inflow (${formatCurrencyShort(savingsInflow)}) in the last 30 days.`);
        }

        const pendingOrders = (data.orders || []).filter(o => ['draft', 'confirmed', 'processing'].includes(String(o && o.status || 'draft')));
        if (pendingOrders.length) {
            pendingActions.push(`${pendingOrders.length} orders are pending lifecycle actions.`);
        }

        const soonExpiringQuotes = (data.quotationRegistry || []).filter(q => {
            if (!q || !q.validUntil || String(q.status || '') === 'converted' || String(q.status || '') === 'rejected') return false;
            const exp = new Date(q.validUntil);
            const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
            return diffDays >= 0 && diffDays <= 3;
        });
        if (soonExpiringQuotes.length) {
            pendingActions.push(`${soonExpiringQuotes.length} quotations expire within 3 days.`);
        }

        if (!critical.length && !budgetRisks.length) {
            recommendations.push('No critical spend risk detected. Keep current budget discipline and continue weekly review.');
        }
        if (activePeriod && pendingOrders.length === 0 && soonExpiringQuotes.length === 0) {
            recommendations.push('Operational queue is clear. Good time to reconcile next period allocations.');
        }

        return {
            critical,
            budgetRisks,
            savingsOps,
            pendingActions,
            recommendations
        };
    }

    function renderPriorityDashboard(panel) {
        const host = panel.querySelector('[data-priority]');
        if (!host) return;

        const data = buildPriorityInsights();
        const sectionHtml = [
            { title: 'Priority 1 - Critical Alerts', className: 'critical', rows: data.critical },
            { title: 'Priority 2 - Budget Risks', className: 'warning', rows: data.budgetRisks },
            { title: 'Priority 3 - Savings Opportunities', className: 'good', rows: data.savingsOps },
            { title: 'Priority 4 - Pending Actions', className: 'warning', rows: data.pendingActions },
            { title: 'Priority 5 - Recommendations', className: 'good', rows: data.recommendations }
        ].map(section => {
            const lines = section.rows.length
                ? section.rows.map(line => `<div class="remo-line ${section.className}">${line}</div>`).join('')
                : `<div class="remo-line">No items.</div>`;
            return `<h4>${section.title}</h4>${lines}`;
        }).join('');

        host.innerHTML = sectionHtml;
    }

    function renderMessage(text, append = true) {
        const messages = document.querySelector('.remo-messages');
        if (!messages) return;
        const el = document.createElement('div');
        el.className = 'remo-msg';
        el.textContent = text;
        if (append) messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    }

    function tokenizePrompt(text) {
        return String(text || '')
            .toLowerCase()
            .replace(/[^a-z0-9\s?]/g, ' ')
            .split(/\s+/)
            .filter(Boolean);
    }

    function detectIntent(tokens, lower) {
        const has = (...words) => words.some((w) => lower.includes(w));
        if (has('how many', 'count', 'number of')) return 'COUNT';
        if (has('list', 'show all', 'all ')) return 'LIST';
        if (has('show', 'display')) return 'SHOW';
        if (has('highest', 'top', 'most', 'max')) return 'TOP';
        if (has('total', 'sum', 'overall')) return 'TOTAL';
        if (has('compare', 'vs', 'versus', 'difference')) return 'COMPARE';
        if (has('risk', 'alert', 'critical', 'danger')) return 'RISK';
        if (has('status', 'state')) return 'STATUS';
        return 'SUMMARY';
    }

    function detectEntity(tokens, lower) {
        const map = [
            { entity: 'Budget', keys: ['budget', 'budgets'] },
            { entity: 'Savings', keys: ['savings', 'saving', 'fund', 'wallet'] },
            { entity: 'Orders', keys: ['order', 'orders'] },
            { entity: 'Quotations', keys: ['quotation', 'quotations', 'quote', 'quotes', 'plan', 'plans'] },
            { entity: 'Expenses', keys: ['expense', 'expenses', 'spend', 'spent'] },
            { entity: 'Income', keys: ['income', 'earnings', 'credited'] },
            { entity: 'Categories', keys: ['category', 'categories'] }
        ];

        const found = map.find((row) => row.keys.some((k) => lower.includes(k)));
        return found ? found.entity : 'General';
    }

    function getEntityRecords(entity) {
        if (entity === 'Budget') return (typeof getBudgets === 'function' ? getBudgets() : []) || [];
        if (entity === 'Savings') return (typeof getSavings === 'function' ? getSavings() : []) || [];
        if (entity === 'Orders') return JSON.parse(localStorage.getItem('orders') || '[]');
        if (entity === 'Quotations') {
            if (window.DocWorkflow && typeof window.DocWorkflow.getQuotationRegistry === 'function') {
                return window.DocWorkflow.getQuotationRegistry() || [];
            }
            return JSON.parse(localStorage.getItem('quotationRegistry') || '[]');
        }
        if (entity === 'Expenses') return ((typeof getExpenses === 'function' ? getExpenses() : []) || []).filter((e) => Number(e.amount || 0) < 0);
        if (entity === 'Income') return ((typeof getExpenses === 'function' ? getExpenses() : []) || []).filter((e) => Number(e.amount || 0) > 0);
        if (entity === 'Categories') return (typeof getCategories === 'function' ? getCategories() : []) || [];
        return [];
    }

    function formatRecordName(entity, row) {
        if (!row) return '-';
        if (entity === 'Budget') return row.name || row.note || row.entity || row.budgetId || row.id || '-';
        if (entity === 'Savings') return row.note || row.entity || row.id || '-';
        if (entity === 'Orders') return row.orderNo || row.id || '-';
        if (entity === 'Quotations') return row.quotationNo || row.id || '-';
        if (entity === 'Expenses' || entity === 'Income') return row.purpose || row.note || row.category || row.id || '-';
        return String(row);
    }

    function buildDataDrivenReply(analysis) {
        const records = getEntityRecords(analysis.entity);
        const lower = analysis.lower;
        const isActive = /active/.test(lower);
        const isDraft = /draft/.test(lower);

        let filtered = records;
        if (analysis.entity === 'Budget' && isActive && typeof getActiveBudgetPeriod === 'function') {
            const active = getActiveBudgetPeriod();
            const key = active && active.periodKey ? String(active.periodKey) : '';
            if (key) {
                filtered = records.filter((b) => String(b.periodKey || '') === key);
            }
        }
        if (analysis.entity === 'Orders' && isDraft) filtered = records.filter((o) => String(o.status || 'draft') === 'draft');
        if (analysis.entity === 'Quotations' && isDraft) filtered = records.filter((q) => String(q.status || 'draft') === 'draft');

        let response = '';
        if (analysis.intent === 'COUNT') {
            response = `${analysis.entity} count: ${filtered.length}.`;
        } else if (analysis.intent === 'LIST' || analysis.intent === 'SHOW') {
            const names = filtered.slice(0, 6).map((row) => formatRecordName(analysis.entity, row));
            response = names.length ? `${analysis.entity}: ${names.join(', ')}.` : `No ${analysis.entity.toLowerCase()} records found.`;
        } else if (analysis.intent === 'TOP') {
            if (analysis.entity === 'Budget') {
                const grouped = new Map();
                filtered.forEach((row) => {
                    const id = String(row.budgetId || row.id || '');
                    if (!id) return;
                    const prev = grouped.get(id) || { name: formatRecordName('Budget', row), total: 0 };
                    prev.total += Number(row.totalAllocated || row.amount || 0);
                    grouped.set(id, prev);
                });
                const top = Array.from(grouped.values()).sort((a, b) => b.total - a.total)[0];
                response = top ? `Highest budget is ${top.name} at ${formatCurrency(top.total)}.` : 'No budget records found.';
            } else if (analysis.entity === 'Categories') {
                const expenseRows = getEntityRecords('Expenses');
                const grouped = new Map();
                expenseRows.forEach((e) => {
                    const name = String(e.category || 'Others');
                    grouped.set(name, (grouped.get(name) || 0) + Math.abs(Number(e.amount || 0)));
                });
                const top = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])[0];
                response = top ? `Top spending category is ${top[0]} at ${formatCurrency(top[1])}.` : 'No category spending found.';
            } else {
                response = `Top query for ${analysis.entity} is not available yet; try count or list.`;
            }
        } else if (analysis.intent === 'TOTAL') {
            if (analysis.entity === 'Budget') {
                const total = filtered.reduce((sum, b) => sum + Number(b.totalAllocated || b.amount || 0), 0);
                response = `Total budget allocation is ${formatCurrency(total)}.`;
            } else if (analysis.entity === 'Savings') {
                const total = filtered.reduce((sum, s) => sum + Number(s.amount || 0), 0);
                response = `Total savings balance is ${formatCurrency(total)}.`;
            } else if (analysis.entity === 'Expenses' || analysis.entity === 'Income') {
                const total = filtered.reduce((sum, e) => sum + Math.abs(Number(e.amount || 0)), 0);
                response = `Total ${analysis.entity.toLowerCase()} is ${formatCurrency(total)}.`;
            } else {
                response = `${analysis.entity} total records: ${filtered.length}.`;
            }
        } else if (analysis.intent === 'COMPARE') {
            const budgetTotal = getEntityRecords('Budget').reduce((sum, b) => sum + Number(b.totalAllocated || b.amount || 0), 0);
            const expenseTotal = getEntityRecords('Expenses').reduce((sum, e) => sum + Math.abs(Number(e.amount || 0)), 0);
            const delta = budgetTotal - expenseTotal;
            response = `Budget vs expense: ${formatCurrency(budgetTotal)} vs ${formatCurrency(expenseTotal)} (difference ${formatCurrency(delta)}).`;
        } else if (analysis.intent === 'STATUS') {
            if (analysis.entity === 'Orders' || analysis.entity === 'Quotations') {
                const grouped = new Map();
                filtered.forEach((row) => {
                    const s = String(row.status || 'draft');
                    grouped.set(s, (grouped.get(s) || 0) + 1);
                });
                const parts = Array.from(grouped.entries()).map(([k, v]) => `${k}: ${v}`);
                response = parts.length ? `${analysis.entity} status summary: ${parts.join(', ')}.` : `No ${analysis.entity.toLowerCase()} records found.`;
            } else {
                response = `${analysis.entity} status query is not applicable.`;
            }
        } else if (analysis.intent === 'RISK') {
            const model = buildPriorityInsights();
            response = model.critical.concat(model.budgetRisks).slice(0, 3).join(' ') || 'No immediate critical risk detected.';
        } else {
            const model = buildPriorityInsights();
            response = model.critical.concat(model.budgetRisks, model.savingsOps, model.pendingActions).slice(0, 3).join(' ') || 'No summary available from current records.';
        }

        return {
            records: filtered,
            response: response || 'No matching response generated.'
        };
    }

    function analyzeUserPrompt(text) {
        const raw = String(text || '').trim();
        const lower = raw.toLowerCase();
        const tokens = tokenizePrompt(raw);

        const questionHeads = ['what', 'why', 'when', 'where', 'who', 'which', 'how'];
        const auxHeads = ['is', 'am', 'are', 'was', 'were', 'can', 'could', 'should', 'would', 'do', 'does', 'did'];
        const startsWithQuestionHead = questionHeads.concat(auxHeads).some(head => lower.startsWith(`${head} `));
        const isQuestion = startsWithQuestionHead || /\?$/.test(lower);
        const questionType = tokens[0] || '';

        const stopWords = new Set([
            'the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'at', 'and', 'or', 'please', 'show', 'tell', 'me',
            'what', 'why', 'when', 'where', 'who', 'which', 'how', 'is', 'am', 'are', 'was', 'were', 'can', 'could',
            'should', 'would', 'do', 'does', 'did'
        ]);
        const keywords = tokens.filter(t => !stopWords.has(t)).slice(0, 6);

        const has = (...words) => words.some(w => lower.includes(w));
        const route = has('open ', 'go to', 'navigate', 'take me') || has('home', 'dashboard');
        const intent = detectIntent(tokens, lower);
        const entity = detectEntity(tokens, lower);

        return {
            raw,
            lower,
            tokens,
            keywords,
            isQuestion,
            questionType,
            intent,
            entity,
            route
        };
    }

    function buildIntentReply(analysis) {
        const dataReply = buildDataDrivenReply(analysis);
        return dataReply.response;
    }

    function buildChipsFromAnalysis(analysis) {
        const chips = [];
        const pushChip = (text) => {
            if (!chips.includes(text) && chips.length < 6) chips.push(text);
        };

        const byIntent = {
            COUNT: ['How many active budgets', 'How many draft orders', 'How many draft quotations'],
            LIST: ['Show all savings accounts', 'Show all categories', 'Show all orders'],
            SHOW: ['Show budget status', 'Show quotation status', 'Show order status'],
            TOP: ['What is my highest budget', 'Which category spent most', 'Top spending category'],
            TOTAL: ['Total savings', 'Total expenses', 'Total budget allocation'],
            COMPARE: ['Compare budget vs expenses', 'Compare income and expenses', 'Compare orders and quotations'],
            RISK: ['Show budget risks', 'Show critical alerts', 'Show pending actions'],
            STATUS: ['Orders status summary', 'Quotations status summary', 'Budget status'],
            SUMMARY: ['Show summary', 'Show critical alerts', 'Show recommendations']
        };

        (byIntent[analysis.intent] || byIntent.SUMMARY).forEach(pushChip);
        if (analysis.keywords.includes('order')) pushChip('Open orders');
        if (analysis.keywords.includes('quotation') || analysis.keywords.includes('quote')) pushChip('Open quotation');
        if (analysis.keywords.includes('saving') || analysis.keywords.includes('savings')) pushChip('Open savings');
        if (analysis.keywords.includes('budget')) pushChip('Open budget period');
        if (analysis.isQuestion) pushChip('Show recommendations');

        return chips;
    }

    function renderChips(panel, labels) {
        const chips = panel.querySelector('[data-chips]');
        if (!chips) return;
        chips.innerHTML = '';
        labels.forEach(label => {
            const b = document.createElement('button');
            b.className = 'remo-chip';
            b.type = 'button';
            b.textContent = label;
            b.onclick = () => {
                renderMessage(label);
                const reply = processReMoPrompt(label, panel);
                setTimeout(() => renderMessage(reply), 160);
            };
            chips.appendChild(b);
        });
    }

    function routeReMoCommand(analysis, panel) {
        const ask = analysis.lower;
        if (!analysis.route && !/^open\s+/.test(ask)) return null;

        const go = (target) => {
            if (location.pathname.includes('/pages/')) {
                window.location.href = `${target}.html`;
            } else if (typeof window.showScreen === 'function' && document.querySelector('.screen')) {
                window.showScreen(target === 'budgetperiod' ? 'budget' : target);
            } else {
                window.location.href = `pages/${target}.html`;
            }
            panel.classList.remove('open');
        };

        if (/home|dashboard/.test(ask)) {
            goHomeFromAI(panel);
            return 'Opened home dashboard.';
        }
        if (/order/.test(ask)) {
            go('orders');
            return 'Opened orders.';
        }
        if (/quotation|quote/.test(ask)) {
            go('quotations');
            return 'Opened quotations workspace.';
        }
        if (/saving/.test(ask)) {
            go('savings');
            return 'Opened savings.';
        }
        if (/budget/.test(ask)) {
            go('budgetperiod');
            return 'Opened budget period.';
        }
        return null;
    }

    function processReMoPrompt(text, panel) {
        const analysis = analyzeUserPrompt(text);
        renderChips(panel, buildChipsFromAnalysis(analysis));

        console.debug('[ReMo] Detected Intent:', analysis.intent);
        console.debug('[ReMo] Detected Entity:', analysis.entity);

        const routeReply = routeReMoCommand(analysis, panel);
        if (routeReply) return routeReply;

        const dataReply = buildDataDrivenReply(analysis);
        console.debug('[ReMo] Matched Records:', Array.isArray(dataReply.records) ? dataReply.records.length : 0);
        const response = dataReply.response || buildIntentReply(analysis);
        console.debug('[ReMo] Generated Response:', response);
        if (!response || !String(response).trim()) {
            return 'I could not confidently classify that request. Ask about critical alerts, budget risks, savings opportunities, pending actions, or recommendations.';
        }
        return response;
    }

    function openPanel(panel, previousScreenId) {
        panel.classList.add('open');
        panel.dataset.prevScreen = previousScreenId || '';
        renderPriorityDashboard(panel);
        renderChips(panel, ['Show critical alerts', 'Show budget risks', 'Show savings opportunities', 'Show pending actions', 'Show recommendations']);
        panel.querySelector('[data-messages]').innerHTML = '';
        renderMessage('AI dashboard loaded from live app data. Ask for critical, budget, savings, pending, or recommendations.');
    }

    function restorePreviousScreen(panel) {
        const prev = panel.dataset.prevScreen || '';
        if (prev && typeof window.showScreen === 'function') {
            window.showScreen(prev);
        }
        panel.classList.remove('open');
    }

    function goHomeFromAI(panel) {
        if (typeof window.showScreen === 'function' && document.querySelector('.screen')) {
            window.showScreen('home');
            panel.classList.remove('open');
            return;
        }
        if (location.pathname.includes('/pages/')) {
            window.location.href = '../index.html';
            return;
        }
        panel.classList.remove('open');
    }

    function init() {
        try {
            // load ReMo styles (lightweight)
            if (!document.querySelector('link[data-remo-css]')) {
                const l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = location.pathname.includes('/pages/')
                    ? '../assets/styles/remo.css'
                    : 'assets/styles/remo.css';
                l.setAttribute('data-remo-css', '1');
                document.head.appendChild(l);
            }

            // lazy-load attachments module (IndexedDB-backed) for offline-first attachments
            if (!window.reMoAttachmentsIndexed && !document.querySelector('script[data-remo-attach]')) {
                const s = document.createElement('script');
                s.src = location.pathname.includes('/pages/')
                    ? '../assets/scripts/remo/attachments.js'
                    : 'assets/scripts/remo/attachments.js';
                s.setAttribute('data-remo-attach', '1');
                document.body.appendChild(s);
            }

            const bubble = createBubble();
            const panel = createPanel();

            bubble.addEventListener('click', () => {
                if (panel.classList.contains('open')) { panel.classList.remove('open'); }
                else {
                    let active = document.querySelector('.screen.active');
                    openPanel(panel, active ? active.id : '');
                }
            });

            panel.querySelector('[data-close]').addEventListener('click', () => panel.classList.remove('open'));
            panel.querySelector('[data-home]').addEventListener('click', () => goHomeFromAI(panel));
            panel.querySelector('[data-back]').addEventListener('click', () => restorePreviousScreen(panel));

            // Send handler
            panel.querySelector('[data-send]').addEventListener('click', () => {
                const input = panel.querySelector('[data-userinput]');
                const text = (input.value || '').trim();
                if (!text) return;
                renderMessage(text);
                const reply = processReMoPrompt(text, panel);
                setTimeout(() => renderMessage(reply), 200);
                input.value = '';
            });

            // keyboard enter
            panel.querySelector('[data-userinput]').addEventListener('keydown', (e) => {
                if (e.key === 'Enter') panel.querySelector('[data-send]').click();
            });

            // gentle entrance animation
            setTimeout(() => bubble.style.transform = 'translateY(0)', 100);
        } catch (e) { console.warn('ReMo init failed', e) }
    }

    // Initialize after load
    if (document.readyState === 'complete') init(); else window.addEventListener('load', init);

    // Attachment helper (switches to IndexedDB-backed implementation when available)
    window.reMoAttachments = window.reMoAttachmentsIndexed || {
        storePreview: async function (transactionId, file) {
            if (!file) return null;
            return new Promise((res, rej) => {
                const fr = new FileReader();
                fr.onload = () => {
                    try { const key = `remo:attach:${transactionId}`; localStorage.setItem(key, fr.result); res(fr.result); } catch (err) { rej(err) }
                };
                fr.onerror = rej;
                fr.readAsDataURL(file);
            });
        },
        getPreview: function (transactionId) { return localStorage.getItem(`remo:attach:${transactionId}`); },
        remove: function (transactionId) { localStorage.removeItem(`remo:attach:${transactionId}`); }
    };

})();

// =========================
// Attachment viewer + input wiring
// =========================

function openAttachmentViewer(src) {
    return openAttachmentOverlay({ src, kind: "image", title: "Image preview" });
}

function openAttachmentOverlay({ src, kind = "image", title = "Attachment preview" }) {
    let existing = document.getElementById('remo-attach-viewer');
    if (existing) existing.remove();

    const auditModal = document.getElementById('txnDetailsModal');
    if (auditModal && auditModal.style.display !== 'none') {
        auditModal.classList.add('modal-layer-muted');
    }

    const overlay = document.createElement('div');
    overlay.id = 'remo-attach-viewer';
    overlay.className = 'attachment-viewer-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-label', title);

    const panel = document.createElement('div');
    panel.className = 'attachment-viewer-panel';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'attachment-viewer-close';
    close.textContent = 'Close';

    const closeOverlay = () => {
        if (overlay.dataset.objectUrl) {
            try { URL.revokeObjectURL(overlay.dataset.objectUrl); } catch (_err) { }
        }
        overlay.remove();
        const txnModal = document.getElementById('txnDetailsModal');
        if (txnModal) txnModal.classList.remove('modal-layer-muted');
        document.removeEventListener('keydown', onEscape, true);
    };

    const onEscape = (event) => {
        if (event.key === 'Escape') closeOverlay();
    };

    close.addEventListener('click', closeOverlay);
    overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closeOverlay();
    });
    document.addEventListener('keydown', onEscape, true);

    panel.appendChild(close);

    if (kind === 'document') {
        const frame = document.createElement('iframe');
        frame.className = 'attachment-viewer-frame';
        frame.src = src;
        frame.setAttribute('title', title);
        panel.appendChild(frame);
    } else if (kind === 'video') {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.autoplay = false;
        video.className = 'attachment-viewer-image';
        panel.appendChild(video);
    } else if (kind === 'audio') {
        const audio = document.createElement('audio');
        audio.src = src;
        audio.controls = true;
        audio.autoplay = false;
        audio.style.width = '100%';
        panel.appendChild(audio);
    } else if (kind === 'text') {
        const pre = document.createElement('pre');
        pre.className = 'attachment-viewer-text';
        pre.style.whiteSpace = 'pre-wrap';
        pre.style.maxHeight = '70vh';
        pre.style.overflow = 'auto';
        pre.textContent = String(src || '');
        panel.appendChild(pre);
    } else {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'attachment-viewer-image';
        let zoomed = false;
        img.addEventListener('dblclick', () => {
            zoomed = !zoomed;
            img.style.transform = zoomed ? 'scale(1.6)' : 'scale(1)';
        });
        panel.appendChild(img);
    }

    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    return overlay;
}

function escapeHtml(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// =========================
// 🗂️ TAB BAR HELPER (shared)
// =========================
// Generic tab switcher. Works for any tab-bar/tab-panel pair as long as
// their data-tab-group values match. onActivate lets a specific tab run
// setup code (e.g. render its content) only the moment it's first opened.
function activateTab(groupName, tabKey, onActivate) {
    let bar = document.querySelector(`.tab-bar[data-tab-group="${groupName}"]`);
    if (!bar) return;

    bar.querySelectorAll(".tab-bar-btn").forEach(btn => {
        btn.classList.toggle("is-active", btn.dataset.tabKey === tabKey);
    });

    document.querySelectorAll(`.tab-panel[data-tab-group="${groupName}"]`).forEach(panel => {
        panel.classList.toggle("is-active", panel.dataset.tabKey === tabKey);
    });

    if (typeof onActivate === "function") onActivate(tabKey);
}

// Daily Ledger's own init only runs on DOMContentLoaded inside its own
// file — but its markup doesn't exist yet at that point when it's a tab.
// So we call its real render/bind functions ourselves, the first time
// (and every time) the tab is actually opened.
function onDailyLedgerTabOpened() {
    if (typeof window.renderDailyBudgetLedger === "function") {
        window.renderDailyBudgetLedger();
    }
    let saveBtn = document.getElementById("saveDailyBudget");
    if (saveBtn && !saveBtn.dataset.ledgerBound) {
        saveBtn.dataset.ledgerBound = "true";
        saveBtn.addEventListener("click", function () {
            if (typeof window.handleBudgetSave === "function") {
                window.handleBudgetSave();
            }
        });
    }
}
function getAttachmentApi() {
    return window.reMoAttachments || window.reMoAttachmentsIndexed || null;
}

function getAttachmentExtension(filename) {
    const name = String(filename || "");
    const idx = name.lastIndexOf(".");
    if (idx === -1) return "";
    return name.slice(idx + 1).toLowerCase();
}

function formatAttachmentSize(size) {
    const bytes = Number(size || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function normalizeAttachmentRecord(record, id) {
    const filename = record && record.filename ? String(record.filename) : `attachment_${id}`;
    const mimeType = record && record.mime ? String(record.mime) : "application/octet-stream";
    const extension = record && record.extension ? String(record.extension) : getAttachmentExtension(filename);
    const size = Number(record && (record.size || (record.blob && record.blob.size) || 0) || 0);
    const uploadedDateRaw = record && (record.uploadedDate || record.createdAt);
    const uploadedDate = uploadedDateRaw
        ? new Date(uploadedDateRaw).toISOString()
        : new Date().toISOString();

    return {
        id: String(id || (record && record.id) || ""),
        fileName: filename,
        extension,
        mimeType,
        size,
        uploadedDate,
        data: record && record.blob ? record.blob : null,
        raw: record || null
    };
}

function buildLocalAttachmentKey(id) {
    return `remo:attach:${String(id || "")}`;
}

function buildLocalAttachmentMetaKey(id) {
    return `remo:attach:meta:${String(id || "")}`;
}

(function registerAttachmentService() {
    function classifyMime(meta) {
        const mime = String(meta && meta.mimeType || "application/octet-stream").toLowerCase();
        const ext = String(meta && meta.extension || "").toLowerCase();

        if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "bmp"].includes(ext)) return "image";
        if (mime === "application/pdf" || ext === "pdf") return "pdf";
        if (mime.startsWith("video/") || ["mp4", "webm", "mov"].includes(ext)) return "video";
        if (mime.startsWith("audio/") || ["mp3", "wav", "m4a"].includes(ext)) return "audio";
        if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
        if (mime.startsWith("text/") || ["txt", "csv", "json", "xml"].includes(ext)) return "text";
        return "unknown";
    }

    async function saveAttachment(file, options = {}) {
        if (!file) return null;

        const at = getAttachmentApi();
        const requestedId = options && options.id ? String(options.id) : null;
        const generatedId = requestedId || (crypto && crypto.randomUUID ? crypto.randomUUID() : `atta_${Date.now()}`);

        if (at && typeof at.storeImage === "function") {
            const stored = await at.storeImage(generatedId, file);
            let rec = null;
            if (at.getRecord) {
                try { rec = await at.getRecord(stored.id); } catch (_err) { rec = null; }
            }
            return normalizeAttachmentRecord(rec || {
                id: stored.id,
                filename: file.name,
                extension: getAttachmentExtension(file.name),
                mime: file.type || "application/octet-stream",
                size: Number(file.size || 0),
                uploadedDate: new Date().toISOString(),
                blob: file
            }, stored.id);
        }

        const reader = new FileReader();
        const dataUrl = await new Promise((resolve, reject) => {
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error || new Error("Attachment read failed"));
            reader.readAsDataURL(file);
        });

        const id = generatedId;
        localStorage.setItem(buildLocalAttachmentKey(id), String(dataUrl || ""));
        localStorage.setItem(buildLocalAttachmentMetaKey(id), JSON.stringify({
            id,
            filename: file.name || `attachment_${id}`,
            extension: getAttachmentExtension(file.name || ""),
            mime: file.type || "application/octet-stream",
            size: Number(file.size || 0),
            uploadedDate: new Date().toISOString(),
            createdAt: Date.now()
        }));

        return normalizeAttachmentRecord(JSON.parse(localStorage.getItem(buildLocalAttachmentMetaKey(id)) || "null"), id);
    }

    async function uploadAttachment(fileOrInput, options = {}) {
        const file = (fileOrInput instanceof File)
            ? fileOrInput
            : (fileOrInput && fileOrInput.files && fileOrInput.files[0] ? fileOrInput.files[0] : null);
        if (!file) return null;
        return saveAttachment(file, options);
    }

    async function getAttachmentMeta(attachmentId) {
        const id = String(attachmentId || "");
        if (!id) return null;

        const at = getAttachmentApi();
        if (at && typeof at.getRecord === "function") {
            try {
                const rec = await at.getRecord(id);
                if (rec) return normalizeAttachmentRecord(rec, id);
            } catch (_err) {
            }
        }

        const rawMeta = localStorage.getItem(buildLocalAttachmentMetaKey(id));
        if (rawMeta) {
            try {
                return normalizeAttachmentRecord(JSON.parse(rawMeta), id);
            } catch (_err) {
            }
        }

        return normalizeAttachmentRecord(null, id);
    }

    async function getAttachmentBlob(attachmentId) {
        const id = String(attachmentId || "");
        if (!id) return null;

        function normalizeBlobLike(value, mimeHint) {
            if (!value) return null;
            if (typeof Blob !== "undefined" && value instanceof Blob) return value;
            if (typeof value === "string") {
                if (value.startsWith("data:")) {
                    const commaIdx = value.indexOf(",");
                    if (commaIdx !== -1) {
                        const mime = value.slice(5, commaIdx).split(";")[0] || mimeHint || "application/octet-stream";
                        const base64 = value.slice(commaIdx + 1);
                        const bytes = atob(base64);
                        const arr = new Uint8Array(bytes.length);
                        for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
                        return new Blob([arr], { type: mime });
                    }
                }
                return new Blob([value], { type: mimeHint || "text/plain" });
            }
            if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
                return new Blob([value], { type: mimeHint || "application/octet-stream" });
            }
            if (value && typeof value === "object" && typeof value.data !== "undefined") {
                return normalizeBlobLike(value.data, mimeHint);
            }
            return new Blob([JSON.stringify(value)], { type: "application/json" });
        }

        const at = getAttachmentApi();
        if (at && typeof at.getBlob === "function") {
            try {
                const raw = await at.getBlob(id);
                if (raw) {
                    const meta = await getAttachmentMeta(id);
                    const normalized = normalizeBlobLike(raw, meta && meta.mimeType ? meta.mimeType : "application/octet-stream");
                    if (normalized) return normalized;
                }
            } catch (_err) {
            }
        }

        const dataUrl = localStorage.getItem(buildLocalAttachmentKey(id));
        if (!dataUrl || !dataUrl.startsWith("data:")) return null;
        const commaIdx = dataUrl.indexOf(",");
        if (commaIdx === -1) return null;
        return normalizeBlobLike(dataUrl, "application/octet-stream");
    }

    async function previewAttachment(meta, blob) {
        const kind = classifyMime(meta);
        if (kind === "image") {
            const url = URL.createObjectURL(blob);
            const opened = openAttachmentOverlay({ src: url, kind: "image", title: meta.fileName || "Image" });
            if (opened) opened.dataset.objectUrl = url;
            return { mode: "image" };
        }
        if (kind === "pdf") {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_err) { } }, 30000);
            return { mode: "pdf" };
        }
        if (kind === "video") {
            const url = URL.createObjectURL(blob);
            const opened = openAttachmentOverlay({ src: url, kind: "video", title: meta.fileName || "Video" });
            if (opened) opened.dataset.objectUrl = url;
            return { mode: "video" };
        }
        if (kind === "audio") {
            const url = URL.createObjectURL(blob);
            const opened = openAttachmentOverlay({ src: url, kind: "audio", title: meta.fileName || "Audio" });
            if (opened) opened.dataset.objectUrl = url;
            return { mode: "audio" };
        }
        if (kind === "text") {
            const text = (blob && typeof blob.text === "function")
                ? await blob.text()
                : String(blob || "");
            openAttachmentOverlay({ src: text, kind: "text", title: meta.fileName || "Text Preview" });
            return { mode: "text" };
        }
        if (kind === "office") {
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_err) { } }, 30000);
            return { mode: "office" };
        }

        return { mode: "unknown" };
    }

    async function openAttachment(attachmentId) {
        const meta = await getAttachmentMeta(attachmentId);
        const blob = await getAttachmentBlob(attachmentId);
        if (!blob) {
            showToast("Attachment data unavailable", "warning");
            return { meta, opened: false };
        }
        const opened = await previewAttachment(meta, blob);
        if (opened.mode === "unknown") {
            await downloadAttachment(attachmentId, meta.fileName);
            showToast("Unknown format: downloaded attachment", "info");
        }
        return { meta, opened: true, mode: opened.mode };
    }

    async function downloadAttachment(attachmentId, filenameHint) {
        const meta = await getAttachmentMeta(attachmentId);
        const blob = await getAttachmentBlob(attachmentId);
        if (!blob) return false;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filenameHint || meta.fileName || `attachment_${attachmentId}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch (_err) { } }, 15000);
        return true;
    }

    async function deleteAttachment(attachmentId) {
        const id = String(attachmentId || "");
        if (!id) return false;

        const at = getAttachmentApi();
        if (at && typeof at.remove === "function") {
            try { await at.remove(id); } catch (_err) { }
        }

        localStorage.removeItem(buildLocalAttachmentKey(id));
        localStorage.removeItem(buildLocalAttachmentMetaKey(id));
        return true;
    }

    window.AttachmentService = {
        uploadAttachment,
        saveAttachment,
        openAttachment,
        previewAttachment,
        downloadAttachment,
        deleteAttachment,
        getAttachmentMeta,
        getAttachmentBlob,
        classifyMime,
        formatAttachmentSize
    };
})();

function ensureAuditModal() {
    let existing = document.getElementById("txnDetailsModal");
    if (existing) return existing;

    let modal = document.createElement("div");
    modal.id = "txnDetailsModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content audit-modal-content" onclick="event.stopPropagation()">
        <div class="audit-modal-header">
          <div>
            <h3>Transaction Details</h3>
            <p class="audit-modal-subtitle">Review the linked budget, source, and resolution state for this entry.</p>
          </div>
        </div>
        <div id="txnDetailsBody" class="audit-details-grid"></div>
        <div id="txnAttachmentSection" class="audit-attachments" style="display:none;"></div>
        <div class="modal-actions">
          <button class="secondary" onclick="closeTransactionAuditDetails()">Close</button>
        </div>
      </div>
    `;
    modal.addEventListener("click", closeTransactionAuditDetails);
    document.body.appendChild(modal);
    return modal;
}

function closeTransactionAuditDetails() {
    let modal = document.getElementById("txnDetailsModal");
    if (modal) modal.style.display = "none";
}

async function viewAttachmentById(attachmentId) {
    if (!attachmentId || !window.AttachmentService) return;
    try {
        await window.AttachmentService.openAttachment(attachmentId);
    } catch (err) {
        console.warn("viewAttachmentById failed", err);
    }
}

async function downloadAttachmentById(attachmentId, filenameHint) {
    if (!attachmentId || !window.AttachmentService) return;
    try {
        await window.AttachmentService.downloadAttachment(attachmentId, filenameHint);
    } catch (err) {
        console.warn("downloadAttachmentById failed", err);
    }
}

async function deleteTransactionAttachment(scope, transactionId, attachmentId) {
    if (!scope || !transactionId || !attachmentId) return;

    try {
        if (scope === "expense") {
            let expenses = getExpenses();
            let target = expenses.find(e => String(e.id) === String(transactionId));
            if (!target) return;
            target.attachmentId = null;
            target.updatedAt = new Date().toISOString();
            saveExpenses(expenses);
            if (typeof loadHistory === "function") loadHistory();
        } else if (scope === "savings" && typeof getSavings === "function" && typeof saveSavings === "function") {
            let savings = getSavings();
            let target = savings.find(s => String(s.id) === String(transactionId));
            if (!target) return;
            target.attachmentId = null;
            target.updatedAt = new Date().toISOString();
            saveSavings(savings);
            if (typeof renderSavingsHistory === "function") renderSavingsHistory(savings);
        }

        if (window.AttachmentService) await window.AttachmentService.deleteAttachment(attachmentId);

        closeTransactionAuditDetails();
        showToast("Attachment deleted");
    } catch (err) {
        console.warn("deleteTransactionAttachment failed", err);
    }
}

async function openTransactionAuditDetails(scope, transaction) {
    if (!transaction) return;

    let modal = ensureAuditModal();
    let body = document.getElementById("txnDetailsBody");
    let attachmentSection = document.getElementById("txnAttachmentSection");
    if (!body || !attachmentSection) return;

    let createdAt = transaction.createdAt || transaction.date;
    let persistedAfter = Number(transaction.BalanceAfterTransaction);
    let fallbackRunning = Number(transaction.runningBalance);
    let runningBalanceText = Number.isFinite(persistedAfter)
        ? formatCurrency(persistedAfter)
        : (Number.isFinite(fallbackRunning) ? formatCurrency(fallbackRunning) : "-");

    let summary = null;
    let summaryTarget = null;
    if ((transaction.type === "expense" || transaction.type === "transfer" || transaction.type === "loss") && Number(transaction.amount || 0) < 0) {
        summaryTarget = String(transaction.id);
    } else if (transaction.linkedTransactionId) {
        summaryTarget = String(transaction.linkedTransactionId);
    }
    if (summaryTarget) {
        if (scope === "savings" && typeof getSavingsResolutionSnapshot === "function") {
            summary = getSavingsResolutionSnapshot(summaryTarget);
        } else {
            summary = getExpenseResolutionSnapshot(summaryTarget);
        }
    }

    let summaryStatusText = "-";
    if (summary && summary.exists) {
        if (scope === "savings" && typeof formatSavingsResolutionStatus === "function") {
            summaryStatusText = formatSavingsResolutionStatus(summary.status);
        } else {
            summaryStatusText = formatResolutionStatus(summary.status);
        }
    }

    let budgets = (typeof getBudgets === "function") ? getBudgets() : [];
    let budgetMap = new Map((Array.isArray(budgets) ? budgets : []).map(b => [String(b && b.budgetId || ""), b]));
    let savingsEntries = (typeof getSavings === "function") ? getSavings() : [];
    let savingsMap = new Map((Array.isArray(savingsEntries) ? savingsEntries : []).map(s => [String(s && s.id || ""), s]));

    let allocationRows = Array.isArray(transaction.allocationTrail) && transaction.allocationTrail.length
        ? transaction.allocationTrail
        : (transaction.budgetId ? [{ budgetId: transaction.budgetId, amount: Math.abs(Number(transaction.amount || 0)) }] : []);

    let budgetIds = [...new Set(allocationRows.map(row => String(row && row.budgetId || "")).filter(Boolean))];
    let budgetNames = budgetIds.map(id => {
        let row = budgetMap.get(String(id));
        if (!row) return id;
        return `${formatBudgetName(row)} (${row.entity || "Budget"})`;
    });

    let sourceIds = [...new Set(
        (Array.isArray(transaction.transferBackTrail) ? transaction.transferBackTrail : [])
            .map(row => String(row && row.sourceId || ""))
            .concat(Array.isArray(transaction.linkedSourceSavingsIds) ? transaction.linkedSourceSavingsIds.map(String) : [])
            .concat(transaction.linkedSourceSavingsId ? [String(transaction.linkedSourceSavingsId)] : [])
            .filter(Boolean)
    )];

    let sourceNames = sourceIds.map(id => {
        let row = savingsMap.get(String(id));
        return row ? (row.note || row.entity || id) : id;
    });

    let allocationDetails = allocationRows.length
        ? allocationRows.map(row => `${String(row.budgetId || "-")} : ${formatCurrency(Math.abs(Number(row.amount || 0)))}`).join(" | ")
        : "-";

    let detailRows = [
        { label: "Amount", value: formatCurrency(Number(transaction.amount || 0)) },
        { label: "Date", value: new Date(transaction.date || Date.now()).toLocaleString("en-IN") },
        { label: "Entry Type", value: transaction.type || "-" },
        { label: "Running Balance", value: runningBalanceText },
        { label: "Notes", value: transaction.purpose || transaction.note || "-" },
        { label: "Budget ID", value: budgetIds.join(", ") || "-" },
        { label: "Budget Name", value: budgetNames.join(", ") || "-" },
        { label: "Source ID", value: sourceIds.join(", ") || "-" },
        { label: "Source Name", value: sourceNames.join(", ") || "-" },
        { label: "Allocation Details", value: allocationDetails },
        { label: "Refund Type", value: transaction.type === "refund" ? formatRefundType(transaction.refundType) : "-" },
        { label: "Resolution Type", value: transaction.resolutionType ? (RESOLUTION_TYPE_LABELS[normalizeResolutionType(transaction.resolutionType)] || transaction.resolutionType) : "-" },
        { label: "Resolved Amount", value: formatCurrency(Number(transaction.resolvedAmount || 0)) },
        { label: "Loss Amount", value: formatCurrency(Number(transaction.lossAmount || 0)) },
        { label: "Linked Transaction", value: transaction.linkedTransactionId || "-" },
        { label: "Created At", value: new Date(createdAt || Date.now()).toLocaleString("en-IN") }
    ];

    if (summary && summary.exists) {
        detailRows.push(
            { label: "Original Amount", value: formatCurrency(summary.originalAmount) },
            { label: "Refunded", value: formatCurrency(summary.refunded) },
            { label: "Loss", value: formatCurrency(summary.loss) },
            { label: "Status", value: summaryStatusText },
            { label: "Remaining Refundable", value: formatCurrency(summary.remainingRefundable) }
        );
    }

    body.innerHTML = `
      <div class="audit-summary-card">
        <div class="audit-summary-pill">${escapeHtml(transaction.type || "-")}</div>
        <div class="audit-summary-title">${escapeHtml(transaction.purpose || transaction.note || transaction.category || "Transaction")}</div>
        <div class="audit-summary-meta">${escapeHtml(new Date(createdAt || Date.now()).toLocaleString("en-IN"))}</div>
      </div>
      <div class="audit-details-card">
        ${detailRows.map(row => `
          <div class="audit-detail-row">
            <span class="audit-detail-label">${escapeHtml(row.label)}</span>
            <span class="audit-detail-value">${escapeHtml(row.value)}</span>
          </div>
        `).join("")}
      </div>
    `;

    if (!transaction.attachmentId) {
        attachmentSection.style.display = "none";
    } else {
        let meta = null;
        if (window.AttachmentService && window.AttachmentService.getAttachmentMeta) {
            try {
                meta = await window.AttachmentService.getAttachmentMeta(transaction.attachmentId);
            } catch (err) {
                console.warn("Attachment metadata read failed", err);
            }
        }

        const name = meta && meta.fileName
            ? meta.fileName
            : `attachment_${transaction.attachmentId}`;
        const mime = meta && meta.mimeType ? meta.mimeType : "unknown";
        const uploadDate = meta && meta.uploadedDate
            ? meta.uploadedDate
            : (transaction.createdAt || transaction.date);
        const fileSize = meta && Number.isFinite(Number(meta.size))
            ? formatAttachmentSize(meta.size)
            : "-";

        attachmentSection.style.display = "block";
        attachmentSection.innerHTML = `
          <h4>Attachments</h4>
          <div class="audit-attachment-card">
            <div><strong>${escapeHtml(name)}</strong></div>
            <div><small>Type: ${escapeHtml(mime)}</small></div>
            <div><small>Size: ${escapeHtml(fileSize)}</small></div>
            <div><small>Uploaded: ${escapeHtml(new Date(uploadDate || Date.now()).toLocaleString("en-IN"))}</small></div>
            <div class="audit-attachment-actions">
              <button class="secondary" onclick="viewAttachmentById('${escapeHtml(transaction.attachmentId)}')">Open</button>
              <button class="secondary" onclick="downloadAttachmentById('${escapeHtml(transaction.attachmentId)}', '${escapeHtml(name)}')">Download</button>
              <button class="secondary" onclick="deleteTransactionAttachment('${escapeHtml(scope)}', '${escapeHtml(transaction.id)}', '${escapeHtml(transaction.attachmentId)}')">Delete</button>
            </div>
          </div>
        `;
    }

    modal.style.display = "flex";
}

try {
    window.openTransactionAuditDetails = openTransactionAuditDetails;
    window.closeTransactionAuditDetails = closeTransactionAuditDetails;
    window.viewAttachmentById = viewAttachmentById;
    window.downloadAttachmentById = downloadAttachmentById;
    window.deleteTransactionAttachment = deleteTransactionAttachment;
    window.resolveRefundLinkTargets = resolveRefundLinkTargets;
    window.computeBudgetEfficiencyMetrics = computeBudgetEfficiencyMetrics;
    window.updateBudgetEfficiency = updateBudgetEfficiency;
} catch (e) {
    // ignore
}

function setupAttachmentInputs() {
    function setFilePreview(previewEl, wrapperEl, file, url) {
        if (!previewEl || !wrapperEl) return;

        let label = wrapperEl.querySelector('.attachment-preview-label');
        if (!label) {
            label = document.createElement('small');
            label.className = 'attachment-preview-label';
            wrapperEl.appendChild(label);
        }

        const isImage = Boolean(file && String(file.type || '').startsWith('image/'));
        if (isImage) {
            previewEl.src = url;
            previewEl.style.display = 'block';
            label.textContent = file.name || '';
        } else {
            previewEl.removeAttribute('src');
            previewEl.style.display = 'none';
            label.textContent = file ? `Attached: ${file.name}` : '';
        }
        wrapperEl.style.display = 'block';
        if (wrapperEl.classList) wrapperEl.classList.remove('hidden');
    }

    function clearFilePreview(inputEl, previewEl, wrapperEl, removeBtn, stateKey) {
        clearAttachmentInputState({
            inputEl,
            previewEl,
            wrapperEl,
            removeBtn,
            stateKey
        });
    }

    // expense attachment
    const expInput = document.getElementById('expenseAttachment');
    const expPreview = document.getElementById('expenseAttachmentPreview');
    const expWrapper = document.getElementById('expenseAttachmentPreviewWrapper');
    const expRemove = document.getElementById('expenseAttachmentRemove');
    if (expInput) {
        expInput.addEventListener('change', async function () {
            const file = this.files && this.files[0];
            if (!file) {
                clearExpenseAttachmentState();
                return;
            }
            // show temporary preview using object URL
            // revoke previous preview url if present
            if (expPreview && expPreview.dataset._previewUrl) { try { URL.revokeObjectURL(expPreview.dataset._previewUrl); } catch (e) { } }
            const url = URL.createObjectURL(file);
            if (expPreview) expPreview.dataset._previewUrl = url;
            setFilePreview(expPreview, expWrapper, file, url);
            if (expRemove) {
                expRemove.style.display = 'inline';
                if (expRemove.classList) expRemove.classList.remove('hidden');
            }
            window.__expenseAttachmentState = {
                inputId: 'expenseAttachment',
                fileName: file.name || null,
                mime: file.type || null,
                size: Number(file.size || 0),
                previewUrl: url,
                attachmentId: null,
                status: 'selected',
                error: null,
                attachmentData: null,
                attachmentLabel: file.name || null,
                metadata: {
                    lastUpdatedAt: new Date().toISOString()
                }
            };
            expPreview.onclick = () => openAttachmentViewer(url);
        });
        if (expRemove) expRemove.addEventListener('click', () => clearFilePreview(expInput, expPreview, expWrapper, expRemove, 'expense'));
    }

    const sInput = document.getElementById('sAttachment');
    const sPreview = document.getElementById('sAttachmentPreview');
    const sWrapper = document.getElementById('sAttachmentPreviewWrapper');
    const sRemove = document.getElementById('sAttachmentRemove');
    if (sInput) {
        sInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) {
                clearSavingsAttachmentState();
                return;
            }
            if (sPreview && sPreview.dataset._previewUrl) { try { URL.revokeObjectURL(sPreview.dataset._previewUrl); } catch (e) { } }
            const url = URL.createObjectURL(file);
            if (sPreview) sPreview.dataset._previewUrl = url;
            setFilePreview(sPreview, sWrapper, file, url);
            if (sRemove) {
                sRemove.style.display = 'inline';
                if (sRemove.classList) sRemove.classList.remove('hidden');
            }
            window.__savingsAttachmentState = {
                inputId: 'sAttachment',
                fileName: file.name || null,
                mime: file.type || null,
                size: Number(file.size || 0),
                previewUrl: url,
                attachmentId: null,
                status: 'selected',
                error: null,
                attachmentData: null,
                attachmentLabel: file.name || null,
                metadata: {
                    lastUpdatedAt: new Date().toISOString()
                }
            };
            sPreview.onclick = () => openAttachmentViewer(url);
        });
        if (sRemove) sRemove.addEventListener('click', () => clearFilePreview(sInput, sPreview, sWrapper, sRemove, 'savings'));
    }
}

function clearAttachmentInputState({ inputEl, previewEl, wrapperEl, removeBtn, stateKey }) {
    if (previewEl && previewEl.dataset && previewEl.dataset._previewUrl) {
        try { URL.revokeObjectURL(previewEl.dataset._previewUrl); } catch (_err) { }
        previewEl.dataset._previewUrl = '';
    }

    if (inputEl) {
        inputEl.value = '';
        if (inputEl.dataset) {
            inputEl.dataset.attachmentId = '';
            inputEl.dataset.attachmentStatus = '';
            inputEl.dataset.attachmentError = '';
            inputEl.dataset.attachmentLabel = '';
        }
    }

    if (previewEl) {
        previewEl.removeAttribute('src');
        previewEl.style.display = 'none';
    }

    if (wrapperEl) {
        const label = wrapperEl.querySelector('.attachment-preview-label');
        if (label) label.textContent = '';
        wrapperEl.style.display = 'none';
        if (wrapperEl.classList) wrapperEl.classList.add('hidden');
    }

    if (removeBtn) {
        removeBtn.style.display = 'none';
        if (removeBtn.classList) removeBtn.classList.add('hidden');
    }

    if (stateKey === 'expense') {
        window.__expenseAttachmentState = {
            inputId: 'expenseAttachment',
            fileName: null,
            mime: null,
            size: 0,
            previewUrl: null,
            attachmentId: null,
            status: 'none',
            error: null,
            attachmentData: null,
            attachmentLabel: null,
            metadata: null
        };
    }

    if (stateKey === 'savings') {
        window.__savingsAttachmentState = {
            inputId: 'sAttachment',
            fileName: null,
            mime: null,
            size: 0,
            previewUrl: null,
            attachmentId: null,
            status: 'none',
            error: null,
            attachmentData: null,
            attachmentLabel: null,
            metadata: null
        };
    }
}

function clearExpenseAttachmentState() {
    const expInput = document.getElementById('expenseAttachment');
    const expPreview = document.getElementById('expenseAttachmentPreview');
    const expWrapper = document.getElementById('expenseAttachmentPreviewWrapper');
    const expRemove = document.getElementById('expenseAttachmentRemove');

    clearAttachmentInputState({
        inputEl: expInput,
        previewEl: expPreview,
        wrapperEl: expWrapper,
        removeBtn: expRemove,
        stateKey: 'expense'
    });
}

function clearSavingsAttachmentState() {
    const sInput = document.getElementById('sAttachment');
    const sPreview = document.getElementById('sAttachmentPreview');
    const sWrapper = document.getElementById('sAttachmentPreviewWrapper');
    const sRemove = document.getElementById('sAttachmentRemove');

    clearAttachmentInputState({
        inputEl: sInput,
        previewEl: sPreview,
        wrapperEl: sWrapper,
        removeBtn: sRemove,
        stateKey: 'savings'
    });
}

// initialize attachment inputs on DOM ready
if (document.readyState === 'complete') setupAttachmentInputs(); else window.addEventListener('load', setupAttachmentInputs);

// Helper: store attachment from a file input element id and return attachmentId (or null)
async function storeAttachmentFromInput(inputId) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return null;
    if (!window.AttachmentService || typeof window.AttachmentService.saveAttachment !== "function") return null;
    try {
        const res = await window.AttachmentService.saveAttachment(file);
        return res && res.id ? res.id : null;
    } catch (err) {
        console.warn('Attachment store failed', err);
        return null;
    }
}

async function storeAttachmentWithStatus(inputId) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;

    if (!file) {
        if (inputId === 'expenseAttachment') clearExpenseAttachmentState();
        if (inputId === 'sAttachment') clearSavingsAttachmentState();
        return { attachmentId: null, status: "none", error: null, mime: null, filename: null };
    }

    try {
        const storedMeta = window.AttachmentService
            ? await window.AttachmentService.uploadAttachment(file)
            : null;
        const attachmentId = storedMeta && storedMeta.id ? storedMeta.id : null;
        if (attachmentId) {
            if (inputId === 'expenseAttachment') {
                window.__expenseAttachmentState = {
                    ...(window.__expenseAttachmentState || {}),
                    inputId,
                    attachmentId,
                    status: 'linked',
                    error: null,
                    metadata: {
                        ...(window.__expenseAttachmentState && window.__expenseAttachmentState.metadata ? window.__expenseAttachmentState.metadata : {}),
                        storedAt: new Date().toISOString()
                    }
                };
            }

            if (inputId === 'sAttachment') {
                window.__savingsAttachmentState = {
                    ...(window.__savingsAttachmentState || {}),
                    inputId,
                    attachmentId,
                    status: 'linked',
                    error: null,
                    metadata: {
                        ...(window.__savingsAttachmentState && window.__savingsAttachmentState.metadata ? window.__savingsAttachmentState.metadata : {}),
                        storedAt: new Date().toISOString()
                    }
                };
            }

            return {
                attachmentId,
                status: "linked",
                error: null,
                mime: storedMeta.mimeType || file.type || null,
                filename: storedMeta.fileName || file.name || null,
                size: Number(storedMeta.size || file.size || 0),
                uploadedDate: storedMeta.uploadedDate || new Date().toISOString(),
                extension: storedMeta.extension || getAttachmentExtension(file.name || "")
            };
        }

        if (inputId === 'expenseAttachment') {
            window.__expenseAttachmentState = {
                ...(window.__expenseAttachmentState || {}),
                inputId,
                attachmentId: null,
                status: 'failed',
                error: 'Attachment store returned no id'
            };
        }

        if (inputId === 'sAttachment') {
            window.__savingsAttachmentState = {
                ...(window.__savingsAttachmentState || {}),
                inputId,
                attachmentId: null,
                status: 'failed',
                error: 'Attachment store returned no id'
            };
        }

        return {
            attachmentId: null,
            status: "failed",
            error: "Attachment store returned no id",
            mime: file.type || null,
            filename: file.name || null
        };
    } catch (err) {
        if (inputId === 'expenseAttachment') {
            window.__expenseAttachmentState = {
                ...(window.__expenseAttachmentState || {}),
                inputId,
                attachmentId: null,
                status: 'failed',
                error: err && err.message ? err.message : "Attachment store failed"
            };
        }

        if (inputId === 'sAttachment') {
            window.__savingsAttachmentState = {
                ...(window.__savingsAttachmentState || {}),
                inputId,
                attachmentId: null,
                status: 'failed',
                error: err && err.message ? err.message : "Attachment store failed"
            };
        }

        return {
            attachmentId: null,
            status: "failed",
            error: err && err.message ? err.message : "Attachment store failed",
            mime: file.type || null,
            filename: file.name || null
        };
    }
}

function getRuntimeDiagnostics() {
    let ua = (typeof navigator !== "undefined" && navigator.userAgent) ? navigator.userAgent : "";
    let isAndroid = /Android/i.test(ua);
    let isWebView = /;\s?wv\)|\bwv\b|WebView|Version\/\d+\.\d+\s+Chrome\/\d+/i.test(ua);
    let isBrave = false;
    let webShareFiles = false;

    try {
        isBrave = !!(typeof navigator !== "undefined" && navigator.brave);
    } catch (_err) {
        isBrave = false;
    }

    try {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function" && typeof File !== "undefined") {
            webShareFiles = !!navigator.canShare({ files: [new File(["x"], "x.txt", { type: "text/plain" })] });
        }
    } catch (_err) {
        webShareFiles = false;
    }

    return {
        userAgent: ua,
        isAndroid,
        isWebView,
        isBrave,
        isChrome: /Chrome\//i.test(ua) && !isBrave,
        downloadAttribute: "download" in document.createElement("a"),
        showSaveFilePicker: typeof window !== "undefined" && typeof window.showSaveFilePicker === "function",
        webShareFiles
    };
}

function refreshSettingsPanels() {
    if (typeof refreshAutoBackupSettingsUI === "function") refreshAutoBackupSettingsUI();
}

try {
    window.refreshSettingsPanels = refreshSettingsPanels;
    window.applyResponsiveLayout = applyResponsiveLayout;
    window.refreshDashboardLayout = refreshDashboardLayout;
    window.changeTheme = changeTheme;
    window.setAppearanceMode = setAppearanceMode;
    window.loadTheme = loadTheme;
    window.injectGlobalFooter = injectGlobalFooter;
} catch (e) {
    // ignore non-browser contexts
}

// Cleanup orphaned attachments not referenced by any transaction
async function cleanupOrphanAttachments(olderThanDays = 30) {
    const at = window.reMoAttachments || window.reMoAttachmentsIndexed;
    if (!at || !at.listIds) return;
    try {
        const ids = await at.listIds();
        const used = new Set();
        if (typeof getExpenses === 'function') getExpenses().forEach(e => { if (e.attachmentId) used.add(String(e.attachmentId)); });
        if (typeof getSavings === 'function') getSavings().forEach(s => { if (s.attachmentId) used.add(String(s.attachmentId)); });
        const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
        for (const id of ids) {
            if (used.has(String(id))) continue;
            let rec = null;
            try { rec = await at.getRecord(id); } catch (e) { }
            const created = rec && rec.createdAt ? Number(rec.createdAt) : null;
            if (created && created > 0 && created < cutoff) {
                try { await at.remove(id); console.info('Removed orphan attachment', id); } catch (e) { console.warn('Failed remove orphan', id, e) }
            }
        }
    } catch (err) { console.warn('cleanupOrphanAttachments failed', err); }
}

// run a light cleanup on startup (non-blocking)
setTimeout(() => cleanupOrphanAttachments(30), 2000);

function getTotalBudget(monthKey) {
    let budgets = getBudgets();

    let filtered = filterBudgetsByActivePeriod(budgets);

    return filtered
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);
}

function saveExpense() {
    handleAddExpense();
}
try {
    window.saveExpense = saveExpense;
    window.handleAddExpense = handleAddExpense;
    window.handleEntryTypeUIChange = handleEntryTypeUIChange;
    window.buildTransferBackPlan = buildTransferBackPlan;
} catch (_err) {
    // ignore non-browser contexts
}
function exportPDF() {
    downloadPDF();
}
function handleGraphFilter(type) {
    loadGraph(type);
}
function openCustomModal() {
    openDateModal();
}

function applyPeriodFromModal() {

    let from = document.getElementById("startDate").value;
    let to = document.getElementById("endDate").value;

    let expenses = getExpenses();

    // 🔥 normalize to remove time issues
    function normalize(dateStr) {
        let d = new Date(dateStr);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    let fromTime = from ? normalize(from) : null;
    let toTime = to ? normalize(to) : null;

    let filtered = expenses.filter(e => {

        let d = new Date(e.date);
        let entryTime = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
        ).getTime();

        if (fromTime && !toTime) return entryTime === fromTime;
        if (!fromTime && toTime) return entryTime <= toTime;
        if (fromTime && toTime) return entryTime >= fromTime && entryTime <= toTime;

        return true;
    });


    // =========================
    // ✅ UPDATE HISTORY
    // =========================
    if (typeof loadHistory === "function") {
        loadHistory(filtered);
    }

    // =========================
    // ✅ UPDATE GRAPH (THIS WAS MISSING)
    // =========================
    if (typeof loadGraph === "function") {
        loadGraph("custom", filtered, { start: from, end: to });
    }

    // =========================
    // ✅ UPDATE CATEGORY BREAKDOWN
    // =========================
    if (typeof renderCategoryBreakdown === "function") {
        renderCategoryBreakdown(groupByCategory(filtered));
    }

    // =========================
    // ✅ UPDATE DROPDOWN LABEL
    // =========================
    updateCustomPeriodLabel(from, to);

    // =========================
    // ✅ CLOSE MODAL
    // =========================
    closePeriod();
}

function loadBudgetOptions(options = null) {

    let mode = options && typeof options === "object" && options.mode
        ? String(options.mode)
        : "expense";

    let select = document.getElementById("budgetSelect");
    if (!select) return;

    let budgets = getSelectableBudgetEntries(getBudgets());
    let expenses = getExpenses();
    let savingsEntries = (typeof getSavings === "function") ? getSavings() : [];
    let previousValue = String(select.value || "");

    select.innerHTML = "";

    let filtered = budgets;

    if (mode === "transfer_back") {
        filtered = budgets.filter(b => {
            if (!b || !b.budgetId) return false;
            let spent = Math.max(0, getNetSpentForBudget(b.budgetId, expenses));
            let allocated = Math.max(0, Number(b.totalAllocated || 0));
            let available = Math.max(0, allocated - spent);
            let sourceId = resolveBudgetSourceIdForTransferBack(b, savingsEntries);
            return available > 0 && !!sourceId;
        });
    }
    if (mode === "adjustment") {
        let activeKey = typeof getActivePeriodKey === "function" ? getActivePeriodKey() : null;
        filtered = budgets.filter(b => b && activeKey && b.periodKey === activeKey);
    }

    if (!filtered.length) {
        let opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No budgets available";
        select.appendChild(opt);
        return;
    }

    filtered.forEach(b => {

        // 🔥 Calculate spent per budget
        let spent = getNetSpentForBudget(b.budgetId, expenses);

        let remaining = (b.totalAllocated || 0) - spent;

        let opt = document.createElement("option");
        opt.value = b.budgetId;

        // 🔥 FIX: Proper label using periodKey
        let label;

        if (b.periodKey) {
            let [start, end] = b.periodKey.split("_to_");

            label = `${formatDateShort(start)} → ${formatDateShort(end)}`;

        } else if (b.monthKey) {

            label = formatMonth(b.monthKey);

        } else {

            label = "No Date";

        }

        let suffix = mode === "transfer_back"
            ? `${formatCurrency(remaining)} available for return`
            : `${formatCurrency(remaining)} left`;

        opt.textContent = `${label} (${b.entity}) — ${suffix}`;

        select.appendChild(opt);
    });

    if (previousValue && filtered.some(b => String((b && b.budgetId) || "") === previousValue)) {
        select.value = previousValue;
    }

    if (mode === "expense") {
        autoSelectExpenseBudget({ respectManual: true });
    }
}

function getSelectableBudgetEntries(budgets) {
    let list = Array.isArray(budgets) ? budgets : [];

    return list.filter(b => {
        if (!b || typeof b !== "object") return false;
        return !!String(b.budgetId || "").trim();
    });
}

function parseDateToDayStart(value) {
    let d = value ? new Date(value) : new Date();
    if (!Number.isFinite(d.getTime())) d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function getExpenseDateForBudgetSelection() {
    let raw = document.getElementById("expenseDate")?.value || "";
    return parseDateToDayStart(raw);
}

function resolveBudgetDateRange(budget) {
    if (!budget || typeof budget !== "object") return null;

    if (budget.periodKey && String(budget.periodKey).includes("_to_")) {
        let [startRaw, endRaw] = String(budget.periodKey).split("_to_");
        let start = parseDateToDayStart(startRaw);
        let end = parseDateToDayStart(endRaw);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
        return { start, end };
    }

    if (budget.monthKey) {
        let m = String(budget.monthKey);
        if (/^\d{4}-\d{2}$/.test(m)) {
            let start = parseDateToDayStart(`${m}-01`);
            let end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
            end.setHours(0, 0, 0, 0);
            return { start, end };
        }
    }

    return null;
}

function findSuggestedBudgetForExpenseDate(budgets, expenseDate) {
    let list = Array.isArray(budgets) ? budgets : [];
    let target = parseDateToDayStart(expenseDate);

    let matches = list
        .map((budget) => {
            let range = resolveBudgetDateRange(budget);
            if (!range) return null;
            if (target < range.start || target > range.end) return null;
            return { budget, range };
        })
        .filter(Boolean);

    if (!matches.length) return null;

    matches.sort((a, b) => {
        let startDiff = b.range.start.getTime() - a.range.start.getTime();
        if (startDiff !== 0) return startDiff;

        let updatedA = new Date((a.budget && (a.budget.updatedAt || a.budget.createdAt)) || 0).getTime();
        let updatedB = new Date((b.budget && (b.budget.updatedAt || b.budget.createdAt)) || 0).getTime();
        if (updatedB !== updatedA) return updatedB - updatedA;

        return String((a.budget && a.budget.budgetId) || "").localeCompare(String((b.budget && b.budget.budgetId) || ""));
    });

    return matches[0].budget || null;
}

function resetExpenseBudgetSelectionState() {
    expenseBudgetSelectionState.userSelectedBudget = false;
    expenseBudgetSelectionState.lastSuggestedBudgetId = "";
}

function markExpenseBudgetManuallySelected() {
    let type = String(document.getElementById("entryType")?.value || "expense");
    if (type !== "expense") return;

    let current = String(document.getElementById("budgetSelect")?.value || "").trim();
    if (!current) return;

    if (expenseBudgetSelectionState.lastSuggestedBudgetId && current === expenseBudgetSelectionState.lastSuggestedBudgetId) {
        return;
    }

    expenseBudgetSelectionState.userSelectedBudget = true;
}

function autoSelectExpenseBudget(options = {}) {
    let select = document.getElementById("budgetSelect");
    if (!select) return;

    let type = String(document.getElementById("entryType")?.value || "expense");
    if (type !== "expense") return;

    let respectManual = options && Object.prototype.hasOwnProperty.call(options, "respectManual")
        ? Boolean(options.respectManual)
        : true;

    if (respectManual && expenseBudgetSelectionState.userSelectedBudget) return;

    let budgets = getSelectableBudgetEntries(getBudgets());
    if (!budgets.length) return;

    let suggestion = findSuggestedBudgetForExpenseDate(budgets, getExpenseDateForBudgetSelection());
    if (!suggestion || !suggestion.budgetId) return;

    let suggestedId = String(suggestion.budgetId);
    let hasOption = Array.from(select.options || []).some(opt => String(opt.value || "") === suggestedId);
    if (!hasOption) return;

    select.value = suggestedId;
    expenseBudgetSelectionState.lastSuggestedBudgetId = suggestedId;
}

function formatDateShort(date) {
    return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}

function formatBudgetName(budget) {

    if (!budget) return "Unknown";

    // 🔥 If full object passed
    if (typeof budget === "object") {

        if (budget.periodKey) {
            let [start, end] = budget.periodKey.split("_to_");
            return `${formatDateShort(start)} → ${formatDateShort(end)}`;
        }

        if (budget.monthKey) {
            return formatMonth(budget.monthKey);
        }

        return "No Date";
    }

    // 🔥 Fallback if only ID passed (legacy)
    let parts = budget.split("_");

    if (parts.length < 3) return budget;

    let part1 = parts[1];
    let part2 = parts[2];

    let year, month;

    if (part1.length === 4) {
        year = part1;
        month = part2;
    } else {
        month = part1;
        year = part2;
    }

    let date = new Date(`${year}-${month}-01`);

    return date.toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}

// Saves manual budget entry from UI
function saveBudget() {
    let amount = Number(document.getElementById("budgetAmount").value);
    let month = document.getElementById("budgetMonth").value;

    if (!amount || !month) {
        showToast("Enter amount & month");
        return;
    }

    let budgetId = "budget_" + month.replace("-", "_");

    createOrUpdateBudget(budgetId, {
        amount: amount,
        sourceId: "manual",
        entity: "Manual",
        note: "Manual Entry",
        date: new Date().toISOString(),
        monthKey: month
    });

    showToast("Budget saved");

    loadBudgetOptions();
}
// Placeholder for quotation feature (future)

// Shares exported PDF (basic fallback)
function sharePDF() {
    downloadPDF();
    showToast("Download started (share manually)");
}
// Handles theme selection
function handleTheme(val) {
    let picker = document.getElementById("colorPicker");
    let hexInput = document.getElementById("hexInput");
    if (val === "custom") {
        if (picker) picker.style.display = "flex";
        if (hexInput) hexInput.focus();
    } else {
        if (picker) picker.style.display = "none";
        changeTheme(val);
    }
}

function applyAppearanceSettings(mode) {
    setAppearanceMode(mode);
    syncThemeSelectors();
}
// Applies custom color theme
function applyCustomColor(color) {
    changeTheme(color);
    let picker = document.getElementById("colorPicker");
    if (picker) picker.style.display = "none";
}

// Opens category modal
function openCategoryModal() {
    document.getElementById("categoryModal").style.display = "flex";
}

// Closes category modal
function closeCategoryModal() {
    document.getElementById("categoryModal").style.display = "none";
}
// Opens period modal
function openPeriod() {
    document.getElementById("periodModal").style.display = "flex";
}

// Closes period modal
function closePeriod() {
    document.getElementById("periodModal").style.display = "none";
}
// Exports full data backup as JSON
// function exportDataAsJSON() {
//     let data = {
//         expenses: getExpenses(),
//         budgets: getBudgets(),
//         savings: getSavings(),
//         orders: JSON.parse(localStorage.getItem("orders")) || [] // ✅ ADDED
//     };

//     let blob = new Blob(
//         [JSON.stringify(data, null, 2)],
//         { type: "application/json" }
//     );

//     let url = URL.createObjectURL(blob);

//     let a = document.createElement("a");
//     a.href = url;
//     a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
//     a.click();

//     URL.revokeObjectURL(url); // ✅ cleanup
// }
// function exportDataAsJSON() {

//     let data = {
//         expenses: getExpenses() || [],
//         budgets: getBudgets() || [],
//         savings: getSavings() || [],
//         orders: JSON.parse(localStorage.getItem("orders")) || []
//     };

//     try {
//         let json = JSON.stringify(data, null, 2);

//         let blob = new Blob([json], { type: "application/json" });
//         let url = URL.createObjectURL(blob);

//         // 🔥 MOBILE SAFE DOWNLOAD
//         let a = document.createElement("a");
//         a.href = url;
//         a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

//         document.body.appendChild(a);

//         // 👉 TRY DOWNLOAD
//         a.click();

//         // 👉 CLEANUP
//         setTimeout(() => {
//             document.body.removeChild(a);
//             URL.revokeObjectURL(url);
//         }, 1000);

//         // =========================
//         // 🔥 FALLBACK (IMPORTANT)
//         // =========================
//         setTimeout(() => {
//             // If download didn't happen → open manually
//             window.open(url, "_blank");
//         }, 500);

//     } catch (err) {

//         // 🔥 FINAL FALLBACK (copy)
//         let json = JSON.stringify(data, null, 2);
//         prompt("Copy your backup manually:", json);
//     }
// }

// Imports JSON backup into localStorage
// function importData() {
//     let text = document.getElementById("importText").value;

//     if (!text) {
//         showToast("Paste data");
//         return;
//     }

//     let data = JSON.parse(text);

//     if (data.expenses) saveExpenses(data.expenses);
//     if (data.budgets) saveBudgets(data.budgets);
//     if (data.savings) saveSavings(data.savings);

//     showToast("Imported successfully");
// }
// function importData() {
//     let text = document.getElementById("importText").value;

//     if (!text) {
//         showToast("Paste data");
//         return;
//     }

//     try {
//         let data = JSON.parse(text);

//         if (data.expenses) saveExpenses(data.expenses);
//         if (data.budgets) saveBudgets(data.budgets);
//         if (data.savings) saveSavings(data.savings);

//         showToast("Imported successfully");

//         // 🔄 Refresh UI
//         loadHistory();
//         loadBudgetOptions();
//         loadDashboard();
//         loadGraph();
//         renderBudgetEntries();   // 🔥 ADD THIS

//         // 🧹 Clear input
//         document.getElementById("importText").value = "";

//         // ❌ Close modal
//         closeImportModal();

//     } catch (err) {
//         showToast("Invalid JSON ❌");
//     }
// }
function normalizeImportRawText(rawText) {
    if (typeof rawText !== "string") return "";
    return rawText
        .replace(/^\uFEFF/, "")
        .replace(/\u0000/g, "")
        .trim();
}

function getImportTextSignature(text) {
    const raw = String(text || "");
    let hash = 0;
    for (let i = 0; i < raw.length; i += 1) {
        hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return {
        length: raw.length,
        hash32: hash.toString(16).padStart(8, "0")
    };
}

function getImportByteSignature(input) {
    let bytes;
    if (input instanceof Uint8Array) {
        bytes = input;
    } else if (input instanceof ArrayBuffer) {
        bytes = new Uint8Array(input);
    } else {
        bytes = new Uint8Array(0);
    }

    let hash = 0;
    for (let i = 0; i < bytes.length; i += 1) {
        hash = (hash * 31 + bytes[i]) >>> 0;
    }

    return {
        length: bytes.length,
        hash32: hash.toString(16).padStart(8, "0")
    };
}

function getImportCharCodes(text, from, to) {
    const raw = String(text || "");
    const start = Math.max(0, Number(from) || 0);
    const end = Math.min(raw.length, Number(to) || 0);
    let out = [];
    for (let i = start; i < end; i += 1) {
        out.push({ index: i, code: raw.charCodeAt(i) });
    }
    return out;
}

function decodeImportTextCandidates(input) {
    const bytes = input instanceof Uint8Array
        ? input
        : (input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(0));

    const candidates = [];
    const seen = new Set();

    function pushCandidate(encoding, decodedText) {
        const text = typeof decodedText === "string" ? decodedText : "";
        const signature = getImportTextSignature(text);
        const key = `${signature.length}:${signature.hash32}`;
        if (seen.has(key)) return;
        seen.add(key);
        candidates.push({ encoding, text, signature });
    }

    if (typeof TextDecoder !== "undefined") {
        ["utf-8", "utf-16le", "utf-16be"].forEach((encoding) => {
            try {
                const decoder = new TextDecoder(encoding, { fatal: false });
                pushCandidate(encoding, decoder.decode(bytes));
            } catch (_err) {
                // Ignore unsupported decoders on older engines.
            }
        });
    }

    if (!candidates.length && typeof bytes.length === "number") {
        // Last-resort decode for runtimes without TextDecoder.
        let fallback = "";
        for (let i = 0; i < bytes.length; i += 1) {
            fallback += String.fromCharCode(bytes[i]);
        }
        pushCandidate("byte-charcode-fallback", fallback);
    }

    return candidates;
}

function chooseImportDecodedText(input) {
    const candidates = decodeImportTextCandidates(input);
    const attempts = [];

    let selected = null;
    for (let i = 0; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const normalizedText = normalizeImportRawText(candidate.text);
        const normalizedSignature = getImportTextSignature(normalizedText);
        let parseable = false;

        try {
            JSON.parse(normalizedText);
            parseable = true;
        } catch (_err) {
            parseable = false;
        }

        attempts.push({
            encoding: candidate.encoding,
            rawLength: candidate.signature.length,
            rawHash32: candidate.signature.hash32,
            normalizedLength: normalizedSignature.length,
            normalizedHash32: normalizedSignature.hash32,
            parseable
        });

        if (!selected || (parseable && !selected.parseable)) {
            selected = {
                encoding: candidate.encoding,
                rawText: candidate.text,
                normalizedText,
                rawSignature: candidate.signature,
                normalizedSignature,
                parseable
            };
            if (parseable) break;
        }
    }

    if (!selected) {
        selected = {
            encoding: "none",
            rawText: "",
            normalizedText: "",
            rawSignature: getImportTextSignature(""),
            normalizedSignature: getImportTextSignature(""),
            parseable: false
        };
    }

    return {
        selected,
        attempts
    };
}

function setImportStage(stage, payload) {
    window.__lastImportStage = {
        stage,
        payload: payload || null,
        at: new Date().toISOString()
    };
}

function getJsonParseErrorMessage(err) {
    const message = (err && err.message) ? String(err.message) : "Unknown parse error";
    return `JSON Parse Error: ${message}`;
}

function getJsonParseErrorPosition(err) {
    const message = (err && err.message) ? String(err.message) : "";
    const m = message.match(/position\s+(\d+)/i);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
}

function isValidImportId(value) {
    return typeof value === "string" || typeof value === "number";
}

function isValidNullableImportId(value) {
    return value === null || typeof value === "undefined" || isValidImportId(value);
}

function renderImportValidationReport(report) {
    const found = report.found || {};
    const imported = report.imported || {};
    const warnings = Array.isArray(report.warnings) ? report.warnings : [];
    const errors = Array.isArray(report.errors) ? report.errors : [];
    const version = report.version || "unknown";
    const norm = report.normalization || {};

    const lines = [
        `Version: ${version}`,
        `Records Found | Expenses: ${Number(found.expenses || 0)} | Savings: ${Number(found.savings || 0)} | Budgets: ${Number(found.budgets || 0)} | Budget Periods: ${Number(found.budgetPeriods || 0)}`,
        `Records Imported | Expenses: ${Number(imported.expenses || 0)} | Savings: ${Number(imported.savings || 0)} | Budgets: ${Number(imported.budgets || 0)} | Budget Periods: ${Number(imported.budgetPeriods || 0)}`,
        `Unknown Fields Removed: ${Number(norm.unknownFieldsRemoved || 0)}`,
        `Missing Fields Recovered: ${Number(norm.missingFieldsRecovered || 0)}`,
        `Warnings: ${warnings.length}`,
        `Errors: ${errors.length}`
    ];

    if (warnings.length) lines.push(`Warning Details: ${warnings.join("; ")}`);
    if (errors.length) lines.push(`Error Details: ${errors.join("; ")}`);

    const host = document.getElementById("importValidationReport");
    if (host) host.textContent = lines.join("\n");

    window.__lastImportValidationReport = report;
    console.info("Import Validation Report", report);
}

function buildImportDiagnostics(parsed) {
    return {
        typeofImportedData: typeof parsed,
        keys: (parsed && typeof parsed === "object") ? Object.keys(parsed) : [],
        meta: parsed ? parsed.meta : undefined,
        settings: parsed ? parsed.settings : undefined,
        expensesCount: Array.isArray(parsed && parsed.expenses) ? parsed.expenses.length : 0,
        savingsCount: Array.isArray(parsed && parsed.savings) ? parsed.savings.length : 0,
        budgetsCount: Array.isArray(parsed && parsed.budgets) ? parsed.budgets.length : 0,
        budgetPeriodsCount: Array.isArray(parsed && parsed.budgetPeriods) ? parsed.budgetPeriods.length : 0
    };
}

const SCHEMA_VERSION_MAIN = "1.0.0";
const SCHEMA_VERSION_DEVELOPMENT = "2.0.0";

const SCHEMA_DEFAULTS = {
    expenses: [],
    budgets: [],
    savings: [],
    budgetPeriods: [],
    categories: ["Food", "Travel", "Bills", "Entertainment", "Loan", "Recovery", "Others"],
    persons: [],
    settings: {
        theme: "",
        currencyCode: "INR",
        autoBackupEnabled: false,
        autoBackupFrequency: "weekly",
        autoBackupTarget: "local_download"
    },
    orders: [],
    quotations: {
        quotationData: null,
        quotationItems: [],
        quotationCharges: [],
        quotationRegistry: [],
        quotationMeta: null,
        activeQuotationId: null,
        documentRelations: [],
        noSeriesConfig: null
    }
};

const SCHEMA_FIELD_MAPPINGS = {
    expenses: {
        personId: "linkedPersonId",
        linkedPersonId: "personId",
        budgetId: "linkedBudgetId",
        linkedBudgetId: "budgetId"
    },
    savings: {
        personId: "linkedPersonId",
        linkedPersonId: "personId"
    },
    budgets: {
        id: "budgetId",
        budgetId: "id"
    }
};

function normalizeSchemaVersionTag(value) {
    if (typeof value !== "string" || !value.trim()) return SCHEMA_VERSION_MAIN;
    const v = value.trim().toLowerCase();
    if (v === "v1") return SCHEMA_VERSION_MAIN;
    if (v === "v2" || v === "v3") return SCHEMA_VERSION_DEVELOPMENT;
    return value.trim();
}

function validateIncomingImportVersion(rawVersion) {
    const value = typeof rawVersion === "string" ? rawVersion.trim() : "";
    const lowered = value.toLowerCase();

    if (!value) {
        return {
            supported: false,
            normalized: "unknown",
            display: "unknown"
        };
    }

    const supportedIncoming = new Set([
        "v1",
        "v2",
        "v3",
        "1.0.0",
        "2.0.0"
    ]);

    if (!supportedIncoming.has(lowered)) {
        return {
            supported: false,
            normalized: lowered,
            display: value
        };
    }

    const normalized = lowered === "v1"
        ? SCHEMA_VERSION_MAIN
        : SCHEMA_VERSION_DEVELOPMENT;

    return {
        supported: true,
        normalized,
        display: value
    };
}

function normalizeSchemaDirection(direction) {
    if (direction === "toMain" || direction === "main") return "toMain";
    return "toDevelopment";
}

function shallowCloneObject(value, fallback) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return Object.assign({}, fallback || {});
    return Object.assign({}, value);
}

function migrateRecordAliases(row, mapping) {
    if (!row || typeof row !== "object" || Array.isArray(row) || !mapping) return row;
    const next = Object.assign({}, row);
    Object.keys(mapping).forEach((from) => {
        const to = mapping[from];
        if (Object.prototype.hasOwnProperty.call(next, from) && !Object.prototype.hasOwnProperty.call(next, to)) {
            next[to] = next[from];
        }
    });
    return next;
}

function migrateCollectionRows(rows, mapping) {
    if (!Array.isArray(rows)) return [];
    return rows
        .filter((x) => x && typeof x === "object" && !Array.isArray(x))
        .map((x) => migrateRecordAliases(x, mapping));
}

function migrateExpenses(rows) {
    return migrateCollectionRows(rows, SCHEMA_FIELD_MAPPINGS.expenses);
}

function migrateSavings(rows) {
    return migrateCollectionRows(rows, SCHEMA_FIELD_MAPPINGS.savings);
}

function migrateBudgets(rows) {
    return migrateCollectionRows(rows, SCHEMA_FIELD_MAPPINGS.budgets).map((row) => {
        if (row.totalAllocated == null && row.amount != null) {
            row.totalAllocated = Number(row.amount) || 0;
        }
        return row;
    });
}

function migrateSettings(settings) {
    const next = shallowCloneObject(settings, SCHEMA_DEFAULTS.settings);

    if (!Object.prototype.hasOwnProperty.call(next, "accentColor") && typeof next.theme === "string") {
        next.accentColor = next.theme;
    }

    if (!Object.prototype.hasOwnProperty.call(next, "autoBackupEnabled") && Object.prototype.hasOwnProperty.call(next, "autoBackup")) {
        next.autoBackupEnabled = !!next.autoBackup;
    }

    if (!Object.prototype.hasOwnProperty.call(next, "autoBackupFrequency") && typeof next.backupFrequency === "string") {
        next.autoBackupFrequency = next.backupFrequency;
    }

    if (!Object.prototype.hasOwnProperty.call(next, "autoBackupTarget")) {
        next.autoBackupTarget = SCHEMA_DEFAULTS.settings.autoBackupTarget;
    }

    Object.keys(SCHEMA_DEFAULTS.settings).forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(next, key)) {
            next[key] = SCHEMA_DEFAULTS.settings[key];
        }
    });

    return next;
}

function migrateQuotations(quotations) {
    const next = shallowCloneObject(quotations, SCHEMA_DEFAULTS.quotations);
    if (!Array.isArray(next.quotationItems)) next.quotationItems = [];
    if (!Array.isArray(next.quotationCharges)) next.quotationCharges = [];
    if (!Array.isArray(next.quotationRegistry)) next.quotationRegistry = [];
    if (!Array.isArray(next.documentRelations)) next.documentRelations = [];
    if (!Object.prototype.hasOwnProperty.call(next, "quotationData")) next.quotationData = null;
    if (!Object.prototype.hasOwnProperty.call(next, "quotationMeta")) next.quotationMeta = null;
    if (!Object.prototype.hasOwnProperty.call(next, "activeQuotationId")) next.activeQuotationId = null;
    if (!Object.prototype.hasOwnProperty.call(next, "noSeriesConfig")) next.noSeriesConfig = null;
    return next;
}

function migrateDataVersion(payload, options = {}) {
    const direction = normalizeSchemaDirection(options.direction);
    const source = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};

    const normalized = {
        expenses: migrateExpenses(source.expenses),
        budgets: migrateBudgets(source.budgets),
        savings: migrateSavings(source.savings || source.savingsTransactions),
        budgetPeriods: Array.isArray(source.budgetPeriods) ? source.budgetPeriods.slice() : [],
        unassignedTopups: Array.isArray(source.unassignedTopups) ? source.unassignedTopups.slice() : [],
        categories: Array.isArray(source.categories) ? source.categories.slice() : SCHEMA_DEFAULTS.categories.slice(),
        persons: Array.isArray(source.persons) ? source.persons.slice() : [],
        settings: migrateSettings(source.settings),
        orders: Array.isArray(source.orders) ? source.orders.slice() : [],
        quotations: migrateQuotations(source.quotations || {
            quotationData: source.quotationData,
            quotationItems: source.quotationItems,
            quotationCharges: source.quotationCharges
        }),
        meta: shallowCloneObject(source.meta, {})
    };

    if (!normalized.meta.exportedAt) {
        normalized.meta.exportedAt = new Date().toISOString();
    }

    normalized.meta.version = direction === "toMain"
        ? SCHEMA_VERSION_MAIN
        : SCHEMA_VERSION_DEVELOPMENT;

    return {
        data: normalized,
        direction,
        sourceVersion: normalizeSchemaVersionTag(source.meta && source.meta.version)
    };
}

function applySchemaMigrationsToLocalStorage() {
    try {
        const migrated = migrateDataVersion({
            expenses: JSON.parse(localStorage.getItem("expenses") || "[]"),
            budgets: JSON.parse(localStorage.getItem("budgets") || "[]"),
            savings: JSON.parse(localStorage.getItem("savingsTransactions") || "[]"),
            budgetPeriods: JSON.parse(localStorage.getItem("bp") || "[]"),
            unassignedTopups: JSON.parse(localStorage.getItem("unassignedTopups") || "[]"),
            categories: JSON.parse(localStorage.getItem("categories") || "[]"),
            persons: JSON.parse(localStorage.getItem("persons") || "[]"),
            settings: {
                theme: localStorage.getItem("theme") || "",
                appearanceMode: localStorage.getItem("appearanceMode") || "metallic",
                accentColor: localStorage.getItem("accentColor") || localStorage.getItem("theme") || "",
                currencyCode: localStorage.getItem("currencyCode") || "INR",
                autoBackupEnabled: !!(typeof getAutoBackupSettings === "function" && getAutoBackupSettings().enabled),
                autoBackupFrequency: (typeof getAutoBackupSettings === "function" && getAutoBackupSettings().frequency) || "weekly",
                autoBackupTarget: (typeof getAutoBackupSettings === "function" && getAutoBackupSettings().target) || "local_download"
            },
            orders: JSON.parse(localStorage.getItem("orders") || "[]"),
            quotations: {
                quotationData: JSON.parse(localStorage.getItem("quotationData") || "null"),
                quotationItems: JSON.parse(localStorage.getItem("quotationItems") || "[]"),
                quotationCharges: JSON.parse(localStorage.getItem("quotationCharges") || "[]"),
                quotationRegistry: JSON.parse(localStorage.getItem("quotationRegistry") || "[]"),
                quotationMeta: JSON.parse(localStorage.getItem("quotationMeta") || "null"),
                activeQuotationId: JSON.parse(localStorage.getItem("activeQuotationId") || "null"),
                documentRelations: JSON.parse(localStorage.getItem("documentRelations") || "[]"),
                noSeriesConfig: JSON.parse(localStorage.getItem("noSeriesConfig") || "null")
            },
            meta: { version: localStorage.getItem("dataVersion") || SCHEMA_VERSION_MAIN }
        }, { direction: "toDevelopment" }).data;

        localStorage.setItem("expenses", JSON.stringify(migrated.expenses));
        localStorage.setItem("budgets", JSON.stringify(migrated.budgets));
        localStorage.setItem("savingsTransactions", JSON.stringify(migrated.savings));
        localStorage.setItem("bp", JSON.stringify(migrated.budgetPeriods));
        localStorage.setItem("unassignedTopups", JSON.stringify(migrated.unassignedTopups || []));
        localStorage.setItem("categories", JSON.stringify(migrated.categories));
        localStorage.setItem("persons", JSON.stringify(migrated.persons));
        localStorage.setItem("orders", JSON.stringify(migrated.orders));
        localStorage.setItem("quotationData", JSON.stringify(migrated.quotations.quotationData));
        localStorage.setItem("quotationItems", JSON.stringify(migrated.quotations.quotationItems));
        localStorage.setItem("quotationCharges", JSON.stringify(migrated.quotations.quotationCharges));
        localStorage.setItem("quotationRegistry", JSON.stringify(migrated.quotations.quotationRegistry));
        localStorage.setItem("quotationMeta", JSON.stringify(migrated.quotations.quotationMeta));
        localStorage.setItem("activeQuotationId", JSON.stringify(migrated.quotations.activeQuotationId));
        localStorage.setItem("documentRelations", JSON.stringify(migrated.quotations.documentRelations));
        localStorage.setItem("noSeriesConfig", JSON.stringify(migrated.quotations.noSeriesConfig));
        localStorage.setItem("dataVersion", migrated.meta.version);
    } catch (err) {
        console.warn("Schema migration startup step failed", err);
    }
}

if (typeof window !== "undefined") {
    window.migrateDataVersion = migrateDataVersion;
    window.migrateExpenses = migrateExpenses;
    window.migrateSavings = migrateSavings;
    window.migrateBudgets = migrateBudgets;
    window.migrateSettings = migrateSettings;
    window.applySchemaMigrationsToLocalStorage = applySchemaMigrationsToLocalStorage;
}

const IMPORT_DEFAULT_CATEGORIES = [
    "Food",
    "Travel",
    "Bills",
    "Entertainment",
    "Loan",
    "Recovery",
    "Others"
];

const IMPORT_DEFAULT_SETTINGS = {
    theme: "",
    currencyCode: "INR"
};

function normalizeImportPayload(parsed, options = {}) {
    const report = {
        fieldsRemoved: [],
        fieldsAdded: [],
        defaultsApplied: [],
        warnings: [],
        unknownFieldsRemoved: 0,
        missingFieldsRecovered: 0
    };

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { normalized: parsed, report };
    }

    const rootAllowed = new Set([
        "expenses",
        "budgets",
        "savings",
        "budgetPeriods",
        "categories",
        "persons",
        "settings",
        "meta",
        "orders",
        "quotations"
    ]);

    const expenseAllowed = new Set([
        "id", "type", "amount", "category", "purpose", "note", "budgetId", "paymentType", "entity", "date", "monthKey", "createdAt", "updatedAt",
        "splitId", "splitIndex", "isSplit", "linkedTransactionId", "resolutionType", "resolvedAmount", "lossAmount", "refundType",
        "allocationTrail", "transferBackTrail", "linkedSourceSavingsId", "linkedSourceSavingsIds", "sourceId", "person",
        "attachmentId", "attachmentStatus", "attachmentError", "BalanceBeforeTransaction", "BalanceAfterTransaction", "runningBalance",
        "periodKey", "destinationType", "destination", "targetBudgetId", "budgetWalletId", "autoGenerated", "autoRecovered"
    ]);

    const savingsAllowed = new Set([
        "id", "type", "amount", "sourceId", "entity", "paymentType", "person", "note", "purpose", "date", "monthKey", "periodKey",
        "createdAt", "updatedAt", "attachmentId", "attachmentStatus", "attachmentError", "linkedTransactionId", "linkedSourceSavingsId",
        "resolutionType", "resolvedAmount", "lossAmount", "refundType", "targetBudgetId", "budgetWalletId", "autoGenerated", "autoRecovered",
        "BalanceBeforeTransaction", "BalanceAfterTransaction", "runningBalance", "destinationType", "destination"
    ]);

    const budgetAllowed = new Set([
        "id", "type", "budgetId", "legacyId", "sourceId", "totalAllocated", "entity", "note", "date", "periodKey", "monthKey", "isBudgetWallet", "createdAt", "updatedAt"
    ]);

    const periodAllowed = new Set([
        "id", "start", "end", "periodKey", "status", "extraDays", "createdAt", "updatedAt"
    ]);

    const settingsAllowed = new Set([
        "theme", "appearanceMode", "accentColor", "currencyCode", "autoBackupEnabled", "autoBackup", "autoBackupFrequency", "backupFrequency", "autoBackupTarget"
    ]);

    const metaAllowed = new Set(["exportedAt", "version"]);

    function stripUnknown(obj, allowed, pathPrefix) {
        if (!obj || typeof obj !== "object" || Array.isArray(obj)) return obj;
        const out = {};
        Object.keys(obj).forEach((key) => {
            if (!allowed.has(key)) {
                report.fieldsRemoved.push(`${pathPrefix}.${key}`);
                report.unknownFieldsRemoved += 1;
                return;
            }
            const value = obj[key];
            if (typeof value !== "undefined") out[key] = value;
        });
        return out;
    }

    let normalized = {};

    Object.keys(parsed).forEach((key) => {
        if (!rootAllowed.has(key)) {
            report.fieldsRemoved.push(`root.${key}`);
            report.unknownFieldsRemoved += 1;
            return;
        }
        normalized[key] = parsed[key];
    });

    if (!Array.isArray(normalized.expenses)) {
        normalized.expenses = [];
        report.fieldsAdded.push("expenses");
        report.defaultsApplied.push("expenses=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.savings)) {
        normalized.savings = [];
        report.fieldsAdded.push("savings");
        report.defaultsApplied.push("savings=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.budgets)) {
        normalized.budgets = [];
        report.fieldsAdded.push("budgets");
        report.defaultsApplied.push("budgets=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.budgetPeriods)) {
        normalized.budgetPeriods = [];
        report.fieldsAdded.push("budgetPeriods");
        report.defaultsApplied.push("budgetPeriods=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.categories)) {
        normalized.categories = IMPORT_DEFAULT_CATEGORIES.slice();
        report.fieldsAdded.push("categories");
        report.defaultsApplied.push("categories=default");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.persons)) {
        normalized.persons = [];
        report.fieldsAdded.push("persons");
        report.defaultsApplied.push("persons=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.orders)) {
        normalized.orders = [];
        report.fieldsAdded.push("orders");
        report.defaultsApplied.push("orders=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!normalized.quotations || typeof normalized.quotations !== "object" || Array.isArray(normalized.quotations)) {
        normalized.quotations = {
            quotationData: null,
            quotationItems: [],
            quotationCharges: [],
            quotationRegistry: [],
            quotationMeta: null,
            activeQuotationId: null,
            documentRelations: [],
            noSeriesConfig: null
        };
        report.fieldsAdded.push("quotations");
        report.defaultsApplied.push("quotations=default");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.quotations.quotationItems)) {
        normalized.quotations.quotationItems = [];
        report.fieldsAdded.push("quotations.quotationItems");
        report.defaultsApplied.push("quotations.quotationItems=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.quotations.quotationCharges)) {
        normalized.quotations.quotationCharges = [];
        report.fieldsAdded.push("quotations.quotationCharges");
        report.defaultsApplied.push("quotations.quotationCharges=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.quotations.quotationRegistry)) {
        normalized.quotations.quotationRegistry = [];
        report.fieldsAdded.push("quotations.quotationRegistry");
        report.defaultsApplied.push("quotations.quotationRegistry=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Array.isArray(normalized.quotations.documentRelations)) {
        normalized.quotations.documentRelations = [];
        report.fieldsAdded.push("quotations.documentRelations");
        report.defaultsApplied.push("quotations.documentRelations=[]");
        report.missingFieldsRecovered += 1;
    }

    if (!Object.prototype.hasOwnProperty.call(normalized.quotations, "quotationMeta")) {
        normalized.quotations.quotationMeta = null;
        report.fieldsAdded.push("quotations.quotationMeta");
        report.defaultsApplied.push("quotations.quotationMeta=null");
        report.missingFieldsRecovered += 1;
    }

    if (!Object.prototype.hasOwnProperty.call(normalized.quotations, "activeQuotationId")) {
        normalized.quotations.activeQuotationId = null;
        report.fieldsAdded.push("quotations.activeQuotationId");
        report.defaultsApplied.push("quotations.activeQuotationId=null");
        report.missingFieldsRecovered += 1;
    }

    if (!Object.prototype.hasOwnProperty.call(normalized.quotations, "noSeriesConfig")) {
        normalized.quotations.noSeriesConfig = null;
        report.fieldsAdded.push("quotations.noSeriesConfig");
        report.defaultsApplied.push("quotations.noSeriesConfig=null");
        report.missingFieldsRecovered += 1;
    }

    if (!normalized.settings || typeof normalized.settings !== "object" || Array.isArray(normalized.settings)) {
        normalized.settings = Object.assign({}, IMPORT_DEFAULT_SETTINGS);
        report.fieldsAdded.push("settings");
        report.defaultsApplied.push("settings=default");
        report.missingFieldsRecovered += 1;
    } else {
        normalized.settings = stripUnknown(normalized.settings, settingsAllowed, "settings");
        Object.keys(IMPORT_DEFAULT_SETTINGS).forEach((key) => {
            if (!Object.prototype.hasOwnProperty.call(normalized.settings, key)) {
                normalized.settings[key] = IMPORT_DEFAULT_SETTINGS[key];
                report.fieldsAdded.push(`settings.${key}`);
                report.defaultsApplied.push(`settings.${key}=${IMPORT_DEFAULT_SETTINGS[key]}`);
                report.missingFieldsRecovered += 1;
            }
        });
    }

    if (!normalized.meta || typeof normalized.meta !== "object" || Array.isArray(normalized.meta)) {
        normalized.meta = { version: "v1" };
        report.fieldsAdded.push("meta");
        report.defaultsApplied.push("meta.version=v1");
        report.missingFieldsRecovered += 1;
    } else {
        normalized.meta = stripUnknown(normalized.meta, metaAllowed, "meta");
        if (!Object.prototype.hasOwnProperty.call(normalized.meta, "version")) {
            normalized.meta.version = "v1";
            report.fieldsAdded.push("meta.version");
            report.defaultsApplied.push("meta.version=v1");
            report.missingFieldsRecovered += 1;
        }
    }

    normalized.expenses = normalized.expenses
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row, index) => stripUnknown(row, expenseAllowed, `expenses[${index}]`));

    normalized.savings = normalized.savings
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row, index) => stripUnknown(row, savingsAllowed, `savings[${index}]`));

    normalized.budgets = normalized.budgets
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row, index) => stripUnknown(row, budgetAllowed, `budgets[${index}]`));

    normalized.budgetPeriods = normalized.budgetPeriods
        .filter((row) => row && typeof row === "object" && !Array.isArray(row))
        .map((row, index) => stripUnknown(row, periodAllowed, `budgetPeriods[${index}]`));

    normalized.categories = normalized.categories
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean);

    if (!normalized.categories.length) {
        normalized.categories = IMPORT_DEFAULT_CATEGORIES.slice();
        report.defaultsApplied.push("categories=default(fallback)");
        report.missingFieldsRecovered += 1;
    }

    normalized.persons = normalized.persons
        .filter((x) => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean);

    console.info("Import normalization keys", {
        rootBefore: Object.keys(parsed || {}),
        rootAfter: Object.keys(normalized || {}),
        expenseBefore: Array.isArray(parsed?.expenses) && parsed.expenses[0] && typeof parsed.expenses[0] === "object" ? Object.keys(parsed.expenses[0]) : [],
        expenseAfter: Array.isArray(normalized.expenses) && normalized.expenses[0] && typeof normalized.expenses[0] === "object" ? Object.keys(normalized.expenses[0]) : [],
        savingsBefore: Array.isArray(parsed?.savings) && parsed.savings[0] && typeof parsed.savings[0] === "object" ? Object.keys(parsed.savings[0]) : [],
        savingsAfter: Array.isArray(normalized.savings) && normalized.savings[0] && typeof normalized.savings[0] === "object" ? Object.keys(normalized.savings[0]) : []
    });

    report.warnings = [
        `Unknown Fields Removed: ${report.unknownFieldsRemoved}`,
        `Missing Fields Recovered: ${report.missingFieldsRecovered}`
    ];

    const skipMigration = !!options.skipMigration;

    if (!skipMigration) {
        const migrated = migrateDataVersion(normalized, { direction: "toDevelopment" });
        normalized = migrated.data;

        if (migrated.sourceVersion !== SCHEMA_VERSION_DEVELOPMENT) {
            report.warnings.push(`Schema migration applied from ${migrated.sourceVersion} to ${SCHEMA_VERSION_DEVELOPMENT}`);
        }
    }

    return { normalized, report };
}

function validateImportPayload(parsed) {
    const errors = [];
    const warnings = [];

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        errors.push("Missing Fields: top-level object is required");
        return { errors, warnings, normalized: null, version: "unknown" };
    }

    const normalized = Object.assign({}, parsed);
    normalized.meta = (normalized.meta && typeof normalized.meta === "object" && !Array.isArray(normalized.meta)) ? normalized.meta : {};

    const rawVersion = normalizeSchemaVersionTag(normalized.meta.version);
    const supported = [SCHEMA_VERSION_MAIN, SCHEMA_VERSION_DEVELOPMENT];
    if (!supported.includes(rawVersion)) {
        errors.push(`Unsupported Version: ${normalized.meta.version}`);
    }

    const topArrays = ["expenses", "savings", "budgets", "budgetPeriods", "orders", "categories", "persons"];
    topArrays.forEach((key) => {
        if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
            normalized[key] = [];
            warnings.push(`Missing Fields: ${key}`);
            return;
        }

        if (!Array.isArray(normalized[key])) {
            if (key === "budgetPeriods") {
                errors.push("Invalid Budget Periods: budgetPeriods must be an array");
            } else if (key === "expenses" || key === "savings" || key === "budgets") {
                errors.push(`Missing Fields: ${key} must be an array`);
            } else {
                errors.push(`Invalid Transactions: ${key} must be an array`);
            }
        }
    });

    if (!Object.prototype.hasOwnProperty.call(normalized, "settings") || normalized.settings === null || typeof normalized.settings === "undefined") {
        normalized.settings = {};
        warnings.push("Missing Fields: settings");
    } else if (typeof normalized.settings !== "object" || Array.isArray(normalized.settings)) {
        errors.push("Invalid Settings Structure: settings must be an object");
    }

    if (!Object.prototype.hasOwnProperty.call(normalized, "quotations") || normalized.quotations === null || typeof normalized.quotations === "undefined") {
        normalized.quotations = {
            quotationData: null,
            quotationItems: [],
            quotationCharges: [],
            quotationRegistry: [],
            quotationMeta: null,
            activeQuotationId: null,
            documentRelations: [],
            noSeriesConfig: null
        };
        warnings.push("Missing Fields: quotations");
    } else if (typeof normalized.quotations !== "object" || Array.isArray(normalized.quotations)) {
        errors.push("Invalid Quotations Structure: quotations must be an object");
    }

    const settings = normalized.settings || {};
    ["theme", "appearanceMode", "accentColor", "currencyCode"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(settings, key) && typeof settings[key] !== "string") {
            errors.push(`Invalid Settings Structure: ${key} must be a string`);
        }
    });

    ["autoBackupEnabled", "autoBackup"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(settings, key) && typeof settings[key] !== "boolean") {
            errors.push(`Invalid Settings Structure: ${key} must be a boolean`);
        }
    });

    ["autoBackupFrequency", "backupFrequency", "autoBackupTarget"].forEach((key) => {
        if (Object.prototype.hasOwnProperty.call(settings, key) && typeof settings[key] !== "string") {
            errors.push(`Invalid Settings Structure: ${key} must be a string`);
        }
    });

    function validateTransactions(rows, label) {
        if (!Array.isArray(rows)) return;

        rows.forEach((row, index) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
                errors.push(`Invalid Transactions: ${label}[${index}] must be an object`);
                return;
            }

            if (!isValidImportId(row.id)) {
                errors.push(`Invalid IDs: ${label}[${index}].id`);
            }

            ["person", "sourceId", "linkedTransactionId"].forEach((field) => {
                if (Object.prototype.hasOwnProperty.call(row, field) && !isValidNullableImportId(row[field])) {
                    errors.push(`Invalid IDs: ${label}[${index}].${field}`);
                }
            });
        });
    }

    validateTransactions(normalized.expenses, "expenses");
    validateTransactions(normalized.savings, "savings");

    function normalizeImportedResolutionRows(rows) {
        if (!Array.isArray(rows)) return;
        rows.forEach((row) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) return;
            if (row.type === "refund") {
                row.refundType = normalizeRefundType(row.refundType || "custom");
            }
            if (row.type === "expense_resolution" || row.resolutionType) {
                row.resolutionType = normalizeResolutionType(row.resolutionType || "open");
            }
        });
    }

    normalizeImportedResolutionRows(normalized.expenses);
    normalizeImportedResolutionRows(normalized.savings);

    if (Array.isArray(normalized.budgets)) {
        normalized.budgets.forEach((row, index) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) {
                errors.push(`Invalid Transactions: budgets[${index}] must be an object`);
                return;
            }

            const id = Object.prototype.hasOwnProperty.call(row, "budgetId") ? row.budgetId : row.id;
            if (!isValidImportId(id)) {
                errors.push(`Invalid IDs: budgets[${index}] budgetId/id`);
            }
        });
    }

    if (Array.isArray(normalized.budgetPeriods)) {
        normalized.budgetPeriods.forEach((period, index) => {
            if (!period || typeof period !== "object" || Array.isArray(period)) {
                errors.push(`Invalid Budget Periods: budgetPeriods[${index}] must be an object`);
                return;
            }

            const hasPeriodKey = typeof period.periodKey === "string" && period.periodKey.length > 0;
            const hasRange = typeof period.start === "string" && typeof period.end === "string";
            if (!hasPeriodKey && !hasRange) {
                errors.push(`Invalid Budget Periods: budgetPeriods[${index}] missing periodKey or start/end`);
            }
        });
    }

    if (settings && typeof settings === "object") {
        if (settings.theme && !settings.accentColor) {
            settings.accentColor = settings.theme;
        }

        if (Object.prototype.hasOwnProperty.call(settings, "autoBackup") && !Object.prototype.hasOwnProperty.call(settings, "autoBackupEnabled")) {
            settings.autoBackupEnabled = !!settings.autoBackup;
        }

        if (settings.backupFrequency && !settings.autoBackupFrequency) {
            settings.autoBackupFrequency = settings.backupFrequency;
        }
    }

    return {
        errors: Array.from(new Set(errors)),
        warnings: Array.from(new Set(warnings)),
        normalized,
        version: rawVersion
    };
}

function importData() {
    setImportStage("validation-input");
    let text = normalizeImportRawText(document.getElementById("importText")?.value || "");
    const baselineSignature = getImportTextSignature(text);
    const hashBeforeParse = `${baselineSignature.length}:${baselineSignature.hash32}`;

    // Requested UAT diagnostics immediately before parse.
    console.log(window.__lastImportFileMeta?.fileName || "manual_text");
    console.log(Number(window.__lastImportFileMeta?.fileSize || 0));
    console.log(text.length);
    console.log(text.substring(7000, 7100));
    console.log("hashDisk", window.__lastImportPipeline?.disk?.hash || "n/a");
    console.log("hashBeforeParse", hashBeforeParse);

    console.info("Import raw diagnostics", {
        fileName: window.__lastImportFileMeta?.fileName || "manual_text",
        fileSize: Number(window.__lastImportFileMeta?.fileSize || 0),
        typeofContent: typeof text,
        contentLength: text.length,
        signature: baselineSignature,
        normalization: window.__lastImportNormalizationMeta || null,
        hashBeforeParse,
        pipeline: window.__lastImportPipeline || null
    });

    // UAT requested pre-parse raw section logging around known failure offsets.
    console.log(text.substring(7000, 7150));
    window.__lastImportContentSample7000 = text.substring(7000, 7150);
    window.__lastImportCharCodes7000 = getImportCharCodes(text, 7000, 7060);

    if (!text) {
        showToast("Paste data");
        return;
    }

    let parsed;
    try {
        setImportStage("json-parse");
        parsed = JSON.parse(text);
    } catch (err) {
        const parseError = getJsonParseErrorMessage(err);
        const parsePosition = getJsonParseErrorPosition(err);
        const fragStart = Number.isFinite(parsePosition) ? Math.max(0, parsePosition - 40) : 0;
        const fragEnd = Number.isFinite(parsePosition) ? Math.min(text.length, parsePosition + 110) : Math.min(text.length, 150);
        const fragment = text.substring(fragStart, fragEnd);
        const codeStart = Number.isFinite(parsePosition) ? Math.max(0, parsePosition - 15) : 0;
        const codeEnd = Number.isFinite(parsePosition) ? Math.min(text.length, parsePosition + 15) : Math.min(text.length, 30);
        const parseWindowCodes = getImportCharCodes(text, codeStart, codeEnd);

        window.__lastImportCorruptFragment = fragment;
        window.__lastImportParseWindowCodes = parseWindowCodes;
        console.error("Import parse fragment", {
            parsePosition,
            fragment,
            parseWindowCodes,
            signature: baselineSignature,
            normalization: window.__lastImportNormalizationMeta || null
        });

        setImportStage("json-parse-failed", {
            error: parseError,
            parsePosition,
            fragment
        });
        renderImportValidationReport({
            version: "unknown",
            found: { expenses: 0, savings: 0, budgets: 0, budgetPeriods: 0 },
            imported: { expenses: 0, savings: 0, budgets: 0, budgetPeriods: 0 },
            warnings: [],
            errors: [parseError]
        });
        showToast("JSON Parse Error", "error");
        return;
    }

    const incomingVersion = validateIncomingImportVersion(
        parsed && parsed.meta && Object.prototype.hasOwnProperty.call(parsed.meta, "version")
            ? parsed.meta.version
            : null
    );

    if (!incomingVersion.supported) {
        setImportStage("version-validation-failed", {
            version: incomingVersion.display
        });

        const normalizationResult = normalizeImportPayload(parsed, { skipMigration: true });
        const diagnostics = buildImportDiagnostics(normalizationResult.normalized);
        const found = {
            expenses: diagnostics.expensesCount,
            savings: diagnostics.savingsCount,
            budgets: diagnostics.budgetsCount,
            budgetPeriods: diagnostics.budgetPeriodsCount
        };

        renderImportValidationReport({
            version: "unknown",
            found,
            imported: { expenses: 0, savings: 0, budgets: 0, budgetPeriods: 0 },
            warnings: normalizationResult.report.warnings || [],
            normalization: normalizationResult.report,
            errors: [`Unsupported Version: ${incomingVersion.display}`]
        });

        showToast("Import Validation Failed", "error");
        return;
    }

    setImportStage("normalization");
    const normalizationResult = normalizeImportPayload(parsed);
    const normalizedParsed = normalizationResult.normalized;
    window.__lastImportNormalizationReport = normalizationResult.report;

    setImportStage("schema-validation");
    const diagnostics = buildImportDiagnostics(normalizedParsed);
    console.info("Import parse diagnostics", diagnostics);

    const validation = validateImportPayload(normalizedParsed);
    const found = {
        expenses: diagnostics.expensesCount,
        savings: diagnostics.savingsCount,
        budgets: diagnostics.budgetsCount,
        budgetPeriods: diagnostics.budgetPeriodsCount
    };

    if (validation.errors.length) {
        setImportStage("schema-validation-failed", { errors: validation.errors });
        renderImportValidationReport({
            version: validation.version,
            found,
            imported: { expenses: 0, savings: 0, budgets: 0, budgetPeriods: 0 },
            warnings: validation.warnings.concat(normalizationResult.report.warnings || []),
            normalization: normalizationResult.report,
            errors: validation.errors
        });
        showToast("Import Validation Failed", "error");
        return;
    }

    const data = validation.normalized;

    try {
        setImportStage("import-mapping");
        if (Array.isArray(data.expenses)) saveExpenses(data.expenses);
        if (Array.isArray(data.budgets)) saveBudgets(data.budgets);
        if (Array.isArray(data.savings)) saveSavings(data.savings);
        if (Array.isArray(data.orders)) localStorage.setItem("orders", JSON.stringify(data.orders));
        if (Array.isArray(data.categories)) localStorage.setItem("categories", JSON.stringify(data.categories));
        if (Array.isArray(data.persons)) localStorage.setItem("persons", JSON.stringify(data.persons));
        if (Array.isArray(data.budgetPeriods)) localStorage.setItem("bp", JSON.stringify(data.budgetPeriods));
        if (Array.isArray(data.unassignedTopups)) localStorage.setItem("unassignedTopups", JSON.stringify(data.unassignedTopups));
        if (data.quotations && typeof data.quotations === "object") {
            localStorage.setItem("quotationData", JSON.stringify(data.quotations.quotationData || null));
            localStorage.setItem("quotationItems", JSON.stringify(Array.isArray(data.quotations.quotationItems) ? data.quotations.quotationItems : []));
            localStorage.setItem("quotationCharges", JSON.stringify(Array.isArray(data.quotations.quotationCharges) ? data.quotations.quotationCharges : []));
            localStorage.setItem("quotationRegistry", JSON.stringify(Array.isArray(data.quotations.quotationRegistry) ? data.quotations.quotationRegistry : []));
            localStorage.setItem("quotationMeta", JSON.stringify(data.quotations.quotationMeta || null));
            localStorage.setItem("activeQuotationId", JSON.stringify(data.quotations.activeQuotationId || null));
            localStorage.setItem("documentRelations", JSON.stringify(Array.isArray(data.quotations.documentRelations) ? data.quotations.documentRelations : []));
            localStorage.setItem("noSeriesConfig", JSON.stringify(data.quotations.noSeriesConfig || null));
        }

        if (data.settings) {
            if (data.settings.currencyCode) localStorage.setItem("currencyCode", data.settings.currencyCode);
            if (data.settings.appearanceMode) setAppearanceMode(data.settings.appearanceMode);

            if (data.settings.accentColor) {
                changeTheme(data.settings.accentColor);
            } else if (data.settings.theme) {
                changeTheme(data.settings.theme);
            }

            if (Object.prototype.hasOwnProperty.call(data.settings, "autoBackupEnabled") || data.settings.autoBackupFrequency || data.settings.autoBackupTarget) {
                saveAutoBackupSettings({
                    enabled: !!data.settings.autoBackupEnabled,
                    frequency: data.settings.autoBackupFrequency || "weekly",
                    target: data.settings.autoBackupTarget || "local_download"
                });
            } else if (Object.prototype.hasOwnProperty.call(data.settings, "autoBackup") || data.settings.backupFrequency) {
                saveAutoBackupSettings({
                    enabled: !!data.settings.autoBackup,
                    frequency: data.settings.backupFrequency || "weekly",
                    target: "local_download"
                });
            }

        }

        runIntegrityRepairSilently();
        setImportStage("ledger-rebuild");
        loadTheme();
        syncThemeSelectors();
        refreshSettingsPanels();

        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        if (typeof renderBudgetEntries === "function") renderBudgetEntries();
        if (typeof renderIncomeList === "function") renderIncomeList();
        if (typeof loadSavings === "function") loadSavings();

        renderImportValidationReport({
            version: validation.version,
            found,
            imported: {
                expenses: Array.isArray(data.expenses) ? data.expenses.length : 0,
                savings: Array.isArray(data.savings) ? data.savings.length : 0,
                budgets: Array.isArray(data.budgets) ? data.budgets.length : 0,
                budgetPeriods: Array.isArray(data.budgetPeriods) ? data.budgetPeriods.length : 0
            },
            warnings: validation.warnings.concat(normalizationResult.report.warnings || []),
            normalization: normalizationResult.report,
            errors: []
        });

        showToast("Import successful ✅");
        setImportStage("completed");

        const importText = document.getElementById("importText");
        if (importText) importText.value = "";
        closeImportModal();
    } catch (err) {
        console.error(err);
        setImportStage("import-mapping-failed", { error: err && err.message ? err.message : "unknown" });
        renderImportValidationReport({
            version: validation.version,
            found,
            imported: { expenses: 0, savings: 0, budgets: 0, budgetPeriods: 0 },
            warnings: validation.warnings.concat(normalizationResult.report.warnings || []),
            normalization: normalizationResult.report,
            errors: ["Import Validation Failed: invalid transactions or data mapping"]
        });
        showToast("Import Validation Failed", "error");
    }
}

if (typeof window !== "undefined") {
    window.importData = importData;
    window.exportDataAsJSON = exportDataAsJSON;
    window.decodeImportTextCandidates = decodeImportTextCandidates;
    window.chooseImportDecodedText = chooseImportDecodedText;
    window.getImportByteSignature = getImportByteSignature;
}
// Fixes old data structure to new system
function runMigration() {
    let budgets = getBudgets();

    budgets.forEach(b => {
        if (b.amount && !b.totalAllocated) {
            b.totalAllocated = b.amount;
            delete b.amount;
        }
    });

    saveBudgets(budgets);

    showToast("Migration done");
}
function openQuotation() {
    window.location.href = "pages/quotations.html";
}

if (typeof window !== "undefined") {
    window.openQuotation = openQuotation;
}

function updateNoSeriesPreview() {
    if (!window.DocWorkflow) return;

    const quotationPrefixInput = document.getElementById("quotationPrefixInput");
    const quotationStartInput = document.getElementById("quotationStartInput");
    const orderPrefixInput = document.getElementById("orderPrefixInput");
    const orderStartInput = document.getElementById("orderStartInput");
    const preview = document.getElementById("noSeriesPreviewText");
    if (!preview) return;

    const current = window.DocWorkflow.getNoSeriesConfig();
    const draft = {
        quotation: {
            prefix: quotationPrefixInput ? quotationPrefixInput.value : "QT",
            startNumber: quotationStartInput ? Number(quotationStartInput.value || 0) : 1000,
            lastNumber: current.quotation.lastNumber
        },
        order: {
            prefix: orderPrefixInput ? orderPrefixInput.value : "ORD",
            startNumber: orderStartInput ? Number(orderStartInput.value || 0) : 1000,
            lastNumber: current.order.lastNumber
        }
    };

    const actual = window.DocWorkflow.getSeriesPreview(draft);
    preview.textContent = `Preview: ${actual.quotation} | ${actual.order}`;
}

function openNoSeriesModal() {
    console.debug("[NoSeries] openNoSeriesModal called");
    if (!window.DocWorkflow) {
        showToast("No Series settings unavailable", "warning");
        console.warn("[NoSeries] DocWorkflow unavailable");
        return;
    }

    const config = window.DocWorkflow.getNoSeriesConfig();
    const modal = document.getElementById("noSeriesModal");
    const quotationPrefixInput = document.getElementById("quotationPrefixInput");
    const quotationStartInput = document.getElementById("quotationStartInput");
    const orderPrefixInput = document.getElementById("orderPrefixInput");
    const orderStartInput = document.getElementById("orderStartInput");
    const preview = document.getElementById("noSeriesPreviewText");

    if (!modal || !quotationPrefixInput || !quotationStartInput || !orderPrefixInput || !orderStartInput || !preview) {
        console.warn("[NoSeries] Missing modal elements", {
            modal: !!modal,
            quotationPrefixInput: !!quotationPrefixInput,
            quotationStartInput: !!quotationStartInput,
            orderPrefixInput: !!orderPrefixInput,
            orderStartInput: !!orderStartInput,
            preview: !!preview
        });
        return;
    }

    quotationPrefixInput.value = config.quotation.prefix;
    quotationStartInput.value = String(config.quotation.startNumber);
    orderPrefixInput.value = config.order.prefix;
    orderStartInput.value = String(config.order.startNumber);

    const previewValue = window.DocWorkflow.getSeriesPreview(config);
    preview.textContent = `Preview: ${previewValue.quotation} | ${previewValue.order}`;

    [quotationPrefixInput, quotationStartInput, orderPrefixInput, orderStartInput].forEach((el) => {
        el.oninput = () => {
            updateNoSeriesPreview();
        };
    });

    modal.classList.remove("hidden");
    modal.style.display = "flex";
    console.debug("[NoSeries] modal opened", config);
}

function closeNoSeriesModal() {
    const modal = document.getElementById("noSeriesModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
    console.debug("[NoSeries] modal closed");
}

function saveNoSeriesModal() {
    if (!window.DocWorkflow) return;
    const quotationPrefixInput = document.getElementById("quotationPrefixInput");
    const quotationStartInput = document.getElementById("quotationStartInput");
    const orderPrefixInput = document.getElementById("orderPrefixInput");
    const orderStartInput = document.getElementById("orderStartInput");

    const current = window.DocWorkflow.getNoSeriesConfig();
    const next = {
        quotation: {
            prefix: quotationPrefixInput ? quotationPrefixInput.value : current.quotation.prefix,
            startNumber: quotationStartInput ? Number(quotationStartInput.value || current.quotation.startNumber) : current.quotation.startNumber,
            lastNumber: current.quotation.lastNumber
        },
        order: {
            prefix: orderPrefixInput ? orderPrefixInput.value : current.order.prefix,
            startNumber: orderStartInput ? Number(orderStartInput.value || current.order.startNumber) : current.order.startNumber,
            lastNumber: current.order.lastNumber
        }
    };

    if (next.quotation.lastNumber < next.quotation.startNumber) {
        next.quotation.lastNumber = next.quotation.startNumber;
    }
    if (next.order.lastNumber < next.order.startNumber) {
        next.order.lastNumber = next.order.startNumber;
    }

    const saved = window.DocWorkflow.saveNoSeriesConfig(next);
    console.debug("[NoSeries] configuration saved", saved);
    closeNoSeriesModal();
    showToast("No Series saved", "success");
}

if (typeof window !== "undefined") {
    window.openNoSeriesModal = openNoSeriesModal;
    window.closeNoSeriesModal = closeNoSeriesModal;
    window.saveNoSeriesModal = saveNoSeriesModal;
    window.updateNoSeriesPreview = updateNoSeriesPreview;
}

// =========================
// 🔗 OPEN SAVINGS PAGE
// =========================
// Navigates user to savings screen
// function openSavingsPage() {
//     window.location.href = "savings.html";
// }
// =========================
// 🔗 NAVIGATE TO SAVINGS
// =========================
// Opens savings page when Remaining card is clicked
function bindRemainingCard() {
    let card = document.getElementById("remainingCard");

    if (!card) return;

    card.addEventListener("click", () => {
        window.location.href = "pages/savings.html";
    });
}
// =========================
// 📊 LOAD DASHBOARD SUMMARY
// =========================
// Calculates Budget, Spent, Remaining, Today
// function loadDashboard() {

//     let savings = getSavings();   // always latest
//     let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
//     let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

//     // 💰 TOTAL SAVINGS
//     let totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

//     // 📦 TOTAL BUDGET
//     let currentMonth = new Date().toISOString().slice(0, 7);

//     let totalBudget = budgets
//         .filter(b => b.monthKey === currentMonth)
//         .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//     // 💰 INCOME
//     let totalIncome = expenses
//         .filter(e =>
//             e.amount > 0 &&
//             e.monthKey === currentMonth   // 🔥 IMPORTANT
//         )
//         .reduce((sum, e) => sum + e.amount, 0);

//     // 💸 EXPENSE
//     let totalSpent = expenses
//         .filter(e =>
//             e.amount < 0 &&
//             e.monthKey === currentMonth   // 🔥 IMPORTANT
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // 📊 NET
//     let net = totalIncome - totalSpent;

//     // 🟢 REMAINING (based on budget)
//     let remaining = totalBudget - totalSpent;

//     // 📅 TODAY SPENT
//     let today = new Date().toDateString();

//     let todaySpent = expenses
//         .filter(e =>
//             new Date(e.date).toDateString() === today &&
//             e.amount < 0
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // =========================
//     // 🖥️ UPDATE UI
//     // =========================
//     document.getElementById("budgetValue").innerText = totalBudget;
//     document.getElementById("spent").innerText = totalSpent;
//     document.getElementById("remaining").innerText = remaining;
//     document.getElementById("todaySpent").innerText = todaySpent;
//     document.getElementById("incomeValue").innerText = totalIncome;
//     document.getElementById("netValue").innerText = net;
// }
// function loadDashboard() {

//     let savings = getSavings();
//     let budgets = getBudgets();
//     let expenses = getExpenses();

//     let currentMonth = new Date().toISOString().slice(0, 7);

//     // 💰 TOTAL SAVINGS
//     let totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

//     // 📦 TOTAL BUDGET (ONLY CURRENT MONTH)
//     let totalBudget = budgets
//         .filter(b => b.monthKey === currentMonth)
//         .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//     // 💰 INCOME (ONLY CURRENT MONTH)
//     let totalIncome = expenses
//         .filter(e => e.amount > 0 && e.monthKey === currentMonth)
//         .reduce((sum, e) => sum + e.amount, 0);

//     // 💸 EXPENSE (ONLY CURRENT MONTH)
//     let totalSpent = expenses
//         .filter(e => e.amount < 0 && e.monthKey === currentMonth)
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // 📊 NET
//     let net = totalIncome - totalSpent;

//     // 🟢 REMAINING
//     let remaining = totalBudget - totalSpent;

//     // 📅 TODAY SPENT
//     let today = new Date().toDateString();

//     let todaySpent = expenses
//         .filter(e =>
//             new Date(e.date).toDateString() === today &&
//             e.amount < 0
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // UI
//     document.getElementById("budgetValue").innerText = totalBudget;
//     document.getElementById("spent").innerText = totalSpent;
//     document.getElementById("remaining").innerText = remaining;
//     document.getElementById("todaySpent").innerText = todaySpent;
//     document.getElementById("incomeValue").innerText = totalIncome;
//     document.getElementById("netValue").innerText = net;
// }

function hasActiveExpenseQueryState() {
    if (!window.SearchService || typeof window.SearchService.getState !== "function") {
        return false;
    }
    let state = window.SearchService.getState("expenses");
    let searchText = String((state.search && state.search.text) || "").trim();
    let hasFilters = Array.isArray(state.filters) && state.filters.length > 0;
    let hasSort = Array.isArray(state.sort) && state.sort.length > 0;
    return Boolean(searchText || hasFilters || hasSort);
}

function computeBudgetEfficiencyMetrics(referenceDate = new Date()) {
    const budgets = Array.isArray(getBudgets()) ? getBudgets() : [];
    const expenses = Array.isArray(getExpenses()) ? getExpenses() : [];
    const activeBudgets = filterBudgetsByActivePeriod(budgets);
    const activeBudgetIds = activeBudgets.map(b => b && b.budgetId).filter(Boolean);
    const filteredExpenses = filterByActivePeriod(expenses);

    const totalBudget = activeBudgets.reduce((sum, b) => sum + Number(b.totalAllocated || 0), 0);
    const monthSpent = Math.max(0, getNetSpentForBudgetSet(activeBudgetIds, filteredExpenses));
    const monthlyLimit = totalBudget;
    const monthlyRemaining = Math.max(0, monthlyLimit - monthSpent);

    const daysInPeriod = (() => {
        const period = getActiveBudgetPeriod();
        if (!period || !period.start) return 1;
        const start = new Date(period.start);
        const end = period.end ? new Date(period.end) : new Date(referenceDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const diff = Math.round((end - start) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff + 1);
    })();

    const dailyLimit = monthlyLimit > 0 ? monthlyLimit / daysInPeriod : 0;
    const todayStart = new Date(referenceDate);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(referenceDate);
    todayEnd.setHours(23, 59, 59, 999);
    const todayEntries = filteredExpenses.filter(entry => {
        const d = new Date(entry.date);
        return d >= todayStart && d <= todayEnd;
    });
    const todaySpent = Math.max(0, getNetSpentForBudgetSet(activeBudgetIds, todayEntries));
    const dailyRemaining = Math.max(0, dailyLimit - todaySpent);

    const weeklyLimit = monthlyLimit > 0 ? monthlyLimit / 4 : 0;
    const weekStart = new Date(referenceDate);
    weekStart.setDate(referenceDate.getDate() - referenceDate.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    const weekEntries = filteredExpenses.filter(entry => {
        const d = new Date(entry.date);
        return d >= weekStart && d <= weekEnd;
    });
    const weekSpent = Math.max(0, getNetSpentForBudgetSet(activeBudgetIds, weekEntries));
    const weeklyRemaining = Math.max(0, weeklyLimit - weekSpent);

    return {
        dailyLimit,
        todaySpent,
        dailyRemaining,
        weeklyLimit,
        weekSpent,
        weeklyRemaining,
        monthlyLimit,
        monthSpent,
        monthlyRemaining
    };
}

function updateBudgetEfficiency() {
    const metrics = computeBudgetEfficiencyMetrics(new Date());

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = formatCurrency(value);
    };

    setText("savedToday", metrics.dailyRemaining);
    setText("savedWeek", metrics.weeklyRemaining);
    setText("savedPeriod", metrics.monthlyRemaining);
}

function applyActiveExpenseQuery(rows) {
    let list = Array.isArray(rows) ? rows : [];
    if (!window.SearchService || typeof window.SearchService.applyModuleSearch !== "function") {
        return list;
    }
    let queryResult = window.SearchService.applyModuleSearch("expenses", list);
    return Array.isArray(queryResult.results) ? queryResult.results : list;
}

function getExportRows(moduleName, rows) {
    let list = Array.isArray(rows) ? rows : [];
    if (!window.SearchService || typeof window.SearchService.applyModuleSearch !== "function") {
        return list;
    }
    let queryResult = window.SearchService.applyModuleSearch(moduleName, list);
    return Array.isArray(queryResult.results) ? queryResult.results : list;
}

function getExportFilterLabel(moduleName) {
    if (!window.SearchService || typeof window.SearchService.getState !== "function") {
        return "All";
    }
    const state = window.SearchService.getState(moduleName);
    const filters = Array.isArray(state.filters) ? state.filters : [];
    const sort = Array.isArray(state.sort) ? state.sort : [];
    const searchText = state.search && state.search.text ? String(state.search.text).trim() : "";
    const parts = [];
    if (searchText) {
        parts.push(`Search: "${searchText}"`);
    }
    if (filters.length) {
        parts.push(`Filters: ${filters.length}`);
    }
    if (sort.length) {
        const first = sort[0];
        parts.push(`Sort: ${String(first.field || "-")} ${String(first.direction || "desc")}`);
    }
    return parts.length ? parts.join(" | ") : "All";
}

function updateFilteredViewActiveIndicator() {
    let badge = document.getElementById("filteredViewActive");
    if (!badge) return;
    badge.textContent = hasActiveExpenseQueryState() ? "Filtered View Active" : "";
}

function loadDashboard() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    // =========================
    // 📦 ACTIVE DATA
    // =========================
    let filteredBudgets =
        filterBudgetsByActivePeriod(budgets);

    let filteredExpenses =
        filterByActivePeriod(expenses);

    filteredExpenses = applyActiveExpenseQuery(filteredExpenses);
    updateFilteredViewActiveIndicator();

    // =========================
    // 💰 TOTALS
    // =========================
    let totalBudget = filteredBudgets
        .reduce((sum, b) =>
            sum + (b.totalAllocated || 0), 0);

    let budgetIds = filteredBudgets
        .map(b => b && b.budgetId)
        .filter(Boolean);

    let flowSummary = summarizeBudgetLedgerFlows(budgetIds, filteredExpenses);

    let totalIncome = flowSummary.income;

    let totalSpent = getNetSpentForBudgetSet(
        budgetIds,
        filteredExpenses
    );

    let remaining =
        totalBudget - totalSpent;

    let net =
        totalIncome - totalSpent;

    let refundByType = {};
    filteredExpenses
        .filter(e => e.type === "refund" && Number(e.amount || 0) > 0)
        .forEach(e => {
            let key = normalizeRefundType(e.refundType);
            refundByType[key] = (refundByType[key] || 0) + Number(e.amount || 0);
        });

    // =========================
    // 📅 TODAY
    // =========================
    let today = new Date();

    today.setHours(0, 0, 0, 0);

    let endOfDay = new Date(today);

    endOfDay.setHours(23, 59, 59, 999);

    let todayEntries = filteredExpenses
        .filter(e => {

            let d = new Date(e.date);

            return d >= today &&
                d <= endOfDay;

        });

    let todaySpent = getNetSpentForBudgetSet(
        budgetIds,
        todayEntries
    );

    // =========================
    // 🖥️ SAFE UI
    // =========================
    function setText(id, value) {

        let el =
            document.getElementById(id);

        if (el) {
            el.innerText = value;
        }
    }

    setText(
        "budgetValue",
        formatCurrency(totalBudget)
    );

    setText(
        "spent",
        formatCurrency(totalSpent)
    );

    setText(
        "remaining",
        formatCurrency(remaining)
    );

    setText(
        "todaySpent",
        formatCurrency(todaySpent)
    );

    setText(
        "incomeValue",
        formatCurrency(totalIncome)
    );

    setText(
        "netValue",
        formatCurrency(net)
    );

    let refundTypeBreakdown = document.getElementById("refundTypeBreakdown");
    if (refundTypeBreakdown) {
        let entries = Object.entries(refundByType).sort((a, b) => b[1] - a[1]);
        if (!entries.length) {
            refundTypeBreakdown.innerHTML = "<p class='empty-state'>No refunds this period</p>";
        } else {
            refundTypeBreakdown.innerHTML = entries.map(([key, value]) => `
                <div class="refund-type-row">
                    <span>${escapeHtml(REFUND_TYPE_LABELS[key] || "Custom")}</span>
                    <strong>${escapeHtml(formatCurrency(value))}</strong>
                </div>
            `).join("");
        }
    }

    updateProgressBar();
    refreshDashboardLayout();
    setTimeout(() => {
        logDashboardOverflowDiagnostics("loadDashboard");
    }, 0);
}
// =========================
// 📦 LOAD BUDGET SCREEN
// =========================
// Loads current month's budget into UI
function loadBudgetScreen() {

    let budgets = getBudgets();

    let filtered = filterBudgetsByActivePeriod(budgets);

    let total = filtered
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let budgetEl = document.getElementById("currentBudget");
    if (budgetEl) budgetEl.innerText = formatCurrency(total);

    let daily = getDailyLimit();

    let dailyEl = document.getElementById("calculatedDaily"); // ✅ FIXED
    if (dailyEl) dailyEl.innerText = formatCurrency(daily);
}
// =========================
// 📜 RENDER BUDGET LIST
// =========================
// Displays all budget entries
function renderBudgetEntries() {

    let budgetsAll = JSON.parse(localStorage.getItem("budgets")) || [];
    let budgets = budgetsAll;
    let expenses = getExpenses();
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetEntries");
    if (!container) return;

    container.innerHTML = "";

    if (!budgets.length) {
        container.innerHTML = "<p>No budget entries</p>";
        return;
    }

    // ⚠️ FIX (Issue 02): GROUP BY PERIOD ONLY — sourceId must not split
    // a single Budget Wallet's card into multiple cards.
    let map = {};

    budgets.forEach(b => {

        let key = b.periodKey || b.monthKey || "no_period";

        if (!map[key]) {
            map[key] = {
                periodKey: b.periodKey,
                monthKey: b.monthKey || null,
                totalAllocated: 0,
                entity: b.entity
            };
        }

        map[key].totalAllocated += b.totalAllocated || 0;
    });

    let list = Object.values(map).reverse();

    function derivePeriodBounds(group) {
        if (group.periodKey && String(group.periodKey).includes("_to_")) {
            let [from, to] = String(group.periodKey).split("_to_");
            return { from, to };
        }

        if (group.monthKey) {
            let [y, m] = String(group.monthKey).split("-").map(Number);
            if (Number.isFinite(y) && Number.isFinite(m)) {
                let from = `${y}-${String(m).padStart(2, "0")}-01`;
                let toDate = new Date(y, m, 0);
                let to = `${toDate.getFullYear()}-${String(toDate.getMonth() + 1).padStart(2, "0")}-${String(toDate.getDate()).padStart(2, "0")}`;
                return { from, to };
            }
        }

        return { from: "-", to: "-" };
    }

    list.forEach(g => {

        // ⚠️ FIX (Issue 02): match by period only, not sourceId.
        let relatedBudgets = budgets
            .filter(b =>
                (g.periodKey && b.periodKey === g.periodKey) ||
                (!g.periodKey && b.monthKey === g.monthKey)
            );

        let relatedBudgetIds = relatedBudgets.map(b => b.budgetId);

        let used = relatedBudgetIds.reduce((sum, budgetId) => {
            return sum + getNetSpentForBudget(budgetId, expenses);
        }, 0);
        used = Math.max(0, used);

        let remaining = g.totalAllocated - used;

        let name = "Budget";

        let transactionCount = expenses.filter(e => {
            if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
                return e.allocationTrail.some(a => relatedBudgetIds.includes(a.budgetId));
            }
            return relatedBudgetIds.includes(e.budgetId);
        }).length;

        let period = derivePeriodBounds(g);

        let createdCandidates = relatedBudgets
            .map(b => new Date(b.createdAt || b.date || 0).getTime())
            .filter(ts => Number.isFinite(ts) && ts > 0)
            .sort((a, b) => a - b);

        let createdDate = createdCandidates.length
            ? new Date(createdCandidates[0]).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
            : "-";

        let div = document.createElement("div");
        div.className = "budget-period-card entry-card";

        div.innerHTML = `
            <div class="entry-card-head">
                <div class="entry-title-wrap">
                    <h4 class="entry-title">${escapeHtml(name)}</h4>
                    <small class="entry-subtitle">From ${escapeHtml(period.from === "-" ? "-" : formatDateShort(period.from))} • To ${escapeHtml(period.to === "-" ? "-" : formatDateShort(period.to))}</small>
                </div>
                <span class="entry-status-pill ${remaining <= 0 ? "is-exhausted" : "is-active"}">${remaining <= 0 ? "Exhausted" : "Active"}</span>
            </div>

            <div class="entry-details-grid">
                <span class="entry-label">Budget Amount</span>
                <span class="entry-value">${escapeHtml(formatCurrency(g.totalAllocated))}</span>
                <span class="entry-label">Spent</span>
                <span class="entry-value">${escapeHtml(formatCurrency(used))}</span>
                <span class="entry-label">Remaining</span>
                <span class="entry-value">${escapeHtml(formatCurrency(remaining))}</span>
                <span class="entry-label">Transactions</span>
                <span class="entry-value">${escapeHtml(String(transactionCount))}</span>
                <span class="entry-label">Created Date</span>
                <span class="entry-value">${escapeHtml(createdDate)}</span>
            </div>

            <div class="entry-actions">
                <button type="button" class="entry-action-btn" data-action="view">View Transactions</button>
                <button type="button" class="entry-action-btn" data-action="close"${remaining <= 0 ? " disabled" : ""}>Close & Transfer Back</button>
                <button type="button" class="entry-action-btn is-muted" disabled>Edit</button>
                <button type="button" class="entry-action-btn is-muted" disabled>Delete</button>
            </div>
        `;

        div.style.cursor = "pointer";
        div.onclick = () => openBudgetDetails(g);
        let viewBtn = div.querySelector('[data-action="view"]');
        if (viewBtn) {
            viewBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                openBudgetDetails(g);
            });
        }

        let closeBtn = div.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener("click", (event) => {
                event.stopPropagation();
                quickCloseBudgetTransferBack(g, relatedBudgetIds);
            });
        }

        container.appendChild(div);
    });
}

function toggleBudgetEntryDetails(id) {
    let details = document.getElementById(`budgetEntryDetails_${id}`);
    if (!details) return;
    details.style.display = details.style.display === "none" ? "block" : "none";
}
// Normalizes a Savings funding transaction (Move to Budget, or a
// resolved Unassigned Top-Up) into the same shape the expense-based
// history rows use, so both render through the same existing template.
function normalizeFundingEntryForBudgetHistory(s) {
    return {
        id: s.id,
        type: s.type,
        purpose: s.note || "",
        category: null,
        date: s.date,
        createdAt: s.createdAt || s.date,
        // Flip sign: this is an INFLOW to the wallet, even though it's
        // an outflow from Savings.
        amount: Math.abs(Number(s.amount) || 0),
        paymentType: s.paymentType,
        entity: s.entity,
        attachmentId: s.attachmentId || null,
        attachmentStatus: s.attachmentStatus || "none",
        linkedTransactionId: null,
        resolutionType: null,
        refundType: null,
        // A wallet-specific running balance across a merged
        // expense+funding timeline isn't computed here — these rows
        // show "-" instead of the (unrelated) Savings ledger balance.
        BalanceAfterTransaction: null,
        runningBalance: null,
        __source: "savings"
    };
}
function openBudgetDetails(group) {
    let budgets = getBudgets();
    let expenses = getExpenses();
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetDetailsContainer");
    if (!container) return;

    let name = "Budget";

    let related = [];

    // ⚠️ FIX (Issue 02): match by period only, not sourceId — a Budget
    // Wallet can now be funded by multiple sources.
    let relatedBudgetIds = budgets
        .filter(b =>
            (group.periodKey && b.periodKey === group.periodKey) ||
            (!group.periodKey && b.monthKey === group.monthKey)
        )
        .map(b => b.budgetId);

    related = expenses.filter(e => {
        if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
            return e.allocationTrail.some(a => relatedBudgetIds.includes(a.budgetId));
        }
        return relatedBudgetIds.includes(e.budgetId);
    });

    // ⚠️ FIX: funding transactions (Move to Budget, resolved Top-Ups)
    // live in Savings, not Expenses — they were never being shown here
    // at all. Kept as a SEPARATE list from `related` on purpose: the
    // Used/Credited math just below must stay expense-only.
    let fundingEntries = savings
        .filter(s => s && s.budgetWalletId && relatedBudgetIds.includes(s.budgetWalletId))
        .map(normalizeFundingEntryForBudgetHistory);

    let displayEntries = related.concat(fundingEntries)
        .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));

    let used = relatedBudgetIds.reduce((sum, budgetId) => {
        return sum + getNetSpentForBudget(budgetId, related);
    }, 0);
    used = Math.max(0, used);

    let credited = 0;
    related.forEach(e => {
        let contrib = 0;

        if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
            contrib = e.allocationTrail
                .filter(a => relatedBudgetIds.includes(a.budgetId))
                .reduce((s, a) => s + Math.abs(Number(a.amount) || 0), 0);
        } else if (relatedBudgetIds.includes(e.budgetId)) {
            contrib = Math.abs(Number(e.amount) || 0);
        }

        if (!contrib) return;

        if (e.type === "recovery" || e.type === "refund") {
            credited += contrib;
        }
    });

    let remaining = group.totalAllocated - used;

    // 🔥 Proper label
    let label = "No Date";

    if (group.periodKey) {
        let [start, end] = group.periodKey.split("_to_");
        label = `${formatDateShort(start)} → ${formatDateShort(end)}`;
    } else if (group.monthKey) {
        label = formatMonth(group.monthKey);
    }

    let entriesHtml = "";

    if (!displayEntries.length) {
        entriesHtml = "<p>No entries</p>";
    } else {
        displayEntries.forEach(e => {
            let compactDate = new Date(e.date || Date.now()).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
            let hasBalance = e.BalanceAfterTransaction != null || e.runningBalance != null;
            let runningBalance = hasBalance ? Number(e.BalanceAfterTransaction ?? e.runningBalance ?? 0) : null;
            let snapshot = getExpenseResolutionSnapshot(e.linkedTransactionId || e.id, related);
            let attachmentText = e.attachmentId
                ? `Linked (${e.attachmentStatus || "linked"})`
                : (e.attachmentStatus === "failed" ? "Failed" : "None");

            entriesHtml += `
                <div class="expense-item transaction-card">
                    <div class="transaction-card-head">
                        <div class="history-type">${escapeHtml(String(e.type || "entry").replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase()))}</div>
                        <div class="transaction-title">${escapeHtml(e.purpose || e.category || "Entry")}</div>
                    </div>

                    <div class="transaction-meta-grid">
                        <span class="entry-label">Date</span>
                        <span class="entry-value">${escapeHtml(compactDate)}</span>
                        <span class="entry-label">Notes</span>
                        <span class="entry-value">${escapeHtml(e.purpose || "-")}</span>
                        <span class="entry-label">Running Balance</span>
                        <span class="entry-value">${runningBalance == null ? "-" : escapeHtml(formatCurrency(runningBalance))}</span>
                    </div>

                    <div class="transaction-card-foot">
                        <div class="history-amount ${Number(e.amount || 0) < 0 ? "negative" : "positive"}">${escapeHtml(formatCurrency(Math.abs(Number(e.amount || 0))))}</div>
                        <div class="history-actions">
                            <button class="entry-action-btn" type="button" onclick="toggleBudgetEntryDetails('${escapeHtml(e.id)}')">View Details</button>
                        </div>
                    </div>

                    <div id="budgetEntryDetails_${escapeHtml(e.id)}" class="entry-extra-details" style="display:none;">
                        <small><strong>Transaction ID:</strong> ${escapeHtml(e.id || "-")}</small><br>
                        <small><strong>Created At:</strong> ${escapeHtml(new Date(e.createdAt || e.date || Date.now()).toLocaleString("en-IN"))}</small><br>
                        <small><strong>Linked Transaction:</strong> ${escapeHtml(e.linkedTransactionId || "-")}</small><br>
                        <small><strong>Original Amount:</strong> ${escapeHtml(formatCurrency(snapshot.originalAmount || 0))}</small><br>
                        <small><strong>Refunded Amount:</strong> ${escapeHtml(formatCurrency(snapshot.refunded || 0))}</small><br>
                        <small><strong>Remaining Refundable:</strong> ${escapeHtml(formatCurrency(snapshot.remainingRefundable || 0))}</small><br>
                        <small><strong>Loss Amount:</strong> ${escapeHtml(formatCurrency(snapshot.loss || 0))}</small><br>
                        <small><strong>Refund Type:</strong> ${escapeHtml(e.type === "refund" ? formatRefundType(e.refundType) : "-")}</small><br>
                        <small><strong>Resolution Type:</strong> ${escapeHtml(e.resolutionType ? (RESOLUTION_TYPE_LABELS[normalizeResolutionType(e.resolutionType)] || e.resolutionType) : "-")}</small><br>
                        <small><strong>Attachment:</strong> ${escapeHtml(attachmentText)}</small><br>
                        <small><strong>Audit Information:</strong> ${escapeHtml(e.type || "-")} | ${escapeHtml(e.paymentType || "-")} | ${escapeHtml(e.entity || "-")}</small>
                        ${e.attachmentId ? `
                        <div class="entry-attachment-actions">
                            <button class="entry-action-btn" type="button" onclick="viewAttachmentById('${escapeHtml(e.attachmentId)}')">View</button>
                            <button class="entry-action-btn" type="button" onclick="downloadAttachmentById('${escapeHtml(e.attachmentId)}')">Download</button>
                                                        <button class="entry-action-btn is-danger" type="button" onclick="deleteTransactionAttachment('${e.__source === "savings" ? "savings" : "expense"}','${escapeHtml(e.id)}','${escapeHtml(e.attachmentId)}')">Delete</button>
                        </div>` : ""}
                    </div>
                </div>
            `;
        });
    }

    showScreen("budgetDetails");

    container.innerHTML = `
        <div class="entry-details-shell">
            <div class="entry-details-header">
                <div>
                    <h3>${escapeHtml(name)}</h3>
                    <small>${escapeHtml(label)}</small>
                </div>
                <button class="entry-action-btn" type="button" onclick="goBackToBudgets()">Back</button>
            </div>

            <div class="entry-summary-grid">
                <div>
                    <small>Allocated</small>
                    <strong>${escapeHtml(formatCurrency(group.totalAllocated))}</strong>
                </div>
                <div>
                    <small>Used</small>
                    <strong>${escapeHtml(formatCurrency(used))}</strong>
                </div>
                <div>
                    <small>Credited</small>
                    <strong>${escapeHtml(formatCurrency(credited))}</strong>
                </div>
                <div>
                    <small>Remaining</small>
                    <strong>${escapeHtml(formatCurrency(remaining))}</strong>
                </div>
            </div>

            <h4>Entries</h4>
            <div class="entry-details-transactions">
                ${entriesHtml}
            </div>
        </div>
    `;
}

function goBackToBudgets() {
    showScreen("budgets");
    renderBudgetEntries();
}
// =========================
// 📅 CALCULATE DAILY LIMIT
// =========================
// Returns how much you can spend per day
function getDailyLimit() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    // =========================
    // 📦 ACTIVE BUDGETS
    // =========================
    let filteredBudgets = filterBudgetsByActivePeriod(budgets);

    let totalBudget = filteredBudgets
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    // =========================
    // 💸 SPENT
    // =========================
    let filteredExpenses = filterByActivePeriod(expenses);

    let spent = filteredBudgets.reduce((sum, b) => {
        return sum + getNetSpentForBudget(b.budgetId, filteredExpenses);
    }, 0);

    spent = Math.max(0, spent);

    // =========================
    // 💰 REMAINING
    // =========================
    let remaining = totalBudget - spent;

    // =========================
    // 📅 DAYS LEFT (PERIOD BASED)
    // =========================
    let period = getActiveBudgetPeriod();

    let daysLeft = 1;

    if (period) {

        let today = new Date();

        // normalize today
        today.setHours(0, 0, 0, 0);

        let end = period.end
            ? new Date(period.end)
            : new Date();

        // normalize end
        end.setHours(0, 0, 0, 0);

        // ✅ ADD EXTRA DAYS
        end.setDate(end.getDate() + (period.extraDays || 0));

        // ✅ calculate remaining days
        let diff = end - today;

        daysLeft = Math.max(
            1,
            Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
        );
    }

    // =========================
    // 🧠 SAFETY
    // =========================
    if (daysLeft <= 0) return 0;

    // =========================
    // 📊 DAILY LIMIT
    // =========================
    return Math.floor(remaining / daysLeft);
}

// =========================
// 📊 LOAD GRAPH (MERGED VERSION)
// =========================
// Shows day/week/month + category breakdown
// let chart;

// function loadGraph(type = "day", data = null, customRange = null) {

//     const ctx = document.getElementById("myChart");
//     if (!ctx || !window.Chart) return;

//     if (chart) chart.destroy();

//     const expenses = data || getExpenses();
//     const now = new Date();

//     const dataset = groupData(expenses, type, now, customRange);

//     const chartData = prepareChartData(dataset);
//     const datasets = createDatasets(chartData);

//     chart = new Chart(ctx, {
//         type: "bar",
//         data: {
//             labels: chartData.labels,
//             datasets: datasets
//         },
//         options: getChartOptions(type, expenses, dataset, now, customRange)
//     });

//     // 🔥 Initial Category Breakdown
//     const filtered = filterDataByType(type, expenses, now, customRange);
//     renderCategoryBreakdown(groupByCategory(filtered));
// }
// function prepareChartData(dataset) {
//     return {
//         labels: dataset.map(d => d.label),
//         expense: dataset.map(d => d.exp),
//         income: dataset.map(d => d.inc),
//         total: dataset.map(d => d.inc - d.exp)
//     };
// }
// function createDatasets(data) {

//     function getFixedDailyBudget() {
//         let budgets = getBudgets();
//         let currentMonth = new Date().toISOString().slice(0, 7);

//         let filteredBudgets = filterBudgetsByActivePeriod(budgets);

//         let total = filteredBudgets
//             .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//         let today = new Date();
//         let totalDays = new Date(
//             today.getFullYear(),
//             today.getMonth() + 1,
//             0
//         ).getDate();

//         return Math.floor(total / totalDays);
//     }

//     const fixedDaily = getFixedDailyBudget();
//     const budgetData = data.labels.map(() => fixedDaily);

//     return [
//         {
//             label: "Expense",
//             data: data.expense,
//             backgroundColor: "rgba(255,99,132,0.7)"
//         },
//         {
//             label: "Income",
//             data: data.income,
//             backgroundColor: "rgba(75,192,192,0.7)"
//         },
//         {
//             label: "Total",
//             data: data.total,
//             type: "line",
//             borderColor: "purple",
//             tension: 0.4
//         },
//         {
//             label: "Budget",
//             data: budgetData,
//             type: "line",
//             borderColor: "orange",
//             borderDash: [5, 5]
//         }
//     ];
// }
// function getChartOptions(type, expenses, dataset, now, customRange) {

//     return {
//         responsive: true,
//         maintainAspectRatio: false,

//         plugins: {
//             tooltip: {
//                 mode: "index",
//                 intersect: false,
//                 callbacks: {
//                     label: function (ctx) {
//                         return `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
//                     }
//                 }
//             }
//         },

//         scales: {
//             x: {
//                 ticks: {
//                     maxRotation: 45,
//                     minRotation: 45
//                 }
//             },
//             y: {
//                 beginAtZero: true
//             }
//         },

//         onClick: function (evt, elements) {
//             if (!elements.length) return;

//             const index = elements[0].index;
//             const filtered = handlePointClick(type, index, expenses, dataset, now, customRange);

//             renderCategoryBreakdown(groupByCategory(filtered));
//         }
//     };
// }
// function handlePointClick(type, index, expenses, dataset, now, customRange) {

//     // ✅ DAY (hour-based)
//     if (type === "day") {
//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d.getHours() === index &&
//                 d.toDateString() === now.toDateString();
//         });
//     }

//     // ✅ RANGE (date-based)
//     const selected = dataset[index];
//     if (!selected || !selected.key) return [];

//     return expenses.filter(e => {
//         const d = new Date(e.date);
//         const dKey = d.toLocaleDateString("en-CA");

//         return dKey === selected.key;
//     });
// }
// function filterDataByType(type, expenses, now, customRange) {

//     if (type === "day") {
//         return expenses.filter(e =>
//             new Date(e.date).toDateString() === now.toDateString()
//         );
//     }

//     if (type === "week") {
//         const start = new Date(now);
//         start.setDate(now.getDate() - now.getDay());

//         const end = new Date(start);
//         end.setDate(start.getDate() + 6);

//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d >= start && d <= end;
//         });
//     }

//     if (type === "month") {
//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d.getMonth() === now.getMonth();
//         });
//     }

//     if (type === "custom" && customRange) {
//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d >= new Date(customRange.start) &&
//                 d <= new Date(customRange.end);
//         });
//     }

//     return [];
// }

let chart;
function loadGraph(type = "day", data = null, customRange = null) {
    const expenses = applyActiveExpenseQuery(data || getExpenses());
    const dataset = groupData(expenses, type, null, customRange);
    const filtered = filterDataByType(type, expenses, customRange);

    updateGraphSummary(type, dataset, filtered, customRange);

    const ctx = document.getElementById("myChart");
    if (!ctx || !window.Chart) {
        renderCategoryBreakdown(groupByCategory(filtered));
        return;
    }

    if (chart) chart.destroy();

    const chartData = prepareChartData(dataset);
    const datasets = createDatasets(chartData, dataset);

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: chartData.labels,
            datasets: datasets
        },
        options: getChartOptions(type, expenses, dataset, customRange)
    });

    renderCategoryBreakdown(groupByCategory(filtered));
}

function calculateGraphAverageExpense(type, dataset, customRange = null) {
    return calculateAverageSpendingByType(type, dataset, customRange);
}

function calculateAverageSpendingByType(type, data, customRange = null) {
    const rows = Array.isArray(data) ? data : [];
    if (!rows.length) return 0;

    const getDateKey = value => {
        const d = new Date(value);
        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    };

    const totalExpense = rows.reduce((sum, row) => {
        if (row && typeof row === "object" && "exp" in row) {
            return sum + Math.abs(Number(row.exp || 0));
        }
        return sum + (Number(row.amount || 0) < 0 ? Math.abs(Number(row.amount || 0)) : 0);
    }, 0);

    if (type === "custom" && customRange && customRange.start && customRange.end) {
        const start = new Date(customRange.start);
        const end = new Date(customRange.end);
        start.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        const customDays = Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1);
        return totalExpense / customDays;
    }

    if (type === "day") {
        const dayUnits = new Set(rows.map(r => getDateKey(r.date || Date.now()))).size || 1;
        return totalExpense / dayUnits;
    }

    if (type === "week") {
        const weekUnits = new Set(rows.map(r => {
            const d = new Date(r.date || Date.now());
            const start = new Date(d);
            start.setDate(d.getDate() - d.getDay());
            start.setHours(0, 0, 0, 0);
            return getDateKey(start);
        })).size || 1;
        return totalExpense / weekUnits;
    }

    if (type === "month") {
        const monthUnits = new Set(rows.map(r => {
            const d = new Date(r.date || Date.now());
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        })).size || 1;
        return totalExpense / monthUnits;
    }

    return totalExpense / Math.max(1, rows.length);
}

function updateGraphSummary(type, dataset, filtered, customRange = null) {
    const summaryEl = document.getElementById("graphDate");
    if (!summaryEl) return;

    const rows = Array.isArray(dataset) ? dataset : [];
    const entries = Array.isArray(filtered) ? filtered : [];

    const totalExpense = rows.reduce((sum, row) => {
        return sum + Math.abs(Number(row && row.exp ? row.exp : 0));
    }, 0);
    const totalIncome = rows.reduce((sum, row) => {
        return sum + Number(row && row.inc ? row.inc : 0);
    }, 0);
    const activeBudgetIds = filterBudgetsByActivePeriod(getBudgets())
        .map(b => b && b.budgetId)
        .filter(Boolean);
    const budgetAwareSpent = activeBudgetIds.length
        ? getNetSpentForBudgetSet(activeBudgetIds, entries)
        : totalExpense;
    const budgetAwareIncome = activeBudgetIds.length
        ? summarizeBudgetLedgerFlows(activeBudgetIds, entries).income
        : totalIncome;
    const averageExpense = calculateAverageSpendingByType(type, entries, customRange);

    let scopeLabel = "Selected";
    if (type === "day") scopeLabel = "Today";
    else if (type === "week") scopeLabel = "This Week";
    else if (type === "month") scopeLabel = "This Period";
    else if (type === "custom") scopeLabel = "Custom Range";

    let unitLabel = "/unit";
    if (type === "day" || type === "custom") unitLabel = "/day";
    else if (type === "week") unitLabel = "/week";
    else if (type === "month") unitLabel = "/month";

    summaryEl.innerText = [
        scopeLabel,
        `Entries: ${entries.length}`,
        `Spent: ${formatCurrency(budgetAwareSpent)}`,
        `Income: ${formatCurrency(budgetAwareIncome)}`,
        `Avg Spend${unitLabel}: ${formatCurrency(averageExpense)}`
    ].join(" | ");
}

function prepareChartData(dataset) {
    return {
        labels: dataset.map(d => d.label),
        expense: dataset.map(d => d.exp),
        income: dataset.map(d => d.inc),

        // 🔥 keep total (for tooltip only)
        total: dataset.map(d => d.inc - d.exp)
    };
}
function createDatasets(data, dataset) {

    function getChartThemeTokens() {
        const root = getComputedStyle(document.documentElement);
        const themeHex = (root.getPropertyValue('--theme') || localStorage.getItem('theme') || '').trim();
        const text = (root.getPropertyValue('--text') || '').trim() || getComputedStyle(document.body).color;
        const muted = (root.getPropertyValue('--muted') || '').trim() || getComputedStyle(document.body).color;
        const border = (root.getPropertyValue('--border') || '').trim() || getComputedStyle(document.body).color;

        let base = { r: 0, g: 0, b: 0 };
        try {
            if (themeHex) base = hexToRgb(themeHex);
        } catch (_err) {
            // fallback above
        }

        const expense = `rgba(${base.r}, ${base.g}, ${base.b}, 0.78)`;
        const income = `rgba(${base.r}, ${base.g}, ${base.b}, 0.34)`;
        const budgetLine = `rgba(${base.r}, ${base.g}, ${base.b}, 1)`;

        return { text, muted, border, expense, income, budgetLine };
    }

    const themeTokens = getChartThemeTokens();

    function getFixedDailyBudget() {

        let budgets = getBudgets();

        // 🔥 periodKey based filtering
        let activeBudgets = filterBudgetsByActivePeriod(budgets);

        let total = activeBudgets.reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

        // 🔥 get period days
        let period = getActiveBudgetPeriod();

        let totalDays = 30;

        if (period) {

            let s = new Date(period.start);
            let e = period.end ? new Date(period.end) : new Date();

            totalDays = Math.max(
                1,
                Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1
            );

            // ✅ ADD EXTRA DAYS
            totalDays += (period.extraDays || 0);
        }

        return Math.floor(total / totalDays);
    }

    const budgetData = dataset.map(d => d.budget || 0);

    return [
        {
            label: "Expense",
            data: data.expense,
            backgroundColor: themeTokens.expense
        },
        {
            label: "Income",
            data: data.income,
            backgroundColor: themeTokens.income
        },
        // ❌ REMOVED TOTAL LINE
        {
            label: "Budget",
            data: budgetData,
            type: "line",
            borderColor: themeTokens.budgetLine,
            pointBackgroundColor: themeTokens.budgetLine,
            pointBorderColor: themeTokens.budgetLine,
            borderDash: [5, 5]
        }
    ];
}
function getChartOptions(type, expenses, dataset, customRange) {

    const root = getComputedStyle(document.documentElement);
    const textColor = (root.getPropertyValue('--text') || '').trim() || getComputedStyle(document.body).color;
    const mutedColor = (root.getPropertyValue('--muted') || '').trim() || getComputedStyle(document.body).color;
    const borderColor = (root.getPropertyValue('--border') || '').trim() || getComputedStyle(document.body).color;
    const surfaceColor = (root.getPropertyValue('--surface') || '').trim() || getComputedStyle(document.body).backgroundColor;

    return {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
            mode: "index",
            intersect: false
        },

        plugins: {
            tooltip: {
                backgroundColor: surfaceColor,
                titleColor: textColor,
                bodyColor: textColor,
                borderColor: borderColor,
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                displayColors: false,

                callbacks: {

                    title: function (items) {
                        return items[0].label;
                    },

                    label: function () {
                        return null;
                    },

                    afterBody: function (items) {

                        if (!items.length) return;

                        let index = items[0].dataIndex;
                        let point = dataset[index] || {};

                        let expense = point.exp || 0;
                        let income = point.inc || 0;
                        let budget = point.budget || 0;
                        let total = income - expense;

                        let netColor = total >= 0 ? "" : "";

                        return [
                            `Expense  : ${formatCurrency(expense)}`,
                            `Income   : ${formatCurrency(income)}`,
                            `Budget   : ${formatCurrency(budget)}`,
                            `-----------------------`,
                            `Net      : ${netColor} ${formatCurrency(total)}`
                        ];
                    }
                }
            },

            legend: {
                labels: {
                    color: mutedColor,
                    usePointStyle: true
                }
            }
        },

        scales: {
            x: {
                grid: {
                    display: true,
                    color: borderColor
                },
                ticks: {
                    color: textColor,
                    autoSkip: true,
                    maxRotation: 90,
                    minRotation: 90
                }
            },

            y: {
                beginAtZero: true,
                grid: {
                    color: borderColor
                },
                ticks: {
                    color: textColor,
                    callback: function (value) {
                        return formatCurrency(value);
                    }
                }
            }
        },

        animation: {
            duration: 700,
            easing: "easeOutQuart"
        },

        onClick: function (evt, elements) {

            if (!elements.length) return;

            const index = elements[0].index;

            const filtered = handlePointClick(
                type,
                index,
                expenses,
                dataset,
                customRange
            );

            renderCategoryBreakdown(groupByCategory(filtered));
        }
    };
}

function filterDataByType(
    type,
    expenses,
    customRange = null
) {

    type =
        (type || "month").toLowerCase();

    if (type === "all") {
        return Array.isArray(expenses) ? expenses.slice() : [];
    }

    if (type === "today") {
        type = "day";
    }

    let start;
    let end;

    let now = new Date();

    // =========================
    // 📅 TODAY
    // =========================
    if (type === "day") {

        start = new Date();

        start.setHours(0, 0, 0, 0);

        end = new Date();

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 📅 WEEK
    // =========================
    else if (type === "week") {

        start = new Date(now);

        start.setDate(
            now.getDate() - now.getDay()
        );

        start.setHours(0, 0, 0, 0);

        end = new Date(start);

        end.setDate(
            start.getDate() + 6
        );

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 📅 MONTH / ACTIVE PERIOD
    // =========================
    else if (type === "month") {

        let period =
            getActiveBudgetPeriod();

        if (period) {

            start =
                new Date(period.start);

            end =
                period.end
                    ? new Date(period.end)
                    : new Date();

        } else {

            start = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            end = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0
            );
        }

        start.setHours(0, 0, 0, 0);

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 📅 CUSTOM
    // =========================
    else if (
        type === "custom" &&
        customRange
    ) {

        start =
            new Date(customRange.start);

        end =
            new Date(customRange.end);

        start.setHours(0, 0, 0, 0);

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 🧠 FILTER
    // =========================
    if (!(start instanceof Date) || !(end instanceof Date)) {
        return Array.isArray(expenses) ? expenses.slice() : [];
    }

    return expenses.filter(e => {

        let d = new Date(e.date);

        return d >= start &&
            d <= end;
    });
}

// function filterByIndex(data, type, index, now) {
//     return data.filter(e => {
//         let d = e.date ? new Date(e.date) : null;

//         if (!d || isNaN(d.getTime())) return;

//         if (type === "day") {
//             return d.getHours() === index &&
//                 d.toDateString() === now.toDateString();
//         }

//         if (type === "week") {
//             let start = new Date(now);
//             start.setDate(now.getDate() - now.getDay());

//             let selected = new Date(start);
//             selected.setDate(start.getDate() + index);

//             return d.toDateString() === selected.toDateString();
//         }

//         if (type === "month") {
//             return d.getDate() === index + 1 &&
//                 d.getMonth() === now.getMonth();
//         }
//     });
// }

// Default filter
// function filterByType(data, type, now) {
//     return data.filter(e => {
//         let d = e.date ? new Date(e.date) : null;

//         if (!d || isNaN(d.getTime())) return;

//         if (type === "day") return d.toDateString() === now.toDateString();

//         if (type === "week") {
//             let start = new Date(now);
//             start.setDate(now.getDate() - now.getDay());
//             return d >= start;
//         }

//         if (type === "month") {
//             return d.getMonth() === now.getMonth();
//         }

//         return true;
//     });
// }

// =========================
// 📊 GROUP BY CATEGORY
// =========================
// Converts list → category totals
function groupByCategory(data) {
    let map = {};

    data.forEach(e => {
        if (e.amount < 0) {
            let cat = e.category || "Other";

            if (!map[cat]) map[cat] = 0;

            map[cat] += Math.abs(e.amount);
        }
    });

    return map;
}

// =========================
// 📊 RENDER CATEGORY BREAKDOWN
// =========================
// Displays category-wise spending
function renderCategoryBreakdown(map) {

    let container = document.getElementById("categoryBreakdown");
    if (!container) return;

    container.innerHTML = "";

    // ✅ FIX: handle undefined/null safely
    if (!map || typeof map !== "object") {
        container.innerHTML = "<p>No data</p>";
        return;
    }

    let entries = Object.entries(map);

    if (!entries.length) {
        container.innerHTML = "<p>No data</p>";
        return;
    }

    entries.forEach(([cat, amt]) => {
        let div = document.createElement("div");

        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.padding = "6px 0";

        div.innerHTML = `
            <span>${cat}</span>
            <strong>${formatCurrency(amt)}</strong>
        `;

        container.appendChild(div);
    });
}

function groupData(expenses, type, now, customRange = null) {

    now = new Date();

    let map = {};

    // =========================
    // 📅 SAFE DATE KEY
    // =========================
    function formatDateSafe(date) {

        let d = new Date(date);

        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    }

    // =========================
    // 📊 DAY VIEW
    // =========================
    if (type === "day") {

        for (let i = 0; i < 24; i++) {

            map[i] = {
                exp: 0,
                inc: 0,
                budget: getDailyLimit()
            };
        }

        expenses.forEach(e => {

            let d = new Date(e.date);

            if (d.toDateString() !== now.toDateString()) {
                return;
            }

            let hour = d.getHours();

            if (e.amount < 0) {

                map[hour].exp += Math.abs(e.amount);

            } else {

                map[hour].inc += e.amount;
            }
        });

        return Object.keys(map).map(h => ({

            key: h,

            label: h + ":00",

            exp: map[h].exp,

            inc: map[h].inc,

            budget: map[h].budget
        }));
    }

    // =========================
    // 📅 RANGE SETUP
    // =========================
    let start;
    let end;

    // WEEK
    if (type === "week") {

        start = new Date(now);

        start.setDate(
            now.getDate() - now.getDay()
        );

        end = new Date(start);

        end.setDate(
            start.getDate() + 6
        );
    }

    // MONTH / ACTIVE PERIOD
    else if (type === "month") {

        let period =
            getActiveBudgetPeriod();

        if (period) {

            start = new Date(period.start);

            end = period.end
                ? new Date(period.end)
                : new Date();

        } else {

            start = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            end = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0
            );
        }
    }

    // CUSTOM
    else if (type === "custom") {

        if (
            customRange &&
            customRange.start &&
            customRange.end
        ) {

            start =
                new Date(customRange.start);

            end =
                new Date(customRange.end);

        } else {

            let period =
                getActiveBudgetPeriod();

            if (period) {

                start =
                    new Date(period.start);

                end =
                    period.end
                        ? new Date(period.end)
                        : new Date();
            }
        }
    }

    // =========================
    // 🧠 SAFETY
    // =========================
    if (!start || !end) {
        return [];
    }

    start.setHours(0, 0, 0, 0);

    end.setHours(23, 59, 59, 999);

    // =========================
    // 💰 INITIAL RUNNING BUDGET
    // =========================
    let runningBudget =
        getTotalBudget();

    // =========================
    // 🗓️ BUILD DATE MAP
    // =========================
    let current =
        new Date(start);

    while (current <= end) {

        let key =
            formatDateSafe(current);

        map[key] = {

            key: key,

            label:
                current.toLocaleDateString(
                    "en-IN",
                    {
                        day: "numeric",
                        month: "short"
                    }
                ),

            exp: 0,

            inc: 0,

            budget: runningBudget
        };

        current.setDate(
            current.getDate() + 1
        );
    }

    // =========================
    // 📦 SORT EXPENSES
    // =========================
    let sortedExpenses =
        [...expenses].sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );

    // =========================
    // 📊 FILL DATA
    // =========================
    sortedExpenses.forEach(e => {

        let key =
            formatDateSafe(e.date);

        if (!map[key]) {
            return;
        }

        // EXPENSE
        if (e.amount < 0) {

            let abs =
                Math.abs(e.amount);

            map[key].exp += abs;

        }

        // INCOME
        else {

            map[key].inc += e.amount;
        }
    });

    // =========================
    // 📉 CUMULATIVE BUDGET LINE
    // =========================
    let remainingBudget =
        getTotalBudget();

    Object.values(map).forEach(day => {

        day.budget =
            remainingBudget;

        remainingBudget -=
            day.exp;
    });

    return Object.values(map);
}

// function groupByCategory(expenses) {

//     let map = {};

//     expenses.forEach(e => {
//         if (e.amount < 0) { // only expense
//             let cat = e.category || "Other";

//             if (!map[cat]) map[cat] = 0;

//             map[cat] += Math.abs(e.amount);
//         }
//     });

//     return map;
// }


function getLoanSummary() {
    let expenses = getExpenses();

    let loans = {};

    expenses.forEach(e => {
        if (!e.entity) return;

        if (!loans[e.entity]) {
            loans[e.entity] = {
                given: 0,
                received: 0
            };
        }

        if (e.amount < 0) {
            loans[e.entity].given += Math.abs(e.amount);
        }

        if (e.amount > 0 && e.category === "Recovery") {
            loans[e.entity].received += e.amount;
        }
    });

    let result = [];

    for (let person in loans) {
        let given = loans[person].given;
        let received = loans[person].received;

        result.push({
            person,
            given,
            received,
            pending: given - received
        });
    }

    return result;
}
function renderLoanSummary() {
    let container = document.getElementById("loanSummary");
    if (!container) return;

    let data = getLoanSummary();

    container.innerHTML = "";

    if (!data || !data.length) {
        container.innerHTML = "<p>No loans yet</p>";
        return;
    }

    data.forEach(item => {

        let wrapper = document.createElement("div");

        let statusColor = item.pending > 0 ? "red" : "green";
        let statusText = item.pending > 0 ? "Pending" : "Cleared";

        wrapper.innerHTML = `
            <div style="margin-bottom:12px;">
                <strong>${item.person}</strong><br>

                Given: ${formatCurrency(item.given)} |
                Received: ${formatCurrency(item.received)} <br>

                <span style="color:${statusColor}; font-weight:600;">
                    ${statusText}: ${formatCurrency(item.pending)}
                </span>
            </div>
        `;

        container.appendChild(wrapper);
    });
}

// function renderBudgetEntries() {
//     let container = document.getElementById("budgetEntries");
//     if (!container) return;

//     let budgets = getBudgets();
//     let expenses = getExpenses();

//     container.innerHTML = "";

//     if (!budgets.length) {
//         container.innerHTML = "<p>No budget entries</p>";
//         return;
//     }

//     budgets.forEach(b => {

//         // 🔥 calculate spent
//         let spent = expenses
//             .filter(e => e.budgetId === b.budgetId && e.type === "expense")
//             .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//         let remaining = (b.totalAllocated || 0) - spent;

//         let div = document.createElement("div");
//         div.className = "budget-card";

//         div.innerHTML = `
//             <div>
//                 <strong>${formatBudgetName(b.budgetId)}</strong><br>
//                 <small>${b.entity}</small>
//             </div>

//             <div style="margin-top:6px;">
//                 Allocated: ₹${b.totalAllocated || 0}<br>
//                 Spent: ₹${spent}<br>
//                 <strong style="color:${remaining >= 0 ? 'green' : 'red'}">
//                     Remaining: ${formatCurrency(remaining)}
//                 </strong>
//             </div>
//         `;

//         container.appendChild(div);
//     });
// }
function openBudgetScreen() {
    renderBudgetEntries();  // 🔥 MUST
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
function openImportModal() {
    let modal = document.getElementById("importModal");
    if (modal) modal.style.display = "flex";
}

function closeImportModal() {
    let modal = document.getElementById("importModal");
    if (modal) modal.style.display = "none";
}

function handleFileImport(event) {
    let file = event.target.files && event.target.files[0];
    if (!file) return;

    setImportStage("file-selected", {
        fileName: file.name,
        fileSize: file.size
    });

    let reader = new FileReader();

    reader.onerror = function () {
        setImportStage("file-read-failed");
        showToast("File read failed", "error");
    };

    reader.onload = function (e) {
        const result = e && e.target ? e.target.result : null;
        const buffer = result instanceof ArrayBuffer ? result : new ArrayBuffer(0);
        const byteSignature = getImportByteSignature(buffer);
        const diskHash = `${byteSignature.length}:${byteSignature.hash32}`;

        const decodeResult = chooseImportDecodedText(buffer);
        const selected = decodeResult.selected;
        const text = selected.rawText;
        const normalizedText = selected.normalizedText;
        const rawSignature = selected.rawSignature;
        const normalizedSignature = selected.normalizedSignature;
        const hashFileReaderRaw = `${rawSignature.length}:${rawSignature.hash32}`;
        const hashFileReaderNormalized = `${normalizedSignature.length}:${normalizedSignature.hash32}`;
        const nullByteCount = (text.match(/\u0000/g) || []).length;
        const hadBom = text.charCodeAt(0) === 65279;
        window.__lastImportNormalizationMeta = {
            selectedEncoding: selected.encoding,
            selectedParseableAtRead: selected.parseable,
            hadBom,
            nullByteCount,
            rawLength: rawSignature.length,
            normalizedLength: normalizedSignature.length,
            lengthDelta: rawSignature.length - normalizedSignature.length,
            rawSignature,
            normalizedSignature,
            rawSample7000: text.substring(7000, 7100),
            normalizedSample7000: normalizedText.substring(7000, 7100),
            rawCharCodes7000: getImportCharCodes(text, 7000, 7060),
            normalizedCharCodes7000: getImportCharCodes(normalizedText, 7000, 7060)
        };

        window.__lastImportPipeline = {
            file: {
                name: file.name,
                size: Number(file.size || 0),
                lastModified: Number(file.lastModified || 0)
            },
            disk: {
                length: byteSignature.length,
                hash: diskHash
            },
            fileReaderRaw: {
                length: text.length,
                sample7000: text.substring(7000, 7100),
                hash: hashFileReaderRaw,
                signature: rawSignature
            },
            fileReaderNormalized: {
                length: normalizedText.length,
                sample7000: normalizedText.substring(7000, 7100),
                hash: hashFileReaderNormalized,
                signature: normalizedSignature
            },
            changedDuringNormalization: text !== normalizedText,
            decodeAttempts: decodeResult.attempts
        };

        // Requested stage diagnostics after FileReader load.
        console.log(file.name);
        console.log(Number(file.size || 0));
        console.log(text.length);
        console.log(text.substring(7000, 7100));
        console.log("hashDisk", diskHash);
        console.log("hashFileReaderRaw", hashFileReaderRaw);
        console.log("hashFileReaderNormalized", hashFileReaderNormalized);
        window.__lastImportFileMeta = {
            fileName: file.name,
            fileSize: Number(file.size || 0)
        };

        console.info("Import file diagnostics", {
            fileName: file.name,
            fileSize: Number(file.size || 0),
            typeofContent: typeof normalizedText,
            contentLength: normalizedText.length,
            normalization: window.__lastImportNormalizationMeta
        });

        setImportStage("file-read", {
            fileName: file.name,
            fileSize: Number(file.size || 0),
            contentLength: normalizedText.length
        });

        let importText = document.getElementById("importText");
        if (importText) {
            importText.value = normalizedText;
        }
    };

    reader.readAsArrayBuffer(file);
}


function openConfirm() {
    document.getElementById("confirmModal").style.display = "flex";
}

function closeConfirm() {
    document.getElementById("confirmModal").style.display = "none";
}

function confirmReset() {
    localStorage.clear();
    location.reload();
}

function setColorByCode(hex) {
    let picker = document.getElementById("colorPicker");

    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    picker.value = hex;

    // Apply to your app
    applyCustomColor(hex);
}
function applyHex() {
    let hex = document.getElementById("hexInput").value;

    if (!hex) return;

    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    document.getElementById("colorPicker").value = hex;
    applyCustomColor(hex);
}

function updateProgressBar() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    let filteredBudgets = filterBudgetsByActivePeriod(budgets);

    let totalBudget = filteredBudgets
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let filtered = filterByActivePeriod(expenses);

    let totalSpent = filteredBudgets.reduce((sum, b) => {
        return sum + getNetSpentForBudget(b.budgetId, filtered);
    }, 0);

    totalSpent = Math.max(0, totalSpent);

    let percent = totalBudget
        ? (totalSpent / totalBudget) * 100
        : 0;

    percent = Math.min(percent, 100);

    let fill = document.getElementById("progressFill");
    let text = document.getElementById("progressText");

    if (fill) fill.style.width = percent + "%";
    if (text) text.innerText = `${percent.toFixed(1)}% used`;
}
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

function injectGlobalFooter() {
    if (document.getElementById("appSignatureFooter")) return;

    const year = new Date().getFullYear(); // ✅ dynamic year

    const footer = document.createElement("div");
    footer.id = "appSignatureFooter";
    footer.className = "app-signature";

    footer.innerHTML = `
        <div class="app-signature-title">Developed by <strong>Gopichaninme</strong></div>
        <small class="app-signature-meta">© ${year} All rights reserved</small>
    `;

    document.querySelector(".app")?.appendChild(footer);
}


// // =========================
// // 🎨 TOAST (fallback)
// // =========================
// function toast(msg) {
//     const div = document.createElement("div");
//     div.innerText = msg;
//     div.style = `
//         position:fixed;
//         bottom:20px;
//         left:50%;
//         transform:translateX(-50%);
//         background:#333;
//         color:#fff;
//         padding:10px 15px;
//         border-radius:8px;
//         z-index:9999;
//     `;
//     document.body.appendChild(div);
//     setTimeout(() => div.remove(), 3000);
// }

// // =========================
// // 🚀 INIT
// // =========================
// (function initNotificationSystem() {
//     requestNotificationPermission();
//     updateNotificationStatus();
//     updateToggleButton();

//     setInterval(checkBudgetUsage, CHECK_INTERVAL);
//     startInsights();
// })();

// function enableNotifications() {
//     requestNotificationPermission();
// }

function openExpenseFilterModal() {
    let modal = document.getElementById("expenseFilterModal");
    initializeExpenseFilterBuilder();
    if (window.SearchService && typeof window.SearchService.getState === "function" && expenseFilterBuilderInstance) {
        let state = window.SearchService.getState("expenses");
        expenseFilterBuilderInstance.setFromFilters(Array.isArray(state.filters) ? state.filters : []);
    }
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }
}

function closeExpenseFilterModal() {
    let modal = document.getElementById("expenseFilterModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

let expenseFilterBuilderInstance = null;

function getExpenseFilterTemplates() {
    return [
        { key: "date", label: "Date", field: "date", type: "date", hint: "Use Equals, Before, After, or Between" },
        { key: "category", label: "Category", field: "category", type: "text", hint: "Shopping, Food, Travel, Medical, Bills" },
        { key: "type", label: "Type", field: "type", type: "text", hint: "expense, income" },
        { key: "amount", label: "Amount", field: "amount", type: "number", hint: "5000, 10000, 25000" },
        { key: "payment", label: "Payment Type", field: "paymentType", type: "enum", hint: "UPI, Cash, Debit Card, Credit Card" },
        { key: "budget", label: "Budget", field: "budgetId", type: "text", hint: "Budget reference id" },
        { key: "savings", label: "Savings", field: "refundType", type: "text", hint: "Refund, transfer, adjustment" },
        { key: "source", label: "Source", field: "entity", type: "text", hint: "Store, vendor, provider" },
        { key: "person", label: "Person", field: "person", type: "text", hint: "Person names" },
        { key: "attachment", label: "Attachment", field: "attachmentName", type: "presence", hint: "Has any attachment" }
    ];
}

function initializeExpenseFilterBuilder() {
    let root = document.getElementById("expenseFilterBuilderRoot");
    if (!root || expenseFilterBuilderInstance || !window.FilterBuilder || typeof window.FilterBuilder.create !== "function") {
        return;
    }

    expenseFilterBuilderInstance = window.FilterBuilder.create({
        module: "expenses",
        dateField: "date",
        templates: getExpenseFilterTemplates(),
        onClose: function () {
            closeExpenseFilterModal();
        },
        onApply: function (filters) {
            applyExpenseFilterModal(filters);
        },
        onClear: function () {
            clearExpenseFilterModal(false);
        },
        onSave: function () {
            saveExpenseFilterModal();
        }
    });

    expenseFilterBuilderInstance.mount(root);
}

function buildExpenseFilterDescriptorsFromModal() {
    initializeExpenseFilterBuilder();
    if (!expenseFilterBuilderInstance) {
        return [];
    }
    return expenseFilterBuilderInstance.getDescriptors();
}

function rerenderExpenseWithQueryState() {
    // Always re-run the search against the full canonical dataset so that
    // SearchService state (filters/search/sort) is applied against all
    // records. Using `currentFilteredExpenses` here caused incremental
    // narrowing when filters changed, leading to exported PDFs or views
    // missing matching records.
    loadHistory(getExpenses());
}

function countExpenseFilterConditions(filters) {
    if (!Array.isArray(filters)) {
        return 0;
    }
    return filters.reduce((sum, filter) => {
        if (!filter || typeof filter !== "object") {
            return sum;
        }
        if (String(filter.op || "") === "group_any" && Array.isArray(filter.conditions)) {
            return sum + countExpenseFilterConditions(filter.conditions);
        }
        return sum + 1;
    }, 0);
}

function isDefaultExpenseSort(sortItem) {
    if (!sortItem || typeof sortItem !== "object") {
        return true;
    }
    let field = String(sortItem.field || "date").toLowerCase();
    let direction = String(sortItem.direction || "desc").toLowerCase();
    return field === "date" && direction === "desc";
}

function getExpenseSortChipLabel(sortItem) {
    let fieldRaw = String((sortItem && sortItem.field) || "date").toLowerCase();
    let directionRaw = String((sortItem && sortItem.direction) || "desc").toLowerCase();
    let fieldLabel = fieldRaw === "date"
        ? "Date"
        : (fieldRaw === "amount" ? "Amount" : fieldRaw.replace(/\b\w/g, c => c.toUpperCase()));
    let arrow = directionRaw === "asc" ? "↑" : "↓";
    return `Sort: ${fieldLabel} ${arrow}`;
}

function updateExpenseSortIndicator() {
    let filterBtn = document.getElementById("expenseFilterActionBtn");
    if (!filterBtn || !window.SearchService || typeof window.SearchService.getState !== "function") {
        return;
    }

    let state = window.SearchService.getState("expenses");
    let filters = Array.isArray(state.filters) ? state.filters : [];
    let count = countExpenseFilterConditions(filters);
    filterBtn.textContent = count > 0 ? `Filter (${count})` : "Filter";
}

function getExpenseFilterChipLabel(filter) {
    if (!filter || typeof filter !== "object") {
        return "Filter";
    }
    if (filter.op === "period" && filter.value && typeof filter.value === "object") {
        let type = String(filter.value.type || "custom");
        if (type === "custom") {
            return `Period: ${filter.value.from || "-"} to ${filter.value.to || "-"}`;
        }
        return `Period: ${type}`;
    }
    if (String(filter.field || "") === "date") {
        if (filter.op === "between") {
            return `Date Between ${String(filter.from || "-")} and ${String(filter.to || "-")}`;
        }
        if (filter.op === "gt") return `Date After ${String(filter.value || "-")}`;
        if (filter.op === "lt") return `Date Before ${String(filter.value || "-")}`;
        if (filter.op === "eq") return `Date Equals ${String(filter.value || "-")}`;
    }

    let fieldRaw = String(filter.field || "field");
    let valueText = String(filter.value || "");
    let fieldLabel = fieldRaw === "category"
        ? "Category"
        : (fieldRaw === "amount" ? "Amount" : fieldRaw.replace(/\b\w/g, c => c.toUpperCase()));

    if (fieldRaw === "amount") {
        if (filter.op === "gt") return `Amount > ${valueText}`;
        if (filter.op === "gte") return `Amount >= ${valueText}`;
        if (filter.op === "lt") return `Amount < ${valueText}`;
        if (filter.op === "lte") return `Amount <= ${valueText}`;
        if (filter.op === "between") return `Amount ${String(filter.from || "-")} to ${String(filter.to || "-")}`;
    }

    if (filter.op === "contains") {
        return `${fieldLabel} ${valueText}`;
    }
    if (filter.op === "eq") {
        return `${fieldLabel}: ${valueText}`;
    }

    return `${fieldLabel} ${String(filter.op || "eq")} ${valueText}`;
}

function renderExpenseQueryChips() {
    let host = document.getElementById("expenseQueryChips");
    if (!host || !window.SearchService || typeof window.SearchService.getState !== "function") {
        return;
    }

    let state = window.SearchService.getState("expenses");
    let filters = Array.isArray(state.filters) ? state.filters : [];
    let sort = Array.isArray(state.sort) ? state.sort : [];

    host.innerHTML = "";

    filters.forEach((filter, index) => {
        let chip = document.createElement("button");
        chip.className = "secondary query-chip";
        chip.type = "button";
        chip.textContent = `${getExpenseFilterChipLabel(filter)} ×`;
        chip.addEventListener("click", () => removeExpenseFilterChip(index));
        host.appendChild(chip);
    });

    if (sort.length) {
        let first = sort[0];
        if (!isDefaultExpenseSort(first)) {
            let chip = document.createElement("button");
            chip.className = "secondary query-chip";
            chip.type = "button";
            chip.textContent = `${getExpenseSortChipLabel(first)} ×`;
            chip.addEventListener("click", clearExpenseSortChip);
            host.appendChild(chip);
        }
    }
}

function removeExpenseFilterChip(index) {
    if (!window.SearchService || typeof window.SearchService.getState !== "function") {
        return;
    }
    let state = window.SearchService.getState("expenses");
    let filters = Array.isArray(state.filters) ? state.filters.slice() : [];
    filters.splice(index, 1);
    if (typeof window.SearchService.setFilters === "function") {
        window.SearchService.setFilters("expenses", filters);
    }
    rerenderExpenseWithQueryState();
}

function clearExpenseSortChip() {
    if (window.SearchService && typeof window.SearchService.clearSort === "function") {
        window.SearchService.clearSort("expenses");
    }
    rerenderExpenseWithQueryState();
}

function clearExpenseQueryChips() {
    if (window.SearchService) {
        if (typeof window.SearchService.clearFilters === "function") {
            window.SearchService.clearFilters("expenses");
        }
        if (typeof window.SearchService.clearSort === "function") {
            window.SearchService.clearSort("expenses");
        }
    }
    rerenderExpenseWithQueryState();
}

function openExpenseSortModal() {
    let modal = document.getElementById("expenseSortModal");
    if (modal) {
        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }
}

function closeExpenseSortModal() {
    let modal = document.getElementById("expenseSortModal");
    if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
    }
}

function applyExpenseSortModal() {
    let field = document.getElementById("expenseSortField")?.value || "date";
    let direction = document.getElementById("expenseSortDirection")?.value || "desc";

    let type = field === "amount" ? "number" : (field === "date" ? "date" : "string");

    if (window.SearchService && typeof window.SearchService.setSort === "function") {
        window.SearchService.setSort("expenses", [{ field: field, direction: direction, type: type }]);
    }

    closeExpenseSortModal();
    updateExpenseSortIndicator();
    rerenderExpenseWithQueryState();
    renderExpenseQueryChips();
}

function clearExpenseSortModal() {
    let fieldEl = document.getElementById("expenseSortField");
    let directionEl = document.getElementById("expenseSortDirection");
    if (fieldEl) fieldEl.value = "date";
    if (directionEl) directionEl.value = "desc";

    if (window.SearchService && typeof window.SearchService.clearSort === "function") {
        window.SearchService.clearSort("expenses");
    }

    closeExpenseSortModal();
    updateExpenseSortIndicator();
    rerenderExpenseWithQueryState();
    renderExpenseQueryChips();
}

function applyExpenseFilterModal(explicitFilters) {
    if (window.SearchService && typeof window.SearchService.setFilters === "function") {
        let filters = Array.isArray(explicitFilters) ? explicitFilters : buildExpenseFilterDescriptorsFromModal();
        window.SearchService.setFilters("expenses", filters);
    }

    closeExpenseFilterModal();
    rerenderExpenseWithQueryState();
    renderExpenseQueryChips();
}

async function saveExpenseFilterModal() {
    if (!window.SearchService || typeof window.SearchService.saveView !== "function") {
        return;
    }
    let name = await window.AppDialog.prompt("Filter name", "Expense Filter", "Save Filter");
    if (!name || !name.trim()) {
        return;
    }
    window.SearchService.saveView({ name: name.trim(), module: "expenses", scope: "module" });
}

function clearExpenseFilterModal(closeAfterClear = true) {
    initializeExpenseFilterBuilder();
    if (expenseFilterBuilderInstance) {
        expenseFilterBuilderInstance.clearAll();
    }

    if (window.SearchService && typeof window.SearchService.clearFilters === "function") {
        window.SearchService.clearFilters("expenses");
    }

    if (closeAfterClear) {
        closeExpenseFilterModal();
    }
    rerenderExpenseWithQueryState();
    renderExpenseQueryChips();
}

function handleFilter(type) {

    if (!document.getElementById("filterType")) {
        loadHistory(getExpenses());
        return;
    }

    if (type === "period") {

        openPeriod();

        return;
    }

    let expenses =
        getExpenses();

    let filtered =
        filterDataByType(
            type,
            expenses
        );

    loadHistory(filtered);

    if (typeof loadGraph === "function") {

        loadGraph(type, filtered);
    }

    if (
        typeof renderCategoryBreakdown ===
        "function"
    ) {

        renderCategoryBreakdown(
            groupByCategory(filtered)
        );
    }
}
function formatDateLabel(dateStr) {
    let d = new Date(dateStr);

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short"
    });
}

function updateCustomPeriodLabel(from, to) {
    const select = document.getElementById("filterType");
    if (!select) {
        return;
    }
    const option = select.querySelector('option[value="period"]');
    if (!option) {
        return;
    }

    if (from && to) {
        option.textContent = `Custom Period (${formatDateLabel(from)} → ${formatDateLabel(to)})`;
    } else if (from) {
        option.textContent = `Custom Period (${formatDateLabel(from)})`;
    } else {
        option.textContent = "Custom Period";
    }

    select.value = "period"; // keep selected
}

// function exportDataAsExcel() {

//     let data = {
//         expenses: getExpenses() || [],
//         budgets: getBudgets() || [],
//         savings: getSavings() || [],
//         orders: JSON.parse(localStorage.getItem("orders")) || []
//     };

//     // =========================
//     // 🧠 HELPER: Normalize Order ID
//     // =========================
//     function normalizeOrderId(id) {
//         let str = String(id || "");
//         return str.startsWith("order_") ? str : "order_" + str;
//     }

//     // =========================
//     // 📦 CREATE WORKBOOK
//     // =========================
//     let wb = XLSX.utils.book_new();

//     // =========================
//     // 📄 SHEET 1: EXPENSES
//     // =========================
//     let expSheet = XLSX.utils.json_to_sheet(
//         data.expenses.map(e => ({
//             ...e,
//             sourceId: e.sourceId ? String(e.sourceId) : ""
//         }))
//     );
//     XLSX.utils.book_append_sheet(wb, expSheet, "Expenses");

//     // =========================
//     // 📄 SHEET 2: BUDGETS
//     // =========================
//     let budSheet = XLSX.utils.json_to_sheet(
//         data.budgets.map(b => ({
//             ...b,
//             id: b.id ? String(b.id) : ""
//         }))
//     );
//     XLSX.utils.book_append_sheet(wb, budSheet, "Budgets");

//     // =========================
//     // 📄 SHEET 3: SAVINGS
//     // =========================
//     let savSheet = XLSX.utils.json_to_sheet(
//         data.savings.map(s => ({
//             ...s,
//             id: s.id ? String(s.id) : "",
//             sourceId: s.sourceId ? String(s.sourceId) : ""
//         }))
//     );
//     XLSX.utils.book_append_sheet(wb, savSheet, "Savings");

//     // =========================
//     // 📄 SHEET 4: ORDERS
//     // =========================
//     let ordersSheetData = data.orders.map(o => ({
//         orderId: normalizeOrderId(o.id),

//         subtotal: Number(o.subtotal) || 0,
//         gst: Number(o.gst) || 0,
//         total: Number(o.total) || 0,

//         sourceName: o.sourceName || "",
//         sourceType: o.sourceType || "",
//         paymentType: o.paymentType || "",

//         date: o.date || ""
//     }));

//     let ordersSheet = XLSX.utils.json_to_sheet(ordersSheetData);
//     XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");

//     // =========================
//     // 📄 SHEET 5: ORDER ITEMS
//     // =========================
//     let orderItems = [];

//     data.orders.forEach(o => {
//         let orderId = normalizeOrderId(o.id);

//         (o.items || []).forEach(i => {
//             orderItems.push({
//                 orderId: orderId,

//                 itemName: i.name || "",
//                 qty: Number(i.qty) || 0,
//                 price: Number(i.price) || 0,
//                 itemTotal: Number(i.total) || 0
//             });
//         });
//     });

//     let itemsSheet = XLSX.utils.json_to_sheet(orderItems);
//     XLSX.utils.book_append_sheet(wb, itemsSheet, "Order Items");

//     // =========================
//     // 💾 DOWNLOAD FILE
//     // =========================
//     XLSX.writeFile(
//         wb,
//         `money-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`
//     );
// }

function exportDataAsExcel() {

    if (!window.XLSX || !XLSX.utils || !XLSX.writeFile) {
        showToast("Excel export unavailable offline: XLSX library not loaded", "warning");
        exportDataAsJSON();
        return;
    }

    let data = {
        expenses: getExpenses() || [],
        budgets: getBudgets() || [],
        savings: getSavings() || [],
        orders: JSON.parse(localStorage.getItem("orders")) || [],

        categories: JSON.parse(localStorage.getItem("categories")) || [],
        persons: JSON.parse(localStorage.getItem("persons")) || [],
        budgetPeriods: JSON.parse(localStorage.getItem("bp")) || []
    };

    function normalizeOrderId(id) {
        let str = String(id || "");
        return str.startsWith("order_") ? str : "order_" + str;
    }

    let wb = XLSX.utils.book_new();

    // =========================
    // 📄 EXPENSES
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.expenses),
        "Expenses"
    );

    // =========================
    // 📄 BUDGETS
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.budgets),
        "Budgets"
    );

    // =========================
    // 📄 SAVINGS
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.savings),
        "Savings"
    );

    // =========================
    // 📄 ORDERS
    // =========================
    let ordersSheet = XLSX.utils.json_to_sheet(
        data.orders.map(o => ({
            orderId: normalizeOrderId(o.id),
            subtotal: Number(o.subtotal) || 0,
            gst: Number(o.gst) || 0,
            total: Number(o.total) || 0,
            sourceName: o.sourceName || "",
            sourceType: o.sourceType || "",
            paymentType: o.paymentType || "",
            date: o.date || ""
        }))
    );

    XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");

    // =========================
    // 📄 ORDER ITEMS
    // =========================
    let orderItems = [];

    data.orders.forEach(o => {
        let orderId = normalizeOrderId(o.id);

        (o.items || []).forEach(i => {
            orderItems.push({
                orderId,
                itemName: i.name || "",
                qty: Number(i.qty) || 0,
                price: Number(i.price) || 0,
                itemTotal: Number(i.total) || (i.qty * i.price) || 0
            });
        });
    });

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(orderItems),
        "Order Items"
    );

    // =========================
    // 📄 EXTRA TABLES
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.categories),
        "Categories"
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.persons),
        "Persons"
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.budgetPeriods),
        "Budget Periods"
    );

    // =========================
    // 💾 DOWNLOAD
    // =========================
    XLSX.writeFile(
        wb,
        `money-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
}

function openBackupOptions() {
    document.getElementById("backupModal").style.display = "flex";
}

function closeBackupModal() {
    document.getElementById("backupModal").style.display = "none";
}

function toggleCategory() {
    openCategoryModal(); // your existing function

    let arrow = document.getElementById("catArrow");

    arrow.textContent = arrow.textContent === ">" ? "⌄" : ">";
}

function formatCurrencyPDF(amount) {
    let code = getCurrencyCode();
    let converted = convertFromBase(amount);

    return `${code}. ${converted.toFixed(2)}`;
}


/* =========================
   🧧 BUDGET PERIOD ENGINE
========================= */

// 🔹 Get active budget period
function getActiveBudgetPeriod() {
    let periods = JSON.parse(localStorage.getItem("bp")) || [];

    let normalized = normalizeBudgetPeriods(periods);

    if (normalized.changed) {
        localStorage.setItem("bp", JSON.stringify(normalized.periods));
    }

    return selectActiveBudgetPeriod(normalized.periods, new Date());
}

function selectActiveBudgetPeriod(periods, referenceDate = new Date()) {
    let safe = Array.isArray(periods) ? periods : [];

    let ref = new Date(referenceDate);
    ref.setHours(0, 0, 0, 0);

    let active = safe
        .filter(p => p && p.status === "active" && p.start)
        .map(p => {
            let start = new Date(p.start);
            let end = getBudgetPeriodEffectiveEndDate(p, ref);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            return { p, start, end };
        })
        .filter(x => Number.isFinite(x.start.getTime()) && Number.isFinite(x.end.getTime()));

    if (!active.length) return null;

    let live = active.filter(x => ref >= x.start && ref <= x.end);
    let pool = live.length ? live : active;

    pool.sort((a, b) => {
        let s = b.start.getTime() - a.start.getTime();
        if (s !== 0) return s;

        let ua = new Date((a.p && a.p.updatedAt) || (a.p && a.p.createdAt) || 0).getTime();
        let ub = new Date((b.p && b.p.updatedAt) || (b.p && b.p.createdAt) || 0).getTime();
        if (ub !== ua) return ub - ua;

        return String((b.p && b.p.id) || "").localeCompare(String((a.p && a.p.id) || ""));
    });

    return pool[0].p || null;
}

function formatPeriodDateKey(date) {

    let d = new Date(date);

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}

function getBudgetPeriodEffectiveEndDate(period, referenceDate = new Date()) {

    let baseEnd = period && period.end
        ? new Date(period.end)
        : new Date(referenceDate);

    baseEnd.setHours(0, 0, 0, 0);

    let extraDays = Number(period && period.extraDays ? period.extraDays : 0);
    if (!Number.isFinite(extraDays)) extraDays = 0;
    extraDays = Math.max(0, Math.floor(extraDays));

    baseEnd.setDate(baseEnd.getDate() + extraDays);
    return baseEnd;
}

function normalizeBudgetPeriods(periods, referenceDate = new Date()) {

    let today = new Date(referenceDate);
    today.setHours(0, 0, 0, 0);

    let changed = false;
    let safe = Array.isArray(periods) ? periods : [];

    let normalized = safe.map(item => {

        let p = item && typeof item === "object"
            ? { ...item }
            : item;

        if (!p || typeof p !== "object") return p;

        if (p.status === "active") {
            let effectiveEnd = getBudgetPeriodEffectiveEndDate(p, today);

            if (effectiveEnd < today) {
                p.status = "closed";
                p.end = formatPeriodDateKey(effectiveEnd);
                changed = true;
            }
        }

        return p;
    });

    return {
        periods: normalized,
        changed
    };
}

function buildBudgetPeriodKey(startDate, endDate) {
    if (!startDate || !endDate) return null;
    return `${formatPeriodDateKey(startDate)}_to_${formatPeriodDateKey(endDate)}`;
}

function refreshFinancialViewsAfterPeriodUpdate() {
    if (typeof loadDashboard === "function") loadDashboard();
    if (typeof loadBudgetScreen === "function") loadBudgetScreen();
    if (typeof renderBudgetEntries === "function") renderBudgetEntries();
    if (typeof loadSavings === "function") loadSavings();
    if (typeof loadHistory === "function") loadHistory();
    if (typeof loadGraph === "function") loadGraph();
}

function rebindPeriodReferencesAcrossData(oldPeriodKey, newPeriodKey, startKey) {
    let rebound = {
        budgets: 0,
        expenses: 0,
        savings: 0
    };

    if (!newPeriodKey) return rebound;

    let keyMatcher = key => {
        let current = String(key || "");
        if (!current) return false;
        if (oldPeriodKey && current === oldPeriodKey) return true;
        if (startKey && current.startsWith(`${startKey}_to_`)) return true;
        return false;
    };

    let budgets = getBudgets();
    let expenses = getExpenses();
    budgets.forEach(row => {
        if (!row || typeof row !== "object") return;
        if (!keyMatcher(row.periodKey)) return;
        if (row.periodKey === newPeriodKey) return;
        row.periodKey = newPeriodKey;
        row.updatedAt = new Date().toISOString();
        rebound.budgets += 1;
    });

    expenses.forEach(row => {
        if (!row || typeof row !== "object") return;
        if (!keyMatcher(row.periodKey)) return;
        if (row.periodKey === newPeriodKey) return;
        row.periodKey = newPeriodKey;
        row.updatedAt = new Date().toISOString();
        rebound.expenses += 1;
    });

    saveBudgets(budgets);
    saveExpenses(expenses);

    return rebound;
}

function reactivateBudgetPeriodLifecycle(periodId, referenceDate = new Date()) {
    let periods = JSON.parse(localStorage.getItem("bp")) || [];
    let index = periods.findIndex(p => String(p && p.id) === String(periodId));

    if (index < 0) {
        return {
            ok: false,
            error: "Budget period not found"
        };
    }

    let base = periods[index] && typeof periods[index] === "object"
        ? { ...periods[index] }
        : null;

    if (!base || !base.start) {
        return {
            ok: false,
            error: "Invalid budget period"
        };
    }

    let now = new Date(referenceDate);
    now.setHours(0, 0, 0, 0);

    let oldEffectiveEnd = getBudgetPeriodEffectiveEndDate(base, now);
    let oldKey = buildBudgetPeriodKey(base.start, oldEffectiveEnd);

    let endDate = base.end ? new Date(base.end) : null;
    if (endDate) endDate.setHours(0, 0, 0, 0);

    let next = { ...base };
    next.status = "active";

    // Reactivation extends an expired period to "today" so keying remains stable.
    if (!endDate || endDate < now) {
        next.end = formatPeriodDateKey(now);
    }

    let nowIso = new Date().toISOString();
    next.updatedAt = nowIso;
    next.reactivatedAt = nowIso;

    periods = periods.map((p, i) => {
        if (!p || typeof p !== "object") return p;

        if (i === index) return next;

        if (p.status === "active") {
            let closed = { ...p, status: "closed", updatedAt: nowIso };
            if (!closed.end) closed.end = formatPeriodDateKey(now);
            return closed;
        }

        return p;
    });

    localStorage.setItem("bp", JSON.stringify(periods));

    let newEffectiveEnd = getBudgetPeriodEffectiveEndDate(next, now);
    let newKey = buildBudgetPeriodKey(next.start, newEffectiveEnd);
    let startKey = formatPeriodDateKey(next.start);

    let rebound = rebindPeriodReferencesAcrossData(oldKey, newKey, startKey);

    // For historical/simulated reactivation calls (tests/backfills), avoid
    // immediate UI refresh because downstream reads normalize periods using
    // real current date, which can flip the just-reactivated period back.
    let runtimeToday = new Date();
    runtimeToday.setHours(0, 0, 0, 0);
    let shouldRefreshLiveViews = now.getTime() === runtimeToday.getTime();

    if (shouldRefreshLiveViews) {
        refreshFinancialViewsAfterPeriodUpdate();
    }

    return {
        ok: true,
        periodId: next.id,
        oldPeriodKey: oldKey,
        newPeriodKey: newKey,
        rebound
    };
}

// 🔹 Get active period key (GLOBAL SAFE)
function getActivePeriodKey() {

    let p =
        getActiveBudgetPeriod();

    if (!p) return null;

    let start =
        formatPeriodDateKey(p.start);

    let end =
        formatPeriodDateKey(getBudgetPeriodEffectiveEndDate(p, new Date()));

    return `${start}_to_${end}`;
}

function isWithinBudgetPeriod(dateStr) {

    let period = getActiveBudgetPeriod();

    if (!period) return false;

    let d = new Date(dateStr);

    let start = new Date(period.start);

    let end = getBudgetPeriodEffectiveEndDate(period, new Date());

    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return d >= start && d <= end;
}

function filterByActivePeriod(expenses) {

    let period =
        getActiveBudgetPeriod();

    // =========================
    // 📅 ACTIVE PERIOD
    // =========================
    if (period) {

        return expenses.filter(
            e => isWithinBudgetPeriod(e.date)
        );
    }

    // =========================
    // 📅 FALLBACK MONTH
    // =========================
    let now = new Date();

    return expenses.filter(e => {

        let d = new Date(e.date);

        return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
        );
    });
}
function filterBudgetsByActivePeriod(budgets) {
    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    if (periodKey) {
        // Prefer period-based budgets
        return budgets.filter(b => b.periodKey === periodKey);
    }

    // Fallback → month
    let now = new Date();

    let currentMonth = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0")].join("-");
    return budgets.filter(b => b.monthKey === currentMonth);
}
function generateHeadline() {

    let budgets = getBudgets();
    let expenses = getExpenses();
    let period = getActiveBudgetPeriod();

    let messages = [];
    // ⚠️ Section 11: surface pending Unassigned Top-Ups persistently in
    // the headline rotation instead of a one-time toast — parked/
    // unresolved amounts can outlive their original period.
    if (typeof getPendingUnassignedTopups === "function" && typeof getRemainingUnassignedAmount === "function") {
        let pending = getPendingUnassignedTopups();
        if (pending.length) {
            let total = pending.reduce((sum, t) => sum + getRemainingUnassignedAmount(t), 0);
            messages.push(`${pending.length} unassigned top-up(s) totaling ${formatCurrency(total)} — resolve in Budget → Apply Source.`);
        }
    }
    // =========================
    // 🚨 NO ACTIVE PERIOD
    // =========================
    if (!period) {
        messages.push("No active budget period. Please create or activate one.");
        messages.push("Budget tracking is currently running on fallback mode.");
        return messages.join("   •   ");
    }

    // =========================
    // 📦 NO BUDGET CREATED
    // =========================
    let activeBudgets = filterBudgetsByActivePeriod(budgets);

    if (!activeBudgets.length) {
        messages.push("No budget allocated for current period.");
        messages.push("Add a budget using 'Move to Budget' to start tracking.");
        return messages.join("   •   ");
    }

    // =========================
    // 📊 CALCULATE STATUS
    // =========================
    let filteredExpenses = filterByActivePeriod(expenses);

    let totalBudget = activeBudgets
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let spent = filteredExpenses
        .filter(e => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let remaining = totalBudget - spent;

    let percent = totalBudget ? (spent / totalBudget) * 100 : 0;

    // =========================
    // 🚨 ALERT STATES
    // =========================
    if (remaining < 0) {
        messages.push("Overspending detected. Review your recent expenses.");
    }
    else if (percent > 80) {
        messages.push("Budget usage exceeded 80 percent. Monitor spending closely.");
    }
    else if (percent > 50) {
        messages.push("You have used more than half of your budget.");
    }
    else {
        messages.push("Spending is within safe range.");
    }

    // =========================
    // 🧠 SMART GUIDANCE
    // =========================
    messages.push("Keep tracking regularly to maintain control.");
    messages.push("Review expenses before making new allocations.");

    return messages.join("   •   ");
}

function startHeadline() {
    let el = document.getElementById("headlineText");
    if (!el) return;

    function update() {
        let text = generateHeadline();
        el.innerText = text;
    }

    update();

    // smooth refresh (avoid flicker)
    setInterval(update, 20000);
}

function prepareSplit(amount, budgets) {

    let remaining = amount;
    let result = [];

    for (let b of budgets) {

        if (remaining <= 0) break;

        let expenses = getExpenses();
        // Calculate net spent for this budget (handles allocationTrail & recoveries)
        let spent = getNetSpentForBudget(b.budgetId, expenses);

        let available = (b.totalAllocated || 0) - spent; // or remaining field
        if (available <= 0) continue;
        let use = Math.min(available, remaining);

        if (use > 0) {
            result.push({
                budget: b,
                amount: use
            });
            remaining -= use;
        }
    }

    return remaining > 0 ? null : result;
}

function handleExpenseSave(amount, selectedBudgetId = null, attachmentMeta = null) {

    // =========================
    // ✅ VALIDATE
    // =========================
    if (!amount || amount <= 0) {

        showToast("Invalid amount");
        return;
    }

    // =========================
    // ✅ FORM VALUES
    // =========================
    let category =
        document.getElementById("category")?.value || "Others";

    let purpose =
        document.getElementById("purpose")?.value || "";

    let paymentType =
        document.getElementById("paymentType")?.value || "Cash";

    // let date =
    //     document.getElementById("expenseDate")?.value ||
    //     new Date().toISOString();
    let rawDate =
        document.getElementById("expenseDate")?.value;

    let dateObj;

    if (!rawDate) {

        // no date selected
        dateObj = new Date();

    } else {

        let selected = new Date(rawDate);
        let today = new Date();

        // TODAY
        if (
            selected.toDateString() ===
            today.toDateString()
        ) {

            dateObj = new Date();

        } else {

            // PAST DATE = END OF DAY
            selected.setHours(23, 59, 59, 999);

            dateObj = selected;
        }
    }

    let date = dateObj.toISOString();

    let selectedId = String(selectedBudgetId || document.getElementById("budgetSelect")?.value || "").trim();

    if (!selectedId) {
        showToast("Select budget");
        return;
    }

    let budgets = getSelectableBudgetEntries(getBudgets());
    if (!budgets.length) {

        showToast("No budgets available");
        return;
    }

    let selectedBudget = budgets.find(b => String(b && b.budgetId || "") === selectedId);
    if (!selectedBudget) {
        showToast("Selected budget not found");
        return;
    }

    // =========================
    // ✅ GET EXPENSES
    // =========================
    let expenses = getExpenses();

    let spent = getNetSpentForBudget(selectedBudget.budgetId, expenses);
    let available = (selectedBudget.totalAllocated || 0) - spent;

    if (available < amount) {
        showToast(`Selected budget has only ${formatCurrency(Math.max(0, available))} available`);
        return;
    }

    addExpense({
        amount: -Math.abs(amount),
        budgetId: selectedBudget.budgetId,
        allocationTrail: [{ budgetId: selectedBudget.budgetId, amount: Math.abs(amount) }],
        category,
        purpose,
        paymentType,
        date,
        attachmentId: attachmentMeta && attachmentMeta.attachmentId ? attachmentMeta.attachmentId : null,
        attachmentStatus: attachmentMeta ? attachmentMeta.status : "none",
        attachmentError: attachmentMeta ? attachmentMeta.error : null,
        type: "expense"
    });

    loadDashboard();
    loadHistory();
    loadGraph();
    renderBudgetEntries();
    loadBudgetOptions();

    showToast("Expense added");

    clearExpenseAttachmentState();
    resetForm();
}

let pendingSplit = null;

function openSplitModal(split) {

    pendingSplit = split;

    const container = document.getElementById("splitDetails");
    if (container) {
        container.innerHTML = `
            <p>This expense will be allocated as:</p>
            <ul>
                ${split.map(s => `
                    <li>₹${s.amount} from ${s.budget.entity || "Budget"}</li>
                `).join("")}
            </ul>
        `;
    }

    const modal = document.getElementById("splitModal");
    if (modal) modal.style.display = "flex";
}

function confirmSplit() {

    if (!pendingSplit) return;

    let category =
        document.getElementById("category")?.value || "Others";

    let purpose =
        document.getElementById("purpose")?.value || "";

    let paymentType =
        document.getElementById("paymentType")?.value || "Cash";

    // let date =
    //     document.getElementById("expenseDate")?.value ||
    //     new Date().toISOString();
    let rawDate =
        document.getElementById("expenseDate")?.value;

    let date =
        buildSmartExpenseDate(rawDate);

    let splitId = "split_" + Date.now();

    pendingSplit.forEach((s, index) => {

        addExpense({
            amount: -Math.abs(s.amount),

            budgetId: s.budget.budgetId,

            splitId: splitId,
            splitIndex: index + 1,
            isSplit: true,

            category,
            purpose,
            paymentType,
            date,
            type: "expense",
            attachmentId: attachmentId || null
        });
    });

    closeSplitModal();

    loadDashboard();
    renderBudgetEntries();
    loadBudgetOptions();
    loadHistory();
    loadGraph();

    showToast("Split expense added");

    clearExpenseAttachmentState();
    resetForm();
}

function closeSplitModal() {
    document.getElementById("splitModal").style.display = "none";
    pendingSplit = null;
}

function normalizeDate(date) {

    let d = new Date(date);

    d.setHours(0, 0, 0, 0);

    return d.getTime();
}

function buildSmartExpenseDate(rawDate) {

    if (!rawDate) {
        return new Date().toISOString();
    }

    let selected = new Date(rawDate);

    let today = new Date();

    // normalize compare
    let s = new Date(selected);
    let t = new Date(today);

    s.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);

    // TODAY
    if (s.getTime() === t.getTime()) {

        return new Date().toISOString();
    }

    // FUTURE
    if (s.getTime() > t.getTime()) {

        selected.setHours(0, 0, 0, 0);

        return selected.toISOString();
    }

    // PAST
    selected.setHours(23, 59, 59, 999);

    return selected.toISOString();
}

function getRemainingAmount(id) {
    let expensesAll = getExpenses();

    // 🔥 ORIGINAL ENTRY (lookup from full storage so parent rows remain findable)
    let original = expensesAll.find(e => String(e.id) === String(id));
    if (!original) return 0;

    // original total value (use allocationTrail if present)
    let originalTotal = 0;
    if (Array.isArray(original.allocationTrail) && original.allocationTrail.length) {
        originalTotal = original.allocationTrail.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    } else {
        originalTotal = Math.abs(Number(original.amount) || 0);
    }

    // 🔥 TOTAL RECOVERED (exclude parent split containers from recovery sums)
    let expenses = expensesAll.filter(e => !isParentSplitContainer(e));

    let recovered = expenses
        .filter(e => String(e.linkedTransactionId) === String(id) && (e.type === "recovery" || e.type === "refund" || e.type === "transfer_back"))
        .reduce((sum, e) => {
            if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
                return sum + e.allocationTrail.reduce((ss, a) => ss + (Number(a.amount) || 0), 0);
            }
            return sum + Math.abs(Number(e.amount) || 0);
        }, 0);

    let remaining = originalTotal - recovered;
    return Math.max(0, remaining);
}
// Budget Expense Module END script.js

// Detect parent split container entries.
// Conservative implementation: only treats explicit markers as parent containers.
function isParentSplitContainer(entry) {
    if (!entry) return false;
    // explicit flags preserved from legacy code
    if (entry.isParent === true) return true;
    if (entry.isSplitContainer === true) return true;
    if (entry.type === 'split_parent') return true;
    return false;
}




// function exportDataAsJSON() {

//     let data = {
//         expenses: getExpenses() || [],
//         budgets: getBudgets() || [],
//         savings: getSavings() || [],
//         orders: JSON.parse(localStorage.getItem("orders")) || [],

//         // 🔥 NEW (IMPORTANT)
//         categories: JSON.parse(localStorage.getItem("categories")) || [],
//         persons: JSON.parse(localStorage.getItem("persons")) || [],
//         budgetPeriods: JSON.parse(localStorage.getItem("bp")) || [],

//         settings: {
//             theme: localStorage.getItem("theme") || "",
//             currencyCode: localStorage.getItem("currencyCode") || "INR"
//         },

//         meta: {
//             exportedAt: new Date().toISOString(),
//             version: "v2"
//         }
//     };

//     try {
//         let json = JSON.stringify(data, null, 2);

//         let blob = new Blob([json], { type: "application/json" });
//         let url = URL.createObjectURL(blob);

//         let a = document.createElement("a");
//         a.href = url;
//         a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

//         document.body.appendChild(a);
//         a.click();

//         // fallback first
//         setTimeout(() => {
//             window.open(url, "_blank");
//         }, 500);

//         // cleanup later
//         setTimeout(() => {

//             document.body.removeChild(a);

//             URL.revokeObjectURL(url);

//         }, 3000);

//     } catch (err) {
//         let json = JSON.stringify(data, null, 2);
//         prompt("Copy your backup manually:", json);
//     }
// }

// // =========================
// // 🔄 AUTO BACKUP ENGINE
// // =========================

// function startAutoBackup() {

//     scheduleDailyBackup();
//     scheduleWeeklyBackup();
//     scheduleMonthlyBackup();
// }

// // =========================
// // DAILY
// // =========================

// function scheduleDailyBackup() {

//     const DAY_MS =
//         24 * 60 * 60 * 1000;

//     setInterval(() => {

//         createAutoBackup("daily");

//     }, DAY_MS);
// }

// // =========================
// // WEEKLY
// // =========================

// function scheduleWeeklyBackup() {

//     const WEEK_MS =
//         7 * 24 * 60 * 60 * 1000;

//     setInterval(() => {

//         createAutoBackup("weekly");

//     }, WEEK_MS);
// }

// // =========================
// // MONTHLY
// // =========================

// function scheduleMonthlyBackup() {

//     const MONTH_MS =
//         30 * 24 * 60 * 60 * 1000;

//     setInterval(() => {

//         createAutoBackup("monthly");

//     }, MONTH_MS);
// }

// // =========================
// // CREATE BACKUP
// // =========================

// function createAutoBackup(type) {

//     try {

//         const backupData = {

//             createdAt:
//                 new Date().toISOString(),

//             type,

//             data: getFullAppData()
//         };

//         localStorage.setItem(

//             `autoBackup_${type}`,

//             JSON.stringify(backupData)
//         );

//         console.log(
//             `✅ ${type} backup completed`
//         );

//     } catch (err) {

//         console.error(
//             `❌ ${type} backup failed`,
//             err
//         );
//     }
// }

// =========================
// 📦 GET FULL APP DATA
// =========================

function getFullAppData() {

    let autoBackup = getAutoBackupSettings();

    let settingsSnapshot = {
        theme: localStorage.getItem("theme") || "",
        appearanceMode: localStorage.getItem("appearanceMode") || "metallic",
        accentColor: localStorage.getItem("accentColor") || localStorage.getItem("theme") || DEFAULT_ACCENT,
        currencyCode: localStorage.getItem("currencyCode") || "INR",
        autoBackup: !!autoBackup.enabled,
        backupFrequency: autoBackup.frequency || "weekly",
        autoBackupEnabled: !!autoBackup.enabled,
        autoBackupFrequency: autoBackup.frequency || "weekly",
        autoBackupTarget: autoBackup.target || "local_download"
    };

    const exportPayload = {

        expenses:
            getExpenses() || [],

        budgets:
            getBudgets() || [],

        savings:
            getSavings() || [],

        orders:
            JSON.parse(
                localStorage.getItem("orders")
            ) || [],

        categories:
            JSON.parse(
                localStorage.getItem("categories")
            ) || [],

        persons:
            JSON.parse(
                localStorage.getItem("persons")
            ) || [],

        budgetPeriods:
            JSON.parse(
                localStorage.getItem("bp")
            ) || [],

        unassignedTopups:
            JSON.parse(
                localStorage.getItem("unassignedTopups")
            ) || [],

        quotations: {
            quotationData: JSON.parse(localStorage.getItem("quotationData") || "null"),
            quotationItems: JSON.parse(localStorage.getItem("quotationItems") || "[]"),
            quotationCharges: JSON.parse(localStorage.getItem("quotationCharges") || "[]"),
            quotationRegistry: JSON.parse(localStorage.getItem("quotationRegistry") || "[]"),
            quotationMeta: JSON.parse(localStorage.getItem("quotationMeta") || "null"),
            activeQuotationId: JSON.parse(localStorage.getItem("activeQuotationId") || "null"),
            documentRelations: JSON.parse(localStorage.getItem("documentRelations") || "[]"),
            noSeriesConfig: JSON.parse(localStorage.getItem("noSeriesConfig") || "null")
        },

        settings: {
            ...settingsSnapshot
        },

        meta: {

            exportedAt:
                new Date().toISOString(),

            version:
                SCHEMA_VERSION_DEVELOPMENT
        }
    };

    return migrateDataVersion(exportPayload, { direction: "toDevelopment" }).data;
}

if (typeof window !== "undefined") {
    window.getFullAppData = getFullAppData;
    window.getRuntimeDiagnostics = getRuntimeDiagnostics;
}

// =========================
// 📅 SAFE FILE DATE
// =========================

function getSafeDate(dateInput = new Date()) {

    let d = new Date(dateInput);

    let y = d.getFullYear();
    let m = String(d.getMonth() + 1).padStart(2, "0");
    let day = String(d.getDate()).padStart(2, "0");
    let hh = String(d.getHours()).padStart(2, "0");
    let mm = String(d.getMinutes()).padStart(2, "0");

    return `${y}-${m}-${day}_${hh}-${mm}`;
}

async function downloadBlobWithBestEffort(blob, filename) {
    let runtime = getRuntimeDiagnostics();
    let safeFilename = String(filename || "MoneyTracker_Backup.json").replace(/[\\/:*?"<>|]+/g, "_");

    if (!safeFilename.endsWith(".json")) {
        safeFilename = `${safeFilename}.json`;
    }

    if (typeof window.showSaveFilePicker === "function") {
        try {
            let handle = await window.showSaveFilePicker({
                id: "moneytracker-backups",
                startIn: "downloads",
                suggestedName: safeFilename,
                types: [{
                    description: "JSON backup",
                    accept: { "application/json": [".json"] }
                }]
            });
            let writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            updateAutoBackupRuntimeState("Backup export used file picker with pre-filled filename.");
            return {
                method: "file-picker",
                locationHint: "Location selected in save dialog"
            };
        } catch (_err) {
            // continue to next fallback
        }
    }

    if (runtime.isAndroid && runtime.webShareFiles && typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof File !== "undefined") {
        try {
            const exportFile = new File([blob], safeFilename, { type: "application/json" });
            await navigator.share({
                title: "MoneyTracker Backup",
                text: "MoneyTracker backup export",
                files: [exportFile]
            });
            updateAutoBackupRuntimeState("Backup export used Android share sheet with generated filename.");
            return {
                method: "web-share-file",
                locationHint: "Selected in Android share destination"
            };
        } catch (_err) {
            // continue to download attribute fallback
        }
    }

    let url = URL.createObjectURL(blob);
    let a = document.createElement("a");
    a.href = url;
    a.download = safeFilename;
    a.setAttribute("download", safeFilename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    const revokeDelayMs = (runtime.isAndroid && runtime.isWebView) ? 120000 : 4000;
    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, revokeDelayMs);

    if (runtime.isAndroid && runtime.isWebView && !runtime.showSaveFilePicker && !runtime.webShareFiles) {
        updateAutoBackupRuntimeState("Android WebIntoApp runtime may ignore suggested filename in save dialog. This is a runtime limitation.");
    } else {
        updateAutoBackupRuntimeState("Backup export used browser download with generated filename.");
    }

    let locationHint = runtime.isAndroid
        ? "Browser Download Requested. Use Browser Downloads, Download History, or Recent Downloads."
        : "Downloads folder";

    return {
        method: "download-attribute",
        locationHint
    };
}

function formatBackupSize(bytes) {
    let raw = Number(bytes || 0);
    if (!Number.isFinite(raw) || raw <= 0) return "0 KB";

    if (raw < 1024) return `${raw} B`;
    if (raw < (1024 * 1024)) return `${(raw / 1024).toFixed(1)} KB`;
    return `${(raw / (1024 * 1024)).toFixed(2)} MB`;
}

function getBackupLocationGuidance(runtime, filename, method) {
    let safeName = String(filename || "MoneyTracker_Backup.json");

    if (method === "file-picker") {
        return [
            "Backup Created Successfully",
            `File: ${safeName}`,
            "Location: Selected in save dialog"
        ].join("\n");
    }

    if (method === "web-share-file") {
        return [
            "Backup Created Successfully",
            `File: ${safeName}`,
            "Location: Chosen in Android share destination"
        ].join("\n");
    }

    if (runtime && runtime.isAndroid) {
        let browserLabel = runtime.isWebView
            ? "Android WebView/WebIntoApp"
            : (runtime.isBrave ? "Android Brave" : (runtime.isChrome ? "Android Chrome" : "Android Browser"));
        return [
            "Backup Created",
            `Filename: ${safeName}`,
            "Browser Download Requested.",
            `Runtime: ${browserLabel}`,
            "Use:",
            "Browser Downloads",
            "Download History",
            "Recent Downloads"
        ].join("\n");
    }

    return [
        "Backup Created Successfully",
        `File: ${safeName}`,
        "Location: Downloads folder"
    ].join("\n");
}

// =========================
// 📤 MANUAL EXPORT
// =========================

async function exportDataAsJSON() {

    try {

        const data =
            getFullAppData();

        const json =
            JSON.stringify(
                data,
                null,
                2
            );

        // Assert export payload is valid JSON before invoking runtime save flows.
        JSON.parse(json);
        window.__lastBackupExportIntegrity = {
            isValidJson: true,
            length: json.length,
            tail: json.slice(Math.max(0, json.length - 160))
        };

        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json;charset=utf-8"
                }
            );

        let safe = getSafeDate();
        let filename = safe ? `MoneyTracker_${safe}.json` : "MoneyTracker_Backup.json";
        let exportResult = await downloadBlobWithBestEffort(blob, filename);
        let locationHint = exportResult && exportResult.locationHint
            ? exportResult.locationHint
            : "Download Triggered. Please check Downloads folder.";
        let sizeBytes = Number(blob.size || 0);
        let sizeLabel = formatBackupSize(sizeBytes);
        let runtime = getRuntimeDiagnostics();
        let guidance = getBackupLocationGuidance(runtime, filename, exportResult && exportResult.method);

        window.__lastBackupExportStatus = {
            filename,
            method: exportResult && exportResult.method ? exportResult.method : "download-attribute",
            locationHint,
            sizeBytes,
            sizeLabel,
            runtime,
            guidance,
            generatedAt: new Date().toISOString()
        };
        showToast(`Backup Created Successfully | File: ${filename} | Location: ${locationHint}`);
        updateAutoBackupRuntimeState(`${guidance}\nSize: ${sizeLabel}`);

        console.log(
            "✅ Manual export completed"
        );

    } catch (err) {

        console.error(
            "❌ Export failed",
            err
        );
    }
}

// =========================
// 🔄 AUTO BACKUP ENGINE
// =========================

const AUTO_BACKUP_SETTINGS_KEY = "autoBackupSettingsV1";
const AUTO_BACKUP_LAST_RUN_KEY = "autoBackupLastRunAt";

function getDefaultAutoBackupSettings() {
    return {
        enabled: false,
        frequency: "weekly",
        target: "local_download"
    };
}

function getAutoBackupSettings() {
    try {
        const parsed = JSON.parse(localStorage.getItem(AUTO_BACKUP_SETTINGS_KEY) || "null");
        return Object.assign(getDefaultAutoBackupSettings(), parsed || {});
    } catch (_err) {
        return getDefaultAutoBackupSettings();
    }
}

function saveAutoBackupSettings(settings) {
    localStorage.setItem(AUTO_BACKUP_SETTINGS_KEY, JSON.stringify(Object.assign(getDefaultAutoBackupSettings(), settings || {})));
}

function getBackupFrequencyDays(frequency) {
    if (frequency === "daily") return 1;
    if (frequency === "monthly") return 30;
    return 7;
}

function formatDateTimeLabel(ts) {
    if (!ts) return "Not available";
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return "Not available";
    return d.toLocaleString("en-IN");
}

function getNextAutoBackupAt(lastRunTs, frequency) {
    if (!lastRunTs) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    return Number(lastRunTs) + (getBackupFrequencyDays(frequency) * dayMs);
}

function refreshAutoBackupSettingsUI() {
    const settings = getAutoBackupSettings();
    const enabled = document.getElementById("autoBackupEnabled");
    const frequency = document.getElementById("autoBackupFrequency");
    const target = document.getElementById("autoBackupTarget");
    const lastRun = document.getElementById("autoBackupLastRun");
    const nextRun = document.getElementById("autoBackupNextRun");

    if (enabled) enabled.checked = !!settings.enabled;
    if (frequency) frequency.value = settings.frequency;
    if (target) target.value = settings.target;

    const last = localStorage.getItem(AUTO_BACKUP_LAST_RUN_KEY);
    const next = getNextAutoBackupAt(last, settings.frequency);

    if (lastRun) lastRun.textContent = `Last Backup: ${formatDateTimeLabel(last)}`;
    if (nextRun) nextRun.textContent = `Next Scheduled Backup: ${next ? formatDateTimeLabel(next) : "Not available"}`;

    const snapshots = ["daily", "weekly", "monthly"].filter((key) => !!localStorage.getItem(`autoBackup_${key}`)).length;
    const retention = document.getElementById("autoBackupRetentionState");
    if (retention) {
        retention.textContent = `Retention: ${snapshots} snapshot bucket(s) stored locally (daily/weekly/monthly).`;
    }

    updateAutoBackupRuntimeState();
}

function updateAutoBackupRuntimeState(forcedText) {
    const el = document.getElementById("autoBackupRuntimeState");
    if (!el) return;

    if (forcedText) {
        el.textContent = forcedText;
        return;
    }

    const runtime = getRuntimeDiagnostics();
    if (runtime.showSaveFilePicker) {
        el.textContent = "Export runtime: file picker supported (pre-filled generated filename).";
        return;
    }

    if (runtime.isAndroid && runtime.webShareFiles) {
        el.textContent = "Export runtime: Android share-sheet fallback available with generated filename.";
        return;
    }

    if (runtime.isAndroid && runtime.isWebView) {
        el.textContent = "Export runtime: Android WebIntoApp uses browser download fallback; open Browser Downloads, Download History, or Recent Downloads to locate backups.";
        return;
    }

    el.textContent = "Export runtime: browser download attribute with generated filename.";
}

function applyAutoBackupSettings() {
    const settings = {
        enabled: !!document.getElementById("autoBackupEnabled")?.checked,
        frequency: document.getElementById("autoBackupFrequency")?.value || "weekly",
        target: document.getElementById("autoBackupTarget")?.value || "local_download"
    };
    saveAutoBackupSettings(settings);
    refreshAutoBackupSettingsUI();
}

function runAutoBackupNow() {
    const settings = getAutoBackupSettings();
    createAutoBackup(settings.frequency);
    if (settings.target === "local_download") {
        try { exportDataAsJSON(); } catch (_err) { }
    }
    refreshAutoBackupSettingsUI();
}

function startAutoBackup() {
    const settings = getAutoBackupSettings();
    if (!settings.enabled) return;
    checkAndCreateBackup(settings.frequency, getBackupFrequencyDays(settings.frequency));
}

// =========================
// 🧠 SMART BACKUP CHECK
// =========================

function checkAndCreateBackup(
    type,
    requiredDays
) {

    try {

        const lastBackup =
            localStorage.getItem(
                `lastBackup_${type}`
            );

        const now =
            Date.now();

        if (!lastBackup) {

            createAutoBackup(type);

            return;
        }

        const diffDays =
            (now - Number(lastBackup))
            / (1000 * 60 * 60 * 24);

        if (diffDays >= requiredDays) {

            createAutoBackup(type);
        }

    } catch (err) {

        console.error(
            `❌ ${type} backup check failed`,
            err
        );
    }
}

// =========================
// 💾 CREATE AUTO BACKUP
// =========================

function createAutoBackup(type) {

    try {

        const backupData = {

            createdAt:
                new Date()
                    .toISOString(),

            type,

            data:
                getFullAppData()
        };

        localStorage.setItem(

            `autoBackup_${type}`,

            JSON.stringify(
                backupData
            )
        );

        localStorage.setItem(

            `lastBackup_${type}`,

            Date.now().toString()
        );

        localStorage.setItem(AUTO_BACKUP_LAST_RUN_KEY, Date.now().toString());

        console.log(
            `✅ ${type} backup completed`
        );

        refreshAutoBackupSettingsUI();

    } catch (err) {

        console.error(
            `❌ ${type} backup failed`,
            err
        );
    }
}

try {
    window.applyAutoBackupSettings = applyAutoBackupSettings;
    window.refreshAutoBackupSettingsUI = refreshAutoBackupSettingsUI;
    window.runAutoBackupNow = runAutoBackupNow;
} catch (_err) {
    // ignore non-browser contexts
}

///Pushing refund to savings and logging refund in expenses to MoneyTracker.    