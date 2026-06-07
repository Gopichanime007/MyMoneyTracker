// =========================
// 📦 QUOTATION STORAGE
// =========================
const QUOTATION_REGISTRY_KEY = "quotationRegistry";
const QUOTATION_META_KEY = "quotationMeta";

let quotationItems = JSON.parse(localStorage.getItem("quotationItems") || "[]");
let quotationCharges = JSON.parse(localStorage.getItem("quotationCharges") || "[]");

function createEntityId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function escapeQuotationHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getRegistry() {
  return JSON.parse(localStorage.getItem(QUOTATION_REGISTRY_KEY) || "[]");
}

function saveRegistry(rows) {
  localStorage.setItem(QUOTATION_REGISTRY_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
}

function getCurrentMeta() {
  let meta = JSON.parse(localStorage.getItem(QUOTATION_META_KEY) || "null");
  if (!meta || !meta.id) {
    const now = new Date().toISOString();
    meta = {
      id: createEntityId("quote"),
      status: "draft",
      createdAt: now,
      updatedAt: now,
      validUntil: null,
      convertedOrderId: null,
      history: [
        { at: now, action: "created", status: "draft", note: "Quotation created" }
      ]
    };
    localStorage.setItem(QUOTATION_META_KEY, JSON.stringify(meta));
  }
  return meta;
}

function saveCurrentMeta(meta) {
  localStorage.setItem(QUOTATION_META_KEY, JSON.stringify(meta));
}

function upsertRegistry(meta, totals) {
  let registry = getRegistry();
  const row = {
    id: meta.id,
    status: meta.status,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    validUntil: meta.validUntil || null,
    convertedOrderId: meta.convertedOrderId || null,
    itemCount: quotationItems.length,
    subtotal: Number(totals.subtotal || 0),
    total: Number(totals.total || 0)
  };

  const idx = registry.findIndex(x => String(x.id) === String(meta.id));
  if (idx === -1) {
    registry.push(row);
  } else {
    registry[idx] = { ...registry[idx], ...row };
  }
  saveRegistry(registry);
}

function getAllowedStatusTransitions() {
  return {
    draft: ["sent"],
    sent: ["accepted", "rejected", "draft"],
    accepted: ["converted", "draft"],
    rejected: ["draft"],
    converted: []
  };
}

function getStatusOrder() {
  return ["draft", "sent", "accepted", "converted"];
}

function isQuotationEditable(status) {
  return String(status || "draft") === "draft";
}

function getStatusLabel(status) {
  const map = {
    draft: "Draft",
    sent: "Sent",
    accepted: "Accepted",
    rejected: "Rejected",
    converted: "Converted"
  };
  return map[status] || "Draft";
}

function showNotice(message, variant) {
  if (typeof showToast === "function") {
    showToast(message, variant || "info");
    return;
  }
  alert(message);
}

function getTotals() {
  let subtotal = quotationItems.reduce((sum, i) => sum + Number(i.total || 0), 0);

  let gstAmount = 0;
  let delivery = 0;
  let discount = 0;

  quotationCharges.forEach(c => {
    let baseAmount = 0;
    if (c.appliesTo === "all") {
      baseAmount = subtotal;
    } else {
      const item = quotationItems.find(i => String(i.id) === String(c.appliesTo));
      baseAmount = item ? Number(item.total || 0) : 0;
    }

    let amount = c.mode === "percent"
      ? (baseAmount * Number(c.value || 0)) / 100
      : Number(c.value || 0);

    if (c.type === "gst") gstAmount += amount;
    if (c.type === "delivery") delivery += amount;
    if (c.type === "discount") discount += amount;
  });

  let total = subtotal + gstAmount + delivery - discount;
  return { subtotal, gstAmount, total };
}

function syncQuotationData() {
  const meta = getCurrentMeta();
  const totals = getTotals();

  const payload = {
    id: meta.id,
    status: meta.status,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    validUntil: meta.validUntil || null,
    convertedOrderId: meta.convertedOrderId || null,
    items: quotationItems,
    charges: quotationCharges,
    subtotal: totals.subtotal,
    gstAmount: totals.gstAmount,
    total: totals.total,
    history: Array.isArray(meta.history) ? meta.history : []
  };

  localStorage.setItem("quotationData", JSON.stringify(payload));
  localStorage.setItem("quotationItems", JSON.stringify(quotationItems));
  localStorage.setItem("quotationCharges", JSON.stringify(quotationCharges));
  upsertRegistry(meta, totals);
}

function addHistory(meta, action, note) {
  const now = new Date().toISOString();
  if (!Array.isArray(meta.history)) meta.history = [];
  meta.history.push({ at: now, action, status: meta.status, note: note || "" });
  meta.updatedAt = now;
}

function renderLifecycle() {
  const meta = getCurrentMeta();
  const statusEl = document.getElementById("quotationStatusLabel");
  const idEl = document.getElementById("quotationIdLabel");
  const dateEl = document.getElementById("quotationValidityDate");

  if (statusEl) {
    statusEl.textContent = getStatusLabel(meta.status);
    statusEl.className = `status-pill status-${meta.status}`;
  }
  if (idEl) idEl.textContent = meta.id;
  if (dateEl) dateEl.value = meta.validUntil || "";

  const steps = Array.from(document.querySelectorAll("[data-status-step]"));
  const order = getStatusOrder();
  let activeIndex = order.indexOf(String(meta.status || "draft"));
  if (activeIndex < 0) activeIndex = 0;
  steps.forEach(step => {
    const stepStatus = String(step.getAttribute("data-status-step") || "");
    const idx = order.indexOf(stepStatus);
    step.classList.toggle("active", idx !== -1 && idx <= activeIndex);
    step.classList.toggle("current", stepStatus === String(meta.status || "draft"));
  });

  const statusActions = Array.from(document.querySelectorAll("[data-quote-action]"));
  const allowed = getAllowedStatusTransitions()[String(meta.status || "draft")] || [];
  statusActions.forEach(btn => {
    const action = String(btn.getAttribute("data-quote-action") || "");
    btn.style.display = allowed.includes(action) ? "inline-flex" : "none";
  });

  const editable = isQuotationEditable(meta.status);
  const addItemBtn = document.getElementById("addQuotationItemBtn");
  const addChargeBtn = document.getElementById("addQuotationChargeBtn");
  const clearBtn = document.getElementById("clearQuotationBtn");
  const convertBtn = document.getElementById("convertQuotationBtn");

  if (addItemBtn) addItemBtn.disabled = !editable;
  if (addChargeBtn) addChargeBtn.disabled = !editable;
  if (clearBtn) clearBtn.disabled = !editable;
  if (convertBtn) convertBtn.style.display = String(meta.status || "draft") === "accepted" ? "inline-flex" : "none";

  const audit = document.getElementById("quotationAuditTrail");
  if (audit) {
    const rows = (meta.history || []).slice(-4).reverse();
    if (!rows.length) {
      audit.innerHTML = "";
    } else {
      audit.innerHTML = rows.map(row => {
        const when = new Date(row.at).toLocaleString("en-IN");
        const note = row.note ? ` - ${escapeQuotationHtml(row.note)}` : "";
        return `<div class="audit-row"><small>${escapeQuotationHtml(when)} - ${escapeQuotationHtml(getStatusLabel(row.status))}${note}</small></div>`;
      }).join("");
    }
  }
}

function updateQuotationValidityDate() {
  const dateInput = document.getElementById("quotationValidityDate");
  if (!dateInput) return;
  let meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited. Reopen to Draft to continue.", "warning");
    dateInput.value = meta.validUntil || "";
    return;
  }
  meta.validUntil = dateInput.value || null;
  addHistory(meta, "validity_updated", meta.validUntil ? `Valid until ${meta.validUntil}` : "Validity cleared");
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
}

