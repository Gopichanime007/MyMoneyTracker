(function (root) {
  const STORAGE_KEYS = {
    config: 'dailyBudgetLedgerConfig'
  };

  function safeNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(12, 0, 0, 0);
    return date;
  }

  function addDays(date, amount) {
    const next = new Date(date);
    next.setDate(next.getDate() + amount);
    return next;
  }

  function formatDateInput(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatCurrency(value) {
    const amount = safeNumber(value, 0);
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  function getDayName(dateValue) {
    const date = parseDate(dateValue);
    if (!date) return '';
    return date.toLocaleDateString('en-IN', { weekday: 'long' });
  }

  function getMonthLabel(dateValue) {
    const date = parseDate(dateValue);
    if (!date) return 'Summary';
    return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }

  function formatDisplayDate(dateValue) {
    const date = parseDate(dateValue);
    if (!date) return '';
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function getDateKey(dateValue) {
    const date = parseDate(dateValue);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function calculateDailyDelta(budget, spent) {
    return safeNumber(budget, 0) - safeNumber(spent, 0);
  }

  function getStoredConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || 'null');
      if (!stored) {
        return { dailyBudget: 100 };
      }
      return {
        dailyBudget: safeNumber(stored.dailyBudget, 100)
      };
    } catch (error) {
      return { dailyBudget: 100 };
    }
  }

  function saveStoredConfig(config) {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  }

  function getLedgerDataSourceEntries(expenses = null) {
    const sourceEntries = Array.isArray(expenses) ? expenses : getStoredExpenses();
    return (Array.isArray(sourceEntries) ? sourceEntries : [])
      .filter((entry) => {
        const amount = safeNumber(entry && entry.amount, 0);
        return entry && (entry.type === 'expense' || entry.type === 'loss' || amount < 0);
      })
      .map((entry) => ({
        ...entry,
        date: entry.date || entry.createdAt || '',
        amount: safeNumber(entry.amount, 0),
        spent: Math.abs(safeNumber(entry.amount, 0))
      }));
  }

  function getStoredExpenses() {
    try {
      const stored = JSON.parse(localStorage.getItem('expenses') || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function createSummaryRow(entries, kind, closingRunningBalance) {
    const totalBudget = entries.reduce((sum, entry) => sum + safeNumber(entry.budget, 0), 0);
    const totalSpent = entries.reduce((sum, entry) => sum + safeNumber(entry.spent, 0), 0);
    const totalSavings = entries.reduce((sum, entry) => sum + Math.max(0, safeNumber(entry.dailyDelta, 0)), 0);
    const totalDeficit = entries.reduce((sum, entry) => sum + Math.max(0, -safeNumber(entry.dailyDelta, 0)), 0);

    return {
      type: 'summary',
      kind,
      label: kind === 'week' ? 'Week Summary' : `${getMonthLabel(entries[entries.length - 1].date)} Summary`,
      totalBudget,
      totalSpent,
      totalSavings,
      totalDeficit,
      closingRunningSavings: closingRunningBalance
    };
  }

  function buildLedgerRows(entries, dailyBudget = 100, sourceExpenses = null) {
    const ledgerSourceEntries = Array.isArray(entries) && entries.length
      ? entries
      : getLedgerDataSourceEntries(sourceExpenses);

    const groupedEntries = new Map();

    ledgerSourceEntries.forEach((entry, index) => {
      const normalizedDate = getDateKey(entry.date || entry.createdAt || '');
      if (!normalizedDate) return;

      const bucket = groupedEntries.get(normalizedDate) || {
        id: entry.id || `entry-${index + 1}`,
        date: normalizedDate,
        day: getDayName(entry.date || entry.createdAt || ''),
        note: '',
        budget: safeNumber(dailyBudget, 100),
        spent: 0,
        expenseCount: 0,
        expenses: []
      };

      const entryAmount = safeNumber(entry.spent, safeNumber(entry.amount, 0));
      bucket.spent += entryAmount;
      bucket.expenseCount += 1;
      bucket.expenses.push(entry);

      if (!bucket.note) {
        bucket.note = entry.note || entry.purpose || entry.category || '';
      }

      groupedEntries.set(normalizedDate, bucket);
    });

    const sortedEntries = [...groupedEntries.values()]
      .map((entry) => ({
        ...entry,
        budget: safeNumber(entry.budget, safeNumber(dailyBudget, 100)),
        spent: safeNumber(entry.spent, 0)
      }))
      .sort((left, right) => new Date(left.date) - new Date(right.date));

    const rows = [];
    let runningBalance = 0;
    let weekEntries = [];
    let weekStartDate = null;
    let monthEntries = [];
    let currentMonthKey = '';

    sortedEntries.forEach((entry, index) => {
      const date = parseDate(entry.date);
      const delta = calculateDailyDelta(entry.budget, entry.spent);
      runningBalance += delta;

      const row = {
        type: 'entry',
        id: entry.id || `entry-${index + 1}`,
        date: entry.date,
        displayDate: formatDisplayDate(entry.date),
        day: entry.day || getDayName(entry.date),
        note: entry.expenseCount > 1 ? `${entry.expenseCount} expenses` : (entry.note || '—'),
        budget: entry.budget,
        spent: entry.spent,
        dailyDelta: delta,
        runningBalance
      };

      rows.push(row);

      if (!weekStartDate && date) {
        weekStartDate = date;
      }

      if (date && weekStartDate) {
        const dayDifference = Math.round((date - weekStartDate) / (1000 * 60 * 60 * 24));
        weekEntries.push({ ...row });
        if (dayDifference >= 6) {
          rows.push(createSummaryRow(weekEntries, 'week', runningBalance));
          weekEntries = [];
          weekStartDate = addDays(date, 1);
        }
      }

      if (date) {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthKey !== currentMonthKey) {
          monthEntries = [];
          currentMonthKey = monthKey;
        }
        monthEntries.push({ ...row });

        const lastDayOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        if (date.getDate() === lastDayOfMonth) {
          rows.push(createSummaryRow(monthEntries, 'month', runningBalance));
          monthEntries = [];
          currentMonthKey = monthKey;
        }
      }
    });

    return rows;
  }

  function renderLedger(rows) {
    const ledgerRoot = document.getElementById('ledgerEntries');
    if (!ledgerRoot) return;

    if (!rows.length) {
      ledgerRoot.innerHTML = '<div class="empty-state">No ledger entries yet. Add the first day to begin tracking your running balance.</div>';
      return;
    }

    ledgerRoot.innerHTML = rows.map((row) => {
      if (row.type === 'summary') {
        const summaryLabel = row.label || (row.kind === 'week' ? 'Week Summary' : 'Month Summary');
        return `
          <article class="ledger-row summary-row ${row.kind}">
            <div class="summary-heading">${summaryLabel}</div>
            <div class="summary-grid">
              <div><span>Total Budget</span><strong>${formatCurrency(row.totalBudget)}</strong></div>
              <div><span>Total Spent</span><strong>${formatCurrency(row.totalSpent)}</strong></div>
              <div><span>Total Savings</span><strong>${formatCurrency(row.totalSavings)}</strong></div>
              <div><span>Total Deficit</span><strong>${formatCurrency(row.totalDeficit)}</strong></div>
              <div class="summary-wide"><span>Closing Running Savings</span><strong>${formatCurrency(row.closingRunningSavings)}</strong></div>
            </div>
          </article>`;
      }

      const deltaClass = row.dailyDelta >= 0 ? 'positive' : 'negative';
      const deltaLabel = row.dailyDelta >= 0 ? 'Savings' : 'Deficit';
      const dayLabel = row.day || getDayName(row.date);
      const displayDate = row.displayDate || formatDisplayDate(row.date);

      return `
        <article class="ledger-row entry-row">
          <div class="ledger-row-header">
            <div>
              <strong>${displayDate}</strong>
              <div class="muted">${dayLabel}</div>
            </div>
            <div class="ledger-badge ${deltaClass}">${deltaLabel}</div>
          </div>
          <div class="ledger-details">
            <div><span>Note</span><strong>${row.note || '—'}</strong></div>
            <div><span>Budget</span><strong>${formatCurrency(row.budget)}</strong></div>
            <div><span>Spent</span><strong>${formatCurrency(row.spent)}</strong></div>
            <div><span>Daily Saving/Deficit</span><strong>${formatCurrency(row.dailyDelta)}</strong></div>
            <div class="summary-wide"><span>Running Savings</span><strong>${formatCurrency(row.runningBalance)}</strong></div>
          </div>
        </article>`;
    }).join('');
  }

  function populateBudgetField(config) {
    const budgetInput = document.getElementById('dailyBudgetInput');
    if (!budgetInput) return;
    budgetInput.value = safeNumber(config.dailyBudget, 100);
  }

  function handleBudgetSave() {
    const budgetInput = document.getElementById('dailyBudgetInput');
    const nextBudget = safeNumber(budgetInput ? budgetInput.value : 100, 100);
    const config = getStoredConfig();
    config.dailyBudget = nextBudget;
    saveStoredConfig(config);
    renderDailyBudgetLedger();
  }

  function renderDailyBudgetLedger() {
    const config = getStoredConfig();
    populateBudgetField(config);
    const expenses = getStoredExpenses();
    const rows = buildLedgerRows([], config.dailyBudget, expenses, { source: 'expense' });
    renderLedger(rows);
    const summaryCount = document.getElementById('ledgerEntryCount');
    if (summaryCount) {
      summaryCount.textContent = `${rows.filter((row) => row.type === 'entry').length} entries`;
    }
  }

  function bindEvents() {
    const saveBudgetButton = document.getElementById('saveDailyBudget');
    if (saveBudgetButton) {
      saveBudgetButton.addEventListener('click', handleBudgetSave);
    }

    window.addEventListener('storage', () => renderDailyBudgetLedger());
    document.addEventListener('expenses:changed', () => renderDailyBudgetLedger());
  }

  function initDailyBudgetLedgerPage() {
    bindEvents();
    renderDailyBudgetLedger();
  }

  root.calculateDailyDelta = calculateDailyDelta;
  root.buildLedgerRows = buildLedgerRows;
  root.getLedgerDataSourceEntries = getLedgerDataSourceEntries;
  root.renderDailyBudgetLedger = renderDailyBudgetLedger;
  root.initDailyBudgetLedgerPage = initDailyBudgetLedgerPage;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initDailyBudgetLedgerPage);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      calculateDailyDelta,
      buildLedgerRows,
      getStoredConfig,
      getLedgerDataSourceEntries
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
