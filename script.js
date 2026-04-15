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

  let monthInput = document.getElementById("budgetMonth");
  if (monthInput) {
    monthInput.value = new Date().toISOString().slice(0, 7);
  }

  loadBudgetUI();
  migrateOldData();
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

  // 🧭 switch screens
  screens.forEach(s => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");

  // 🔥 FIX ACTIVE NAV (SAFE)
  buttons.forEach(btn => {
    btn.classList.remove("active");

    if (btn.dataset.screen === id) {
      btn.classList.add("active");
    }
  });

  // 📊 Load data
  if (id === "history") loadHistory();
  if (id === "graph") loadGraph();
  if (id === "budget") loadBudgetUI();
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

  if (!amount) return alert("Enter amount!");

  // 🔥 FORCE SIGN
  if (type === "expense") {
    amount = -Math.abs(amount);
  } else {
    amount = Math.abs(amount);
  }

  let now = new Date();
  let selected = new Date(selectedDate);

  selected.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

  // 🔥 MONTH KEY FROM SELECTED DATE
  let monthKey = selectedDate.slice(0, 7);

  // 🔥 UNIQUE ID (SAFE)
  let id = Date.now() + "-" + Math.floor(Math.random() * 1000);

  // 🔥 DISPLAY ID (READABLE)
  let day = selectedDate.split("-")[2];

  let counterMap = JSON.parse(localStorage.getItem("idCounter")) || {};
  let key = `${monthKey}-${day}`;

  let serial = (counterMap[key] || 0) + 1;
  counterMap[key] = serial;

  localStorage.setItem("idCounter", JSON.stringify(counterMap));

  let displayId = `${key}-${String(serial).padStart(3, '0')}`;

  // 🔥 SAVE OBJECT
  expenses.push({
    id,
    displayId,

    amount,
    category,
    purpose,

    type,
    paymentType,

    source: "budget",   // 🔥 AUTO

    monthKey,
    date: selected.toISOString()
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  // RESET
  document.getElementById("amount").value = "";
  document.getElementById("purpose").value = "";
  document.getElementById("entryType").value = "expense";

  setDefaultDate();
  updateUI();
  showScreen("home");
}
/* =========================
   💰 BUDGET
========================= */
/* =========================
💰 BUDGET SYSTEM (UPGRADED)
========================= */

function saveBudget() {
  const btn = document.querySelector("#budget button.primary");

  // 🚫 Prevent multiple clicks
  if (btn.disabled) return;
  btn.disabled = true;

  let amount = Number(document.getElementById("budgetAmount").value);
  let type = document.getElementById("budgetType").value;
  let month = document.getElementById("budgetMonth").value;

  // ❌ VALIDATION
  if (!amount || amount <= 0) {
    showToast("⚠️ Enter valid budget amount");
    btn.disabled = false;
    return;
  }

  if (!month) {
    showToast("⚠️ Select month");
    btn.disabled = false;
    return;
  }

  // =========================
  // 💾 LOAD STORAGE
  // =========================
  let budgetAllocations =
    JSON.parse(localStorage.getItem("budgetAllocations")) || {};

  let savingsTransactions =
    JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  // =========================
  // 🔒 PREVENT DUPLICATE (same day, same amount)
  // =========================
  let alreadyExists = savingsTransactions.find(t =>
    t.type === "budget_allocation" &&
    t.amount === -amount &&
    new Date(t.date).toDateString() === new Date().toDateString()
  );

  if (alreadyExists) {
    showToast("⚠️ Budget already allocated today");
    btn.disabled = false;
    return;
  }

  // =========================
  // 💰 CHECK SAVINGS BALANCE
  // =========================
  let currentSavings = savingsTransactions.reduce((sum, t) => sum + t.amount, 0);

  if (amount > currentSavings) {
    showToast("❌ Not enough savings");
    btn.disabled = false;
    return;
  }

  // =========================
  // ➕ ADD BUDGET
  // =========================
  if (!budgetAllocations[month]) {
    budgetAllocations[month] = [];
  }

  budgetAllocations[month].push({
    amount: amount,
    type: type,
    date: new Date().toISOString()
  });

  localStorage.setItem(
    "budgetAllocations",
    JSON.stringify(budgetAllocations)
  );

  // =========================
  // 🔗 LINK TO SAVINGS
  // =========================
  savingsTransactions.push({
    id: Date.now(),
    type: "budget_allocation",
    amount: -amount,
    note: "Allocated to Budget",
    date: new Date().toISOString()
  });

  localStorage.setItem(
    "savingsTransactions",
    JSON.stringify(savingsTransactions)
  );

  // =========================
  // 📊 UPDATE UI
  // =========================
  let totalBudget = budgetAllocations[month].reduce(
    (sum, b) => sum + b.amount,
    0
  );

  document.getElementById("currentBudget").innerText = totalBudget;

  // DAILY CALCULATION
  let daily = 0;

  if (type === "monthly") {
    let [year, mon] = month.split("-");
    let days = new Date(year, mon, 0).getDate();
    daily = amount / days;
  } else if (type === "weekly") {
    daily = amount / 7;
  } else {
    daily = amount;
  }

  document.getElementById("calculatedDaily").innerText = Math.floor(daily);

  // STORE (compatibility)
  localStorage.setItem("budget", totalBudget);
  localStorage.setItem("dailyBudget", daily);

  // RESET INPUT
  document.getElementById("budgetAmount").value = "";

  // SUCCESS FEEDBACK
  showToast("✅ Budget saved");

  updateUI();

  // 🔓 Re-enable button
  setTimeout(() => {
    btn.disabled = false;
  }, 800);
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

/* =========================
   📊 GRAPH
========================= */
// function loadGraph(type = "day", mode = "app") {
//   let ctx = document.getElementById("myChart");

//   if (chart) chart.destroy();

//   let labels = [], expenseData = [];

//   // ---------------------------
//   // 📊 DATA PREPARATION
//   // ---------------------------
//   if (type === "day") {
//     for (let i = 0; i < 24; i++) {
//       labels.push(i + ":00");
//       expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
//     }
//   }

//   if (type === "week") {
//     let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//     for (let i = 0; i < 7; i++) {
//       labels.push(days[i]);
//       expenseData.push(sumBy(e => new Date(e.date).getDay() === i));
//     }
//   }

//   if (type === "month") {
//     for (let i = 1; i <= 30; i++) {
//       labels.push(i);
//       expenseData.push(sumBy(e => new Date(e.date).getDate() === i));
//     }
//   }

//   let budgetData = labels.map(() => dailyBudget);

//   let chartType = mode === "app" ? "bar" : "line";

//   let datasets =
//     mode === "app"
//       ? [
//         {
//           label: "Expenses",
//           data: expenseData,
//           backgroundColor: "#4CAF50"
//         },
//         {
//           label: "Budget",
//           data: budgetData,
//           backgroundColor: "#FF7043"
//         }
//       ]
//       : [
//         {
//           label: "Expenses",
//           data: expenseData,
//           borderColor: "#4CAF50",
//           backgroundColor: "transparent",
//           tension: 0.3
//         },
//         {
//           label: "Budget",
//           data: budgetData,
//           borderColor: "#FF7043",
//           backgroundColor: "transparent",
//           borderDash: [5, 5],
//           tension: 0.3
//         }
//       ];

//   chart = new Chart(ctx, {
//     type: chartType,
//     data: {
//       labels,
//       datasets
//     },
//     options: {
//       responsive: true,
//       animation: {
//         duration: 400 // important for PDF timing
//       },
//       plugins: {
//         legend: {
//           display: true
//         }
//       },
//       scales: {
//         y: {
//           beginAtZero: true
//         }
//       }
//     }
//   });
// // }

// function loadGraph(type = "day", mode = "app") {
//   let ctx = document.getElementById("myChart");

//   if (chart) chart.destroy();

//   let labels = [], expenseData = [];

//   // ---------------------------
//   // 📊 DATA
//   // ---------------------------
//   if (type === "day") {
//     for (let i = 0; i < 24; i++) {
//       labels.push(i + ":00");
//       expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
//     }
//   }

//   if (type === "week") {
//     let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
//     for (let i = 0; i < 7; i++) {
//       labels.push(days[i]);
//       expenseData.push(sumBy(e => new Date(e.date).getDay() === i));
//     }
//   }

//   if (type === "month") {
//     for (let i = 1; i <= 30; i++) {
//       labels.push(i);
//       expenseData.push(sumBy(e => new Date(e.date).getDate() === i));
//     }
//   }

//   let budgetData = labels.map(() => dailyBudget);

//   // ---------------------------
//   // 📊 CHART TYPE
//   // ---------------------------
//   let chartType = "bar"; // mobile stays bar

//   let datasets = [
//     {
//       label: "Expenses",
//       data: expenseData,
//       backgroundColor: "#4CAF50"
//     },
//     {
//       label: "Budget",
//       data: budgetData,
//       type: "line",
//       borderColor: "#FF7043",
//       borderWidth: 2,
//       fill: false,
//       tension: 0,        // 🔥 straight line
//       pointRadius: 0     // 🔥 no dots
//     }
//   ];

//   chart = new Chart(ctx, {
//     type: chartType,
//     data: {
//       labels,
//       datasets
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false, // required with fixed height
//       animation: {
//         duration: 300
//       },
//       plugins: {
//         legend: {
//           display: true
//         }
//       },
//       scales: {
//         y: {
//           beginAtZero: true
//         }
//       }
//     }
//   });
// // }
// function loadGraph(type = "day", mode = "app") {
//   let ctx = document.getElementById("myChart");

//   if (chart) chart.destroy();

//   let labels = [], expenseData = [];

//   // ---------------------------
//   // 📊 DAY
//   // ---------------------------
//   if (type === "day") {
//     for (let i = 0; i < 24; i++) {
//       labels.push(i + ":00");
//       expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
//     }
//   }

//   // ---------------------------
//   // 📊 WEEK (WITH DATES)
//   // ---------------------------
//   if (type === "week") {
//     let now = new Date();
//     let start = new Date(now);
//     start.setDate(now.getDate() - now.getDay());

//     for (let i = 0; i < 7; i++) {
//       let current = new Date(start);
//       current.setDate(start.getDate() + i);

//       let dayName = current.toLocaleDateString("en-US", { weekday: "short" });
//       let date = current.getDate();

//       labels.push(`${dayName} (${date})`);

//       expenseData.push(
//         sumBy(e => {
//           let d = new Date(e.date);
//           return d.toDateString() === current.toDateString();
//         })
//       );
//     }
//   }

//   // ---------------------------
//   // 📊 MONTH
//   // ---------------------------
//   if (type === "month") {
//     for (let i = 1; i <= 30; i++) {
//       labels.push(i);
//       expenseData.push(sumBy(e => new Date(e.date).getDate() === i));
//     }
//   }

//   let budgetData = labels.map(() => dailyBudget);

//   // ---------------------------
//   // 📊 DATASETS
//   // ---------------------------
//   let datasets = [
//     {
//       label: "Expenses",
//       data: expenseData,
//       backgroundColor: "#4CAF50"
//     },
//     {
//       label: "Budget",
//       data: budgetData,
//       type: "line",
//       borderColor: "#FF7043",
//       borderWidth: 2,
//       fill: false,
//       tension: 0,
//       pointRadius: 4,        // 🔥 visible points
//       pointHoverRadius: 6,   // 🔥 bigger on hover
//       pointBackgroundColor: "#FF7043"
//     }
//   ];

//   chart = new Chart(ctx, {
//     type: "bar",
//     data: {
//       labels,
//       datasets
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,

//       interaction: {
//         mode: "index",   // 🔥 shows both values together
//         intersect: false
//       },

//       plugins: {
//         legend: {
//           display: true
//         },

//         tooltip: {
//           enabled: true,
//           callbacks: {
//             label: function (context) {
//               return context.dataset.label + ": ₹" + context.raw;
//             }
//           }
//         }
//       },

//       scales: {
//         y: {
//           beginAtZero: true
//         }
//       }
//     }
//   });
// }

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

// function exportPDF() {
//   // Destroy old chart first
//   if (chart) chart.destroy();

//   let ctx = document.getElementById("myChart");

//   let labels = [], expenseData = [];

//   // Prepare data (same logic)
//   for (let i = 0; i < 24; i++) {
//     labels.push(i + ":00");
//     expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
//   }

//   let budgetData = labels.map(() => dailyBudget);

//   // 🔥 Create PDF chart with CALLBACK
//   chart = new Chart(ctx, {
//     type: "line",
//     data: {
//       labels,
//       datasets: [
//         {
//           label: "Expenses",
//           data: expenseData,
//           borderColor: "#4CAF50",
//           backgroundColor: "transparent",
//           tension: 0.3
//         },
//         {
//           label: "Budget",
//           data: budgetData,
//           borderColor: "#FF7043",
//           backgroundColor: "transparent",
//           borderDash: [5, 5],
//           tension: 0.3
//         }
//       ]
//     },
//     options: {
//       responsive: true,

//       animation: {
//         onComplete: function () {
//           // ✅ ONLY after chart fully drawn
//           downloadPDF();

//           // Switch back to app graph
//           loadGraph("day", "app");
//         }
//       },

//       plugins: {
//         legend: {
//           display: true
//         }
//       },

//       scales: {
//         y: {
//           beginAtZero: true
//         }
//       }
//     }
//   });
// }

// function downloadPDF() {
//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   // ---------------------------
//   // 🟢 TITLE
//   // ---------------------------
//   doc.setFontSize(18);
//   doc.setFont(undefined, "bold");
//   doc.text("Money Tracker Report", 14, 15);

//   // ---------------------------
//   // 🟡 SUBTITLE
//   // ---------------------------
//   doc.setFontSize(9);
//   doc.setTextColor(120);
//   doc.text("Generated on: " + new Date().toLocaleString(), 14, 22);

//   doc.setDrawColor(200);
//   doc.line(10, 25, 200, 25);

//   let y = 32;

//   // ---------------------------
//   // 🟢 EXPENSE TABLE
//   // ---------------------------
//   const col = {
//     date: 12,
//     category: 40,
//     amount: 90,
//     purpose: 105
//   };

//   doc.setFillColor(76, 175, 80);
//   doc.rect(10, y - 6, 190, 10, "F");

//   doc.setTextColor(255);
//   doc.setFontSize(10);
//   doc.setFont(undefined, "bold");

//   doc.text("Date", col.date, y);
//   doc.text("Category", col.category, y);
//   doc.text("Amount", col.amount, y, { align: "right" });
//   doc.text("Purpose", col.purpose, y);

//   y += 12;

//   doc.setTextColor(0);
//   doc.setFont(undefined, "normal");

//   let total = 0;
//   let list = document.querySelectorAll(".expense-item");

//   list.forEach((item, index) => {
//     let text = item.innerText.replace("🗑", "").trim().split("\n");

//     let [categoryPart, datePart] = text;
//     let [category, amountRaw] = categoryPart.split(" - ₹");

//     let amount = Number(amountRaw);
//     total += amount;

//     let formatted = new Intl.NumberFormat("en-IN").format(amount);

//     if (y > 280) {
//       doc.addPage();
//       y = 20;
//     }

//     if (index % 2 === 0) {
//       doc.setFillColor(245, 245, 245);
//       doc.rect(10, y - 5, 190, 8, "F");
//     }

//     doc.text(datePart.split(",")[0], col.date, y);
//     doc.text(category, col.category, y);
//     doc.text(`Rs. ${formatted}`, col.amount, y, { align: "right" });
//     doc.text("-", col.purpose, y);

//     y += 8;
//   });

//   // ---------------------------
//   // 🔵 TOTAL
//   // ---------------------------
//   y += 4;
//   doc.setDrawColor(200);
//   doc.line(10, y, 200, y);

//   y += 8;
//   doc.setFont(undefined, "bold");

//   let fTotal = new Intl.NumberFormat("en-IN").format(total);
//   doc.text(`Total: Rs. ${fTotal}`, 190, y, { align: "right" });

//   // ---------------------------
//   // 🟣 MONTHLY SUMMARY
//   // ---------------------------
//   y += 12;

//   if (y > 260) {
//     doc.addPage();
//     y = 20;
//   }

//   doc.setFontSize(13);
//   doc.text("Budget Summary (Monthly)", 14, y);

//   y += 6;
//   doc.setDrawColor(180);
//   doc.line(10, y, 200, y);

//   y += 8;

//   const mcol = {
//     month: 14,
//     budget: 90,
//     spent: 130,
//     remaining: 170
//   };

//   doc.setFontSize(10);
//   doc.setFont(undefined, "bold");

//   doc.text("Month", mcol.month, y);
//   doc.text("Budget", mcol.budget, y, { align: "right" });
//   doc.text("Spent", mcol.spent, y, { align: "right" });
//   doc.text("Remaining", mcol.remaining, y, { align: "right" });

//   y += 6;

//   doc.setFont(undefined, "normal");

//   // Group by month
//   let monthMap = {};

//   expenses.forEach(e => {
//     let d = new Date(e.date);
//     let key = d.toLocaleString("en-IN", { month: "short", year: "numeric" });

//     if (!monthMap[key]) monthMap[key] = 0;
//     monthMap[key] += e.amount;
//   });

//   Object.keys(monthMap).forEach((month, index) => {
//     let spent = monthMap[month];
//     let monthlyBudget = budget;
//     let remaining = monthlyBudget - spent;

//     let fBudget = new Intl.NumberFormat("en-IN").format(monthlyBudget);
//     let fSpent = new Intl.NumberFormat("en-IN").format(spent);
//     let fRemain = new Intl.NumberFormat("en-IN").format(remaining);

//     if (y > 280) {
//       doc.addPage();
//       y = 20;
//     }

//     if (index % 2 === 0) {
//       doc.setFillColor(245, 245, 245);
//       doc.rect(10, y - 4, 190, 8, "F");
//     }

//     doc.text(month, mcol.month, y);
//     doc.text(`Rs. ${fBudget}`, mcol.budget, y, { align: "right" });
//     doc.text(`Rs. ${fSpent}`, mcol.spent, y, { align: "right" });

//     if (remaining < 0) doc.setTextColor(200, 0, 0);
//     else doc.setTextColor(0, 150, 0);

//     doc.text(`Rs. ${fRemain}`, mcol.remaining, y, { align: "right" });

//     doc.setTextColor(0);

//     y += 8;
//   });

//   // ---------------------------
//   // 📊 GRAPH
//   // ---------------------------
//   y += 12;

//   const canvas = document.createElement("canvas");
//   canvas.width = 800;
//   canvas.height = 400;

//   const ctx = canvas.getContext("2d");

//   let labels = [];
//   let data = [];

//   for (let i = 0; i < 24; i++) {
//     labels.push(i + ":00");
//     data.push(sumBy(e => new Date(e.date).getHours() === i));
//   }

//   let budgetData = labels.map(() => dailyBudget);

//   const chart = new Chart(ctx, {
//     type: "line",
//     data: {
//       labels,
//       datasets: [
//         {
//           label: "Expenses",
//           data,
//           borderColor: "#4CAF50",
//           tension: 0.3
//         },
//         {
//           label: "Budget",
//           data: budgetData,
//           borderColor: "#FF7043",
//           borderDash: [5, 5],
//           tension: 0.3
//         }
//       ]
//     },
//     options: {
//       responsive: false,
//       animation: false
//     }
//   });

//   let img = canvas.toDataURL("image/png");

//   if (y + 80 > 290) {
//     doc.addPage();
//     y = 20;
//   }

//   doc.setFont(undefined, "bold");
//   doc.text("Expense Chart", 14, y);

//   y += 6;

//   doc.addImage(img, "PNG", 10, y, 180, 80);

//   chart.destroy();

//   // ---------------------------
//   // 💾 SAVE
//   // ---------------------------
//   doc.save("expenses-report.pdf");
// }

function exportPDF() {
  downloadPDF();
}


// function downloadPDF() {
//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   // ---------------------------
//   // 🟢 TITLE
//   // ---------------------------
//   doc.setFontSize(18);
//   doc.setFont(undefined, "bold");
//   doc.text("Money Tracker Report", 14, 15);

//   // Subtitle
//   doc.setFontSize(9);
//   doc.setTextColor(120);
//   doc.text("Generated on: " + new Date().toLocaleString(), 14, 22);

//   doc.setDrawColor(200);
//   doc.line(10, 25, 200, 25);

//   let y = 32;

//   // ---------------------------
//   // 🟢 EXPENSE TABLE
//   // ---------------------------
//   const col = {
//     date: 12,
//     category: 45,
//     amount: 120,
//     purpose: 140
//   };

//   doc.setFillColor(76, 175, 80);
//   doc.rect(10, y - 6, 190, 10, "F");

//   doc.setTextColor(255);
//   doc.setFontSize(10);
//   doc.setFont(undefined, "bold");

//   doc.text("Date", col.date, y);
//   doc.text("Category", col.category, y);
//   doc.text("Amount", col.amount, y, { align: "right" });
//   doc.text("Purpose", col.purpose, y);

//   y += 12;

//   doc.setTextColor(0);
//   doc.setFont(undefined, "normal");

//   let total = 0;
//   let list = document.querySelectorAll(".expense-item");

//   list.forEach((item, index) => {
//     let text = item.innerText.replace("🗑", "").trim().split("\n");

//     let [categoryPart, datePart] = text;
//     let [category, amountRaw] = categoryPart.split(" - ₹");

//     let amount = Number(amountRaw);
//     total += amount;

//     let formatted = new Intl.NumberFormat("en-IN").format(amount);

//     if (y > 280) {
//       doc.addPage();
//       y = 20;
//     }

//     if (index % 2 === 0) {
//       doc.setFillColor(245, 245, 245);
//       doc.rect(10, y - 5, 190, 8, "F");
//     }

//     doc.text(datePart.split(",")[0], col.date, y);
//     doc.text(category, col.category, y);
//     doc.text(`Rs. ${formatted}`, col.amount, y, { align: "right" });
//     doc.text("-", col.purpose, y);

//     y += 8;
//   });

//   // ---------------------------
//   // 🔵 TOTAL
//   // ---------------------------
//   y += 4;
//   doc.line(10, y, 200, y);

//   y += 8;
//   doc.setFont(undefined, "bold");

//   let fTotal = new Intl.NumberFormat("en-IN").format(total);
//   doc.text(`Total: Rs. ${fTotal}`, 190, y, { align: "right" });

//   // ---------------------------
//   // 🟣 MONTHLY SUMMARY
//   // ---------------------------
//   y += 12;

//   if (y > 260) {
//     doc.addPage();
//     y = 20;
//   }

//   doc.setFontSize(13);
//   doc.text("Budget Summary (Monthly)", 14, y);

//   y += 6;
//   doc.line(10, y, 200, y);

//   y += 8;

//   const mcol = {
//     month: 14,
//     budget: 90,
//     spent: 130,
//     remaining: 170
//   };

//   doc.setFontSize(10);
//   doc.setFont(undefined, "bold");

//   doc.text("Month", mcol.month, y);
//   doc.text("Budget", mcol.budget, y, { align: "right" });
//   doc.text("Spent", mcol.spent, y, { align: "right" });
//   doc.text("Remaining", mcol.remaining, y, { align: "right" });

//   y += 6;
//   doc.setFont(undefined, "normal");

//   let monthMap = {};

//   (currentFilteredExpenses.length ? currentFilteredExpenses : expenses).forEach(e => {
//     let d = new Date(e.date);
//     let key = d.toLocaleString("en-IN", { month: "short", year: "numeric" });

//     monthMap[key] = (monthMap[key] || 0) + e.amount;
//   });

//   Object.keys(monthMap).forEach((month, index) => {
//     let spent = monthMap[month];
//     let remaining = budget - spent;

//     let fBudget = new Intl.NumberFormat("en-IN").format(budget);
//     let fSpent = new Intl.NumberFormat("en-IN").format(spent);
//     let fRemain = new Intl.NumberFormat("en-IN").format(remaining);

//     if (y > 280) {
//       doc.addPage();
//       y = 20;
//     }

//     if (index % 2 === 0) {
//       doc.setFillColor(245, 245, 245);
//       doc.rect(10, y - 4, 190, 8, "F");
//     }

//     doc.text(month, mcol.month, y);
//     doc.text(`Rs. ${fBudget}`, mcol.budget, y, { align: "right" });
//     doc.text(`Rs. ${fSpent}`, mcol.spent, y, { align: "right" });

//     doc.setTextColor(remaining < 0 ? 200 : 0, remaining < 0 ? 0 : 150, 0);
//     doc.text(`Rs. ${fRemain}`, mcol.remaining, y, { align: "right" });

//     doc.setTextColor(0);
//     y += 8;
//   });

//   // ---------------------------
//   // 📊 GRAPH (FINAL FIXED ✅)
//   // ---------------------------
//   // ---------------------------
//   // 📊 GRAPH (FINAL CORRECT ✅)
//   // ---------------------------
//   y += 12;

//   const canvas = document.createElement("canvas");
//   canvas.width = 800;
//   canvas.height = 400;

//   const ctx = canvas.getContext("2d");

//   // 🔥 USE FILTERED DATA FIRST
//   let dataSource = currentFilteredExpenses.length
//     ? currentFilteredExpenses
//     : expenses;

//   let map = {};

//   // 🔥 GROUP BASED ON FILTER TYPE
//   dataSource.forEach(e => {
//     let d = new Date(e.date);

//     let key;

//     if (dataSource.length <= 24) {
//       // DAY → hour
//       key = d.getHours() + ":00";
//     } else if (dataSource.length <= 7) {
//       // WEEK → day
//       key = d.toLocaleDateString("en-IN", { weekday: "short" });
//     } else {
//       // MONTH / CUSTOM → date
//       key = d.toLocaleDateString("en-IN");
//     }

//     map[key] = (map[key] || 0) + e.amount;
//   });

//   let labels = Object.keys(map);
//   let data = Object.values(map);
//   let budgetData = labels.map(() => dailyBudget);

//   // 🔥 HANDLE SINGLE POINT (important for smooth graph)
//   if (labels.length === 1) {
//     labels = [" ", labels[0], " "];
//     data = [0, data[0], 0];
//     budgetData = [0, budgetData[0], 0];
//   }

//   // ---------------------------
//   // 📈 CHART
//   // ---------------------------
//   const chart = new Chart(ctx, {
//     type: "line",
//     data: {
//       labels,
//       datasets: [
//         {
//           label: "Expenses",
//           data,
//           borderColor: "#4CAF50",
//           backgroundColor: "rgba(76,175,80,0.15)",
//           fill: true,
//           tension: 0.4,
//           pointRadius: 4
//         },
//         {
//           label: "Budget",
//           data: budgetData,
//           borderColor: "#FF7043",
//           borderDash: [5, 5],
//           tension: 0.4,
//           pointRadius: 3
//         }
//       ]
//     },
//     options: {
//       responsive: false,
//       animation: false,
//       plugins: {
//         legend: {
//           display: true
//         }
//       },
//       scales: {
//         y: {
//           beginAtZero: true,
//           suggestedMax: Math.max(...data) + 100
//         }
//       }
//     }
//   });

//   // Convert to image
//   let img = canvas.toDataURL("image/png");

//   // Page handling
//   if (y + 90 > 290) {
//     doc.addPage();
//     y = 20;
//   }

//   // Title
//   doc.setFont(undefined, "bold");
//   doc.text("Expense Chart", 14, y);

//   y += 6;

//   // Add chart image
//   doc.addImage(img, "PNG", 10, y, 180, 90);

//   chart.destroy();

//   // ---------------------------
//   // 💾 SAVE
//   // ---------------------------
//   doc.save("expenses-report.pdf");
// }

// function downloadPDF() {
//   const { jsPDF } = window.jspdf;
//   const doc = new jsPDF();

//   let dataSource = currentFilteredExpenses.length
//     ? currentFilteredExpenses
//     : expenses;

//   // ---------------------------
//   // 🟢 TITLE
//   // ---------------------------
//   doc.setFontSize(18);
//   doc.setFont(undefined, "bold");
//   doc.text("Money Tracker Report", 14, 15);

//   // ---------------------------
//   // 🟡 SUBTITLE
//   // ---------------------------
//   doc.setFontSize(9);
//   doc.setTextColor(120);

//   let generated = new Date().toLocaleString();

//   doc.text(`Generated on: ${generated}`, 14, 22);
//   doc.text(`Total Entries: ${dataSource.length}`, 14, 27);

//   doc.setDrawColor(200);
//   doc.line(10, 30, 200, 30);

//   let y = 40;

//   // ---------------------------
//   // 🟢 TABLE HEADER
//   // ---------------------------
//   const col = {
//     date: 10,
//     type: 38,
//     category: 65,
//     amount: 110,
//     purpose: 130
//   };

//   doc.setFillColor(76, 175, 80);
//   doc.rect(10, y - 6, 190, 10, "F");

//   doc.setTextColor(255);
//   doc.setFontSize(10);
//   doc.setFont(undefined, "bold");

//   doc.text("Date", col.date, y);
//   doc.text("Type", col.type, y);
//   doc.text("Category", col.category, y);
//   doc.text("Amount", col.amount, y, { align: "right" });
//   doc.text("Purpose", col.purpose, y);

//   y += 12;

//   doc.setTextColor(0);
//   doc.setFont(undefined, "normal");

//   // ---------------------------
//   // 🟢 TABLE DATA
//   // ---------------------------
//   let totalIncome = 0;
//   let totalExpense = 0;

//   dataSource.forEach((e, index) => {
//     let date = new Date(e.date).toLocaleDateString("en-IN");
//     let category = e.category;
//     let amount = e.amount;
//     let purpose = e.purpose || "-";
//     let type = e.type || (amount < 0 ? "expense" : "income");

//     if (amount > 0) {
//       totalIncome += amount;
//     } else {
//       totalExpense += Math.abs(amount);
//     }

//     let formatted = new Intl.NumberFormat("en-IN").format(amount);

//     if (y > 280) {
//       doc.addPage();
//       y = 20;
//     }

//     if (index % 2 === 0) {
//       doc.setFillColor(245, 245, 245);
//       doc.rect(10, y - 5, 190, 8, "F");
//     }

//     doc.text(date, col.date, y);

//     // 🔥 TYPE
//     if (type === "expense") {
//       doc.setTextColor(200, 0, 0);
//       doc.text("Expense", col.type, y);
//     } else {
//       doc.setTextColor(0, 150, 0);
//       doc.text("Income", col.type, y);
//     }

//     doc.setTextColor(0);

//     // CATEGORY
//     doc.text(category, col.category, y);

//     // 🔥 AMOUNT COLOR
//     if (amount < 0) {
//       doc.setTextColor(200, 0, 0);
//     } else {
//       doc.setTextColor(0, 150, 0);
//     }

//     doc.text(`Rs. ${formatted}`, col.amount, y, { align: "right" });

//     doc.setTextColor(0);

//     // PURPOSE
//     let splitPurpose = doc.splitTextToSize(purpose, 60);
//     doc.text(splitPurpose, col.purpose, y);

//     // 🔥 dynamic height
//     y += Math.max(8, splitPurpose.length * 5);
//   });

//   // ---------------------------
//   // 🔵 TOTAL
//   // ---------------------------
//   y += 4;
//   doc.line(10, y, 200, y);

//   y += 8;
//   doc.setFont(undefined, "bold");

//   //let fTotal = new Intl.NumberFormat("en-IN").format(total);
//   //y += 6;
//   //doc.line(10, y, 200, y);

//   y += 10;
//   doc.setFont(undefined, "bold");

//   // 🔥 Income (Green)
//   doc.setTextColor(0, 150, 0);
//   doc.text(
//     `Income: Rs. ${new Intl.NumberFormat("en-IN").format(totalIncome)}`,
//     14,
//     y
//   );

//   y += 8;

//   // 🔥 Expense (Red)
//   doc.setTextColor(200, 0, 0);
//   doc.text(
//     `Expense: Rs. ${new Intl.NumberFormat("en-IN").format(totalExpense)}`,
//     14,
//     y
//   );

//   y += 8;

//   // 🔥 Net (Smart Color)
//   let net = totalIncome - totalExpense;

//   if (net >= 0) {
//     doc.setTextColor(0, 150, 0);
//   } else {
//     doc.setTextColor(200, 0, 0);
//   }

//   doc.text(
//     `Net Balance: Rs. ${new Intl.NumberFormat("en-IN").format(net)}`,
//     14,
//     y
//   );

//   // reset color
//   doc.setTextColor(0);

//   // ---------------------------
//   // 🟣 BUDGET SUMMARY
//   // ---------------------------
//   y += 12;

//   if (y > 260) {
//     doc.addPage();
//     y = 20;
//   }

//   doc.setFontSize(13);
//   doc.text("Budget Summary (Monthly)", 14, y);

//   y += 5;
//   doc.setFontSize(9);
//   doc.setTextColor(120);
//   doc.text("Overview of budget vs spending for selected period", 14, y);

//   doc.setTextColor(0);
//   doc.setFontSize(10);

//   y += 6;
//   doc.line(10, y, 200, y);

//   y += 8;

//   const mcol = {
//     month: 14,
//     budget: 90,
//     spent: 130,
//     remaining: 170
//   };

//   doc.setFont(undefined, "bold");

//   doc.text("Month", mcol.month, y);
//   doc.text("Budget", mcol.budget, y, { align: "right" });
//   doc.text("Spent", mcol.spent, y, { align: "right" });
//   doc.text("Remaining", mcol.remaining, y, { align: "right" });

//   y += 6;
//   doc.setFont(undefined, "normal");

//   let monthMap = {};

//   dataSource.forEach(e => {
//     let d = new Date(e.date);
//     let key = d.toLocaleString("en-IN", { month: "short", year: "numeric" });

//     if (!monthMap[key]) {
//       monthMap[key] = {
//         expense: 0,
//         income: 0
//       };
//     }

//     if (e.amount < 0) {
//       monthMap[key].expense += Math.abs(e.amount);
//     } else {
//       monthMap[key].income += e.amount;
//     }
//   });

//   Object.keys(monthMap).forEach((month, index) => {
//     let spent = monthMap[month].expense; // ✅ correct
//     let remaining = budget - spent;

//     let fBudget = new Intl.NumberFormat("en-IN").format(budget);
//     let fSpent = new Intl.NumberFormat("en-IN").format(Math.abs(spent));
//     let fRemain = new Intl.NumberFormat("en-IN").format(remaining);

//     if (y > 280) {
//       doc.addPage();
//       y = 20;
//     }

//     if (index % 2 === 0) {
//       doc.setFillColor(245, 245, 245);
//       doc.rect(10, y - 4, 190, 8, "F");
//     }

//     doc.text(month, mcol.month, y);
//     doc.text(`Rs. ${fBudget}`, mcol.budget, y, { align: "right" });
//     doc.text(`Rs. ${fSpent}`, mcol.spent, y, { align: "right" });

//     doc.setTextColor(remaining < 0 ? 200 : 0, remaining < 0 ? 0 : 150, 0);
//     doc.text(`Rs. ${fRemain}`, mcol.remaining, y, { align: "right" });

//     doc.setTextColor(0);
//     y += 8;
//   });

//   // ---------------------------
//   // 📊 GRAPH
//   // ---------------------------
//   y += 12;

//   const canvas = document.createElement("canvas");
//   canvas.width = 800;
//   canvas.height = 400;

//   const ctx = canvas.getContext("2d");

//   let expenseMap = {};
//   let incomeMap = {};

//   dataSource.forEach(e => {
//     let d = new Date(e.date).toLocaleDateString("en-IN");

//     if (e.amount < 0) {
//       expenseMap[d] = (expenseMap[d] || 0) + Math.abs(e.amount);
//     } else {
//       incomeMap[d] = (incomeMap[d] || 0) + e.amount;
//     }
//   });

//   let labels = Array.from(
//     new Set([
//       ...Object.keys(expenseMap),
//       ...Object.keys(incomeMap)
//     ])
//   );

//   let expenseData = labels.map(d => expenseMap[d] || 0);
//   let incomeData = labels.map(d => incomeMap[d] || 0);
//   let budgetData = labels.map(() => dailyBudget);

//   if (labels.length === 1) {
//     labels = [" ", labels[0], " "];
//     expenseData = [0, expenseData[0], 0];
//     incomeData = [0, incomeData[0], 0];
//     budgetData = [0, budgetData[0], 0];
//   }

//   const chart = new Chart(ctx, {
//     type: "line",
//     data: {
//       labels,
//       datasets: [
//         {
//           label: "Expenses",
//           data: expenseData,
//           borderColor: "#4CAF50",
//           backgroundColor: "rgba(76,175,80,0.15)",
//           fill: true,
//           tension: 0.4,
//           pointRadius: 4
//         },
//         {
//           label: "Income",
//           data: incomeData,
//           borderColor: "#42a5f5",
//           backgroundColor: "rgba(66,165,245,0.15)",
//           fill: true,
//           tension: 0.4,
//           pointRadius: 4
//         },
//         {
//           label: "Budget",
//           data: budgetData,
//           borderColor: "#FF7043",
//           borderDash: [5, 5],
//           tension: 0.4,
//           pointRadius: 3
//         }
//       ]
//     },
//     options: {
//       responsive: false,
//       animation: false
//     }
//   });

//   setTimeout(() => {
//   let img = canvas.toDataURL("image/png", 1.0);

//   doc.addImage(img, "PNG", 10, y, 180, 90);

//   chart.destroy();

//   let blob = doc.output("blob");
//   let url = URL.createObjectURL(blob);

//   let a = document.createElement("a");
//   a.href = url;
//   a.download = "expenses-report.pdf";
//   a.click();
// }, 300);
//   // ---------------------------
//   // 💾 SAVE
//   // ---------------------------
//   // doc.save("expenses-report.pdf");

//   let blob = doc.output("blob");
//   let url = URL.createObjectURL(blob);

//   let a = document.createElement("a");
//   a.href = url;
//   a.download = "expenses-report.pdf";
//   a.click();
// }
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
  // =========================
  // 📊 BASIC CALCULATIONS
  // =========================
  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().toISOString().slice(0, 7);

  const totalBudget = getTotalBudget(currentMonth);

  const spent = expenses
    .filter(e => e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  const income = expenses
    .filter(e => e.amount > 0)
    .reduce((sum, e) => sum + e.amount, 0);

  const remaining = totalBudget - spent;

  const todaySpent = expenses
    .filter(e => e.date.startsWith(today) && e.amount < 0)
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  // =========================
  // 📅 DAILY LIMIT
  // =========================
  let [year, month] = currentMonth.split("-");
  let daysInMonth = new Date(year, month, 0).getDate();

  const dailyLimit = totalBudget > 0 ? totalBudget / daysInMonth : 0;

  // =========================
  // 🖥️ UI UPDATE
  // =========================
  document.getElementById("budgetValue").innerText = totalBudget;
  document.getElementById("spent").innerText = spent;
  document.getElementById("remaining").innerText = remaining;
  document.getElementById("todaySpent").innerText = todaySpent;

  const dailyEl = document.getElementById("dailyLimit");
  if (dailyEl) {
    dailyEl.innerText = Math.floor(dailyLimit);
  }

  // =========================
  // 📊 PROGRESS BAR
  // =========================
  updateProgressBar(spent, totalBudget);
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

  let counterMap = JSON.parse(localStorage.getItem("idCounter")) || {};

  expenses.forEach(e => {

    // 🔥 FIX TYPE + SIGN
    if (!e.type) {
      if (e.amount > 0) {
        e.type = "expense";
        e.amount = -Math.abs(e.amount);
      } else {
        e.type = "income";
        e.amount = Math.abs(e.amount);
      }
      updated = true;
    }

    // 🔥 PAYMENT TYPE (CATEGORY BASED)
    // 🔥 PAYMENT TYPE (TARGETED FIX)
    if (!e.paymentType) {
      let d = new Date(e.date);
      let day = String(d.getDate()).padStart(2, "0");
      let month = String(d.getMonth() + 1).padStart(2, "0");
      let year = d.getFullYear();

      let formattedDate = `${day}/${month}/${year}`;

      // 🔥 YOUR SPECIFIC ENTRIES
      if (
        (Math.abs(e.amount) === 210 && formattedDate === "12/04/2026") ||
        (Math.abs(e.amount) === 70 && formattedDate === "13/04/2026") ||
        (Math.abs(e.amount) === 65 && formattedDate === "09/04/2026")
      ) {
        e.paymentType = "Cash";
      } else {
        e.paymentType = "PhonePe";
      }

      updated = true;
    }

    // 🔥 SOURCE (ALL EXPENSE FROM BUDGET)
    if (!e.source) {
      e.source = "budget";
      updated = true;
    }

    // 🔥 MONTH KEY
    if (!e.monthKey) {
      let d = new Date(e.date);
      e.monthKey = d.toISOString().slice(0, 7);
      updated = true;
    }

    // 🔥 UNIQUE ID
    if (!e.id) {
      e.id = Date.now() + "-" + Math.floor(Math.random() * 1000);
      updated = true;
    }

    // 🔥 DISPLAY ID (READABLE)
    if (!e.displayId) {
      let d = new Date(e.date);

      let monthKey = d.toISOString().slice(0, 7);
      let day = String(d.getDate()).padStart(2, "0");

      let key = `${monthKey}-${day}`;
      let serial = (counterMap[key] || 0) + 1;
      counterMap[key] = serial;

      e.displayId = `${key}-${String(serial).padStart(3, '0')}`;

      updated = true;
    }

  });

  localStorage.setItem("idCounter", JSON.stringify(counterMap));

  if (updated) {
    localStorage.setItem("expenses", JSON.stringify(expenses));
    console.log("✅ Data migrated successfully");
  }
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
// function showScreen(id) {
//   document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
//   document.getElementById(id).classList.add("active");

//   // 🔥 AUTO LOAD DATA
//   if (id === "history") {
//     handleFilter("all"); // default load
//   }

//   if (id === "graph") {
//     handleGraphFilter("day"); // default graph load
//   }
// }


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