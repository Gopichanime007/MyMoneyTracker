/**
 * Financial integrity and history lifecycle tests
 */

beforeAll(() => {
    jest.resetModules();
    require('../assets/scripts/script.js');
    require('../assets/scripts/savings.js');
});

beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <div id="historyList"></div>
      <div id="savingsHistory"></div>
      <input id="amount" />
      <input id="purpose" />
      <input id="expenseDate" />
      <select id="linkedTransactionSelect"></select>
      <select id="refundResolutionType"><option value="partial_refund">partial</option></select>
      <small id="linkedRemainingText"></small>
      <input id="expenseAttachment" type="file" />
      <img id="expenseAttachmentPreview" src="x" />
      <div id="expenseAttachmentPreviewWrapper" style="display:block"></div>
      <button id="expenseAttachmentRemove" style="display:inline"></button>
      <select id="entryType"><option value="expense">expense</option></select>
      <div id="categoryWrapper"></div>
      <div id="budgetWrapper"></div>
      <div id="linkedTransactionWrapper"></div>
      <div id="paymentWrapper"></div>
      <select id="category"><option value="Food">Food</option></select>
      <select id="budgetSelect"><option value="b1">b1</option></select>
      <select id="paymentType"><option value="Cash">Cash</option></select>

      <input id="sAmount" />
      <input id="sNote" />
      <input id="sDate" />
      <select id="sourceSelect"></select>
      <select id="refundSelect"></select>
      <select id="sRefundResolutionType"><option value="partial_refund">partial</option></select>
      <small id="sRefundInfo"></small>
      <input id="sAttachment" type="file" />
      <img id="sAttachmentPreview" src="x" />
      <div id="sAttachmentPreviewWrapper" style="display:block"></div>
      <button id="sAttachmentRemove" style="display:inline"></button>
      <select id="sType"><option value="deposit">deposit</option></select>
      <div id="sourceWrapper"></div>
      <div id="refundWrapper"></div>
    `;
});

function localDateKey(date) {
    const d = new Date(date);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

test('ledger rebalance persists before/after and running balance sequence', () => {
    localStorage.setItem('budgets', JSON.stringify([
        { budgetId: 'b1', totalAllocated: 5000, periodKey: '2026-06-03_to_2026-07-02' }
    ]));

    window.saveExpenses([
        { id: 'a', type: 'expense', amount: -500, date: '2026-06-04T10:44:05.936Z', monthKey: '2026-06', budgetId: 'b1' },
        { id: 'b', type: 'refund', amount: 500, date: '2026-06-04T11:10:54.597Z', monthKey: '2026-06', budgetId: 'b1' }
    ]);

    const stored = window.getExpenses().sort((x, y) => new Date(x.date) - new Date(y.date));
    expect(stored[0].BalanceBeforeTransaction).toBe(5000);
    expect(stored[0].BalanceAfterTransaction).toBe(4500);
    expect(stored[1].BalanceBeforeTransaction).toBe(4500);
    expect(stored[1].BalanceAfterTransaction).toBe(5000);
});

test('expense resolution snapshot supports partial and multiple refunds', () => {
    const rootId = 'root-exp';
    localStorage.setItem('expenses', JSON.stringify([
        { id: rootId, type: 'expense', amount: -6000, date: '2026-06-04T10:00:00Z', budgetId: 'b1' },
        { id: 'r1', type: 'refund', amount: 3000, linkedTransactionId: rootId, date: '2026-06-04T11:00:00Z', budgetId: 'b1' },
        { id: 'r2', type: 'refund', amount: 2000, linkedTransactionId: rootId, date: '2026-06-04T12:00:00Z', budgetId: 'b1' }
    ]));

    const snap = window.getExpenseResolutionSnapshot(rootId);
    expect(snap.exists).toBeTruthy();
    expect(snap.refunded).toBe(5000);
    expect(snap.remainingRefundable).toBe(1000);
    expect(snap.status).toBe('PARTIALLY_REFUNDED');
});

test('history renders all original and refund transactions (no replacement)', () => {
    localStorage.setItem('budgets', JSON.stringify([
        { budgetId: 'b1', totalAllocated: 5000, periodKey: '2026-06-03_to_2026-07-02' }
    ]));
    localStorage.setItem('expenses', JSON.stringify([
        { id: 't1', type: 'expense', amount: -500, date: '2026-06-04T10:00:00Z', budgetId: 'b1', category: 'Food', purpose: 'A' },
        { id: 't2', type: 'transfer', amount: -500, date: '2026-06-04T11:00:00Z', budgetId: 'b1', category: 'Transfer', purpose: 'B' },
        { id: 't3', type: 'refund', amount: 500, linkedTransactionId: 't2', date: '2026-06-04T12:00:00Z', budgetId: 'b1', category: 'Refund', purpose: 'C' }
    ]));

    window.loadHistory(window.getExpenses());
    const cards = Array.from(document.querySelectorAll('#historyList .expense-item'));
    expect(cards.length).toBe(3);
    const text = cards.map(c => c.textContent || '').join(' | ');
    expect(text).toContain('Food');
    expect(text).toContain('Transfer');
    expect(text).toContain('Refund');
});

test('all filter does not exclude debit transactions', () => {
    const rows = [
        { id: 'd1', amount: -200, date: '2026-06-01T10:00:00Z' },
        { id: 'c1', amount: 100, date: '2026-06-01T11:00:00Z' },
        { id: 'd2', amount: -50, date: '2026-06-01T12:00:00Z' }
    ];
    const out = window.filterDataByType('all', rows);
    expect(out.length).toBe(3);
    expect(out.filter(x => x.amount < 0).length).toBe(2);
});

test('delete dependency guard blocks deleting root with linked refund', () => {
    const rootId = 'base-transfer';
    localStorage.setItem('expenses', JSON.stringify([
        { id: rootId, type: 'transfer', amount: -500, date: '2026-06-01T10:00:00Z', budgetId: 'b1' },
        { id: 'ref-1', type: 'refund', amount: 500, linkedTransactionId: rootId, date: '2026-06-01T11:00:00Z', budgetId: 'b1' }
    ]));

    const plan = window.validateDependencies(rootId, 'expense', 'safe');
    expect(plan.blocked).toBeTruthy();
    expect(Array.isArray(plan.childExpenses)).toBeTruthy();
    expect(plan.childExpenses.includes('ref-1')).toBeTruthy();
});

test('expense and savings form resets clear attachment preview state', () => {
    const expenseLabel = document.createElement('small');
    expenseLabel.className = 'attachment-preview-label';
    expenseLabel.textContent = 'Attached: receipt.pdf';
    document.getElementById('expenseAttachmentPreviewWrapper').appendChild(expenseLabel);

    window.__expenseAttachmentState = {
        status: 'linked',
        attachmentLabel: 'receipt.pdf',
        attachmentId: 'att-exp'
    };

    document.getElementById('expenseAttachmentPreview').dataset._previewUrl = 'blob:test-exp';
    window.resetForm();

    expect(document.getElementById('expenseAttachment').value).toBe('');
    expect(document.getElementById('expenseAttachmentPreview').getAttribute('src')).toBeNull();
    expect(document.getElementById('expenseAttachmentPreviewWrapper').style.display).toBe('none');
    expect(document.getElementById('expenseAttachmentRemove').style.display).toBe('none');
    expect(document.querySelector('#expenseAttachmentPreviewWrapper .attachment-preview-label').textContent).toBe('');
    expect(window.__expenseAttachmentState.status).toBe('none');
    expect(window.__expenseAttachmentState.attachmentId).toBeNull();

    const savingsLabel = document.createElement('small');
    savingsLabel.className = 'attachment-preview-label';
    savingsLabel.textContent = 'Attached: note.pdf';
    document.getElementById('sAttachmentPreviewWrapper').appendChild(savingsLabel);

    window.__savingsAttachmentState = {
        status: 'linked',
        attachmentLabel: 'note.pdf',
        attachmentId: 'att-sav'
    };

    document.getElementById('sAttachmentPreview').dataset._previewUrl = 'blob:test-sav';
    window.resetSavingsForm();

    expect(document.getElementById('sAttachment').value).toBe('');
    expect(document.getElementById('sAttachmentPreview').getAttribute('src')).toBeNull();
    expect(document.getElementById('sAttachmentPreviewWrapper').style.display).toBe('none');
    expect(document.getElementById('sAttachmentRemove').style.display).toBe('none');
    expect(document.querySelector('#sAttachmentPreviewWrapper .attachment-preview-label').textContent).toBe('');
    expect(window.__savingsAttachmentState.status).toBe('none');
    expect(window.__savingsAttachmentState.attachmentId).toBeNull();
});

test('savings history keeps transfer and refund visible together', () => {
    const tx = [
        { id: 's1', type: 'transfer', amount: -2000, date: '2026-06-04T10:00:00Z', note: 'Move', monthKey: '2026-06' },
        { id: 's2', type: 'refund', amount: 500, linkedTransactionId: 's1', date: '2026-06-04T11:00:00Z', note: 'Partial Refund', monthKey: '2026-06' }
    ];

    window.renderSavingsHistory(tx);
    const cards = Array.from(document.querySelectorAll('#savingsHistory .expense-item'));
    expect(cards.length).toBe(2);
    const text = cards.map(c => c.textContent || '').join(' | ');
    expect(text).toContain('Transfer');
    expect(text).toContain('Refund');
});

test('saveSavings persists before/after ledger balances', () => {
    window.saveSavings([
        { id: 's-a', type: 'deposit', amount: 5000, date: '2026-06-04T10:00:00Z', monthKey: '2026-06' },
        { id: 's-b', type: 'transfer', amount: -500, date: '2026-06-04T11:00:00Z', monthKey: '2026-06' },
        { id: 's-c', type: 'refund', amount: 500, date: '2026-06-04T12:00:00Z', monthKey: '2026-06' }
    ]);

    const rows = window.getSavings().slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(rows[0].BalanceBeforeTransaction).toBe(0);
    expect(rows[0].BalanceAfterTransaction).toBe(5000);
    expect(rows[1].BalanceBeforeTransaction).toBe(5000);
    expect(rows[1].BalanceAfterTransaction).toBe(4500);
    expect(rows[2].BalanceBeforeTransaction).toBe(4500);
    expect(rows[2].BalanceAfterTransaction).toBe(5000);
});

test('active period with past effective end is auto-closed', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yKey = yesterday.toISOString().split('T')[0];

    localStorage.setItem('bp', JSON.stringify([
        { id: 'p-expired', start: '2020-01-01', end: yKey, status: 'active', extraDays: 0 }
    ]));

    const active = window.getActiveBudgetPeriod();
    expect(active).toBeNull();

    const stored = JSON.parse(localStorage.getItem('bp')) || [];
    expect(stored[0].status).toBe('closed');
});

test('daily efficiency calculation uses daily allocation minus today spending', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([
        { id: 'p-day', start: startKey, end: endKey, status: 'active', extraDays: 0 }
    ]));

    window.saveBudgets([{ budgetId: 'b-day', totalAllocated: 3000, periodKey }]);
    window.saveExpenses([
        { id: 'd-1', type: 'expense', amount: -700, date: new Date().toISOString(), budgetId: 'b-day', periodKey }
    ]);

    const m = window.computeBudgetEfficiencyMetrics(new Date());
    expect(m.dailyLimit).toBeCloseTo(1000, 2);
    expect(m.todaySpent).toBeCloseTo(700, 2);
    expect(m.dailyRemaining).toBeCloseTo(300, 2);
});

test('weekly efficiency calculation uses weekly allocation minus week spending', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 13);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([
        { id: 'p-week', start: startKey, end: endKey, status: 'active', extraDays: 0 }
    ]));

    window.saveBudgets([{ budgetId: 'b-week', totalAllocated: 28000, periodKey }]);
    window.saveExpenses([
        { id: 'w-1', type: 'expense', amount: -5500, date: new Date().toISOString(), budgetId: 'b-week', periodKey }
    ]);

    const m = window.computeBudgetEfficiencyMetrics(new Date());
    expect(m.weeklyLimit).toBeCloseTo(7000, 2);
    expect(m.weekSpent).toBeCloseTo(5500, 2);
    expect(m.weeklyRemaining).toBeCloseTo(1500, 2);
});

test('monthly efficiency calculation uses monthly allocation minus month spending', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([
        { id: 'p-month', start: startKey, end: endKey, status: 'active', extraDays: 0 }
    ]));

    window.saveBudgets([{ budgetId: 'b-month', totalAllocated: 30000, periodKey }]);
    window.saveExpenses([
        { id: 'm-1', type: 'expense', amount: -12000, date: new Date().toISOString(), budgetId: 'b-month', periodKey }
    ]);

    const m = window.computeBudgetEfficiencyMetrics(new Date());
    expect(m.monthlyLimit).toBeCloseTo(30000, 2);
    expect(m.monthSpent).toBeCloseTo(12000, 2);
    expect(m.monthlyRemaining).toBeCloseTo(18000, 2);
});

test('refund increases efficiency remaining capacity', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'p-ref', start: startKey, end: endKey, status: 'active', extraDays: 0 }]));
    window.saveBudgets([{ budgetId: 'b-ref', totalAllocated: 10000, periodKey }]);
    window.saveExpenses([
        { id: 'r-1', type: 'expense', amount: -3000, date: new Date().toISOString(), budgetId: 'b-ref', periodKey },
        { id: 'r-2', type: 'refund', amount: 1000, date: new Date().toISOString(), budgetId: 'b-ref', periodKey, linkedTransactionId: 'r-1' }
    ]);

    const m = window.computeBudgetEfficiencyMetrics(new Date());
    expect(m.monthSpent).toBeCloseTo(2000, 2);
    expect(m.monthlyRemaining).toBeCloseTo(8000, 2);
});

test('transfer back decreases efficiency remaining capacity', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'p-tb', start: startKey, end: endKey, status: 'active', extraDays: 0 }]));
    window.saveBudgets([{ budgetId: 'b-tb', totalAllocated: 10000, periodKey }]);
    window.saveExpenses([
        { id: 'tb-1', type: 'transfer_back', amount: 1200, date: new Date().toISOString(), budgetId: 'b-tb', periodKey }
    ]);

    const m = window.computeBudgetEfficiencyMetrics(new Date());
    expect(m.monthSpent).toBeCloseTo(1200, 2);
    expect(m.monthlyRemaining).toBeCloseTo(8800, 2);
});

test('budget income increases efficiency remaining capacity', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'p-inc', start: startKey, end: endKey, status: 'active', extraDays: 0 }]));
    window.saveBudgets([{ budgetId: 'b-inc', totalAllocated: 10000, periodKey }]);
    window.saveExpenses([
        { id: 'i-1', type: 'expense', amount: -3000, date: new Date().toISOString(), budgetId: 'b-inc', periodKey },
        { id: 'i-2', type: 'income', amount: 500, date: new Date().toISOString(), budgetId: 'b-inc', periodKey }
    ]);

    const m = window.computeBudgetEfficiencyMetrics(new Date());
    expect(m.monthSpent).toBeCloseTo(2500, 2);
    expect(m.monthlyRemaining).toBeCloseTo(7500, 2);
});

test('daily average calculation for graph analytics', () => {
    const rows = [
        { date: '2026-06-01T10:00:00Z', amount: -500 },
        { date: '2026-06-01T11:00:00Z', amount: -500 },
        { date: '2026-06-02T09:00:00Z', amount: -1000 }
    ];
    const avg = window.calculateAverageSpendingByType('day', rows);
    expect(avg).toBeCloseTo(1000, 2);
});

test('weekly average calculation for graph analytics', () => {
    const rows = [
        { date: '2026-06-01T10:00:00Z', amount: -2000 },
        { date: '2026-06-03T10:00:00Z', amount: -3000 },
        { date: '2026-06-10T10:00:00Z', amount: -5000 }
    ];
    const avg = window.calculateAverageSpendingByType('week', rows);
    expect(avg).toBeCloseTo(5000, 2);
});

test('monthly average calculation for graph analytics', () => {
    const rows = [
        { date: '2026-04-01T10:00:00Z', amount: -20000 },
        { date: '2026-05-01T10:00:00Z', amount: -20000 },
        { date: '2026-06-01T10:00:00Z', amount: -20000 }
    ];
    const avg = window.calculateAverageSpendingByType('month', rows);
    expect(avg).toBeCloseTo(20000, 2);
});

test('custom average calculation for graph analytics', () => {
    const rows = [
        { date: '2026-06-01T10:00:00Z', amount: -1000 },
        { date: '2026-06-02T10:00:00Z', amount: -2000 },
        { date: '2026-06-03T10:00:00Z', amount: -2000 }
    ];
    const avg = window.calculateAverageSpendingByType('custom', rows, {
        start: '2026-06-01',
        end: '2026-06-10'
    });
    expect(avg).toBeCloseTo(500, 2);
});

test('graph summary shows average spend labels synchronized with filter type', () => {
    document.body.innerHTML += '<div id="graphDate"></div><div id="categoryBreakdown"></div>';

    const dataset = [
        { exp: 120, inc: 20 },
        { exp: 80, inc: 10 }
    ];

    const entries = [
        { date: '2026-06-01T10:00:00Z', amount: -120 },
        { date: '2026-06-08T10:00:00Z', amount: -80 }
    ];

    window.updateGraphSummary('week', dataset, entries, null);
    const summary = document.getElementById('graphDate').innerText;
    expect(summary).toContain('This Week');
    expect(summary).toContain('Avg Spend/week');
    expect(summary).toContain('Spent');
});

test('business flow reconciles savings, budget spend, and refund reporting', () => {
    document.body.innerHTML += `
      <div id="historyList"></div>
      <h4 id="savedToday">₹0</h4>
      <h4 id="savedWeek">₹0</h4>
      <h4 id="savedPeriod">₹0</h4>
    `;

    const start = new Date();
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const startKey = start.toISOString().split('T')[0];
    const endKey = end.toISOString().split('T')[0];
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([
        { id: 'period-main', start: startKey, end: endKey, status: 'active', extraDays: 0 }
    ]));

    window.saveSavings([
        { id: 's1', type: 'deposit', amount: 10000, date: new Date().toISOString(), note: 'Salary' },
        { id: 's2', type: 'transfer', amount: -5000, date: new Date().toISOString(), note: 'Move to Budget' },
        { id: 's3', type: 'refund', amount: 1000, date: new Date().toISOString(), note: 'Transfer Back' }
    ]);

    window.saveBudgets([
        { budgetId: 'b1', totalAllocated: 5000, periodKey }
    ]);

    window.saveExpenses([
        { id: 'x1', type: 'expense', amount: -1200, date: new Date().toISOString(), budgetId: 'b1', periodKey, category: 'Food', purpose: 'Groceries' },
        { id: 'x2', type: 'refund', amount: 200, date: new Date().toISOString(), linkedTransactionId: 'x1', budgetId: 'b1', periodKey, category: 'Refund', purpose: 'Return' }
    ]);

    window.loadHistory(window.getExpenses());
    window.updateBudgetEfficiency();

    const parseCurrency = (txt) => Number(String(txt || '').replace(/[^0-9.-]/g, ''));

    const remainingPeriod = parseCurrency(document.getElementById('savedPeriod').innerText);
    expect(remainingPeriod).toBeCloseTo(4000, 2);

    const savings = window.getSavings().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(savings[savings.length - 1].BalanceAfterTransaction).toBe(6000);

    const cards = Array.from(document.querySelectorAll('#historyList .expense-item'));
    expect(cards.length).toBe(2);
});

test('Add Expense budget dropdown shows budget entries regardless of budget period status', () => {
    const budgets = [
        { budgetId: 'b-active', totalAllocated: 3000, entity: 'Wallet A', periodKey: '2026-06-01_to_2026-06-30' },
        { budgetId: 'b-closed', totalAllocated: 2000, entity: 'Wallet B', periodKey: '2026-05-01_to_2026-05-31' },
        { budgetId: 'b-archived', totalAllocated: 1000, entity: 'Wallet C', monthKey: '2026-04' }
    ];

    const scenarios = [
        [{ id: 'p1', start: '2026-06-01', end: '2026-06-30', status: 'active', extraDays: 0 }],
        [{ id: 'p2', start: '2026-06-01', end: '2026-06-30', status: 'inactive', extraDays: 0 }],
        [{ id: 'p3', start: '2026-06-01', end: '2026-06-30', status: 'completed', extraDays: 0 }],
        [{ id: 'p4', start: '2026-06-01', end: '2026-06-30', status: 'archived', extraDays: 0 }],
        []
    ];

    scenarios.forEach((periods) => {
        localStorage.setItem('bp', JSON.stringify(periods));
        window.saveBudgets(budgets);
        window.saveExpenses([]);

        window.loadBudgetOptions();

        const options = Array.from(document.querySelectorAll('#budgetSelect option'));
        expect(options.length).toBe(3);
        expect(options.some(o => o.value === 'b-active')).toBeTruthy();
        expect(options.some(o => o.value === 'b-closed')).toBeTruthy();
        expect(options.some(o => o.value === 'b-archived')).toBeTruthy();
        expect(options.some(o => String(o.textContent || '').toLowerCase().includes('no budgets available'))).toBeFalsy();
    });
});

test('Add Expense budget dropdown auto-selects budget matching expense date without filtering choices', () => {
    window.saveBudgets([
        { budgetId: 'b-jun', totalAllocated: 3000, entity: 'June Wallet', periodKey: '2026-06-01_to_2026-06-30' },
        { budgetId: 'b-jul', totalAllocated: 2000, entity: 'July Wallet', periodKey: '2026-07-01_to_2026-07-31' },
        { budgetId: 'b-legacy', totalAllocated: 1000, entity: 'Legacy Wallet', monthKey: '2026-05' }
    ]);
    window.saveExpenses([]);

    document.getElementById('entryType').value = 'expense';
    document.getElementById('expenseDate').value = '2026-06-15';

    window.loadBudgetOptions();

    const select = document.getElementById('budgetSelect');
    const options = Array.from(select.querySelectorAll('option')).map(o => String(o.value));

    expect(options).toEqual(expect.arrayContaining(['b-jun', 'b-jul', 'b-legacy']));
    expect(String(select.value)).toBe('b-jun');
});

test('Add Expense budget suggestion updates with date until user manually selects budget', () => {
    window.saveBudgets([
        { budgetId: 'b-jun', totalAllocated: 3000, entity: 'June Wallet', periodKey: '2026-06-01_to_2026-06-30' },
        { budgetId: 'b-jul', totalAllocated: 2000, entity: 'July Wallet', periodKey: '2026-07-01_to_2026-07-31' }
    ]);
    window.saveExpenses([]);

    document.getElementById('entryType').value = 'expense';
    document.getElementById('expenseDate').value = '2026-06-15';

    window.resetExpenseBudgetSelectionState();
    window.loadBudgetOptions();

    const select = document.getElementById('budgetSelect');
    expect(String(select.value)).toBe('b-jun');

    document.getElementById('expenseDate').value = '2026-07-15';
    window.autoSelectExpenseBudget({ respectManual: true });
    expect(String(select.value)).toBe('b-jul');

    select.value = 'b-jun';
    window.markExpenseBudgetManuallySelected();

    document.getElementById('expenseDate').value = '2026-07-20';
    window.autoSelectExpenseBudget({ respectManual: true });
    expect(String(select.value)).toBe('b-jun');
});

test('Add Expense save works even when no active budget period exists', async () => {
    localStorage.setItem('bp', JSON.stringify([
        { id: 'p-none', start: '2026-06-01', end: '2026-06-30', status: 'archived', extraDays: 0 }
    ]));

    window.saveBudgets([
        { budgetId: 'b1', totalAllocated: 5000, entity: 'Wallet X', periodKey: '2026-06-01_to_2026-06-30' }
    ]);
    window.saveExpenses([]);

    document.getElementById('entryType').value = 'expense';
    document.getElementById('amount').value = '600';
    document.getElementById('category').value = 'Food';
    document.getElementById('purpose').value = 'Snacks';
    document.getElementById('paymentType').value = 'Cash';
    document.getElementById('expenseDate').value = '2026-06-10';

    window.loadBudgetOptions();
    document.getElementById('budgetSelect').value = 'b1';

    window.showToast = jest.fn();
    window.storeAttachmentWithStatus = jest.fn(async () => ({ attachmentId: null, status: 'none', error: null }));

    await window.handleAddExpense();

    const expenses = window.getExpenses();
    expect(expenses.length).toBe(1);
    expect(expenses[0].type).toBe('expense');
    expect(String(expenses[0].budgetId)).toBe('b1');
    expect(window.showToast).not.toHaveBeenCalledWith('No active budget period');
    expect(window.showToast).not.toHaveBeenCalledWith('No budgets available');
});
