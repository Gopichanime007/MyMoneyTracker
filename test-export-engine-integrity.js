const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync("assets/scripts/script.js", "utf8");

function extractFunction(name) {
    const marker = `function ${name}(`;
    const start = source.indexOf(marker);
    assert.notStrictEqual(start, -1, `Could not find ${name} in script.js`);

    const bodyStart = source.indexOf("{", start);
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;

    for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];

        if (lineComment) {
            if (char === "\n" || char === "\r") lineComment = false;
            continue;
        }

        if (blockComment) {
            if (char === "*" && next === "/") {
                blockComment = false;
                index += 1;
            }
            continue;
        }

        if (quote) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (char === "\\") {
                escaped = true;
                continue;
            }
            if (char === quote) quote = null;
            continue;
        }

        if (char === "/" && next === "/") {
            lineComment = true;
            index += 1;
            continue;
        }
        if (char === "/" && next === "*") {
            blockComment = true;
            index += 1;
            continue;
        }
        if (char === "'" || char === '"' || char === "`") {
            quote = char;
            continue;
        }

        if (char === "{") depth += 1;
        if (char === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(start, index + 1);
        }
    }

    throw new Error(`Could not determine end of ${name}`);
}

const schemaStart = source.indexOf('const SCHEMA_VERSION_MAIN = "1.0.0";');
const schemaEnd = source.indexOf("function applySchemaMigrationsToLocalStorage()", schemaStart);
assert.notStrictEqual(schemaStart, -1, "Could not find schema migration definitions");
assert.notStrictEqual(schemaEnd, -1, "Could not find schema migration boundary");

const backupSettingsStart = source.indexOf('const AUTO_BACKUP_SETTINGS_KEY = "autoBackupSettingsV1";');
const backupSettingsEnd = source.indexOf("function saveAutoBackupSettings(", backupSettingsStart);
assert.notStrictEqual(backupSettingsStart, -1, "Could not find backup settings definitions");
assert.notStrictEqual(backupSettingsEnd, -1, "Could not find backup settings boundary");

