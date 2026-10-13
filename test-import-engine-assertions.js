const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const context = {
    normalizeImportRawText: text => text.trim(),
    validateIncomingImportVersion: version => ({
        supported: version === "2.0.0",
        display: version,
        normalized: version
    }),
    normalizeImportPayload: parsed => ({
        normalized: parsed,
        report: { warnings: [] }
    }),
    buildImportDiagnostics: parsed => ({
        expensesCount: parsed.expenses.length,
        savingsCount: parsed.savings.length,
        budgetsCount: parsed.budgets.length,
        budgetPeriodsCount: parsed.budgetPeriods.length
    }),
    validateImportPayload: parsed => ({
        errors: [],
        warnings: [],
        normalized: parsed,
        version: "2.0.0"
    }),
    applyImportData: () => ({}),
    console
};

context.window = context;
vm.createContext(context);
vm.runInContext(
    `${fs.readFileSync("assets/scripts/importEngine.js", "utf8")}\nglobalThis.engine = ImportEngine;`,
    context
);

const expectedAssertions = [{ check: "budgetWalletTotal", expected: 100 }];
const payload = {
    meta: { version: "2.0.0" },
    expenses: [],
    savings: [],
    budgets: [],
    budgetPeriods: [],
    __expectedAssertions: expectedAssertions
};

context.engine.importPayload(JSON.stringify(payload)).then(result => {
    assert.deepStrictEqual(
        JSON.parse(JSON.stringify(result.testAssertions)),
        expectedAssertions
    );
    console.log("Import assertion metadata passed through the engine.");
}).catch(error => {
    console.error(error);
    process.exitCode = 1;
});
