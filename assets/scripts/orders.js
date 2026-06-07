function getOrders() {
  return JSON.parse(localStorage.getItem("orders") || "[]");
}

function saveOrders(rows) {
  localStorage.setItem("orders", JSON.stringify(Array.isArray(rows) ? rows : []));
}

function showOrdersNotice(message, variant) {
  if (typeof showToast === "function") {
    showToast(message, variant || "info");
    return;
  }
  alert(message);
}

function createOrderEntryId() {
  return `ord_evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function formatOrderStatus(status) {
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
  return map[status] || [];
}

function getPaymentIcon(type) {
  if (type === "UPI") return "📱";
  if (type === "Cash") return "💵";
  if (type === "Card") return "💳";
  return "💰";
}

function renderOrders() {
  const allOrders = getOrders();
  if (!document.getElementById || !document.getElementById("ordersList")) return;

  const container = document.getElementById("ordersList");
  const filter = document.getElementById("ordersStatusFilter");
  const selectedStatus = filter ? filter.value : "all";

  let orders = allOrders;
  if (selectedStatus && selectedStatus !== "all") {
    orders = allOrders.filter(o => String(o.status || "draft") === selectedStatus);
  }

  if (!orders.length) {
    container.innerHTML = `
      <div class="empty">
        📦 No orders in this state<br>
        <small>Try another filter or create a new order</small>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  [...orders].reverse().forEach(order => {
    const div = document.createElement("div");
    div.className = "order-card";

    const date = order.updatedAt || order.date || order.createdAt
      ? new Date(order.updatedAt || order.date || order.createdAt).toLocaleString("en-IN")
      : "-";

    const itemsHTML = (order.items || []).map(i => `
      <div class="item-row">
        <span>${String(i.name || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>
        <span>${Number(i.qty || 0)} × ${formatCurrency(Number(i.price || 0))}</span>
      </div>
    `).join("");

    const allowed = getAllowedOrderTransitions(String(order.status || "draft"));

    const transitionButtons = allowed
      .filter(state => state !== "cancelled")
      .map(state => `<button type="button" class="secondary tiny-btn" onclick="event.stopPropagation(); transitionOrderStatus('${order.id}','${state}')">${formatOrderStatus(state)}</button>`)
      .join("");

    const cancelBtn = allowed.includes("cancelled")
      ? `<button type="button" class="danger tiny-btn" onclick="event.stopPropagation(); openDeleteModal('${order.id}')">Cancel</button>`
      : "";

    div.innerHTML = `
      <div class="order-header" onclick="toggleOrder('${order.id}')">
        <div>
          <strong>${formatCurrency(Number(order.total || 0))}</strong>
          <small>${date}</small>
        </div>

        <div class="header-right">
          <span class="badge status-${String(order.status || "draft")}">${formatOrderStatus(order.status || "draft")}</span>
          <span class="arrow">▼</span>
        </div>
      </div>

      <div class="order-items" id="items-${order.id}">
        <div class="order-meta">
          ${String(order.sourceName || order.note || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")} •
          ${getPaymentIcon(order.paymentType)} ${String(order.paymentType || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>

        <div class="order-meta">
          Order ID: ${String(order.id || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>

        ${itemsHTML}

        <div class="order-actions-row">
          ${transitionButtons}
          ${cancelBtn}
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function toggleOrder(id) {
  const el = document.getElementById("items-" + id);
  if (!el) return;

  const header = el.previousElementSibling;
  const arrow = header ? header.querySelector(".arrow") : null;

  el.classList.toggle("open");
  if (arrow) arrow.classList.toggle("rotate");
}

function transitionOrderStatus(orderId, nextStatus) {
  let orders = getOrders();
  const idx = orders.findIndex(o => String(o.id) === String(orderId));
  if (idx === -1) {
    showOrdersNotice("Order not found.", "error");
    return;
  }

  const row = { ...orders[idx] };
  const current = String(row.status || "draft");
  const allowed = getAllowedOrderTransitions(current);

  if (!allowed.includes(nextStatus)) {
    showOrdersNotice(`Invalid status transition: ${formatOrderStatus(current)} → ${formatOrderStatus(nextStatus)}`, "warning");
    return;
  }

  const now = new Date().toISOString();
  if (!Array.isArray(row.statusHistory)) row.statusHistory = [];
  row.statusHistory.push({ at: now, from: current, to: nextStatus, note: `Status moved to ${formatOrderStatus(nextStatus)}` });

  row.status = nextStatus;
  row.updatedAt = now;

  orders[idx] = row;
  saveOrders(orders);
  renderOrders();
  showOrdersNotice(`Order moved to ${formatOrderStatus(nextStatus)}.`, "success");
}

let deleteTargetId = null;

function openDeleteModal(id) {
  deleteTargetId = id;
  if (document.getElementById("deleteReason")) document.getElementById("deleteReason").value = "";
  if (document.getElementById("deleteModal")) document.getElementById("deleteModal").classList.remove("hidden");
}

function closeDeleteModal() {
  deleteTargetId = null;
  if (document.getElementById("deleteModal")) document.getElementById("deleteModal").classList.add("hidden");
}

function confirmDelete() {
  if (!deleteTargetId) return;

  let reason = "Order cancelled";
  if (document.getElementById("deleteReason") && document.getElementById("deleteReason").value) {
    reason = document.getElementById("deleteReason").value.trim() || reason;
  }

  let orders = getOrders();
  let idx = orders.findIndex(o => String(o.id) === String(deleteTargetId));

  if (idx === -1) {
    showOrdersNotice("Order not found.", "error");
    closeDeleteModal();
    return;
  }

  let order = { ...orders[idx] };
  const current = String(order.status || "draft");
  const allowed = getAllowedOrderTransitions(current);

  if (!allowed.includes("cancelled")) {
    showOrdersNotice("This order cannot be cancelled anymore.", "warning");
    closeDeleteModal();
    return;
  }

  const now = new Date().toISOString();

  if (order.financialPosted) {
    let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
    expenses.push({
      id: createOrderEntryId(),
      amount: Math.abs(Number(order.total || 0)),
      type: "refund",
      category: "Orders",
      purpose: reason,
      sourceId: order.sourceId,
      sourceName: order.sourceName || "-",
      sourceType: order.sourceType,
      paymentType: order.paymentType || "Unknown",
      date: now,
      linkedOrderId: order.id
    });
    localStorage.setItem("expenses", JSON.stringify(expenses));

    if (order.sourceType === "savings" && order.sourceId) {
      let savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
      savings.push({
        id: createOrderEntryId(),
        amount: Math.abs(Number(order.total || 0)),
        type: "refund",
        note: order.sourceName || "Order Refund",
        purpose: reason,
        sourceId: order.sourceId,
        paymentType: order.paymentType || "Unknown",
        date: now,
        linkedOrderId: order.id
      });
      localStorage.setItem("savingsTransactions", JSON.stringify(savings));
    }
  }

  if (!Array.isArray(order.statusHistory)) order.statusHistory = [];
  order.statusHistory.push({ at: now, from: current, to: "cancelled", note: reason });
  order.status = "cancelled";
  order.updatedAt = now;
  order.cancelledAt = now;
  order.cancellationReason = reason;

  orders[idx] = order;
  saveOrders(orders);

  closeDeleteModal();
  renderOrders();
  showOrdersNotice("Order cancelled and audit logged.", "success");
}

document.addEventListener("DOMContentLoaded", renderOrders);
