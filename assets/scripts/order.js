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
  alert(message);
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
    completed: [],
    cancelled: []
  };
  return map[String(status || "draft")] || [];
}

function getOrderWorkflowSteps() {
  return ["draft", "confirmed", "processing", "completed"];
}

function ensureActiveOrder() {
  const quote = getQuotationData();
  if (!quote || !Array.isArray(quote.items) || !quote.items.length) {
    return null;
  }

  let activeOrderId = JSON.parse(localStorage.getItem("activeOrderId") || "null");
  let orders = getOrders();

  let existing = activeOrderId ? orders.find(o => String(o.id) === String(activeOrderId)) : null;
  if (!existing) {
    const orderId = quote.orderId || createOrderId();
    const now = new Date().toISOString();

    existing = {
      id: orderId,
      quotationId: quote.id || null,
      quotationStatus: quote.status || null,
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
    localStorage.setItem("activeOrderId", JSON.stringify(orderId));
  }

  return existing;
}

function updateOrderStatusUI(order) {
  const statusEl = document.getElementById("orderStatusLabel");
  const idEl = document.getElementById("orderIdLabel");
  const createdEl = document.getElementById("orderCreatedLabel");
  const totalEl = document.getElementById("orderTotalAmount");
  const quoteEl = document.getElementById("orderQuotationLabel");
  const sourceEl = document.getElementById("orderSourceLabel");

  if (statusEl) {
    statusEl.textContent = getOrderStatusLabel(order && order.status);
    statusEl.className = `status-pill status-${order && order.status ? order.status : "draft"}`;
  }
  if (idEl) idEl.textContent = order && order.id ? order.id : "-";
  if (createdEl) {
    createdEl.textContent = order && order.createdAt ? new Date(order.createdAt).toLocaleString("en-IN") : "-";
  }
  if (totalEl) {
    totalEl.textContent = order ? formatCurrency(Number(order.total || 0)) : formatCurrency(0);
  }
  if (quoteEl) {
    quoteEl.textContent = order && order.quotationId ? String(order.quotationId) : "-";
  }
  if (sourceEl) {
    sourceEl.textContent = order && order.sourceName
      ? `${order.sourceName} (${order.sourceType || "-"})`
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

  const sourceTypeEl = document.getElementById("oSourceType");
  const sourceEl = document.getElementById("oSource");
  const paymentEl = document.getElementById("oPaymentType");
  const isDraft = String(order.status || "draft") === "draft";

  if (sourceTypeEl && order.sourceType) {
    sourceTypeEl.value = order.sourceType;
    loadSourceOptions();
  }
  if (sourceEl && order.sourceId) {
    sourceEl.value = String(order.sourceId);
    renderSourcePreview();
  }
  if (paymentEl && order.paymentType) {
    paymentEl.value = order.paymentType;
  }

  if (sourceTypeEl) sourceTypeEl.disabled = !isDraft;
  if (sourceEl) sourceEl.disabled = !isDraft;
  if (paymentEl) paymentEl.disabled = !isDraft;
}

function updateTotals(subtotal, gst, total) {
  if (document.getElementById("oSubtotal")) document.getElementById("oSubtotal").innerText = formatCurrency(subtotal);
  if (document.getElementById("oGSTAmount")) document.getElementById("oGSTAmount").innerText = formatCurrency(gst);
  if (document.getElementById("oFinalTotal")) document.getElementById("oFinalTotal").innerText = formatCurrency(total);
}

function loadSourceOptions() {
  if (!document.getElementById || !document.getElementById("oSourceType")) return;

  let type = document.getElementById("oSourceType").value;
  let select = document.getElementById("oSource");
  if (!select) return;

  select.innerHTML = `<option value="">Select Source</option>`;

  if (type === "savings") {
    let data = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
    let sources = data.filter(t => t.type === "income");

    sources.forEach(s => {
      let option = document.createElement("option");
      option.value = String(s.id);
      option.textContent = s.note || s.entity || "Savings";
      option.dataset.type = "savings";
      select.appendChild(option);
    });
  }

  if (type === "budget") {
    let budgets = JSON.parse(localStorage.getItem("budgets") || "[]");

    budgets.forEach(b => {
      let option = document.createElement("option");
      option.value = String(b.id || b.budgetId || "");
      option.textContent = `${b.name || b.entity || "Budget"}`;
      option.dataset.type = "budget";
      select.appendChild(option);
    });
  }

  select.onchange = renderSourcePreview;
  if (document.getElementById("sourcePreview")) document.getElementById("sourcePreview").innerHTML = "";
}

function renderSourcePreview() {
  if (!document.getElementById || !document.getElementById("oSource")) return;

  let select = document.getElementById("oSource");
  let preview = document.getElementById("sourcePreview");
  if (!preview) return;

  let selectedOption = select.options[select.selectedIndex];

  if (!selectedOption || !selectedOption.value) {
    preview.innerHTML = "";
    return;
  }

  let sourceId = String(selectedOption.value);
  let type = selectedOption.dataset.type;

  let summary = getLedgerSummary(sourceId, type);
  if (!summary) {
    preview.innerHTML = "No data";
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
  if (!document.getElementById || !document.getElementById("oSource")) return;

  let order = ensureActiveOrder();
  if (!order) {
    showOrderNotice("No order data found.", "warning");
    return;
  }

  if (String(order.status || "draft") !== "draft") {
    showOrderNotice("Only Draft orders can be confirmed from this screen.", "warning");
    return;
  }

  let sourceSelect = document.getElementById("oSource");
  let selectedOption = sourceSelect.options[sourceSelect.selectedIndex];
  if (!selectedOption || !selectedOption.value) {
    showOrderNotice("Select a source.", "warning");
    return;
  }

  let selectedSourceId = String(selectedOption.value);
  let sourceType = selectedOption.dataset.type;
  let paymentType = document.getElementById("oPaymentType") ? document.getElementById("oPaymentType").value : "";

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
    let proceed = confirm(
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
  target.sourceId = selectedSourceId;
  target.sourceName = summary.name;
  target.sourceType = sourceType;
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

function advanceOrderStatus(nextStatus) {
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

function cancelOrder() {
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

  if (!confirm(message)) return;

  const reason = prompt("Cancellation reason", "Cancelled from order workflow") || "Cancelled from order workflow";

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
  window.location.href = "quotation.html";
}

function getLedgerSummary(sourceId, type) {
  let savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  let budgets = JSON.parse(localStorage.getItem("budgets") || "[]");

  if (type === "savings") {
    let root = savings.find(t => String(t.id) === String(sourceId) && t.type === "income");
    if (!root) return null;

    let linked = savings.filter(t => String(t.sourceId) === String(sourceId));
    let income = Number(root.amount) || 0;

    let used = linked.reduce((sum, t) => {
      if (t.type === "expense") return sum + Math.abs(Number(t.amount || 0));
      if (t.type === "refund") return sum - Math.abs(Number(t.amount || 0));
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

  if (type === "budget") {
    let budget = budgets.find(b => String(b.id || b.budgetId) === String(sourceId));
    if (!budget) return null;

    let totalAllocated = Number(budget.totalAllocated || 0);

    let used = expenses
      .filter(e => String(e.sourceId) === String(sourceId) && e.sourceType === "budget")
      .reduce((sum, e) => {
        if (e.type === "expense") return sum + Math.abs(Number(e.amount || 0));
        if (e.type === "refund") return sum - Math.abs(Number(e.amount || 0));
        return sum;
      }, 0);

    return {
      name: budget.name || budget.note || budget.entity || "Budget",
      total: totalAllocated,
      used,
      remaining: totalAllocated - used,
      entries: []
    };
  }

  return null;
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById && document.getElementById("orderItems")) {
    renderOrder();
    loadSourceOptions();
  }
});
