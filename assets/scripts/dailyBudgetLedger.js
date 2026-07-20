(function (root) {
  const STORAGE_KEYS = {
    config: 'dailyBudgetLedgerConfig'
  };

  /* ==========================================================
     ⚠️  UPDATE HERE #1 — point this at your real Expense data.
     This is the ONLY place the ledger reads expense records
     from. If your expenses live somewhere other than
     localStorage['expenses'], change EXPENSES_STORAGE_KEY (or
     replace the body of getStoredExpenses() with your own
     fetch/DB call).
  ========================================================== */
  const EXPENSES_STORAGE_KEY = 'expenses';

  /* ==========================================================
     ⚠️  UPDATE HERE #3 — default week-start day.
     0 = Sunday, 1 = Monday, ... 6 = Saturday.
     This is only the DEFAULT. If your HTML has a
     <select id="weekStartDaySelect"> with options 0-6, the
     user's choice there overrides this automatically and is
     remembered in localStorage.
  ========================================================== */
  const DEFAULT_WEEK_START_DAY = 1; // Monday

  /* ==========================================================
     ⚠️  UPDATE HERE #4 — filter engine integration point.
     Send over your filter engine file and I'll wire it in
     here directly. Until then, call:
         window.setLedgerFilter((expense) => true/false)
     from your filter UI's "apply" handler — every expense for
     which the function returns false is excluded from the
     ledger, budget totals, and running balance, exactly like
     it never happened.
  ========================================================== */
  let activeExpenseFilter = null;

  function setLedgerFilter(filterFn) {
    activeExpenseFilter = typeof filterFn === 'function' ? filterFn : null;
    renderDailyBudgetLedger();
  }

  function clearLedgerFilter() {
    setLedgerFilter(null);
  }

  function getStoredExpenses() {
    try {
      const stored = JSON.parse(localStorage.getItem(EXPENSES_STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored : [];
    } catch (error) {
      return [];
    }
  }

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

  function formatDateInput(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDateKey(dateValue) {
    return formatDateInput(parseDate(dateValue));
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(safeNumber(value, 0));
  }

  function getDayName(dateValue) {
    const date = parseDate(dateValue);
    return date ? date.toLocaleDateString('en-IN', { weekday: 'short' }) : '';
  }

  function formatDisplayDate(dateValue) {
    const date = parseDate(dateValue);
    return date ? date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
  }

  function getMonthLabel(date) {
    return date ? date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Summary';
  }

  // Configurable-start calendar week. weekStartDay: 0=Sun..6=Sat.
  // Two dates fall in the same week if they share the same
  // "first day of that week" under this setting.
  function getWeekKey(date, weekStartDay) {
    const diff = (date.getDay() - weekStartDay + 7) % 7;
    const start = new Date(date);
    start.setDate(start.getDate() - diff);
    return formatDateInput(start);
  }

  function getMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  /* ==========================================================
     ⚠️  UPDATE HERE #2 — field mapping for a single expense.
     If your expense objects use different field names than
     `date` / `amount` / `type`, change them ONLY inside this
     function. Everything downstream just reads entry.date and
     entry.spent, so this is the one translation layer.
  ========================================================== */
  function getLedgerDataSourceEntries(expenses) {
    return (Array.isArray(expenses) ? expenses : [])
      .filter((entry) => {
        const amount = safeNumber(entry && entry.amount, 0);
        return entry && (entry.type === 'expense' || entry.type === 'loss' || amount < 0);
      })
      .filter((entry) => !activeExpenseFilter || activeExpenseFilter(entry))
      .map((entry) => ({
        date: entry.date || entry.createdAt || '',
        spent: Math.abs(safeNumber(entry.amount, 0))
      }));
  }

  function createSummaryRow(entries, kind, openingBalance, closingBalance, label) {
    return {
      type: 'summary',
      kind, // 'week' | 'month' — used as the CSS row class (week-summary / month-summary)
      label,
      budget: entries.reduce((sum, e) => sum + e.budget, 0),
      spent: entries.reduce((sum, e) => sum + e.spent, 0),
      savings: entries.reduce((sum, e) => sum + e.savings, 0),
      deficit: entries.reduce((sum, e) => sum + e.deficit, 0),
      openingBalance,
      closingBalance
    };
  }

  /**
   * Builds ledger rows purely from Expense records — no separate
   * ledger entries are ever created or stored.
   *
   * @param {number} dailyBudget - Fixed Daily Budget, applied to every date.
   * @param {Array}  expensesOverride - optional, mainly for testing.
   * @param {number} weekStartDay - 0=Sun..6=Sat, defaults to DEFAULT_WEEK_START_DAY.
   */
  function buildLedgerRows(dailyBudget = 100, expensesOverride = null, weekStartDay = DEFAULT_WEEK_START_DAY) {
    const expenses = Array.isArray(expensesOverride) ? expensesOverride : getStoredExpenses();
    const rawEntries = getLedgerDataSourceEntries(expenses);

    // Step 1 — sum expenses per calendar date (rule 2, rule 8: only
    // dates that actually have expense records are kept).
    const dailyTotals = new Map();
    rawEntries.forEach((entry) => {
      const dateKey = getDateKey(entry.date);
      if (!dateKey) return;
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + entry.spent);
    });

    // Step 2 — ascending date order (rule 9).
    const sortedDates = [...dailyTotals.keys()].sort((a, b) => new Date(a) - new Date(b));

    const budget = safeNumber(dailyBudget, 100);
    const rows = [];
    let runningBalance = 0; // rule 3: previous running balance starts at 0

    let weekBucket = [];
    let weekOpeningBalance = 0;
    let monthBucket = [];
    let monthOpeningBalance = 0;
    let weekCounter = 0;

    sortedDates.forEach((dateKey, index) => {
      // Snapshot the balance BEFORE today's entry, the moment a
      // new bucket starts — this becomes that bucket's opening balance.
      if (weekBucket.length === 0) weekOpeningBalance = runningBalance;
      if (monthBucket.length === 0) monthOpeningBalance = runningBalance;

      const date = parseDate(dateKey);
      const spent = dailyTotals.get(dateKey);

      // Step 3 — Savings / Deficit (rule 2's if/else-if/else).
      let savings = 0;
      let deficit = 0;
      if (spent < budget) {
        savings = budget - spent;
      } else if (spent > budget) {
        deficit = spent - budget;
      }

      // Step 4 — running balance (rule 3).
      runningBalance += savings - deficit;

      const row = {
        type: 'entry',
        date: dateKey,
        displayDate: formatDisplayDate(dateKey),
        day: getDayName(dateKey),
        budget,
        spent,
        savings,
        deficit,
        runningBalance
      };

      rows.push(row);
      weekBucket.push(row);
      monthBucket.push(row);

      // Step 5 — decide if a week/month boundary was just crossed,
      // by peeking at the next date that actually has expenses.
      const nextDateKey = sortedDates[index + 1];
      const nextDate = nextDateKey ? parseDate(nextDateKey) : null;
      const isLastRecord = !nextDate;

      const weekEnds = isLastRecord || getWeekKey(nextDate, weekStartDay) !== getWeekKey(date, weekStartDay);
      const monthEnds = isLastRecord || getMonthKey(nextDate) !== getMonthKey(date);

      if (weekEnds) {
        weekCounter += 1;
        rows.push(createSummaryRow(weekBucket, 'week', weekOpeningBalance, runningBalance, `Week ${weekCounter} Summary`));
        weekBucket = [];
      }

      if (monthEnds) {
        rows.push(createSummaryRow(monthBucket, 'month', monthOpeningBalance, runningBalance, `${getMonthLabel(date)} Summary`));
        monthBucket = [];
      }
    });

    return rows;
  }

  function balanceClass(value) {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return '';
  }

  function renderLedger(rows) {
    const tbody = document.getElementById('ledgerEntries');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">No expenses recorded yet. Add an expense to see it reflected here.</div>
          </td>
        </tr>`;
      return;
    }

    tbody.innerHTML = rows.map((row) => {
      if (row.type === 'summary') {
        return `
          <tr class="${row.kind}-summary">
            <td>${row.label}</td>
            <td>${formatCurrency(row.budget)}</td>
            <td>${formatCurrency(row.spent)}</td>
            <td class="${row.savings > 0 ? 'positive' : ''}">${formatCurrency(row.savings)}</td>
            <td class="${row.deficit > 0 ? 'negative' : ''}">${formatCurrency(row.deficit)}</td>
            <td class="${balanceClass(row.closingBalance)}">
              <span class="balance-opening">${formatCurrency(row.openingBalance)}</span>
              <span class="balance-arrow"> → </span>
              <span class="balance-closing">${formatCurrency(row.closingBalance)}</span>
            </td>
          </tr>`;
      }

      return `
        <tr>
          <td>${row.displayDate} (${row.day})</td>
          <td>${formatCurrency(row.budget)}</td>
          <td>${formatCurrency(row.spent)}</td>
          <td class="${row.savings > 0 ? 'positive' : ''}">${formatCurrency(row.savings)}</td>
          <td class="${row.deficit > 0 ? 'negative' : ''}">${formatCurrency(row.deficit)}</td>
          <td class="${balanceClass(row.runningBalance)}">${formatCurrency(row.runningBalance)}</td>
        </tr>`;
    }).join('');
  }

  function getStoredConfig() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.config) || 'null');
      return {
        dailyBudget: safeNumber(stored && stored.dailyBudget, 100),
        weekStartDay: safeNumber(stored && stored.weekStartDay, DEFAULT_WEEK_START_DAY)
      };
    } catch (error) {
      return { dailyBudget: 100, weekStartDay: DEFAULT_WEEK_START_DAY };
    }
  }

  function saveStoredConfig(config) {
    localStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config));
  }

  function populateBudgetField(config) {
    const budgetInput = document.getElementById('dailyBudgetInput');
    if (budgetInput) budgetInput.value = config.dailyBudget;

    // Optional — only touches the DOM if you've added this select.
    const weekStartSelect = document.getElementById('weekStartDaySelect');
    if (weekStartSelect) weekStartSelect.value = String(config.weekStartDay);
  }

  function handleBudgetSave() {
    const budgetInput = document.getElementById('dailyBudgetInput');
    const weekStartSelect = document.getElementById('weekStartDaySelect');

    const config = getStoredConfig();
    config.dailyBudget = safeNumber(budgetInput ? budgetInput.value : 100, 100);
    if (weekStartSelect) {
      config.weekStartDay = safeNumber(weekStartSelect.value, DEFAULT_WEEK_START_DAY);
    }

    saveStoredConfig(config);
    renderDailyBudgetLedger();
  }

  function renderDailyBudgetLedger() {
    const config = getStoredConfig();
    populateBudgetField(config);

    const rows = buildLedgerRows(config.dailyBudget, null, config.weekStartDay);
    renderLedger(rows);

    const summaryCount = document.getElementById('ledgerEntryCount');
    if (summaryCount) {
      summaryCount.textContent = `${rows.filter((row) => row.type === 'entry').length} entries`;
    }
  }

  function bindEvents() {
    const saveBudgetButton = document.getElementById('saveDailyBudget');
    if (saveBudgetButton) saveBudgetButton.addEventListener('click', handleBudgetSave);

    // Re-render whenever expenses change elsewhere in the app.
    // If your app has a custom event name for "expense added",
    // add/replace it here.
    window.addEventListener('storage', () => renderDailyBudgetLedger());
    document.addEventListener('expenses:changed', () => renderDailyBudgetLedger());
  }

  function initDailyBudgetLedgerPage() {
    bindEvents();
    renderDailyBudgetLedger();
  }

  root.buildLedgerRows = buildLedgerRows;
  root.getLedgerDataSourceEntries = getLedgerDataSourceEntries;
  root.renderDailyBudgetLedger = renderDailyBudgetLedger;
  root.initDailyBudgetLedgerPage = initDailyBudgetLedgerPage;
  root.setLedgerFilter = setLedgerFilter;
  root.clearLedgerFilter = clearLedgerFilter;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initDailyBudgetLedgerPage);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildLedgerRows, getStoredConfig, getLedgerDataSourceEntries, setLedgerFilter };
  }
})(typeof window !== 'undefined' ? window : globalThis);