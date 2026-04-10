/* =========================
   📦 STORAGE
========================= */
let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let budget = Number(localStorage.getItem("budget")) || 0;
let dailyBudget = Number(localStorage.getItem("dailyBudget")) || 0;

let chart;
const appVersion = "1.1"; // change every update

/* =========================
   🚀 INIT
========================= */
window.onload = () => {
  initCategories();
  loadTheme();
  updateUI();
  showDate();
  renderCategoryList();

  // ✅ Safe version update
  loadVersion();
  setDefaultDate();
};

function setDefaultDate() {
  let today = new Date().toISOString().split("T")[0];
  document.getElementById("expenseDate").value = today;
}
/* =========================
   🧭 NAVIGATION
========================= */
function showScreen(id) {
  // ---------------------------
  // 🧭 SCREEN SWITCH
  // ---------------------------
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

  // ---------------------------
  // 🔥 NAV ACTIVE STATE
  // ---------------------------
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.classList.remove("active");
  });

  // Find clicked button and activate it
  const btn = document.querySelector(`.nav button[onclick="showScreen('${id}')"]`);
  if (btn) btn.classList.add("active");

  // ---------------------------
  // 📊 LOAD DATA
  // ---------------------------
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
  let amount = document.getElementById("amount").value;
  let category = document.getElementById("category").value;
  let purpose = document.getElementById("purpose").value;
  let selectedDate = document.getElementById("expenseDate").value;

  if (!amount) return alert("Enter amount!");

  // 🔥 combine selected date + current time
  let now = new Date();
  let selected = new Date(selectedDate);

  selected.setHours(now.getHours());
  selected.setMinutes(now.getMinutes());
  selected.setSeconds(now.getSeconds());

  expenses.push({
    amount: Number(amount),
    category,
    purpose,
    date: selected.toISOString() // ✅ date + hidden time
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  document.getElementById("amount").value = "";
  document.getElementById("purpose").value = "";

  setDefaultDate(); // reset to today

  updateUI();
  showScreen("home");
}
/* =========================
   💰 BUDGET
========================= */
function saveBudget() {
  let amount = Number(document.getElementById("budgetAmount").value);
  let type = document.getElementById("budgetType").value;

  if (!amount) return alert("Enter budget");

  budget = amount;

  if (type === "monthly") dailyBudget = amount / 30;
  else if (type === "weekly") dailyBudget = amount / 7;
  else dailyBudget = amount;

  localStorage.setItem("budget", budget);
  localStorage.setItem("dailyBudget", dailyBudget);

  loadBudgetUI();
  updateUI();
}

function loadBudgetUI() {
  document.getElementById("currentBudget").innerText = budget;
  document.getElementById("calculatedDaily").innerText = Math.floor(dailyBudget);
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
        <strong>${e.category}</strong> - ₹${e.amount}<br>
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
    document.getElementById("dateModal").style.display = "flex";
    return;
  }

  let filtered = expenses.filter(e => {
    let d = new Date(e.date);

    if (type === "today") return d.toDateString() === now.toDateString();

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

  loadHistory(filtered);
}

function applyDateFilter() {
  let from = document.getElementById("fromDate").value;
  let to = document.getElementById("toDate").value;

  let filtered = expenses.filter(e => {
    let d = new Date(e.date).toISOString().split("T")[0];
    return d >= from && d <= to;
  });

  loadHistory(filtered);
  closeModal();
}

function closeModal() {
  document.getElementById("dateModal").style.display = "none";
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

function loadGraph(type = "day", mode = "app") {
  let ctx = document.getElementById("myChart");

  if (chart) chart.destroy();

  let labels = [], expenseData = [];

  // ---------------------------
  // 📊 DATA
  // ---------------------------
  if (type === "day") {
    for (let i = 0; i < 24; i++) {
      labels.push(i + ":00");
      expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
    }
  }

  if (type === "week") {
    let now = new Date();
    let start = new Date(now);
    start.setDate(now.getDate() - now.getDay());

    for (let i = 0; i < 7; i++) {
      let current = new Date(start);
      current.setDate(start.getDate() + i);

      let dayName = current.toLocaleDateString("en-US", { weekday: "short" });
      let date = current.getDate();

      labels.push(`${dayName} (${date})`);

      expenseData.push(
        sumBy(e => {
          let d = new Date(e.date);
          return d.toDateString() === current.toDateString();
        })
      );
    }
  }

  if (type === "month") {
    for (let i = 1; i <= 30; i++) {
      labels.push(i);
      expenseData.push(sumBy(e => new Date(e.date).getDate() === i));
    }
  }

  let budgetData = labels.map(() => dailyBudget);

  // 🔥 GET THEME COLORS
  let { expenseColor, budgetColor } = getThemeColors();

  let datasets = [
    {
      label: "Expenses",
      data: expenseData,
      backgroundColor: expenseColor
    },
    {
      label: "Budget",
      data: budgetData,
      type: "line",
      borderColor: budgetColor,
      borderWidth: 2,
      fill: false,
      tension: 0,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointBackgroundColor: budgetColor
    }
  ];

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false
      },

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
  return expenses.reduce((sum, e) => fn(e) ? sum + e.amount : sum, 0);
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
  if (chart) chart.destroy();

  let ctx = document.getElementById("myChart");

  let labels = [], expenseData = [];

  // 🔥 SAME LOGIC AS APP (IMPORTANT FIX)
  for (let i = 0; i < 24; i++) {
    labels.push(i + ":00");
    expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
  }

  let budgetData = labels.map(() => dailyBudget);

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data: expenseData,
          borderColor: "#4CAF50",
          backgroundColor: "transparent",
          tension: 0.3
        },
        {
          label: "Budget",
          data: budgetData,
          borderColor: "#FF7043",
          borderDash: [5, 5],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,

      animation: {
        onComplete: function () {
          downloadPDF();

          // 🔥 restore mobile graph
          loadGraph("day", "app");
        }
      },

      plugins: {
        legend: {
          display: true
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

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let dataSource = currentFilteredExpenses.length
    ? currentFilteredExpenses
    : expenses;

  // ---------------------------
  // 🟢 TITLE
  // ---------------------------
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text("Money Tracker Report", 14, 15);

  // ---------------------------
  // 🟡 SUBTITLE
  // ---------------------------
  doc.setFontSize(9);
  doc.setTextColor(120);

  let generated = new Date().toLocaleString();

  doc.text(`Generated on: ${generated}`, 14, 22);
  doc.text(`Total Entries: ${dataSource.length}`, 14, 27);

  doc.setDrawColor(200);
  doc.line(10, 30, 200, 30);

  let y = 40;

  // ---------------------------
  // 🟢 TABLE HEADER
  // ---------------------------
  const col = {
    date: 12,
    category: 45,
    amount: 120,
    purpose: 155
  };

  doc.setFillColor(76, 175, 80);
  doc.rect(10, y - 6, 190, 10, "F");

  doc.setTextColor(255);
  doc.setFontSize(10);
  doc.setFont(undefined, "bold");

  doc.text("Date", col.date, y);
  doc.text("Category", col.category, y);
  doc.text("Amount", col.amount, y, { align: "right" });
  doc.text("Purpose", col.purpose, y);

  y += 12;

  doc.setTextColor(0);
  doc.setFont(undefined, "normal");

  // ---------------------------
  // 🟢 TABLE DATA
  // ---------------------------
  let total = 0;

  dataSource.forEach((e, index) => {
    let date = new Date(e.date).toLocaleDateString("en-IN");
    let category = e.category;
    let amount = e.amount;
    let purpose = e.purpose || "-";

    total += amount;

    let formatted = new Intl.NumberFormat("en-IN").format(amount);

    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(10, y - 5, 190, 8, "F");
    }

    doc.text(date, col.date, y);
    doc.text(category, col.category, y);
    doc.text(`Rs. ${formatted}`, col.amount, y, { align: "right" });
    doc.text(purpose, col.purpose, y);

    y += 8;
  });

  // ---------------------------
  // 🔵 TOTAL
  // ---------------------------
  y += 4;
  doc.line(10, y, 200, y);

  y += 8;
  doc.setFont(undefined, "bold");

  let fTotal = new Intl.NumberFormat("en-IN").format(total);
  doc.text(`Total: Rs. ${fTotal}`, 190, y, { align: "right" });

  // ---------------------------
  // 🟣 BUDGET SUMMARY
  // ---------------------------
  y += 12;

  if (y > 260) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(13);
  doc.text("Budget Summary (Monthly)", 14, y);

  y += 5;
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Overview of budget vs spending for selected period", 14, y);

  doc.setTextColor(0);
  doc.setFontSize(10);

  y += 6;
  doc.line(10, y, 200, y);

  y += 8;

  const mcol = {
    month: 14,
    budget: 90,
    spent: 130,
    remaining: 170
  };

  doc.setFont(undefined, "bold");

  doc.text("Month", mcol.month, y);
  doc.text("Budget", mcol.budget, y, { align: "right" });
  doc.text("Spent", mcol.spent, y, { align: "right" });
  doc.text("Remaining", mcol.remaining, y, { align: "right" });

  y += 6;
  doc.setFont(undefined, "normal");

  let monthMap = {};

  dataSource.forEach(e => {
    let d = new Date(e.date);
    let key = d.toLocaleString("en-IN", { month: "short", year: "numeric" });

    monthMap[key] = (monthMap[key] || 0) + e.amount;
  });

  Object.keys(monthMap).forEach((month, index) => {
    let spent = monthMap[month];
    let remaining = budget - spent;

    let fBudget = new Intl.NumberFormat("en-IN").format(budget);
    let fSpent = new Intl.NumberFormat("en-IN").format(spent);
    let fRemain = new Intl.NumberFormat("en-IN").format(remaining);

    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    if (index % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(10, y - 4, 190, 8, "F");
    }

    doc.text(month, mcol.month, y);
    doc.text(`Rs. ${fBudget}`, mcol.budget, y, { align: "right" });
    doc.text(`Rs. ${fSpent}`, mcol.spent, y, { align: "right" });

    doc.setTextColor(remaining < 0 ? 200 : 0, remaining < 0 ? 0 : 150, 0);
    doc.text(`Rs. ${fRemain}`, mcol.remaining, y, { align: "right" });

    doc.setTextColor(0);
    y += 8;
  });

  // ---------------------------
  // 📊 GRAPH
  // ---------------------------
  y += 12;

  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;

  const ctx = canvas.getContext("2d");

  let map = {};

  dataSource.forEach(e => {
    let d = new Date(e.date).toLocaleDateString("en-IN");
    map[d] = (map[d] || 0) + e.amount;
  });

  let labels = Object.keys(map);
  let data = Object.values(map);
  let budgetData = labels.map(() => dailyBudget);

  if (labels.length === 1) {
    labels = [" ", labels[0], " "];
    data = [0, data[0], 0];
    budgetData = [0, budgetData[0], 0];
  }

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data,
          borderColor: "#4CAF50",
          backgroundColor: "rgba(76,175,80,0.15)",
          fill: true,
          tension: 0.4,
          pointRadius: 4
        },
        {
          label: "Budget",
          data: budgetData,
          borderColor: "#FF7043",
          borderDash: [5, 5],
          tension: 0.4,
          pointRadius: 3
        }
      ]
    },
    options: {
      responsive: false,
      animation: false
    }
  });

  let img = canvas.toDataURL("image/png");

  if (y + 90 > 290) {
    doc.addPage();
    y = 20;
  }

  doc.setFont(undefined, "bold");
  doc.text("Expense Chart", 14, y);

  y += 6;

  doc.addImage(img, "PNG", 10, y, 180, 90);

  chart.destroy();

  // ---------------------------
  // 💾 SAVE
  // ---------------------------
  doc.save("expenses-report.pdf");
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

