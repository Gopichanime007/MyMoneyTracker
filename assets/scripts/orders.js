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
    confirmed: "Open",
    processing: "Open",
    open: "Open",
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
  return map[status] || [];
}

function getFilterStatus(order) {
  const status = String(order && order.status ? order.status : "draft");
  if (status === "confirmed" || status === "processing") return "open";
  return status;
}

function getPaymentIcon(type) {
  if (type === "UPI") return "📱";
  if (type === "Cash") return "💵";
  if (type === "Card") return "💳";
  return "💰";
}

function refreshOrderLinkedViews() {
  try {
    if (typeof loadDashboard === "function") loadDashboard();
    if (typeof loadHistory === "function") loadHistory();
    if (typeof renderBudgetEntries === "function") renderBudgetEntries();
  } catch (_err) {
  }
}

function openOrder(orderId) {
  if (!orderId) return;
  localStorage.setItem("activeOrderId", JSON.stringify(orderId));
  window.location.href = "order.html";
}

function openOrdersFilterModal() {
  const modal = document.getElementById("ordersFilterModal");
  if (modal) modal.classList.remove("hidden");
}

function closeOrdersFilterModal() {
  const modal = document.getElementById("ordersFilterModal");
  if (modal) modal.classList.add("hidden");
}

function applyOrdersFilterModal() {
  if (window.SearchService && typeof window.SearchService.setFilters === "function") {
    const field = document.getElementById("ordersFilterField")?.value || "";
    const op = document.getElementById("ordersFilterOperator")?.value || "contains";
    const value = document.getElementById("ordersFilterValue")?.value || "";
    const filters = field && value.trim() ? [{ field, op, value: value.trim() }] : [];
    window.SearchService.setFilters("orders", filters);
  }

  closeOrdersFilterModal();
  renderOrders();
}

function clearOrdersFilterModal() {
  const fieldEl = document.getElementById("ordersFilterField");
  const opEl = document.getElementById("ordersFilterOperator");
  const valueEl = document.getElementById("ordersFilterValue");

  if (fieldEl) fieldEl.value = "orderNo";
  if (opEl) opEl.value = "contains";
  if (valueEl) valueEl.value = "";

  if (window.SearchService && typeof window.SearchService.clearFilters === "function") {
    window.SearchService.clearFilters("orders");
  }

  closeOrdersFilterModal();
  renderOrders();
}

function updateOrdersSortIndicator() {
  const indicator = document.getElementById("ordersSortIndicator");
  if (!indicator || !window.SearchService || typeof window.SearchService.getState !== "function") return;
  const state = window.SearchService.getState("orders");
  const sort = Array.isArray(state.sort) ? state.sort : [];
  if (!sort.length) {
    indicator.textContent = "Sort: Default";
    return;
  }
  indicator.textContent = `Sort: ${String(sort[0].field || "updatedAt")} (${String(sort[0].direction || "asc")})`;
}

function getOrdersFilterChipLabel(filter) {
  if (!filter || typeof filter !== "object") return "Filter";
  return `${String(filter.field || "field")} ${String(filter.op || "eq")} ${String(filter.value || "")}`;
}

function renderOrdersQueryChips() {
  const host = document.getElementById("ordersQueryChips");
  if (!host || !window.SearchService || typeof window.SearchService.getState !== "function") return;

  const state = window.SearchService.getState("orders");
  const filters = Array.isArray(state.filters) ? state.filters : [];
  const sort = Array.isArray(state.sort) ? state.sort : [];

  host.innerHTML = "";

  filters.forEach((filter, index) => {
    const chip = document.createElement("button");
    chip.className = "secondary";
    chip.type = "button";
    chip.textContent = `${getOrdersFilterChipLabel(filter)} ×`;
    chip.addEventListener("click", () => removeOrdersFilterChip(index));
    host.appendChild(chip);
  });

  if (sort.length) {
    const first = sort[0];
    const chip = document.createElement("button");
    chip.className = "secondary";
    chip.type = "button";
    chip.textContent = `Sort: ${String(first.field || "updatedAt")} (${String(first.direction || "asc")}) ×`;
    chip.addEventListener("click", clearOrdersSortChip);
    host.appendChild(chip);
  }

  if (filters.length || sort.length) {
    const clearAll = document.createElement("button");
    clearAll.className = "secondary";
    clearAll.type = "button";
    clearAll.textContent = "Clear All";
    clearAll.addEventListener("click", clearOrdersQueryChips);
    host.appendChild(clearAll);
  }
}

