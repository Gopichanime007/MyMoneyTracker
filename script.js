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
function loadGraph(type = "day") {
  let ctx = document.getElementById("myChart");

  if (chart) chart.destroy();

  let labels = [], data = [];

  if (type === "day") {
    for (let i = 0; i < 24; i++) {
      labels.push(i + ":00");
      data.push(sumBy(e => new Date(e.date).getHours() === i));
    }
  }

  if (type === "week") {
    let days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      labels.push(days[i]);
      data.push(sumBy(e => new Date(e.date).getDay() === i));
    }
  }

  if (type === "month") {
    for (let i = 1; i <= 30; i++) {
      labels.push(i);
      data.push(sumBy(e => new Date(e.date).getDate() === i));
    }
  }

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Expenses",
          data,
          backgroundColor: "#90caf9"
        },
        {
          label: "Budget",
          data: labels.map(() => dailyBudget),
          type: "line",
          borderColor: "red"
        }
      ]
    }
  });
}

function sumBy(fn) {
  return expenses.reduce((sum, e) => fn(e) ? sum + e.amount : sum, 0);
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