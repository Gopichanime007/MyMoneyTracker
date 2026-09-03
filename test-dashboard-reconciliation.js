const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}`);
    if (start < 0) throw new Error(`Missing function: ${name}`);
    const braceStart = source.indexOf('{', start);
    let depth = 0;
    let quote = null;
    let escaped = false;
    for (let index = braceStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'" || character === '`') {
            quote = character;
            continue;
        }
        if (character === '{') depth += 1;
        if (character === '}' && --depth === 0) return source.slice(start, index + 1);
    }
    throw new Error(`Could not close function: ${name}`);
}

function loadFunctions(filePath, names, context = {}) {
    const source = fs.readFileSync(filePath, 'utf8');
    const code = names.map(name => extractFunction(source, name)).join('\n');
    const sandbox = { ...context, console };
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);
    return sandbox;
}

const expense = loadFunctions('assets/scripts/script.js', [
    'roundCurrency',
    'isArchivedExpense',
    'isValidActiveExpense',
    'getActiveExpenseEntries',
    'getExpenseArchiveEntries',
    'isValidBudgetEntry',
    'getSelectableBudgetEntries',
    'getNetSpentForBudget',
    'getNetAdjustmentForBudget'
], { expenseArchiveFilter: 'active' });

const records = [
    { id: 'active-expense', type: 'expense', amount: -120, budgetId: 'budget-1', date: '2026-09-05' },
    { id: 'active-refund', type: 'refund', amount: 20, budgetId: 'budget-1', date: '2026-09-06' },
    { id: 'zero-entry', type: 'expense', amount: 0, budgetId: 'budget-1', date: '2026-09-07' },
    { id: 'archived-expense', type: 'expense', amount: -80, budgetId: 'budget-1', date: '2026-09-08', status: 'archived' },
    { id: 'archived-adjustment', type: 'adjustment', amount: 40, budgetId: 'budget-1', date: '2026-09-09', isArchived: true }
];

assert.deepStrictEqual(expense.getActiveExpenseEntries(records).map(row => row.id), ['active-expense', 'active-refund']);
assert.deepStrictEqual(expense.getExpenseArchiveEntries(records, 'archived').map(row => row.id), ['archived-expense', 'archived-adjustment']);
assert.strictEqual(expense.getNetSpentForBudget('budget-1', records), 100);
assert.strictEqual(expense.getNetAdjustmentForBudget('budget-1', records), 0);
assert.deepStrictEqual(expense.getSelectableBudgetEntries([
    { budgetId: 'budget-1', totalAllocated: 500 },
    { budgetId: 'zero-budget', totalAllocated: 0 },
    { budgetId: 'missing-amount' }
]).map(row => row.budgetId), ['budget-1']);

const savings = loadFunctions('assets/scripts/savings.js', [
    'isValidSavingsDashboardEntry',
    'getPeriodEntriesForSavingsDashboard'
]);
const periodRows = savings.getPeriodEntriesForSavingsDashboard([
    { id: 'inside', type: 'deposit', amount: 500, date: '2026-09-10' },
    { id: 'outside', type: 'deposit', amount: 700, date: '2026-08-10' },
    { id: 'zero', type: 'deposit', amount: 0, date: '2026-09-11' },
    { id: 'archived', type: 'deposit', amount: 900, date: '2026-09-12', status: 'archived' }
], { start: '2026-09-01', end: '2026-09-30' }, '2026-09-01_to_2026-09-30');
assert.deepStrictEqual(periodRows.map(row => row.id), ['inside']);

console.log('Dashboard reconciliation scenarios passed');
