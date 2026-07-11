const Q_WORKFLOW_KEYS = (window.DocWorkflow && window.DocWorkflow.keys) || {};
const Q_REGISTRY_STORAGE_KEY = Q_WORKFLOW_KEYS.quotationRegistry || "quotationRegistry";
const Q_META_STORAGE_KEY = Q_WORKFLOW_KEYS.quotationMeta || "quotationMeta";
const Q_ACTIVE_STORAGE_KEY = Q_WORKFLOW_KEYS.activeQuotation || "activeQuotationId";

let quotationItems = [];
let quotationCharges = [];
let hydratedQuotationId = null;
let showFullAuditTrail = false;

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

function getStoredMeta() {
  return JSON.parse(localStorage.getItem(Q_META_STORAGE_KEY) || "null");
}

function getStatusOrder() {
  return ["draft", "accepted", "converted"];
}

function isQuotationEditable(status) {
  return String(status || "draft") === "draft";
}

function getOrderRows() {
  return JSON.parse(localStorage.getItem("orders") || "[]");
}

function findOrderById(rows, id) {
  const key = String(id || "");
  if (!key) return null;
  return rows.find((row) => String(row && row.id) === key) || null;
}

function hasOrderCreationHistory(meta) {
  const rows = Array.isArray(meta && meta.history) ? meta.history : [];
  return rows.some((row) => {
    const action = String(row && row.action || "").toLowerCase();
    const note = String(row && row.note || "").toLowerCase();
    return action === "converted" || note.includes("created order") || note.includes("converted");
  });
}

function getQuotationLockState(metaInput) {
  const meta = metaInput || getCurrentMeta();
  const orders = getOrderRows();
  const relation = window.DocWorkflow && typeof window.DocWorkflow.getRelationByQuotationId === "function"
    ? window.DocWorkflow.getRelationByQuotationId(meta.id)
    : null;

  const linkedByQuotationId = orders.find((row) => String(row && row.quotationId || "") === String(meta.id || "")) || null;
  const linkedByConvertedId = findOrderById(orders, meta && meta.convertedOrderId);
  const linkedByRelationId = findOrderById(orders, relation && relation.orderId);

  const relationStatus = String(relation && relation.relationshipStatus || "").toLowerCase();
  const hasRelationEvidence = Boolean(relation && (String(relation.orderId || "") || relationStatus === "linked" || relationStatus === "archived"));
  const hasConvertedOrderIdEvidence = Boolean(String(meta && meta.convertedOrderId || ""));
  const hasOrderRefEvidence = Boolean(linkedByQuotationId || linkedByConvertedId || linkedByRelationId);
  const hasHistoryEvidence = hasOrderCreationHistory(meta);

  const locked = hasRelationEvidence || hasConvertedOrderIdEvidence || hasOrderRefEvidence || hasHistoryEvidence;
  const linkedOrder = linkedByQuotationId || linkedByConvertedId || linkedByRelationId || null;
  const orderId = linkedOrder && linkedOrder.id
    ? String(linkedOrder.id)
    : (String((relation && relation.orderId) || (meta && meta.convertedOrderId) || "") || null);
  const orderNo = linkedOrder && linkedOrder.orderNo ? String(linkedOrder.orderNo) : null;

  return {
    locked,
    orderId,
    orderNo,
    relationStatus: relationStatus || null
  };
}

function getExistingOrderForQuotation(meta) {
  if (!meta || !meta.id) return null;

  if (window.DocWorkflow && typeof window.DocWorkflow.findOrderForQuotation === "function") {
    return window.DocWorkflow.findOrderForQuotation(meta.id, {
      orderId: meta.convertedOrderId || null
    });
  }

  const orders = getOrderRows();
  const byQuotationId = orders.find((row) => String(row && row.quotationId || "") === String(meta.id || ""));
  if (byQuotationId) return byQuotationId;

  const convertedId = String(meta.convertedOrderId || "");
  if (convertedId) {
    return orders.find((row) => String(row && row.id || "") === convertedId) || null;
  }

  return null;
}

