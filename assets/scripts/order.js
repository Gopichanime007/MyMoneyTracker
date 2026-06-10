function createOrderId() {
  return `order_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function escapeOrderHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showOrderNotice(message, variant) {
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

function getQuotationData() {
  return JSON.parse(localStorage.getItem("quotationData") || "null") || null;
}

function getOrders() {
  return JSON.parse(localStorage.getItem("orders") || "[]");
}

function saveOrders(rows) {
  localStorage.setItem("orders", JSON.stringify(Array.isArray(rows) ? rows : []));
}

function getOrderStatusLabel(status) {
  const map = {
    draft: "Draft",
    confirmed: "Confirmed",
    processing: "Processing",
    completed: "Completed",
    cancelled: "Cancelled"
  };
  return map[status] || "Draft";
}

function getAllowedOrderTransitions(status) {
  const map = {
    draft: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["completed", "cancelled"],
    open: ["completed", "cancelled"],
    completed: [],
    cancelled: []
  };
  return map[String(status || "draft")] || [];
}

function getOrderWorkflowSteps() {
  return ["draft", "confirmed", "processing", "completed"];
}

function isOrderDraft(order) {
  return String(order && order.status || "draft") === "draft";
}

function getChargeDefaultDirection(type) {
  const normalized = String(type || "").toLowerCase();
  if (normalized === "discount") return "deduct";
  if (normalized === "gst" || normalized === "delivery") return "add";
  return "add";
}

function getOrderChargeDirection(charge) {
  const explicit = String(charge && charge.adjustmentType || "").toLowerCase();
  if (explicit === "add" || explicit === "deduct") return explicit;
  return getChargeDefaultDirection(charge && charge.type);
}

function getOrderChargeBaseAmount(charge, subtotal, items) {
  if (!charge) return 0;
  if (String(charge.appliesTo || "all") === "all") return Number(subtotal || 0);
  const target = Array.isArray(items)
    ? items.find((row) => String(row.id || "") === String(charge.appliesTo || ""))
    : null;
  return Number(target && target.total || 0);
}

function getOrderChargeAmount(charge, subtotal, items) {
  const base = getOrderChargeBaseAmount(charge, subtotal, items);
  const value = Number(charge && charge.value || 0);
  if (String(charge && charge.mode || "fixed") === "percent") {
    return (base * value) / 100;
  }
  return value;
}

function getOrderChargeSignedAmount(charge, subtotal, items) {
  const amount = Number(getOrderChargeAmount(charge, subtotal, items) || 0);
  const direction = getOrderChargeDirection(charge);
  return direction === "deduct" ? -amount : amount;
}

function recalculateOrderTotals(order) {
  const next = { ...order };
  const items = Array.isArray(next.items) ? next.items.map((row) => {
    const price = Number(row && row.price || 0);
    const qty = Number(row && row.qty || 0);
    return {
      ...row,
      price,
      qty,
      total: Number((price * qty).toFixed(2))
    };
  }) : [];

  const subtotal = items.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const charges = Array.isArray(next.charges) ? next.charges.slice() : [];
  let gst = 0;
  const chargesTotal = charges.reduce((sum, charge) => {
    const signed = getOrderChargeSignedAmount(charge, subtotal, items);
    const amount = Number(getOrderChargeAmount(charge, subtotal, items) || 0);
    if (String(charge && charge.type || "") === "gst") {
      gst += getOrderChargeDirection(charge) === "deduct" ? -amount : amount;
    }
    return sum + signed;
  }, 0);

  next.items = items;
  next.charges = charges;
  next.subtotal = Number(subtotal.toFixed(2));
  next.gst = Number(gst.toFixed(2));
  next.total = Number((subtotal + chargesTotal).toFixed(2));
  return next;
}

function upsertOrder(updated) {
  const rows = getOrders();
  const idx = rows.findIndex((row) => String(row.id) === String(updated.id));
  if (idx === -1) return false;
  rows[idx] = updated;
  saveOrders(rows);
  return true;
}

function recordOrderAudit(order, note) {
  if (!order || !note) return;
  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({
    at: new Date().toISOString(),
    from: String(order.status || "draft"),
    to: String(order.status || "draft"),
    note: String(note)
  });
}

function saveDraftOrderChanges(order, note) {
  if (!order || !isOrderDraft(order)) return false;
  const next = recalculateOrderTotals(order);
  next.updatedAt = new Date().toISOString();
  if (note) recordOrderAudit(next, note);
  const ok = upsertOrder(next);
  if (ok) {
    setActiveOrderId(next.id);
  }
  return ok;
}

function getActiveOrderId() {
  try {
    return JSON.parse(localStorage.getItem("activeOrderId") || "null");
  } catch (_err) {
    return null;
  }
}

function setActiveOrderId(id) {
  localStorage.setItem("activeOrderId", JSON.stringify(id || null));
}

function ensureActiveOrder() {
  const quote = getQuotationData();
  let activeOrderId = getActiveOrderId();
  let orders = getOrders();

  let existing = activeOrderId ? orders.find(o => String(o.id) === String(activeOrderId)) : null;
  if (existing) return existing;

  if (quote && Array.isArray(quote.items) && quote.items.length) {
    const preferredOrderId = quote.orderId || quote.convertedOrderId || null;
    if (window.DocWorkflow && typeof window.DocWorkflow.findOrderForQuotation === "function") {
      const workflowOrder = window.DocWorkflow.findOrderForQuotation(quote.id, { orderId: preferredOrderId });
      if (workflowOrder) {
        setActiveOrderId(workflowOrder.id);
        return workflowOrder;
      }
    }

    const byQuotationId = orders.find(o => String(o.quotationId || "") === String(quote.id || ""));
    if (byQuotationId) {
      setActiveOrderId(byQuotationId.id);
      return byQuotationId;
    }

    if (preferredOrderId) {
      const quotedOrder = orders.find(o => String(o.id) === String(preferredOrderId));
      if (quotedOrder) {
        setActiveOrderId(quotedOrder.id);
        return quotedOrder;
      }
    }

    const relation = window.DocWorkflow && typeof window.DocWorkflow.getRelationByQuotationId === "function"
      ? window.DocWorkflow.getRelationByQuotationId(quote.id)
      : null;
    const relationStatus = String(relation && relation.relationshipStatus || "").toLowerCase();
    const hasOrderEvidence = Boolean(
      preferredOrderId
      || (relation && (relation.orderId || relationStatus === "linked" || relationStatus === "archived"))
    );

    // If any linkage evidence exists but the row is unavailable, never create a second order implicitly.
    if (hasOrderEvidence) {
      return null;
    }

    const orderId = createOrderId();
    const orderNo = quote.orderNo || orderId;
    const now = new Date().toISOString();

    existing = {
      id: orderId,
      quotationId: quote.id || null,
      quotationNo: quote.quotationNo || null,
      quotationStatus: quote.status || null,
      orderNo,
      status: "draft",
      statusHistory: [
        { at: now, from: null, to: "draft", note: "Created from quotation" }
      ],
      items: quote.items || [],
      charges: quote.charges || [],
      subtotal: Number(quote.subtotal || 0),
      gst: Number(quote.gstAmount || 0),
      total: Number(quote.total || 0),
      sourceId: quote.fundingSourceId || null,
      sourceName: quote.fundingSourceName || null,
      sourceType: quote.fundingSourceType || null,
      purpose: quote.purpose || null,
      plannedAmount: Number(quote.total || 0),
      paymentType: null,
      createdAt: now,
      updatedAt: now,
      financialPosted: false,
      financialEntryId: null,
      cancellationReason: null,
      cancelledAt: null
    };

    orders.push(existing);
    saveOrders(orders);
    setActiveOrderId(orderId);
    return existing;
  }

  return null;
}

function getSavingsSourceSummaries() {
  const rows = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
  const accountRoots = rows.filter(row => {
    if (!row || row.sourceId) return false;
    const amount = Number(row.amount || 0);
    return amount > 0;
  });

  const uniqueRoots = [];
  const seen = new Set();
  accountRoots.forEach(row => {
    const id = String(row.id || "");
    if (!id || seen.has(id)) return;
    seen.add(id);
    uniqueRoots.push(row);
  });

  return uniqueRoots.map(root => {
    const rootId = String(root.id);
    const linked = rows.filter(t => String(t.id) === rootId || String(t.sourceId || "") === rootId);
    const total = linked
      .filter(t => Number(t.amount || 0) > 0)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const used = linked
      .filter(t => Number(t.amount || 0) < 0)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    const remaining = linked.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const name = root.note || root.entity || "Savings";

    return {
      id: rootId,
      type: "savings",
      name,
      total,
      used,
      remaining,
      isActive: remaining > 0
    };
  });
}

function getBudgetSourceSummaries() {
  const rows = JSON.parse(localStorage.getItem("budgets") || "[]");
  const grouped = new Map();

  rows.forEach(row => {
    const id = String(row && (row.budgetId || row.id) || "");
    if (!id) return;

    if (!grouped.has(id)) {
      grouped.set(id, {
        id,
        type: "budget",
        name: row.name || row.note || row.entity || "Budget",
        totalAllocated: 0
      });
    }
    const acc = grouped.get(id);
    acc.totalAllocated += Number(row.totalAllocated || row.amount || 0);
  });

  return Array.from(grouped.values()).map(group => {
    const spent = typeof getNetSpentForBudget === "function"
      ? Math.max(0, Number(getNetSpentForBudget(group.id) || 0))
      : 0;
    const remaining = group.totalAllocated - spent;
    return {
      id: group.id,
      type: "budget",
      name: group.name,
      total: group.totalAllocated,
      used: spent,
      remaining,
      isActive: remaining > 0
    };
  });
}

function getSourceSummaryById(sourceId, type) {
  const id = String(sourceId || "");
  if (!id) return null;

  const list = type === "savings" ? getSavingsSourceSummaries() : getBudgetSourceSummaries();
  return list.find(x => String(x.id) === id) || null;
}

function updateOrderStatusUI(order) {
  const statusEl = document.getElementById("orderStatusLabel");
  const idEl = document.getElementById("orderIdLabel");
  const noEl = document.getElementById("orderNoLabel");
  const createdEl = document.getElementById("orderCreatedLabel");
  const totalEl = document.getElementById("orderTotalAmount");
  const quoteEl = document.getElementById("orderQuotationLabel");
  const purposeEl = document.getElementById("orderPurposeLabel");
  const sourceEl = document.getElementById("orderSourceLabel");
  const purposeInput = document.getElementById("oPurposeInput");
  const sourceTypeSelect = document.getElementById("oSourceType");
  const sourceValueSelect = document.getElementById("oSourceValue");
  const addItemBtn = document.getElementById("addOrderItemBtn");
  const addChargeBtn = document.getElementById("addOrderChargeBtn");
  const fundingAmountEl = document.getElementById("orderFundingAmountLabel");
  const quotedAmountEl = document.getElementById("orderQuotedAmountLabel");
  const orderAmountEl = document.getElementById("orderOrderAmountLabel");
  const varianceEl = document.getElementById("orderVarianceLabel");

  if (statusEl) {
    statusEl.textContent = getOrderStatusLabel(order && order.status);
    statusEl.className = `status-pill status-${order && order.status ? order.status : "draft"}`;
  }
  if (idEl) idEl.textContent = order && order.id ? order.id : "-";
  if (noEl) noEl.textContent = order && order.orderNo ? order.orderNo : "-";
  if (createdEl) {
    createdEl.textContent = order && order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "-";
  }
  if (totalEl) {
    totalEl.textContent = order ? formatCurrency(Number(order.total || 0)) : formatCurrency(0);
  }
  if (quoteEl) {
    quoteEl.textContent = order && (order.quotationNo || order.quotationId) ? String(order.quotationNo || order.quotationId) : "-";
  }
  if (purposeEl) {
    purposeEl.textContent = order && order.purpose ? String(order.purpose) : "-";
  }
  if (sourceEl) {
    sourceEl.textContent = order && order.sourceName
        ? `${order.sourceType || "-"} → ${order.sourceName}`
      : "Not selected";
  }

  const quotedAmount = Number(order && (order.plannedAmount != null ? order.plannedAmount : order.total) || 0);
  const orderAmount = Number(order && order.total || 0);
  const variance = Number((orderAmount - quotedAmount).toFixed(2));
  const varianceLabel = variance > 0
    ? `+${formatCurrency(variance)}`
    : (variance < 0 ? `-${formatCurrency(Math.abs(variance))}` : formatCurrency(0));

  let fundingAmount = null;
  if (order && order.sourceId && order.sourceType) {
    const summary = getLedgerSummary(order.sourceId, order.sourceType);
    if (summary) fundingAmount = Number(summary.total || 0);
  }

  if (fundingAmountEl) fundingAmountEl.textContent = fundingAmount == null ? "-" : formatCurrency(fundingAmount);
  if (quotedAmountEl) quotedAmountEl.textContent = formatCurrency(quotedAmount);
  if (orderAmountEl) orderAmountEl.textContent = formatCurrency(orderAmount);
  if (varianceEl) varianceEl.textContent = varianceLabel;

  const steps = Array.from(document.querySelectorAll("[data-order-step]"));
  const orderSteps = getOrderWorkflowSteps();
  let activeIndex = orderSteps.indexOf(String(order && order.status ? order.status : "draft"));
  if (activeIndex < 0) activeIndex = 0;
  steps.forEach(step => {
    const stepStatus = String(step.getAttribute("data-order-step") || "");
    const idx = orderSteps.indexOf(stepStatus);
    step.classList.toggle("active", idx !== -1 && idx <= activeIndex);
    step.classList.toggle("current", stepStatus === String(order && order.status ? order.status : "draft"));
  });

  const actionButtons = Array.from(document.querySelectorAll("[data-order-action]"));
  const allowedActions = order ? getAllowedOrderTransitions(order.status) : [];
  actionButtons.forEach(btn => {
    const action = String(btn.getAttribute("data-order-action") || "");
    btn.disabled = !allowedActions.includes(action);
  });

  const editable = isOrderDraft(order);
  if (purposeInput) {
    purposeInput.value = order && order.purpose ? String(order.purpose) : "";
    purposeInput.disabled = !editable;
  }
  if (sourceTypeSelect) {
    sourceTypeSelect.value = order && order.sourceType ? String(order.sourceType) : "";
    sourceTypeSelect.disabled = !editable;
  }
  if (sourceValueSelect) sourceValueSelect.disabled = !editable;
  if (addItemBtn) addItemBtn.disabled = !editable;
  if (addChargeBtn) addChargeBtn.disabled = !editable;

  const audit = document.getElementById("orderAuditTrail");
  if (audit) {
    const rows = (order && Array.isArray(order.statusHistory) ? order.statusHistory : []).slice(-4).reverse();
    if (!rows.length) {
      audit.innerHTML = "";
    } else {
      audit.innerHTML = rows.map(x => {
        const at = new Date(x.at).toLocaleString("en-IN");
        const note = x.note ? ` - ${escapeOrderHtml(x.note)}` : "";
        return `<div class="audit-row"><small>${escapeOrderHtml(at)} - ${escapeOrderHtml(getOrderStatusLabel(x.to))}${note}</small></div>`;
      }).join("");
    }
  }
}

function renderOrder() {
  const order = ensureActiveOrder();
  const container = document.getElementById("orderItems");
  const chargesHost = document.getElementById("orderChargesList");

  if (!container) return;
  if (!order) {
    container.innerHTML = `<p class="empty">No order data found</p>`;
    if (chargesHost) chargesHost.innerHTML = `<p class="empty">No charges</p>`;
    updateTotals(0, 0, 0);
    updateOrderStatusUI(null);
    return;
  }

  const hydrated = recalculateOrderTotals(order);
  upsertOrder(hydrated);

  container.innerHTML = "";
  const editable = isOrderDraft(hydrated);
  const items = Array.isArray(hydrated.items) ? hydrated.items : [];

  if (!items.length) {
    container.innerHTML = `<p class="empty">No items added</p>`;
  }

  items.forEach(i => {
    let div = document.createElement("div");
    div.className = "table-row";

    const safeName = escapeOrderHtml(i.name);
    const safeSource = escapeOrderHtml(i.source || "-");
    const safeLink = escapeOrderHtml(i.link || "");
    const itemId = escapeOrderHtml(i.id);

    if (editable) {
      div.innerHTML = `
        <span><input class="inline-input" value="${safeName}" onchange="updateOrderItemField('${itemId}', 'name', this.value)"></span>
        <span><input class="inline-input" type="number" value="${Number(i.price || 0)}" onchange="updateOrderItemField('${itemId}', 'price', this.value)"></span>
        <span><input class="inline-input" type="number" step="0.01" value="${Number(i.qty || 0)}" onchange="updateOrderItemField('${itemId}', 'qty', this.value)"></span>
        <span><input class="inline-input" value="${safeSource === "-" ? "" : safeSource}" onchange="updateOrderItemField('${itemId}', 'source', this.value)"></span>
        <span><input class="inline-input" value="${safeLink}" onchange="updateOrderItemField('${itemId}', 'link', this.value)"></span>
        <span>${formatCurrency(Number(i.total || 0))}</span>
        <span><button type="button" class="secondary tiny-btn" onclick="removeOrderItem('${itemId}')">Remove</button></span>
      `;
      container.appendChild(div);
      return;
    }

    div.innerHTML = `
      <span>${safeName}</span>
      <span>${formatCurrency(Number(i.price || 0))}</span>
      <span>${Number(i.qty || 0)}</span>
      <span>${safeSource}</span>
      <span>${safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">🔗</a>` : "-"}</span>
      <span>${formatCurrency(Number(i.total || 0))}</span>
      <span>-</span>
    `;

    container.appendChild(div);
  });

  if (chargesHost) {
    const charges = Array.isArray(hydrated.charges) ? hydrated.charges : [];
    if (!charges.length) {
      chargesHost.innerHTML = '<p class="empty">No charges added</p>';
    } else {
      chargesHost.innerHTML = charges.map((charge) => {
        const chargeId = escapeOrderHtml(charge.id);
        const type = String(charge.type || "delivery");
        const label = escapeOrderHtml(String(charge.label || type));
        const mode = String(charge.mode || "fixed");
        const direction = getOrderChargeDirection(charge);
        const value = Number(charge.value || 0);
        const amount = Number(getOrderChargeAmount(charge, Number(hydrated.subtotal || 0), items) || 0);
        const amountLabel = direction === "deduct" ? `-${formatCurrency(amount)}` : `+${formatCurrency(amount)}`;

        if (editable) {
          return `
            <div class="charge-editor-row">
              <input class="inline-input" value="${label}" onchange="updateOrderChargeField('${chargeId}', 'label', this.value)">
              <input class="inline-input" type="number" value="${value}" onchange="updateOrderChargeField('${chargeId}', 'value', this.value)">
              <select class="inline-input" onchange="updateOrderChargeField('${chargeId}', 'mode', this.value)">
                <option value="fixed" ${mode === "fixed" ? "selected" : ""}>Fixed</option>
                <option value="percent" ${mode === "percent" ? "selected" : ""}>%</option>
              </select>
              <select class="inline-input" onchange="updateOrderChargeField('${chargeId}', 'adjustmentType', this.value)">
                <option value="add" ${direction === "add" ? "selected" : ""}>Add</option>
                <option value="deduct" ${direction === "deduct" ? "selected" : ""}>Deduct</option>
              </select>
              <span>${amountLabel}</span>
              <button type="button" class="secondary tiny-btn" onclick="removeOrderCharge('${chargeId}')">Remove</button>
            </div>
          `;
        }

        return `
          <div class="charge-editor-row readonly">
            <span>${label}</span>
            <span>${mode === "percent" ? `${value}%` : formatCurrency(value)}</span>
            <span>${amountLabel}</span>
          </div>
        `;
      }).join("");
    }
  }

  updateTotals(Number(hydrated.subtotal || 0), Number(hydrated.gst || 0), Number(hydrated.total || 0));
  updateOrderStatusUI(hydrated);
  loadOrderFundingOptions();

  const paymentEl = document.getElementById("oPaymentType");
  const isDraft = String(hydrated.status || "draft") === "draft";

  renderSourcePreview();

  if (paymentEl && hydrated.paymentType) {
    paymentEl.value = hydrated.paymentType;
  }

  if (paymentEl) paymentEl.disabled = !isDraft;
}

function updateOrderItemField(itemId, field, value) {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) return;

  const items = Array.isArray(order.items) ? order.items.slice() : [];
  const idx = items.findIndex((row) => String(row.id || "") === String(itemId || ""));
  if (idx === -1) return;

  const row = { ...items[idx] };
  if (field === "price" || field === "qty") {
    row[field] = Number(value || 0);
  } else {
    row[field] = String(value || "").trim();
  }

  items[idx] = row;
  const next = { ...order, items };
  let note = `Item updated: ${row.name || row.id}`;
  if (field === "qty") note = `Quantity changed: ${row.name || row.id} -> ${row.qty}`;
  if (field === "price") note = `Price changed: ${row.name || row.id} -> ${formatCurrency(Number(row.price || 0))}`;
  saveDraftOrderChanges(next, note);
  renderOrder();
}

function removeOrderItem(itemId) {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) return;

  const items = Array.isArray(order.items) ? order.items.slice() : [];
  const row = items.find((it) => String(it.id || "") === String(itemId || ""));
  const nextItems = items.filter((it) => String(it.id || "") !== String(itemId || ""));
  const nextCharges = Array.isArray(order.charges)
    ? order.charges.filter((charge) => String(charge.appliesTo || "all") !== String(itemId || ""))
    : [];

  const next = { ...order, items: nextItems, charges: nextCharges };
  saveDraftOrderChanges(next, `Item removed: ${row ? row.name : itemId}`);
  renderOrder();
}

function updateOrderChargeField(chargeId, field, value) {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) return;

  const charges = Array.isArray(order.charges) ? order.charges.slice() : [];
  const idx = charges.findIndex((row) => String(row.id || "") === String(chargeId || ""));
  if (idx === -1) return;

  const charge = { ...charges[idx] };
  if (field === "value") {
    charge.value = Number(value || 0);
  } else {
    charge[field] = String(value || "").trim();
  }

  charges[idx] = charge;
  const next = { ...order, charges };
  let note = `Charge updated: ${charge.label || charge.type || charge.id}`;
  if (field === "value") note = `Charge value changed: ${charge.label || charge.type || charge.id} -> ${Number(charge.value || 0)}`;
  if (field === "adjustmentType") note = `Charge direction changed: ${charge.label || charge.type || charge.id} -> ${charge.adjustmentType}`;
  if (field === "mode") note = `Charge mode changed: ${charge.label || charge.type || charge.id} -> ${charge.mode}`;
  saveDraftOrderChanges(next, note);
  renderOrder();
}

function removeOrderCharge(chargeId) {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) return;

  const charges = Array.isArray(order.charges) ? order.charges.slice() : [];
  const row = charges.find((charge) => String(charge.id || "") === String(chargeId || ""));
  const next = {
    ...order,
    charges: charges.filter((charge) => String(charge.id || "") !== String(chargeId || ""))
  };
  saveDraftOrderChanges(next, `Charge removed: ${row ? row.label || row.type : chargeId}`);
  renderOrder();
}

function updateTotals(subtotal, gst, total) {
  if (document.getElementById("oSubtotal")) document.getElementById("oSubtotal").innerText = formatCurrency(subtotal);
  if (document.getElementById("oGSTAmount")) document.getElementById("oGSTAmount").innerText = formatCurrency(gst);
  if (document.getElementById("oFinalTotal")) document.getElementById("oFinalTotal").innerText = formatCurrency(total);
}

function renderSourcePreview() {
  if (!document.getElementById) return;

  let preview = document.getElementById("sourcePreview");
  if (!preview) return;

  const order = ensureActiveOrder();
  if (!order || !order.sourceId || !order.sourceType) {
    preview.innerHTML = "Funding source not set.";
    return;
  }

  let sourceId = String(order.sourceId);
  let type = order.sourceType;

  let summary = getLedgerSummary(sourceId, type);
  if (!summary) {
    preview.innerHTML = "Funding source data unavailable";
    return;
  }

  const orderAmount = Number(order.total || 0);
  const available = Number(summary.remaining || 0);
  const shortfall = Number((orderAmount - available).toFixed(2));
  const hasShortfall = shortfall > 0;

  preview.innerHTML = `
    <strong>${escapeOrderHtml(summary.name)}</strong><br>
    <small><strong>Available:</strong> ${formatCurrency(available)}</small><br>
    <small><strong>Order Amount:</strong> ${formatCurrency(orderAmount)}</small><br>
    <small><strong>${hasShortfall ? "Shortfall" : "After Confirmation"}:</strong> ${hasShortfall ? `-${formatCurrency(shortfall)}` : formatCurrency(available - orderAmount)}</small>
    ${hasShortfall ? '<br><small style="color:#b91c1c;"><strong>Warning:</strong> Insufficient funding for confirmation.</small>' : ""}
  `;

  const sourceLabel = document.getElementById("orderSourceLabel");
  if (sourceLabel) {
    sourceLabel.textContent = `${summary.name} (${type || "-"})`;
  }
}

function loadOrderFundingOptions() {
  const order = ensureActiveOrder();
  const sourceTypeEl = document.getElementById("oSourceType");
  const sourceValueEl = document.getElementById("oSourceValue");
  if (!sourceTypeEl || !sourceValueEl) return;

  const selectedType = String(sourceTypeEl.value || "");
  sourceValueEl.innerHTML = '<option value="">Select funding account</option>';
  if (!selectedType) return;

  const list = selectedType === "savings" ? getSavingsSourceSummaries() : getBudgetSourceSummaries();
  list.forEach((row) => {
    const option = document.createElement("option");
    option.value = String(row.id);
    option.textContent = `${row.name} (${formatCurrency(Number(row.remaining || 0))})`;
    option.dataset.name = String(row.name || "");
    sourceValueEl.appendChild(option);
  });

  if (order && order.sourceType === selectedType && order.sourceId) {
    sourceValueEl.value = String(order.sourceId);
  }
}

function updateOrderPurpose() {
  const order = ensureActiveOrder();
  const input = document.getElementById("oPurposeInput");
  if (!order || !input || !isOrderDraft(order)) return;

  const next = { ...order, purpose: String(input.value || "").trim() };
  saveDraftOrderChanges(next, next.purpose ? `Purpose changed: ${next.purpose}` : "Purpose cleared");
  renderOrder();
}

function updateOrderFunding() {
  const order = ensureActiveOrder();
  const sourceTypeEl = document.getElementById("oSourceType");
  const sourceValueEl = document.getElementById("oSourceValue");
  if (!order || !sourceTypeEl || !sourceValueEl || !isOrderDraft(order)) return;

  const selectedType = String(sourceTypeEl.value || "");
  const selectedOption = sourceValueEl.options[sourceValueEl.selectedIndex];
  const selectedId = selectedOption && selectedOption.value ? String(selectedOption.value) : null;
  const selectedName = selectedOption && selectedOption.value ? String(selectedOption.dataset.name || selectedOption.textContent || "") : null;

  const next = {
    ...order,
    sourceType: selectedType || null,
    sourceId: selectedId,
    sourceName: selectedName
  };

  saveDraftOrderChanges(next, next.sourceName ? `Funding changed: ${next.sourceType} -> ${next.sourceName}` : "Funding cleared");
  renderOrder();
}

function openOrderItemModal() {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) {
    showOrderNotice("Only draft orders can be edited.", "warning");
    return;
  }
  const modal = document.getElementById("orderItemModal");
  if (modal) modal.style.display = "flex";
}

function closeOrderItemModal() {
  const modal = document.getElementById("orderItemModal");
  if (modal) modal.style.display = "none";
  if (document.getElementById("oiName")) document.getElementById("oiName").value = "";
  if (document.getElementById("oiPrice")) document.getElementById("oiPrice").value = "";
  if (document.getElementById("oiQty")) document.getElementById("oiQty").value = "";
  if (document.getElementById("oiSource")) document.getElementById("oiSource").value = "";
  if (document.getElementById("oiLink")) document.getElementById("oiLink").value = "";
}

function addOrderItem() {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) {
    showOrderNotice("Only draft orders can be edited.", "warning");
    return;
  }

  const name = String((document.getElementById("oiName") || {}).value || "").trim();
  const price = Number((document.getElementById("oiPrice") || {}).value || 0);
  const qty = Number((document.getElementById("oiQty") || {}).value || 0);
  const source = String((document.getElementById("oiSource") || {}).value || "").trim();
  const link = String((document.getElementById("oiLink") || {}).value || "").trim();

  if (!name) {
    showOrderNotice("Item name is required.", "warning");
    return;
  }
  if (!(price > 0) || !(qty > 0)) {
    showOrderNotice("Price and quantity must be greater than zero.", "warning");
    return;
  }

  const next = {
    ...order,
    items: [
      ...(Array.isArray(order.items) ? order.items : []),
      {
        id: createOrderId(),
        name,
        price,
        qty,
        source: source || "Unspecified",
        link,
        unit: "pcs",
        total: Number((price * qty).toFixed(2))
      }
    ]
  };

  saveDraftOrderChanges(next, `Item added: ${name} x${qty}`);
  closeOrderItemModal();
  renderOrder();
}

function openOrderChargeModal() {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) {
    showOrderNotice("Only draft orders can be edited.", "warning");
    return;
  }

  const modal = document.getElementById("orderChargeModal");
  if (modal) modal.style.display = "flex";

  const applyTo = document.getElementById("ocApplyTo");
  if (applyTo) {
    applyTo.innerHTML = '<option value="all">All Items</option>';
    (order.items || []).forEach((item) => {
      const opt = document.createElement("option");
      opt.value = String(item.id);
      opt.textContent = String(item.name || item.id);
      applyTo.appendChild(opt);
    });
  }
}

function closeOrderChargeModal() {
  const modal = document.getElementById("orderChargeModal");
  if (modal) modal.style.display = "none";
  if (document.getElementById("ocType")) document.getElementById("ocType").value = "delivery";
  if (document.getElementById("ocLabel")) document.getElementById("ocLabel").value = "";
  if (document.getElementById("ocAdjustmentType")) document.getElementById("ocAdjustmentType").value = "add";
  if (document.getElementById("ocValue")) document.getElementById("ocValue").value = "";
  if (document.getElementById("ocMode")) document.getElementById("ocMode").value = "fixed";
  if (document.getElementById("ocApplyTo")) document.getElementById("ocApplyTo").value = "all";
}

function addOrderCharge() {
  const order = ensureActiveOrder();
  if (!order || !isOrderDraft(order)) {
    showOrderNotice("Only draft orders can be edited.", "warning");
    return;
  }

  const type = String((document.getElementById("ocType") || {}).value || "delivery");
  const labelInput = String((document.getElementById("ocLabel") || {}).value || "").trim();
  const adjustmentType = String((document.getElementById("ocAdjustmentType") || {}).value || getChargeDefaultDirection(type));
  const value = Number((document.getElementById("ocValue") || {}).value || 0);
  const mode = String((document.getElementById("ocMode") || {}).value || "fixed");
  const appliesTo = String((document.getElementById("ocApplyTo") || {}).value || "all");

  if (!(value > 0)) {
    showOrderNotice("Charge value must be greater than zero.", "warning");
    return;
  }

  const next = {
    ...order,
    charges: [
      ...(Array.isArray(order.charges) ? order.charges : []),
      {
        id: createOrderId(),
        type,
        label: type === "custom" ? (labelInput || "Custom") : (labelInput || type),
        adjustmentType: adjustmentType === "deduct" ? "deduct" : "add",
        value,
        mode,
        appliesTo
      }
    ]
  };

  saveDraftOrderChanges(next, `Charge added: ${type}`);
  closeOrderChargeModal();
  renderOrder();
}

async function completePurchase() {
  if (!document.getElementById) return;

  let order = ensureActiveOrder();
  if (!order) {
    showOrderNotice("No order data found.", "warning");
    return;
  }

  order = recalculateOrderTotals(order);
  upsertOrder(order);

  if (String(order.status || "draft") !== "draft") {
    showOrderNotice("Only Draft orders can be confirmed from this screen.", "warning");
    return;
  }

  if (!order.sourceType || !order.sourceId) {
    showOrderNotice("Funding source must be selected in purchase plan.", "warning");
    return;
  }

  let selectedSourceId = String(order.sourceId);
  let sourceType = order.sourceType;
  let paymentType = document.getElementById("oPaymentType") ? document.getElementById("oPaymentType").value : "";

  if (!sourceType) {
    showOrderNotice("Select source type.", "warning");
    return;
  }

  if (!paymentType) {
    showOrderNotice("Select payment type.", "warning");
    return;
  }

  let summary = getLedgerSummary(selectedSourceId, sourceType);
  if (!summary) {
    showOrderNotice("Selected source is invalid.", "error");
    return;
  }

  let total = Number(order.total || 0);
  if (summary.remaining < total) {
    showOrderNotice(`Not enough balance. Available ${formatCurrency(summary.remaining)} | Needed ${formatCurrency(total)}.`, "warning");
    return;
  }

  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  const shouldCheckDailyLimit = String(sourceType || "").toLowerCase() === "budget";
  if (shouldCheckDailyLimit) {
    let dailyLimit = typeof getDailyLimit === "function" ? getDailyLimit() : 0;

    let today = new Date().toDateString();
    let todaySpent = expenses
      .filter(e => new Date(e.date).toDateString() === today && e.type === "expense")
      .reduce((sum, e) => sum + Math.abs(Number(e.amount || 0)), 0);

    if (dailyLimit > 0 && (todaySpent + total > dailyLimit)) {
      let proceed = await window.AppDialog.confirm(
        `Daily limit exceeded.\nLimit: ${formatCurrency(dailyLimit)}\nSpent today: ${formatCurrency(todaySpent)}\nOrder: ${formatCurrency(total)}\n\nContinue?`
      );
      if (!proceed) return;
    }
  }

  let orders = getOrders();
  let idx = orders.findIndex(o => String(o.id) === String(order.id));
  if (idx === -1) {
    showOrderNotice("Order not found.", "error");
    return;
  }

  let target = { ...orders[idx] };
  let now = new Date().toISOString();

  target.status = "confirmed";
  target.sourceId = order.sourceId;
  target.sourceName = order.sourceName || summary.name;
  target.sourceType = order.sourceType;
  target.paymentType = paymentType;
  target.updatedAt = now;
  if (!Array.isArray(target.statusHistory)) target.statusHistory = [];
  target.statusHistory.push({ at: now, from: "draft", to: "confirmed", note: "Purchase confirmed" });

  orders[idx] = target;
  saveOrders(orders);

  localStorage.removeItem("quotationData");
  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");

  showOrderNotice("Order confirmed successfully.", "success");
  renderOrder();
}

async function advanceOrderStatus(nextStatus) {
  const order = ensureActiveOrder();
  if (!order) {
    showOrderNotice("No order data found.", "warning");
    return;
  }

  const current = String(order.status || "draft");
  const allowed = getAllowedOrderTransitions(current);

  if (!allowed.includes(nextStatus)) {
    showOrderNotice(`Invalid status transition: ${getOrderStatusLabel(current)} to ${getOrderStatusLabel(nextStatus)}.`, "warning");
    return;
  }

  if (nextStatus === "confirmed") {
    completePurchase();
    return;
  }

  let orders = getOrders();
  const idx = orders.findIndex(o => String(o.id) === String(order.id));
  if (idx === -1) {
    showOrderNotice("Order not found.", "error");
    return;
  }

  const now = new Date().toISOString();
  const row = { ...orders[idx] };

  if (nextStatus === "completed" && !row.financialPosted) {
    const sourceId = String(row.sourceId || "");
    const sourceType = String(row.sourceType || "");
    const paymentType = String(row.paymentType || "");

    if (!sourceType || !sourceId) {
      showOrderNotice("Funding source must be selected before completion.", "warning");
      return;
    }

    if (!paymentType) {
      showOrderNotice("Payment type must be selected before completion.", "warning");
      return;
    }

    const summary = getLedgerSummary(sourceId, sourceType);
    if (!summary) {
      showOrderNotice("Selected source is invalid.", "error");
      return;
    }

    const total = Number(row.total || 0);
    if (Number(summary.remaining || 0) < total) {
      showOrderNotice(`Not enough balance. Available ${formatCurrency(summary.remaining)} | Needed ${formatCurrency(total)}.`, "warning");
      return;
    }

    const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
    const purpose = (row.items || []).map(i => i.name).join(", ") || "Order Purchase";
    const expenseEntryId = createOrderId();

    expenses.push({
      id: expenseEntryId,
      amount: -Math.abs(total),
      type: "expense",
      category: "Orders",
      purpose: "Order Purchase: " + purpose,
      sourceId,
      sourceName: row.sourceName || summary.name,
      sourceType,
      paymentType,
      date: now,
      linkedOrderId: row.id
    });
    localStorage.setItem("expenses", JSON.stringify(expenses));

    if (sourceType === "savings") {
      const savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
      savings.push({
        id: createOrderId(),
        type: "expense",
        amount: -Math.abs(total),
        note: row.sourceName || summary.name,
        sourceId,
        paymentType,
        date: now,
        linkedOrderId: row.id
      });
      localStorage.setItem("savingsTransactions", JSON.stringify(savings));
    }

    row.financialPosted = true;
    row.financialEntryId = expenseEntryId;
    if (!Array.isArray(row.statusHistory)) row.statusHistory = [];
    row.statusHistory.push({
      at: now,
      from: current,
      to: current,
      note: "Financial transaction posted"
    });
  }

  if (!Array.isArray(row.statusHistory)) row.statusHistory = [];
  row.statusHistory.push({
    at: now,
    from: current,
    to: nextStatus,
    note: `Status moved to ${getOrderStatusLabel(nextStatus)}`
  });
  row.status = nextStatus;
  row.updatedAt = now;

  orders[idx] = row;
  saveOrders(orders);
  showOrderNotice(`Order moved to ${getOrderStatusLabel(nextStatus)}.`, "success");
  renderOrder();
}

async function cancelOrder() {
  const order = ensureActiveOrder();
  if (!order) {
    showOrderNotice("No order data found.", "warning");
    return;
  }

  const current = String(order.status || "draft");
  const allowed = getAllowedOrderTransitions(current);
  if (!allowed.includes("cancelled")) {
    showOrderNotice("This order can no longer be cancelled.", "warning");
    return;
  }

  const message = current === "draft"
    ? "Cancel this draft order and return to quotation?"
    : "Cancel this order? A refund entry will be recorded if it was already confirmed.";

  if (!await window.AppDialog.confirm(message, "Cancel Order")) return;

  const reasonInput = await window.AppDialog.prompt("Cancellation reason", "Cancelled from order workflow", "Cancel Order");
  const reason = (reasonInput || "").trim() || "Cancelled from order workflow";

  let orders = getOrders();
  const idx = orders.findIndex(o => String(o.id) === String(order.id));
  if (idx >= 0) {
    const now = new Date().toISOString();
    const row = { ...orders[idx] };

    if (row.financialPosted) {
      let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
      expenses.push({
        id: createOrderId(),
        amount: Math.abs(Number(row.total || 0)),
        type: "refund",
        category: "Orders",
        purpose: reason,
        sourceId: row.sourceId,
        sourceName: row.sourceName || "-",
        sourceType: row.sourceType,
        paymentType: row.paymentType || "Unknown",
        date: now,
        linkedOrderId: row.id
      });
      localStorage.setItem("expenses", JSON.stringify(expenses));

      if (row.sourceType === "savings" && row.sourceId) {
        let savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
        savings.push({
          id: createOrderId(),
          amount: Math.abs(Number(row.total || 0)),
          type: "refund",
          note: row.sourceName || "Order Refund",
          purpose: reason,
          sourceId: row.sourceId,
          paymentType: row.paymentType || "Unknown",
          date: now,
          linkedOrderId: row.id
        });
        localStorage.setItem("savingsTransactions", JSON.stringify(savings));
      }
    }

    if (!Array.isArray(row.statusHistory)) row.statusHistory = [];
    row.statusHistory.push({
      at: now,
      from: current,
      to: "cancelled",
      note: reason
    });

    row.status = "cancelled";
    row.updatedAt = now;
    row.cancelledAt = now;
    row.cancellationReason = reason;

    orders[idx] = row;
    saveOrders(orders);
  }

  showOrderNotice("Order cancelled successfully.", "success");
  if (current === "draft") {
    window.location.href = "quotation.html";
    return;
  }
  renderOrder();
}

function goBackToQuotation() {
  window.location.href = "quotations.html";
}

function getLedgerSummary(sourceId, type) {
  return getSourceSummaryById(sourceId, type);
}

function installOrderAccordionFallback() {
  const accordions = Array.from(document.querySelectorAll("details.secondary-accordion"));
  accordions.forEach((details) => {
    const summary = details.querySelector("summary");
    if (!summary) return;

    let beforeClickOpen = null;
    summary.addEventListener("pointerdown", () => {
      beforeClickOpen = details.hasAttribute("open");
    });

    summary.addEventListener("click", () => {
      const before = beforeClickOpen == null ? details.hasAttribute("open") : beforeClickOpen;
      beforeClickOpen = null;

      setTimeout(() => {
        const after = details.hasAttribute("open");
        // Fallback for environments that do not toggle native details/summary.
        if (after === before) {
          if (after) details.removeAttribute("open");
          else details.setAttribute("open", "");
        }
      }, 0);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById && document.getElementById("orderItems")) {
    renderOrder();
    installOrderAccordionFallback();

    const purposeInput = document.getElementById("oPurposeInput");
    if (purposeInput) purposeInput.addEventListener("blur", updateOrderPurpose);

    const sourceType = document.getElementById("oSourceType");
    if (sourceType) {
      sourceType.addEventListener("change", () => {
        loadOrderFundingOptions();
        updateOrderFunding();
      });
    }

    const sourceValue = document.getElementById("oSourceValue");
    if (sourceValue) sourceValue.addEventListener("change", updateOrderFunding);
  }
});

if (typeof window !== "undefined") {
  window.goBackToQuotation = goBackToQuotation;
  window.completePurchase = completePurchase;
  window.advanceOrderStatus = advanceOrderStatus;
  window.cancelOrder = cancelOrder;
  window.openOrderItemModal = openOrderItemModal;
  window.closeOrderItemModal = closeOrderItemModal;
  window.addOrderItem = addOrderItem;
  window.updateOrderItemField = updateOrderItemField;
  window.removeOrderItem = removeOrderItem;
  window.openOrderChargeModal = openOrderChargeModal;
  window.closeOrderChargeModal = closeOrderChargeModal;
  window.addOrderCharge = addOrderCharge;
  window.updateOrderChargeField = updateOrderChargeField;
  window.removeOrderCharge = removeOrderCharge;
}
