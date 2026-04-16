let filteredSavingsData = [];

window.onload = function () {
  loadSavings();

  let theme = localStorage.getItem("theme") || "#4caf50";
  document.documentElement.style.setProperty("--theme", theme);

  showSavingsScreen("home");

  // ✅ MOVE HERE
  document.getElementById("sType").addEventListener("change", function () {
    let val = this.value;

    if (val === "income") {
      showToast("Adding to savings 💰");
    } else if (val === "withdraw_budget") {
      showToast("Moving to budget 📦");
    } else if (val === "transfer") {
      showToast("Transfer mode 🔁");
    }
  });
};


let toastQueue = [];
let isToastShowing = false;

function showToast(message, type = "info") {
  toastQueue.push({ message, type });

  if (!isToastShowing) {
    processToastQueue();
  }
}

function processToastQueue() {
  if (toastQueue.length === 0) {
    isToastShowing = false;
    return;
  }

  isToastShowing = true;

  let { message, type } = toastQueue.shift();

  let toast = document.createElement("div");
  toast.className = "premium-toast";
  toast.innerText = message;

  let theme = getComputedStyle(document.documentElement)
    .getPropertyValue("--theme").trim();

  let bg = "#333";

  if (type === "success") bg = theme;
  else if (type === "error") bg = "#e53935";
  else if (type === "warning") bg = "#fb8c00";

  toast.style.background = bg;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 50);

  setTimeout(() => {
    toast.classList.remove("show");

    setTimeout(() => {
      toast.remove();
      processToastQueue();
    }, 300);
  }, 2200);
}

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
  let note = document.getElementById("sNote").value;
  let date = document.getElementById("sDate").value;

  if (!amount || amount <= 0) {
    showToast("Enter valid amount ❗", "warning");
    return;
  }

  let finalDate = date ? new Date(date).toISOString() : new Date().toISOString();
  let data = getSavings();

  // =========================
  // 💰 INCOME
  // =========================
  if (type === "income") {
    data.push({
      id: Date.now(),
      type: "income",
      amount: Math.abs(amount),
      note: note || "Income",
      date: finalDate
    });

    saveSavings(data);
    loadSavings();

    showToast("Income added 💰", "success");

    // 🔄 RESET HERE ALSO
    document.getElementById("sAmount").value = "";
    document.getElementById("sNote").value = "";
    setTodayDate();

    return;
  }

  // =========================
  // 📦 VALIDATE SOURCE
  // =========================
  let sourceId = document.getElementById("sourceSelect").value;

  if (!sourceId) {
    showToast("Select source ❗", "warning");
    return;
  }

  let source = data.find(t => t.id == sourceId);

  if (!source) {
    showToast("Invalid source ❌", "error");
    return;
  }

  // =========================
  // ➖ OUTGOING ENTRY
  // =========================
  data.push({
    id: Date.now(),
    type,
    amount: -Math.abs(amount),
    sourceId: source.id,
    sourceName: source.note,
    note,
    date: finalDate
  });

  // =========================
  // 📦 MOVE TO BUDGET
  // =========================
  if (type === "withdraw_budget") {
    let monthKey = finalDate.slice(0, 7);

    let budgetAllocations =
      JSON.parse(localStorage.getItem("budgetAllocations")) || {};

    if (!budgetAllocations[monthKey]) {
      budgetAllocations[monthKey] = [];
    }

    budgetAllocations[monthKey].push({
      amount: Math.abs(amount),
      date: finalDate
    });

    localStorage.setItem("budgetAllocations", JSON.stringify(budgetAllocations));
  }

  saveSavings(data);
  loadSavings();

  showToast("Saved successfully ✅", "success");

  // =========================
  // 🔄 RESET FORM AFTER SAVE
  // =========================
  document.getElementById("sAmount").value = "";
  document.getElementById("sNote").value = "";
  document.getElementById("sourceSelect").value = "";

  // Optional resets
  document.getElementById("sType").value = "income";
  document.getElementById("sPayment").value = "Cash";

  // Hide source again
  document.getElementById("sourceSelect").style.display = "none";

  // Reset date
  setTodayDate();
}

// =========================
// 🔗 SOURCE HELPERS
// =========================
function getAvailableSources() {
  let data = getSavings();

  return data.filter(t => t.type === "income");
}