function isQuotationMetaEditable(meta) {
  if (!meta) return false;
  if (!isQuotationEditable(meta.status)) return false;
  return !getQuotationLockState(meta).locked;
}

function getQuotationLockMessage(lockState) {
  if (!lockState || !lockState.locked) return "Only draft plans can be edited.";
  const ref = lockState.orderNo || lockState.orderId || "a linked order";
  return `Quotation is locked because it is linked to ${ref}. Edit the order instead.`;
}

function openLockedOrderFromQuotation() {
  const meta = getCurrentMeta();
  const lockState = getQuotationLockState(meta);
  if (!lockState.orderId) {
    showNotice("Linked order reference is unavailable.", "warning");
    return;
  }
  localStorage.setItem("activeOrderId", JSON.stringify(String(lockState.orderId)));
  window.location.href = "order.html";
}

function renderQuotationLockBanner(lockState) {
  const card = document.querySelector(".card");
  if (!card) return;

  let banner = document.getElementById("quotationLockBanner");
  if (!lockState || !lockState.locked) {
    if (banner) banner.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "quotationLockBanner";
    banner.className = "lock-banner";
    card.insertBefore(banner, card.firstChild);
  }

  const orderRef = lockState.orderNo || lockState.orderId || "linked order";
  const openBtn = lockState.orderId
    ? '<button type="button" class="secondary tiny-btn" onclick="openLockedOrderFromQuotation()">Open Order</button>'
    : "";

  banner.innerHTML = `
    <div class="lock-banner-title">🔒 Quotation Locked</div>
    <div class="lock-banner-copy">This quotation is linked to Order ${escapeQuotationHtml(orderRef)}.</div>
    <div class="lock-banner-copy">To make changes, edit the Order instead.</div>
    ${openBtn}
  `;
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

function getLatestStatusFromHistory(source) {
  const rows = Array.isArray(source && source.history) ? source.history : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const status = rows[i] && rows[i].status;
    if (status) return String(status);
  }
  return null;
}

function resolveMetaStatus(row, existing) {
  const existingStatus = existing && String(existing.id || "") === String(row.id || "")
    ? String(existing.status || "")
    : "";
  const historyStatus = getLatestStatusFromHistory(existing) || getLatestStatusFromHistory(row) || "";
  return existingStatus || historyStatus || String(row.status || "draft") || "draft";
}

function hydrateQuotationLines(metaId, options = {}) {
  const force = Boolean(options.force);
  const key = String(metaId || "");
  if (!key) {
    quotationItems = [];
    quotationCharges = [];
    hydratedQuotationId = null;
    return;
  }

  if (!force && hydratedQuotationId === key) return;

  const rows = getRegistry();
  const row = rows.find((x) => String(x && x.id) === key);
  if (row) {
    quotationItems = Array.isArray(row.items) ? row.items.slice() : [];
    quotationCharges = Array.isArray(row.charges) ? row.charges.slice() : [];
    hydratedQuotationId = key;
    return;
  }

  const payload = JSON.parse(localStorage.getItem("quotationData") || "null");
  if (payload && String(payload.id || "") === key) {
    quotationItems = Array.isArray(payload.items) ? payload.items.slice() : [];
    quotationCharges = Array.isArray(payload.charges) ? payload.charges.slice() : [];
    hydratedQuotationId = key;
    return;
  }

  const storedItems = JSON.parse(localStorage.getItem("quotationItems") || "null");
  const storedCharges = JSON.parse(localStorage.getItem("quotationCharges") || "null");
  quotationItems = Array.isArray(storedItems) ? storedItems.slice() : [];
  quotationCharges = Array.isArray(storedCharges) ? storedCharges.slice() : [];
  hydratedQuotationId = key;
}

