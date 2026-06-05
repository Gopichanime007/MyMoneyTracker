/**
 * Basic unit tests for MoneyTracker core functions
 */

// Ensure jsdom environment

beforeAll(() => {
    jest.resetModules();
    require('../assets/scripts/script.js');
});

beforeEach(() => {
    localStorage.clear();
});

test('currency conversion roundtrip INR <-> USD', () => {
    expect(typeof window.convertFromBase).toBe('function');

    window.setCurrencyCode('INR');
    expect(window.convertFromBase(100)).toBeCloseTo(100);

    window.setCurrencyCode('USD');
    const usd = window.convertFromBase(100);
    expect(usd).toBeCloseTo(100 * 0.012);

    const back = window.convertToBase(usd);
    expect(back).toBeCloseTo(100);
});

test('formatCurrency uses selected symbol and 2 decimals', () => {
    window.setCurrencyCode('USD');
    const s = window.formatCurrency(123.456);
    expect(s.startsWith('$')).toBeTruthy();
    expect(s).toMatch(/\d+\.\d{2}$/);
});

test('calculateSpentForPeriod sums negative amounts in period', () => {
    const expenses = [
        { id: 'e1', amount: -50, date: '2026-06-01T10:00:00Z' },
        { id: 'e2', amount: -25.5, date: '2026-06-02T12:00:00Z' },
        { id: 'e3', amount: 100, date: '2026-06-03T09:00:00Z' }
    ];
    localStorage.setItem('expenses', JSON.stringify(expenses));

    const spent = window.calculateSpentForPeriod('2026-06-01', '2026-06-02');
    expect(spent).toBeCloseTo(75.5);
});

test('addExpense stores baseAmount (convertToBase) and preserves sign', () => {
    window.setCurrencyCode('INR');
    const entry = window.addExpense({ amount: -200, category: 'Test', date: '2026-06-04T12:00:00Z', type: 'expense' });
    expect(entry).not.toBeNull();
    const all = JSON.parse(localStorage.getItem('expenses')) || [];
    expect(all.some(e => e.id === entry.id)).toBeTruthy();
    expect(entry.amount).toBeLessThanOrEqual(0);
});
