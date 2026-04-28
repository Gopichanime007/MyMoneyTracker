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
      <span>₹${i.price}</span>
      <span>${i.qty}</span>
      <span>${i.source}</span>
      <span>${i.link ? `<a href="${i.link}" target="_blank">🔗</a>` : "-"}</span>
      <span>₹${i.total}</span>
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
  document.getElementById("oSubtotal").innerText = subtotal;
  document.getElementById("oGSTAmount").innerText = gst;
  document.getElementById("oFinalTotal").innerText = total;
}


// =========================
// ✅ COMPLETE PURCHASE
// =========================
function completePurchase() {

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

  let selectedSourceId = Number(selectedOption.value);
  let sourceType = selectedOption.dataset.type;
  let paymentType = document.getElementById("oPaymentType").value;

  if (!paymentType) {
    alert("Select payment type ❗");
    return;
  }

  // =========================
  // 🧠 GET LEDGER SUMMARY
  // =========================
  let summary = getLedgerSummary(selectedSourceId, sourceType);

  if (!summary) {
    alert("Invalid source ❌");
    return;
  }

  let total = Number(data.total) || 0;

  // 🚨 VALIDATION
  if (summary.remaining < total) {
    alert(`❌ Not enough balance!\nAvailable: ₹${summary.remaining}\nNeeded: ₹${total}`);
    return;
  }

  let purpose = data.items.map(i => i.name).join(", ");

  // =========================
  // 💸 SAVE EXPENSE
  // =========================
  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");

  expenses.push({
    id: Date.now(),
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
    id: Date.now(),
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
  // 🟢 IF SAVINGS → PUSH ENTRY
  // =========================
  if (sourceType === "savings") {

    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    savings.push({
      id: Date.now(),
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
  // 🧹 CLEAN
  // =========================
  localStorage.removeItem("quotationData");
  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");

  showToast("Purchase completed ✅", "success");

  setTimeout(() => {
    window.location.href = "index.html";
  }, 1000);
}


// =========================
// ❌ CANCEL ORDER
// =========================
function cancelOrder() {
  if (!confirm("Cancel this order?")) return;

  window.location.href = "quotation.html";
}


// =========================
// 🚀 INIT
// =========================
document.addEventListener("DOMContentLoaded", () => {
  renderOrder();
  loadSourceOptions();
});

function loadSourceOptions() {

  let type = document.getElementById("oSourceType").value;
  let select = document.getElementById("oSource");

  select.innerHTML = `<option value="">Select Source</option>`;

  // 🟢 SAVINGS
  if (type === "savings") {

    let data = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let sources = data.filter(t => t.type === "income");

    sources.forEach(s => {
      let option = document.createElement("option");
      option.value = s.id;
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
      option.value = b.id;
      option.textContent = `${b.name || "Budget"} (${b.monthKey})`;
      option.dataset.type = "budget";
      select.appendChild(option);
    });
  }

  select.onchange = renderSourcePreview;
  document.getElementById("sourcePreview").innerHTML = "";
}
function renderSourcePreview() {

  let select = document.getElementById("oSource");
  let preview = document.getElementById("sourcePreview");

  let selectedOption = select.options[select.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    preview.innerHTML = "";
    return;
  }

  let sourceId = Number(selectedOption.value);
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
      💰 Total: ₹${summary.total.toLocaleString("en-IN")}<br>
      📉 Used: ₹${summary.used.toLocaleString("en-IN")}<br>
      🟢 Remaining: ₹${summary.remaining.toLocaleString("en-IN")}
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

  // =========================
  // 🟢 SAVINGS
  // =========================
  if (type === "savings") {

    let root = savings.find(t => Number(t.id) === Number(sourceId) && t.type === "income");
    if (!root) return null;

    let linked = savings.filter(t => Number(t.sourceId) === Number(sourceId));

    let income = root.amount;

    let used = linked.reduce((sum, t) => {
      return t.amount < 0 ? sum + Math.abs(t.amount) : sum;
    }, 0);

    return {
      name: root.note || "Savings",
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

    let budget = budgets.find(b => Number(b.id) === Number(sourceId));
    if (!budget) return null;

    let used = expenses
      .filter(e => Number(e.sourceId) === Number(sourceId))
      .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    return {
      name: budget.note || "Budget",
      total: budget.totalAllocated || 0,
      used,
      remaining: (budget.totalAllocated || 0) - used,
      entries: []
    };
  }

  return null;
}