function getCurrentMeta() {
  const activeId = getActiveQuotationId();
  const registry = getRegistry();

  if (activeId) {
    const row = registry.find((x) => String(x.id) === String(activeId));
    if (row) {
      const existing = getStoredMeta();
      const rebuilt = {
        id: row.id,
        quotationNo: row.quotationNo || (existing && existing.quotationNo) || (window.DocWorkflow ? window.DocWorkflow.generateDocumentNumber("quotation") : createEntityId("QT")),
        purpose: row.purpose || (existing && existing.purpose) || "",
        status: resolveMetaStatus(row, existing),
        createdAt: row.createdAt || (existing && existing.createdAt) || new Date().toISOString(),
        updatedAt: row.updatedAt || (existing && existing.updatedAt) || new Date().toISOString(),
        validUntil: row.validUntil || (existing && existing.validUntil) || null,
        convertedOrderId: row.convertedOrderId || row.orderId || (existing && existing.convertedOrderId) || null,
        fundingSourceType: row.fundingSourceType || (existing && existing.fundingSourceType) || null,
        fundingSourceId: row.fundingSourceId || (existing && existing.fundingSourceId) || null,
        fundingSourceName: row.fundingSourceName || (existing && existing.fundingSourceName) || null,
        history: Array.isArray(row.history) ? row.history : (Array.isArray(existing && existing.history) ? existing.history : [])
      };

      saveCurrentMeta(rebuilt);
      return rebuilt;
    }
  }

  let meta = getStoredMeta();
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
  hydratedQuotationId = String(meta.id || "");
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

function getDefaultAdjustmentTypeForChargeType(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "discount") return "deduct";
  if (normalized === "gst" || normalized === "delivery") return "add";
  return null;
}

function normalizeChargeAdjustmentType(charge) {
  if (!charge || typeof charge !== "object") return null;

  const explicit = String(charge.adjustmentType || "").toLowerCase();
  if (explicit === "add" || explicit === "deduct") return explicit;

  return getDefaultAdjustmentTypeForChargeType(charge.type);
}

function getChargeBaseAmount(charge, subtotal, items) {
  if (!charge || !Array.isArray(items)) return 0;
  if (String(charge.appliesTo || "all") === "all") return subtotal;

  const target = items.find((x) => String(x.id) === String(charge.appliesTo));
  return target ? Number(target.total || 0) : 0;
}

function getChargeAmount(charge, subtotal, items) {
  const baseAmount = getChargeBaseAmount(charge, subtotal, items);
  const value = Number(charge && charge.value || 0);
  if (String(charge && charge.mode || "fixed") === "percent") {
    return (baseAmount * value) / 100;
  }
  return value;
}

function getChargeSignedAmount(charge, subtotal, items) {
  const amount = Number(getChargeAmount(charge, subtotal, items) || 0);
  const adjustmentType = normalizeChargeAdjustmentType(charge);
  if (adjustmentType === "deduct") return -amount;
  if (adjustmentType === "add") return amount;
  // Migration-safe behavior: unresolved legacy custom charges remain excluded.
  return 0;
}

function hasLegacyCustomCharges() {
  return quotationCharges.some((charge) => {
    const isCustom = String(charge && charge.type || "") === "custom";
    return isCustom && !normalizeChargeAdjustmentType(charge);
  });
}

