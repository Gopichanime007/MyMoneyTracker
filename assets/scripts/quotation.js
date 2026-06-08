const Q_WORKFLOW_KEYS = (window.DocWorkflow && window.DocWorkflow.keys) || {};
const Q_REGISTRY_STORAGE_KEY = Q_WORKFLOW_KEYS.quotationRegistry || "quotationRegistry";
const Q_META_STORAGE_KEY = Q_WORKFLOW_KEYS.quotationMeta || "quotationMeta";
const Q_ACTIVE_STORAGE_KEY = Q_WORKFLOW_KEYS.activeQuotation || "activeQuotationId";

let quotationItems = [];
let quotationCharges = [];

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

function showNotice(message, variant) {
  if (typeof showToast === "function") {
    showToast(message, variant || "info");
    return;
  }
  if (window.AppDialog && typeof window.AppDialog.alert === "function") {
    window.AppDialog.alert(message, "Notice");
    return;
  }
  console.warn(message);
}

function getTodayDateKey() {
  return new Date().toISOString().split("T")[0];
}

function getRegistry() {
  if (window.DocWorkflow) return window.DocWorkflow.getQuotationRegistry();
  return JSON.parse(localStorage.getItem(Q_REGISTRY_STORAGE_KEY) || "[]");
}

function saveRegistry(rows) {
  if (window.DocWorkflow) {
    window.DocWorkflow.saveQuotationRegistry(rows);
    return;
  }
  localStorage.setItem(Q_REGISTRY_STORAGE_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
}

function getActiveQuotationId() {
  try {
    return JSON.parse(localStorage.getItem(Q_ACTIVE_STORAGE_KEY) || "null");
  } catch (_err) {
    return null;
  }
}

function saveCurrentMeta(meta) {
  localStorage.setItem(Q_META_STORAGE_KEY, JSON.stringify(meta));
}

function getStatusOrder() {
  return ["draft", "accepted", "converted"];
}

function isQuotationEditable(status) {
  return String(status || "draft") === "draft";
}

function getStatusLabel(status) {
  const map = {
    draft: "Draft",
    accepted: "Accepted",
    converted: "Converted"
  };
  return map[status] || "Draft";
}

function getAllowedStatusTransitions() {
  return {
    draft: ["accepted"],
    accepted: ["draft", "converted"],
    converted: []
  };
}

function getCurrentMeta() {
  const activeId = getActiveQuotationId();
  const registry = getRegistry();

  if (activeId) {
    const row = registry.find((x) => String(x.id) === String(activeId));
    if (row) {
      const existing = JSON.parse(localStorage.getItem(Q_META_STORAGE_KEY) || "null");
      if (existing && String(existing.id) === String(row.id)) return existing;

      const rebuilt = {
        id: row.id,
        quotationNo: row.quotationNo || (window.DocWorkflow ? window.DocWorkflow.generateDocumentNumber("quotation") : createEntityId("QT")),
        purpose: row.purpose || "",
        status: row.status || "draft",
        createdAt: row.createdAt || new Date().toISOString(),
        updatedAt: row.updatedAt || new Date().toISOString(),
        validUntil: row.validUntil || null,
        convertedOrderId: row.convertedOrderId || row.orderId || null,
        fundingSourceType: row.fundingSourceType || null,
        fundingSourceId: row.fundingSourceId || null,
        fundingSourceName: row.fundingSourceName || null,
        history: Array.isArray(row.history) ? row.history : []
      };

      quotationItems = Array.isArray(row.items) ? row.items.slice() : [];
      quotationCharges = Array.isArray(row.charges) ? row.charges.slice() : [];

      saveCurrentMeta(rebuilt);
      return rebuilt;
    }
  }

  let meta = JSON.parse(localStorage.getItem(Q_META_STORAGE_KEY) || "null");
  if (meta && meta.id) return meta;

  const now = new Date().toISOString();
  const quotationNo = window.DocWorkflow
    ? window.DocWorkflow.generateDocumentNumber("quotation")
    : createEntityId("QT");

  meta = {
    id: createEntityId("quote"),
    quotationNo,
    purpose: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
    validUntil: null,
    convertedOrderId: null,
    fundingSourceType: null,
    fundingSourceId: null,
    fundingSourceName: null,
    history: [
      { at: now, action: "created", status: "draft", note: "Purchase plan created" }
    ]
  };

  quotationItems = [];
  quotationCharges = [];
  localStorage.setItem(Q_ACTIVE_STORAGE_KEY, JSON.stringify(meta.id));
  saveCurrentMeta(meta);
  return meta;
}

function addHistory(meta, action, note) {
  const now = new Date().toISOString();
  if (!Array.isArray(meta.history)) meta.history = [];
  meta.history.push({ at: now, action, status: meta.status, note: note || "" });
  meta.updatedAt = now;
}

function getTotals() {
  const subtotal = quotationItems.reduce((sum, item) => sum + Number(item.total || 0), 0);

  let gstAmount = 0;
  let delivery = 0;
  let discount = 0;

  quotationCharges.forEach((charge) => {
    let baseAmount = 0;
    if (charge.appliesTo === "all") {
      baseAmount = subtotal;
    } else {
      const item = quotationItems.find((x) => String(x.id) === String(charge.appliesTo));
      baseAmount = item ? Number(item.total || 0) : 0;
    }

    const amount = charge.mode === "percent"
      ? (baseAmount * Number(charge.value || 0)) / 100
      : Number(charge.value || 0);

    if (charge.type === "gst") gstAmount += amount;
    if (charge.type === "delivery") delivery += amount;
    if (charge.type === "discount") discount += amount;
  });

  const total = subtotal + gstAmount + delivery - discount;
  return { subtotal, gstAmount, total };
}

function upsertRegistry(meta, totals) {
  const rows = getRegistry();
  const relation = window.DocWorkflow ? window.DocWorkflow.getRelationByQuotationId(meta.id) : null;

  const dataRow = {
    id: meta.id,
    quotationNo: meta.quotationNo,
    purpose: meta.purpose,
    status: meta.status,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    validUntil: meta.validUntil || null,
    convertedOrderId: meta.convertedOrderId || null,
    fundingSourceType: meta.fundingSourceType || null,
    fundingSourceId: meta.fundingSourceId || null,
    fundingSourceName: meta.fundingSourceName || null,
    orderId: relation && relation.orderId ? relation.orderId : (meta.convertedOrderId || null),
    relationshipStatus: relation && relation.relationshipStatus ? relation.relationshipStatus : (meta.convertedOrderId ? "linked" : "unlinked"),
    itemCount: quotationItems.length,
    subtotal: Number(totals.subtotal || 0),
    total: Number(totals.total || 0),
    items: quotationItems,
    charges: quotationCharges,
    history: Array.isArray(meta.history) ? meta.history : []
  };

  const idx = rows.findIndex((x) => String(x.id) === String(meta.id));
  if (idx === -1) rows.push(dataRow); else rows[idx] = Object.assign({}, rows[idx], dataRow);
  saveRegistry(rows);
}

function syncQuotationData() {
  const meta = getCurrentMeta();
  const totals = getTotals();

  const payload = {
    id: meta.id,
    quotationNo: meta.quotationNo,
    purpose: meta.purpose,
    status: meta.status,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    validUntil: meta.validUntil || null,
    convertedOrderId: meta.convertedOrderId || null,
    fundingSourceType: meta.fundingSourceType || null,
    fundingSourceId: meta.fundingSourceId || null,
    fundingSourceName: meta.fundingSourceName || null,
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

  if (window.DocWorkflow) {
    window.DocWorkflow.upsertRelation({
      quotationId: meta.id,
      orderId: meta.convertedOrderId || null,
      relationshipStatus: meta.convertedOrderId ? "linked" : "unlinked"
    });
  }
}

function renderLifecycle() {
  const meta = getCurrentMeta();
  const statusEl = document.getElementById("quotationStatusLabel");
  const noEl = document.getElementById("quotationNoLabel");
  const dateEl = document.getElementById("quotationValidityDate");
  const purposeEl = document.getElementById("quotationPurpose");

  if (statusEl) {
    statusEl.textContent = getStatusLabel(meta.status);
    statusEl.className = `status-pill status-${meta.status}`;
  }
  if (noEl) noEl.textContent = meta.quotationNo || "-";
  if (dateEl) dateEl.value = meta.validUntil || "";
  if (purposeEl) purposeEl.value = meta.purpose || "";

  const steps = Array.from(document.querySelectorAll("[data-status-step]"));
  const order = getStatusOrder();
  let activeIndex = order.indexOf(String(meta.status || "draft"));
  if (activeIndex < 0) activeIndex = 0;

  steps.forEach((step) => {
    const stepStatus = String(step.getAttribute("data-status-step") || "");
    const idx = order.indexOf(stepStatus);
    step.classList.toggle("active", idx !== -1 && idx <= activeIndex);
    step.classList.toggle("current", stepStatus === String(meta.status || "draft"));
  });

  const statusActions = Array.from(document.querySelectorAll("[data-quote-action]"));
  const allowed = getAllowedStatusTransitions()[String(meta.status || "draft")] || [];
  statusActions.forEach((btn) => {
    const action = String(btn.getAttribute("data-quote-action") || "");
    btn.style.display = allowed.includes(action) ? "inline-flex" : "none";
  });

  const editable = isQuotationEditable(meta.status);
  const addItemBtn = document.getElementById("addQuotationItemBtn");
  const addChargeBtn = document.getElementById("addQuotationChargeBtn");
  const clearBtn = document.getElementById("clearQuotationBtn");
  const convertBtn = document.getElementById("convertQuotationBtn");
  const saveDraftBtn = document.getElementById("saveDraftBtn");
  const sourceType = document.getElementById("qSourceType");
  const sourceValue = document.getElementById("qSourceValue");
  const validityDate = document.getElementById("quotationValidityDate");
  const purposeInput = document.getElementById("quotationPurpose");

  if (addItemBtn) addItemBtn.disabled = !editable;
  if (addChargeBtn) addChargeBtn.disabled = !editable;
  if (clearBtn) clearBtn.disabled = !editable;
  if (saveDraftBtn) saveDraftBtn.disabled = !editable;
  if (convertBtn) convertBtn.style.display = String(meta.status || "draft") === "accepted" ? "inline-flex" : "none";
  if (sourceType) sourceType.disabled = !editable;
  if (sourceValue) sourceValue.disabled = !editable;
  if (validityDate) validityDate.disabled = !editable;
  if (purposeInput) purposeInput.disabled = !editable;

  const audit = document.getElementById("quotationAuditTrail");
  if (audit) {
    const rows = (meta.history || []).slice(-5).reverse();
    if (!rows.length) {
      audit.innerHTML = "";
    } else {
      audit.innerHTML = rows.map((row) => {
        const when = new Date(row.at).toLocaleString("en-IN");
        const note = row.note ? ` - ${escapeQuotationHtml(row.note)}` : "";
        return `<div class="audit-row"><small>${escapeQuotationHtml(when)} - ${escapeQuotationHtml(getStatusLabel(row.status))}${note}</small></div>`;
      }).join("");
    }
  }
}

function setQuotationPurpose() {
  const input = document.getElementById("quotationPurpose");
  if (!input) return;

  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) return;

  const purpose = String(input.value || "").trim();
  meta.purpose = purpose;
  addHistory(meta, "purpose_updated", purpose ? `Purpose set to ${purpose}` : "Purpose cleared");
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
}

function updateQuotationValidityDate() {
  const dateInput = document.getElementById("quotationValidityDate");
  if (!dateInput) return;
  const meta = getCurrentMeta();

  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    dateInput.value = meta.validUntil || "";
    return;
  }

  if (dateInput.value && dateInput.value < getTodayDateKey()) {
    showNotice("Validity date cannot be in the past.", "warning");
    dateInput.value = meta.validUntil || "";
    return;
  }

  meta.validUntil = dateInput.value || null;
  addHistory(meta, "validity_updated", meta.validUntil ? `Valid until ${meta.validUntil}` : "Validity cleared");
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
}

