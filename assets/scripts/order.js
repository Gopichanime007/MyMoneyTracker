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
    if (quote.orderId) {
      const quotedOrder = orders.find(o => String(o.id) === String(quote.orderId));
      if (quotedOrder) {
        setActiveOrderId(quotedOrder.id);
        return quotedOrder;
      }
    }

    const orderId = quote.orderId || createOrderId();
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
      sourceId: null,
      sourceName: null,
      sourceType: null,
      purpose: quote.purpose || null,
      quotationNo: quote.quotationNo || null,
      orderNo: quote.orderNo || null,
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

  if (!container) return;
  if (!order || !Array.isArray(order.items) || !order.items.length) {
    container.innerHTML = `<p class="empty">No order data found</p>`;
    updateTotals(0, 0, 0);
    updateOrderStatusUI(null);
    return;
  }

  container.innerHTML = "";

  order.items.forEach(i => {
    let div = document.createElement("div");
    div.className = "table-row";

    const safeName = escapeOrderHtml(i.name);
    const safeSource = escapeOrderHtml(i.source || "-");
    const safeLink = escapeOrderHtml(i.link || "");

    div.innerHTML = `
      <span>${safeName}</span>
      <span>${formatCurrency(Number(i.price || 0))}</span>
      <span>${Number(i.qty || 0)}</span>
      <span>${safeSource}</span>
      <span>${safeLink ? `<a href="${safeLink}" target="_blank" rel="noopener noreferrer">🔗</a>` : "-"}</span>
      <span>${formatCurrency(Number(i.total || 0))}</span>
    `;

    container.appendChild(div);
  });

  updateTotals(Number(order.subtotal || 0), Number(order.gst || 0), Number(order.total || 0));
  updateOrderStatusUI(order);

  const paymentEl = document.getElementById("oPaymentType");
  const isDraft = String(order.status || "draft") === "draft";

  renderSourcePreview();

  if (paymentEl && order.paymentType) {
    paymentEl.value = order.paymentType;
  }

  if (paymentEl) paymentEl.disabled = !isDraft;
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

  preview.innerHTML = `
    <strong>${escapeOrderHtml(summary.name)}</strong><br>
    💰 Total: ${formatCurrency(Number(summary.total || 0))}<br>
    📉 Used: ${formatCurrency(Number(summary.used || 0))}<br>
    🟢 Remaining: ${formatCurrency(Number(summary.remaining || 0))}
  `;

  const sourceLabel = document.getElementById("orderSourceLabel");
  if (sourceLabel) {
    sourceLabel.textContent = `${summary.name} (${type || "-"})`;
  }
}

async function completePurchase() {
  if (!document.getElementById) return;

  let order = ensureActiveOrder();
  if (!order) {
    showOrderNotice("No order data found.", "warning");
    return;
  }

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

  let dailyLimit = typeof getDailyLimit === "function" ? getDailyLimit() : 0;

  let today = new Date().toDateString();
  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  let todaySpent = expenses
    .filter(e => new Date(e.date).toDateString() === today && e.type === "expense")
    .reduce((sum, e) => sum + Math.abs(Number(e.amount || 0)), 0);

  if (dailyLimit > 0 && (todaySpent + total > dailyLimit)) {
    let proceed = await window.AppDialog.confirm(
      `Daily limit exceeded.\nLimit: ${formatCurrency(dailyLimit)}\nSpent today: ${formatCurrency(todaySpent)}\nOrder: ${formatCurrency(total)}\n\nContinue?`
    );
    if (!proceed) return;
  }

  let orders = getOrders();
  let idx = orders.findIndex(o => String(o.id) === String(order.id));
  if (idx === -1) {
    showOrderNotice("Order not found.", "error");
    return;
  }

  let target = { ...orders[idx] };
  let now = new Date().toISOString();

  if (!target.financialPosted) {
    let purpose = (target.items || []).map(i => i.name).join(", ") || "Order Purchase";
    let expenseEntryId = createOrderId();

    expenses.push({
      id: expenseEntryId,
      amount: -Math.abs(total),
      type: "expense",
      category: "Orders",
      purpose: "Order Purchase: " + purpose,
      sourceId: selectedSourceId,
      sourceName: summary.name,
      sourceType,
      paymentType,
      date: now,
      linkedOrderId: target.id
    });

    localStorage.setItem("expenses", JSON.stringify(expenses));

    if (sourceType === "savings") {
      let savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
      savings.push({
        id: createOrderId(),
        type: "expense",
        amount: -Math.abs(total),
        note: summary.name,
        sourceId: selectedSourceId,
        paymentType,
        date: now,
        linkedOrderId: target.id
      });
      localStorage.setItem("savingsTransactions", JSON.stringify(savings));
    }

    target.financialPosted = true;
    target.financialEntryId = expenseEntryId;
  }

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

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById && document.getElementById("orderItems")) {
    renderOrder();
  }
});

if (typeof window !== "undefined") {
  window.goBackToQuotation = goBackToQuotation;
  window.completePurchase = completePurchase;
  window.advanceOrderStatus = advanceOrderStatus;
  window.cancelOrder = cancelOrder;
}