const defaultAccent = source.match(/const DEFAULT_ACCENT = ("[^"]*");/);
assert(defaultAccent, "Could not find DEFAULT_ACCENT");

const values = new Map();
const sandbox = {
    DEFAULT_ACCENT: JSON.parse(defaultAccent[1]),
    localStorage: {
        getItem(key) {
            return values.has(key) ? values.get(key) : null;
        },
        setItem(key, value) {
            values.set(key, String(value));
        }
    }
};

vm.createContext(sandbox);
vm.runInContext(source.slice(schemaStart, schemaEnd), sandbox);
vm.runInContext(source.slice(backupSettingsStart, backupSettingsEnd), sandbox);
vm.runInContext([
    extractFunction("getExpenses"),
    extractFunction("getBudgets"),
    extractFunction("normalizeBudgetsSchema"),
    extractFunction("getSavings"),
    extractFunction("getFullAppData")
].join("\n"), sandbox);

function store(key, value) {
    values.set(key, JSON.stringify(value));
}

const firstPeriodKey = "2026-01-01_to_2026-01-07";
const secondPeriodKey = "2026-01-08_to_2026-01-15";

store("bp", [
    { id: 301, start: "2026-01-01", end: "2026-01-07", status: "closed", extraDays: 0 },
    { id: 302, start: "2026-01-08", end: "2026-01-15", status: "closed", extraDays: 0 }
]);
store("budgets", [
    {
        id: 401,
        type: "budget",
        budgetId: "wallet-period-one",
        entity: "Budget Wallet",
        isBudgetWallet: true,
        periodKey: firstPeriodKey,
        totalAllocated: 1200,
        monthKey: null
    },
    {
        id: 402,
        type: "budget",
        budgetId: "wallet-period-two",
        entity: "Budget Wallet",
        isBudgetWallet: true,
        periodKey: secondPeriodKey,
        totalAllocated: 1800,
        monthKey: null
    }
]);
store("expenses", [
    { id: "expense-one-a", type: "expense", amount: -125, budgetId: "wallet-period-one", periodKey: firstPeriodKey, paymentType: "UPI" },
    { id: "expense-one-b", type: "expense", amount: -75, budgetId: "wallet-period-one", periodKey: firstPeriodKey, paymentType: "Cash" },
    { id: "expense-two-a", type: "expense", amount: -220, budgetId: "wallet-period-two", periodKey: secondPeriodKey, paymentType: "Card" }
]);
store("savingsTransactions", [
    { id: "savings-source-one", type: "deposit", amount: 1500, paymentType: "Bank" },
    { id: "savings-allocation-one", type: "budget_allocation", amount: -300, budgetWalletId: "wallet-period-one", targetBudgetId: "wallet-period-one" },
    { id: "savings-source-two", type: "deposit", amount: 2000, paymentType: "Bank" },
    { id: "savings-allocation-two", type: "budget_allocation", amount: -450, budgetWalletId: "wallet-period-two", targetBudgetId: "wallet-period-two" }
]);
store("unassignedTopups", [
    { id: "topup-one", amount: 80, periodKey: firstPeriodKey, budgetWalletId: "wallet-period-one", status: "unassigned" },
    { id: "topup-two", amount: 140, periodKey: secondPeriodKey, budgetWalletId: "wallet-period-two", status: "unassigned" }
]);
store("orders", []);
store("categories", ["Food", "Travel"]);
store("persons", []);
store("quotationData", null);
store("quotationItems", []);
store("quotationCharges", []);
store("quotationRegistry", []);
store("quotationMeta", null);
store("activeQuotationId", null);
store("documentRelations", []);
store("noSeriesConfig", null);

const exportedJson = JSON.stringify(sandbox.getFullAppData(), null, 2);
const exported = JSON.parse(exportedJson);
const exportedWallets = exported.budgets.filter(wallet => wallet.isBudgetWallet === true);
const walletByCanonicalId = new Map(exportedWallets.map(wallet => [String(wallet.budgetId), wallet]));
const periodKeys = new Set(exported.budgetPeriods.map(period => `${period.start}_to_${period.end}`));

function assertUnique(values, label) {
    assert.strictEqual(new Set(values.map(String)).size, values.length, `${label} must be unique`);
}

assert.strictEqual(exported.meta.version, "2.0.0");
assert.strictEqual(exported.budgetPeriods.length, 2, "Export must preserve both budget periods");
assert.deepStrictEqual([...periodKeys].sort(), [firstPeriodKey, secondPeriodKey].sort());
assert(exported.budgetPeriods.every(period => "start" in period && "end" in period));
assert(exported.budgetPeriods.every(period => !("startDate" in period)));
assert(exported.budgets.every(wallet => !("budgetPeriodID" in wallet)));
assertUnique(exported.budgetPeriods.map(period => period.id), "Budget period IDs");
assertUnique(exported.budgets.map(budget => budget.id), "Budget row IDs");
assertUnique(exportedWallets.map(wallet => wallet.budgetId), "Budget wallet IDs");
assertUnique(exported.expenses.map(expense => expense.id), "Expense IDs");
assertUnique(exported.savings.map(saving => saving.id), "Savings transaction IDs");
assertUnique(exported.unassignedTopups.map(topup => topup.id), "Top-up IDs");

for (const wallet of exportedWallets) {
    assert(periodKeys.has(String(wallet.periodKey)), `Wallet ${wallet.budgetId} must resolve to an exported period`);
    assert.notStrictEqual(String(wallet.id), String(wallet.budgetId), "Wallet row ID and wallet key are distinct");
}

for (const expense of exported.expenses) {
    if (!expense.budgetId) continue;
    assert(!("budgetWalletId" in expense), "Expense wallet reference uses the Web budgetId field");
    assert(walletByCanonicalId.has(String(expense.budgetId)), `Expense ${expense.id} must resolve through budgetId`);
    assert.strictEqual(expense.linkedBudgetId, expense.budgetId, "V2 migration must preserve the existing expense alias");
    if (expense.periodKey) assert(periodKeys.has(String(expense.periodKey)), `Expense ${expense.id} periodKey must resolve`);
}

for (const saving of exported.savings) {
    for (const reference of [saving.budgetWalletId, saving.targetBudgetId]) {
        if (reference) assert(walletByCanonicalId.has(String(reference)), `Savings ${saving.id} wallet reference must resolve`);
    }
}

for (const topup of exported.unassignedTopups) {
    assert(walletByCanonicalId.has(String(topup.budgetWalletId)), `Top-up ${topup.id} must resolve to a wallet`);
    assert(periodKeys.has(String(topup.periodKey)), `Top-up ${topup.id} periodKey must resolve`);
}

console.log("ExportEngine relationship test passed");
console.log(`V2 ${exported.meta.version}: ${exported.budgetPeriods.length} periods, ${exportedWallets.length} wallets, ${exported.expenses.length} expenses, ${exported.savings.length} savings, ${exported.unassignedTopups.length} top-ups`);