function loadQuotationFundingOptions() {
  const typeEl = document.getElementById("qSourceType");
  const valueEl = document.getElementById("qSourceValue");
  const meta = getCurrentMeta();

  if (!typeEl || !valueEl) return;

  const selectedType = typeEl.value;
  valueEl.innerHTML = '<option value="">Select Funding Account</option>';

  const list = window.DocWorkflow ? window.DocWorkflow.getFundingSourceSummaries(selectedType) : [];
  list.forEach((row) => {
    const option = document.createElement("option");
    option.value = String(row.id);
    option.textContent = `${row.name} (${formatCurrency(Number(row.remaining || 0))})`;
    option.dataset.type = selectedType;
    option.dataset.name = row.name;
    option.dataset.remaining = String(Number(row.remaining || 0));
    valueEl.appendChild(option);
  });

  if (meta.fundingSourceType === selectedType && meta.fundingSourceId) {
    valueEl.value = String(meta.fundingSourceId);
  }

  renderQuotationFundingPreview();
}

function renderQuotationFundingPreview() {
  const typeEl = document.getElementById("qSourceType");
  const valueEl = document.getElementById("qSourceValue");
  const preview = document.getElementById("qFundingPreview");
  if (!typeEl || !valueEl || !preview) return;

  const selected = valueEl.options[valueEl.selectedIndex];
  if (!selected || !selected.value) {
    preview.innerHTML = "<small>Select source type and account with available balance.</small>";
    return;
  }

  preview.innerHTML = `
    <small><strong>Funding Type:</strong> ${escapeQuotationHtml(typeEl.value)}</small><br>
    <small><strong>Account:</strong> ${escapeQuotationHtml(selected.dataset.name || selected.textContent)}</small><br>
    <small><strong>Available:</strong> ${formatCurrency(Number(selected.dataset.remaining || 0))}</small>
  `;
}