function removeOrdersFilterChip(index) {
  if (!window.SearchService || typeof window.SearchService.getState !== "function") return;
  const state = window.SearchService.getState("orders");
  const filters = Array.isArray(state.filters) ? state.filters.slice() : [];
  filters.splice(index, 1);
  if (typeof window.SearchService.setFilters === "function") {
    window.SearchService.setFilters("orders", filters);
  }
  renderOrders();
}

function clearOrdersSortChip() {
  if (window.SearchService && typeof window.SearchService.clearSort === "function") {
    window.SearchService.clearSort("orders");
  }
  renderOrders();
}

function clearOrdersQueryChips() {
  if (window.SearchService) {
    if (typeof window.SearchService.clearFilters === "function") {
      window.SearchService.clearFilters("orders");
    }
    if (typeof window.SearchService.clearSort === "function") {
      window.SearchService.clearSort("orders");
    }
  }
  renderOrders();
}

function refreshOrdersSavedViews() {
  const select = document.getElementById("ordersSavedView");
  if (!select || !window.SearchService || typeof window.SearchService.listViews !== "function") return;

  const views = window.SearchService.listViews("module", "orders")
    .filter((view) => String(view.scope || "") === "orders" || String(view.scope || "") === "*");

  select.innerHTML = "";
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Saved Views";
  select.appendChild(defaultOpt);

  views.forEach((view) => {
    const opt = document.createElement("option");
    opt.value = String(view.id);
    opt.textContent = String(view.name || "Untitled");
    select.appendChild(opt);
  });
}

function saveOrdersCurrentView() {
  if (!window.SearchService || typeof window.SearchService.saveView !== "function") return;
  const name = prompt("Saved view name", "Orders View");
  if (!name || !name.trim()) return;
  window.SearchService.saveView({ name: name.trim(), module: "orders", scope: "module" });
  refreshOrdersSavedViews();
}

function applyOrdersSavedView() {
  if (!window.SearchService || typeof window.SearchService.applyView !== "function") return;
  const id = document.getElementById("ordersSavedView")?.value || "";
  if (!id) return;
  window.SearchService.applyView(id, "orders");
  renderOrders();
}

function deleteOrdersSavedView() {
  if (!window.SearchService || typeof window.SearchService.deleteView !== "function") return;
  const id = document.getElementById("ordersSavedView")?.value || "";
  if (!id) return;
  window.SearchService.deleteView(id);
  refreshOrdersSavedViews();
  renderOrders();
}

function openOrdersSortModal() {
  const modal = document.getElementById("ordersSortModal");
  if (modal) modal.classList.remove("hidden");
}

function closeOrdersSortModal() {
  const modal = document.getElementById("ordersSortModal");
  if (modal) modal.classList.add("hidden");
}

function applyOrdersSortModal() {
  const field = document.getElementById("ordersSortField")?.value || "updatedAt";
  const direction = document.getElementById("ordersSortDirection")?.value || "desc";
  const type = field === "total" ? "number" : (field === "updatedAt" ? "date" : "string");

  if (window.SearchService && typeof window.SearchService.setSort === "function") {
    window.SearchService.setSort("orders", [{ field, direction, type }]);
  }

  closeOrdersSortModal();
  updateOrdersSortIndicator();
  renderOrders();
}

function clearOrdersSortModal() {
  const fieldEl = document.getElementById("ordersSortField");
  const directionEl = document.getElementById("ordersSortDirection");
  if (fieldEl) fieldEl.value = "updatedAt";
  if (directionEl) directionEl.value = "desc";

  if (window.SearchService && typeof window.SearchService.clearSort === "function") {
    window.SearchService.clearSort("orders");
  }

  closeOrdersSortModal();
  updateOrdersSortIndicator();
  renderOrders();
}