function setQuotationStatus(nextStatus) {
  let meta = getCurrentMeta();
  const current = String(meta.status || "draft");

  if (current === nextStatus) return;
  const allowed = getAllowedStatusTransitions()[current] || [];
  if (!allowed.includes(nextStatus)) {
    showNotice(`Status transition not allowed: ${getStatusLabel(current)} → ${getStatusLabel(nextStatus)}`, "warning");
    return;
  }

  if (nextStatus === "accepted" && !quotationItems.length) {
    showNotice("Cannot accept an empty quotation.", "warning");
    return;
  }

  if (nextStatus === "draft" && current === "rejected") {
    addHistory(meta, "reopened", "Quotation reopened for corrections");
  }

  meta.status = nextStatus;
  addHistory(meta, "status_changed", `Moved to ${getStatusLabel(nextStatus)}`);
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
  showNotice(`Quotation moved to ${getStatusLabel(nextStatus)}.`);
}

// =========================
// 🔗 OPEN PRODUCT LINK
// =========================
function openProductLink() {
  if (!document.getElementById || !document.getElementById("mLink")) return;
  const link = document.getElementById("mLink").value.trim();
  if (!link) return;
  try {
    const url = new URL(link);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  } catch (_err) {
    showNotice("Please enter a valid product URL.", "warning");
  }
}