function setQuotationFunding() {
  const typeEl = document.getElementById("qSourceType");
  const valueEl = document.getElementById("qSourceValue");
  if (!typeEl || !valueEl) return;

  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) return;

  const selected = valueEl.options[valueEl.selectedIndex];
  meta.fundingSourceType = typeEl.value || null;
  meta.fundingSourceId = selected && selected.value ? String(selected.value) : null;
  meta.fundingSourceName = selected && selected.value ? (selected.dataset.name || selected.textContent) : null;

  addHistory(meta, "funding_updated", meta.fundingSourceName ? `Funding set to ${meta.fundingSourceType} → ${meta.fundingSourceName}` : "Funding cleared");
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
}

function validatePlanCore(meta) {
  if (!String(meta.purpose || "").trim()) {
    showNotice("Purpose / Title is required.", "warning");
    return false;
  }

  if (!meta.fundingSourceType || !meta.fundingSourceId) {
    showNotice("Select funding source type and account.", "warning");
    return false;
  }

  if (!quotationItems.length) {
    showNotice("Add at least one expense plan item.", "warning");
    return false;
  }

  return true;
}

function savePurchasePlanDraft() {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    return;
  }

  if (!validatePlanCore(meta)) return;

  addHistory(meta, "draft_saved", "Draft saved");
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
  showNotice("Purchase plan draft saved.", "success");
}

