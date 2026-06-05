/**
 * Real user workflow simulation for end-to-end financial journeys.
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
      <div id="graphDate"></div>
      <div id="categoryBreakdown"></div>
      <div id="budgetValue"></div>
      <div id="spent"></div>
      <div id="remaining"></div>
      <div id="todaySpent"></div>
      <div id="incomeValue"></div>
      <div id="netValue"></div>
      <div id="progressFill"></div>
      <div id="progressText"></div>
      <h4 id="savedToday">0</h4>
      <h4 id="savedWeek">0</h4>
      <h4 id="savedPeriod">0</h4>
      <input id="expenseAttachment" type="file" />
      <img id="expenseAttachmentPreview" src="x" />
      <div id="expenseAttachmentPreviewWrapper" style="display:block"></div>
      <button id="expenseAttachmentRemove" style="display:inline"></button>
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

    window.open = jest.fn();
        if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => 'blob:test');
        if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();
});

function localDateKey(date) {
    const d = new Date(date);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

function parseCurrency(text) {
    return Number(String(text || '').replace(/[^0-9.-]/g, ''));
}

test('Scenario 1: monthly salary cycle end-to-end simulation', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodKey = `${localDateKey(start)}_to_${localDateKey(end)}`;

    // 1) Create budget period
    localStorage.setItem('bp', JSON.stringify([{ id: 'p-salary', start: localDateKey(start), end: localDateKey(end), status: 'active', extraDays: 0 }]));
    expect(window.getActiveBudgetPeriod()).toBeTruthy();

    // 2 + 3) Create savings source and deposit salary
    window.saveSavings([
        { id: 'src-salary', type: 'deposit', amount: 50000, note: 'Salary Account', date: '2026-06-01T09:00:00Z' }
    ]);
    expect(window.getSavings()[0].BalanceAfterTransaction).toBe(50000);

    // 4) Move funds to budget
    window.saveBudgets([{ budgetId: 'b-salary', totalAllocated: 30000, periodKey }]);
    window.saveSavings([
        ...window.getSavings(),
        { id: 'alloc-1', type: 'budget_allocation', amount: -30000, sourceId: 'src-salary', targetBudgetId: 'b-salary', date: '2026-06-01T10:00:00Z' }
    ]);
    expect(window.getSavings().slice(-1)[0].BalanceAfterTransaction).toBe(20000);

    // 5) Record expenses
    window.saveExpenses([
        { id: 'exp-1', type: 'expense', amount: -5000, budgetId: 'b-salary', periodKey, category: 'Food', purpose: 'Groceries', date: '2026-06-02T11:00:00Z' },
        { id: 'exp-2', type: 'expense', amount: -2000, budgetId: 'b-salary', periodKey, category: 'Fuel', purpose: 'Travel', date: '2026-06-03T11:00:00Z' }
    ]);

    // 6) Create refund
    window.saveExpenses([
        ...window.getExpenses(),
        { id: 'ref-1', type: 'refund', amount: 1000, linkedTransactionId: 'exp-1', budgetId: 'b-salary', periodKey, category: 'Refund', purpose: 'Return', date: '2026-06-04T11:00:00Z' }
    ]);

    // 7) Create transfer back
    window.saveExpenses([
        ...window.getExpenses(),
        { id: 'tb-1', type: 'transfer_back', amount: -500, budgetId: 'b-salary', periodKey, category: 'Transfer Back', purpose: 'Move back', date: '2026-06-05T11:00:00Z' }
    ]);
    window.saveSavings([
        ...window.getSavings(),
        { id: 'sav-ref-1', type: 'refund', amount: 500, sourceId: 'src-salary', linkedTransactionId: 'tb-1', date: '2026-06-05T11:01:00Z' }
    ]);

    const savings = window.getSavings().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(savings[savings.length - 1].BalanceAfterTransaction).toBe(20500);

    const expenses = window.getExpenses().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(expenses[0].BalanceBeforeTransaction).toBe(30000);
    expect(expenses[expenses.length - 1].BalanceAfterTransaction).toBe(23500);

    window.loadDashboard();
    window.loadHistory(expenses);
    window.loadGraph('month', expenses);

    expect(parseCurrency(document.getElementById('budgetValue').innerText)).toBeCloseTo(30000, 2);
    expect(document.querySelectorAll('#historyList .expense-item').length).toBe(4);
    expect(document.getElementById('graphDate').innerText).toContain('This Period');
});

test('Scenario 2: budget period extension keeps active validity and avoids duplicate active periods', () => {
    localStorage.setItem('bp', JSON.stringify([
        { id: 'p-ext', start: '2026-06-01', end: '2026-06-30', status: 'active', extraDays: 7 },
        { id: 'p-old', start: '2026-05-01', end: '2026-05-31', status: 'closed', extraDays: 0 }
    ]));

    const normalized = window.normalizeBudgetPeriods(JSON.parse(localStorage.getItem('bp')), new Date('2026-07-03T10:00:00Z'));
    const activeList = normalized.periods.filter(p => p.status === 'active');

    expect(activeList.length).toBe(1);
    expect(activeList[0].id).toBe('p-ext');

    const effectiveEnd = window.getBudgetPeriodEffectiveEndDate(activeList[0], new Date('2026-07-03T10:00:00Z'));
    expect(localDateKey(effectiveEnd)).toBe('2026-07-07');
});

test('Scenario 3: refund lifecycle transitions partial to full with reconciliation', () => {
    window.saveBudgets([{ budgetId: 'b-rf', totalAllocated: 8000, periodKey: '2026-06-01_to_2026-06-30' }]);

    window.saveExpenses([
        { id: 'rf-exp', type: 'expense', amount: -6000, budgetId: 'b-rf', periodKey: '2026-06-01_to_2026-06-30', date: '2026-06-02T10:00:00Z', category: 'Purchase', purpose: 'Order' },
        { id: 'rf-1', type: 'refund', amount: 5000, linkedTransactionId: 'rf-exp', budgetId: 'b-rf', periodKey: '2026-06-01_to_2026-06-30', date: '2026-06-03T10:00:00Z', category: 'Refund', purpose: 'Partial' }
    ]);

    let snap = window.getExpenseResolutionSnapshot('rf-exp');
    expect(snap.remainingRefundable).toBe(1000);

    window.loadHistory(window.getExpenses());
    expect(document.querySelectorAll('#historyList .expense-item').length).toBe(2);

    window.saveExpenses([
        ...window.getExpenses(),
        { id: 'rf-2', type: 'refund', amount: 1000, linkedTransactionId: 'rf-exp', budgetId: 'b-rf', periodKey: '2026-06-01_to_2026-06-30', date: '2026-06-04T10:00:00Z', category: 'Refund', purpose: 'Final' }
    ]);

    snap = window.getExpenseResolutionSnapshot('rf-exp');
    expect(snap.remainingRefundable).toBe(0);
    expect(snap.status).toBe('FULLY_REFUNDED');

    const rows = window.getExpenses().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(rows[rows.length - 1].BalanceAfterTransaction).toBe(8000);

    window.loadDashboard();
    window.loadGraph('month', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Avg Spend/month');
});

test('Scenario 4: attachment lifecycle simulation for index and savings with reload isolation', async () => {
    const removed = [];
    window.reMoAttachments = {
        storeImage: jest.fn(async (_id, file) => ({ id: `att-${file.name}` })),
        getImageUrl: jest.fn(async id => `blob:${id}`),
        getBlob: jest.fn(async () => new Blob(['demo'], { type: 'text/plain' })),
        remove: jest.fn(async id => removed.push(id)),
        getRecord: jest.fn(async id => ({ filename: `${id}.txt`, mime: 'text/plain', createdAt: Date.now() }))
    };

    const expFile = new File(['exp'], 'exp.txt', { type: 'text/plain' });
    const savFile = new File(['sav'], 'sav.txt', { type: 'text/plain' });

    Object.defineProperty(document.getElementById('expenseAttachment'), 'files', { value: [expFile], configurable: true });
    Object.defineProperty(document.getElementById('sAttachment'), 'files', { value: [savFile], configurable: true });

    const expAttachmentId = await window.storeAttachmentFromInput('expenseAttachment');
    const savAttachmentId = await window.storeAttachmentFromInput('sAttachment');

    window.saveBudgets([{ budgetId: 'b-att', totalAllocated: 5000, periodKey: '2026-06-01_to_2026-06-30' }]);
    window.saveExpenses([{ id: 'ea1', type: 'expense', amount: -300, budgetId: 'b-att', date: '2026-06-02T10:00:00Z', attachmentId: expAttachmentId }]);
    window.saveSavings([{ id: 'sa1', type: 'deposit', amount: 1000, date: '2026-06-02T11:00:00Z', attachmentId: savAttachmentId }]);

    await window.openTransactionAuditDetails('expense', window.getExpenses()[0]);
    await window.viewAttachmentById(expAttachmentId);
    expect(document.getElementById('remo-attach-viewer')).toBeTruthy();

    await window.downloadAttachmentById(expAttachmentId, 'exp.txt');
    await window.deleteTransactionAttachment('expense', 'ea1', expAttachmentId);
    expect(window.getExpenses()[0].attachmentId).toBeNull();
    expect(window.getSavings()[0].attachmentId).toBe(savAttachmentId);

    await window.deleteTransactionAttachment('savings', 'sa1', savAttachmentId);
    expect(window.getSavings()[0].attachmentId).toBeNull();
    expect(removed).toEqual(expect.arrayContaining([expAttachmentId, savAttachmentId]));

    window.resetForm();
    window.resetSavingsForm();

    // Simulate application reload lifecycle setup.
    window.setupAttachmentInputs();

    expect(document.getElementById('expenseAttachmentPreviewWrapper').style.display).toBe('none');
    expect(document.getElementById('sAttachmentPreviewWrapper').style.display).toBe('none');
});

test('Scenario 5: budget efficiency validation for daily, weekly, monthly remaining capacities', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodKey = `${localDateKey(start)}_to_${localDateKey(end)}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'p-eff', start: localDateKey(start), end: localDateKey(end), status: 'active', extraDays: 0 }]));
    window.saveBudgets([{ budgetId: 'b-eff', totalAllocated: 30000, periodKey }]);

    window.saveExpenses([
        { id: 'be-1', type: 'expense', amount: -7000, budgetId: 'b-eff', periodKey, date: now.toISOString() },
        { id: 'be-2', type: 'refund', amount: 1000, budgetId: 'b-eff', periodKey, linkedTransactionId: 'be-1', date: now.toISOString() },
        { id: 'be-3', type: 'transfer_back', amount: -500, budgetId: 'b-eff', periodKey, date: now.toISOString() },
        { id: 'be-4', type: 'income', amount: 500, budgetId: 'b-eff', periodKey, date: now.toISOString() }
    ]);

    const metrics = window.computeBudgetEfficiencyMetrics(now);
    expect(metrics.monthlyRemaining).toBeCloseTo(24000, 2);

    window.updateBudgetEfficiency();

    expect(parseCurrency(document.getElementById('savedPeriod').innerText)).toBeCloseTo(24000, 2);
    expect(parseCurrency(document.getElementById('savedWeek').innerText)).toBeCloseTo(metrics.weeklyRemaining, 2);
    expect(parseCurrency(document.getElementById('savedToday').innerText)).toBeCloseTo(metrics.dailyRemaining, 2);
});

test('Scenario 6: graph analytics validation for day/week/month/custom average switching with tooltip/legend config', () => {
    const ChartStub = jest.fn(function (_ctx, cfg) {
        this.config = cfg;
        this.destroy = jest.fn();
        ChartStub.lastConfig = cfg;
        return this;
    });
    window.Chart = ChartStub;

    const canvas = document.createElement('canvas');
    canvas.id = 'myChart';
    document.body.appendChild(canvas);

    const rows = [
        { id: 'g1', amount: -1000, category: 'Food', date: '2026-06-01T10:00:00Z' },
        { id: 'g2', amount: -2000, category: 'Food', date: '2026-06-02T10:00:00Z' },
        { id: 'g3', amount: -3000, category: 'Bills', date: '2026-06-10T10:00:00Z' },
        { id: 'g4', amount: -4000, category: 'Travel', date: '2026-07-10T10:00:00Z' }
    ];

    window.loadGraph('day', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Avg Spend/day');

    window.loadGraph('week', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Avg Spend/week');

    window.loadGraph('month', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Avg Spend/month');

    window.loadGraph('custom', rows, { start: '2026-06-01', end: '2026-06-10' });
    expect(document.getElementById('graphDate').innerText).toContain('Custom Range');

    const options = ChartStub.lastConfig && ChartStub.lastConfig.options;
    expect(options).toBeTruthy();
    expect(options.plugins.tooltip).toBeTruthy();
    expect(options.plugins.legend).toBeTruthy();
});
