// =========================
// 📦 STORAGE
// =========================
let quotationItems = JSON.parse(localStorage.getItem("quotationItems")) || [];
let quotationCharges = JSON.parse(localStorage.getItem("quotationCharges")) || [];


// =========================
// 🔗 OPEN PRODUCT LINK
// =========================
function openProductLink() {
  let link = document.getElementById("mLink").value;
  if (link) window.open(link, "_blank");
}


// =========================
// 📦 MODAL CONTROL
// =========================
function openItemModal() {
  document.getElementById("itemModal").style.display = "flex";
}

function closeItemModal() {
  document.getElementById("itemModal").style.display = "none";
}

function openChargeModal() {
  document.getElementById("chargeModal").style.display = "flex";
}

function closeChargeModal() {
  document.getElementById("chargeModal").style.display = "none";
}


// =========================
// ➕ ADD ITEM FROM MODAL
// =========================
function addItemFromModal() {
  let name = document.getElementById("mName").value;
  let price = Number(document.getElementById("mPrice").value);
  let qty = Number(document.getElementById("mQty").value);
  let source = document.getElementById("mSource").value;
  let link = document.getElementById("mLink").value;

  if (!name || !price || !qty) {
    alert("Fill all required fields ❗");
    return;
  }

  let item = {
    id: Date.now(),
    name,
    price,
    qty,
    source,
    link,
    total: price * qty
  };

  quotationItems.push(item);
  localStorage.setItem("quotationItems", JSON.stringify(quotationItems));

  clearItemModal();
  closeItemModal();
  renderQuotation();
}


// =========================
// 🧹 CLEAR MODAL INPUTS
// =========================
function clearItemModal() {
  document.getElementById("mName").value = "";
  document.getElementById("mPrice").value = "";
  document.getElementById("mQty").value = "";
  document.getElementById("mSource").value = "";
  document.getElementById("mLink").value = "";
}


// =========================
// 📋 RENDER ITEMS
// =========================
function renderQuotation() {
  let container = document.getElementById("quotationItems");

  if (!quotationItems.length) {
    container.innerHTML = `<p class="empty">No items added</p>`;
    updateTotals();
    return;
  }

  container.innerHTML = "";

  quotationItems.forEach(i => {
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

  renderCharges();
  updateTotals();
}


// =========================
// ➕ ADD CHARGE
// =========================
function addCharge() {
  let type = document.getElementById("cType").value;
  let value = Number(document.getElementById("cValue").value);
  let mode = document.getElementById("cMode").value;

  if (!value) {
    alert("Enter valid charge ❗");
    return;
  }

  let charge = {
    id: Date.now(),
    type,
    value,
    mode
  };

  quotationCharges.push(charge);
  localStorage.setItem("quotationCharges", JSON.stringify(quotationCharges));

  closeChargeModal();
  renderQuotation();
}


// =========================
// 📋 RENDER CHARGES
// =========================
function renderCharges() {
  let container = document.getElementById("chargesList");
  if (!container) return;

  container.innerHTML = "";

  quotationCharges.forEach(c => {
    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <div>${c.type.toUpperCase()}</div>
      <div>${c.mode === "percent" ? c.value + "%" : "₹" + c.value}</div>
    `;

    container.appendChild(div);
  });
}


// =========================
// 🧮 CALCULATE TOTALS
// =========================
function updateTotals() {
  let subtotal = quotationItems.reduce((sum, i) => sum + i.total, 0);

  let gstAmount = 0;
  let delivery = 0;
  let discount = 0;

  quotationCharges.forEach(c => {
    if (c.type === "gst") {
      gstAmount += (subtotal * c.value) / 100;
    }
    if (c.type === "delivery") {
      delivery += c.value;
    }
    if (c.type === "discount") {
      discount += c.value;
    }
  });

  let finalTotal = subtotal + gstAmount + delivery - discount;

  document.getElementById("qSubtotal").innerText = subtotal;
  document.getElementById("qGSTAmount").innerText = gstAmount;
  document.getElementById("qFinalTotal").innerText = finalTotal;
}


// =========================
// 🔄 CONVERT TO ORDER
// =========================
function convertToOrder() {
  if (!quotationItems.length) {
    alert("Add items first ❗");
    return;
  }

  let data = {
    items: quotationItems,
    charges: quotationCharges,
    subtotal: document.getElementById("qSubtotal").innerText,
    gstAmount: document.getElementById("qGSTAmount").innerText,
    total: document.getElementById("qFinalTotal").innerText
  };

  localStorage.setItem("quotationData", JSON.stringify(data));

  window.location.href = "order.html";
}


// =========================
// 🗑 CLEAR ALL
// =========================
function clearQuotation() {
  if (!confirm("Clear all items?")) return;

  quotationItems = [];
  quotationCharges = [];

  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");

  renderQuotation();
}


// =========================
// 🚀 INIT
// =========================
renderQuotation();