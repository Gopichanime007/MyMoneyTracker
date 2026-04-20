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