// =========================
// 📦 MODAL CONTROL
// =========================
function openItemModal() {
  if (!document.getElementById || !document.getElementById("itemModal")) return;
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited. Reopen to Draft to add items.", "warning");
    return;
  }
  document.getElementById("itemModal").style.display = "flex";
  if (typeof loadSources === "function") loadSources();
}

function closeItemModal() {
  if (!document.getElementById || !document.getElementById("itemModal")) return;
  document.getElementById("itemModal").style.display = "none";
}

function openChargeModal() {
  if (!document.getElementById || !document.getElementById("chargeModal")) return;
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited. Reopen to Draft to add charges.", "warning");
    return;
  }
  document.getElementById("chargeModal").style.display = "flex";

  let select = document.getElementById("cApplyTo");
  if (select) {
    select.innerHTML = `<option value="all">All Items</option>`;
    quotationItems.forEach(i => {
      let option = document.createElement("option");
      option.value = i.id;
      option.textContent = i.name;
      select.appendChild(option);
    });
  }
}

function closeChargeModal() {
  if (!document.getElementById || !document.getElementById("chargeModal")) return;
  document.getElementById("chargeModal").style.display = "none";
}

// =========================
// ➕ ADD ITEM FROM MODAL
// =========================
function addItemFromModal() {
  if (!document.getElementById || !document.getElementById("mSource")) return;

  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited.", "warning");
    closeItemModal();
    return;
  }

  let sourceSelect = document.getElementById("mSource");
  let newSourceInput = document.getElementById("newSourceInput");
  let source = sourceSelect ? sourceSelect.value : "";

  if (source === "__add_new__") {
    let newSource = newSourceInput.value.trim();
    if (!newSource) {
      showNotice("Enter a new source name.", "warning");
      return;
    }

    let sources = getSources();
    if (!sources.includes(newSource)) {
      sources.push(newSource);
      saveSources(sources);
    }
    source = newSource;
  }

  let name = document.getElementById("mName") ? document.getElementById("mName").value.trim() : "";
  let price = document.getElementById("mPrice") ? Number(document.getElementById("mPrice").value) : 0;
  let qty = document.getElementById("mQty") ? Number(document.getElementById("mQty").value) : 0;
  let link = document.getElementById("mLink") ? document.getElementById("mLink").value.trim() : "";

  if (!name && link) {
    try {
      let url = new URL(link);
      if (url.pathname.includes("/dp/")) {
        let parts = url.pathname.split("/");
        name = parts[1] ? parts[1].replace(/-/g, " ") : "Online Product";
      } else if (url.searchParams.get("k")) {
        name = url.searchParams.get("k").replace(/\+/g, " ");
      } else {
        name = url.hostname.replace("www.", "");
      }
    } catch (_err) {
      name = "Online Product";
    }
  }

  if (!name) {
    showNotice("Product name is required.", "warning");
    return;
  }
  if (!(price > 0)) {
    showNotice("Price must be greater than zero.", "warning");
    return;
  }
  if (!(qty > 0)) {
    showNotice("Quantity must be greater than zero.", "warning");
    return;
  }
  if (link) {
    try { new URL(link); } catch (_err) {
      showNotice("Product link is invalid.", "warning");
      return;
    }
  }

  const item = {
    id: createEntityId("qi"),
    name,
    price,
    qty,
    source: source || "Unspecified",
    link,
    total: Number((price * qty).toFixed(2))
  };

  quotationItems.push(item);

  addHistory(meta, "item_added", `${name} x${qty}`);
  saveCurrentMeta(meta);

  clearItemModal();
  closeItemModal();
  renderQuotation();
}

function deleteItem(id) {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited.", "warning");
    return;
  }

  const row = quotationItems.find(i => String(i.id) === String(id));
  quotationItems = quotationItems.filter(i => String(i.id) !== String(id));

  addHistory(meta, "item_removed", row ? row.name : "Item removed");
  saveCurrentMeta(meta);

  renderQuotation();
}

function clearItemModal() {
  if (document.getElementById("mName")) document.getElementById("mName").value = "";
  if (document.getElementById("mPrice")) document.getElementById("mPrice").value = "";
  if (document.getElementById("mQty")) document.getElementById("mQty").value = "";
  if (document.getElementById("mSource")) document.getElementById("mSource").value = "";
  if (document.getElementById("mLink")) document.getElementById("mLink").value = "";
  if (document.getElementById("newSourceInput")) document.getElementById("newSourceInput").value = "";
}