function loadSourceOptions() {
  let select = document.getElementById("sourceSelect");
  let data = getSavings();

  let sources = data.filter(t => t.type === "income");

  select.innerHTML = "<option value=''>Select Source</option>";

  sources.forEach(s => {
    let option = document.createElement("option");
    option.value = s.id;

    let date = new Date(s.date);
    let monthYear = date.toLocaleString("en-IN", {
      month: "short",
      year: "numeric"
    });

    let name = s.note || `${monthYear} Salary`;

    option.textContent = `${name} (₹${s.amount})`;

    select.appendChild(option);
  });
}

/* =========================
   📊 LOAD UI
========================= */
function loadSavings() {
  let data = getSavings();

  // 💰 TOTAL BALANCE
  let total = data.reduce((sum, t) => sum + t.amount, 0);

  // 📦 ALLOCATED (only budget movements)
  let allocated = data
    .filter(t => t.type === "withdraw_budget")
    .reduce((sum, t) => sum + Math.abs(t.amount), 0);

  // 💵 AVAILABLE (real remaining savings)
  let available = total;

  document.getElementById("savingsBalance").innerText = "₹" + total;

  let allocatedEl = document.getElementById("allocatedToBudget");
  if (allocatedEl) allocatedEl.innerText = "₹" + allocated;

  let availableEl = document.getElementById("availableBalance");
  if (availableEl) availableEl.innerText = "₹" + available;

  renderSavingsHistory(data);
}
/* =========================
   🧭 NAVIGATION
========================= */
// function showSavingsScreen(id) {
//   // hide all screens
//   document.querySelectorAll(".screen").forEach(s =>
//     s.classList.remove("active")
//   );

//   // show selected
//   document.getElementById(id).classList.add("active");

//   // 🔥 FIX ACTIVE TAB
//   document.querySelectorAll(".nav button").forEach(btn => {
//     btn.classList.remove("active");

//     if (btn.dataset.screen === id) {
//       btn.classList.add("active");
//     }
//   });
// }

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
    showToast("Select both dates", "warning");
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

    let labelMap = {
      income: "💰 Income",
      withdraw_budget: "📦 Budget",
      transfer: "🔁 Transfer"
    };

    let label = labelMap[t.type] || t.type;
    let color = t.amount < 0 ? "red" : "green";

    div.innerHTML = `
      <div>
        <strong>${t.note || t.sourceName || "Self"}</strong><br>
        <small>${label} • ${new Date(t.date).toLocaleString()}</small>
      </div>
      <div style="color:${color}; font-weight:600;">
        ₹${t.amount}
      </div>
    `;

    // ✅ CLICK ONLY FOR INCOME
    if (t.type === "income") {
      div.style.cursor = "pointer";

      div.onclick = () => {
        showSavingsScreen("details");
        renderSourceDetails(t.id);
      };
    }

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

// function showSavingsScreen(id) {
//   // hide all screens
//   document.querySelectorAll(".screen").forEach(s =>
//     s.classList.remove("active")
//   );

//   // show selected
//   document.getElementById(id).classList.add("active");

//   // active tab
//   document.querySelectorAll(".nav button").forEach(btn => {
//     btn.classList.remove("active");

//     if (btn.dataset.screen === id) {
//       btn.classList.add("active");
//     }
//   });

//   // 🔥 THIS WAS MISSING
//   if (id === "graph") {
//     loadSavingsGraph(
//       filteredSavingsData.length ? filteredSavingsData : getSavings()
//     );
//   }
//   showToast("Opened " + id + " screen", "info");
// }

function showSavingsScreen(id) {
  // store previous screen
  let current = document.querySelector(".screen.active");
  if (current) {
    previousScreen = current.id;
  }

  // switch screen
  document.querySelectorAll(".screen").forEach(s =>
    s.classList.remove("active")
  );

  document.getElementById(id).classList.add("active");

  // update nav
  document.querySelectorAll(".nav button").forEach(btn => {
    btn.classList.remove("active");

    if (btn.dataset.screen === id) {
      btn.classList.add("active");
    }
  });

  // load special screens
  if (id === "income") {
    renderIncomeList();
  }

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

function exportSavingsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  let data = getSavings();

  if (!data.length) {
    showToast("No data to export", "warning");
    return;
  }

  let y = 12;

  // HEADER
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Savings Report", 14, 15);

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20);

  y = 28;

  // TABLE
  data.forEach((t, index) => {
    let date = new Date(t.date).toLocaleDateString("en-IN");
    let amount = t.amount;
    let type = t.type;

    if (y > 280) {
      doc.addPage();
      y = 20;
    }

    doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);

    doc.text(`${date} | ${type} | ₹${Math.abs(amount)}`, 14, y);

    doc.setTextColor(0);

    y += 8;
  });

  doc.save("savings-report.pdf");

  showToast("Savings report downloaded 📄", "success");
}
function hexToRgb(hex) {
  hex = hex.replace("#", "");

  let bigint = parseInt(hex, 16);

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255
  };
}