function getTotals() {
  const subtotal = quotationItems.reduce((sum, item) => sum + Number(item.total || 0), 0);

  let gstAmount = 0;
  let chargeAdds = 0;
  let chargeDeductions = 0;
  let legacyCustomCount = 0;

  quotationCharges.forEach((charge) => {
    const amount = Number(getChargeAmount(charge, subtotal, quotationItems) || 0);
    const direction = normalizeChargeAdjustmentType(charge);

    if (direction === "add") {
      chargeAdds += amount;
      if (String(charge.type || "") === "gst") gstAmount += amount;
      return;
    }

    if (direction === "deduct") {
      chargeDeductions += amount;
      if (String(charge.type || "") === "gst") gstAmount -= amount;
      return;
    }

    if (String(charge && charge.type || "") === "custom") legacyCustomCount += 1;
  });

  const total = subtotal + chargeAdds - chargeDeductions;
  return { subtotal, gstAmount, total, chargeAdds, chargeDeductions, legacyCustomCount };
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

function syncQuotationData(metaInput) {
  const meta = metaInput || getStoredMeta() || getCurrentMeta();
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
  const lockState = getQuotationLockState(meta);
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

  const editable = isQuotationMetaEditable(meta);
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
  if (convertBtn) {
    const showConvert = String(meta.status || "draft") === "accepted" && !lockState.locked;
    convertBtn.style.display = showConvert ? "inline-flex" : "none";
  }
  if (sourceType) sourceType.disabled = !editable;
  if (sourceValue) sourceValue.disabled = !editable;
  if (validityDate) validityDate.disabled = !editable;
  if (purposeInput) purposeInput.disabled = !editable;

  statusActions.forEach((btn) => {
    if (lockState.locked) {
      btn.style.display = "none";
      btn.disabled = true;
    }
  });

  renderQuotationLockBanner(lockState);

  const audit = document.getElementById("quotationAuditTrail");
  if (audit) {
    const allRows = Array.isArray(meta.history) ? meta.history.slice() : [];
    const totalRows = allRows.length;
    if (!totalRows) {
      audit.innerHTML = "";
    } else {
      const latest = allRows[totalRows - 1];
      const latestWhen = new Date(latest.at).toLocaleString("en-IN");
      const latestStatus = escapeQuotationHtml(getStatusLabel(latest.status));
      const latestNote = latest.note ? escapeQuotationHtml(latest.note) : "";

      if (!showFullAuditTrail) {
        audit.innerHTML = `
          <div class="audit-compact">
            <div class="audit-compact-title">Recent Activity (${totalRows})</div>
            <div class="audit-compact-body">
              <small><strong>Last Action:</strong> ${latestStatus}${latestNote ? ` - ${latestNote}` : ""}</small><br>
              <small>${escapeQuotationHtml(latestWhen)}</small>
            </div>
            <button type="button" class="audit-toggle-link" onclick="toggleAuditTrailView()">View Full Activity</button>
          </div>
        `;
      } else {
        const rows = allRows.slice(-5).reverse();
        const listHtml = rows.map((row) => {
          const when = new Date(row.at).toLocaleString("en-IN");
          const note = row.note ? ` - ${escapeQuotationHtml(row.note)}` : "";
          return `<div class="audit-row"><small>${escapeQuotationHtml(when)} - ${escapeQuotationHtml(getStatusLabel(row.status))}${note}</small></div>`;
        }).join("");

        audit.innerHTML = `
          <div class="audit-compact-title">Recent Activity (${totalRows})</div>
          ${listHtml}
          <button type="button" class="audit-toggle-link" onclick="toggleAuditTrailView()">Show Latest Only</button>
        `;
      }
    }
  }
}

function toggleAuditTrailView() {
  showFullAuditTrail = !showFullAuditTrail;
  renderLifecycle();
}

function setQuotationPurpose() {
  const input = document.getElementById("quotationPurpose");
  if (!input) return;

  const meta = getCurrentMeta();
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
    return;
  }

  const purpose = String(input.value || "").trim();
  meta.purpose = purpose;
  addHistory(meta, "purpose_updated", purpose ? `Purpose set to ${purpose}` : "Purpose cleared");
  saveCurrentMeta(meta);
  syncQuotationData(meta);
  renderLifecycle();
}

