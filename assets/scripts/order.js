// =========================
// 📦 GET DATA
// =========================
function getQuotationData() {
  return JSON.parse(localStorage.getItem("quotationData")) || null;
}


// =========================
// 📋 RENDER ORDER
// =========================
function renderOrder() {
  let data = getQuotationData();
  // guard: only run on order page
  if (!document.getElementById || !document.getElementById("orderItems")) return;

  let container = document.getElementById("orderItems");

  if (!data || !data.items || !data.items.length) {
    container.innerHTML = `<p class="empty">No order data found</p>`;
    updateTotals(0, 0, 0);
    return;
  }

  container.innerHTML = "";

  data.items.forEach(i => {
    let div = document.createElement("div");
    div.className = "table-row";

    div.innerHTML = `
      <span>${i.name}</span>
      <span>${formatCurrency(i.price)}</span>
      <span>${i.qty}</span>
      <span>${i.source}</span>
      <span>${i.link ? `<a href="${i.link}" target="_blank">🔗</a>` : "-"}</span>
      <span>${formatCurrency(i.total)}</span>
    `;

    container.appendChild(div);
  });

  // totals (convert safely)
  let subtotal = Number(data.subtotal) || 0;
  let gst = Number(data.gstAmount) || 0;
  let total = Number(data.total) || 0;

  updateTotals(subtotal, gst, total);
}


// =========================
// 🧮 UPDATE TOTALS UI
// =========================
function updateTotals(subtotal, gst, total) {
  if (document.getElementById("oSubtotal")) document.getElementById("oSubtotal").innerText = formatCurrency(subtotal);
  if (document.getElementById("oGSTAmount")) document.getElementById("oGSTAmount").innerText = formatCurrency(gst);
  if (document.getElementById("oFinalTotal")) document.getElementById("oFinalTotal").innerText = formatCurrency(total);
}


// =========================
// ✅ COMPLETE PURCHASE
// =========================
async function completePurchase() {
  // guard: ensure order UI present
  if (!document.getElementById || !document.getElementById("oSource")) return;

  let data = getQuotationData();

  if (!data || !data.items || !data.items.length) {
    alert("No order data ❗");
    return;
  }

  let sourceSelect = document.getElementById("oSource");
  let selectedOption = sourceSelect.options[sourceSelect.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    alert("Select source ❗");
    return;
  }

  let selectedSourceId = String(selectedOption.value);
  let sourceType = selectedOption.dataset.type;
  let paymentType = document.getElementById("oPaymentType").value;

  if (!paymentType) {
    alert("Select payment type ❗");
    return;
  }

  let summary = getLedgerSummary(selectedSourceId, sourceType);

  if (!summary) {
    alert("Invalid source ❌");
    return;
  }

  let total = Number(data.total) || 0;

  // =========================
  // 💰 BALANCE CHECK
  // =========================
  if (summary.remaining < total) {
    alert(
      `❌ Not enough balance!\n` +
      `Available: ${formatCurrency(summary.remaining)}\n` +
      `Needed: ${formatCurrency(total)}`
    );
    return;
  }

  // =========================
  // 📅 DAILY LIMIT CHECK
  // =========================
  let dailyLimit = getDailyLimit ? getDailyLimit() : 0;

  let today = new Date().toDateString();

  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");

  let todaySpent = expenses
    .filter(e =>
      new Date(e.date).toDateString() === today &&
      e.type === "expense"
    )
    .reduce((sum, e) => sum + Math.abs(e.amount), 0);

  if (dailyLimit > 0 && (todaySpent + total > dailyLimit)) {

    let proceed = confirm(
      `⚠️ Daily limit exceeded!\n\n` +
      `Limit: ${formatCurrency(dailyLimit)}\n` +
      `Spent today: ${formatCurrency(todaySpent)}\n` +
      `This purchase: ${formatCurrency(total)}\n\n` +
      `Continue?`
    );

    if (!proceed) return;
  }

  // =========================
  // ⏳ DELAY (ANTI-IMPULSE)
  // =========================
  await new Promise(r => setTimeout(r, 1000));

  let purpose = data.items.map(i => i.name).join(", ");

  // =========================
  // 💸 SAVE EXPENSE
  // =========================
  expenses.push({
    id: "order_" + Date.now(),
    amount: -Math.abs(total),
    type: "expense",
    purpose: "Purchase of " + purpose,

    sourceId: selectedSourceId,
    sourceName: summary.name,
    sourceType: sourceType,

    paymentType: paymentType,
    date: new Date().toISOString()
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  // =========================
  // 📦 SAVE ORDER
  // =========================
  let orders = JSON.parse(localStorage.getItem("orders") || "[]");

  orders.push({
    id: "order_" + Date.now(),
    items: data.items,
    subtotal: data.subtotal,
    gst: data.gstAmount,
    total: data.total,

    sourceId: selectedSourceId,
    sourceName: summary.name,
    sourceType: sourceType,

    paymentType: paymentType,
    date: new Date().toISOString()
  });

  localStorage.setItem("orders", JSON.stringify(orders));

  // =========================
  // 🟢 IF SAVINGS → TRACK
  // =========================
  if (sourceType === "savings") {

    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    savings.push({
      id: "order_" + Date.now(),
      type: "expense",
      amount: -Math.abs(total),
      note: summary.name,
      sourceId: selectedSourceId,
      paymentType: paymentType,
      date: new Date().toISOString()
    });

    localStorage.setItem("savingsTransactions", JSON.stringify(savings));
  }

  // =========================
  // 🧹 CLEANUP
  // =========================
  localStorage.removeItem("quotationData");
  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");

  showToast("Purchase completed ✅", "success");

  setTimeout(() => {
    window.location.href = "../index.html";
  }, 1000);
}


// =========================
// ❌ CANCEL ORDER
// =========================
function cancelOrder() {
  if (!confirm("Cancel this order?")) return;

  window.location.href = "pages/quotation.html";
}


// =========================
// 🚀 INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById && document.getElementById("orderItems")) {
    renderOrder();
    loadSourceOptions();
  }
});

