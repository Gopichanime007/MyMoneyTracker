const { buildLedgerRows, calculateDailyDelta } = require('../assets/scripts/dailyBudgetLedger');

describe('daily budget ledger logic', () => {
  test('calculates running balance using savings and deficits', () => {
    const entries = [
      { date: '2026-06-29', note: 'Lunch', budget: 100, spent: 96 },
      { date: '2026-06-30', note: 'Groceries', budget: 100, spent: 36 },
      { date: '2026-07-01', note: 'Shopping', budget: 100, spent: 150 }
    ];

    const rows = buildLedgerRows(entries);
    const entryRows = rows.filter((row) => row.type === 'entry');

    expect(calculateDailyDelta(100, 96)).toBe(4);
    expect(calculateDailyDelta(100, 150)).toBe(-50);
    expect(entryRows[0].runningBalance).toBe(4);
    expect(entryRows[1].runningBalance).toBe(68);
    expect(entryRows[2].runningBalance).toBe(18);
  });

  test('inserts weekly and monthly summary rows in the right places', () => {
    const entries = [
      { date: '2026-06-29', note: 'Day 1', budget: 100, spent: 90 },
      { date: '2026-06-30', note: 'Day 2', budget: 100, spent: 80 },
      { date: '2026-07-01', note: 'Day 3', budget: 100, spent: 70 },
      { date: '2026-07-02', note: 'Day 4', budget: 100, spent: 60 },
      { date: '2026-07-03', note: 'Day 5', budget: 100, spent: 50 },
      { date: '2026-07-04', note: 'Day 6', budget: 100, spent: 40 },
      { date: '2026-07-05', note: 'Day 7', budget: 100, spent: 30 },
      { date: '2026-07-31', note: 'Month end', budget: 100, spent: 110 }
    ];

    const rows = buildLedgerRows(entries);

    const weekSummary = rows.find(row => row.type === 'summary' && row.kind === 'week');
    const monthSummary = rows.filter(row => row.type === 'summary' && row.kind === 'month').at(-1);

    expect(weekSummary).toBeDefined();
    expect(weekSummary.totalBudget).toBe(700);
    expect(weekSummary.totalSpent).toBe(420);
    expect(weekSummary.totalSavings).toBe(280);
    expect(weekSummary.totalDeficit).toBe(0);
    expect(weekSummary.closingRunningSavings).toBe(280);

    expect(monthSummary).toBeDefined();
    expect(monthSummary.kind).toBe('month');
    expect(monthSummary.totalBudget).toBe(600);
    expect(monthSummary.totalSpent).toBe(360);
    expect(monthSummary.totalSavings).toBe(250);
    expect(monthSummary.totalDeficit).toBe(10);
    expect(monthSummary.closingRunningSavings).toBe(270);
  });
});