// =========================
// 📋 RENDER ITEMS
// =========================
function renderQuotation() {
  if (!document.getElementById || !document.getElementById("quotationItems")) return;
  let container = document.getElementById("quotationItems");

  if (!quotationItems.length) {
    container.innerHTML = `<p class="empty">No items added</p>`;
    renderCharges();
    updateTotals();
    renderLifecycle();
    syncQuotationData();
    return;
  }

  container.innerHTML = "";

  quotationItems.forEach(i => {
    let div = document.createElement("div");
    div.className = "table-row";

    const safeName = escapeQuotationHtml(i.name);
    const safeSource = escapeQuotationHtml(i.source || "-");
    const safeLink = escapeQuotationHtml(i.link || "");

    div.innerHTML = `
      <span>${safeName}</span>
      <span>${formatCurrency(Number(i.price || 0))}</span>
      <span>${Number(i.qty || 0)}</span>
      <span>${safeSource}</span>
      <span>
        ${safeLink ? `<button type="button" class="secondary tiny-btn" onclick="window.open('${safeLink}','_blank','noopener,noreferrer')">View</button>` : "-"}
      </span>
      <span>${formatCurrency(Number(i.total || 0))}</span>
      <span>
        <button type="button" class="secondary tiny-btn" onclick="deleteItem('${escapeQuotationHtml(i.id)}')">Remove</button>
      </span>
    `;

    container.appendChild(div);
  });

  renderCharges();
  updateTotals();
  renderLifecycle();
  syncQuotationData();
  updateCurrencyUI();
}

// =========================
// ➕ ADD CHARGE
// =========================
function addCharge() {
  if (!document.getElementById || !document.getElementById("cType")) return;

  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited.", "warning");
    closeChargeModal();
    return;
  }

  let type = document.getElementById("cType").value;
  let value = Number(document.getElementById("cValue").value);
  let mode = document.getElementById("cMode").value;
  let appliesTo = document.getElementById("cApplyTo").value;

  if (!(value > 0)) {
    showNotice("Charge value must be greater than zero.", "warning");
    return;
  }

  if (mode === "percent" && value > 1000) {
    showNotice("Charge percentage seems too high.", "warning");
    return;
  }

  const charge = {
    id: createEntityId("qc"),
    type,
    value,
    mode,
    appliesTo
  };

  quotationCharges.push(charge);

  addHistory(meta, "charge_added", `${type.toUpperCase()} ${mode === "percent" ? `${value}%` : formatCurrency(value)}`);
  saveCurrentMeta(meta);

  closeChargeModal();
  renderQuotation();
}

function renderCharges() {
  let container = document.getElementById("chargesList");
  if (!container) return;

  container.innerHTML = "";

  let subtotal = quotationItems.reduce((sum, i) => sum + Number(i.total || 0), 0);

  quotationCharges.forEach(c => {
    let baseAmount = 0;
    let serial = "";

    if (c.appliesTo === "all") {
      baseAmount = subtotal;
    } else {
      let item = quotationItems.find(i => String(i.id) === String(c.appliesTo));
      baseAmount = item ? Number(item.total || 0) : 0;

      let index = quotationItems.findIndex(i => String(i.id) === String(c.appliesTo));
      serial = index !== -1 ? `(Item ${index + 1})` : "";
    }

    let amount = c.mode === "percent"
      ? (baseAmount * Number(c.value || 0)) / 100
      : Number(c.value || 0);

    let div = document.createElement("div");
    div.innerHTML = `
      <div class="charge-row">
        <span class="charge-name">${escapeQuotationHtml(String(c.type || "").toUpperCase())} ${escapeQuotationHtml(serial)}</span>
        <span class="charge-percent">${c.mode === "percent" ? `${Number(c.value || 0)}%` : ""}</span>
        <span class="charge-amount">${formatCurrency(Number(amount || 0))}</span>
        <button type="button" onclick="deleteCharge('${escapeQuotationHtml(c.id)}')" class="delete-btn">✕</button>
      </div>
    `;

    container.appendChild(div);
  });
}

function deleteCharge(id) {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only Draft quotations can be edited.", "warning");
    return;
  }

  const row = quotationCharges.find(c => String(c.id) === String(id));
  quotationCharges = quotationCharges.filter(c => String(c.id) !== String(id));

  addHistory(meta, "charge_removed", row ? String(row.type || "Charge") : "Charge removed");
  saveCurrentMeta(meta);

  renderQuotation();
}