function updateQuotationValidityDate() {
  const dateInput = document.getElementById("quotationValidityDate");
  if (!dateInput) return;
  const meta = getCurrentMeta();

  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
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
  syncQuotationData(meta);
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

  const totals = getTotals();
  const quotationTotal = Number(totals.total || 0);

  const selected = valueEl.options[valueEl.selectedIndex];
  if (!selected || !selected.value) {
    preview.innerHTML = `
      <div class="funding-preview">
        <small class="funding-account-label">Funding Account</small>
        <div class="funding-account-name">Select source type and account</div>
        <div class="funding-metrics">
          <small><strong>Quote:</strong> ${formatCurrency(quotationTotal)}</small>
        </div>
      </div>
    `;
    preview.classList.remove("funding-shortfall");
    return;
  }

  const available = Number(selected.dataset.remaining || 0);
  const remaining = Number((available - quotationTotal).toFixed(2));
  const hasShortfall = remaining < 0;
  const remainingLabel = hasShortfall
    ? `After Quote: -${formatCurrency(Math.abs(remaining))}`
    : `After Quote: ${formatCurrency(remaining)}`;

  preview.classList.toggle("funding-shortfall", hasShortfall);

  preview.innerHTML = `
    <div class="funding-preview">
      <small class="funding-account-label">Funding Account</small>
      <div class="funding-account-name">${escapeQuotationHtml(selected.dataset.name || selected.textContent)}</div>
      <div class="funding-metrics">
        <small><strong>Available:</strong> ${formatCurrency(available)}</small>
        <small><strong>Quote:</strong> ${formatCurrency(quotationTotal)}</small>
        <small><strong>${remainingLabel}</strong></small>
      </div>
    </div>
  `;
}

function setQuotationFunding() {
  const typeEl = document.getElementById("qSourceType");
  const valueEl = document.getElementById("qSourceValue");
  if (!typeEl || !valueEl) return;

  const meta = getCurrentMeta();
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
    return;
  }

  const selected = valueEl.options[valueEl.selectedIndex];
  meta.fundingSourceType = typeEl.value || null;
  meta.fundingSourceId = selected && selected.value ? String(selected.value) : null;
  meta.fundingSourceName = selected && selected.value ? (selected.dataset.name || selected.textContent) : null;

  addHistory(meta, "funding_updated", meta.fundingSourceName ? `Funding set to ${meta.fundingSourceType} → ${meta.fundingSourceName}` : "Funding cleared");
  saveCurrentMeta(meta);
  syncQuotationData(meta);
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

  if (hasLegacyCustomCharges()) {
    showNotice("Set Add Amount or Deduct Amount for legacy custom charges before saving.", "warning");
    return false;
  }

  return true;
}

function savePurchasePlanDraft() {
  const meta = getCurrentMeta();
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
    return;
  }

  if (!validatePlanCore(meta)) return;

  addHistory(meta, "draft_saved", "Draft saved");
  saveCurrentMeta(meta);
  syncQuotationData(meta);
  renderLifecycle();
  showNotice("Purchase plan draft saved.", "success");
}

function setQuotationStatus(nextStatus) {
  const meta = getCurrentMeta();
  const lockState = getQuotationLockState(meta);
  if (lockState.locked) {
    showNotice(getQuotationLockMessage(lockState), "warning");
    return;
  }
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
  syncQuotationData(meta);
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
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
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
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
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
  if (document.getElementById("cAdjustmentType")) document.getElementById("cAdjustmentType").value = "add";
  if (document.getElementById("cApplyTo")) document.getElementById("cApplyTo").value = "all";
}

function toggleCustomChargeField() {
  const typeEl = document.getElementById("cType");
  const customEl = document.getElementById("cCustomLabel");
  const adjustmentEl = document.getElementById("cAdjustmentType");
  if (!typeEl || !customEl || !adjustmentEl) return;

  const visible = typeEl.value === "custom";
  customEl.style.display = visible ? "block" : "none";
  adjustmentEl.style.display = visible ? "block" : "none";
  if (!visible) customEl.value = "";
  if (!visible) adjustmentEl.value = "add";
}

