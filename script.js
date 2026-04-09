/* =========================
   📦 STORAGE
========================= */
let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
let categories = JSON.parse(localStorage.getItem("categories")) || [];
let budget = Number(localStorage.getItem("budget")) || 0;
let dailyBudget = Number(localStorage.getItem("dailyBudget")) || 0;

let chart;

/* =========================
   🚀 INIT
========================= */
window.onload = () => {
  initCategories();
  loadTheme();
  updateUI();
  showDate();
  renderCategoryList();
  document.getElementById("appVersion").innerText = APP_VERSION;
};

/* =========================
   🧭 NAVIGATION
========================= */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");

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

  if (!amount) return alert("Enter amount!");

  expenses.push({
    amount: Number(amount),
    category,
    purpose,
    date: new Date().toISOString()
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  document.getElementById("amount").value = "";
  document.getElementById("purpose").value = "";

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
function loadHistory(list = expenses) {
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

/* =========================
   📊 GRAPH
========================= */
function loadGraph(type = "day", mode = "app") {
  let ctx = document.getElementById("myChart");

  if (chart) chart.destroy();

  let labels = [], expenseData = [];

  // ---------------------------
  // 📊 DATA PREPARATION
  // ---------------------------
  if (type === "day") {
    for (let i = 0; i < 24; i++) {
      labels.push(i + ":00");
      expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
    }
  }

  if (type === "week") {
    let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      labels.push(days[i]);
      expenseData.push(sumBy(e => new Date(e.date).getDay() === i));
    }
  }

  if (type === "month") {
    for (let i = 1; i <= 30; i++) {
      labels.push(i);
      expenseData.push(sumBy(e => new Date(e.date).getDate() === i));
    }
  }

  let budgetData = labels.map(() => dailyBudget);

  let chartType = mode === "app" ? "bar" : "line";

  let datasets =
    mode === "app"
      ? [
        {
          label: "Expenses",
          data: expenseData,
          backgroundColor: "#4CAF50"
        },
        {
          label: "Budget",
          data: budgetData,
          backgroundColor: "#FF7043"
        }
      ]
      : [
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
          backgroundColor: "transparent",
          borderDash: [5, 5],
          tension: 0.3
        }
      ];

  chart = new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets
    },
    options: {
      responsive: true,
      animation: {
        duration: 400 // important for PDF timing
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

function sumBy(fn) {
  return expenses.reduce((sum, e) => fn(e) ? sum + e.amount : sum, 0);
}

function exportPDF() {
  // Destroy old chart first
  if (chart) chart.destroy();

  let ctx = document.getElementById("myChart");

  let labels = [], expenseData = [];

  // Prepare data (same logic)
  for (let i = 0; i < 24; i++) {
    labels.push(i + ":00");
    expenseData.push(sumBy(e => new Date(e.date).getHours() === i));
  }

  let budgetData = labels.map(() => dailyBudget);

  // 🔥 Create PDF chart with CALLBACK
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
          backgroundColor: "transparent",
          borderDash: [5, 5],
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,

      animation: {
        onComplete: function () {
          // ✅ ONLY after chart fully drawn
          downloadPDF();

          // Switch back to app graph
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

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // ---------------------------
  // 🟢 TITLE
  // ---------------------------
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  doc.text("Money Tracker Report", 14, 15);

  // Subtitle
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Generated on: " + new Date().toLocaleString(), 14, 22);

  doc.setDrawColor(200);
  doc.line(10, 25, 200, 25);

  let y = 32;

  // ---------------------------
  // 🟢 EXPENSE TABLE
  // ---------------------------
  const col = {
    date: 12,
    category: 45,
    amount: 120,
    purpose: 140
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

  let total = 0;
  let list = document.querySelectorAll(".expense-item");

  list.forEach((item, index) => {
    let text = item.innerText.replace("🗑", "").trim().split("\n");

    let [categoryPart, datePart] = text;
    let [category, amountRaw] = categoryPart.split(" - ₹");

    let amount = Number(amountRaw);
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

    doc.text(datePart.split(",")[0], col.date, y);
    doc.text(category, col.category, y);
    doc.text(`Rs. ${formatted}`, col.amount, y, { align: "right" });
    doc.text("-", col.purpose, y);

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
  // 🟣 MONTHLY SUMMARY
  // ---------------------------
  y += 12;

  if (y > 260) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(13);
  doc.text("Budget Summary (Monthly)", 14, y);

  y += 6;
  doc.line(10, y, 200, y);

  y += 8;

  const mcol = {
    month: 14,
    budget: 90,
    spent: 130,
    remaining: 170
  };

  doc.setFontSize(10);
  doc.setFont(undefined, "bold");

  doc.text("Month", mcol.month, y);
  doc.text("Budget", mcol.budget, y, { align: "right" });
  doc.text("Spent", mcol.spent, y, { align: "right" });
  doc.text("Remaining", mcol.remaining, y, { align: "right" });

  y += 6;
  doc.setFont(undefined, "normal");

  let monthMap = {};

  expenses.forEach(e => {
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
  // 📊 GRAPH (FINAL FIXED ✅)
  // ---------------------------
  y += 12;

  const canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 400;

  const ctx = canvas.getContext("2d");

  // 🔥 GROUP BY DATE
  let map = {};

  expenses.forEach(e => {
    let d = new Date(e.date).toLocaleDateString("en-IN");
    map[d] = (map[d] || 0) + e.amount;
  });

  let labels = Object.keys(map);
  let data = Object.values(map);
  let budgetData = labels.map(() => dailyBudget);

  // ---------------------------
  // 🧠 FIX: HANDLE SINGLE DATA POINT
  // ---------------------------
  if (labels.length === 1) {
    labels = [" ", labels[0], " "];
    data = [0, data[0], 0];
    budgetData = [0, budgetData[0], 0];
  }

  // ---------------------------
  // 📈 CHART
  // ---------------------------
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data,
          borderColor: "#4CAF50",
          backgroundColor: "rgba(76,175,80,0.1)", // subtle fill
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
      animation: false,

      plugins: {
        legend: {
          display: true
        }
      },

      scales: {
        y: {
          beginAtZero: true,
          suggestedMax: Math.max(...data) + 100
        }
      }
    }
  });

  // Convert to image
  let img = canvas.toDataURL("image/png");

  // Page handling
  if (y + 90 > 290) {
    doc.addPage();
    y = 20;
  }

  // Title
  doc.setFont(undefined, "bold");
  doc.text("Expense Chart", 14, y);

  y += 6;

  // Add chart image
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

const APP_VERSION = "1.1"; // change every update

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

checkForUpdate();