function setQuotationStatus(nextStatus) {
  const meta = getCurrentMeta();
  const current = String(meta.status || "draft");
  if (current === nextStatus) return;

  const allowed = getAllowedStatusTransitions()[current] || [];
  if (!allowed.includes(nextStatus)) {
    showNotice(`Status transition not allowed: ${getStatusLabel(current)} to ${getStatusLabel(nextStatus)}`, "warning");
    return;
  }

  if (nextStatus === "accepted") {
    if (!validatePlanCore(meta)) return;

    if (meta.validUntil && meta.validUntil < getTodayDateKey()) {
      showNotice("Cannot accept an expired purchase plan.", "warning");
      return;
    }
  }

  meta.status = nextStatus;
  addHistory(meta, "status_changed", `Moved to ${getStatusLabel(nextStatus)}`);
  saveCurrentMeta(meta);
  syncQuotationData();
  renderLifecycle();
  showNotice(`Plan moved to ${getStatusLabel(nextStatus)}.`);
}

function openProductLink() {
  const linkEl = document.getElementById("mLink");
  if (!linkEl) return;
  const link = String(linkEl.value || "").trim();
  if (!link) return;

  try {
    const url = new URL(link);
    window.open(url.toString(), "_blank", "noopener,noreferrer");
  } catch (_err) {
    showNotice("Please enter a valid product URL.", "warning");
  }
}