function addItemFromModal() {
  const meta = getCurrentMeta();
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
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
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
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
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
    closeChargeModal();
    return;
  }

  const type = String((document.getElementById("cType") || {}).value || "delivery");
  const customLabel = String((document.getElementById("cCustomLabel") || {}).value || "").trim();
  const value = Number((document.getElementById("cValue") || {}).value || 0);
  const mode = String((document.getElementById("cMode") || {}).value || "fixed");
  const appliesTo = String((document.getElementById("cApplyTo") || {}).value || "all");
  const selectedAdjustment = String((document.getElementById("cAdjustmentType") || {}).value || "add");
  const adjustmentType = type === "custom"
    ? (selectedAdjustment === "deduct" ? "deduct" : "add")
    : getDefaultAdjustmentTypeForChargeType(type);

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

  if (type === "custom" && !(adjustmentType === "add" || adjustmentType === "deduct")) {
    showNotice("Select Add Amount or Deduct Amount.", "warning");
    return;
  }

  quotationCharges.push({
    id: createEntityId("qc"),
    type,
    label: type === "custom" ? customLabel : type,
    value,
    mode,
    appliesTo,
    adjustmentType: adjustmentType || null
  });

  const directionLabel = adjustmentType === "deduct" ? "Deduct Amount" : "Add Amount";
  addHistory(meta, "charge_added", `${type.toUpperCase()} ${mode === "percent" ? `${value}%` : formatCurrency(value)} (${directionLabel})`);
  saveCurrentMeta(meta);
  closeChargeModal();
  renderQuotation();
}

function deleteCharge(id) {
  const meta = getCurrentMeta();
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
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
  const editable = isQuotationMetaEditable(getCurrentMeta());
  if (!host) return;

  host.innerHTML = "";
  if (!quotationCharges.length) {
    host.innerHTML = '<p class="empty">No charges added</p>';
    return;
  }

  host.innerHTML = `
    <div class="charge-table" role="table" aria-label="Quotation charges">
      <div class="charge-table-header" role="row">
        <span role="columnheader">Charge Name</span>
        <span role="columnheader">Value</span>
        <span role="columnheader">Applied Price</span>
        <span role="columnheader">Action</span>
      </div>
      <div id="chargeTableBody" role="rowgroup"></div>
    </div>
  `;

  const body = document.getElementById("chargeTableBody");
  if (!body) return;

  const subtotal = quotationItems.reduce((sum, item) => sum + Number(item.total || 0), 0);
  quotationCharges.forEach((charge) => {
    let serial = "";

    if (charge.appliesTo !== "all") {
      const item = quotationItems.find((x) => String(x.id) === String(charge.appliesTo));
      const index = quotationItems.findIndex((x) => String(x.id) === String(charge.appliesTo));
      serial = index !== -1 ? `(Item ${index + 1})` : "";
    }

    const amount = Number(getChargeAmount(charge, subtotal, quotationItems) || 0);
    const direction = normalizeChargeAdjustmentType(charge);
    const amountLabel = direction === "deduct"
      ? `-${formatCurrency(amount)}`
      : (direction === "add" ? `+${formatCurrency(amount)}` : `${formatCurrency(amount)} (excluded)`);
    const valueLabel = charge.mode === "percent"
      ? `${Number(charge.value || 0)}%`
      : formatCurrency(Number(charge.value || 0));

    const row = document.createElement("div");
    row.className = "charge-table-row";
    row.innerHTML = `
      <span class="charge-name">${escapeQuotationHtml(String((charge.label || charge.type || "")).toUpperCase())} ${escapeQuotationHtml(serial)}</span>
      <span class="charge-value">${escapeQuotationHtml(valueLabel)}</span>
      <span class="charge-applied">${escapeQuotationHtml(amountLabel)}</span>
      <span class="charge-action-cell">${editable
    ? `<button type="button" onclick="deleteCharge('${escapeQuotationHtml(charge.id)}')" class="delete-btn charge-row-delete" aria-label="Delete charge">✕</button>`
    : "-"}</span>
    `;
    body.appendChild(row);
  });
}

function updateTotals() {
  const totals = getTotals();
  if (document.getElementById("qSubtotal")) document.getElementById("qSubtotal").innerText = formatCurrency(Number(totals.subtotal || 0));
  if (document.getElementById("qGSTAmount")) document.getElementById("qGSTAmount").innerText = formatCurrency(Number(totals.gstAmount || 0));
  if (document.getElementById("qFinalTotal")) document.getElementById("qFinalTotal").innerText = formatCurrency(Number(totals.total || 0));
  renderQuotationFundingPreview();
}