function updateTotals() {
  const totals = getTotals();

  if (document.getElementById("qSubtotal")) {
    document.getElementById("qSubtotal").innerText = formatCurrency(Number(totals.subtotal || 0));
  }
  if (document.getElementById("qGSTAmount")) {
    document.getElementById("qGSTAmount").innerText = formatCurrency(Number(totals.gstAmount || 0));
  }
  if (document.getElementById("qFinalTotal")) {
    document.getElementById("qFinalTotal").innerText = formatCurrency(Number(totals.total || 0));
  }
}

// =========================
// 🔄 CONVERT TO ORDER
// =========================
function convertToOrder() {
  if (!quotationItems.length) {
    showNotice("Add at least one item before conversion.", "warning");
    return;
  }

  let meta = getCurrentMeta();
  if (meta.status !== "accepted") {
    showNotice("Quotation must be Accepted before converting to order.", "warning");
    return;
  }

  const totals = getTotals();
  const orderId = createEntityId("order");

  meta.status = "converted";
  meta.convertedOrderId = orderId;
  addHistory(meta, "converted", `Converted to order ${orderId}`);
  saveCurrentMeta(meta);

  const data = {
    id: meta.id,
    orderId,
    status: meta.status,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    validUntil: meta.validUntil || null,
    convertedOrderId: orderId,
    items: quotationItems,
    charges: quotationCharges,
    subtotal: totals.subtotal,
    gstAmount: totals.gstAmount,
    total: totals.total,
    history: Array.isArray(meta.history) ? meta.history : []
  };

  localStorage.setItem("quotationData", JSON.stringify(data));
  localStorage.setItem("activeOrderId", JSON.stringify(orderId));
  upsertRegistry(meta, totals);

  showNotice("Quotation converted. Continue with order confirmation.", "success");
  window.location.href = "order.html";
}

// =========================
// 🗑 CLEAR ALL
// =========================
function clearQuotation() {
  if (!confirm("Clear current quotation draft?")) return;

  quotationItems = [];
  quotationCharges = [];

  const now = new Date().toISOString();
  const meta = {
    id: createEntityId("quote"),
    status: "draft",
    createdAt: now,
    updatedAt: now,
    validUntil: null,
    convertedOrderId: null,
    history: [{ at: now, action: "created", status: "draft", note: "Quotation created" }]
  };

  localStorage.setItem(QUOTATION_META_KEY, JSON.stringify(meta));
  localStorage.removeItem("quotationData");
  localStorage.setItem("quotationItems", JSON.stringify([]));
  localStorage.setItem("quotationCharges", JSON.stringify([]));

  renderQuotation();
}

// =========================
// 🚀 INIT
// =========================
function initializeQuotationModule() {
  const meta = getCurrentMeta();
  if (!meta.validUntil) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    meta.validUntil = d.toISOString().split("T")[0];
    addHistory(meta, "validity_updated", `Valid until ${meta.validUntil}`);
    saveCurrentMeta(meta);
  }

  const validityDate = document.getElementById("quotationValidityDate");
  if (validityDate) {
    validityDate.value = meta.validUntil || "";
    validityDate.addEventListener("change", updateQuotationValidityDate);
  }

  renderQuotation();
}

initializeQuotationModule();

function goBack() {
  window.location.href = "../index.html";
}

function getSources() {
  return JSON.parse(localStorage.getItem("sources") || "null") || [
    "Amazon", "Flipkart", "Swiggy", "Local"
  ];
}

function saveSources(list) {
  localStorage.setItem("sources", JSON.stringify(list));
}

function loadSources() {
  let select = document.getElementById("mSource");
  let sources = getSources();

  if (!select) return;
  select.innerHTML = '<option value="">Source</option>';

  sources.forEach(s => {
    let opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    select.appendChild(opt);
  });

  let addOpt = document.createElement("option");
  addOpt.value = "__add_new__";
  addOpt.textContent = "➕ Add New Source";
  select.appendChild(addOpt);
}

function handleSourceChange(val) {
  let input = document.getElementById("newSourceInput");
  if (!input) return;

  if (val === "__add_new__") {
    input.style.display = "block";
    input.focus();
  } else {
    input.style.display = "none";
  }
}

function updateCurrencyUI() {
  if (typeof getCurrency !== "function") return;

  let symbol = getCurrency();
  let fixedOption = document.getElementById("fixedCurrencyOption");
  if (fixedOption) {
    fixedOption.textContent = `Fixed ${symbol}`;
  }
}
