(function (root) {
  const STORAGE_KEYS = {
    config: 'dailyBudgetLedgerConfig',
    entries: 'dailyBudgetLedgerEntries'
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

  function getStoredEntries() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.entries) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

  function saveStoredEntries(entries) {
    localStorage.setItem(STORAGE_KEYS.entries, JSON.stringify(entries));
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

  function buildLedgerRows(entries, dailyBudget = 100) {
    const sortedEntries = [...entries]
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
        day: entry.day || getDayName(entry.date),
        note: entry.note || '',
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

      return `
        <article class="ledger-row entry-row">
          <div class="ledger-row-header">
            <div>
              <strong>${row.date}</strong>
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

  function resetEntryForm() {
    const dateInput = document.getElementById('entryDate');
    const noteInput = document.getElementById('entryNote');
    const amountInput = document.getElementById('entryAmount');
    if (dateInput) {
      dateInput.value = formatDateInput(new Date());
    }
    if (noteInput) noteInput.value = '';
    if (amountInput) amountInput.value = '';
  }

  function handleBudgetSave() {
    const budgetInput = document.getElementById('dailyBudgetInput');
    const nextBudget = safeNumber(budgetInput ? budgetInput.value : 100, 100);
    const config = getStoredConfig();
    config.dailyBudget = nextBudget;
    saveStoredConfig(config);
    renderDailyBudgetLedger();
  }

  function handleEntrySave() {
    const dateInput = document.getElementById('entryDate');
    const noteInput = document.getElementById('entryNote');
    const amountInput = document.getElementById('entryAmount');

    if (!dateInput || !dateInput.value) {
      return;
    }

    const config = getStoredConfig();
    const entries = getStoredEntries();
    const newEntry = {
      id: `entry-${Date.now()}`,
      date: dateInput.value,
      day: getDayName(dateInput.value),
      note: noteInput ? noteInput.value.trim() : '',
      budget: safeNumber(config.dailyBudget, 100),
      spent: safeNumber(amountInput ? amountInput.value : 0, 0)
    };

    entries.push(newEntry);
    saveStoredEntries(entries);
    resetEntryForm();
    renderDailyBudgetLedger();
  }

  function renderDailyBudgetLedger() {
    const config = getStoredConfig();
    populateBudgetField(config);
    const entries = getStoredEntries();
    const rows = buildLedgerRows(entries, config.dailyBudget);
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

    const saveEntryButton = document.getElementById('saveLedgerEntry');
    if (saveEntryButton) {
      saveEntryButton.addEventListener('click', handleEntrySave);
    }
  }

  function initDailyBudgetLedgerPage() {
    bindEvents();
    resetEntryForm();
    renderDailyBudgetLedger();
  }

  root.calculateDailyDelta = calculateDailyDelta;
  root.buildLedgerRows = buildLedgerRows;
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
      getStoredEntries
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
