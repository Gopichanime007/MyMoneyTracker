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
  loadSources(); // 🔥 important
}

function closeItemModal() {
  document.getElementById("itemModal").style.display = "none";
}

function openChargeModal() {
  document.getElementById("chargeModal").style.display = "flex";

  let select = document.getElementById("cApplyTo");
  select.innerHTML = `<option value="all">All Items</option>`;

  quotationItems.forEach(i => {
    let option = document.createElement("option");
    option.value = i.id;
    option.textContent = i.name;
    select.appendChild(option);
  });
}

function closeChargeModal() {
  document.getElementById("chargeModal").style.display = "none";
}


// =========================
// ➕ ADD ITEM FROM MODAL
// =========================
function addItemFromModal() {

  let sourceSelect = document.getElementById("mSource");
  let newSourceInput = document.getElementById("newSourceInput");

  let source = sourceSelect.value;

  // =========================
  // 🧠 HANDLE NEW SOURCE
  // =========================
  if (source === "__add_new__") {
    let newSource = newSourceInput.value.trim();

    if (!newSource) {
      alert("Enter new source ❗");
      return;
    }

    let sources = getSources();

    if (!sources.includes(newSource)) {
      sources.push(newSource);
      saveSources(sources);
    }

    source = newSource; // ✅ override properly
  }

  // =========================
  // 📦 GET VALUES
  // =========================
  let name = document.getElementById("mName").value.trim();
  let price = Number(document.getElementById("mPrice").value);
  let qty = Number(document.getElementById("mQty").value);
  let link = document.getElementById("mLink").value.trim();

  // =========================
  // 🔗 AUTO NAME FROM LINK
  // =========================
  if (!name && link) {
    try {
      let url = new URL(link);

      if (url.pathname.includes("/dp/")) {
        let parts = url.pathname.split("/");
        name = parts[1]?.replace(/-/g, " ") || "Amazon Product";
      } else if (url.searchParams.get("k")) {
        name = url.searchParams.get("k").replace(/\+/g, " ");
      } else {
        name = url.hostname.replace("www.", "");
      }

    } catch {
      name = "Online Product";
    }
  }

  // =========================
  // ✅ VALIDATION
  // =========================
  if (!name || !price || !qty) {
    alert("Fill all required fields ❗");
    return;
  }

  // =========================
  // 🧾 CREATE ITEM
  // =========================
  let item = {
    id: Date.now(),
    name,
    price,
    qty,
    source, // ✅ correct source (new or existing)
    link,
    total: price * qty
  };

  quotationItems.push(item);
  localStorage.setItem("quotationItems", JSON.stringify(quotationItems));

  // =========================
  // 🧹 CLEANUP
  // =========================
  clearItemModal();
  closeItemModal();
  renderQuotation();
}
function deleteItem(id) {
  quotationItems = quotationItems.filter(i => i.id !== id);
  localStorage.setItem("quotationItems", JSON.stringify(quotationItems));
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
  <span>${formatCurrency(i.price)}</span>
  <span>${i.qty}</span>
  <span>${i.source}</span>
  <span>
    ${i.link ? `<button onclick="window.open('${i.link}')">View</button>` : "-"}
  </span>
  <span>${formatCurrency(i.total)}</span>
  <span>
    <button onclick="deleteItem(${i.id})">❌</button>
  </span>
`;

    container.appendChild(div);
  });

  renderCharges();
  updateTotals();
  updateCurrencyUI();
}


// =========================
// ➕ ADD CHARGE
// =========================
function addCharge() {
  let type = document.getElementById("cType").value;
  let value = Number(document.getElementById("cValue").value);
  let mode = document.getElementById("cMode").value;
  let appliesTo = document.getElementById("cApplyTo").value;

  if (!value) {
    alert("Enter valid charge ❗");
    return;
  }

  let charge = {
    id: Date.now(),
    type,
    value,
    mode,
    appliesTo
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

  let subtotal = quotationItems.reduce((sum, i) => sum + i.total, 0);

  quotationCharges.forEach(c => {

    let baseAmount = 0;
    let serial = "";

    if (c.appliesTo === "all") {
      baseAmount = subtotal;
    } else {
      let item = quotationItems.find(i => i.id == c.appliesTo);
      baseAmount = item ? item.total : 0;

      let index = quotationItems.findIndex(i => i.id == c.appliesTo);
      serial = index !== -1 ? `(Item ${index + 1})` : "";
    }

    let amount = c.mode === "percent"
      ? (baseAmount * c.value) / 100
      : c.value;

    let div = document.createElement("div");

    div.innerHTML = `
      <div class="charge-row">
        <span class="charge-name">
          ${c.type.toUpperCase()} ${serial}
        </span>

        <span class="charge-percent">
          ${c.mode === "percent" ? c.value + "%" : ""}
        </span>

        <span class="charge-amount">
          ${formatCurrency(Math.round(amount))}
        </span>

        <button onclick="deleteCharge(${c.id})" class="delete-btn">❌</button>
      </div>
    `;

    container.appendChild(div);
  });
}

function deleteCharge(id) {
  quotationCharges = quotationCharges.filter(c => c.id !== id);
  localStorage.setItem("quotationCharges", JSON.stringify(quotationCharges));
  renderQuotation();
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

    let baseAmount = 0;

    if (c.appliesTo === "all") {
      baseAmount = subtotal;
    } else {
      let item = quotationItems.find(i => i.id == c.appliesTo);
      baseAmount = item ? item.total : 0;
    }

    let amount = c.mode === "percent"
      ? (baseAmount * c.value) / 100
      : c.value;

    if (c.type === "gst") gstAmount += amount;
    if (c.type === "delivery") delivery += amount;
    if (c.type === "discount") discount += amount;
  });

  let finalTotal = subtotal + gstAmount + delivery - discount;

  document.getElementById("qSubtotal").innerText = formatCurrency(Math.round(subtotal));
  document.getElementById("qGSTAmount").innerText = formatCurrency(Math.round(gstAmount));
  document.getElementById("qFinalTotal").innerText = formatCurrency(Math.round(finalTotal));
}


// =========================
// 🔄 CONVERT TO ORDER
// =========================
function convertToOrder() {
  if (!quotationItems.length) {
    alert("Add items first ❗");
    return;
  }
  let subtotal = quotationItems.reduce((sum, i) => sum + i.total, 0);

  let gstAmount = 0;
  let delivery = 0;
  let discount = 0;

  quotationCharges.forEach(c => {
    let baseAmount = c.appliesTo === "all"
      ? subtotal
      : (quotationItems.find(i => i.id == c.appliesTo)?.total || 0);

    let amount = c.mode === "percent"
      ? (baseAmount * c.value) / 100
      : c.value;

    if (c.type === "gst") gstAmount += amount;
    if (c.type === "delivery") delivery += amount;
    if (c.type === "discount") discount += amount;
  });

  let finalTotal = subtotal + gstAmount + delivery - discount;

  let data = {
    items: quotationItems,
    charges: quotationCharges,
    subtotal: subtotal,        // ✅ NUMBER
    gstAmount: gstAmount,      // ✅ NUMBER
    total: finalTotal          // ✅ NUMBER
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

function goBack() {
  window.location.href = "../index.html";
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
*/function getSources() {
  return JSON.parse(localStorage.getItem("sources")) || [
    "Amazon", "Flipkart", "Swiggy", "Local"
  ];
}

function saveSources(list) {
  localStorage.setItem("sources", JSON.stringify(list));
}

function loadSources() {
  let select = document.getElementById("mSource");
  let sources = getSources();

  select.innerHTML = '<option value="">Source</option>';

  sources.forEach(s => {
    let opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });

  // 🔥 Add special option
  let addOpt = document.createElement("option");
  addOpt.value = "__add_new__";
  addOpt.textContent = "➕ Add New Source";
  select.appendChild(addOpt);
}
function handleSourceChange(val) {
  let input = document.getElementById("newSourceInput");

  if (val === "__add_new__") {
    input.style.display = "block";
    input.focus();
  } else {
    input.style.display = "none";
  }
} function updateCurrencyUI() {
  let symbol = getCurrency();

  let fixedOption = document.getElementById("fixedCurrencyOption");
  if (fixedOption) {
    fixedOption.textContent = `Fixed ${symbol}`;
  }
}
