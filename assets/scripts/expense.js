function getExpenses() {
  return getData("expenses");
}

function saveExpenses(list) {
  setData("expenses", list);
}

function addExpense(data) {
  let expenses = getExpenses();

  expenses.push({
    id: Date.now(),
    ...data
  });

  saveExpenses(expenses);
}

function deleteExpenseByIndex(index) {
  let expenses = getExpenses();
  expenses.splice(index, 1);
  saveExpenses(expenses);
}

function getExpensesByBudget(budgetId) {
  return getExpenses().filter(e => e.budgetId === budgetId);
}

function loadBudgetOptions() {

  let select = document.getElementById("budgetSelect");
  if (!select) return;

  let budgets = getBudgets();
  let expenses = getExpenses();

  let currentMonth = new Date().toISOString().slice(0, 7);

  select.innerHTML = "";

  let filtered = budgets.filter(b => b.monthKey === currentMonth);

  if (!filtered.length) {
    let opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No budgets available";
    select.appendChild(opt);
    return;
  }

  filtered.forEach(b => {

    let spent = expenses
      .filter(e => e.budgetId === b.budgetId && e.amount < 0)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let remaining = (b.totalAllocated || 0) - spent;

    let opt = document.createElement("option");

    opt.value = b.budgetId;

    opt.textContent = `${formatBudgetName(b.budgetId)} (${b.entity}) — ₹${remaining} left`;

    select.appendChild(opt);
  });
}

function getLoanSummary() {
  let expenses = getExpenses();

  let loans = {};

  expenses.forEach(e => {
    if (!e.entity) return;

    if (!loans[e.entity]) {
      loans[e.entity] = {
        given: 0,
        received: 0
      };
    }

    // Money given
    if (e.amount < 0) {
      loans[e.entity].given += Math.abs(e.amount);
    }

    // Money returned (Recovery only)
    if (e.amount > 0 && e.category === "Recovery") {
      loans[e.entity].received += e.amount;
    }
  });

  // Calculate pending
  let result = [];

  for (let person in loans) {
    let given = loans[person].given;
    let received = loans[person].received;

    result.push({
      person,
      given,
      received,
      pending: given - received
    });
  }

  return result;
}

function renderLoanSummary() {
  let data = getLoanSummary();
  let container = document.getElementById("loanSummary");

  if (!container) return;

  container.innerHTML = "";

  data.forEach(l => {
    let div = document.createElement("div");

    div.innerHTML = `
            <div class="loan-row">
                <span>${l.person}</span>
                <span>₹${l.pending}</span>
            </div>
        `;

    container.appendChild(div);
  });
}