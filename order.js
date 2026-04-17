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

  let selectedSourceId = document.getElementById("oSource").value;
  let paymentType = document.getElementById("oPaymentType").value;

  if (!selectedSourceId || !paymentType) {
    alert("Select payment details ❗");
    return;
  }

  // 🔍 Get source from savings
  let sourceData = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  let selectedSource = sourceData.find(s => s.id == selectedSourceId);

  if (!selectedSource) {
    alert("Invalid source ❌");
    return;
  }

  let total = Number(data.total) || 0;

  // 🧠 Purpose
  let purpose = data.items.map(i => i.name).join(", ");

  // 📦 Expenses
  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");

  let expense = {
    id: Date.now(),
    amount: -Math.abs(total),
    category: "Purchase",
    purpose: "Purchase of " + purpose,

    sourceId: selectedSource.id,     // ✅ correct
    sourceName: selectedSource.note, // display

    paymentType: paymentType,
    date: new Date().toISOString()
  };

  expenses.push(expense);

  localStorage.setItem("expenses", JSON.stringify(expenses));

  // 🧹 Clean quotation
  localStorage.removeItem("quotationData");
  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");

  alert("Purchase completed ✅");

  // 🚀 redirect (LAST)
  window.location.href = "index.html";
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
  loadSourceDropdown();
});

function loadSourceDropdown() {
  let data = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

  let sources = data.filter(t => t.type === "income" && t.note);

  let select = document.getElementById("oSource");

  select.innerHTML = `<option value="">Select Source</option>`;

  sources.forEach(s => {
    let option = document.createElement("option");

    option.value = s.id;
    option.textContent = s.note;

    select.appendChild(option);
  });
}