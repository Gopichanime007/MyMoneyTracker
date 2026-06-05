const { test, expect } = require('@playwright/test');

function seedCoreData() {
  const bp = [{ id: 'p1', start: '2026-06-01', end: '2026-06-30', status: 'active', extraDays: 0 }];
  const budgets = [{ budgetId: 'b1', totalAllocated: 30000, periodKey: '2026-06-01_to_2026-06-30', entity: 'Salary' }];
  const expenses = [
    { id: 'e1', type: 'expense', amount: -6000, budgetId: 'b1', periodKey: '2026-06-01_to_2026-06-30', category: 'Food', purpose: 'Groceries', date: '2026-06-02T10:00:00Z' },
    { id: 'r1', type: 'refund', amount: 5000, budgetId: 'b1', linkedTransactionId: 'e1', periodKey: '2026-06-01_to_2026-06-30', category: 'Refund', purpose: 'Partial Refund', date: '2026-06-03T10:00:00Z' },
    { id: 'tb1', type: 'transfer_back', amount: -1000, budgetId: 'b1', periodKey: '2026-06-01_to_2026-06-30', category: 'Transfer Back', purpose: 'Move to Savings', date: '2026-06-04T10:00:00Z' }
  ];
  const savings = [
    { id: 's0', type: 'deposit', amount: 50000, note: 'Salary Account', date: '2026-06-01T09:00:00Z', monthKey: '2026-06', periodKey: '2026-06-01_to_2026-06-30' },
    { id: 's1', type: 'budget_allocation', amount: -30000, sourceId: 's0', targetBudgetId: 'b1', note: 'Move to Budget', date: '2026-06-01T10:00:00Z', monthKey: '2026-06', periodKey: '2026-06-01_to_2026-06-30' },
    { id: 's2', type: 'refund', amount: 1000, sourceId: 's0', linkedTransactionId: 'tb1', note: 'Transfer Back', date: '2026-06-04T10:05:00Z', monthKey: '2026-06', periodKey: '2026-06-01_to_2026-06-30' }
  ];

  localStorage.setItem('bp', JSON.stringify(bp));
  localStorage.setItem('budgets', JSON.stringify(budgets));
  localStorage.setItem('expenses', JSON.stringify(expenses));
  localStorage.setItem('savingsTransactions', JSON.stringify(savings));
  localStorage.setItem('categories', JSON.stringify(['Food', 'Refund', 'Travel']));
  localStorage.setItem('persons', JSON.stringify([{ name: 'Self' }]));
}

test('Budget module UAT: active period + efficiency + graph analytics', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(seedCoreData);
  await page.reload();

  await page.click('button[data-screen="budget"]');
  await expect(page.locator('#savedToday')).not.toHaveText(/₹0/);
  await expect(page.locator('#savedWeek')).not.toHaveText(/₹0/);
  await expect(page.locator('#savedPeriod')).not.toHaveText(/₹0/);

  await page.click('button[data-screen="graph"]');
  await page.selectOption('section#graph select', 'day');
  await expect(page.locator('#graphDate')).toContainText('Avg Spend/day');

  await page.selectOption('section#graph select', 'week');
  await expect(page.locator('#graphDate')).toContainText('Avg Spend/week');

  await page.selectOption('section#graph select', 'month');
  await expect(page.locator('#graphDate')).toContainText('Avg Spend/month');

  await page.goto('/pages/budgetperiod.html');
  await page.click('button.add-btn');
  await page.fill('#bpStartDate', '2026-06-01');
  await page.fill('#bpDuration', '30');
  await page.fill('#bpEndDate', '2026-06-30');
  await page.fill('#bpExtraDays', '5');
  await page.click('#budgetModal button:has-text("Save")');

  await expect(page.locator('#budgetList .budget-card')).toHaveCount(2);

  const activeCount = await page.evaluate(() => {
    const periods = JSON.parse(localStorage.getItem('bp') || '[]');
    return periods.filter(p => p.status === 'active').length;
  });
  expect(activeCount).toBeLessThanOrEqual(1);
});

test('Savings + cross-ledger UAT: balances, history, dashboard reconciliation', async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(seedCoreData);
  await page.reload();

  await page.click('button[data-screen="home"]');
  await expect(page.locator('#budgetValue')).not.toHaveText('0');
  await expect(page.locator('#spent')).not.toHaveText('0');
  await expect(page.locator('#remaining')).not.toHaveText('0');

  await page.click('button[data-screen="history"]');
  await expect(page.locator('#historyList .expense-item')).toHaveCount(3);
  await expect(page.locator('#historyList')).toContainText('Running Balance');

  await page.goto('/pages/savings.html');
  await expect(page.locator('#savingsBalance')).not.toHaveText('0');

  await page.click('button[data-screen="history"]');
  await expect(page.locator('#savingsHistory .expense-item')).toHaveCount(3);
  await expect(page.locator('#savingsHistory')).toContainText('Running Balance');
});

test('Attachment + responsive UAT: preview/view/download/delete and mobile layout sanity', async ({ page, isMobile }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());

  await page.evaluate(() => {
    window.reMoAttachmentsIndexed = {
      storeImage: async (_id, file) => ({ id: 'att-' + (file && file.name ? file.name : 'file') }),
      getImageUrl: async id => 'blob:' + id,
      getBlob: async () => new Blob(['demo'], { type: 'text/plain' }),
      remove: async () => { },
      getRecord: async id => ({ filename: id + '.txt', mime: 'text/plain', createdAt: Date.now() })
    };
    localStorage.setItem('budgets', JSON.stringify([{ budgetId: 'b1', totalAllocated: 1000, periodKey: '2026-06-01_to_2026-06-30' }]));
    localStorage.setItem('expenses', JSON.stringify([{ id: 'a1', type: 'expense', amount: -100, budgetId: 'b1', date: '2026-06-01T10:00:00Z', attachmentId: 'att-exp.txt', category: 'Food' }]));
  });
  await page.reload();

  await page.click('button[data-screen="add"]');
  await page.setInputFiles('#expenseAttachment', {
    name: 'exp.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('expense-attachment')
  });

  await expect(page.locator('#expenseAttachmentPreviewWrapper')).toBeVisible();

  await page.click('button[data-screen="history"]');
  await page.locator('#historyList .expense-item').first().click();
  await expect(page.locator('#txnAttachmentSection')).toBeVisible();

  await page.click('#txnAttachmentSection button:has-text("Download")');
  await expect(page.locator('#txnAttachmentSection')).toContainText('Download');

  await page.click('#txnAttachmentSection button:has-text("Delete")');

  await page.goto('/pages/savings.html');
  await page.click('button[data-screen="add"]');
  await page.setInputFiles('#sAttachment', {
    name: 'sav.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('savings-attachment')
  });
  await expect(page.locator('#sAttachmentPreviewWrapper')).toBeVisible();

  const width = await page.evaluate(() => window.innerWidth);
  if (isMobile) {
    expect(width).toBeLessThanOrEqual(430);
  } else {
    expect(width).toBeGreaterThan(430);
  }
});
