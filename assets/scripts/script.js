const isSavingsPage = (typeof window !== 'undefined' && window.location && typeof window.location.pathname === 'string' && window.location.pathname.includes("savings")) || false;
let currentFilteredExpenses = [];
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
        updateBudgetEfficiency();


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
    if (entry.periodKey) return `period:${String(entry.periodKey)}`;
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
    window.calculateGraphAverageExpense = window.calculateGraphAverageExpense || calculateGraphAverageExpense;
    window.calculateAverageSpendingByType = window.calculateAverageSpendingByType || calculateAverageSpendingByType;
    window.loadGraph = window.loadGraph || loadGraph;
    window.updateGraphSummary = window.updateGraphSummary || updateGraphSummary;
    window.updateBudgetEfficiency = window.updateBudgetEfficiency || updateBudgetEfficiency;
    window.computeBudgetEfficiencyMetrics = window.computeBudgetEfficiencyMetrics || computeBudgetEfficiencyMetrics;
    window.setupAttachmentInputs = window.setupAttachmentInputs || setupAttachmentInputs;
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

            let deletedSourceIds = new Set([...savingsDelete]);

            budgets.forEach(b => {
                if (!b || !b.sourceId) return;
                let bid = String(b.budgetId || b.id || "");
                if (!bid || budgetDelete.has(bid)) return;
                if (deletedSourceIds.has(String(b.sourceId)) && cascade) {
                    budgetDelete.add(bid);
                    changed = true;
                }
            });

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

    let childBudgets = budgets
        .filter(b => scope === "savings" && b && b.sourceId && idSet.has(String(b.sourceId)))
        .map(b => String(b.budgetId || b.id || ""))
        .filter(Boolean);

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

    if (!budgetIds.size && removedSavings.length && typeof adjustBudgetAfterDelete === "function") {
        removedSavings.forEach(entry => {
            if (entry && entry.type === "budget_allocation") {
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

    return net;
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



/* =========================
   🖥️ UI FUNCTIONS
========================= */

// 📜 Load History
function loadHistory(list = getExpenses()) {

    try {
        currentFilteredExpenses = list;

        let container = document.getElementById("historyList");
        if (!container) return;

        container.innerHTML = "";

        if (!list.length) {
            container.innerHTML = `<p class="empty-state">No data yet</p>`;
            return;
        }

        let withRunning = rebalanceExpenseLedger(list, getBudgets()).slice().sort((a, b) => {
            let da = new Date(a.date || 0).getTime();
            let db = new Date(b.date || 0).getTime();
            if (da !== db) return da - db;
            return String(a.id || "").localeCompare(String(b.id || ""));
        });
        withRunning.slice().reverse().forEach((e) => {

            let div = document.createElement("div");
            div.className = "expense-item";

                        let entryType = String(e.type || "entry").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
                        let amount = formatCurrency(Math.abs(Number(e.amount || 0)));
                        let amountClass = e.amount < 0 ? "negative" : "positive";
                        let date = new Date(e.date).toLocaleString("en-IN");
                        let runningBalance = formatCurrency(Number(e.BalanceAfterTransaction ?? e.runningBalance ?? 0));
                        let descriptorParts = [e.category, e.purpose].filter(Boolean);
                        if (e.type === "refund") descriptorParts.push(`Refund Type: ${formatRefundType(e.refundType)}`);
                        if (e.resolutionType) descriptorParts.push(`Resolution: ${RESOLUTION_TYPE_LABELS[normalizeResolutionType(e.resolutionType)] || e.resolutionType}`);
                        let descriptor = descriptorParts.join(" • ");

            div.innerHTML = `
                                <div class="history-main">
                                    <div class="history-type">${entryType}</div>
                                    ${descriptor ? `<div class="history-note">${descriptor}</div>` : ""}
                                    <div class="history-meta">${date}</div>
                                    <div class="history-running">Running Balance: ${runningBalance}</div>
                </div>

                                <div>
                                        <div class="history-amount ${amountClass}">${amount}</div>
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
            let proceed = window.confirm(
                `Cannot delete because dependent records exist (${safePlan.summary}).\n\n` +
                `Use cascade delete and remove all dependents as well?`
            );
            if (!proceed) return;

            let cascadePlan = validateTransactionDependencies("expense", rootIds, true);
            await executeDeletePlan(cascadePlan);

            loadHistory();
            loadDashboard();
            loadGraph();
            updateBudgetEfficiency();
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
        updateBudgetEfficiency();
        renderBudgetEntries();
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
    cancellation: "Cancellation",
    return: "Return",
    recovery: "Recovery",
    reversal: "Reversal",
    adjustment: "Adjustment",
    cashback: "Cashback",
    correction: "Correction",
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
        cancellation: "cancellation",
        cancelled: "cancellation",
        return: "return",
        returned: "return",
        recovery: "recovery",
        reimbursement: "recovery",
        reversal: "reversal",
        adjustment: "adjustment",
        cashback: "cashback",
        correction: "correction",
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

function buildTransferBackPlan(requestAmount) {
    let amount = Math.abs(Number(requestAmount) || 0);
    if (!amount) {
        return { amount: 0, allocations: [], remaining: 0, totalAvailable: 0 };
    }

    let budgets = filterBudgetsByActivePeriod(getBudgets())
        .filter(b => b && b.budgetId && b.sourceId);
    let savingsEntries = (typeof getSavings === "function") ? getSavings() : [];

    let expenses = getExpenses();
    let candidates = budgets.map(b => {
        let spent = Math.max(0, getNetSpentForBudget(b.budgetId, expenses));
        let allocated = Math.max(0, Number(b.totalAllocated || 0));
        let available = Math.max(0, allocated - spent);
        let resolvedSourceId = resolveBudgetSourceIdForTransferBack(b, savingsEntries) || String(b.sourceId || "");
        return {
            budgetId: b.budgetId,
            sourceId: resolvedSourceId,
            available
        };
    }).filter(c => c.available > 0);

    candidates.sort((a, b) => b.available - a.available);

    let allocations = [];
    let remaining = amount;

    for (let c of candidates) {
        if (remaining <= 0) break;
        let use = Math.min(c.available, remaining);
        if (use <= 0) continue;
        allocations.push({
            budgetId: c.budgetId,
            sourceId: c.sourceId,
            amount: use
        });
        remaining -= use;
    }

    return {
        amount,
        allocations,
        remaining,
        totalAvailable: candidates.reduce((sum, c) => sum + c.available, 0)
    };
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

    [categoryWrapper, budgetWrapper, linkedWrapper, paymentWrapper]
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
        return;
    }

    if (type === "refund") {
        if (linkedWrapper) linkedWrapper.style.display = "block";
        if (paymentWrapper) paymentWrapper.style.display = "block";
        loadLinkedTransactionOptions(type);
        handleRefundResolutionChange();
        return;
    }

    if (type === "transfer_back") {
        return;
    }

    // income and other inflows
    if (categoryWrapper) categoryWrapper.style.display = "block";
    if (paymentWrapper) paymentWrapper.style.display = "block";
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
    let budgetId = document.getElementById("budgetSelect")?.value;
    let linkedTransactionId = document.getElementById("linkedTransactionSelect")?.value || null;
    let refundResolutionType = normalizeResolutionType(document.getElementById("refundResolutionType")?.value || "open");
    let refundType = normalizeRefundType(document.getElementById("refundType")?.value || "custom");

    // ✅ VALIDATION
    if (!(type === "refund" && (refundResolutionType === "consumed" || refundResolutionType === "written_off")) && !amount) {
        showToast("Enter amount");
        return;
    }

    if ((type === "expense" || type === "transfer") && !budgetId) {
        showToast("Select budget");
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
    amount = (type === "expense" || type === "transfer")
        ? -Math.abs(amount)
        : Math.abs(amount);

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
        await handleExpenseSave(Math.abs(amount), attachmentMeta);
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
    }

    if (type === "transfer_back") {
        let plan = buildTransferBackPlan(amount);
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

        let created = addExpense({
            amount: -Math.abs(amount),
            category,
            purpose: purpose || "Transfer Back",
            date: selectedDate.toISOString(),
            type,
            paymentType,
            allocationTrail: transferBackTrail.map(a => ({ budgetId: a.budgetId, amount: a.amount })),
            transferBackTrail,
            linkedSourceSavingsId: uniqueSources.length === 1 ? uniqueSources[0] : null,
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
        resetForm();
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        updateProgressBar();
        updateBudgetEfficiency();
        renderBudgetEntries();
        return;
    }

    if (type === "refund") {
        let snapshot = getExpenseResolutionSnapshot(linkedTransactionId);
        let pending = Number(snapshot.remainingRefundable || 0);
        let refundAmount = Math.abs(Number(amount) || 0);

        if (refundResolutionType !== "consumed" && refundResolutionType !== "written_off") {
            addExpense({
                amount: refundAmount,
                category: "Refund",
                purpose: purpose || "Refund",
                date: selectedDate.toISOString(),
                type: "refund",
                paymentType,
                budgetId: snapshot.original ? snapshot.original.budgetId : budgetId,
                linkedTransactionId,
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
                budgetId: snapshot.original ? snapshot.original.budgetId : budgetId,
                linkedTransactionId,
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
        resetForm();
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        updateProgressBar();
        updateBudgetEfficiency();
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

    resetForm();
    loadHistory();
    loadBudgetOptions();
    loadDashboard();   // 🔥 important
    loadGraph();
    updateProgressBar();
    updateBudgetEfficiency();
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
    if (document.getElementById("amount")) document.getElementById("amount").disabled = false;
    if (document.getElementById("linkedRemainingText")) {
        document.getElementById("linkedRemainingText").style.display = "none";
        document.getElementById("linkedRemainingText").textContent = "";
    }

    let today = new Date().toISOString().split("T")[0];
    if (document.getElementById("expenseDate")) document.getElementById("expenseDate").value = today;

    let expInput = document.getElementById("expenseAttachment");
    let expPreview = document.getElementById("expenseAttachmentPreview");
    let expWrapper = document.getElementById("expenseAttachmentPreviewWrapper");
    let expRemove = document.getElementById("expenseAttachmentRemove");
    if (expInput) expInput.value = "";
    if (expPreview && expPreview.dataset && expPreview.dataset._previewUrl) {
        try { URL.revokeObjectURL(expPreview.dataset._previewUrl); } catch (e) { }
        expPreview.dataset._previewUrl = "";
    }
    if (expPreview) expPreview.src = "";
    if (expWrapper) expWrapper.style.display = "none";
    if (expRemove) expRemove.style.display = "none";

    handleEntryTypeUIChange();
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

// ✅ ALWAYS RUN FOOTER (independent)
window.addEventListener("load", function () {
    if (isSavingsPage) {
        console.log("🚫 script.js blocked on savings page");
        return;
    }
    try {
        injectGlobalFooter();

        // Keep persisted data chains tied across upgrades/legacy backups.
        runIntegrityRepairSilently();

        loadHistory();
        initCategories();
        loadTheme();
        updateUI();
        loadBudgetOptions();
        loadDashboard();
        loadBudgetScreen();
        loadGraph("day");
        updateBudgetEfficiency();

        let today = new Date().toISOString().split("T")[0];
        let dateInput = document.getElementById("expenseDate");
        if (dateInput) dateInput.value = today;

        handleEntryTypeUIChange();

        renderCategoryList();
        setDefaultDate();
        bindRemainingCard();
        renderBudgetEntries();
        renderCategoryBreakdown();
        startHeadline();
        if (typeof refreshSettingsPanels === "function") refreshSettingsPanels();
        startAutoBackup();

    } catch (e) {
    }
});
window.showScreen = function showScreen(id) {
    const screens = document.querySelectorAll(".screen");
    const buttons = document.querySelectorAll(".nav button");

    screens.forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");

    buttons.forEach(btn => btn.classList.remove("active"));
    document.querySelector(`[data-screen="${id}"]`)?.classList.add("active");

    if (id === "history") loadHistory();
    if (id === "budgetEntries") {
        renderBudgetEntries();
    }
    if (id === "graph") {
        loadGraph();
    }
    if (id === "settings" && typeof window.refreshSettingsPanels === "function") {
        window.refreshSettingsPanels();
    }
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

const APPEARANCE_MODES = ["metallic", "matte", "glossy", "chromium", "glass", "paper", "neon"];
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
    let safeMode = APPEARANCE_MODES.includes(String(mode || "").toLowerCase())
        ? String(mode).toLowerCase()
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
        : (window.currentFilteredExpenses && window.currentFilteredExpenses.length)
            ? window.currentFilteredExpenses
            : (typeof getExpenses === 'function' ? getExpenses() : []);

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

    const totalIncome = dataSource.filter(e => e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    const totalExpense = dataSource.filter(e => e.amount < 0)
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

    // budgets for this PDF (respect active filter)
    let budgets = getBudgets().filter(b => dataSource.some(e => e.periodKey === b.periodKey));

    let totalBudget = budgets.reduce((sum, b) => sum + Math.abs(b.totalAllocated || 0), 0);

    let totalSpent = dataSource.filter(e => e.amount < 0).reduce((sum, e) => sum + Math.abs(e.amount), 0);

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

        let spent =
            dataSource

                .filter(e =>

                    (
                        e.type === "expense" ||
                        e.type === "loss"
                    )

                    &&

                    e.budgetId ===
                    b.budgetId
                )

                .reduce(
                    (sum, e) =>

                        sum +
                        Math.abs(
                            e.amount || 0
                        ),

                    0
                );

        // =========================
        // 💰 RECOVERY
        // =========================

        let recovered =
            dataSource

                .filter(e =>

                    e.type ===
                    "recovery"

                    &&

                    e.budgetId ===
                    b.budgetId
                )

                .reduce(
                    (sum, e) =>

                        sum +
                        Math.abs(
                            e.amount || 0
                        ),

                    0
                );

        // =========================
        // 📊 REMAINING
        // =========================

        let remaining =
            allocated -
            spent +
            recovered;


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
    const dataSource = (window.currentFilteredExpenses && window.currentFilteredExpenses.length) ? window.currentFilteredExpenses : (typeof getExpenses === 'function' ? getExpenses() : []);
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
    .remo-title{font-weight:700;font-size:14px}
    .remo-sub{font-size:11px;color:rgba(0,0,0,0.5)}
    .remo-body{padding:10px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px}
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
                <div>
                    <div class="remo-title">ReMo AI</div>
                    <div class="remo-sub">Your intelligent finance companion</div>
                </div>
            </div>
            <div class="remo-body">
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

    // Lightweight insight engine
    function topCategory(expenses, periodStart, periodEnd) {
        const filtered = expenses.filter(e => {
            const d = new Date(e.date);
            if (periodStart && d < periodStart) return false;
            if (periodEnd && d > periodEnd) return false;
            return true;
        });
        const sums = {};
        filtered.forEach(e => {
            const cat = e.category || 'Others';
            sums[cat] = (sums[cat] || 0) + Math.abs(Number(e.amount || 0));
        });
        const entries = Object.entries(sums).sort((a, b) => b[1] - a[1]);
        return entries[0] ? { category: entries[0][0], amount: entries[0][1] } : null;
    }

    function sumRange(expenses, periodStart, periodEnd) {
        return expenses.filter(e => {
            const d = new Date(e.date);
            if (periodStart && d < periodStart) return false;
            if (periodEnd && d > periodEnd) return false;
            return true;
        }).reduce((s, e) => s + Number(e.amount || 0), 0);
    }

    function formatCurrencyShort(v) {
        try { return formatCurrencyPDF ? formatCurrencyPDF(v) : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(v); } catch (e) { return v }
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

    function generateInsightIntent(intent) {
        const expenses = (window.currentFilteredExpenses && window.currentFilteredExpenses.length) ? window.currentFilteredExpenses : (typeof getExpenses === 'function' ? getExpenses() : []);
        const now = new Date();
        function sumRangeFor(arr, start, end) {
            return arr.reduce((s, e) => {
                const d = new Date(e.date);
                if (d >= start && d <= end) return s + Number(e.amount || 0); return s;
            }, 0);
        }
        function topCategories(arr, start, end, limit = 3) {
            const m = {};
            arr.forEach(e => { const d = new Date(e.date); if (d >= start && d <= end) { const k = e.category || 'Uncategorized'; m[k] = (m[k] || 0) + Math.abs(Number(e.amount || 0)); } });
            return Object.keys(m).map(k => ({ category: k, amount: m[k] })).sort((a, b) => b.amount - a.amount).slice(0, limit);
        }
        if (intent === 'top-spend-week') {
            const start = new Date(now); start.setDate(now.getDate() - 7);
            const top = topCategory(expenses, start, now);
            if (top) return `Top spending in last 7 days: ${top.category} — ${formatCurrencyShort(top.amount)}`;
            return 'No expenses found in the last 7 days.';
        }
        if (intent === 'spending-trends' || intent === 'show-spending-trends') {
            const day7 = new Date(now); day7.setDate(now.getDate() - 7);
            const day30 = new Date(now); day30.setDate(now.getDate() - 30);
            const spend7 = Math.abs(sumRangeFor(expenses.filter(e => Number(e.amount) < 0), day7, now));
            const spend30 = Math.abs(sumRangeFor(expenses.filter(e => Number(e.amount) < 0), day30, now));
            const avg7 = (spend7 / 7) || 0;
            const avg30 = (spend30 / 30) || 0;
            const trend = avg7 > avg30 ? 'increasing' : (avg7 < avg30 ? 'decreasing' : 'stable');
            return `7-day avg ${formatCurrencyShort(avg7)}; 30-day avg ${formatCurrencyShort(avg30)} — trend ${trend}.`;
        }
        if (intent === 'category-analysis') {
            const start = new Date(now); start.setDate(now.getDate() - 30);
            const top = topCategories(expenses, start, now, 5);
            if (!top.length) return 'No category data for last 30 days.';
            return 'Top categories (30d): ' + top.map(t => `${t.category} ${formatCurrencyShort(t.amount)}`).join(', ');
        }
        if (intent === 'savings-progress') {
            const savings = (typeof getSavings === 'function') ? getSavings() : [];
            const total = savings.reduce((s, x) => s + Number(x.amount || 0), 0);
            return `You have ${formatCurrencyShort(total)} in savings (${savings.length} entries).`;
        }
        if (intent === 'end-of-day-summary') {
            const start = new Date(now); start.setHours(0, 0, 0, 0);
            const end = new Date(now); end.setHours(23, 59, 59, 999);
            const incomes = expenses.filter(e => Number(e.amount) > 0 && new Date(e.date) >= start && new Date(e.date) <= end);
            const outs = expenses.filter(e => Number(e.amount) < 0 && new Date(e.date) >= start && new Date(e.date) <= end);
            const inAmt = incomes.reduce((s, e) => s + Number(e.amount || 0), 0);
            const outAmt = outs.reduce((s, e) => s + Number(e.amount || 0), 0);
            return `Today: ${incomes.length} income(s) ${formatCurrencyShort(inAmt)}; ${outs.length} expense(s) ${formatCurrencyShort(Math.abs(outAmt))}.`;
        }
        if (intent === 'savings-month') {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const income = sumRange(expenses.filter(e => Number(e.amount) > 0), start, now);
            const expense = Math.abs(sumRange(expenses.filter(e => Number(e.amount) < 0), start, now));
            const saved = income - expense;
            return `This month: Income ${formatCurrencyShort(income)}, Expense ${formatCurrencyShort(expense)}, Savings ${formatCurrencyShort(saved)}`;
        }
        if (intent === 'budget-alerts') {
            const budgets = (typeof getBudgets === 'function') ? getBudgets() : [];
            const alerts = [];
            budgets.forEach(b => {
                const allocated = Math.abs(b.totalAllocated || 0);
                const spent = getNetSpentForBudget(b.budgetId, expenses);
                if (allocated > 0 && spent / allocated >= 0.85) alerts.push(`${b.name || b.note || 'Budget'} is ${Math.round((spent / allocated) * 100)}% used`);
            });
            return alerts.length ? alerts.join('; ') : 'No budget alerts.';
        }
        if (intent === 'compare-last-month') {
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            const thisSpend = Math.abs(sumRange(expenses.filter(e => Number(e.amount) < 0), thisMonthStart, now));
            const lastSpend = Math.abs(sumRange(expenses.filter(e => Number(e.amount) < 0), lastMonthStart, lastMonthEnd));
            const diff = thisSpend - lastSpend;
            return `Expense this month ${formatCurrencyShort(thisSpend)}. Last month ${formatCurrencyShort(lastSpend)}. Change ${formatCurrencyShort(diff)}.`;
        }

        return "I couldn't compute that automatically. Try a quick suggestion.";
    }

    function handlePreset(promptKey) {
        const map = {
            'Where did I spend most this week?': 'top-spend-week',
            'How much did I save this month?': 'savings-month',
            'Which category exceeds budget?': 'budget-alerts',
            'What changed compared to last month?': 'compare-last-month',
            'Show spending trends': 'spending-trends'
        };
        const intent = map[promptKey] || promptKey;
        renderMessage(promptKey);
        const reply = generateInsightIntent(intent);
        setTimeout(() => renderMessage(reply), 200);
    }

    function openPanel(panel) {
        panel.classList.add('open');
        // populate chips
        const chips = panel.querySelector('[data-chips]');
        if (chips && chips.children.length === 0) {
            ['Where did I spend most this week?', 'How much did I save this month?', 'Which category exceeds budget?', 'What changed compared to last month?', 'Show spending trends'].forEach(t => {
                const b = document.createElement('button');
                b.className = 'remo-chip';
                b.textContent = t;
                b.onclick = () => handlePreset(t);
                chips.appendChild(b);
            });
        }
        panel.querySelector('[data-messages]').innerHTML = '';
        renderMessage('Hi — I am ReMo. I can show insights, reminders and quick actions.');
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
                else { openPanel(panel); }
            });

            // Send handler
            panel.querySelector('[data-send]').addEventListener('click', () => {
                const input = panel.querySelector('[data-userinput]');
                const text = (input.value || '').trim();
                if (!text) return;
                renderMessage(text);
                // naive intent detection
                const l = text.toLowerCase();
                if (l.includes('food') || l.includes('where') || l.includes('most')) handlePreset('Where did I spend most this week?');
                else if (l.includes('save') || l.includes('saving') || l.includes('how much did i save')) handlePreset('How much did I save this month?');
                else if (l.includes('budget') || l.includes('exceed')) handlePreset('Which category exceeds budget?');
                else if (l.includes('compare') || l.includes('changed') || l.includes('last month')) handlePreset('What changed compared to last month?');
                else {
                    // fallback: try to compute simple numeric answers
                    const reply = generateInsightIntent(text);
                    setTimeout(() => renderMessage(reply), 200);
                }
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

function getAttachmentApi() {
    return window.reMoAttachments || window.reMoAttachmentsIndexed || null;
}

function ensureAuditModal() {
    let existing = document.getElementById("txnDetailsModal");
    if (existing) return existing;

    let modal = document.createElement("div");
    modal.id = "txnDetailsModal";
    modal.className = "modal";
    modal.innerHTML = `
      <div class="modal-content audit-modal-content" onclick="event.stopPropagation()">
        <h3>Transaction Details</h3>
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
    let at = getAttachmentApi();
    if (!at || !attachmentId) return;

    try {
        let record = null;
        if (at.getRecord) {
            try { record = await at.getRecord(attachmentId); } catch (_err) { record = null; }
        }

        let mime = record && record.mime ? String(record.mime) : "";
        let isImage = mime ? mime.startsWith("image/") : true;

        if (isImage && at.getImageUrl) {
            let src = await at.getImageUrl(attachmentId);
            if (src) {
                openAttachmentOverlay({ src, kind: 'image', title: 'Image preview' });
                return;
            }
        }
        if (at.getBlob) {
            let blob = await at.getBlob(attachmentId);
            if (!blob) return;
            let url = URL.createObjectURL(blob);
            let opened = openAttachmentOverlay({
                src: url,
                kind: 'document',
                title: record && record.filename ? record.filename : 'Attachment preview'
            });
            if (opened) opened.dataset.objectUrl = url;
        }
    } catch (err) {
        console.warn("viewAttachmentById failed", err);
    }
}

async function downloadAttachmentById(attachmentId, filenameHint) {
    let at = getAttachmentApi();
    if (!at || !attachmentId || !at.getBlob) return;

    try {
        let blob = await at.getBlob(attachmentId);
        if (!blob) return;
        let url = URL.createObjectURL(blob);
        let a = document.createElement("a");
        a.href = url;
        a.download = filenameHint || `attachment_${attachmentId}.bin`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    } catch (err) {
        console.warn("downloadAttachmentById failed", err);
    }
}

async function deleteTransactionAttachment(scope, transactionId, attachmentId) {
    let at = getAttachmentApi();
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

        if (at.remove) {
            try { await at.remove(attachmentId); } catch (e) { }
        }

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

    body.innerHTML = `
      <div><small>Transaction ID</small><div>${escapeHtml(transaction.id || "-")}</div></div>
      <div><small>Date</small><div>${escapeHtml(new Date(transaction.date || Date.now()).toLocaleString("en-IN"))}</div></div>
      <div><small>Entry Type</small><div>${escapeHtml(transaction.type || "-")}</div></div>
      <div><small>Amount</small><div>${escapeHtml(formatCurrency(Number(transaction.amount || 0)))}</div></div>
      <div><small>Running Balance</small><div>${escapeHtml(runningBalanceText)}</div></div>
      <div><small>Notes</small><div>${escapeHtml(transaction.purpose || transaction.note || "-")}</div></div>
    <div><small>Refund Type</small><div>${escapeHtml(transaction.type === "refund" ? formatRefundType(transaction.refundType) : "-")}</div></div>
    <div><small>Resolution Type</small><div>${escapeHtml(transaction.resolutionType ? (RESOLUTION_TYPE_LABELS[normalizeResolutionType(transaction.resolutionType)] || transaction.resolutionType) : "-")}</div></div>
    <div><small>Resolved Amount</small><div>${escapeHtml(formatCurrency(Number(transaction.resolvedAmount || 0)))}</div></div>
    <div><small>Loss Amount</small><div>${escapeHtml(formatCurrency(Number(transaction.lossAmount || 0)))}</div></div>
      <div><small>Linked Transaction</small><div>${escapeHtml(transaction.linkedTransactionId || "-")}</div></div>
      <div><small>Created At</small><div>${escapeHtml(new Date(createdAt || Date.now()).toLocaleString("en-IN"))}</div></div>
      ${summary && summary.exists ? `<div><small>Original Amount</small><div>${escapeHtml(formatCurrency(summary.originalAmount))}</div></div>` : ""}
      ${summary && summary.exists ? `<div><small>Refunded</small><div>${escapeHtml(formatCurrency(summary.refunded))}</div></div>` : ""}
      ${summary && summary.exists ? `<div><small>Loss</small><div>${escapeHtml(formatCurrency(summary.loss))}</div></div>` : ""}
            ${summary && summary.exists ? `<div><small>Status</small><div>${escapeHtml(summaryStatusText)}</div></div>` : ""}
      ${summary && summary.exists ? `<div><small>Remaining Refundable</small><div>${escapeHtml(formatCurrency(summary.remainingRefundable))}</div></div>` : ""}
    `;

    if (!transaction.attachmentId) {
        attachmentSection.style.display = "none";
    } else {
        let at = getAttachmentApi();
        let name = `attachment_${transaction.attachmentId}`;
        let mime = "unknown";
        let uploadDate = transaction.createdAt || transaction.date;

        if (at && at.getRecord) {
            try {
                let rec = await at.getRecord(transaction.attachmentId);
                if (rec) {
                    name = rec.filename || name;
                    mime = rec.mime || mime;
                    uploadDate = rec.createdAt ? new Date(rec.createdAt).toISOString() : uploadDate;
                }
            } catch (err) {
                console.warn("Attachment metadata read failed", err);
            }
        }

        attachmentSection.style.display = "block";
        attachmentSection.innerHTML = `
          <h4>Attachments</h4>
          <div class="audit-attachment-card">
            <div><strong>${escapeHtml(name)}</strong></div>
            <div><small>Type: ${escapeHtml(mime)}</small></div>
            <div><small>Uploaded: ${escapeHtml(new Date(uploadDate || Date.now()).toLocaleString("en-IN"))}</small></div>
            <div class="audit-attachment-actions">
              <button class="secondary" onclick="viewAttachmentById('${escapeHtml(transaction.attachmentId)}')">View</button>
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
    }

    function clearFilePreview(inputEl, previewEl, wrapperEl, removeBtn) {
        if (previewEl && previewEl.dataset._previewUrl) {
            try { URL.revokeObjectURL(previewEl.dataset._previewUrl); } catch (_err) { }
            previewEl.dataset._previewUrl = '';
        }
        if (inputEl) inputEl.value = '';
        if (previewEl) {
            previewEl.removeAttribute('src');
            previewEl.style.display = 'none';
        }
        if (wrapperEl) {
            const label = wrapperEl.querySelector('.attachment-preview-label');
            if (label) label.textContent = '';
            wrapperEl.style.display = 'none';
        }
        if (removeBtn) removeBtn.style.display = 'none';
    }

    // expense attachment
    const expInput = document.getElementById('expenseAttachment');
    const expPreview = document.getElementById('expenseAttachmentPreview');
    const expWrapper = document.getElementById('expenseAttachmentPreviewWrapper');
    const expRemove = document.getElementById('expenseAttachmentRemove');
    if (expInput) {
        expInput.addEventListener('change', async function () {
            const file = this.files && this.files[0];
            if (!file) return;
            // show temporary preview using object URL
            // revoke previous preview url if present
            if (expPreview && expPreview.dataset._previewUrl) { try { URL.revokeObjectURL(expPreview.dataset._previewUrl); } catch (e) { } }
            const url = URL.createObjectURL(file);
            if (expPreview) expPreview.dataset._previewUrl = url;
            setFilePreview(expPreview, expWrapper, file, url);
            if (expRemove) expRemove.style.display = 'inline';
            expPreview.onclick = () => openAttachmentViewer(url);
        });
        if (expRemove) expRemove.addEventListener('click', () => clearFilePreview(expInput, expPreview, expWrapper, expRemove));
    }

    const sInput = document.getElementById('sAttachment');
    const sPreview = document.getElementById('sAttachmentPreview');
    const sWrapper = document.getElementById('sAttachmentPreviewWrapper');
    const sRemove = document.getElementById('sAttachmentRemove');
    if (sInput) {
        sInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            if (sPreview && sPreview.dataset._previewUrl) { try { URL.revokeObjectURL(sPreview.dataset._previewUrl); } catch (e) { } }
            const url = URL.createObjectURL(file);
            if (sPreview) sPreview.dataset._previewUrl = url;
            setFilePreview(sPreview, sWrapper, file, url);
            if (sRemove) sRemove.style.display = 'inline';
            sPreview.onclick = () => openAttachmentViewer(url);
        });
        if (sRemove) sRemove.addEventListener('click', () => clearFilePreview(sInput, sPreview, sWrapper, sRemove));
    }
}

// initialize attachment inputs on DOM ready
if (document.readyState === 'complete') setupAttachmentInputs(); else window.addEventListener('load', setupAttachmentInputs);

// Helper: store attachment from a file input element id and return attachmentId (or null)
async function storeAttachmentFromInput(inputId) {
    const fileInput = document.getElementById(inputId);
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if (!file) return null;
    const store = window.reMoAttachments && window.reMoAttachments.storeImage ? window.reMoAttachments.storeImage : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.storeImage);
    if (!store) return null;
    try {
        const res = await store(null, file);
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
        return { attachmentId: null, status: "none", error: null, mime: null, filename: null };
    }

    try {
        const attachmentId = await storeAttachmentFromInput(inputId);
        if (attachmentId) {
            return {
                attachmentId,
                status: "linked",
                error: null,
                mime: file.type || null,
                filename: file.name || null
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
    let webShareFiles = false;

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

function loadBudgetOptions() {

    let select = document.getElementById("budgetSelect");
    if (!select) return;

    let budgets = getBudgets();
    let expenses = getExpenses();

    select.innerHTML = "";

    let filtered = filterBudgetsByActivePeriod(budgets);

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

        opt.textContent = `${label} (${b.entity}) — ${formatCurrency(remaining)} left`;

        select.appendChild(opt);
    });
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

function normalizeImportPayload(parsed) {
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
        "orders"
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

    const normalized = {};

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

    const rawVersion = typeof normalized.meta.version === "string" ? normalized.meta.version.trim().toLowerCase() : "v1";
    const supported = ["v1", "v2", "v3"];
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
    const hashBeforeParse = `${text.length}:${text.charCodeAt(7055)}`;

    // Requested UAT diagnostics immediately before parse.
    console.log(window.__lastImportFileMeta?.fileName || "manual_text");
    console.log(Number(window.__lastImportFileMeta?.fileSize || 0));
    console.log(text.length);
    console.log(text.substring(7000, 7100));
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
        updateBudgetEfficiency();
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
    window.location.href = "pages/quotation.html";
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

    // =========================
    // 💰 TOTALS
    // =========================
    let totalBudget = filteredBudgets
        .reduce((sum, b) =>
            sum + (b.totalAllocated || 0), 0);

    let totalIncome = filteredExpenses
        .filter(e => e.amount > 0)
        .reduce((sum, e) =>
            sum + e.amount, 0);

    let totalSpent = filteredExpenses
        .filter(e => e.amount < 0)
        .reduce((sum, e) =>
            sum + Math.abs(e.amount), 0);

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

    let todaySpent = filteredExpenses
        .filter(e => {

            if (e.amount >= 0) return false;

            let d = new Date(e.date);

            return d >= today &&
                d <= endOfDay;

        })
        .reduce((sum, e) =>
            sum + Math.abs(e.amount), 0);

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
    let budgets = filterBudgetsByActivePeriod(budgetsAll);
    let expenses = filterByActivePeriod(getExpenses());
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetEntries");
    if (!container) return;

    container.innerHTML = "";

    if (!budgets.length) {
        container.innerHTML = "<p>No budget entries</p>";
        return;
    }

    // 🔥 GROUP BY SOURCE + PERIOD
    let map = {};

    budgets.forEach(b => {

        let key = b.sourceId + "_" + (b.periodKey || b.monthKey || "no_period");

        if (!map[key]) {
            map[key] = {
                sourceId: b.sourceId,
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

        // 🔥 Use periodKey/monthKey-aware matching
        let relatedBudgetIds = budgets
            .filter(b =>
                b.sourceId === g.sourceId && (
                    (g.periodKey && b.periodKey === g.periodKey) ||
                    (!g.periodKey && b.monthKey === g.monthKey)
                )
            )
            .map(b => b.budgetId);

        let used = relatedBudgetIds.reduce((sum, budgetId) => {
            return sum + getNetSpentForBudget(budgetId, expenses);
        }, 0);
        used = Math.max(0, used);

        let remaining = g.totalAllocated - used;

        let source = savings.find(s => String(s.id) === String(g.sourceId));
        let name = source ? (source.note || source.entity) : "Budget";

        let transactionCount = expenses.filter(e => {
            if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
                return e.allocationTrail.some(a => relatedBudgetIds.includes(a.budgetId));
            }
            return relatedBudgetIds.includes(e.budgetId);
        }).length;

        let period = derivePeriodBounds(g);

        let div = document.createElement("div");
        div.className = "budget-period-card";

        div.innerHTML = `
            <div class="budget-period-head">
                <div>
                    <h4>${escapeHtml(name)}</h4>
                    <small>From ${escapeHtml(period.from === "-" ? "-" : formatDateShort(period.from))} • To ${escapeHtml(period.to === "-" ? "-" : formatDateShort(period.to))}</small>
                </div>
                <span class="budget-status-pill ${remaining <= 0 ? "is-exhausted" : "is-active"}">
                    ${remaining <= 0 ? "Exhausted" : "Healthy"}
                </span>
            </div>

            <div class="budget-period-metrics">
                <div><small>Assigned</small><strong>${escapeHtml(formatCurrency(g.totalAllocated))}</strong></div>
                <div><small>Spent</small><strong>${escapeHtml(formatCurrency(used))}</strong></div>
                <div><small>Remaining</small><strong>${escapeHtml(formatCurrency(remaining))}</strong></div>
                <div><small>Transactions</small><strong>${escapeHtml(String(transactionCount))}</strong></div>
            </div>
        `;

        div.style.cursor = "pointer";
        div.onclick = () => openBudgetDetails(g);

        container.appendChild(div);
    });
}

function toggleBudgetEntryDetails(id) {
    let details = document.getElementById(`budgetEntryDetails_${id}`);
    if (!details) return;
    details.style.display = details.style.display === "none" ? "block" : "none";
}

function openBudgetDetails(group) {
    let budgets = getBudgets();
    let expenses = filterByActivePeriod(getExpenses());
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetDetailsContainer");
    if (!container) return;

    let source = savings.find(s => s.id === group.sourceId);
    let name = source ? (source.note || source.entity) : "Budget";

    let related = [];

    let relatedBudgetIds = budgets
        .filter(b =>
            b.sourceId === group.sourceId && (
                (group.periodKey && b.periodKey === group.periodKey) ||
                (!group.periodKey && b.monthKey === group.monthKey)
            )
        )
        .map(b => b.budgetId);

    related = expenses.filter(e => {
        if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
            return e.allocationTrail.some(a => relatedBudgetIds.includes(a.budgetId));
        }
        return relatedBudgetIds.includes(e.budgetId);
    });

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

    let remaining = group.totalAllocated - used + credited;

    // 🔥 Proper label
    let label = "No Date";

    if (group.periodKey) {
        let [start, end] = group.periodKey.split("_to_");
        label = `${formatDateShort(start)} → ${formatDateShort(end)}`;
    } else if (group.monthKey) {
        label = formatMonth(group.monthKey);
    }

    let entriesHtml = "";

    if (!related.length) {
        entriesHtml = "<p>No entries</p>";
    } else {
        related.forEach(e => {
            let color = e.amount < 0 ? "#ff5252" : "#4caf50";
            let compactDate = new Date(e.date || Date.now()).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric"
            });
            let runningBalance = Number(e.BalanceAfterTransaction ?? e.runningBalance ?? 0);
            let snapshot = getExpenseResolutionSnapshot(e.linkedTransactionId || e.id, related);
            let attachmentText = e.attachmentId
                ? `Linked (${e.attachmentStatus || "linked"})`
                : (e.attachmentStatus === "failed" ? "Failed" : "None");

            entriesHtml += `
                <div class="expense-item" style="display:block;">
                    <div style="display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;">
                        <div>
                            <strong>${escapeHtml(e.category || e.type || "Entry")}</strong><br>
                            <small>${escapeHtml(compactDate)}</small><br>
                            <small>Balance: ${escapeHtml(formatCurrency(runningBalance))}</small>
                        </div>
                        <div style="color:${color};font-weight:700;">${escapeHtml(formatCurrency(Math.abs(Number(e.amount || 0))))}</div>
                    </div>
                    <div style="margin-top:8px;">
                        <button class="secondary" type="button" onclick="toggleBudgetEntryDetails('${escapeHtml(e.id)}')">View Details</button>
                    </div>
                    <div id="budgetEntryDetails_${escapeHtml(e.id)}" style="display:none;margin-top:10px;padding:10px;border:1px solid #ececec;border-radius:10px;background:#fafafa;">
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
                        <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;">
                            <button class="secondary" type="button" onclick="viewAttachmentById('${escapeHtml(e.attachmentId)}')">View</button>
                            <button class="secondary" type="button" onclick="downloadAttachmentById('${escapeHtml(e.attachmentId)}')">Download</button>
                            <button class="secondary" type="button" onclick="deleteTransactionAttachment('expense','${escapeHtml(e.id)}','${escapeHtml(e.attachmentId)}')">Delete</button>
                        </div>` : ""}
                    </div>
                </div>
            `;
        });
    }

    showScreen("budgetDetails");

    container.innerHTML = `
    
    <div class="card" style="
        border-radius:16px;
        padding:16px;
        background:#f7f7f7;
        box-shadow: 0 8px 20px rgba(0,0,0,0.08);
    ">

        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="margin:0;">${name}</h3>
                <small style="color:#666;">${label}</small>
            </div>

            <button onclick="goBackToBudgets()" style="
                background:#eee;
                border:none;
                padding:6px 12px;
                border-radius:8px;
                cursor:pointer;
            ">
                ← Back
            </button>
        </div>

        <div style="margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            
            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Allocated</small>
                <div>${formatCurrency(group.totalAllocated)}</div>
            </div>

            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Used</small>
                <div style="color:#ff5252;">${formatCurrency(used)}</div>
            </div>

            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Credited</small>
                <div style="color:#4caf50;">${formatCurrency(credited)}</div>
            </div>

            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Remaining</small>
                <div style="color:#4caf50;">${formatCurrency(remaining)}</div>
            </div>

        </div>

        <hr style="margin:16px 0;">

        <h4>Entries</h4>

        ${entriesHtml}

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
    const expenses = data || getExpenses();
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
        `Spent: ${formatCurrency(totalExpense)}`,
        `Income: ${formatCurrency(totalIncome)}`,
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
        let text = typeof e.target.result === "string" ? e.target.result : "";
        const rawSignature = getImportTextSignature(text);
        const hashFileReaderRaw = `${text.length}:${text.charCodeAt(7055)}`;
        const nullByteCount = (text.match(/\u0000/g) || []).length;
        const hadBom = text.charCodeAt(0) === 65279;
        const normalizedText = normalizeImportRawText(text);
        const normalizedSignature = getImportTextSignature(normalizedText);
        const hashFileReaderNormalized = `${normalizedText.length}:${normalizedText.charCodeAt(7055)}`;
        window.__lastImportNormalizationMeta = {
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
            changedDuringNormalization: text !== normalizedText
        };

        // Requested stage diagnostics after FileReader load.
        console.log(file.name);
        console.log(Number(file.size || 0));
        console.log(text.length);
        console.log(text.substring(7000, 7100));
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

    reader.readAsText(file, "UTF-8");
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
function handleFilter(type) {

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
    const option = select.querySelector('option[value="period"]');

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

function handleExpenseSave(amount, attachmentMeta = null) {

    // =========================
    // ✅ VALIDATE
    // =========================
    if (!amount || amount <= 0) {

        showToast("Invalid amount");
        return;
    }

    // =========================
    // ✅ ACTIVE PERIOD CHECK
    // =========================
    let activePeriod = getActiveBudgetPeriod();

    if (!activePeriod) {

        showToast("No active budget period");
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

    // =========================
    // ✅ GET ACTIVE BUDGETS
    // =========================
    let budgets =
        filterBudgetsByActivePeriod(getBudgets());

    if (!budgets.length) {

        showToast("No budgets available");
        return;
    }

    // =========================
    // ✅ GET EXPENSES
    // =========================
    let expenses = getExpenses();

    // =========================
    // ✅ SORT BY AVAILABLE
    // =========================
    budgets.sort((a, b) => {
        // Use net-spent helper to respect allocationTrail & recoveries
        let spentA = getNetSpentForBudget(a.budgetId, expenses);
        let spentB = getNetSpentForBudget(b.budgetId, expenses);

        let availableA = (a.totalAllocated || 0) - spentA;
        let availableB = (b.totalAllocated || 0) - spentB;

        return availableB - availableA;
    });

    // =========================
    // ✅ CHECK SINGLE BUDGET
    // =========================
    let single = budgets.find(b => {

        let spent = getNetSpentForBudget(b.budgetId, expenses);

        let available = (b.totalAllocated || 0) - spent;

        return available >= amount;
    });

    // =========================
    // ✅ DIRECT SAVE
    // =========================
    let split =
        prepareSplit(amount, budgets);

    // =========================
    // ❌ NOT ENOUGH BUDGET
    // =========================
    if (!split) {

        showToast("Not enough total budget");
        return;
    }

    // =========================
    // ✅ SINGLE DIRECT ENTRY
    // =========================
    if (split.length === 1) {

        let s = split[0];

        addExpense({
            amount: -Math.abs(s.amount), // ensure expenses are stored as negative amounts
            budgetId: s.budget.budgetId,
            allocationTrail: [{ budgetId: s.budget.budgetId, amount: s.amount }],
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
        updateBudgetEfficiency();
        renderBudgetEntries();
        loadBudgetOptions();

        showToast("Expense added");

        resetForm();

        return;
    }

    // =========================
    // ✅ PREPARE SPLIT
    // =========================
    //let split =prepareSplit(amount, budgets);

    // =========================
    // ❌ NOT ENOUGH BUDGET
    // =========================
    if (!split) {

        showToast("Not enough total budget");
        return;
    }

    // =========================
    // 🔥 OPEN SPLIT MODAL
    // =========================
    openSplitModal(split);
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
    updateBudgetEfficiency();
    renderBudgetEntries();
    loadBudgetOptions();
    loadHistory();
    loadGraph();

    showToast("Split expense added");

    resetForm();
}

function closeSplitModal() {
    document.getElementById("splitModal").style.display = "none";
    pendingSplit = null;
}

function updateBudgetEfficiency() {
    let metrics = computeBudgetEfficiencyMetrics();

    // =========================
    // 🎯 UI
    // =========================
    function setText(id, value) {

        let el =
            document.getElementById(id);

        if (el) {
            el.innerText = value;
        }
    }

    setText(
        "savedToday",
        formatCurrency(metrics.dailyRemaining)
    );

    setText(
        "savedWeek",
        formatCurrency(metrics.weeklyRemaining)
    );

    setText(
        "savedPeriod",
        formatCurrency(metrics.monthlyRemaining)
    );
}

function computeBudgetEfficiencyMetrics(referenceDate = new Date()) {
    let expenses = filterByActivePeriod(getExpenses());
    let budgets = filterBudgetsByActivePeriod(getBudgets());

    function getNetSpentForRange(fromDate, toDate) {
        let subset = expenses.filter(e => {
            let d = new Date(e.date);
            return d >= fromDate && d <= toDate;
        });

        return budgets.reduce((sum, b) => {
            return sum + getNetSpentForBudget(b.budgetId, subset);
        }, 0);
    }

    function getNormalizedPeriodRange() {
        let active = getActiveBudgetPeriod();

        if (active && active.start) {
            let start = new Date(active.start);
            let end = getBudgetPeriodEffectiveEndDate(active, referenceDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
            return { start, end };
        }

        let now = new Date(referenceDate);
        let start = new Date(now.getFullYear(), now.getMonth(), 1);
        let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    let now = new Date(referenceDate);

    let dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);

    let dayEnd = new Date(now);
    dayEnd.setHours(23, 59, 59, 999);

    let weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    let weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    let monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    monthStart.setHours(0, 0, 0, 0);
    monthEnd.setHours(23, 59, 59, 999);

    let periodRange = getNormalizedPeriodRange();
    let totalBudget = budgets.reduce((s, b) => s + (b.totalAllocated || 0), 0);

    let periodDays = Math.max(1, Math.floor((periodRange.end - periodRange.start) / (1000 * 60 * 60 * 24)) + 1);
    let periodWeeks = Math.max(1, Math.ceil(periodDays / 7));

    let periodMonths = Math.max(1,
        (periodRange.end.getFullYear() - periodRange.start.getFullYear()) * 12 +
        (periodRange.end.getMonth() - periodRange.start.getMonth()) + 1
    );

    let dailyLimit = totalBudget / periodDays;
    let weeklyLimit = totalBudget / periodWeeks;
    let monthlyLimit = totalBudget / periodMonths;

    let todaySpent = getNetSpentForRange(dayStart, dayEnd);
    let weekSpent = getNetSpentForRange(weekStart, weekEnd);
    let monthSpent = getNetSpentForRange(monthStart, monthEnd);

    return {
        totalBudget,
        dailyLimit,
        weeklyLimit,
        monthlyLimit,
        todaySpent,
        weekSpent,
        monthSpent,
        dailyRemaining: dailyLimit - todaySpent,
        weeklyRemaining: weeklyLimit - weekSpent,
        monthlyRemaining: monthlyLimit - monthSpent
    };
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

    return {

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

        settings: {
            ...settingsSnapshot
        },

        meta: {

            exportedAt:
                new Date().toISOString(),

            version:
                "v2"
        }
    };
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
            return "file-picker";
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
            return "web-share-file";
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

    return "download-attribute";
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
        let method = await downloadBlobWithBestEffort(blob, filename);
        window.__lastBackupExportStatus = {
            filename,
            method,
            runtime: getRuntimeDiagnostics(),
            generatedAt: new Date().toISOString()
        };
        showToast(`Backup exported: ${filename}`, "success");

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
        el.textContent = "Export runtime: Android WebIntoApp uses browser download fallback; filename prompt behavior depends on runtime.";
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