function openItemModal() {
  const modal = document.getElementById("itemModal");
  if (!modal) return;

  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    return;
  }

  modal.style.display = "flex";
  if (typeof loadSources === "function") loadSources();
}

function closeItemModal() {
  const modal = document.getElementById("itemModal");
  if (modal) modal.style.display = "none";
}

function openChargeModal() {
  const modal = document.getElementById("chargeModal");
  if (!modal) return;

  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    return;
  }

  modal.style.display = "flex";

  const select = document.getElementById("cApplyTo");
  if (select) {
    select.innerHTML = '<option value="all">All Items</option>';
    quotationItems.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.id;
      option.textContent = item.name;
      select.appendChild(option);
    });
  }

  toggleCustomChargeField();
  const typeEl = document.getElementById("cType");
  if (typeEl) typeEl.onchange = toggleCustomChargeField;
}

function closeChargeModal() {
  const modal = document.getElementById("chargeModal");
  if (modal) modal.style.display = "none";
  if (document.getElementById("cValue")) document.getElementById("cValue").value = "";
  if (document.getElementById("cCustomLabel")) document.getElementById("cCustomLabel").value = "";
  if (document.getElementById("cApplyTo")) document.getElementById("cApplyTo").value = "all";
}

function toggleCustomChargeField() {
  const typeEl = document.getElementById("cType");
  const customEl = document.getElementById("cCustomLabel");
  if (!typeEl || !customEl) return;

  const visible = typeEl.value === "custom";
  customEl.style.display = visible ? "block" : "none";
  if (!visible) customEl.value = "";
}

function addItemFromModal() {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    closeItemModal();
    return;
  }

  const sourceSelect = document.getElementById("mSource");
  const newSourceInput = document.getElementById("newSourceInput");
  let source = sourceSelect ? sourceSelect.value : "";

  if (source === "__add_new__") {
    const newSource = String(newSourceInput ? newSourceInput.value : "").trim();
    if (!newSource) {
      showNotice("Enter a new source name.", "warning");
      return;
    }

    const list = getSources();
    if (!list.includes(newSource)) {
      list.push(newSource);
      saveSources(list);
    }
    source = newSource;
  }

  const name = String((document.getElementById("mName") || {}).value || "").trim();
  const price = Number((document.getElementById("mPrice") || {}).value || 0);
  const qty = Number((document.getElementById("mQty") || {}).value || 0);
  const unit = String((document.getElementById("mUnit") || {}).value || "pcs");
  const link = String((document.getElementById("mLink") || {}).value || "").trim();

  if (!name) {
    showNotice("Item name is required.", "warning");
    return;
  }
  if (name.length > 120) {
    showNotice("Item name is too long.", "warning");
    return;
  }
  if (!(price > 0) || !(qty > 0)) {
    showNotice("Price and quantity must be greater than zero.", "warning");
    return;
  }
  if (link) {
    try { new URL(link); } catch (_err) {
      showNotice("Product link is invalid.", "warning");
      return;
    }
  }

  quotationItems.push({
    id: createEntityId("qi"),
    name,
    price,
    qty,
    unit,
    source: source || "Unspecified",
    link,
    total: Number((price * qty).toFixed(2))
  });

  addHistory(meta, "item_added", `${name} x${qty}`);
  saveCurrentMeta(meta);
  clearItemModal();
  closeItemModal();
  renderQuotation();
}