function renderQuotation() {
  const meta = getCurrentMeta();
  const editable = isQuotationMetaEditable(meta);
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
    const hasSource = safeSource !== "-";
    const hasLink = Boolean(safeLink);
    const itemMetaHtml = hasSource || hasLink
      ? `<small class="item-inline-meta">${hasSource ? `Source: ${safeSource}` : ""}${hasSource && hasLink ? " | " : ""}${hasLink ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">Link</a>` : ""}</small>`
      : "";

    row.innerHTML = `
      <span>${safeName}${itemMetaHtml}</span>
      <span>${formatCurrency(Number(item.price || 0))}</span>
      <span>${Number(item.qty || 0)} ${escapeQuotationHtml(item.unit || "")}</span>
      <span>${formatCurrency(Number(item.total || 0))}</span>
      <span><button type="button" class="secondary tiny-btn" onclick="deleteItem('${escapeQuotationHtml(item.id)}')" ${editable ? "" : "disabled"}>Remove</button></span>
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
  const existingOrder = getExistingOrderForQuotation(meta);
  const lockState = getQuotationLockState(meta);

  if (existingOrder && existingOrder.id) {
    localStorage.setItem("activeOrderId", JSON.stringify(String(existingOrder.id)));
    showNotice("Order already exists for this quotation. Opening linked order.", "info");
    window.location.href = "order.html";
    return;
  }

  if (lockState.locked) {
    if (lockState.orderId) {
      localStorage.setItem("activeOrderId", JSON.stringify(String(lockState.orderId)));
      showNotice("Order already exists for this quotation. Opening linked order.", "info");
      window.location.href = "order.html";
      return;
    }

    showNotice("Quotation is locked with order history. Duplicate order creation is blocked.", "warning");
    return;
  }

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
  const duplicateByQuotation = orders.find((row) => String(row && row.quotationId || "") === String(meta.id || ""));
  if (duplicateByQuotation && duplicateByQuotation.id) {
    localStorage.setItem("activeOrderId", JSON.stringify(String(duplicateByQuotation.id)));
    showNotice("Order already exists for this quotation. Opening linked order.", "info");
    window.location.href = "order.html";
    return;
  }

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
  syncQuotationData(meta);

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
  if (!isQuotationMetaEditable(meta)) {
    showNotice(getQuotationLockMessage(getQuotationLockState(meta)), "warning");
    return;
  }
  const ok = await window.AppDialog.confirm("Delete this draft purchase plan?", "Confirm Deletion");
  if (!ok) return;

  const rows = getRegistry().filter((row) => String(row.id) !== String(meta.id));
  saveRegistry(rows);

  quotationItems = [];
  quotationCharges = [];
  hydratedQuotationId = null;
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

function installQuotationAccordionBehavior() {
  const accordions = Array.from(document.querySelectorAll("details.secondary-accordion"));
  accordions.forEach((details) => {
    const summary = details.querySelector("summary");
    if (!summary) return;
    if (summary.dataset.accordionBound === "true") return;
    summary.dataset.accordionBound = "true";

    const toggle = () => {
      if (details.hasAttribute("open")) details.removeAttribute("open");
      else details.setAttribute("open", "");
    };

    summary.addEventListener("click", (event) => {
      event.preventDefault();
      toggle();
    });

    summary.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggle();
      }
    });
  });
}

function initializeQuotationModule() {
  installQuotationAccordionBehavior();

  const meta = getCurrentMeta();
  hydrateQuotationLines(meta.id, { force: true });
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
  window.openLockedOrderFromQuotation = openLockedOrderFromQuotation;
  window.clearQuotation = clearQuotation;
  window.loadQuotationFundingOptions = loadQuotationFundingOptions;
  window.renderQuotationFundingPreview = renderQuotationFundingPreview;
  window.toggleAuditTrailView = toggleAuditTrailView;
  window.openItemModal = openItemModal;
  window.closeItemModal = closeItemModal;
  window.addItemFromModal = addItemFromModal;
  window.openChargeModal = openChargeModal;
  window.closeChargeModal = closeChargeModal;
  window.addCharge = addCharge;
  window.openProductLink = openProductLink;
  window.handleSourceChange = handleSourceChange;
}