function loadSourceOptions() {
  if (!document.getElementById || !document.getElementById("oSourceType")) return;

  let type = document.getElementById("oSourceType").value;
  let select = document.getElementById("oSource");

  select.innerHTML = `<option value="">Select Source</option>`;

  // 🟢 SAVINGS
  if (type === "savings") {

    let data = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let sources = data.filter(t => t.type === "income");

    sources.forEach(s => {
      let option = document.createElement("option");
      option.value = String(s.id);
      option.textContent = s.note || "Savings";
      option.dataset.type = "savings";
      select.appendChild(option);
    });
  }

  // 🔵 BUDGET
  if (type === "budget") {

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

    budgets.forEach(b => {
      let option = document.createElement("option");
      option.value = String(b.id);
      option.textContent = `${b.name || "Budget"} (${b.monthKey})`;
      option.dataset.type = "budget";
      select.appendChild(option);
    });
  }

  select.onchange = renderSourcePreview;
  document.getElementById("sourcePreview").innerHTML = "";
}
function renderSourcePreview() {
  if (!document.getElementById || !document.getElementById("oSource")) return;

  let select = document.getElementById("oSource");
  let preview = document.getElementById("sourcePreview");

  let selectedOption = select.options[select.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    preview.innerHTML = "";
    return;
  }

  let sourceId = String(selectedOption.value);
  let type = selectedOption.dataset.type;

  // =========================
  // 🟢 SAVINGS
  // =========================
  if (type === "savings") {

    let summary = getLedgerSummary(sourceId, "savings");

    if (!summary) {
      preview.innerHTML = "No data";
      return;
    }

    preview.innerHTML = `
  <strong>${summary.name}</strong><br>
  💰 Total: ${formatCurrency(summary.total)}<br>
  📉 Used: ${formatCurrency(summary.used)}<br>
  🟢 Remaining: ${formatCurrency(summary.remaining)}
`;
  }

  // =========================
  // 🔵 BUDGET
  // =========================
  if (type === "budget") {

    let summary = getLedgerSummary(sourceId, "budget");

    if (!summary) {
      preview.innerHTML = "No data";
      return;
    }

    preview.innerHTML = `
      <strong>${summary.name}</strong><br>
      💰 Budget: ₹${summary.total.toLocaleString("en-IN")}<br>
      📉 Used: ₹${summary.used.toLocaleString("en-IN")}<br>
      🟢 Remaining: ₹${summary.remaining.toLocaleString("en-IN")}
    `;
  }
}
// =========================
// 🧠 MASTER LEDGER
// =========================
// function getLedgerSummary(sourceId, type) {

//   let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];
//   let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
//   let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

//   // 🟢 SAVINGS
//   if (type === "savings") {

//     let root = savings.find(t => t.id == sourceId && t.type === "income");
//     if (!root) return null;

//     let linked = savings.filter(t => t.sourceId == sourceId);

//     let income = root.amount;

//     let used = linked.reduce((sum, t) => {
//       return t.amount < 0 ? sum + Math.abs(t.amount) : sum;
//     }, 0);

//     return {
//       name: root.note || "Savings",
//       total: income,
//       used,
//       remaining: income - used,
//       entries: linked
//     };
//   }

//   // 🔵 BUDGET
//   if (type === "budget") {

//     let budget = budgets.find(b => b.id == sourceId);
//     if (!budget) return null;

//     let used = expenses
//       .filter(e => e.sourceId == sourceId && e.sourceType === "budget")
//       .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     return {
//       name: budget.name || "Budget",
//       total: budget.totalAllocated || 0,
//       used,
//       remaining: (budget.totalAllocated || 0) - used,
//       entries: []
//     };
//   }

//   return null;
// }
function getLedgerSummary(sourceId, type) {

  let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
  let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

  //sourceId = Number(sourceId);

  // =========================
  // 🟢 SAVINGS
  // =========================
  if (type === "savings") {

    let root = savings.find(t =>
      String(t.id) === String(sourceId) && t.type === "income"
    );
    if (!root) return null;

    let linked = savings.filter(t =>
      String(t.sourceId) === String(sourceId)
    );

    let income = Number(root.amount) || 0;

    let used = linked.reduce((sum, t) => {
      if (t.type === "expense") return sum + Math.abs(t.amount);
      if (t.type === "refund") return sum - Math.abs(t.amount);
      return sum;
    }, 0);

    return {
      name: root.note || root.entity || "Savings",
      total: income,
      used,
      remaining: income - used,
      entries: linked
    };
  }

  // =========================
  // 🔵 BUDGET
  // =========================
  if (type === "budget") {

    let budget = budgets.find(b => String(b.id) === String(sourceId));
    if (!budget) return null;

    let totalAllocated = Number(budget.totalAllocated) || 0;

    let used = expenses
      .filter(e =>
        String(e.sourceId) === String(sourceId) &&
        e.sourceType === "budget"
      )
      .reduce((sum, e) => {
        if (e.type === "expense") return sum + Math.abs(e.amount);
        if (e.type === "refund") return sum - Math.abs(e.amount);
        return sum;
      }, 0);

    return {
      name: budget.name || budget.note || "Budget",
      total: totalAllocated,
      used,
      remaining: totalAllocated - used,
      entries: []
    };
  }

  return null;
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