function deleteItem(id) {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    return;
  }

  const row = quotationItems.find((item) => String(item.id) === String(id));
  quotationItems = quotationItems.filter((item) => String(item.id) !== String(id));
  quotationCharges = quotationCharges.filter((charge) => String(charge.appliesTo || "all") !== String(id));

  addHistory(meta, "item_removed", row ? row.name : "Item removed");
  saveCurrentMeta(meta);
  renderQuotation();
}

function clearItemModal() {
  if (document.getElementById("mName")) document.getElementById("mName").value = "";
  if (document.getElementById("mPrice")) document.getElementById("mPrice").value = "";
  if (document.getElementById("mQty")) document.getElementById("mQty").value = "";
  if (document.getElementById("mUnit")) document.getElementById("mUnit").value = "pcs";
  if (document.getElementById("mSource")) document.getElementById("mSource").value = "";
  if (document.getElementById("mLink")) document.getElementById("mLink").value = "";
  if (document.getElementById("newSourceInput")) document.getElementById("newSourceInput").value = "";
}

function addCharge() {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    closeChargeModal();
    return;
  }

  const type = String((document.getElementById("cType") || {}).value || "delivery");
  const customLabel = String((document.getElementById("cCustomLabel") || {}).value || "").trim();
  const value = Number((document.getElementById("cValue") || {}).value || 0);
  const mode = String((document.getElementById("cMode") || {}).value || "fixed");
  const appliesTo = String((document.getElementById("cApplyTo") || {}).value || "all");

  if (!(value > 0)) {
    showNotice("Charge value must be greater than zero.", "warning");
    return;
  }
  if (mode === "percent" && value > 100) {
    showNotice("Charge percentage must be <= 100.", "warning");
    return;
  }
  if (type === "custom" && !customLabel) {
    showNotice("Custom charge name is required.", "warning");
    return;
  }

  quotationCharges.push({
    id: createEntityId("qc"),
    type,
    label: type === "custom" ? customLabel : type,
    value,
    mode,
    appliesTo
  });

  addHistory(meta, "charge_added", `${type.toUpperCase()} ${mode === "percent" ? `${value}%` : formatCurrency(value)}`);
  saveCurrentMeta(meta);
  closeChargeModal();
  renderQuotation();
}

function deleteCharge(id) {
  const meta = getCurrentMeta();
  if (!isQuotationEditable(meta.status)) {
    showNotice("Only draft plans can be edited.", "warning");
    return;
  }

  const row = quotationCharges.find((charge) => String(charge.id) === String(id));
  quotationCharges = quotationCharges.filter((charge) => String(charge.id) !== String(id));
  addHistory(meta, "charge_removed", row ? String(row.type || "Charge") : "Charge removed");
  saveCurrentMeta(meta);
  renderQuotation();
}

function renderCharges() {
  const host = document.getElementById("chargesList");
  if (!host) return;

  host.innerHTML = "";
  if (!quotationCharges.length) {
    host.innerHTML = '<p class="empty">No charges added</p>';
    return;
  }

  const subtotal = quotationItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  quotationCharges.forEach((charge) => {
    let baseAmount = 0;
    let serial = "";

    if (charge.appliesTo === "all") {
      baseAmount = subtotal;
    } else {
      const item = quotationItems.find((x) => String(x.id) === String(charge.appliesTo));
      baseAmount = item ? Number(item.total || 0) : 0;
      const index = quotationItems.findIndex((x) => String(x.id) === String(charge.appliesTo));
      serial = index !== -1 ? `(Item ${index + 1})` : "";
    }

    const amount = charge.mode === "percent"
      ? (baseAmount * Number(charge.value || 0)) / 100
      : Number(charge.value || 0);

    const row = document.createElement("div");
    row.innerHTML = `
      <div class="charge-row">
        <span class="charge-name">${escapeQuotationHtml(String((charge.label || charge.type || "")).toUpperCase())} ${escapeQuotationHtml(serial)}</span>
        <span class="charge-percent">${charge.mode === "percent" ? `${Number(charge.value || 0)}%` : ""}</span>
        <span class="charge-amount">${formatCurrency(Number(amount || 0))}</span>
        <button type="button" onclick="deleteCharge('${escapeQuotationHtml(charge.id)}')" class="delete-btn">✕</button>
      </div>
    `;
    host.appendChild(row);
  });
}

