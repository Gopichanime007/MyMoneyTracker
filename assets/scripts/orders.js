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
  if (window.AppDialog && typeof window.AppDialog.alert === "function") {
    window.AppDialog.alert(message, "Notice");
    return;
  }
  console.warn(message);
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
  initializeOrdersFilterBuilder();
  if (window.SearchService && typeof window.SearchService.getState === "function" && ordersFilterBuilderInstance) {
    const state = window.SearchService.getState("orders");
    ordersFilterBuilderInstance.setFromFilters(Array.isArray(state.filters) ? state.filters : []);
  }
  const modal = document.getElementById("ordersFilterModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
}

function closeOrdersFilterModal() {
  const modal = document.getElementById("ordersFilterModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

let ordersFilterBuilderInstance = null;

function getOrdersFilterTemplates() {
  return [
    { key: "date", label: "Date", field: "updatedAt", type: "date", hint: "Use Equals, Before, After, or Between" },
    { key: "orderNo", label: "Order No", field: "orderNo", type: "text", hint: "ORD-1001" },
    { key: "purpose", label: "Purpose", field: "purpose", type: "text", hint: "Office, Travel, Equipment" },
    { key: "status", label: "Status", field: "status", type: "enum", hint: "draft, open, completed, cancelled" },
    { key: "amount", label: "Amount", field: "total", type: "number", hint: "5000, 10000, 25000" },
    { key: "payment", label: "Payment Type", field: "paymentType", type: "enum", hint: "UPI, Cash, Debit Card, Credit Card" },
    { key: "source", label: "Source", field: "sourceName", type: "text", hint: "Funding source name" },
    { key: "quotation", label: "Quotation", field: "quotationNo", type: "text", hint: "QUO-2001" },
    { key: "attachment", label: "Attachment", field: "attachmentName", type: "presence", hint: "Has any attachment" }
  ];
}

function initializeOrdersFilterBuilder() {
  const root = document.getElementById("ordersFilterBuilderRoot");
  if (!root || ordersFilterBuilderInstance || !window.FilterBuilder || typeof window.FilterBuilder.create !== "function") {
    return;
  }

  ordersFilterBuilderInstance = window.FilterBuilder.create({
    module: "orders",
    dateField: "updatedAt",
    templates: getOrdersFilterTemplates(),
    onClose: function () {
      closeOrdersFilterModal();
    },
    onApply: function (filters) {
      applyOrdersFilterModal(filters);
    },
    onClear: function () {
      clearOrdersFilterModal(false);
    },
    onSave: function () {
      saveOrdersCurrentView();
      refreshOrdersSavedViews();
    }
  });

  ordersFilterBuilderInstance.mount(root);
}

function buildOrdersFilterDescriptorsFromModal() {
  initializeOrdersFilterBuilder();
  if (!ordersFilterBuilderInstance) {
    return [];
  }
  return ordersFilterBuilderInstance.getDescriptors();
}

function applyOrdersFilterModal(explicitFilters) {
  if (window.SearchService && typeof window.SearchService.setFilters === "function") {
    const filters = Array.isArray(explicitFilters) ? explicitFilters : buildOrdersFilterDescriptorsFromModal();
    window.SearchService.setFilters("orders", filters);
  }

  closeOrdersFilterModal();
  renderOrders();
}

function clearOrdersFilterModal(closeAfterClear = true) {
  initializeOrdersFilterBuilder();
  if (ordersFilterBuilderInstance) {
    ordersFilterBuilderInstance.clearAll();
  }

  if (window.SearchService && typeof window.SearchService.clearFilters === "function") {
    window.SearchService.clearFilters("orders");
  }

  if (closeAfterClear) {
    closeOrdersFilterModal();
  }
  renderOrders();
}

function countOrdersFilterConditions(filters) {
  if (!Array.isArray(filters)) return 0;
  return filters.reduce((sum, filter) => {
    if (!filter || typeof filter !== "object") return sum;
    if (String(filter.op || "") === "group_any" && Array.isArray(filter.conditions)) {
      return sum + countOrdersFilterConditions(filter.conditions);
    }
    return sum + 1;
  }, 0);
}

function isDefaultOrdersSort(sortItem) {
  if (!sortItem || typeof sortItem !== "object") return true;
  const field = String(sortItem.field || "updatedAt").toLowerCase();
  const direction = String(sortItem.direction || "desc").toLowerCase();
  return field === "updatedat" && direction === "desc";
}

function getOrdersSortChipLabel(sortItem) {
  const fieldRaw = String((sortItem && sortItem.field) || "updatedAt");
  const directionRaw = String((sortItem && sortItem.direction) || "desc").toLowerCase();
  const fieldLabel = fieldRaw === "updatedAt"
    ? "Updated"
    : (fieldRaw === "total" ? "Amount" : fieldRaw.replace(/\b\w/g, c => c.toUpperCase()));
  const arrow = directionRaw === "asc" ? "↑" : "↓";
  return `Sort: ${fieldLabel} ${arrow}`;
}

function updateOrdersSortIndicator() {
  const filterBtn = document.getElementById("ordersFilterActionBtn");
  if (!filterBtn || !window.SearchService || typeof window.SearchService.getState !== "function") return;
  const state = window.SearchService.getState("orders");
  const filters = Array.isArray(state.filters) ? state.filters : [];
  const count = countOrdersFilterConditions(filters);
  filterBtn.textContent = count > 0 ? `Filter (${count})` : "Filter";
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
    chip.className = "secondary query-chip";
    chip.type = "button";
    chip.textContent = `${getOrdersFilterChipLabel(filter)} ×`;
    chip.addEventListener("click", () => removeOrdersFilterChip(index));
    host.appendChild(chip);
  });

  if (sort.length) {
    const first = sort[0];
    if (!isDefaultOrdersSort(first)) {
      const chip = document.createElement("button");
      chip.className = "secondary query-chip";
      chip.type = "button";
      chip.textContent = `${getOrdersSortChipLabel(first)} ×`;
      chip.addEventListener("click", clearOrdersSortChip);
      host.appendChild(chip);
    }
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

async function saveOrdersCurrentView() {
  if (!window.SearchService || typeof window.SearchService.saveView !== "function") return;
  const name = await window.AppDialog.prompt("Saved view name", "Orders View", "Save View");
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
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
}

function closeOrdersSortModal() {
  const modal = document.getElementById("ordersSortModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
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

async function deleteOrder(orderId) {
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

  const ok = await window.AppDialog.confirm(
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