function checkForUpdate() {
  const savedVersion = localStorage.getItem("app_version");

  if (savedVersion && savedVersion !== APP_VERSION) {

    if (confirm("🚀 New version available!\n\nClick OK to update now.")) {
      localStorage.setItem("app_version", APP_VERSION);
      location.reload(true);
    }

  } else {
    localStorage.setItem("app_version", APP_VERSION);
  }
}
async function sharePDF() {
  const { jsPDF } = window.jspdf;

  let doc = new jsPDF();

  let dataSource = currentFilteredExpenses.length
    ? currentFilteredExpenses
    : expenses;

  // Simple content (you can reuse full PDF logic if needed)
  doc.text("Money Tracker Report", 14, 15);

  let y = 25;

  dataSource.forEach((e) => {
    let date = new Date(e.date).toLocaleDateString("en-IN");
    let text = `${date} - ${e.category} - ₹${e.amount}`;
    doc.text(text, 14, y);
    y += 8;
  });

  // 🔥 Convert PDF to Blob
  let pdfBlob = doc.output("blob");

  let file = new File([pdfBlob], "expenses-report.pdf", {
    type: "application/pdf"
  });

  // 🔥 SHARE
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "Money Tracker Report",
        text: "Here is my expense report",
        files: [file]
      });
    } catch (err) {
      console.log("Share cancelled or failed", err);
    }
  } else {
    alert("Sharing not supported on this device");
  }
}
/* =========================
   📊 UI
========================= */
function updateUI() {
  let total = expenses.reduce((s, e) => s + e.amount, 0);

  let today = new Date().toISOString().split("T")[0];

  let todaySpent = expenses
    .filter(e => e.date.startsWith(today))
    .reduce((s, e) => s + e.amount, 0);

  document.getElementById("budgetValue").innerText = budget;
  document.getElementById("spent").innerText = total;
  document.getElementById("remaining").innerText = budget - total;
  document.getElementById("todaySpent").innerText = todaySpent;
  document.getElementById("dailyLimit").innerText = Math.floor(dailyBudget);
}

/* =========================
   🕒 DATE
========================= */
function showDate() {
  let el = document.getElementById("dateDisplay");
  if (el) el.innerText = new Date().toLocaleString();
}

function loadVersion() {
  setTimeout(() => {
    const el = document.getElementById("appVersion");

    if (!el) {
      console.log("❌ Version element not found");
      return;
    }

    el.textContent = "v" + appVersion;
  }, 200);
}

checkForUpdate();