let currentFilteredExpenses = [];
/* =========================
   📦 STORAGE LAYER
========================= */

function getExpenses() {
    return JSON.parse(localStorage.getItem("expenses")) || [];
}

function saveExpenses(data) {
    localStorage.setItem("expenses", JSON.stringify(data));
}

function getBudgets() {
    return JSON.parse(localStorage.getItem("budgets")) || [];
}

function saveBudgets(data) {
    localStorage.setItem("budgets", JSON.stringify(data));
}

function getSavings() {
    return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}

function saveSavings(data) {
    localStorage.setItem("savingsTransactions", JSON.stringify(data));
}


/* =========================
   🧠 CORE LOGIC
========================= */

// ➕ Add Expense
function addExpense(obj) {
    let expenses = getExpenses();

    // ✅ FIX TYPE SAFELY
    let type = obj.type || (obj.amount < 0 ? "expense" : "income");

    // ✅ USER CONTROLLED CATEGORY (NO AUTO MAGIC)
    let category = obj.category || "Others";

    expenses.push({
        id: Date.now(),

        type: type,
        amount: obj.amount,

        category: category,   // ✅ correct

        purpose: obj.purpose || "",
        budgetId: obj.budgetId || null,
        entity: obj.entity || "Cash",

        date: obj.date
            ? new Date(obj.date).toISOString()
            : new Date().toISOString(),

        monthKey: (obj.date || new Date().toISOString()).slice(0, 7),

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    saveExpenses(expenses);
    updateProgressBar();
    loadBudgetOptions();
}


// ❌ Delete Expense
function deleteExpenseByIndex(index) {
    let expenses = getExpenses();

    if (index < 0 || index >= expenses.length) return;

    expenses.splice(index, 1);

    saveExpenses(expenses);
}


// 📊 Budget Balance
function getBudgetBalance(budgetId) {
    let expenses = getExpenses();

    let spent = expenses
        .filter(e => e.budgetId === budgetId && e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let budgets = getBudgets();

    let allocated = budgets
        .filter(b => b.budgetId === budgetId)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    return allocated - spent;
}


/* =========================
   🔔 SIMPLE TOAST (NO SPAM)
========================= */

let toastTimeout;

function showToast(msg) {
    clearTimeout(toastTimeout);

    let el = document.getElementById("toast");

    if (!el) {
        el = document.createElement("div");
        el.id = "toast";

        el.style.position = "fixed";
        el.style.bottom = "20px";
        el.style.left = "50%";
        el.style.transform = "translateX(-50%)";
        el.style.background = "#333";
        el.style.color = "#fff";
        el.style.padding = "10px 16px";
        el.style.borderRadius = "10px";
        el.style.fontSize = "14px";
        el.style.zIndex = "9999";

        document.body.appendChild(el);
    }

    el.innerText = msg;
    el.style.display = "block";

    toastTimeout = setTimeout(() => {
        el.style.display = "none";
    }, 1500);
}


/* =========================
   🖥️ UI FUNCTIONS
========================= */

// 📜 Load History
function loadHistory(list = getExpenses()) {
    currentFilteredExpenses = list;
    let container = document.getElementById("historyList");
    if (!container) return;

    container.innerHTML = "";

    if (!list.length) {
        container.innerHTML = `<p style="color:#888;">No data yet 📭</p>`;
        return;
    }

    list.forEach((e, index) => {
        let div = document.createElement("div");
        div.className = "expense-item";

        div.innerHTML = `
    <div class="expense-left">
      <strong>${e.category || e.purpose || e.type || "Entry"}</strong> -
      <span style="color:${e.amount < 0 ? 'red' : 'green'}">
        ₹${e.amount}
      </span><br>

      <small>
        ${e.paymentType || e.entity || e.sourceName || "-"} • 
        ${new Date(e.date).toLocaleString("en-IN")}
      </small>
    </div>

    <button class="delete-btn" onclick="deleteExpenseUI(${index})">
      🗑
    </button>
`;

        container.appendChild(div);
    });
}


// ❌ UI Delete Wrapper
function deleteExpenseUI(index) {
    deleteExpenseByIndex(index);
    loadHistory();
    showToast("Deleted");
}


/* =========================
   ➕ FORM HANDLER
========================= */

function handleAddExpense() {

    let amount = Number(document.getElementById("amount")?.value);
    let category = document.getElementById("category")?.value;
    let purpose = document.getElementById("purpose")?.value;
    let date = document.getElementById("expenseDate")?.value;
    let type = document.getElementById("entryType")?.value;
    let paymentType = document.getElementById("paymentType")?.value;
    let budgetId = document.getElementById("budgetSelect")?.value;

    // ✅ VALIDATION
    if (!amount) {
        showToast("Enter amount");
        return;
    }

    if (type === "expense" && !budgetId) {
        showToast("Select budget");
        return;
    }

    // ✅ SIGN FIX
    amount = type === "expense"
        ? -Math.abs(amount)
        : Math.abs(amount);

    // =========================
    // 🧠 DATE FIX LOGIC
    // =========================
    let selectedDate = date ? new Date(date) : new Date();
    let today = new Date();

    if (selectedDate.toDateString() === today.toDateString()) {
        // ✅ TODAY → current time
        selectedDate = new Date();
    } else {
        // ✅ PAST → end of day
        selectedDate.setHours(23, 59, 59, 999);
    }

    // =========================
    // ➕ SAVE EXPENSE
    // =========================
    addExpense({
        amount,
        category,
        purpose,
        date: selectedDate.toISOString(), // ✅ FIXED
        type,
        paymentType,
        budgetId
    });

    // =========================
    // 🔄 UI UPDATES
    // =========================
    showToast("Added");

    resetForm();
    loadHistory();
    loadBudgetOptions();
    loadDashboard();   // 🔥 important
    loadGraph();
    updateProgressBar();       // 🔥 refresh graph
}


// 🧹 Reset Form
function resetForm() {
    document.getElementById("amount").value = "";
    document.getElementById("purpose").value = "";

    let today = new Date().toISOString().split("T")[0];
    document.getElementById("expenseDate").value = today;
}


/* =========================
   🚀 INIT
========================= */

window.onload = () => {
    loadHistory();
    initCategories();   // 🔥 ADD THIS
    loadTheme();        // 🔥 ADD THIS
    updateUI();         // 🔥 ADD THIS
    loadBudgetOptions();
    loadDashboard();
    loadBudgetScreen();
    loadGraph("day");

    let today = new Date().toISOString().split("T")[0];
    let dateInput = document.getElementById("expenseDate");

    if (dateInput) dateInput.value = today;

    renderCategoryList();
    setDefaultDate();
    bindRemainingCard();
    renderBudgetEntries();
    renderCategoryBreakdown();
};

function showScreen(id) {
    const screens = document.querySelectorAll(".screen");
    const buttons = document.querySelectorAll(".nav button");

    screens.forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");

    buttons.forEach(btn => btn.classList.remove("active"));
    document.querySelector(`[data-screen="${id}"]`)?.classList.add("active");

    if (id === "history") loadHistory();
    if (id === "budgetEntries") {
        renderBudgetEntries();
    }
    if (id === "graph") {
        loadGraph();
    }
}

function getCategories() {
    return JSON.parse(localStorage.getItem("categories")) || [];
}

function saveCategories(data) {
    localStorage.setItem("categories", JSON.stringify(data));
}

function initCategories() {
    let categories = getCategories();

    if (!categories.length) {
        categories = ["Food", "Travel", "Bills", "Entertainment", "Loan", "Recovery", "Others"];
        saveCategories(categories);
    }

    loadCategories();
}

function loadCategories() {
    let select = document.getElementById("category");
    if (!select) return;

    let categories = getCategories();

    select.innerHTML = "";

    //let categories = getCategories();

    if (!categories.length) {
        let option = document.createElement("option");
        option.value = "";
        option.textContent = "No categories - Add one";
        select.appendChild(option);
        return;
    }

    categories.forEach(cat => {
        let option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function addCategory() {
    let input = document.getElementById("newCategory");
    let val = input.value.trim();

    if (!val) return;

    let categories = getCategories();

    if (categories.includes(val)) {
        showToast("Already exists");
        return;
    }

    categories.push(val);
    saveCategories(categories);

    input.value = "";

    loadCategories();
    renderCategoryList();
}

function deleteCategory(index) {
    let categories = getCategories();

    categories.splice(index, 1);

    saveCategories(categories);

    loadCategories();
    renderCategoryList();
}

function renderCategoryList() {
    let container = document.getElementById("categoryList");
    if (!container) return;

    let categories = getCategories();

    container.innerHTML = "";

    categories.forEach((cat, i) => {
        let div = document.createElement("div");

        div.innerHTML = `
  <div class="cat-row">
    <span class="cat-name">${cat}</span>
    <button class="cat-delete" onclick="deleteCategory(${i})">✕</button>
  </div>
`;

        container.appendChild(div);
    });
}


function setDefaultDate() {
    let today = new Date().toISOString().split("T")[0];
    let el = document.getElementById("expenseDate");

    if (el) el.value = today;
}

function showDate() {
    let el = document.getElementById("dateDisplay");
    if (el) el.innerText = new Date().toLocaleString();
}

function changeTheme(c) {
    localStorage.setItem("theme", c);
    document.documentElement.style.setProperty("--theme", c);
}

function loadTheme() {
    let t = localStorage.getItem("theme");
    if (t) changeTheme(t);
}

function updateUI() {
    let expenses = getExpenses();

    let total = expenses.reduce((s, e) => s + e.amount, 0);

    let spent = expenses
        .filter(e => e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    let income = expenses
        .filter(e => e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    let elSpent = document.getElementById("spent");
    let elIncome = document.getElementById("income");

    if (elSpent) elSpent.innerText = spent;
    if (elIncome) elIncome.innerText = income;
}

function handleFilter(type) {
    let expenses = getExpenses();
    let now = new Date();

    let filtered = expenses.filter(e => {
        let d = new Date(e.date);

        if (type === "today") return d.toDateString() === now.toDateString();

        if (type === "month") {
            return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );
        }

        return true;
    });

    loadHistory(filtered);
}

function getSelectedBudgetId() {
    let select = document.getElementById("budgetSelect");
    return select ? select.value : null;
}


function applyDateFilter() {
    let from = document.getElementById("fromDate").value;
    let to = document.getElementById("toDate").value;

    if (!from || !to) {
        showToast("Select dates");
        return;
    }

    let fromDate = new Date(from);
    let toDate = new Date(to);

    let filtered = getExpenses().filter(e => {
        let d = new Date(e.date);
        return d >= fromDate && d <= toDate;
    });

    loadHistory(filtered);
}

function applyPeriod(type) {
    let now = new Date();

    let filtered = getExpenses().filter(e => {
        let d = new Date(e.date);

        if (type === "today") {
            return d.toDateString() === now.toDateString();
        }

        if (type === "week") {
            let start = new Date();
            start.setDate(now.getDate() - 7);
            return d >= start;
        }

        if (type === "month") {
            return (
                d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            );
        }

        return true;
    });

    loadHistory(filtered);
    loadGraph(type, filtered);
}

function getInsights() {
    let data = getExpenses();

    if (!data.length) return;

    let total = data.reduce((s, e) => s + Math.abs(e.amount), 0);

    let topCategory = {};

    data.forEach(e => {
        if (!topCategory[e.category]) topCategory[e.category] = 0;
        topCategory[e.category] += Math.abs(e.amount);
    });

    let maxCat = Object.keys(topCategory).reduce((a, b) =>
        topCategory[a] > topCategory[b] ? a : b
    );

    showToast(`Top spending: ${maxCat}`);
}

function openDateModal() {
    let modal = document.getElementById("dateModal");
    if (modal) modal.style.display = "flex";
}

function closeDateModal() {
    let modal = document.getElementById("dateModal");
    if (modal) modal.style.display = "none";
}


function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const dataSource = currentFilteredExpenses.length
        ? currentFilteredExpenses
        : getExpenses();

    let y = 12;

    // =========================
    // 🟢 HEADER CARD
    // =========================
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(10, 8, 190, 22, 3, 3, "F");

    doc.setFontSize(16); // 🔽 reduced
    doc.setFont(undefined, "bold");
    doc.text("Money Tracker Report", 14, 17);

    doc.setFontSize(8); // 🔽 reduced
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Total Entries: ${dataSource.length}`, 14, 26);

    doc.setTextColor(0);
    y = 34;

    // =========================
    // 💰 SUMMARY CARDS
    // =========================
    const drawCard = (x, title, value, r, g, b) => {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(230);
        doc.roundedRect(x, y, 60, 18, 3, 3, "FD");

        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(title, x + 5, y + 6);

        doc.setFontSize(11);
        doc.setTextColor(r, g, b);
        doc.text(`Rs. ${value}`, x + 5, y + 13);
    };

    const totalIncome = dataSource.filter(e => e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    const totalExpense = dataSource.filter(e => e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    const net = totalIncome - totalExpense;

    drawCard(10, "Income", totalIncome, 0, 150, 0);
    drawCard(75, "Expense", totalExpense, 200, 0, 0);
    drawCard(140, "Net", net, net >= 0 ? 0 : 200, net >= 0 ? 150 : 0, 0);

    y += 28;

    // =========================
    // 📊 TABLE HEADER
    // =========================
    const col = {
        date: 20,
        type: 45,
        category: 70,
        payment: 100,
        amount: 150,
        purpose: 170
    };

    const theme = localStorage.getItem("theme") || "#4caf50";
    const { r, g, b } = hexToRgb(theme);

    doc.setFillColor(Math.max(0, r - 20), Math.max(0, g - 20), Math.max(0, b - 20));
    doc.rect(10, y - 5, 190, 9, "F"); // 🔽 reduced height

    doc.setTextColor(255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(9); // 🔽 reduced

    doc.text("Date", col.date, y + 2, { align: "center" });
    doc.text("Type", col.type, y + 2, { align: "center" });
    doc.text("Category", col.category, y + 2);

    // ✅ SINGLE LINE PayType
    doc.text("PayType", col.payment, y + 2);

    doc.text("Amount", col.amount, y + 2, { align: "right" });
    doc.text("Purpose", col.purpose, y + 2);

    y += 9;

    // =========================
    // 📄 TABLE DATA
    // =========================
    doc.setTextColor(0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8); // 🔽 reduced

    dataSource.forEach((e, index) => {
        const date = new Date(e.date).toLocaleDateString("en-IN");
        const category = e.category || "Others";
        const amount = Number(e.amount || 0);
        const purpose = e.purpose || "N/A";
        const payment = e.paymentType || e.entity || "-";
        const type = e.type ? e.type.toUpperCase() : (amount < 0 ? "EXPENSE" : "INCOME");

        const formatted = new Intl.NumberFormat("en-IN").format(Math.abs(amount));

        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(10, y - 4, 190, 8, "F");
        }

        doc.text(date, col.date, y, { align: "center" });

        doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);
        doc.text(type, col.type, y, { align: "center" });

        doc.setTextColor(0);
        doc.text(category, col.category, y);

        doc.text(payment, col.payment, y);

        doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);
        doc.text(`Rs. ${formatted}`, col.amount, y, { align: "right" });

        doc.setTextColor(0);

        const splitPurpose = doc.splitTextToSize(purpose, 40);
        doc.text(splitPurpose, col.purpose, y);

        y += Math.max(9, splitPurpose.length * 5);
    });

    // =========================
    // 🟣 BUDGET SUMMARY
    // =========================
    y += 8;

    doc.setDrawColor(200);
    doc.line(10, y, 200, y);

    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Budget Summary (Monthly)", 14, y);

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Overview of budget vs spending", 14, y);

    doc.setTextColor(0);

    y += 5;

    const mcol = {
        month: 14,
        budget: 90,
        spent: 130,
        remaining: 170
    };

    doc.setFont(undefined, "bold");
    doc.setFontSize(8);

    doc.text("Month", mcol.month, y);
    doc.text("Budget", mcol.budget, y, { align: "right" });
    doc.text("Spent", mcol.spent, y, { align: "right" });
    doc.text("Remaining", mcol.remaining, y, { align: "right" });

    y += 5;
    doc.setFont(undefined, "normal");

    const monthMap = {};

    dataSource.forEach(e => {
        let key = new Date(e.date).toISOString().slice(0, 7);
        if (!monthMap[key]) monthMap[key] = 0;

        if (e.amount < 0) {
            monthMap[key] += Math.abs(e.amount);
        }
    });

    Object.keys(monthMap).forEach((month, index) => {
        let spent = monthMap[month];
        let budget = getTotalBudget(month);
        let remaining = budget - spent;

        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(10, y - 3, 190, 7, "F");
        }

        doc.text(month, mcol.month, y);
        doc.text(`Rs. ${budget}`, mcol.budget, y, { align: "right" });
        doc.text(`Rs. ${spent}`, mcol.spent, y, { align: "right" });

        doc.setTextColor(remaining < 0 ? 200 : 0, remaining < 0 ? 0 : 150, 0);
        doc.text(`Rs. ${remaining}`, mcol.remaining, y, { align: "right" });

        doc.setTextColor(0);

        y += 7;
    });

    // =========================
    // 💾 SAVE
    // =========================
    doc.save("money-tracker-report.pdf");
}
function hexToRgb(hex) {
    hex = hex.replace("#", "");

    if (hex.length === 3) {
        hex = hex.split("").map(x => x + x).join("");
    }

    let bigint = parseInt(hex, 16);

    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return { r, g, b };
}

function getTotalBudget(monthKey) {
    let budgets = getBudgets();

    return budgets
        .filter(b => b.monthKey === monthKey)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);
}

function saveExpense() {
    handleAddExpense();
}
function exportPDF() {
    downloadPDF();
}
function handleGraphFilter(type) {
    loadGraph(type);
}
function openCustomModal() {
    openDateModal();
}
function applyPeriodFromModal() {

    let from = document.getElementById("startDate").value;
    let to = document.getElementById("endDate").value;

    let filtered = getExpenses().filter(e => {
        let d = new Date(e.date);
        return d >= new Date(from) && d <= new Date(to);
    });

    loadGraph("custom", filtered, { start: from, end: to });
}
// function loadBudgetOptions() {
//     let select = document.getElementById("budgetSelect");
//     if (!select) return;

//     let budgets = getBudgets();

//     select.innerHTML = "";

//     if (!budgets.length) {
//         let opt = document.createElement("option");
//         opt.value = "";
//         opt.textContent = "No budgets available";
//         select.appendChild(opt);
//         return;
//     }

//     budgets.forEach(b => {
//         let opt = document.createElement("option");
//         opt.value = b.budgetId;
//         opt.textContent = formatBudgetName(b.budgetId);
//         select.appendChild(opt);
//     });
// }

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

        let label = formatMonth(b.monthKey);

        opt.textContent = `${label} (${b.entity}) — ₹${remaining} left`;

        select.appendChild(opt);
    });
}

function formatBudgetName(budgetId) {
    if (!budgetId) return "Unknown";

    let parts = budgetId.split("_");

    if (parts.length < 3) return budgetId;

    let part1 = parts[1];
    let part2 = parts[2];

    let year, month;

    if (part1.length === 4) {
        year = part1;
        month = part2;
    } else {
        month = part1;
        year = part2;
    }

    let date = new Date(`${year}-${month}-01`);

    return date.toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}

// Saves manual budget entry from UI
function saveBudget() {
    let amount = Number(document.getElementById("budgetAmount").value);
    let month = document.getElementById("budgetMonth").value;

    if (!amount || !month) {
        showToast("Enter amount & month");
        return;
    }

    let budgetId = "budget_" + month.replace("-", "_");

    createOrUpdateBudget(budgetId, null, amount, "Manual");

    showToast("Budget saved");

    loadBudgetOptions();
}
// Placeholder for quotation feature (future)
function openQuotation() {
    showToast("Coming soon 🚀");
}

// Shares exported PDF (basic fallback)
function sharePDF() {
    downloadPDF();
    showToast("Download started (share manually)");
}
// Handles theme selection
function handleTheme(val) {
    if (val === "custom") {
        document.getElementById("colorPicker").style.display = "block";
    } else {
        changeTheme(val);
    }
}
// Applies custom color theme
function applyCustomColor(color) {
    changeTheme(color);
}

// Opens category modal
function openCategoryModal() {
    document.getElementById("categoryModal").style.display = "flex";
}

// Closes category modal
function closeCategoryModal() {
    document.getElementById("categoryModal").style.display = "none";
}
// Opens period modal
function openPeriod() {
    document.getElementById("periodModal").style.display = "flex";
}

// Closes period modal
function closePeriod() {
    document.getElementById("periodModal").style.display = "none";
}
// Exports full data backup as JSON
function exportDataAsPDF() {
    let data = {
        expenses: getExpenses(),
        budgets: getBudgets(),
        savings: getSavings()
    };

    let blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    let url = URL.createObjectURL(blob);

    let a = document.createElement("a");
    a.href = url;
    a.download = "backup.json";
    a.click();
}
// Imports JSON backup into localStorage
// function importData() {
//     let text = document.getElementById("importText").value;

//     if (!text) {
//         showToast("Paste data");
//         return;
//     }

//     let data = JSON.parse(text);

//     if (data.expenses) saveExpenses(data.expenses);
//     if (data.budgets) saveBudgets(data.budgets);
//     if (data.savings) saveSavings(data.savings);

//     showToast("Imported successfully");
// }
function importData() {
    let text = document.getElementById("importText").value;

    if (!text) {
        showToast("Paste data");
        return;
    }

    try {
        let data = JSON.parse(text);

        if (data.expenses) saveExpenses(data.expenses);
        if (data.budgets) saveBudgets(data.budgets);
        if (data.savings) saveSavings(data.savings);

        showToast("Imported successfully");

        // 🔄 Refresh UI
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        renderBudgetEntries();   // 🔥 ADD THIS

        // 🧹 Clear input
        document.getElementById("importText").value = "";

        // ❌ Close modal
        closeImportModal();

    } catch (err) {
        showToast("Invalid JSON ❌");
    }
}
// Fixes old data structure to new system
function runMigration() {
    let budgets = getBudgets();

    budgets.forEach(b => {
        if (b.amount && !b.totalAllocated) {
            b.totalAllocated = b.amount;
            delete b.amount;
        }
    });

    saveBudgets(budgets);

    showToast("Migration done");
}
function openQuotation() {
    window.location.href = "quotation.html";
}

// =========================
// 🔗 OPEN SAVINGS PAGE
// =========================
// Navigates user to savings screen
// function openSavingsPage() {
//     window.location.href = "savings.html";
// }
// =========================
// 🔗 NAVIGATE TO SAVINGS
// =========================
// Opens savings page when Remaining card is clicked
function bindRemainingCard() {
    let card = document.getElementById("remainingCard");

    if (!card) return;

    card.addEventListener("click", () => {
        window.location.href = "savings.html";
    });
}
// =========================
// 📊 LOAD DASHBOARD SUMMARY
// =========================
// Calculates Budget, Spent, Remaining, Today
// function loadDashboard() {

//     let savings = getSavings();   // always latest
//     let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
//     let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

//     // 💰 TOTAL SAVINGS
//     let totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

//     // 📦 TOTAL BUDGET
//     let currentMonth = new Date().toISOString().slice(0, 7);

//     let totalBudget = budgets
//         .filter(b => b.monthKey === currentMonth)
//         .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//     // 💰 INCOME
//     let totalIncome = expenses
//         .filter(e =>
//             e.amount > 0 &&
//             e.monthKey === currentMonth   // 🔥 IMPORTANT
//         )
//         .reduce((sum, e) => sum + e.amount, 0);

//     // 💸 EXPENSE
//     let totalSpent = expenses
//         .filter(e =>
//             e.amount < 0 &&
//             e.monthKey === currentMonth   // 🔥 IMPORTANT
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // 📊 NET
//     let net = totalIncome - totalSpent;

//     // 🟢 REMAINING (based on budget)
//     let remaining = totalBudget - totalSpent;

//     // 📅 TODAY SPENT
//     let today = new Date().toDateString();

//     let todaySpent = expenses
//         .filter(e =>
//             new Date(e.date).toDateString() === today &&
//             e.amount < 0
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // =========================
//     // 🖥️ UPDATE UI
//     // =========================
//     document.getElementById("budgetValue").innerText = totalBudget;
//     document.getElementById("spent").innerText = totalSpent;
//     document.getElementById("remaining").innerText = remaining;
//     document.getElementById("todaySpent").innerText = todaySpent;
//     document.getElementById("incomeValue").innerText = totalIncome;
//     document.getElementById("netValue").innerText = net;
// }
// function loadDashboard() {

//     let savings = getSavings();
//     let budgets = getBudgets();
//     let expenses = getExpenses();

//     let currentMonth = new Date().toISOString().slice(0, 7);

//     // 💰 TOTAL SAVINGS
//     let totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

//     // 📦 TOTAL BUDGET (ONLY CURRENT MONTH)
//     let totalBudget = budgets
//         .filter(b => b.monthKey === currentMonth)
//         .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//     // 💰 INCOME (ONLY CURRENT MONTH)
//     let totalIncome = expenses
//         .filter(e => e.amount > 0 && e.monthKey === currentMonth)
//         .reduce((sum, e) => sum + e.amount, 0);

//     // 💸 EXPENSE (ONLY CURRENT MONTH)
//     let totalSpent = expenses
//         .filter(e => e.amount < 0 && e.monthKey === currentMonth)
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // 📊 NET
//     let net = totalIncome - totalSpent;

//     // 🟢 REMAINING
//     let remaining = totalBudget - totalSpent;

//     // 📅 TODAY SPENT
//     let today = new Date().toDateString();

//     let todaySpent = expenses
//         .filter(e =>
//             new Date(e.date).toDateString() === today &&
//             e.amount < 0
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // UI
//     document.getElementById("budgetValue").innerText = totalBudget;
//     document.getElementById("spent").innerText = totalSpent;
//     document.getElementById("remaining").innerText = remaining;
//     document.getElementById("todaySpent").innerText = todaySpent;
//     document.getElementById("incomeValue").innerText = totalIncome;
//     document.getElementById("netValue").innerText = net;
// }
function loadDashboard() {

    let savings = getSavings();
    let budgets = getBudgets();
    let expenses = getExpenses();

    let currentMonth = new Date().toISOString().slice(0, 7);

    let totalBudget = budgets
        .filter(b => b.monthKey === currentMonth)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let totalIncome = expenses
        .filter(e => e.amount > 0 && e.monthKey === currentMonth)
        .reduce((sum, e) => sum + e.amount, 0);

    let totalSpent = expenses
        .filter(e => e.amount < 0 && e.monthKey === currentMonth)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let net = totalIncome - totalSpent;
    let remaining = totalBudget - totalSpent;

    let today = new Date().toDateString();

    let todaySpent = expenses
        .filter(e =>
            new Date(e.date).toDateString() === today &&
            e.amount < 0
        )
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    document.getElementById("budgetValue").innerText = totalBudget;
    document.getElementById("spent").innerText = totalSpent;
    document.getElementById("remaining").innerText = remaining;
    document.getElementById("todaySpent").innerText = todaySpent;
    document.getElementById("incomeValue").innerText = totalIncome;
    document.getElementById("netValue").innerText = net;
    updateProgressBar();
}
// =========================
// 📦 LOAD BUDGET SCREEN
// =========================
// Loads current month's budget into UI
function loadBudgetScreen() {

    let budgets = getBudgets();
    let currentMonth = new Date().toISOString().slice(0, 7);

    let budget = budgets.find(b => b.monthKey === currentMonth);
    let total = budgets
        .filter(b => b.monthKey === currentMonth)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let budgetEl = document.getElementById("currentBudget");
    if (budgetEl) budgetEl.innerText = "₹" + total;

    let daily = getDailyLimit();

    let dailyEl = document.getElementById("calculatedDaily"); // ✅ FIXED
    if (dailyEl) dailyEl.innerText = "₹" + daily;
}
// =========================
// 📜 RENDER BUDGET LIST
// =========================
// Displays all budget entries
function renderBudgetEntries() {
    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetEntries");
    if (!container) return;

    container.innerHTML = "";

    if (!budgets.length) {
        container.innerHTML = "<p>No budget entries</p>";
        return;
    }

    // 🔥 GROUP BY SOURCE + MONTH
    let map = {};

    budgets.forEach(b => {
        let key = b.sourceId + "_" + b.monthKey;

        if (!map[key]) {
            map[key] = {
                sourceId: b.sourceId,
                monthKey: b.monthKey,
                totalAllocated: 0,
                entity: b.entity
            };
        }

        map[key].totalAllocated += b.totalAllocated || 0;
    });

    let list = Object.values(map).reverse();

    list.forEach(g => {

        let budgetId = `budget_${g.monthKey}_${g.sourceId}`;

        let used = expenses
            .filter(e =>
                e.budgetId === budgetId &&
                e.type === "expense"
            )
            .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        let remaining = g.totalAllocated - used;

        let source = savings.find(s => s.id === g.sourceId);
        let name = source ? (source.note || source.entity) : "Budget";

        let monthYear = formatMonth(g.monthKey);

        let statusText = remaining <= 0
            ? "❌ Exhausted"
            : `₹${remaining} left`;

        let statusClass = remaining <= 0 ? "red" : "green";

        let div = document.createElement("div");
        div.className = "income-card";

        div.innerHTML = `
    <div class="budget-card">

        <div class="budget-left">
            <div class="budget-title">${name}</div>
            <div class="budget-sub">${monthYear}</div>
        </div>

        <div class="budget-right">
            <div class="budget-amount">₹${g.totalAllocated}</div>
            <div class="budget-status ${remaining <= 0 ? "exhausted" : "active"}">
                ${remaining <= 0 ? "Exhausted" : `₹${remaining} left`}
            </div>
        </div>

    </div>
`;

        div.style.cursor = "pointer";
        div.onclick = () => openBudgetDetails(g);

        container.appendChild(div);
    });
}

function openBudgetDetails(group) {

    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetDetailsContainer");
    if (!container) return;

    let budgetId = `budget_${group.monthKey}_${group.sourceId}`;

    let source = savings.find(s => s.id === group.sourceId);
    let name = source ? (source.note || source.entity) : "Budget";

    let related = expenses.filter(e => e.budgetId === budgetId);

    let used = related
        .filter(e => e.type === "expense")
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let remaining = group.totalAllocated - used;

    let monthYear = formatMonth(group.monthKey);

    // 🔥 BUILD ENTRIES HTML FIRST
    let entriesHtml = "";

    if (!related.length) {
        entriesHtml = "<p>No entries</p>";
    } else {
        related.forEach(e => {
            let color = e.amount < 0 ? "red" : "green";

            entriesHtml += `
                <div class="expense-item">
                    <div>
                        <strong>${e.purpose || e.category || "Entry"}</strong><br>
                        <small>${new Date(e.date).toLocaleString()}</small>
                    </div>

                    <div style="color:${color}; font-weight:600;">
                        ₹${Math.abs(e.amount)}
                    </div>
                </div>
            `;
        });
    }

    // 🔥 SWITCH SCREEN
    showScreen("budgetDetails");

    // ✅ SINGLE CLEAN UI (NO DUPLICATE)
    container.innerHTML = `
        <div class="card">

            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3>${name}</h3>
                <button class="back-btn" onclick="goBackToBudgets()" class="secondary">← Back</button>
            </div>

            <small>${monthYear}</small>

            <p>Allocated: ₹${group.totalAllocated}</p>
            <p>Used: ₹${used}</p>
            <p>Remaining: ₹${remaining}</p>

            <hr>

            <h4>Entries</h4>

            ${entriesHtml}

        </div>
    `;
}

function goBackToBudgets() {
    showScreen("budgets");
    renderBudgetEntries();
}
// =========================
// 📅 CALCULATE DAILY LIMIT
// =========================
// Returns how much you can spend per day
function getDailyLimit() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    let currentMonth = new Date().toISOString().slice(0, 7);

    let budget = budgets.find(b => b.monthKey === currentMonth);

    let totalBudget = budget ? (budget.totalAllocated || 0) : 0;

    let spent = expenses
        .filter(e => e.monthKey === currentMonth && e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    let remaining = totalBudget - spent;

    // 📅 days left
    let today = new Date();
    let lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    let daysLeft = lastDay.getDate() - today.getDate() + 1;

    if (daysLeft <= 0) return 0;

    return Math.floor(remaining / daysLeft);
}

// =========================
// 📊 LOAD GRAPH (MERGED VERSION)
// =========================
// Shows day/week/month + category breakdown
let chart;

function loadGraph(type = "day", data = null, customRange = null) {

    const ctx = document.getElementById("myChart");
    if (!ctx || !window.Chart) return;

    if (chart) chart.destroy();

    const expenses = data || getExpenses();
    const now = new Date();

    const dataset = groupData(expenses, type, now, customRange);

    const chartData = prepareChartData(dataset);
    const datasets = createDatasets(chartData);

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: chartData.labels,
            datasets: datasets
        },
        options: getChartOptions(type, expenses, dataset, now, customRange)
    });

    // 🔥 Initial Category Breakdown
    const filtered = filterDataByType(type, expenses, now, customRange);
    renderCategoryBreakdown(groupByCategory(filtered));
}
function prepareChartData(dataset) {
    return {
        labels: dataset.map(d => d.label),
        expense: dataset.map(d => d.exp),
        income: dataset.map(d => d.inc),
        total: dataset.map(d => d.inc - d.exp)
    };
}
function createDatasets(data) {

    const dailyBudget = getDailyLimit ? getDailyLimit() : 0;
    const budgetData = data.labels.map(() => dailyBudget);

    return [
        {
            label: "Expense",
            data: data.expense,
            backgroundColor: "rgba(255,99,132,0.7)"
        },
        {
            label: "Income",
            data: data.income,
            backgroundColor: "rgba(75,192,192,0.7)"
        },
        {
            label: "Total",
            data: data.total,
            type: "line",
            borderColor: "purple",
            tension: 0.4
        },
        {
            label: "Budget",
            data: budgetData,
            type: "line",
            borderColor: "orange",
            borderDash: [5, 5]
        }
    ];
}
function getChartOptions(type, expenses, dataset, now, customRange) {

    return {
        responsive: true,
        maintainAspectRatio: false,

        plugins: {
            tooltip: {
                mode: "index",
                intersect: false,
                callbacks: {
                    label: function (ctx) {
                        return `${ctx.dataset.label}: ₹${ctx.raw}`;
                    }
                }
            }
        },

        scales: {
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 45
                }
            },
            y: {
                beginAtZero: true
            }
        },

        onClick: function (evt, elements) {
            if (!elements.length) return;

            const index = elements[0].index;
            const filtered = handlePointClick(type, index, expenses, dataset, now, customRange);

            renderCategoryBreakdown(groupByCategory(filtered));
        }
    };
}
function handlePointClick(type, index, expenses, dataset, now, customRange) {

    // ✅ DAY (hour-based)
    if (type === "day") {
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getHours() === index &&
                d.toDateString() === now.toDateString();
        });
    }

    // ✅ RANGE (date-based)
    const selected = dataset[index];
    if (!selected || !selected.key) return [];

    return expenses.filter(e => {
        const d = new Date(e.date);
        const dKey = d.toLocaleDateString("en-CA");

        return dKey === selected.key;
    });
}
function filterDataByType(type, expenses, now, customRange) {

    if (type === "day") {
        return expenses.filter(e =>
            new Date(e.date).toDateString() === now.toDateString()
        );
    }

    if (type === "week") {
        const start = new Date(now);
        start.setDate(now.getDate() - now.getDay());

        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        return expenses.filter(e => {
            const d = new Date(e.date);
            return d >= start && d <= end;
        });
    }

    if (type === "month") {
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth();
        });
    }

    if (type === "custom" && customRange) {
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d >= new Date(customRange.start) &&
                d <= new Date(customRange.end);
        });
    }

    return [];
}

// function loadGraph(type = "day", data = null) {

//     let ctx = document.getElementById("myChart");
//     if (!ctx || !window.Chart) return;

//     if (chart) chart.destroy();

//     // ✅ USE NEW SYSTEM DATA
//     let expenses = data || getExpenses();

//     let labels = [], expenseData = [], incomeData = [];
//     let now = new Date();

//     // =========================
//     // 📊 DATA BUILD
//     // =========================

//     if (type === "day") {
//         for (let i = 0; i < 24; i++) {
//             labels.push(i + ":00");

//             let exp = 0, inc = 0;

//             expenses.forEach(e => {
//                 let d = new Date(e.date);

//                 if (
//                     d.toDateString() === now.toDateString() &&
//                     d.getHours() === i
//                 ) {
//                     e.amount < 0 ? exp += Math.abs(e.amount) : inc += e.amount;
//                 }
//             });

//             expenseData.push(exp);
//             incomeData.push(inc);
//         }
//     }

//     if (type === "week") {
//         let start = new Date(now);
//         start.setDate(now.getDate() - now.getDay());

//         for (let i = 0; i < 7; i++) {
//             let day = new Date(start);
//             day.setDate(start.getDate() + i);

//             labels.push(day.toLocaleDateString("en-IN", { weekday: "short" }));

//             let exp = 0, inc = 0;

//             expenses.forEach(e => {
//                 let d = new Date(e.date);

//                 if (d.toDateString() === day.toDateString()) {
//                     e.amount < 0 ? exp += Math.abs(e.amount) : inc += e.amount;
//                 }
//             });

//             expenseData.push(exp);
//             incomeData.push(inc);
//         }
//     }

//     if (type === "month") {
//         let days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

//         for (let i = 1; i <= days; i++) {
//             labels.push(i);

//             let exp = 0, inc = 0;

//             expenses.forEach(e => {
//                 let d = new Date(e.date);

//                 if (
//                     d.getMonth() === now.getMonth() &&
//                     d.getDate() === i
//                 ) {
//                     e.amount < 0 ? exp += Math.abs(e.amount) : inc += e.amount;
//                 }
//             });

//             expenseData.push(exp);
//             incomeData.push(inc);
//         }
//     }

//     // =========================
//     // 💰 BUDGET FIX
//     // =========================
//     let dailyBudget = getDailyLimit ? getDailyLimit() : 0;
//     let budgetData = labels.map(() => dailyBudget);

//     // =========================
//     // 📊 CHART
//     // =========================
//     chart = new Chart(ctx, {
//         type: "bar",
//         data: {
//             labels,
//             datasets: [
//                 {
//                     label: "Expense",
//                     data: expenseData
//                 },
//                 {
//                     label: "Income",
//                     data: incomeData
//                 },
//                 {
//                     label: "Budget",
//                     data: budgetData,
//                     type: "line",
//                     fill: false
//                 }
//             ]
//         },
//         options: {
//             responsive: true,

//             onClick: function (evt, elements) {
//                 if (!elements.length) return;

//                 let index = elements[0].index;
//                 let filtered = [];

//                 if (type === "day") {
//                     filtered = expenses.filter(e => {
//                         let d = new Date(e.date);
//                         return d.getHours() === index &&
//                             d.toDateString() === now.toDateString();
//                     });
//                 }

//                 if (type === "week") {
//                     let start = new Date(now);
//                     start.setDate(now.getDate() - now.getDay());

//                     let selected = new Date(start);
//                     selected.setDate(start.getDate() + index);

//                     filtered = expenses.filter(e =>
//                         new Date(e.date).toDateString() === selected.toDateString()
//                     );
//                 }

//                 if (type === "month") {
//                     filtered = expenses.filter(e =>
//                         new Date(e.date).getDate() === index + 1
//                     );
//                 }

//                 renderCategoryBreakdown(groupByCategory(filtered));
//             }
//         }
//     });

//     // =========================
//     // 🔥 AUTO CATEGORY FIX
//     // =========================
//     let filtered = expenses.filter(e => {
//         let d = new Date(e.date);

//         if (type === "day") return d.toDateString() === now.toDateString();
//         if (type === "week") return true;
//         if (type === "month") return d.getMonth() === now.getMonth();

//         return true;
//     });

//     renderCategoryBreakdown(groupByCategory(filtered));
// }

// Filters data based on graph click


// function loadGraph(type = "day", data = null) {

//     let ctx = document.getElementById("myChart");
//     if (!ctx || !window.Chart) return;

//     if (chart) chart.destroy();

//     let expenses = data || getExpenses();
//     let labels = [], expenseData = [], incomeData = [], totalData = [];
//     let dataset = groupData(expenses, type, now);

//     let labels = dataset.map(d => d.label);
//     let expenseData = dataset.map(d => d.exp);
//     let incomeData = dataset.map(d => d.inc);
//     let totalData = dataset.map(d => d.inc - d.exp);

//     let now = new Date();

//     // =========================
//     // 📊 BUILD DATA
//     // =========================

//     function pushData(exp, inc) {
//         expenseData.push(exp);
//         incomeData.push(inc);
//         totalData.push(inc - exp); // 🔥 TOTAL
//     }

//     // DAY
//     if (type === "day") {
//         for (let i = 0; i < 24; i++) {
//             labels.push(i + ":00");

//             let exp = 0, inc = 0;

//             expenses.forEach(e => {
//                 let d = new Date(e.date);

//                 if (
//                     d.toDateString() === now.toDateString() &&
//                     d.getHours() === i
//                 ) {
//                     e.amount < 0 ? exp += Math.abs(e.amount) : inc += e.amount;
//                 }
//             });

//             pushData(exp, inc);
//         }
//     }

//     // WEEK
//     if (type === "week") {
//         let start = new Date(now);
//         start.setDate(now.getDate() - now.getDay());

//         for (let i = 0; i < 7; i++) {
//             let day = new Date(start);
//             day.setDate(start.getDate() + i);

//             labels.push(day.toLocaleDateString("en-IN", { weekday: "short" }));

//             let exp = 0, inc = 0;

//             expenses.forEach(e => {
//                 let d = new Date(e.date);

//                 if (d.toDateString() === day.toDateString()) {
//                     e.amount < 0 ? exp += Math.abs(e.amount) : inc += e.amount;
//                 }
//             });

//             pushData(exp, inc);
//         }
//     }

//     // MONTH
//     if (type === "month") {
//         let days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

//         for (let i = 1; i <= days; i++) {
//             labels.push(i);

//             let exp = 0, inc = 0;

//             expenses.forEach(e => {
//                 let d = new Date(e.date);

//                 if (
//                     d.getMonth() === now.getMonth() &&
//                     d.getDate() === i
//                 ) {
//                     e.amount < 0 ? exp += Math.abs(e.amount) : inc += e.amount;
//                 }
//             });

//             pushData(exp, inc);
//         }
//     }

//     // =========================
//     // 💰 BUDGET LINE
//     // =========================
//     let dailyBudget = getDailyLimit ? getDailyLimit() : 0;
//     let budgetData = labels.map(() => dailyBudget);

//     // =========================
//     // 🎨 COLORS (PREMIUM)
//     // =========================
//     const expenseColor = "rgba(255, 99, 132, 0.7)";
//     const incomeColor = "rgba(75, 192, 192, 0.7)";
//     const totalColor = "rgba(153, 102, 255, 1)";
//     const budgetColor = "rgba(255, 206, 86, 1)";

//     // =========================
//     // 📊 CHART
//     // =========================
//     chart = new Chart(ctx, {
//         type: "bar",
//         data: {
//             labels,
//             datasets: [
//                 {
//                     label: "Expense",
//                     data: expenseData,
//                     backgroundColor: expenseColor,
//                     borderRadius: 6
//                 },
//                 {
//                     label: "Income",
//                     data: incomeData,
//                     backgroundColor: incomeColor,
//                     borderRadius: 6
//                 },
//                 {
//                     label: "Total",
//                     data: totalData,
//                     type: "line",
//                     borderColor: totalColor,
//                     borderWidth: 3,
//                     tension: 0.4,
//                     fill: false
//                 },
//                 {
//                     label: "Budget",
//                     data: budgetData,
//                     type: "line",
//                     borderColor: budgetColor,
//                     borderDash: [5, 5],
//                     borderWidth: 2,
//                     fill: false
//                 }
//             ]
//         },
//         options: {
//             responsive: true,
//             maintainAspectRatio: false,

//             interaction: {
//                 mode: "index",
//                 intersect: false
//             },

//             plugins: {
//                 legend: {
//                     labels: {
//                         font: {
//                             size: 12
//                         }
//                     }
//                 },
//                 tooltip: {
//                     callbacks: {
//                         label: function (ctx) {
//                             return `${ctx.dataset.label}: ₹${ctx.raw}`;
//                         }
//                     }
//                 }
//             },

//             scales: {
//                 y: {
//                     beginAtZero: true
//                 }
//             },

//             // =========================
//             // 🔥 CLICK DRILL DOWN
//             // =========================
//             onClick: function (evt, elements) {
//                 if (!elements.length) return;

//                 let index = elements[0].index;
//                 let filtered = [];

//                 if (type === "day") {
//                     filtered = expenses.filter(e => {
//                         let d = new Date(e.date);
//                         return d.getHours() === index &&
//                             d.toDateString() === now.toDateString();
//                     });
//                 }

//                 if (type === "week") {
//                     let start = new Date(now);
//                     start.setDate(now.getDate() - now.getDay());

//                     let selected = new Date(start);
//                     selected.setDate(start.getDate() + index);

//                     filtered = expenses.filter(e =>
//                         new Date(e.date).toDateString() === selected.toDateString()
//                     );
//                 }

//                 if (type === "month") {
//                     filtered = expenses.filter(e =>
//                         new Date(e.date).getDate() === index + 1
//                     );
//                 }

//                 renderCategoryBreakdown(groupByCategory(filtered));
//             }
//         }
//     });

//     // =========================
//     // 🔥 AUTO CATEGORY
//     // =========================
//     let filtered = expenses.filter(e => {
//         let d = new Date(e.date);

//         if (type === "day") return d.toDateString() === now.toDateString();
//         if (type === "week") return true;
//         if (type === "month") return d.getMonth() === now.getMonth();

//         return true;
//     });

//     renderCategoryBreakdown(groupByCategory(filtered));
// }

function filterByIndex(data, type, index, now) {
    return data.filter(e => {
        let d = new Date(e.date);

        if (type === "day") {
            return d.getHours() === index &&
                d.toDateString() === now.toDateString();
        }

        if (type === "week") {
            let start = new Date(now);
            start.setDate(now.getDate() - now.getDay());

            let selected = new Date(start);
            selected.setDate(start.getDate() + index);

            return d.toDateString() === selected.toDateString();
        }

        if (type === "month") {
            return d.getDate() === index + 1 &&
                d.getMonth() === now.getMonth();
        }
    });
}

// Default filter
function filterByType(data, type, now) {
    return data.filter(e => {
        let d = new Date(e.date);

        if (type === "day") return d.toDateString() === now.toDateString();

        if (type === "week") {
            let start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            return d >= start;
        }

        if (type === "month") {
            return d.getMonth() === now.getMonth();
        }

        return true;
    });
}

// =========================
// 📊 GROUP BY CATEGORY
// =========================
// Converts list → category totals
function groupByCategory(data) {
    let map = {};

    data.forEach(e => {
        if (e.amount < 0) {
            let cat = e.category || "Other";

            if (!map[cat]) map[cat] = 0;

            map[cat] += Math.abs(e.amount);
        }
    });

    return map;
}

// =========================
// 📊 RENDER CATEGORY BREAKDOWN
// =========================
// Displays category-wise spending
function renderCategoryBreakdown(map) {

    let container = document.getElementById("categoryBreakdown");
    if (!container) return;

    container.innerHTML = "";

    let entries = Object.entries(map);

    if (!entries.length) {
        container.innerHTML = "<p>No data</p>";
        return;
    }

    entries.forEach(([cat, amt]) => {
        let div = document.createElement("div");

        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.padding = "6px 0";

        div.innerHTML = `
    <span>${cat}</span>
    <strong>₹${amt}</strong>
`;
        container.appendChild(div);
    });
}

function groupData(expenses, type, now, customRange = null) {

    let map = {};

    function formatDate(d) {
        return d.toLocaleDateString("en-CA"); // ✅ LOCAL SAFE FORMAT
    }

    // ================= DAY =================
    if (type === "day") {
        for (let i = 0; i < 24; i++) {
            map[i] = { exp: 0, inc: 0 };
        }

        expenses.forEach(e => {
            let d = new Date(e.date);

            if (d.toDateString() === now.toDateString()) {
                let h = d.getHours();

                if (e.amount < 0) map[h].exp += Math.abs(e.amount);
                else map[h].inc += e.amount;
            }
        });

        return Object.keys(map).map(h => ({
            key: h, // ✅ ADD THIS
            label: h + ":00",
            ...map[h]
        }));
    }

    // ================= RANGE (WEEK / MONTH / CUSTOM) =================
    let start, end;

    if (type === "week") {
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        end = new Date(start);
        end.setDate(start.getDate() + 6);
    }

    if (type === "month") {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    if (type === "custom" && customRange) {
        start = new Date(customRange.start);
        end = new Date(customRange.end);
    }

    // build date map
    let current = new Date(start);

    while (current <= end) {
        let key = formatDate(current);

        map[key] = {
            key: key, // ✅ ADD THIS LINE
            label: current.toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short"
            }),
            exp: 0,
            inc: 0
        };

        current.setDate(current.getDate() + 1);
    }

    // fill data
    expenses.forEach(e => {
        let d = new Date(e.date);
        let key = formatDate(d);

        if (map[key]) {
            if (e.amount < 0) map[key].exp += Math.abs(e.amount);
            else map[key].inc += e.amount;
        }
    });

    return Object.values(map);
}

// function groupByCategory(expenses) {

//     let map = {};

//     expenses.forEach(e => {
//         if (e.amount < 0) { // only expense
//             let cat = e.category || "Other";

//             if (!map[cat]) map[cat] = 0;

//             map[cat] += Math.abs(e.amount);
//         }
//     });

//     return map;
// }


function getLoanSummary() {
    let expenses = getExpenses();

    let map = {};

    expenses.forEach(e => {
        if (!e.person) return;

        if (!map[e.person]) {
            map[e.person] = {
                given: 0,
                received: 0
            };
        }

        if (e.category === "Loan" && e.amount < 0) {
            map[e.person].given += Math.abs(e.amount);
        }

        if (e.category === "Recovery" && e.amount > 0) {
            map[e.person].received += e.amount;
        }
    });

    // calculate balance
    Object.keys(map).forEach(p => {
        map[p].balance = map[p].given - map[p].received;
    });

    return map;
}
function renderLoanSummary() {
    let container = document.getElementById("loanSummary");
    if (!container) return;

    let data = getLoanSummary();

    container.innerHTML = "";

    let people = Object.keys(data);

    if (!people.length) {
        container.innerHTML = "<p>No loans yet</p>";
        return;
    }

    people.forEach(p => {
        let d = data[p];

        let div = document.createElement("div");

        div.innerHTML = `
            <div style="margin-bottom:10px;">
                <strong>${p}</strong><br>
                Given: ₹${d.given} |
                Received: ₹${d.received} <br>
                <span style="color:${d.balance > 0 ? 'red' : 'green'}">
                    ${d.balance > 0 ? "Pending" : "Cleared"}: ₹${d.balance}
                </span>
            </div>
        `;

        container.appendChild(div);
    });
}

// function renderBudgetEntries() {
//     let container = document.getElementById("budgetEntries");
//     if (!container) return;

//     let budgets = getBudgets();
//     let expenses = getExpenses();

//     container.innerHTML = "";

//     if (!budgets.length) {
//         container.innerHTML = "<p>No budget entries</p>";
//         return;
//     }

//     budgets.forEach(b => {

//         // 🔥 calculate spent
//         let spent = expenses
//             .filter(e => e.budgetId === b.budgetId && e.type === "expense")
//             .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//         let remaining = (b.totalAllocated || 0) - spent;

//         let div = document.createElement("div");
//         div.className = "budget-card";

//         div.innerHTML = `
//             <div>
//                 <strong>${formatBudgetName(b.budgetId)}</strong><br>
//                 <small>${b.entity}</small>
//             </div>

//             <div style="margin-top:6px;">
//                 Allocated: ₹${b.totalAllocated || 0}<br>
//                 Spent: ₹${spent}<br>
//                 <strong style="color:${remaining >= 0 ? 'green' : 'red'}">
//                     Remaining: ₹${remaining}
//                 </strong>
//             </div>
//         `;

//         container.appendChild(div);
//     });
// }
function openBudgetScreen() {
    renderBudgetEntries();  // 🔥 MUST
}

// =========================
// 🗓️ FORMAT HELPERS
// =========================
function formatMonth(monthKey) {
    if (!monthKey) return "No Date";

    let [year, month] = monthKey.split("-");
    let date = new Date(year, month - 1);

    return date.toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}
function openImportModal() {
    let modal = document.getElementById("importModal");
    if (modal) modal.style.display = "flex";
}

function closeImportModal() {
    let modal = document.getElementById("importModal");
    if (modal) modal.style.display = "none";
}

function handleFileImport(event) {
    let file = event.target.files[0];
    if (!file) return;

    let reader = new FileReader();

    reader.onload = function (e) {
        let text = e.target.result;

        document.getElementById("importText").value = text;
    };

    reader.readAsText(file);
}


function openConfirm() {
    document.getElementById("confirmModal").style.display = "flex";
}

function closeConfirm() {
    document.getElementById("confirmModal").style.display = "none";
}

function confirmReset() {
    localStorage.clear();
    location.reload();
}

function setColorByCode(hex) {
    let picker = document.getElementById("colorPicker");

    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    picker.value = hex;

    // Apply to your app
    applyCustomColor(hex);
}
function applyHex() {
    let hex = document.getElementById("hexInput").value;

    if (!hex) return;

    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    document.getElementById("colorPicker").value = hex;
    applyCustomColor(hex);
}
function applyPeriodFromModal() {

    let from = document.getElementById("startDate").value;
    let to = document.getElementById("endDate").value;

    if (!from || !to) {
        showToast("Select both dates");
        return;
    }

    let filtered = getExpenses().filter(e => {
        let d = new Date(e.date);
        return d >= new Date(from) && d <= new Date(to);
    });

    // 🔥 GRAPH
    loadGraph("custom", filtered, { start: from, end: to });

    // 🔥 ALSO UPDATE CATEGORY BREAKDOWN
    renderCategoryBreakdown(groupByCategory(filtered));

    // 🔥 CLOSE MODAL
    closePeriod();
}

function updateProgressBar() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    let currentMonth = new Date().toISOString().slice(0, 7);

    let totalBudget = budgets
        .filter(b => b.monthKey === currentMonth)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let totalSpent = expenses
        .filter(e => e.amount < 0 && e.monthKey === currentMonth)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let percent = totalBudget ? (totalSpent / totalBudget) * 100 : 0;

    percent = Math.min(percent, 100); // limit max 100%

    // UI update
    document.getElementById("progressFill").style.width = percent + "%";
    document.getElementById("progressText").innerText =
        `${percent.toFixed(1)}% used`;
}
// =====================================
// Author: Gopichanime
// Created: 2026
// Description: Money Tracker Core Logic
// =====================================
/*
   ____   ___  ____  ___ ____ _   _    _    _   _ ___ __  __ _____ 
  / ___| / _ \|  _ \|_ _/ ___| | | |  / \  | \ | |_ _|  \/  | ____|
 | |  _ | | | | |_) || | |   | |_| | / _ \ |  \| || || |\/| |  _|  
 | |_| || |_| |  __/ | | |___|  _  |/ ___ \| |\  || || |  | | |___ 
  \____| \___/|_|   |___\____|_| |_/_/   \_\_| \_|___|_|  |_|_____|

   Signed by: GOPICHANIME 🐉
*/