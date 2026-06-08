beforeAll(() => {
  jest.resetModules();
  require('../assets/scripts/script.js');
});

describe('Schema migration compatibility', () => {
  test('Main data to Development migrates aliases and applies defaults', () => {
    const mainPayload = {
      expenses: [
        {
          id: 'e-1',
          type: 'expense',
          amount: -500,
          budgetId: 'b-1',
          personId: 'p-1',
          date: '2026-06-01T10:00:00.000Z'
        }
      ],
      budgets: [
        {
          id: 'b-1',
          totalAllocated: 2000,
          periodKey: '2026-06-01_to_2026-06-30'
        }
      ],
      savings: [
        {
          id: 's-1',
          type: 'deposit',
          amount: 1000,
          personId: 'p-1'
        }
      ],
      meta: { version: 'v1' }
    };

    const migrated = window.migrateDataVersion(mainPayload, { direction: 'toDevelopment' }).data;

    expect(migrated.meta.version).toBe('2.0.0');
    expect(migrated.expenses[0].linkedPersonId).toBe('p-1');
    expect(migrated.expenses[0].linkedBudgetId).toBe('b-1');
    expect(migrated.savings[0].linkedPersonId).toBe('p-1');
    expect(Array.isArray(migrated.categories)).toBeTruthy();
    expect(Array.isArray(migrated.budgetPeriods)).toBeTruthy();
    expect(typeof migrated.settings).toBe('object');
    expect(typeof migrated.quotations).toBe('object');
  });

  test('Development data to Main keeps compatibility fields and downgrades version', () => {
    const developmentPayload = {
      expenses: [
        {
          id: 'e-2',
          type: 'expense',
          amount: -700,
          linkedPersonId: 'p-2',
          linkedBudgetId: 'b-2',
          budgetId: 'b-2'
        }
      ],
      budgets: [
        {
          budgetId: 'b-2',
          totalAllocated: 3000,
          id: 'legacy-b-2'
        }
      ],
      savings: [],
      budgetPeriods: [],
      categories: ['Food'],
      persons: ['p-2'],
      settings: {
        theme: 'blue',
        currencyCode: 'INR',
        autoBackupEnabled: true,
        autoBackupFrequency: 'weekly',
        autoBackupTarget: 'local_download'
      },
      orders: [],
      quotations: { quotationData: null, quotationItems: [], quotationCharges: [] },
      meta: { version: '2.0.0' }
    };

    const migrated = window.migrateDataVersion(developmentPayload, { direction: 'toMain' }).data;

    expect(migrated.meta.version).toBe('1.0.0');
    expect(migrated.expenses[0].personId).toBe('p-2');
    expect(migrated.expenses[0].budgetId).toBe('b-2');
    expect(migrated.budgets[0].id).toBeTruthy();
  });

  test('Legacy backup to current recovers safe defaults', () => {
    const legacy = {
      expenses: [],
      budgets: [],
      savings: [],
      settings: { theme: '' },
      meta: { version: '1.0.0' }
    };

    const migrated = window.migrateDataVersion(legacy, { direction: 'toDevelopment' }).data;

    expect(Array.isArray(migrated.categories)).toBeTruthy();
    expect(Array.isArray(migrated.persons)).toBeTruthy();
    expect(Array.isArray(migrated.budgetPeriods)).toBeTruthy();
    expect(migrated.settings.currencyCode).toBe('INR');
    expect(migrated.settings.autoBackupFrequency).toBe('weekly');
  });

  test('Export/import roundtrip keeps financial totals stable', () => {
    const source = {
      expenses: [
        { id: 'e-3', type: 'expense', amount: -400, budgetId: 'b-3' },
        { id: 'e-4', type: 'refund', amount: 100, budgetId: 'b-3' }
      ],
      budgets: [
        { id: 'b-3', budgetId: 'b-3', totalAllocated: 1000 }
      ],
      savings: [
        { id: 's-3', type: 'deposit', amount: 500 }
      ],
      budgetPeriods: [],
      categories: ['Food'],
      persons: ['Self'],
      settings: { theme: '', currencyCode: 'INR' },
      orders: [],
      quotations: { quotationData: null, quotationItems: [], quotationCharges: [] },
      meta: { version: '2.0.0' }
    };

    const toMain = window.migrateDataVersion(source, { direction: 'toMain' }).data;
    const backToDev = window.migrateDataVersion(toMain, { direction: 'toDevelopment' }).data;

    const srcExpenseTotal = source.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const roundTripExpenseTotal = backToDev.expenses.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const srcSavingsTotal = source.savings.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const roundTripSavingsTotal = backToDev.savings.reduce((sum, row) => sum + Number(row.amount || 0), 0);

    expect(roundTripExpenseTotal).toBe(srcExpenseTotal);
    expect(roundTripSavingsTotal).toBe(srcSavingsTotal);
    expect(backToDev.budgets[0].budgetId).toBe(source.budgets[0].budgetId);
  });
});
