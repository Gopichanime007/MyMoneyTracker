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
            <select id="appearanceModeSelect"></select>
            <select id="accentColorSelect"></select>
            <input id="autoBackupEnabled" type="checkbox" />
            <select id="autoBackupFrequency"><option value="weekly">weekly</option></select>
            <select id="autoBackupTarget"><option value="local_download">local_download</option></select>
            <small id="autoBackupLastRun"></small>
            <small id="autoBackupNextRun"></small>
            <small id="autoBackupRetentionState"></small>
            <small id="autoBackupRuntimeState"></small>
            <div id="importModal" style="display:block"></div>
            <textarea id="importText"></textarea>
            <pre id="importValidationReport"></pre>
    `;

    window.open = jest.fn();
    if (!URL.createObjectURL) URL.createObjectURL = jest.fn(() => 'blob:test');
    if (!URL.revokeObjectURL) URL.revokeObjectURL = jest.fn();
    if (!window.navigator.share) window.navigator.share = jest.fn(async () => {});
    if (!window.navigator.canShare) window.navigator.canShare = jest.fn(() => false);
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

test('savings entries preserve failed attachment metadata without blocking persistence', () => {
    window.saveSavings([
        {
            id: 'sf1',
            type: 'deposit',
            amount: 1200,
            date: '2026-06-10T10:00:00Z',
            attachmentStatus: 'failed',
            attachmentError: 'Worker failed',
            attachmentId: null
        }
    ]);

    const rows = window.getSavings();
    expect(rows.length).toBe(1);
    expect(rows[0].amount).toBe(1200);
    expect(rows[0].attachmentId || null).toBeNull();
    expect(rows[0].attachmentStatus).toBe('failed');
    expect(rows[0].attachmentError).toContain('Worker failed');
});

test('transfer back entry persists original savings source trace metadata', () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const periodKey = `${localDateKey(start)}_to_${localDateKey(end)}`;

    localStorage.setItem('bp', JSON.stringify([{ id: 'ptb', start: localDateKey(start), end: localDateKey(end), status: 'active', extraDays: 0 }]));

    window.saveBudgets([
        { budgetId: 'bw1', totalAllocated: 5000, sourceId: 'srcA', periodKey, isBudgetWallet: true, entity: 'Budget Wallet' }
    ]);

    const tb = window.addExpense({
        amount: -1000,
        type: 'transfer_back',
        category: 'Transfer Back',
        purpose: 'Move back',
        date: now.toISOString(),
        paymentType: 'Cash',
        allocationTrail: [{ budgetId: 'bw1', amount: 1000 }],
        transferBackTrail: [{ budgetId: 'bw1', sourceId: 'srcA', amount: 1000 }],
        linkedSourceSavingsId: 'srcA',
        linkedSourceSavingsIds: ['srcA']
    });

    expect(tb).toBeTruthy();
    expect(tb.linkedSourceSavingsId).toBe('srcA');
    expect(Array.isArray(tb.transferBackTrail)).toBe(true);
    expect(tb.transferBackTrail[0].sourceId).toBe('srcA');
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

test('attachment overlay stays above transaction modal and restores modal interaction on close', async () => {
    window.reMoAttachments = {
        getImageUrl: jest.fn(async id => `blob:${id}`),
        getBlob: jest.fn(async () => new Blob(['img'], { type: 'image/png' })),
        getRecord: jest.fn(async () => ({ filename: 'preview.png', mime: 'image/png', createdAt: Date.now() }))
    };

    window.saveBudgets([{ budgetId: 'b-layer', totalAllocated: 5000, periodKey: '2026-06-01_to_2026-06-30' }]);
    window.saveExpenses([{ id: 'ex-layer', type: 'expense', amount: -300, budgetId: 'b-layer', date: '2026-06-02T10:00:00Z', attachmentId: 'att-layer' }]);

    await window.openTransactionAuditDetails('expense', window.getExpenses()[0]);
    const modal = document.getElementById('txnDetailsModal');
    expect(modal).toBeTruthy();
    expect(modal.style.display).toBe('flex');

    await window.viewAttachmentById('att-layer');
    const overlay = document.getElementById('remo-attach-viewer');
    expect(overlay).toBeTruthy();
    expect(modal.classList.contains('modal-layer-muted')).toBe(true);

    overlay.click();
    expect(document.getElementById('remo-attach-viewer')).toBeNull();
    expect(modal.classList.contains('modal-layer-muted')).toBe(false);
});

test('backup serializer includes simplified production settings envelope', () => {
    localStorage.setItem('appearanceMode', 'chromium');
    localStorage.setItem('accentColor', '#2196f3');
    localStorage.setItem('theme', '#2196f3');
    localStorage.setItem('currencyCode', 'INR');

    localStorage.setItem('autoBackupSettingsV1', JSON.stringify({ enabled: true, frequency: 'daily', target: 'local_download' }));
    const dump = window.getFullAppData();
    expect(dump.settings.appearanceMode).toBe('chromium');
    expect(dump.settings.accentColor).toBe('#2196f3');
    expect(dump.settings.autoBackupEnabled).toBe(true);
    expect(dump.settings.autoBackupFrequency).toBe('daily');
    expect(dump.settings.notificationSettings).toBeUndefined();
    expect(dump.settings.widgetSettings).toBeUndefined();
});

test('import restores production settings with no ledger drift', () => {
    window.saveBudgets([{ budgetId: 'bimp', totalAllocated: 10000, periodKey: '2026-06-01_to_2026-06-30' }]);
    window.saveExpenses([{ id: 'eimp', type: 'expense', amount: -1200, budgetId: 'bimp', date: '2026-06-01T10:00:00Z' }]);
    window.saveSavings([{ id: 'simp', type: 'deposit', amount: 5000, date: '2026-06-01T10:00:00Z' }]);

    const beforeExpense = window.getExpenses().map(e => ({ id: e.id, before: e.BalanceBeforeTransaction, after: e.BalanceAfterTransaction }));
    const beforeSavings = window.getSavings().map(s => ({ id: s.id, before: s.BalanceBeforeTransaction, after: s.BalanceAfterTransaction }));

    const payload = {
        ...window.getFullAppData(),
        settings: {
            appearanceMode: 'matte',
            accentColor: '#ef4444',
            theme: '#ef4444',
            currencyCode: 'INR',
            autoBackupEnabled: true,
            autoBackupFrequency: 'weekly',
            autoBackupTarget: 'local_download'
        }
    };

    document.getElementById('importText').value = JSON.stringify(payload);
    window.importData();

    expect(localStorage.getItem('appearanceMode')).toBe('matte');
    expect(localStorage.getItem('accentColor')).toBe('#ef4444');
    expect(localStorage.getItem('notificationSettingsV1')).toBeNull();
    expect(localStorage.getItem('widgetSettingsV1')).toBeNull();

    const afterExpense = window.getExpenses().map(e => ({ id: e.id, before: e.BalanceBeforeTransaction, after: e.BalanceAfterTransaction }));
    const afterSavings = window.getSavings().map(s => ({ id: s.id, before: s.BalanceBeforeTransaction, after: s.BalanceAfterTransaction }));

    expect(afterExpense).toEqual(beforeExpense);
    expect(afterSavings).toEqual(beforeSavings);
});

test('import classifies malformed json separately from validation errors', () => {
    document.getElementById('importText').value = '{"expenses":';
    window.importData();

    const report = window.__lastImportValidationReport;
    expect(report).toBeTruthy();
    expect(report.errors).toContain('Malformed JSON');
});

test('import rejects unsupported version and invalid schema with validation report', () => {
    const payload = {
        meta: { version: 'v9' },
        expenses: {},
        savings: [],
        budgets: []
    };

    document.getElementById('importText').value = JSON.stringify(payload);
    window.importData();

    const report = window.__lastImportValidationReport;
    expect(report.errors.some(e => e.includes('Unsupported Version'))).toBe(true);
    expect(report.errors.some(e => e.includes('expenses must be an array'))).toBe(true);
});

test('import accepts numeric string guid ids and null linkage fields', () => {
    const payload = {
        expenses: [
            {
                id: 1780644309293,
                type: 'expense',
                amount: -200,
                budgetId: 'b-id-1',
                person: null,
                sourceId: null,
                linkedTransactionId: null,
                date: '2026-06-01T10:00:00Z'
            },
            {
                id: 'bcc1a037-8dc7-4101-b975-4e591dbd2e81',
                type: 'expense',
                amount: -100,
                budgetId: 'b-id-1',
                person: 'self',
                date: '2026-06-01T11:00:00Z'
            }
        ],
        savings: [
            {
                id: 'savings_wallet',
                type: 'deposit',
                amount: 2000,
                autoRecovered: true,
                sourceId: null,
                linkedTransactionId: null,
                date: '2026-06-01T09:00:00Z'
            }
        ],
        budgets: [
            {
                budgetId: 'b-id-1',
                totalAllocated: 5000,
                periodKey: '2026-06-01_to_2026-06-30'
            }
        ],
        budgetPeriods: [
            {
                id: 'bp1',
                periodKey: '2026-06-01_to_2026-06-30',
                status: 'active'
            }
        ],
        settings: {
            theme: '#2196f3',
            currencyCode: 'INR'
        },
        categories: [],
        persons: [],
        meta: { version: 'v2' }
    };

    document.getElementById('importText').value = JSON.stringify(payload);
    window.importData();

    const report = window.__lastImportValidationReport;
    expect(report.errors).toEqual([]);
    expect(report.imported.expenses).toBe(2);
    expect(report.imported.savings).toBe(1);
    expect(window.getExpenses().length).toBe(2);
    expect(window.getSavings().length).toBe(1);
});

test('legacy v1 import is migrated and accepted', () => {
    const payload = {
        expenses: [
            {
                id: 1,
                type: 'expense',
                amount: -300,
                budgetId: 'b-legacy',
                date: '2026-06-01T10:00:00Z'
            }
        ],
        savings: [
            {
                id: 's-legacy',
                type: 'deposit',
                amount: 1000,
                date: '2026-06-01T09:00:00Z'
            }
        ],
        budgets: [
            {
                budgetId: 'b-legacy',
                totalAllocated: 5000,
                monthKey: '2026-06'
            }
        ],
        settings: {
            theme: '#22c55e',
            currencyCode: 'INR'
        },
        meta: { version: 'v1' }
    };

    document.getElementById('importText').value = JSON.stringify(payload);
    window.importData();

    const report = window.__lastImportValidationReport;
    expect(report.errors).toEqual([]);
    expect(localStorage.getItem('accentColor')).toBe('#22c55e');
    expect(localStorage.getItem('currencyCode')).toBe('INR');
    expect(window.getExpenses().length).toBe(1);
});

test('footer injects once without legacy inline style and remains centered class-bound', () => {
    const app = document.createElement('div');
    app.className = 'app';
    document.body.appendChild(app);

    window.injectGlobalFooter();
    window.injectGlobalFooter();

    const footers = app.querySelectorAll('#appSignatureFooter');
    expect(footers.length).toBe(1);
    expect(footers[0].innerHTML.includes('style=')).toBe(false);
    expect(footers[0].className).toContain('app-signature');
});

test('accent plus appearance persist together after reload simulation', () => {
    window.changeTheme('#7c3aed');
    window.setAppearanceMode('chromium');

    expect(localStorage.getItem('accentColor')).toBe('#7c3aed');
    expect(localStorage.getItem('appearanceMode')).toBe('chromium');

    document.documentElement.style.removeProperty('--theme');
    document.documentElement.style.removeProperty('--accent-color');
    delete document.documentElement.dataset.appearance;

    window.loadTheme();

    expect(document.documentElement.style.getPropertyValue('--theme')).toBe('#7c3aed');
    expect(document.documentElement.style.getPropertyValue('--accent-color')).toBe('#7c3aed');
    expect(document.documentElement.dataset.appearance).toBe('chromium');
});

test('export generates filename metadata and updates backup runtime state', async () => {
    await window.exportDataAsJSON();

    expect(window.__lastBackupExportStatus).toBeTruthy();
    expect(window.__lastBackupExportStatus.filename).toMatch(/^MoneyTracker_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.json$/);
    expect(document.getElementById('autoBackupRuntimeState').textContent.length).toBeGreaterThan(0);
});
