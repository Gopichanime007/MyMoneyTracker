function getBudgets() {
    return getData("budgets");
}

function saveBudgets(list) {
    setData("budgets", list);
}

function createOrUpdateBudget(budgetId, sourceId, amount, entity) {
    let budgets = getBudgets();

    let existing = budgets.find(b => b.budgetId === budgetId);

    if (existing) {
        existing.totalAllocated += amount;
        existing.updatedAt = new Date().toISOString();
    } else {
        budgets.push({
            budgetId,
            sourceId,
            totalAllocated: amount,
            entity,
            monthKey: budgetId.replace("budget_", "").replace("_", "-"),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    saveBudgets(budgets);
}