function updateTotals() {
  const totals = getTotals();
  if (document.getElementById("qSubtotal")) document.getElementById("qSubtotal").innerText = formatCurrency(Number(totals.subtotal || 0));
  if (document.getElementById("qGSTAmount")) document.getElementById("qGSTAmount").innerText = formatCurrency(Number(totals.gstAmount || 0));
  if (document.getElementById("qFinalTotal")) document.getElementById("qFinalTotal").innerText = formatCurrency(Number(totals.total || 0));
}

function renderQuotation() {
  const host = document.getElementById("quotationItems");
  if (!host) return;

  if (!quotationItems.length) {
    host.innerHTML = '<p class="empty">No items added</p>';
    renderCharges();
    updateTotals();
    renderLifecycle();
    syncQuotationData();
    return;
  }

  host.innerHTML = "";
  quotationItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "table-row";

    const safeName = escapeQuotationHtml(item.name);
    const safeSource = escapeQuotationHtml(item.source || "-");
    const safeLink = escapeQuotationHtml(item.link || "");

    row.innerHTML = `
      <span>${safeName}</span>
      <span>${formatCurrency(Number(item.price || 0))}</span>
      <span>${Number(item.qty || 0)} ${escapeQuotationHtml(item.unit || "")}</span>
      <span>${safeSource}</span>
      <span>${safeLink ? `<button type="button" class="secondary tiny-btn" onclick="window.open('${safeLink}','_blank','noopener,noreferrer')">View</button>` : "-"}</span>
      <span>${formatCurrency(Number(item.total || 0))}</span>
      <span><button type="button" class="secondary tiny-btn" onclick="deleteItem('${escapeQuotationHtml(item.id)}')">Remove</button></span>
    `;

    host.appendChild(row);
  });

  renderCharges();
  updateTotals();
  renderLifecycle();
  syncQuotationData();
  updateCurrencyUI();
}

function convertToOrder() {
  const meta = getCurrentMeta();

  if (meta.status !== "accepted") {
    showNotice("Plan must be accepted before creating order.", "warning");
    return;
  }

  if (meta.validUntil && meta.validUntil < getTodayDateKey()) {
    showNotice("Plan is expired. Update validity date before order creation.", "warning");
    return;
  }

  if (!validatePlanCore(meta)) return;

  const totals = getTotals();
  const orderId = createEntityId("order");
  const orderNo = window.DocWorkflow
    ? window.DocWorkflow.generateDocumentNumber("order")
    : createEntityId("ORD");

  const orders = JSON.parse(localStorage.getItem("orders") || "[]");
  const now = new Date().toISOString();

  const orderRow = {
    id: orderId,
    orderNo,
    quotationId: meta.id,
    quotationNo: meta.quotationNo,
    purpose: meta.purpose,
    quotationStatus: meta.status,
    status: "draft",
    statusHistory: [{ at: now, from: null, to: "draft", note: "Created from accepted purchase plan" }],
    items: quotationItems,
    charges: quotationCharges,
    subtotal: Number(totals.subtotal || 0),
    gst: Number(totals.gstAmount || 0),
    total: Number(totals.total || 0),
    plannedAmount: Number(totals.total || 0),
    sourceType: meta.fundingSourceType,
    sourceId: meta.fundingSourceId,
    sourceName: meta.fundingSourceName,
    paymentType: null,
    createdAt: now,
    updatedAt: now,
    financialPosted: false,
    financialEntryId: null,
    cancellationReason: null,
    cancelledAt: null
  };

  orders.push(orderRow);
  localStorage.setItem("orders", JSON.stringify(orders));

  meta.status = "converted";
  meta.convertedOrderId = orderId;
  addHistory(meta, "converted", `Created order ${orderNo}`);
  saveCurrentMeta(meta);
  syncQuotationData();

  if (window.DocWorkflow) {
    window.DocWorkflow.upsertRelation({
      quotationId: meta.id,
      orderId,
      relationshipStatus: "linked"
    });
  }

  localStorage.setItem("activeOrderId", JSON.stringify(orderId));

  showNotice("Purchase plan converted to order.", "success");
  window.location.href = "order.html";
}

