/* =========================
   📦 STORAGE
========================= */
let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let budget = Number(localStorage.getItem("budget")) || 0;
let dailyBudget = Number(localStorage.getItem("dailyBudget")) || 0;
let budgetAllocations = JSON.parse(localStorage.getItem("budgetAllocations")) || {};

let chart;
let graphMode = false;

let isClosingModal = false;
let transfers = JSON.parse(localStorage.getItem("transfers")) || [];

/* =========================
   🚀 INIT
========================= */
window.onload = () => {
  initCategories();
  loadTheme();
  updateUI();
  showDate();
  renderCategoryList();
  setDefaultDate();
  loadBudgetDropdown();

  let monthInput = document.getElementById("budgetMonth");
  if (monthInput) {
    monthInput.value = new Date().toISOString().slice(0, 7);
  }

  loadBudgetUI();
  // migrateOldData();
  initSecretTap();
};
function getTotalBudget(monthKey) {
  let budgetAllocations = JSON.parse(localStorage.getItem("budgetAllocations")) || {};

  let allocations = budgetAllocations[monthKey] || [];

  return allocations.reduce((sum, b) => sum + b.amount, 0);
}

function hexToRgb(hex) {
  let bigint = parseInt(hex.replace("#", ""), 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}
function getContrastColor(r, g, b) {
  // 🔥 brightness formula
  let brightness = (r * 299 + g * 587 + b * 114) / 1000;

  return brightness > 150 ? "black" : "white";
}

function setDefaultDate() {
  let today = new Date().toISOString().split("T")[0];
  document.getElementById("expenseDate").value = today;
}
/* =========================
   🧭 NAVIGATION
========================= */
function showScreen(id) {
  const screens = document.querySelectorAll(".screen");
  const buttons = document.querySelectorAll(".nav button");

  // Switch screens
  screens.forEach(s => s.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");

  // Active nav
  buttons.forEach(btn => btn.classList.remove("active"));
  document.querySelector(`[data-screen="${id}"]`)?.classList.add("active");

  // Load data per screen
  if (id === "history") loadHistory();
  if (id === "graph") loadGraph();
  if (id === "budget") loadBudgetUI();

  if (id === "budgets") loadBudgetList();       // 🔥 FIXED
  if (id === "add") loadBudgetDropdown();       // 🔥 FIXED

  if (id === "settings") {
    loadSourceDashboard();
    generateInsights();
    generatePrediction();
    generateAdvice();
  }
  if (id === "add") {
    loadBudgetDropdown();
  }
}
/* =========================
   📂 CATEGORY (FIXED CLEAN)
========================= */
const defaultCategories = ["Food", "Travel", "Bills", "Entertainment", "Others"];

function initCategories() {
  let stored = JSON.parse(localStorage.getItem("categories"));

  if (!stored || stored.length === 0) {
    categories = [...defaultCategories];
  } else {
    // 🔥 normalize + remove duplicates
    let map = new Set();
    categories = [];

    stored.forEach(cat => {
      let clean = cat.charAt(0).toUpperCase() + cat.slice(1).toLowerCase();

      if (!map.has(clean)) {
        map.add(clean);
        categories.push(clean);
      }
    });
  }

  localStorage.setItem("categories", JSON.stringify(categories));
  loadCategories();
}

function loadCategories() {
  let select = document.getElementById("category");
  if (!select) return;

  select.innerHTML = "";

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

  let clean = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();

  if (categories.includes(clean)) {
    alert("Already exists!");
    return;
  }

  categories.push(clean);
  localStorage.setItem("categories", JSON.stringify(categories));

  input.value = "";

  loadCategories();
  renderCategoryList();
}

function deleteCategory(index) {
  categories.splice(index, 1);
  localStorage.setItem("categories", JSON.stringify(categories));

  loadCategories();
  renderCategoryList();
}

/* =========================
   ➕ ADD EXPENSE
========================= */
function saveExpense() {
  let amount = Number(document.getElementById("amount").value);
  let category = document.getElementById("category").value;
  let purpose = document.getElementById("purpose").value;
  let selectedDate = document.getElementById("expenseDate").value;
  let type = document.getElementById("entryType").value;
  let paymentType = document.getElementById("paymentType").value;

  let budgetId = getSelectedBudgetId();

  if (!amount) return showToast("Enter amount");
  if (!budgetId) return showToast("Select budget");

  amount = type === "expense"
    ? -Math.abs(amount)
    : Math.abs(amount);

  expenses.push({
    id: Date.now(),
    amount,
    category,
    purpose,
    type,
    paymentType,
    budgetId,
    date: new Date(selectedDate).toISOString()
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  updateUI();
  showToast("✅ Expense added");

  // =========================
  // 🧹 RESET FORM (NEW)
  // =========================
  document.getElementById("amount").value = "";
  document.getElementById("purpose").value = "";
  document.getElementById("category").selectedIndex = 0;
  document.getElementById("paymentType").selectedIndex = 0;

  // 🔥 optional: reset type
  document.getElementById("entryType").value = "expense";

  // 🔥 reset date to today
  document.getElementById("expenseDate").value =
    new Date().toISOString().split("T")[0];

  // 🔥 reset budget dropdown
  let budgetSelect = document.getElementById("budgetSelect");
  if (budgetSelect) budgetSelect.selectedIndex = 0;
}

function loadBudgetDropdown() {
  let select = document.getElementById("budgetSelect");
  if (!select) return;

  let allocations = JSON.parse(localStorage.getItem("budgetAllocations")) || {};
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  select.innerHTML = `<option value="">Select Budget</option>`;

  Object.keys(allocations).forEach(monthKey => {
    let budgetId = `budget_${monthKey.replace("-", "_")}`;

    // 🔥 TOTAL ALLOCATED
    let total = allocations[monthKey].reduce(
      (sum, a) => sum + a.amount,
      0
    );

    // 🔥 SPENT
    let used = expenses
      .filter(e => e.budgetId === budgetId)
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let remaining = total - used;

    // ❌ skip empty budgets
    if (remaining <= 0) return;

    let option = document.createElement("option");
    option.value = budgetId;
    option.textContent = `${formatBudgetName(budgetId)} (₹${remaining} left)`;

    select.appendChild(option);
  });
}
/* =========================
   💰 BUDGET
========================= */
/* =========================
💰 BUDGET SYSTEM (UPGRADED)
========================= */

function saveBudget() {
  let amount = Number(document.getElementById("budgetAmount").value);
  let selectedMonth = document.getElementById("budgetMonth").value;

  if (!amount || !selectedMonth) {
    showToast("Enter valid data");
    return;
  }

  let [year, month] = selectedMonth.split("-");

  let sourceId = `salary_${month}_${year}`;
  let budgetId = `budget_${month}_${year}`;

  let savingsTransactions =
    JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  let budgets = getBudgets();

  // 🔥 CHECK SAVINGS
  let totalSavings = savingsTransactions.reduce((s, t) => s + t.amount, 0);

  if (amount > totalSavings) {
    showToast("Not enough savings");
    return;
  }

  // 🔗 MOVE FROM SAVINGS → BUDGET
  savingsTransactions.push({
    id: Date.now(),
    type: "budget_allocation",
    amount: -amount,
    sourceId,
    budgetId,
    date: new Date().toISOString()
  });

  localStorage.setItem("savingsTransactions", JSON.stringify(savingsTransactions));

  // 🟡 CREATE / UPDATE BUDGET
  createOrUpdateBudget(budgetId, sourceId, amount);

  showToast("Budget created from savings");

  updateUI();
}

function showToast(msg) {
  let toast = document.createElement("div");
  toast.innerText = msg;

  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#333";
  toast.style.color = "#fff";
  toast.style.padding = "10px 16px";
  toast.style.borderRadius = "10px";
  toast.style.zIndex = "9999";
  toast.style.fontSize = "14px";

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 2000);
}

/* =========================
🔄 LOAD CURRENT MONTH BUDGET
========================= */

function loadBudgetUI() {
  let month = new Date().toISOString().slice(0, 7);

  let totalBudget = getTotalBudget(month);

  document.getElementById("currentBudget").innerText = totalBudget;

  // 🔥 daily calculation
  let [year, mon] = month.split("-");
  let days = new Date(year, mon, 0).getDate();

  let daily = totalBudget / days;

  document.getElementById("calculatedDaily").innerText = Math.floor(daily);
}


/* =========================
   📜 HISTORY
========================= */
let currentFilteredExpenses = []; // 🔥 GLOBAL

function loadHistory(list = expenses) {
  currentFilteredExpenses = list; // 🔥 store filtered data

  let container = document.getElementById("historyList");
  container.innerHTML = "";

  list.forEach((e, i) => {
    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
  <div>
    <strong>${e.category}</strong> -
    <strong style="color:${e.amount < 0 ? 'red' : 'green'}">
      ₹${e.amount}
    </strong><br>
    <small>${new Date(e.date).toLocaleString()}</small>
  </div>
  <button class="delete-btn" onclick="deleteExpense(${i})">🗑</button>
`;
    container.appendChild(div);
  });
}

function deleteExpense(i) {
  expenses.splice(i, 1);
  localStorage.setItem("expenses", JSON.stringify(expenses));

  loadHistory();
  updateUI();
}

/* =========================
   📅 FILTER
========================= */
function handleFilter(type) {
  let now = new Date();

  if (type === "period") {
    let modal = document.getElementById("periodModal");
    if (modal) modal.style.display = "flex";
    return;
  }

  let filtered = expenses.filter(e => {
    let d = new Date(e.date);

    if (type === "today") return d.toDateString() === now.toDateString();

    if (type === "week") {
      let start = new Date(now);
      start.setDate(now.getDate() - now.getDay());

      let end = new Date(start);
      end.setDate(start.getDate() + 6);

      return d >= start && d <= end;
    }

    if (type === "month") {
      return d.getMonth() === now.getMonth();
    }

    return true;
  });

  loadHistory(filtered);
}

function applyDateFilter() {
  let from = document.getElementById("fromDate").value;
  let to = document.getElementById("toDate").value;

  if (!from || !to) {
    alert("Select both dates");
    return;
  }

  // ✅ CLOSE FIRST (NO MATTER WHAT)
  closeModal();

  // ✅ Format display text
  let fromText = new Date(from).toLocaleDateString("en-IN");
  let toText = new Date(to).toLocaleDateString("en-IN");

  document.getElementById("graphDate").innerText = `${fromText} → ${toText}`;

  // ✅ Update dropdown safely
  let select = document.querySelector("#graph select");

  if (select) {
    let customOption = [...select.options].find(o => o.value === "custom");

    if (!customOption) {
      customOption = document.createElement("option");
      customOption.value = "custom";
      select.appendChild(customOption);
    }

    customOption.text = `Custom (${fromText} → ${toText})`;
    select.value = "custom";
  }

  // ✅ FILTER ONLY ONCE
  let filtered = expenses.filter(e => {
    let d = new Date(e.date).toISOString().split("T")[0];
    return d >= from && d <= to;
  });

  // ✅ LOAD DATA
  // if (graphMode === true) {
  //   loadCustomGraph(filtered, from, to);
  // } else {
  //   loadHistory(filtered);
  // }
  graphMode = true;
  loadCustomGraph(filtered, from, to);
}

function closeModal() {
  const modal = document.getElementById("periodModal");

  if (!modal) return;

  isClosingModal = true; // 🔥 block reopen

  modal.style.display = "none";
  graphMode = false;

  setTimeout(() => {
    isClosingModal = false; // allow again after delay
  }, 200);
}


function getThemeColors() {
  let theme = localStorage.getItem("theme") || "#4caf50";

  // Convert hex → RGB
  function hexToRgb(hex) {
    let bigint = parseInt(hex.replace("#", ""), 16);
    return {
      r: (bigint >> 16) & 255,
      g: (bigint >> 8) & 255,
      b: bigint & 255
    };
  }

  let { r, g, b } = hexToRgb(theme);

  // 🔥 Create contrasting color (for budget)
  let budgetColor = `rgb(${255 - r}, ${255 - g}, ${255 - b})`;

  return {
    expenseColor: theme,
    budgetColor: budgetColor
  };
}


function loadGraph(type = "day") {
  let ctx = document.getElementById("myChart");

  if (chart) chart.destroy();

  let labels = [], expenseData = [], incomeData = [];
  let now = new Date();

  document.getElementById("graphDate").innerText =
    now.toLocaleDateString("en-IN");

  // ---------------------------
  // 📊 DATA PREPARATION
  // ---------------------------

  // DAY
  if (type === "day") {
    for (let i = 0; i < 24; i++) {
      labels.push(i + ":00");

      let expense = 0;
      let income = 0;

      expenses.forEach(e => {
        let d = new Date(e.date);

        if (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === now.getDate() &&
          d.getHours() === i
        ) {
          if (e.amount < 0) {
            expense += Math.abs(e.amount);
          } else {
            income += e.amount;
          }
        }
      });

      expenseData.push(expense);
      incomeData.push(income);
    }
  }

  // WEEK
  if (type === "week") {
    let start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    for (let i = 0; i < 7; i++) {
      let current = new Date(start);
      current.setDate(start.getDate() + i);

      labels.push(
        current.toLocaleDateString("en-IN", {
          weekday: "short",
          day: "numeric"
        })
      );

      let expense = 0;
      let income = 0;

      expenses.forEach(e => {
        let d = new Date(e.date);

        if (d.toDateString() === current.toDateString()) {
          if (e.amount < 0) {
            expense += Math.abs(e.amount);
          } else {
            income += e.amount;
          }
        }
      });

      expenseData.push(expense);
      incomeData.push(income);
    }
  }

  // MONTH
  if (type === "month") {
    let days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    for (let i = 1; i <= days; i++) {
      labels.push(i);

      let expense = 0;
      let income = 0;

      expenses.forEach(e => {
        let d = new Date(e.date);

        if (
          d.getFullYear() === now.getFullYear() &&
          d.getMonth() === now.getMonth() &&
          d.getDate() === i
        ) {
          if (e.amount < 0) {
            expense += Math.abs(e.amount);
          } else {
            income += e.amount;
          }
        }
      });

      expenseData.push(expense);
      incomeData.push(income);
    }
  }

  // ---------------------------
  // 💰 BUDGET
  // ---------------------------
  let budgetData = labels.map(() => dailyBudget);

  let { expenseColor, budgetColor } = getThemeColors();

  // ---------------------------
  // 📊 CHART
  // ---------------------------
  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: expenseColor
        },
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "#42a5f5"
        },
        {
          label: "Budget",
          data: budgetData,
          type: "line",
          borderColor: budgetColor,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 3,
          pointHoverRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false,
        axis: "x"
      },

      // ---------------------------
      // 🔥 CLICK = DRILL DOWN
      // ---------------------------
      onClick: function (evt, elements) {
        if (!elements.length) return;

        let index = elements[0].index;
        let filtered = [];

        // DAY → hour
        if (type === "day") {
          filtered = expenses.filter(e => {
            let d = new Date(e.date);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              d.getDate() === now.getDate() &&
              d.getHours() === index
            );
          });
        }

        // WEEK → specific day
        if (type === "week") {
          let start = new Date(now);
          start.setDate(now.getDate() - now.getDay());

          let selected = new Date(start);
          selected.setDate(start.getDate() + index);

          filtered = expenses.filter(e =>
            new Date(e.date).toDateString() === selected.toDateString()
          );
        }

        // MONTH → specific date
        if (type === "month") {
          filtered = expenses.filter(e => {
            let d = new Date(e.date);
            return (
              d.getFullYear() === now.getFullYear() &&
              d.getMonth() === now.getMonth() &&
              d.getDate() === index + 1
            );
          });
        }

        renderCategoryBreakdown(groupByCategory(filtered));
      },

      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: function (context) {
              return context.dataset.label + ": ₹" + context.raw;
            }
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  // ---------------------------
  // 🔥 AUTO CATEGORY (MAIN FEATURE)
  // ---------------------------
  let filtered = [];

  // DAY
  if (type === "day") {
    filtered = expenses.filter(e => {
      let d = new Date(e.date);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate()
      );
    });
  }

  // WEEK (exact same logic as graph)
  if (type === "week") {
    let start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    filtered = expenses.filter(e => {
      let d = new Date(e.date);

      for (let i = 0; i < 7; i++) {
        let temp = new Date(start);
        temp.setDate(start.getDate() + i);

        if (d.toDateString() === temp.toDateString()) return true;
      }

      return false;
    });
  }

  // MONTH
  if (type === "month") {
    filtered = expenses.filter(e => {
      let d = new Date(e.date);
      return (
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth()
      );
    });
  }

  // 🔥 FINAL RENDER
  renderCategoryBreakdown(groupByCategory(filtered));
}

function renderChart(ctx, labels, expenseData, budgetData, onClickHandler, incomeData = []) {
  if (chart) chart.destroy();

  const { expenseColor, budgetColor } = getThemeColors();

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: expenseColor
        },
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "#42a5f5"
        },
        {
          label: "Budget",
          data: budgetData,
          type: "line",
          borderColor: budgetColor,
          borderWidth: 2,
          fill: false,
          tension: 0,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false,
        axis: "x"
      },

      // 🔥 USE PASSED CLICK HANDLER
      onClick: onClickHandler,

      plugins: {
        legend: {
          display: true
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return context.dataset.label + ": ₹" + context.raw;
            }
          }
        }
      },

      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

function sumBy(fn) {
  return expenses.reduce((sum, e) => {
    if (fn(e) && e.amount < 0) {
      return sum + Math.abs(e.amount); // only expense
    }
    return sum;
  }, 0);
}


function exportPDF() {
  downloadPDF();
}

function getTotalBudget(monthKey) {
  let budgetAllocations = JSON.parse(localStorage.getItem("budgetAllocations")) || {};
  let allocations = budgetAllocations[monthKey] || [];
  return allocations.reduce((sum, b) => sum + b.amount, 0);
}

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const dataSource = currentFilteredExpenses.length
    ? currentFilteredExpenses
    : expenses;

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
    const category = e.category;
    const amount = e.amount;
    const purpose = e.purpose || "N/A";
    const payment = e.paymentType || "-";
    const type = amount < 0 ? "Expense" : "Income";

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
/* =========================
   🎨 THEME
========================= */
function handleTheme(val) {
  if (val === "custom") {
    document.getElementById("colorPicker").style.display = "block";
  } else {
    changeTheme(val);
  }
}

function applyCustomColor(c) {
  changeTheme(c);
}

function changeTheme(c) {
  localStorage.setItem("theme", c);
  document.documentElement.style.setProperty("--theme", c);
}

function loadTheme() {
  let t = localStorage.getItem("theme");
  if (t) changeTheme(t);
}

async function sharePDF() {
  const { jsPDF } = window.jspdf;

  let doc = new jsPDF();
  doc.text("Money Tracker Report", 14, 15);

  let pdfBlob = doc.output("blob");
  let url = URL.createObjectURL(pdfBlob);

  // ✅ If basic share supported (TEXT ONLY)
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Money Tracker Report",
        text: "Download my expense report:",
        url: url
      });
    } catch (err) {
      console.log("Share cancelled");
    }
  } else {
    // 🔥 fallback
    doc.save("expenses-report.pdf");
    alert("Sharing not supported → PDF downloaded");
  }
}
/* =========================
   📊 UI
========================= */
function updateUI() {
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
  let allocations = JSON.parse(localStorage.getItem("budgetAllocations")) || {};

  // =========================
  // 💰 TOTAL BUDGET (FROM ALLOCATIONS)
  // =========================
  let totalBudget = 0;

  Object.values(allocations).forEach(arr => {
    totalBudget += arr.reduce((sum, a) => sum + a.amount, 0);
  });

  // =========================
  // 📉 TOTAL SPENT (FROM EXPENSES)
  // =========================
  let totalSpent = expenses
    .filter(e => e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // =========================
  // 💼 REMAINING
  // =========================
  let totalRemaining = totalBudget - totalSpent;

  // =========================
  // 📅 TODAY SPENT
  // =========================
  let todaySpent = expenses
    .filter(e => e.date.startsWith(today) && e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // =========================
  // 📊 DAILY LIMIT (CURRENT MONTH ONLY)
  // =========================
  let [year, month] = currentMonth.split("-");

  let daysInMonth = new Date(year, month, 0).getDate();

  let currentMonthBudget =
    (allocations[currentMonth] || []).reduce(
      (sum, a) => sum + a.amount,
      0
    );

  let dailyLimit = currentMonthBudget > 0
    ? currentMonthBudget / daysInMonth
    : 0;

  // =========================
  // 🖥️ UI UPDATE
  // =========================
  document.getElementById("budgetValue").innerText = totalBudget;
  document.getElementById("spent").innerText = totalSpent;
  document.getElementById("remaining").innerText = totalRemaining;
  document.getElementById("todaySpent").innerText = todaySpent;

  let dailyEl = document.getElementById("dailyLimit");
  if (dailyEl) {
    dailyEl.innerText = Math.floor(dailyLimit);
  }

  // =========================
  // 📊 PROGRESS BAR
  // =========================
  updateProgressBar(totalSpent, totalBudget);

  // =========================
  // 📦 LOAD BUDGET LIST
  // =========================
  if (typeof loadBudgetList === "function") {
    loadBudgetList();
  }
}


function updateProgressBar(total, budget) {
  total = Number(total) || 0;
  budget = Number(budget) || 0;

  let percent = 0;

  if (budget > 0) {
    percent = (total / budget) * 100;
  }

  // 🎯 Clamp between 0–100 for UI
  let displayPercent = Math.min(percent, 100);

  const bar = document.getElementById("progressFill");
  const text = document.getElementById("progressText");

  if (!bar || !text) return;

  // 🔥 Update width
  bar.style.width = displayPercent + "%";

  // 🎨 Dynamic color
  if (percent < 50) {
    bar.style.background = "linear-gradient(90deg, #4caf50, #81c784)";
  } else if (percent < 100) {
    bar.style.background = "linear-gradient(90deg, #ffa726, #fb8c00)";
  } else {
    bar.style.background = "linear-gradient(90deg, #ef5350, #d32f2f)";
  }

  // 📝 Text update
  text.innerText = Math.floor(percent) + "% used";
}
function renderCategoryList() {
  const container = document.getElementById("categoryList");
  if (!container) return;

  container.innerHTML = "";

  categories.forEach((cat, index) => {
    let div = document.createElement("div");
    div.className = "category-item";

    div.innerHTML = `
      <span>${cat}</span>
      <button onclick="deleteCategory(${index})">✕</button>
    `;

    container.appendChild(div);
  });
}

function openCategoryModal() {
  document.getElementById("categoryModal").style.display = "flex";
  renderCategoryList(); // load fresh
}

function closeCategoryModal() {
  document.getElementById("categoryModal").style.display = "none";
}

function handleGraphFilter(type) {
  // 🚫 DO NOTHING if custom already active
  if (type === "custom") {
    openCustomModal();
    return;
  }

  // ✅ Only reset if NOT custom
  graphMode = false;

  loadGraph(type);

  document.getElementById("graphDate").innerText =
    new Date().toLocaleDateString("en-IN");
}

function applyCustomGraph() {
  let from = document.getElementById("fromDateGraph").value;
  let to = document.getElementById("toDateGraph").value;

  if (!from || !to) {
    alert("Select both dates");
    return;
  }

  let filtered = expenses.filter(e => {
    let d = new Date(e.date).toISOString().split("T")[0];
    return d >= from && d <= to;
  });
  graphMode = true;
  loadCustomGraph(filtered, from, to);

}
function loadCustomGraph(data, from, to) {
  let ctx = document.getElementById("myChart");

  if (chart) chart.destroy();

  let expenseMap = {};
  let incomeMap = {};

  data.forEach(e => {
    let d = new Date(e.date).toLocaleDateString("en-IN");

    if (e.amount < 0) {
      expenseMap[d] = (expenseMap[d] || 0) + Math.abs(e.amount);
    } else {
      incomeMap[d] = (incomeMap[d] || 0) + e.amount;
    }
  });

  let start = new Date(from);
  let end = new Date(to);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  let labels = [];
  let expenseValues = [];
  let incomeValues = [];

  let current = new Date(start);

  while (current <= end) {
    let key = current.toLocaleDateString("en-IN");

    labels.push(key);
    expenseValues.push(expenseMap[key] || 0);
    incomeValues.push(incomeMap[key] || 0);

    current.setDate(current.getDate() + 1);
  }

  // 🔥 Budget logic
  let monthlyBudgets = JSON.parse(localStorage.getItem("monthlyBudgets")) || {};

  let budgetData = labels.map(dateStr => {
    let parts = dateStr.split("/");
    let d = new Date(parts[2], parts[1] - 1, parts[0]);

    let key = d.toISOString().slice(0, 7); // 🔥 FIXED (YYYY-MM)

    let monthly = monthlyBudgets[key] || 0;

    let days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    return monthly / days;
  });

  // ---------------------------
  // 🔥 CLICK HANDLER (WORKING NOW)
  // ---------------------------
  let onClickHandler = function (evt, elements) {
    if (!elements.length) return;

    let index = elements[0].index;
    let selectedDate = labels[index];

    let filtered = data.filter(e =>
      new Date(e.date).toLocaleDateString("en-IN") === selectedDate
    );

    renderCategoryBreakdown(groupByCategory(filtered));
  };

  // 🔥 RENDER GRAPH
  renderChart(ctx, labels, expenseValues, budgetData, onClickHandler, incomeValues);

  // ---------------------------
  // 🔥 AUTO CATEGORY (MAIN FIX)
  // ---------------------------
  renderCategoryBreakdown(groupByCategory(data));

  // ---------------------------
  // 📅 DATE LABEL
  // ---------------------------
  document.getElementById("graphDate").innerText =
    `${from} → ${to}`;
}
/* =========================
   🕒 DATE
========================= */
function showDate() {
  let el = document.getElementById("dateDisplay");
  if (el) el.innerText = new Date().toLocaleString();
}

function openCustomModal() {
  const modal = document.getElementById("periodModal");

  if (!modal) return;

  // 🔥 BLOCK reopen while closing
  if (isClosingModal) return;

  if (modal.style.display === "flex") return;

  graphMode = true;
  modal.style.display = "flex";
}


function groupByCategory(data) {
  let map = {};

  data.forEach(e => {
    if (e.amount < 0) {
      map[e.category] = (map[e.category] || 0) + Math.abs(e.amount);
    }
  });

  return map;
}

function renderCategoryBreakdown(map) {
  let container = document.getElementById("categoryListGraph");
  if (!container) return;

  container.innerHTML = "";

  Object.keys(map).forEach(cat => {
    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <div>
        <strong>${cat}</strong>
      </div>
      <div>₹${map[cat]}</div>
    `;

    container.appendChild(div);
  });
}

function renderFullCategoryBreakdown(data) {
  let map = groupByCategory(data);
  renderCategoryBreakdown(map);
}

function migrateOldData() {
  let updated = false;

  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
  let savingsTransactions =
    JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

  // =========================
  // 🟢 STEP 1: FIX SAVINGS SOURCE
  // =========================
  savingsTransactions.forEach(t => {
    let d = new Date(t.date);
    let y = d.getFullYear();
    let m = String(d.getMonth() + 1).padStart(2, "0");

    if (!t.sourceId) {
      t.sourceId = `${t.type || "salary"}_${y}_${m}`;
      updated = true;
    }
  });

  // =========================
  // 🟡 STEP 2: ENSURE BUDGET → SOURCE LINK
  // =========================
  budgets.forEach(b => {
    if (!b.sourceId) {
      let [_, year, month] = b.budgetId.split("_");

      let relatedSaving = savingsTransactions.find(t => {
        let d = new Date(t.date);
        return (
          d.getFullYear() == year &&
          String(d.getMonth() + 1).padStart(2, "0") == month
        );
      });

      if (relatedSaving) {
        b.sourceId = relatedSaving.sourceId;
      } else {
        let sourceId = `salary_${year}_${month}`;

        savingsTransactions.push({
          id: Date.now(),
          amount: 0,
          type: "salary",
          sourceId,
          date: new Date().toISOString()
        });

        b.sourceId = sourceId;
      }

      updated = true;
    }

    // 🔥 Ensure budget allocation exists
    let exists = savingsTransactions.find(
      t => t.budgetId === b.budgetId && t.type === "budget_allocation"
    );

    if (!exists) {
      savingsTransactions.push({
        id: Date.now(),
        type: "budget_allocation",
        amount: -Math.abs(b.allocated || 0),
        sourceId: b.sourceId,
        budgetId: b.budgetId,
        date: new Date().toISOString()
      });

      updated = true;
    }
  });

  // =========================
  // 🔵 STEP 3: FIX EXPENSE (ONLY budgetId)
  // =========================
  expenses.forEach(e => {
    let d = new Date(e.date);
    let year = d.getFullYear();
    let month = String(d.getMonth() + 1).padStart(2, "0");

    if (!e.budgetId) {
      e.budgetId = `budget_${year}_${month}`;
      updated = true;
    }

    // ❌ REMOVE SOURCEID IF EXISTS
    if (e.sourceId) {
      delete e.sourceId;
      updated = true;
    }

    // FIX TYPE
    if (!e.type) {
      e.type = e.amount < 0 ? "expense" : "income";
      updated = true;
    }

    // FIX SIGN
    if (e.type === "expense") {
      e.amount = -Math.abs(e.amount);
    } else {
      e.amount = Math.abs(e.amount);
    }
  });

  // =========================
  // 💾 SAVE
  // =========================
  localStorage.setItem("expenses", JSON.stringify(expenses));
  localStorage.setItem("savingsTransactions", JSON.stringify(savingsTransactions));
  localStorage.setItem("budgets", JSON.stringify(budgets));

  // =========================
  // 📱 FEEDBACK
  // =========================
  if (updated) {
    showToast("✅ Clean architecture applied");
  } else {
    showToast("ℹ️ Already clean");
  }
}

function runMigration() {
  migrateOldData();
  updateUI(); // 🔥 refresh UI after fix
}
/* =========================
   🔐 SECRET NAVIGATION (PRO)
========================= */

function initSecretTap() {
  const card = document.getElementById("remainingCard");
  if (!card) return;

  let taps = 0;
  let timer;

  card.addEventListener("click", () => {
    taps++;

    // 🔥 subtle feedback
    card.style.transform = "scale(0.95)";
    setTimeout(() => (card.style.transform = "scale(1)"), 120);

    // 🔄 reset timer
    clearTimeout(timer);
    timer = setTimeout(() => {
      taps = 0;
    }, 1500);

    // 🧠 DEBUG (optional remove later)
    console.log("Secret taps:", taps);

    // 🎯 SECRET 1 → Savings
    if (taps === 5) {
      unlockEffect(card);
      navigateTo("savings.html");
      taps = 0;
    }

    // 🎯 SECRET 2 → Transfer (optional)
    if (taps === 10) {
      unlockEffect(card);
      navigateTo("transfer.html");
      taps = 0;
    }
  });
}

/* =========================
   ✨ UNLOCK EFFECT
========================= */
function unlockEffect(el) {
  el.style.transition = "all 0.3s ease";
  el.style.boxShadow = "0 0 20px #4caf50";
  el.style.transform = "scale(1.05)";

  setTimeout(() => {
    el.style.boxShadow = "";
    el.style.transform = "scale(1)";
  }, 300);
}

/* =========================
   🚀 NAVIGATION HANDLER
========================= */
function navigateTo(page) {
  setTimeout(() => {
    window.location.href = page;
  }, 200); // slight delay = premium feel
}

function saveTransfer() {
  let person = document.getElementById("tPerson").value;
  let direction = document.getElementById("tDirection").value;
  let amount = Number(document.getElementById("tAmount").value);
  let payment = document.getElementById("tPayment").value;
  let note = document.getElementById("tNote").value;

  if (!person || !amount) return alert("Enter data");

  let obj = {
    id: Date.now(),
    person,
    direction,
    amount,
    payment,
    note,
    date: new Date().toISOString()
  };

  transfers.push(obj);
  localStorage.setItem("transfers", JSON.stringify(transfers));

  // 🔥 IMPORTANT: Affect Savings
  applyTransferToSavings(obj);

  document.getElementById("tPerson").value = "";
  document.getElementById("tAmount").value = "";
  document.getElementById("tNote").value = "";

  loadTransferUI();
}
function applyTransferToSavings(t) {
  let savingsTransactions =
    JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  let entry = {
    id: Date.now(),
    amount: t.direction === "given"
      ? -Math.abs(t.amount)
      : Math.abs(t.amount),
    type: "transfer",
    person: t.person,
    payment: t.payment,
    date: t.date
  };

  savingsTransactions.push(entry);

  localStorage.setItem("savingsTransactions", JSON.stringify(savingsTransactions));
}
function calculatePersonBalance(name) {

  let given = transfers
    .filter(t => t.person === name && t.direction === "given")
    .reduce((s, t) => s + t.amount, 0);

  let received = transfers
    .filter(t => t.person === name && t.direction === "received")
    .reduce((s, t) => s + t.amount, 0);

  return given - received;
}
function loadTransferUI() {

  let summaryDiv = document.getElementById("peopleSummary");
  let historyDiv = document.getElementById("transferHistory");

  summaryDiv.innerHTML = "";
  historyDiv.innerHTML = "";

  let people = [...new Set(transfers.map(t => t.person))];

  // 🔥 SUMMARY
  people.forEach(name => {
    let bal = calculatePersonBalance(name);

    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <strong>${name}</strong><br>
      Balance: ₹${bal}
    `;

    summaryDiv.appendChild(div);
  });

  // 🔥 HISTORY
  transfers.slice().reverse().forEach(t => {

    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <strong>${t.person}</strong> - ₹${t.amount}<br>
      <small>${t.direction} • ${t.payment}</small>
    `;

    historyDiv.appendChild(div);
  });

}

function handleSavingsFilter(type) {
  if (type === "period") {
    const modal = document.getElementById("savingsDateModal");

    if (!modal) {
      console.error("Modal not found");
      return;
    }

    modal.style.display = "flex";
    modal.style.visibility = "visible";   // 🔥 fix
    modal.style.opacity = "1";            // 🔥 fix
    return;
  }

  // rest unchanged
}
function closePeriod() {
  const modal = document.getElementById("periodModal");
  if (modal) modal.style.display = "none";
}

function applyPeriod() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    showToast("Please select both dates");
    return;
  }

  // 🔥 Filter data (same logic you already use)
  let filtered = expenses.filter(e => {
    let d = new Date(e.date).toISOString().split("T")[0];
    return d >= start && d <= end;
  });

  // 👉 Use where you want
  loadCustomGraph(filtered, start, end);

  // ✅ close modal
  closePeriod();
}

function initDateValidation() {
  const startInput = document.getElementById("startDate");
  const endInput = document.getElementById("endDate");
  const applyBtn = document.querySelector("#periodModal .primary");

  function checkDates() {
    if (startInput.value && endInput.value) {
      applyBtn.disabled = false;
      applyBtn.style.opacity = "1";
    } else {
      applyBtn.disabled = true;
      applyBtn.style.opacity = "0.5";
    }
  }

  startInput.addEventListener("input", checkDates);
  endInput.addEventListener("input", checkDates);

  checkDates(); // initial state
}

async function exportDataAsPDF() {
  let data = {
    expenses: JSON.parse(localStorage.getItem("expenses") || "[]"),
    savingsTransactions: JSON.parse(localStorage.getItem("savingsTransactions") || "[]"),
    budgets: JSON.parse(localStorage.getItem("budgets") || "[]")
  };

  let json = JSON.stringify(data, null, 2);

  // =========================
  // 📄 CREATE PDF
  // =========================
  const { jsPDF } = window.jspdf;
  let doc = new jsPDF();

  let lines = doc.splitTextToSize(json, 180); // wrap text

  let y = 10;

  doc.setFontSize(8);

  lines.forEach(line => {
    if (y > 280) {
      doc.addPage();
      y = 10;
    }

    doc.text(line, 10, y);
    y += 4;
  });

  // =========================
  // 📱 MOBILE SHARE (BEST)
  // =========================
  let blob = doc.output("blob");

  if (navigator.canShare && navigator.canShare({ files: [] })) {
    try {
      let file = new File([blob], "money-backup.pdf", {
        type: "application/pdf"
      });

      await navigator.share({
        title: "Money Backup",
        text: "Backup file",
        files: [file]
      });

      showToast("📤 Shared as PDF");
      return;
    } catch (e) {
      console.log("Share failed");
    }
  }

  // =========================
  // 💻 DOWNLOAD
  // =========================
  doc.save("money-backup.pdf");
  showToast("📥 PDF downloaded");
}

function openImportModal() {
  document.getElementById("importModal").style.display = "flex";
}

function closeImportModal() {
  document.getElementById("importModal").style.display = "none";
}


function handleFileImport(event) {
  let file = event.target.files[0];

  if (!file) return;

  let reader = new FileReader();

  reader.onload = function (e) {
    document.getElementById("importText").value = e.target.result;
  };

  reader.readAsText(file);
}

function getSelectedBudgetId() {
  let select = document.getElementById("budgetSelect");
  return select ? select.value : null;
}

function getBudgetBalance(budgetId) {
  let monthKey = budgetId.replace("budget_", "").replace("_", "-");

  let allocations =
    JSON.parse(localStorage.getItem("budgetAllocations")) || {};

  let totalAllocated = (allocations[monthKey] || []).reduce(
    (sum, a) => sum + a.amount,
    0
  );

  let expenses =
    JSON.parse(localStorage.getItem("expenses")) || [];

  let spent = expenses
    .filter(e => e.budgetId === budgetId)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  return totalAllocated - spent;
}
function loadBudgetList() {
  let container = document.getElementById("budgetList");
  if (!container) return;

  let budgets = getBudgets();
  container.innerHTML = "";

  if (!budgets.length) {
    container.innerHTML = `<p style="color:#888;">No budgets yet 📭</p>`;
    return;
  }

  budgets.slice().reverse().forEach(b => {
    let name = formatBudgetName(b.budgetId);
    let remaining = getBudgetBalance(b.budgetId);

    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <div>
        <strong>${name} Budget</strong><br>
        <small>Source: ${b.sourceId}</small>
      </div>
      <div style="color:green; font-weight:600;">
        ₹${remaining} →
      </div>
    `;

    div.style.cursor = "pointer";
    div.onclick = () => openBudgetDetails(b.budgetId);

    container.appendChild(div);
  });
}

function openBudgetDetails(budgetId) {
  console.log("Clicked:", budgetId);

  // 🔥 SWITCH SCREEN (IMPORTANT)
  showScreen("budgetDetails");

  let container = document.getElementById("budgetDetailsContainer");
  if (!container) {
    console.error("❌ budgetDetailsContainer missing");
    return;
  }

  let allocations = JSON.parse(localStorage.getItem("budgetAllocations")) || {};
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  let monthKey = budgetId.replace("budget_", "").replace("_", "-");

  let total = (allocations[monthKey] || [])
    .reduce((sum, a) => sum + a.amount, 0);

  let related = expenses.filter(e => e.budgetId === budgetId);

  let used = related.reduce((sum, e) => sum + Math.abs(e.amount), 0);

  let remaining = total - used;

  // =========================
  // 🧱 HEADER (LIKE SAVINGS)
  // =========================
  container.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <h3>📦 ${formatBudgetName(budgetId)} Budget</h3>
      <button onclick="showScreen('budgets')">⬅️</button>
    </div>

    <p>💰 Budget: ₹${total}</p>
    <p>📉 Used: ₹${used}</p>
    <p>🟢 Remaining: ₹${remaining}</p>

    <hr style="margin:10px 0;" />

    <h4>📋 Entries</h4>
  `;

  // =========================
  // 📭 NO ENTRIES
  // =========================
  if (!related.length) {
    container.innerHTML += `<p style="color:#888;">No entries yet 📭</p>`;
    return;
  }

  // =========================
  // 📋 ENTRIES LIST
  // =========================
  related
    .slice()
    .reverse()
    .forEach(e => {
      let div = document.createElement("div");
      div.className = "expense-item";

      div.innerHTML = `
        <div>
          <strong>${e.category || "No Category"}</strong><br>
          <small>${new Date(e.date).toLocaleString()}</small>
        </div>
        <div style="color:red; font-weight:600;">
          ₹${Math.abs(e.amount)}
        </div>
      `;

      container.appendChild(div);
    });
}

function getBudgets() {
  return JSON.parse(localStorage.getItem("budgets")) || [];
}

function saveBudgets(budgets) {
  localStorage.setItem("budgets", JSON.stringify(budgets));
}

function createOrUpdateBudget(budgetId, sourceId, amount) {
  let budgets = getBudgets();

  let existing = budgets.find(b => b.budgetId === budgetId);

  if (existing) {
    existing.allocated += amount;
  } else {
    budgets.push({
      budgetId,
      sourceId,
      allocated: amount
    });
  }

  saveBudgets(budgets);
}

function getSourceSummary(sourceId) {
  let savingsTransactions =
    JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  let budgets = getBudgets();
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  // 💰 TOTAL INCOME (SOURCE)
  let totalIncome = savingsTransactions
    .filter(t => t.sourceId === sourceId && t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);

  // 📦 BUDGET ALLOCATED FROM SOURCE
  let relatedBudgets = budgets.filter(b => b.sourceId === sourceId);

  let totalBudget = relatedBudgets.reduce(
    (s, b) => s + b.allocated,
    0
  );

  // 📉 SPENT FROM THESE BUDGETS
  let totalSpent = 0;

  relatedBudgets.forEach(b => {
    let spent = expenses
      .filter(e => e.budgetId === b.budgetId && e.amount < 0)
      .reduce((s, e) => s + Math.abs(e.amount), 0);

    totalSpent += spent;
  });

  // 💼 REMAINING
  let remaining = totalBudget - totalSpent;

  return {
    sourceId,
    totalIncome,
    totalBudget,
    totalSpent,
    remaining
  };
}

function loadSourceDashboard() {
  let container = document.getElementById("sourceList");
  if (!container) return;

  let savingsTransactions =
    JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  // 🔥 UNIQUE SOURCES
  let sources = [...new Set(savingsTransactions.map(t => t.sourceId))];

  container.innerHTML = "";

  sources.forEach(sourceId => {
    let summary = getSourceSummary(sourceId);

    let div = document.createElement("div");
    div.className = "category-item";

    div.innerHTML = `
  <div>
    <strong>${sourceId}</strong><br>
    <small>Income: ₹${summary.totalIncome}</small>
  </div>
  <div>
    <small>Budget: ₹${summary.totalBudget}</small><br>
    <small>Spent: ₹${summary.totalSpent}</small><br>
    <strong>Remaining: ₹${summary.remaining}</strong>
  </div>
`;

    div.style.cursor = "pointer";

    div.onclick = () => renderSourceDetails(sourceId);

    container.appendChild(div);
  });
}

function renderSourceDetails(sourceId) {
  let container = document.getElementById("sourceList");
  if (!container) return;

  let budgets = getBudgets();
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  let relatedBudgets = budgets.filter(b => b.sourceId === sourceId);

  container.innerHTML = `
    <button onclick="loadSourceDashboard()">⬅ Back</button>
    <h4>${sourceId}</h4>
  `;

  relatedBudgets.forEach(b => {
    let budgetDiv = document.createElement("div");
    budgetDiv.className = "category-item";

    // 📉 expenses under this budget
    let relatedExpenses = expenses.filter(e => e.budgetId === b.budgetId);

    let totalSpent = relatedExpenses
      .filter(e => e.amount < 0)
      .reduce((s, e) => s + Math.abs(e.amount), 0);

    budgetDiv.innerHTML = `
      <div>
        <strong>${b.budgetId}</strong><br>
        <small>Allocated: ₹${b.allocated}</small><br>
        <small>Spent: ₹${totalSpent}</small>
      </div>
    `;

    // 🔥 EXPENSE LIST
    relatedExpenses.forEach(e => {
      let expDiv = document.createElement("div");
      expDiv.style.marginLeft = "15px";
      expDiv.style.fontSize = "13px";

      expDiv.innerHTML = `
        ${e.category} - ₹${e.amount} <br>
        <small>${new Date(e.date).toLocaleDateString()}</small>
      `;

      budgetDiv.appendChild(expDiv);
    });

    container.appendChild(budgetDiv);
  });
}

function generateInsights() {
  let box = document.getElementById("insightsBox");
  if (!box) return;

  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  let total = expenses.reduce((s, e) => s + Math.abs(e.amount), 0);

  let food = expenses
    .filter(e => e.category === "Food")
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  let percent = total ? Math.round((food / total) * 100) : 0;

  box.innerHTML = "";

  if (percent > 50) {
    box.innerHTML += `
      <div class="insight-card">⚠️ High spending on Food (${percent}%)</div>
    `;
  } else {
    box.innerHTML += `
      <div class="insight-card">💡 Spending looks balanced</div>
    `;
  }
}

function generatePrediction() {
  let box = document.getElementById("predictionBox");
  if (!box) return;

  let budgets = getBudgets();
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  let totalBudget = budgets.reduce((s, b) => s + b.allocated, 0);

  let spent = expenses
    .filter(e => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  let today = new Date();
  let daysPassed = today.getDate();
  let daysInMonth = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    0
  ).getDate();

  let avg = spent / daysPassed || 0;
  let remainingDays = daysInMonth - daysPassed;

  box.innerHTML = `
    <div class="insight-card">📊 Avg daily spend: ₹${Math.round(avg)}</div>
    <div class="insight-card">📅 Days remaining: ${remainingDays}</div>
  `;
}

function generateAdvice() {
  let box = document.getElementById("adviceBox");
  if (!box) return;

  let budgets = getBudgets();
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  let totalBudget = budgets.reduce((s, b) => s + b.allocated, 0);

  let spent = expenses
    .filter(e => e.amount < 0)
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  let remaining = totalBudget - spent;

  let msg = "";

  if (remaining <= 0) {
    msg = "❌ Budget exceeded. Reduce spending immediately";
  } else if (remaining < totalBudget * 0.3) {
    msg = "⚠️ Budget is running low. Spend carefully";
  } else {
    msg = "✅ You are managing your budget well";
  }

  box.innerHTML = `
    <div class="insight-card">${msg}</div>
  `;
}
function formatBudgetName(budgetId) {
  if (!budgetId) return "Unknown";

  let parts = budgetId.split("_");

  if (parts.length < 3) return budgetId;

  let part1 = parts[1];
  let part2 = parts[2];

  let year, month;

  // 🔥 Detect format
  if (part1.length === 4) {
    // budget_2026_04 ✅
    year = part1;
    month = part2;
  } else {
    // budget_04_2026 ❌ (old)
    month = part1;
    year = part2;
  }

  let date = new Date(`${year}-${month}-01`);

  return date.toLocaleString("default", {
    month: "short",
    year: "numeric"
  });
}

function fixBudgetIdFormat() {
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  let changes = [];

  expenses.forEach(e => {
    let oldId = e.budgetId;

    if (e.budgetId && e.budgetId.includes("_")) {
      let parts = e.budgetId.split("_");

      // detect wrong format: budget_04_2026
      if (parts[1] && parts[1].length === 2) {
        let month = parts[1];
        let year = parts[2];

        e.budgetId = `budget_${year}_${month}`;

        changes.push({
          id: e.id,
          old: oldId,
          new: e.budgetId,
          amount: e.amount,
          date: e.date
        });
      }
    }
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  console.log("✅ Fixed budgetId format");

  // =========================
  // 📊 SHOW CHANGES
  // =========================
  if (changes.length === 0) {
    console.log("⚠️ No changes found");
  } else {
    console.log("🔄 Updated Entries:");
    console.table(changes);
  }

  // =========================
  // 📦 FULL DATA PREVIEW
  // =========================
  console.log("📦 Updated Expenses JSON:");
  console.log(JSON.stringify(expenses, null, 2));
}
function getTotalBudgetForMonth(monthKey) {
  let allocations =
    JSON.parse(localStorage.getItem("budgetAllocations")) || {};

  return (allocations[monthKey] || []).reduce(
    (sum, a) => sum + a.amount,
    0
  );
}
function openQuotation() {
  window.location.href = "quotation.html";
}