/**
 * Risk-based hardening tests for financial workflows and lifecycle integrity.
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

      <h4 id="savedToday">0</h4>
      <h4 id="savedWeek">0</h4>
      <h4 id="savedPeriod">0</h4>
    `;

    window.open = jest.fn();
});

function localDateKey(date) {
    const d = new Date(date);
    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0')
    ].join('-');
}

test('budget refund, partial refunds, multiple refunds, income and transfer back reconcile net spent and running balances', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startKey = localDateKey(start);
    const endKey = localDateKey(end);
    const periodKey = `${startKey}_to_${endKey}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'p1', start: startKey, end: endKey, status: 'active', extraDays: 0 }]));
    window.saveBudgets([{ budgetId: 'b1', totalAllocated: 10000, periodKey }]);

    window.saveExpenses([
        { id: 'e1', type: 'expense', amount: -2000, budgetId: 'b1', periodKey, date: '2026-06-01T10:00:00Z' },
        { id: 'e2', type: 'refund', amount: 500, budgetId: 'b1', linkedTransactionId: 'e1', periodKey, date: '2026-06-01T11:00:00Z' },
        { id: 'e3', type: 'refund', amount: 300, budgetId: 'b1', linkedTransactionId: 'e1', periodKey, date: '2026-06-01T12:00:00Z' },
        { id: 'e4', type: 'transfer_back', amount: -200, budgetId: 'b1', periodKey, date: '2026-06-01T13:00:00Z' },
        { id: 'e5', type: 'income', amount: 100, budgetId: 'b1', periodKey, date: '2026-06-01T14:00:00Z' }
    ]);

    const rows = window.getExpenses().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(rows[0].BalanceBeforeTransaction).toBe(10000);
    expect(rows[0].BalanceAfterTransaction).toBe(8000);
    expect(rows[4].BalanceAfterTransaction).toBe(8700);

    const net = window.getNetSpentForBudget('b1', rows);
    expect(net).toBeCloseTo(1300, 2);
});

test('savings transfer and multiple refunds preserve history and running balance', () => {
    window.saveSavings([
        { id: 's1', type: 'deposit', amount: 10000, date: '2026-06-01T10:00:00Z' },
        { id: 's2', type: 'transfer', amount: -3000, sourceId: 's1', date: '2026-06-01T11:00:00Z' },
        { id: 's3', type: 'refund', amount: 1000, sourceId: 's1', linkedTransactionId: 's2', date: '2026-06-01T12:00:00Z' },
        { id: 's4', type: 'refund', amount: 500, sourceId: 's1', linkedTransactionId: 's2', date: '2026-06-01T13:00:00Z' }
    ]);

    const rows = window.getSavings().sort((a, b) => new Date(a.date) - new Date(b.date));
    expect(rows[0].BalanceAfterTransaction).toBe(10000);
    expect(rows[1].BalanceAfterTransaction).toBe(7000);
    expect(rows[3].BalanceAfterTransaction).toBe(8500);

    window.renderSavingsHistory(rows);
    const cards = Array.from(document.querySelectorAll('#savingsHistory .expense-item'));
    expect(cards.length).toBe(4);
});

test('move to budget and transfer back reconcile between savings and budget wallet', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodKey = `${localDateKey(start)}_to_${localDateKey(end)}`;

    window.saveBudgets([{ budgetId: 'bwb', totalAllocated: 3000, periodKey }]);
    window.saveSavings([
        { id: 'seed', type: 'deposit', amount: 10000, date: '2026-06-01T10:00:00Z' },
        { id: 'alloc', type: 'budget_allocation', amount: -3000, sourceId: 'seed', targetBudgetId: 'bwb', date: '2026-06-01T11:00:00Z' },
        { id: 'back', type: 'refund', amount: 1000, sourceId: 'seed', linkedTransactionId: 'tb1', date: '2026-06-01T12:00:00Z' }
    ]);

    window.saveExpenses([
        { id: 'tb1', type: 'transfer_back', amount: 1000, budgetId: 'bwb', periodKey, date: '2026-06-01T12:00:00Z' }
    ]);

    const lastSavings = window.getSavings().sort((a, b) => new Date(a.date) - new Date(b.date)).pop();
    expect(lastSavings.BalanceAfterTransaction).toBe(8000);

    const netBudgetSpent = window.getNetSpentForBudget('bwb', window.getExpenses());
    expect(netBudgetSpent).toBe(1000);
});

test('budget period planned end + explicit extension calculate effective end correctly', () => {
    const period = { start: '2026-06-01', end: '2026-06-30', extraDays: 5 };
    const effective = window.getBudgetPeriodEffectiveEndDate(period, new Date('2026-06-10T00:00:00Z'));
    expect(localDateKey(effective)).toBe('2026-07-05');
});

test('active budget selection logic prefers currently live latest-start period', () => {
    const periods = [
        { id: 'old', start: '2026-05-01', end: '2026-06-30', status: 'active', extraDays: 0 },
        { id: 'new', start: '2026-06-10', end: '2026-07-31', status: 'active', extraDays: 0 }
    ];

    const selected = window.selectActiveBudgetPeriod(periods, new Date('2026-06-15T10:00:00Z'));
    expect(selected.id).toBe('new');
});

test('normalize budget periods closes expired active periods and keeps valid active period', () => {
    const periods = [
        { id: 'expired', start: '2026-01-01', end: '2026-01-31', status: 'active', extraDays: 0 },
        { id: 'valid', start: '2026-06-01', end: '2026-06-30', status: 'active', extraDays: 5 }
    ];

    const out = window.normalizeBudgetPeriods(periods, new Date('2026-06-20T08:00:00Z'));
    const expired = out.periods.find(p => p.id === 'expired');
    const valid = out.periods.find(p => p.id === 'valid');

    expect(expired.status).toBe('closed');
    expect(valid.status).toBe('active');
});

test('budget efficiency updates daily, weekly, monthly remaining with transaction impacts', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodKey = `${localDateKey(start)}_to_${localDateKey(end)}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'pbe', start: localDateKey(start), end: localDateKey(end), status: 'active', extraDays: 0 }]));
    window.saveBudgets([{ budgetId: 'bbe', totalAllocated: 30000, periodKey }]);
    window.saveExpenses([
        { id: 'a', type: 'expense', amount: -10000, budgetId: 'bbe', date: now.toISOString(), periodKey },
        { id: 'b', type: 'refund', amount: 2000, budgetId: 'bbe', date: now.toISOString(), linkedTransactionId: 'a', periodKey },
        { id: 'c', type: 'transfer_back', amount: 500, budgetId: 'bbe', date: now.toISOString(), periodKey },
        { id: 'd', type: 'income', amount: 1000, budgetId: 'bbe', date: now.toISOString(), periodKey }
    ]);

    window.updateBudgetEfficiency();

    const num = txt => Number(String(txt || '').replace(/[^0-9.-]/g, ''));
    expect(num(document.getElementById('savedPeriod').innerText)).toBeGreaterThan(0);
    expect(num(document.getElementById('savedWeek').innerText)).toBeGreaterThan(-100000);
    expect(num(document.getElementById('savedToday').innerText)).toBeGreaterThan(-100000);
});

test('graph analytics average and summary update across day/week/month/custom filters', () => {
    const rows = [
        { id: 'g1', amount: -1000, category: 'Food', date: '2026-06-01T10:00:00Z' },
        { id: 'g2', amount: -2000, category: 'Food', date: '2026-06-02T10:00:00Z' },
        { id: 'g3', amount: -3000, category: 'Bills', date: '2026-06-10T10:00:00Z' },
        { id: 'g4', amount: -4000, category: 'Travel', date: '2026-07-10T10:00:00Z' }
    ];

    window.loadGraph('day', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Today');

    window.loadGraph('week', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Avg Spend/week');

    window.loadGraph('month', rows);
    expect(document.getElementById('graphDate').innerText).toContain('Avg Spend/month');

    window.loadGraph('custom', rows, { start: '2026-06-01', end: '2026-06-10' });
    const text = document.getElementById('graphDate').innerText;
    expect(text).toContain('Custom Range');
    expect(text).toContain('Avg Spend/day');
});

test('history integrity keeps original and refunds, running balance visible, count reconciles', () => {
    window.saveBudgets([{ budgetId: 'bhi', totalAllocated: 5000, periodKey: '2026-06-01_to_2026-06-30' }]);
    window.saveExpenses([
        { id: 'h1', type: 'expense', amount: -1500, budgetId: 'bhi', category: 'Food', date: '2026-06-01T10:00:00Z', purpose: 'Lunch' },
        { id: 'h2', type: 'refund', amount: 500, budgetId: 'bhi', linkedTransactionId: 'h1', category: 'Refund', date: '2026-06-01T11:00:00Z', purpose: 'Return' },
        { id: 'h3', type: 'refund', amount: 200, budgetId: 'bhi', linkedTransactionId: 'h1', category: 'Refund', date: '2026-06-01T12:00:00Z', purpose: 'Extra Return' }
    ]);

    const data = window.getExpenses();
    window.loadHistory(data);

    const cards = Array.from(document.querySelectorAll('#historyList .expense-item'));
    expect(cards.length).toBe(data.length);

    const combined = cards.map(c => c.textContent || '').join(' | ');
    expect(combined).toContain('Lunch');
    expect(combined).toContain('Refund');
    expect(combined).toContain('Running Balance');
});

test('attachment lifecycle supports save, view, delete, reset, and module isolation', async () => {
    const removed = [];
    window.reMoAttachments = {
        storeImage: jest.fn(async () => ({ id: `att-${Math.random().toString(16).slice(2)}` })),
        getImageUrl: jest.fn(async id => `blob:${id}`),
        getBlob: jest.fn(async () => new Blob(['demo'], { type: 'text/plain' })),
        remove: jest.fn(async id => { removed.push(id); }),
        getRecord: jest.fn(async id => ({ filename: `${id}.txt`, mime: 'text/plain', createdAt: Date.now() }))
    };

    const expFile = new File(['exp'], 'exp.txt', { type: 'text/plain' });
    const savFile = new File(['sav'], 'sav.txt', { type: 'text/plain' });

    const expInput = document.getElementById('expenseAttachment');
    const savInput = document.getElementById('sAttachment');

    Object.defineProperty(expInput, 'files', { value: [expFile], configurable: true });
    Object.defineProperty(savInput, 'files', { value: [savFile], configurable: true });

    const expAttachmentId = await window.storeAttachmentFromInput('expenseAttachment');
    const savAttachmentId = await window.storeAttachmentFromInput('sAttachment');

    expect(expAttachmentId).toBeTruthy();
    expect(savAttachmentId).toBeTruthy();
    expect(expAttachmentId).not.toBe(savAttachmentId);

    window.saveBudgets([{ budgetId: 'ba1', totalAllocated: 5000, periodKey: '2026-06-01_to_2026-06-30' }]);
    window.saveExpenses([{ id: 'ea1', type: 'expense', amount: -300, budgetId: 'ba1', date: '2026-06-02T10:00:00Z', attachmentId: expAttachmentId }]);
    window.saveSavings([{ id: 'sa1', type: 'deposit', amount: 1000, date: '2026-06-02T11:00:00Z', attachmentId: savAttachmentId }]);

    await window.openTransactionAuditDetails('expense', window.getExpenses()[0]);
    expect(document.getElementById('txnAttachmentSection').style.display).toBe('block');

    await window.viewAttachmentById(expAttachmentId);
    expect(document.getElementById('remo-attach-viewer')).toBeTruthy();

    await window.deleteTransactionAttachment('expense', 'ea1', expAttachmentId);
    expect(window.getExpenses()[0].attachmentId).toBeNull();
    expect(window.getSavings()[0].attachmentId).toBe(savAttachmentId);

    await window.deleteTransactionAttachment('savings', 'sa1', savAttachmentId);
    expect(window.getSavings()[0].attachmentId).toBeNull();
    expect(removed.length).toBe(2);

    window.resetForm();
    window.resetSavingsForm();

    expect(document.getElementById('expenseAttachmentPreviewWrapper').style.display).toBe('none');
    expect(document.getElementById('sAttachmentPreviewWrapper').style.display).toBe('none');

    if (typeof window.setupAttachmentInputs === 'function') {
        window.setupAttachmentInputs();
    }
});