function getSourceSummary(sourceId) {
  let data = getSavings();

  let income = data.find(t => t.id == sourceId);

  if (!income) return null;

  let outgoing = data.filter(t => t.sourceId == sourceId);

  let totalOutgoing = outgoing.reduce(
    (sum, t) => sum + Math.abs(t.amount),
    0
  );

  return {
    name: income.note,
    totalIncome: income.amount,
    totalOutgoing,
    remaining: income.amount - totalOutgoing,
    entries: outgoing
  };
}

function renderSourceDetails(sourceId) {
  let summary = getSourceSummary(sourceId);

  if (!summary) return;

  let container = document.getElementById("sourceDetails");
  if (!container) return;

  // 🧠 Base UI
  container.innerHTML = `
    <h3>${summary.name}</h3>
    <p>💰 Income: ₹${summary.totalIncome}</p>
    <p>📉 Used: ₹${summary.totalOutgoing}</p>
    <p>🟢 Remaining: ₹${summary.remaining}</p>

    <hr style="margin:10px 0; border:none; border-top:1px solid #eee;" />

    <h4 style="margin:6px 0;">📋 Entries</h4>
  `;

  // ❌ No entries
  if (summary.entries.length === 0) {
    let empty = document.createElement("p");
    empty.style.color = "#888";
    empty.innerText = "No entries yet 📭";
    container.appendChild(empty);
    return;
  }

  // 🔥 Entries
  summary.entries.forEach(t => {
    let div = document.createElement("div");
    div.className = "expense-item";

    let label =
      t.type === "withdraw_budget"
        ? "📦 Move to Budget"
        : "🔁 Transfer";

    div.innerHTML = `
      <div>
        <strong>${label}</strong><br>
        <small>${new Date(t.date).toLocaleString()}</small>
      </div>
      <div style="color:red; font-weight:600;">
        ₹${Math.abs(t.amount)}
      </div>
    `;

    container.appendChild(div);
  });
}
document.addEventListener("DOMContentLoaded", function () {
  loadSavings();
  setTodayDate();

  let theme = localStorage.getItem("theme") || "#4caf50";
  document.documentElement.style.setProperty("--theme", theme);

  showSavingsScreen("home");

  const sType = document.getElementById("sType");
  const sourceSelect = document.getElementById("sourceSelect");

  if (sType && sourceSelect) {
    sType.addEventListener("change", function () {
      const val = this.value;

      if (val === "income") {
        sourceSelect.style.display = "none";
        showToast("Adding to savings 💰");
      } else {
        sourceSelect.style.display = "block";
        loadSourceOptions();

        if (val === "withdraw_budget") {
          showToast("Moving to budget 📦");
        } else {
          showToast("Transfer mode 🔁");
        }
      }
    });
  }
});

function renderIncomeList() {
  let data = getSavings();

  let incomes = data.filter(t => t.type === "income");

  let container = document.getElementById("incomeList");
  if (!container) return;

  container.innerHTML = "";

  incomes.slice().reverse().forEach(i => {
    let div = document.createElement("div");
    div.className = "expense-item";

    let date = new Date(i.date);
    let monthYear = date.toLocaleString("en-IN", {
      month: "short",
      year: "numeric"
    });

    div.innerHTML = `
      <div>
        <strong>${i.note || monthYear + " Salary"}</strong><br>
        <small>${monthYear}</small>
      </div>
      <div style="color:green; font-weight:600;">
        ₹${i.amount} →
      </div>
    `;

    // 🔥 CLICK TO DETAILS
    div.style.cursor = "pointer";
    div.onclick = () => {
      showSavingsScreen("details");
      renderSourceDetails(i.id);
    };

    container.appendChild(div);
  });
}

function setTodayDate() {
  let today = new Date();

  let formatted = today.toISOString().split("T")[0];

  let dateInput = document.getElementById("sDate");
  if (dateInput) {
    dateInput.value = formatted;
  }
}