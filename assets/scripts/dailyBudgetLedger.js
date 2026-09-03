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
  const QUERY_MODULE = 'dailyLedger';

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
  let ledgerFilterBuilder = null;
  let currentLedgerRows = [];

  function ensureQueryAdapter() {
    if (!root.SearchService || typeof root.SearchService.registerAdapter !== 'function') return;
    root.SearchService.registerAdapter(QUERY_MODULE, {
      searchFields: ['date', 'type', 'amount', 'category', 'purpose', 'entity', 'paymentType', 'budgetId', 'person']
    });
  }

  function getQueryState() {
    ensureQueryAdapter();
    if (!root.SearchService || typeof root.SearchService.getState !== 'function') {
      return { filters: [], sort: [] };
    }
    return root.SearchService.getState(QUERY_MODULE);
  }

  function getFilteredExpenses() {
    const source = getStoredExpenses().filter((entry) => {
      if (!entry || entry.isArchived === true || entry.archived === true) return false;
      if (String(entry.status || '').toLowerCase() === 'archived' || String(entry.archiveStatus || '').toLowerCase() === 'archived') return false;
      const amount = safeNumber(entry.amount, 0);
      return amount !== 0 && (entry.type === 'expense' || entry.type === 'loss' || amount < 0);
    });

    if (!root.SearchService || typeof root.SearchService.applyModuleSearch !== 'function') return source;
    const state = getQueryState();
    const filters = (Array.isArray(state.filters) ? state.filters : []).map((filter) => {
      if (filter && filter.field === 'date' && filter.op === 'between') {
        return {
          version: 'v1',
          field: 'date',
          op: 'period',
          value: { type: 'custom', from: filter.from, to: filter.to }
        };
      }
      return filter;
    });
    const result = root.SearchService.applyModuleSearch(QUERY_MODULE, source, {
      filters
    });
    return Array.isArray(result.results) ? result.results : source;
  }

  function sortLedgerRows(rows) {
    const state = getQueryState();
    const sort = Array.isArray(state.sort) && state.sort[0] ? state.sort[0] : { field: 'date', direction: 'desc' };
    const direction = String(sort.direction || 'desc').toLowerCase() === 'asc' ? 1 : -1;
    const entries = rows.filter((row) => row.type === 'entry').sort((a, b) => direction * (new Date(a.date) - new Date(b.date)));
    const summaries = rows.filter((row) => row.type === 'summary');
    return entries.concat(summaries);
  }

  function setLedgerFilter(filterFn) {
    activeExpenseFilter = typeof filterFn === 'function' ? filterFn : null;
    renderDailyBudgetLedger();
  }

  function openLedgerFilterModal() {
    initializeLedgerFilterBuilder();
    const modal = document.getElementById('dailyLedgerFilterModal');
    if (modal) {
      modal.classList.remove('hidden');
      modal.style.display = 'flex';
    }
  }

  function closeLedgerFilterModal() {
    const modal = document.getElementById('dailyLedgerFilterModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
    }
  }

  function initializeLedgerFilterBuilder() {
    if (ledgerFilterBuilder || !root.FilterBuilder || typeof root.FilterBuilder.create !== 'function') return;
    ledgerFilterBuilder = root.FilterBuilder.create({
      module: QUERY_MODULE,
      dateField: 'date',
      templates: [
        { key: 'date', label: 'Date', field: 'date', type: 'date', hint: 'Use Equals, Before, After, or Between' },
        { key: 'category', label: 'Category', field: 'category', type: 'text' },
        { key: 'type', label: 'Type', field: 'type', type: 'text' },
        { key: 'amount', label: 'Amount', field: 'amount', type: 'number' },
        { key: 'payment', label: 'Payment Type', field: 'paymentType', type: 'enum' },
        { key: 'source', label: 'Source', field: 'entity', type: 'text' }
      ],
      onApply: (filters) => {
        if (root.SearchService && typeof root.SearchService.setFilters === 'function') root.SearchService.setFilters(QUERY_MODULE, filters);
        closeLedgerFilterModal();
        renderDailyBudgetLedger();
      },
      onClear: () => {
        if (root.SearchService && typeof root.SearchService.clearFilters === 'function') root.SearchService.clearFilters(QUERY_MODULE);
        closeLedgerFilterModal();
        renderDailyBudgetLedger();
      },
      onClose: closeLedgerFilterModal
    });
    ledgerFilterBuilder.mount(document.getElementById('dailyLedgerFilterBuilderRoot'));
  }

  function handleLedgerSortChange(direction) {
    ensureQueryAdapter();
    if (root.SearchService && typeof root.SearchService.setSort === 'function') {
      root.SearchService.setSort(QUERY_MODULE, [{ field: 'date', direction: direction === 'asc' ? 'asc' : 'desc', type: 'date' }]);
    }
    renderDailyBudgetLedger();
  }

  async function downloadDailyBudgetLedger() {
    const rows = currentLedgerRows.slice();
    const payload = {
      type: 'daily-budget-ledger',
      exportedAt: new Date().toISOString(),
      dailyBudget: getStoredConfig().dailyBudget,
      query: getQueryState(),
      rows
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const filename = `MoneyTracker_DailyLedger_${new Date().toISOString().slice(0, 10)}.json`;

    if (typeof root.downloadBlobWithBestEffort === 'function') {
      await root.downloadBlobWithBestEffort(blob, filename);
      return;
    }

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
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
        if (!entry) return false;
        if (entry.isArchived === true || entry.archived === true ||
            String(entry.status || '').toLowerCase() === 'archived' ||
            String(entry.archiveStatus || '').toLowerCase() === 'archived') return false;
        // Corrections and Budget-closure returns aren't real spending —
        // don't let them inflate a day's "Spent" figure.
        if (entry.type === 'adjustment' || entry.type === 'transfer_back') return false;
        const amount = safeNumber(entry.amount, 0);
        return amount !== 0 && (entry.type === 'expense' || entry.type === 'loss' || amount < 0);
      })
      .filter((entry) => !activeExpenseFilter || activeExpenseFilter(entry))
      .map((entry) => ({
        date: entry.date || entry.createdAt || '',
        spent: Math.abs(safeNumber(entry.amount, 0))
      }));
  }

  function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
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

    const dailyTotals = new Map();
    rawEntries.forEach((entry) => {
      const dateKey = getDateKey(entry.date);
      if (!dateKey) return;
      dailyTotals.set(dateKey, (dailyTotals.get(dateKey) || 0) + entry.spent);
    });

    const sortedDates = [...dailyTotals.keys()].sort((a, b) => new Date(a) - new Date(b));

    const budget = safeNumber(dailyBudget, 100);
    const rows = [];

    // ⚠️ Week and Month each track against their OWN fixed budget
    // (dailyBudget × 7, dailyBudget × days-in-that-month) — every new
    // period opens fresh at its full budget, with no carryover of the
    // previous period's surplus or deficit.
    let weekSpentSoFar = 0;
    let weekCounter = 0;
    let monthSpentSoFar = 0;

    sortedDates.forEach((dateKey, index) => {
      const date = parseDate(dateKey);
      const spent = dailyTotals.get(dateKey);

      let savings = 0;
      let deficit = 0;
      if (spent < budget) {
        savings = budget - spent;
      } else if (spent > budget) {
        deficit = spent - budget;
      }

      const weekBudget = budget * 7;
      weekSpentSoFar += spent;
      monthSpentSoFar += spent;

      const row = {
        type: 'entry',
        date: dateKey,
        displayDate: formatDisplayDate(dateKey),
        day: getDayName(dateKey),
        budget,
        spent,
        savings,
        deficit,
        // How much of THIS week's ₹weekBudget is left after today.
        runningBalance: weekBudget - weekSpentSoFar
      };

      rows.push(row);

      const nextDateKey = sortedDates[index + 1];
      const nextDate = nextDateKey ? parseDate(nextDateKey) : null;
      const isLastRecord = !nextDate;

      const weekEnds = isLastRecord || getWeekKey(nextDate, weekStartDay) !== getWeekKey(date, weekStartDay);
      const monthEnds = isLastRecord || getMonthKey(nextDate) !== getMonthKey(date);

      if (weekEnds) {
        weekCounter += 1;
        rows.push({
          type: 'summary',
          kind: 'week',
          label: `Week ${weekCounter} Summary`,
          budget: weekBudget,
          spent: weekSpentSoFar,
          savings: Math.max(0, weekBudget - weekSpentSoFar),
          deficit: Math.max(0, weekSpentSoFar - weekBudget),
          openingBalance: weekBudget,
          closingBalance: weekBudget - weekSpentSoFar
        });
        weekSpentSoFar = 0;
      }

      if (monthEnds) {
        const daysInMonth = getDaysInMonth(date);
        const monthBudget = budget * daysInMonth;
        rows.push({
          type: 'summary',
          kind: 'month',
          label: `${getMonthLabel(date)} Summary`,
          budget: monthBudget,
          spent: monthSpentSoFar,
          savings: Math.max(0, monthBudget - monthSpentSoFar),
          deficit: Math.max(0, monthSpentSoFar - monthBudget),
          openingBalance: monthBudget,
          closingBalance: monthBudget - monthSpentSoFar
        });
        monthSpentSoFar = 0;
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

    const rows = sortLedgerRows(buildLedgerRows(config.dailyBudget, getFilteredExpenses(), config.weekStartDay));
    currentLedgerRows = rows.slice();
    renderLedger(rows);

    const summaryCount = document.getElementById('ledgerEntryCount');
    if (summaryCount) {
      summaryCount.textContent = `${rows.filter((row) => row.type === 'entry').length} entries`;
    }
  }

  function bindEvents() {
    ensureQueryAdapter();
    const filterButton = document.getElementById('dailyLedgerFilterButton');
    if (filterButton) filterButton.addEventListener('click', openLedgerFilterModal);
    const sortSelect = document.getElementById('dailyLedgerSort');
    if (sortSelect) {
      const state = getQueryState();
      sortSelect.value = Array.isArray(state.sort) && state.sort[0] && state.sort[0].direction === 'asc' ? 'asc' : 'desc';
      sortSelect.addEventListener('change', () => handleLedgerSortChange(sortSelect.value));
    }
    const downloadButton = document.getElementById('downloadDailyLedger');
    if (downloadButton) downloadButton.addEventListener('click', downloadDailyBudgetLedger);
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
  root.handleBudgetSave = handleBudgetSave;
  root.openLedgerFilterModal = openLedgerFilterModal;
  root.closeLedgerFilterModal = closeLedgerFilterModal;
  root.handleLedgerSortChange = handleLedgerSortChange;
  root.downloadDailyBudgetLedger = downloadDailyBudgetLedger;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initDailyBudgetLedgerPage);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildLedgerRows, getStoredConfig, getLedgerDataSourceEntries, setLedgerFilter };
  }
})(typeof window !== 'undefined' ? window : globalThis);