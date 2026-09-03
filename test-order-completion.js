const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

function extractFunction(source, name) {
    const start = source.indexOf(`function ${name}`);
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
    throw new Error(`Could not close ${name}`);
}

const source = fs.readFileSync('assets/scripts/order.js', 'utf8');
const context = {
    createOrderId: (() => {
        let nextId = 0;
        return () => `test_${++nextId}`;
    })()
};
vm.createContext(context);
vm.runInContext(`${extractFunction(source, 'createOrderFinancialEntries')}`, context);

const details = {
    sourceId: 'budget-1',
    sourceName: 'Main Budget',
    sourceType: 'budget',
    paymentType: 'Card',
    date: '2026-09-03T12:00:00.000Z'
};

const multiItem = context.createOrderFinancialEntries({
    id: 'order-multi',
    subtotal: 175,
    total: 175,
    items: [
        { id: 'a', name: 'Item A', category: 'Office', total: 100, qty: 1 },
        { id: 'b', name: 'Item B', category: 'Office', total: 50, qty: 1 },
        { id: 'c', name: 'Item C', category: 'Travel', total: 25, qty: 1 }
    ]
}, details);
assert.deepStrictEqual(Array.from(multiItem.expenses, entry => entry.amount), [-100, -50, -25]);
assert.deepStrictEqual(Array.from(multiItem.expenses, entry => entry.orderItemId), ['a', 'b', 'c']);
assert.deepStrictEqual(Array.from(multiItem.expenses, entry => entry.budgetId), ['budget-1', 'budget-1', 'budget-1']);
assert.strictEqual(multiItem.expenses.reduce((sum, entry) => sum + Math.abs(entry.amount), 0), 175);
assert.strictEqual(multiItem.savings.length, 0);

const singleItem = context.createOrderFinancialEntries({
    id: 'order-single',
    subtotal: 100,
    total: 100,
    items: [{ id: 'only', name: 'Only Item', total: 100, qty: 1 }]
}, { ...details, sourceType: 'savings' });
assert.strictEqual(singleItem.expenses.length, 1);
assert.strictEqual(singleItem.savings.length, 1);
assert.strictEqual(singleItem.expenses[0].amount, -100);
assert.strictEqual(singleItem.savings[0].amount, -100);
assert.strictEqual(singleItem.expenses[0].orderItemId, 'only');

const withCharge = context.createOrderFinancialEntries({
    id: 'order-charge',
    subtotal: 175,
    total: 185,
    items: [{ id: 'a', name: 'Item A', total: 100 }, { id: 'b', name: 'Item B', total: 75 }]
}, details);
assert.deepStrictEqual(Array.from(withCharge.expenses, entry => entry.amount), [-100, -75, -10]);
assert.strictEqual(withCharge.expenses.reduce((sum, entry) => sum + entry.amount, 0), -185);

console.log('Order completion item scenarios passed');