function renderOrders() {
  const allOrders = getOrders();
  if (!document.getElementById || !document.getElementById("ordersList")) return;

  const container = document.getElementById("ordersList");
  updateOrdersSortIndicator();
  renderOrdersQueryChips();
  refreshOrdersSavedViews();
  const filter = document.getElementById("ordersStatusFilter");
  const selectedStatus = filter ? filter.value : "all";

  let orders = allOrders;
  if (selectedStatus && selectedStatus !== "all") {
    orders = allOrders.filter(o => getFilterStatus(o) === selectedStatus);
  }

  if (window.SearchService && typeof window.SearchService.applyModuleSearch === "function") {
    const queryResult = window.SearchService.applyModuleSearch("orders", orders);
    orders = Array.isArray(queryResult.results) ? queryResult.results : orders;
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
  const fragment = document.createDocumentFragment();

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

    const openBtn = `<button type="button" class="secondary tiny-btn" onclick="event.stopPropagation(); openOrder('${order.id}')">Open</button>`;
    const editBtn = `<button type="button" class="secondary tiny-btn" onclick="event.stopPropagation(); openOrder('${order.id}')">Edit</button>`;
    const fundingBtn = `<button type="button" class="secondary tiny-btn" onclick="event.stopPropagation(); viewFundingDetails('${order.id}')">View Funding</button>`;
    const deleteBtn = `<button type="button" class="danger tiny-btn" onclick="event.stopPropagation(); deleteOrder('${order.id}')">Delete</button>`;

    const purpose = String(order.purpose || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const quotationNo = String(order.quotationNo || order.quotationId || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const funding = `${String(order.sourceType || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")} → ${String(order.sourceName || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}`;

    div.innerHTML = `
      <div class="order-header" onclick="toggleOrder('${order.id}')">
        <div>
          <strong>${String(order.orderNo || order.id).replace(/</g, "&lt;").replace(/>/g, "&gt;")} • ${formatCurrency(Number(order.total || 0))}</strong>
          <small>${date}</small>
        </div>

        <div class="header-right">
          <span class="badge status-${String(order.status || "draft")}">${formatOrderStatus(order.status || "draft")}</span>
          <span class="arrow">▼</span>
        </div>
      </div>

      <div class="order-items" id="items-${order.id}">
        <div class="order-meta">
          Purpose: ${purpose}
        </div>

        <div class="order-meta">
          Linked Quotation: ${quotationNo}
        </div>

        <div class="order-meta">
          Funding: ${funding}
        </div>

        <div class="order-meta">
          ${getPaymentIcon(order.paymentType)} ${String(order.paymentType || "-").replace(/</g, "&lt;").replace(/>/g, "&gt;")}
        </div>

        ${itemsHTML}

        <div class="order-actions-row">
          ${openBtn}
          ${editBtn}
          ${transitionButtons}
          ${cancelBtn}
          ${fundingBtn}
          ${deleteBtn}
        </div>
      </div>
    `;

    fragment.appendChild(div);
  });

  container.appendChild(fragment);
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
  const normalized = nextStatus === "processing" ? "open" : nextStatus;
  row.statusHistory.push({ at: now, from: current, to: nextStatus, note: `Status moved to ${formatOrderStatus(nextStatus)}` });

  row.status = normalized;
  row.updatedAt = now;

  orders[idx] = row;
  saveOrders(orders);
  renderOrders();
  showOrdersNotice(`Order moved to ${formatOrderStatus(nextStatus)}.`, "success");
}

function viewFundingDetails(orderId) {
  const order = getOrders().find(x => String(x.id) === String(orderId));
  if (!order) {
    showOrdersNotice("Order not found.", "warning");
    return;
  }

  const summary = getOrderFundingSummary(order);
  showOrdersNotice(summary, "info");
}

function getOrderFundingSummary(order) {
  const sourceType = String(order.sourceType || "-");
  const sourceName = String(order.sourceName || "-");
  const total = formatCurrency(Number(order.total || 0));
  const planned = formatCurrency(Number(order.plannedAmount || order.total || 0));
  return `Funding ${sourceType} → ${sourceName} | Planned ${planned} | Order ${total}`;
}

function deleteOrder(orderId) {
  let orders = getOrders();
  const idx = orders.findIndex(o => String(o.id) === String(orderId));
  if (idx === -1) {
    showOrdersNotice("Order not found.", "error");
    return;
  }

  const row = orders[idx];
  if (row.financialPosted && String(row.status || "") !== "cancelled") {
    showOrdersNotice("Delete blocked: cancel the order first to preserve financial audit entries.", "warning");
    return;
  }

  const ok = confirm(
    `Delete order ${row.id}?\n\nThis removes it from order history and cannot be undone.`
  );
  if (!ok) return;

  orders.splice(idx, 1);
  saveOrders(orders);

  try {
    const activeOrderId = JSON.parse(localStorage.getItem("activeOrderId") || "null");
    if (String(activeOrderId) === String(orderId)) {
      localStorage.removeItem("activeOrderId");
    }
  } catch (_err) {
  }

  renderOrders();
  refreshOrderLinkedViews();
  showOrdersNotice("Order deleted successfully.", "success");
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
  refreshOrderLinkedViews();
  showOrdersNotice("Order cancelled and audit logged.", "success");
}

document.addEventListener("DOMContentLoaded", renderOrders);

if (typeof window !== "undefined") {
  window.openOrder = openOrder;
  window.renderOrders = renderOrders;
  window.toggleOrder = toggleOrder;
  window.transitionOrderStatus = transitionOrderStatus;
  window.openDeleteModal = openDeleteModal;
  window.closeDeleteModal = closeDeleteModal;
  window.confirmDelete = confirmDelete;
  window.deleteOrder = deleteOrder;
  window.viewFundingDetails = viewFundingDetails;
}
