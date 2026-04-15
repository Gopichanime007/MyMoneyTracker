let filteredSavingsData = [];

window.onload = function () {
  loadSavings();

  let theme = localStorage.getItem("theme") || "#4caf50";
  document.documentElement.style.setProperty("--theme", theme);

  // 🔥 ADD THIS
  showSavingsScreen("home");
};

/* =========================
   💰 STORAGE
========================= */
function getSavings() {
  return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}

function saveSavings(data) {
  localStorage.setItem("savingsTransactions", JSON.stringify(data));
}

/* =========================
   ➕ ADD
========================= */
function addSavings() {
  let type = document.getElementById("sType").value;
  let amount = Number(document.getElementById("sAmount").value);
  let person = document.getElementById("sPerson").value;
  let note = document.getElementById("sNote").value;
  let date = document.getElementById("sDate").value;
  let payment = document.getElementById("sPayment").value;

  if (!amount) return alert("Enter amount");

  // 🔥 DATE FIX
  let finalDate = date ? new Date(date).toISOString() : new Date().toISOString();

  // 🔥 SIGN LOGIC
  amount = type === "expense"
    ? -Math.abs(amount)
    : Math.abs(amount);

  let data = getSavings();

  data.push({
    id: Date.now(),
    type,
    amount,
    person,
    note,
    payment,
    date: finalDate
  });

  saveSavings(data);

  // RESET
  document.getElementById("sAmount").value = "";
  document.getElementById("sPerson").value = "";
  document.getElementById("sNote").value = "";
  document.getElementById("sDate").value = "";

  loadSavings();
  showSavingsScreen("home");
}

/* =========================
   📊 LOAD UI
========================= */
function loadSavings() {
  let data = getSavings();

  // 💰 TOTAL
  let total = data.reduce((sum, t) => sum + t.amount, 0);

  // 📦 ALLOCATED
  let allocated = data
    .filter(t => t.type === "budget_allocation")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // 💵 AVAILABLE
  let available = total;

  // =========================
  // UI UPDATE
  // =========================
  document.getElementById("savingsBalance").innerText = "₹" + total;

  let allocatedEl = document.getElementById("allocatedToBudget");
  if (allocatedEl) allocatedEl.innerText = "₹" + allocated;

  let availableEl = document.getElementById("availableBalance");
  if (availableEl) availableEl.innerText = "₹" + available;

  // =========================
  // HISTORY (ONLY ONE CALL)
  // =========================
  renderSavingsHistory(data);
}

/* =========================
   🧭 NAVIGATION
========================= */
function showSavingsScreen(id) {
  // hide all screens
  document.querySelectorAll(".screen").forEach(s =>
    s.classList.remove("active")
  );

  // show selected
  document.getElementById(id).classList.add("active");

  // 🔥 FIX ACTIVE TAB
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.classList.remove("active");

    if (btn.dataset.screen === id) {
      btn.classList.add("active");
    }
  });
}

function handleSavingsFilter(type) {
  if (type === "period") {
    document.getElementById("savingsDateModal").style.display = "flex";
    return;
  }

  let data = getSavings();
  let now = new Date();

  if (type === "all") {
    filteredSavingsData = data;
  }
  else if (type === "today") {
    filteredSavingsData = data.filter(t =>
      new Date(t.date).toDateString() === now.toDateString()
    );
  }
  else if (type === "week") {
    let weekStart = new Date();
    weekStart.setDate(now.getDate() - 7);

    filteredSavingsData = data.filter(t =>
      new Date(t.date) >= weekStart
    );
  }
  else if (type === "month") {
    filteredSavingsData = data.filter(t => {
      let d = new Date(t.date);
      return d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
    });
  }

  // 🔥 UPDATE BOTH
  renderSavingsHistory(filteredSavingsData);
  loadSavingsGraph(filteredSavingsData);
}

function applySavingsDateFilter() {
  let from = document.getElementById("sFromDate").value;
  let to = document.getElementById("sToDate").value;

  if (!from || !to) {
    alert("Select both dates");
    return;
  }

  let fromDate = new Date(from);
  let toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  let data = getSavings();

  let filtered = data.filter(t => {
    let d = new Date(t.date);
    return d >= fromDate && d <= toDate;
  });

  filteredSavingsData = filtered;

  renderSavingsHistory(filteredSavingsData);
  loadSavingsGraph(filteredSavingsData);

  closeSavingsModal();
}

function closeSavingsModal() {
  document.getElementById("savingsDateModal").style.display = "none";
}

function renderSavingsHistory(data) {
  let container = document.getElementById("savingsHistory");
  if (!container) return;

  container.innerHTML = "";

  data.slice().reverse().forEach(t => {
    let div = document.createElement("div");
    div.className = "expense-item";

    let label = "";
    let color = t.amount < 0 ? "red" : "green";

    if (t.type === "income") label = "💰 Income";
    else if (t.type === "expense") label = "💸 Withdraw";
    else if (t.type === "budget_allocation") label = "📦 Budget";
    else if (t.type === "transfer") label = "🔁 Transfer";
    else label = t.type;

    div.innerHTML = `
      <div>
        <strong>${t.person || "Self"}</strong><br>
        <small>${label} • ${new Date(t.date).toLocaleString()}</small>
      </div>
      <div style="color:${color}; font-weight:600;">
        ₹${t.amount}
      </div>
    `;

    container.appendChild(div);
  });
}

function loadSavingsGraph(customData) {
  let data = customData || getSavings();

  let income = 0;
  let expense = 0;

  data.forEach(t => {
    if (t.amount > 0) income += t.amount;
    else expense += Math.abs(t.amount);
  });

  let ctx = document.getElementById("savingsChart");
  if (!ctx) return;

  if (window.sChart) window.sChart.destroy();

  const theme = getComputedStyle(document.documentElement)
    .getPropertyValue("--theme").trim();

  window.sChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Income", "Expense"],
      datasets: [{
        data: [income, expense],
        backgroundColor: [
          theme,          // 👈 Income uses theme
          "#ff5252"       // Expense stays red
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "60%"
    }
  });
}
function goToTransfers() {
  window.location.href = "transfer.html";
}

function showSavingsScreen(id) {
  // hide all screens
  document.querySelectorAll(".screen").forEach(s =>
    s.classList.remove("active")
  );

  // show selected
  document.getElementById(id).classList.add("active");

  // active tab
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.classList.remove("active");

    if (btn.dataset.screen === id) {
      btn.classList.add("active");
    }
  });

  // 🔥 THIS WAS MISSING
  if (id === "graph") {
    loadSavingsGraph(
      filteredSavingsData.length ? filteredSavingsData : getSavings()
    );
  }
}

function goToDashboard() {
  window.location.href = "index.html";
}

window.addEventListener("click", function (e) {
  let modal = document.getElementById("savingsDateModal");
  if (e.target === modal) {
    modal.style.display = "none";
  }
});