async function clearQuotation() {
  const meta = getCurrentMeta();
  const ok = await window.AppDialog.confirm("Delete this draft purchase plan?", "Confirm Deletion");
  if (!ok) return;

  const rows = getRegistry().filter((row) => String(row.id) !== String(meta.id));
  saveRegistry(rows);

  quotationItems = [];
  quotationCharges = [];
  localStorage.removeItem(Q_META_STORAGE_KEY);
  localStorage.removeItem("quotationData");
  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");
  localStorage.removeItem(Q_ACTIVE_STORAGE_KEY);

  if (window.DocWorkflow) {
    window.DocWorkflow.upsertRelation({ quotationId: meta.id, orderId: meta.convertedOrderId || null, relationshipStatus: "archived" });
  }

  showNotice("Draft deleted.", "success");
  window.location.href = "quotations.html";
}

function initializeQuotationModule() {
  const meta = getCurrentMeta();
  if (!meta.validUntil) {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    meta.validUntil = d.toISOString().split("T")[0];
    saveCurrentMeta(meta);
  }

  const validityDate = document.getElementById("quotationValidityDate");
  if (validityDate) {
    validityDate.min = getTodayDateKey();
    validityDate.value = meta.validUntil || "";
    validityDate.addEventListener("change", updateQuotationValidityDate);
  }

  const purposeEl = document.getElementById("quotationPurpose");
  if (purposeEl) {
    purposeEl.value = meta.purpose || "";
    purposeEl.addEventListener("blur", setQuotationPurpose);
  }

  const sourceType = document.getElementById("qSourceType");
  if (sourceType) {
    sourceType.value = meta.fundingSourceType || "";
    sourceType.addEventListener("change", () => {
      loadQuotationFundingOptions();
      setQuotationFunding();
    });
  }

  const sourceValue = document.getElementById("qSourceValue");
  if (sourceValue) {
    sourceValue.addEventListener("change", () => {
      renderQuotationFundingPreview();
      setQuotationFunding();
    });
  }

  loadQuotationFundingOptions();
  renderQuotationFundingPreview();
  renderQuotation();
}

function goBack() {
  window.location.href = "quotations.html";
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
  const select = document.getElementById("mSource");
  const sources = getSources();
  if (!select) return;

  select.innerHTML = '<option value="">Source</option>';
  sources.forEach((source) => {
    const opt = document.createElement("option");
    opt.value = source;
    opt.textContent = source;
    select.appendChild(opt);
  });

  const addOpt = document.createElement("option");
  addOpt.value = "__add_new__";
  addOpt.textContent = "Add New Source";
  select.appendChild(addOpt);
}

function handleSourceChange(value) {
  const input = document.getElementById("newSourceInput");
  if (!input) return;

  if (value === "__add_new__") {
    input.style.display = "block";
    input.focus();
  } else {
    input.style.display = "none";
  }
}

function updateCurrencyUI() {
  if (typeof getCurrency !== "function") return;
  const symbol = getCurrency();
  const fixedOption = document.getElementById("fixedCurrencyOption");
  if (fixedOption) fixedOption.textContent = `Fixed ${symbol}`;
}

initializeQuotationModule();

if (typeof window !== "undefined") {
  window.goBack = goBack;
  window.setQuotationStatus = setQuotationStatus;
  window.savePurchasePlanDraft = savePurchasePlanDraft;
  window.convertToOrder = convertToOrder;
  window.clearQuotation = clearQuotation;
  window.loadQuotationFundingOptions = loadQuotationFundingOptions;
  window.renderQuotationFundingPreview = renderQuotationFundingPreview;
  window.openItemModal = openItemModal;
  window.closeItemModal = closeItemModal;
  window.addItemFromModal = addItemFromModal;
  window.openChargeModal = openChargeModal;
  window.closeChargeModal = closeChargeModal;
  window.addCharge = addCharge;
  window.openProductLink = openProductLink;
  window.handleSourceChange = handleSourceChange;
}

