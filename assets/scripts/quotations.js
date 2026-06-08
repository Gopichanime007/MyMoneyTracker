function getQuotationRegistryRows() {
  return window.DocWorkflow ? window.DocWorkflow.getQuotationRegistry() : [];
}

function saveQuotationRegistryRows(rows) {
  if (window.DocWorkflow) {
    window.DocWorkflow.saveQuotationRegistry(rows);
    return;
  }
  localStorage.setItem("quotationRegistry", JSON.stringify(Array.isArray(rows) ? rows : []));
}

function getOrderRows() {
  return window.DocWorkflow ? window.DocWorkflow.getOrderRows() : (JSON.parse(localStorage.getItem("orders") || "[]"));
}

function toDateLabel(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function getAmountLabel(value) {
  if (typeof formatCurrency === "function") return formatCurrency(Number(value || 0));
  return String(Number(value || 0));
}

function resolvePlanStatus(plan) {
  const status = String(plan && plan.status ? plan.status : "draft");
  if (status === "converted") return "converted";
  const validUntil = plan && plan.validUntil ? String(plan.validUntil) : "";
  if (status !== "converted" && validUntil && validUntil < new Date().toISOString().split("T")[0]) {
    return "expired";
  }
  if (status === "accepted") return "accepted";
  return "draft";
}

function resolveLinkedOrder(plan) {
  const orders = getOrderRows();
  if (!plan) return null;
  return orders.find((row) => String(row.quotationId || "") === String(plan.id || "")) || null;
}

function renderPlanCard(plan) {
  const linkedOrder = resolveLinkedOrder(plan);
  const effectiveStatus = resolvePlanStatus(plan);
  const fundingType = plan && plan.fundingSourceType ? String(plan.fundingSourceType) : "-";
  const fundingAccount = plan && plan.fundingSourceName ? String(plan.fundingSourceName) : "-";

  const card = document.createElement("div");
  card.className = "plan-card";

  card.innerHTML = `
    <div class="plan-head">
      <div class="plan-no">${String(plan.quotationNo || plan.id || "-")}</div>
      <span class="status-pill status-${effectiveStatus}">${effectiveStatus.toUpperCase()}</span>
    </div>
    <div class="plan-purpose"><strong>Purpose:</strong> ${String(plan.purpose || "Untitled plan")}</div>
    <div class="plan-meta"><strong>Funding:</strong> ${fundingType} → ${fundingAccount}</div>
    <div class="plan-meta"><strong>Estimated Amount:</strong> ${getAmountLabel(plan.total || 0)}</div>
    <div class="plan-meta"><strong>Created:</strong> ${toDateLabel(plan.createdAt)} | <strong>Modified:</strong> ${toDateLabel(plan.updatedAt)}</div>
    <div class="plan-meta"><strong>Linked Order Status:</strong> ${linkedOrder ? String(linkedOrder.status || "draft") : "Not created"}</div>
    <div class="plan-actions">
      <button class="secondary tiny-btn" type="button" onclick="openPlan('${String(plan.id)}')">Open</button>
      <button class="secondary tiny-btn" type="button" onclick="continueEditingPlan('${String(plan.id)}')">Continue Editing</button>
      <button class="danger tiny-btn" type="button" onclick="deletePlan('${String(plan.id)}')">Delete</button>
    </div>
  `;

  return card;
}

function renderWorkspaceSection(containerId, list) {
  const host = document.getElementById(containerId);
  if (!host) return;

  host.innerHTML = "";
  if (!Array.isArray(list) || !list.length) {
    host.innerHTML = '<div class="plan-empty">No plans in this section.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  list.forEach((plan) => fragment.appendChild(renderPlanCard(plan)));
  host.appendChild(fragment);
}

function openQuotationsFilterModal() {
  initializeQuotationsFilterBuilder();
  if (window.SearchService && typeof window.SearchService.getState === "function" && quotationsFilterBuilderInstance) {
    const state = window.SearchService.getState("quotations");
    quotationsFilterBuilderInstance.setFromFilters(Array.isArray(state.filters) ? state.filters : []);
  }
  const modal = document.getElementById("quotationsFilterModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
}

function closeQuotationsFilterModal() {
  const modal = document.getElementById("quotationsFilterModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

let quotationsFilterBuilderInstance = null;

function getQuotationsFilterTemplates() {
  return [
    { key: "date", label: "Date", field: "updatedAt", type: "date", hint: "Use Equals, Before, After, or Between" },
    { key: "quotationNo", label: "Quotation No", field: "quotationNo", type: "text", hint: "QUO-2001" },
    { key: "purpose", label: "Purpose", field: "purpose", type: "text", hint: "Shopping, Hardware, Travel" },
    { key: "status", label: "Status", field: "status", type: "enum", hint: "draft, accepted, expired, converted" },
    { key: "amount", label: "Amount", field: "total", type: "number", hint: "5000, 10000, 25000" },
    { key: "payment", label: "Payment Type", field: "paymentType", type: "enum", hint: "UPI, Cash, Debit Card, Credit Card" },
    { key: "source", label: "Source", field: "fundingSourceName", type: "text", hint: "Funding source name" },
    { key: "person", label: "Person", field: "requestor", type: "text", hint: "Requester or owner" },
    { key: "attachment", label: "Attachment", field: "attachmentName", type: "presence", hint: "Has any attachment" }
  ];
}

function initializeQuotationsFilterBuilder() {
  const root = document.getElementById("quotationsFilterBuilderRoot");
  if (!root || quotationsFilterBuilderInstance || !window.FilterBuilder || typeof window.FilterBuilder.create !== "function") {
    return;
  }

  quotationsFilterBuilderInstance = window.FilterBuilder.create({
    module: "quotations",
    dateField: "updatedAt",
    templates: getQuotationsFilterTemplates(),
    onClose: function () {
      closeQuotationsFilterModal();
    },
    onApply: function (filters) {
      applyQuotationsFilterModal(filters);
    },
    onClear: function () {
      clearQuotationsFilterModal(false);
    },
    onSave: function () {
      saveQuotationsCurrentView();
      refreshQuotationsSavedViews();
    }
  });

  quotationsFilterBuilderInstance.mount(root);
}

function buildQuotationsFilterDescriptorsFromModal() {
  initializeQuotationsFilterBuilder();
  if (!quotationsFilterBuilderInstance) {
    return [];
  }
  return quotationsFilterBuilderInstance.getDescriptors();
}

function applyQuotationsFilterModal(explicitFilters) {
  if (window.SearchService && typeof window.SearchService.setFilters === "function") {
    const filters = Array.isArray(explicitFilters) ? explicitFilters : buildQuotationsFilterDescriptorsFromModal();
    window.SearchService.setFilters("quotations", filters);
  }

  closeQuotationsFilterModal();
  renderQuotationsWorkspace();
}

function clearQuotationsFilterModal(closeAfterClear = true) {
  initializeQuotationsFilterBuilder();
  if (quotationsFilterBuilderInstance) {
    quotationsFilterBuilderInstance.clearAll();
  }

  if (window.SearchService && typeof window.SearchService.clearFilters === "function") {
    window.SearchService.clearFilters("quotations");
  }

  if (closeAfterClear) {
    closeQuotationsFilterModal();
  }
  renderQuotationsWorkspace();
}

function countQuotationsFilterConditions(filters) {
  if (!Array.isArray(filters)) return 0;
  return filters.reduce((sum, filter) => {
    if (!filter || typeof filter !== "object") return sum;
    if (String(filter.op || "") === "group_any" && Array.isArray(filter.conditions)) {
      return sum + countQuotationsFilterConditions(filter.conditions);
    }
    return sum + 1;
  }, 0);
}

function isDefaultQuotationsSort(sortItem) {
  if (!sortItem || typeof sortItem !== "object") return true;
  const field = String(sortItem.field || "updatedAt").toLowerCase();
  const direction = String(sortItem.direction || "desc").toLowerCase();
  return field === "updatedat" && direction === "desc";
}

function getQuotationsSortChipLabel(sortItem) {
  const fieldRaw = String((sortItem && sortItem.field) || "updatedAt");
  const directionRaw = String((sortItem && sortItem.direction) || "desc").toLowerCase();
  const fieldLabel = fieldRaw === "updatedAt"
    ? "Updated"
    : (fieldRaw === "total" ? "Amount" : fieldRaw.replace(/\b\w/g, c => c.toUpperCase()));
  const arrow = directionRaw === "asc" ? "↑" : "↓";
  return `Sort: ${fieldLabel} ${arrow}`;
}

function updateQuotationsSortIndicator() {
  const filterBtn = document.getElementById("quotationsFilterActionBtn");
  if (!filterBtn || !window.SearchService || typeof window.SearchService.getState !== "function") return;
  const state = window.SearchService.getState("quotations");
  const filters = Array.isArray(state.filters) ? state.filters : [];
  const count = countQuotationsFilterConditions(filters);
  filterBtn.textContent = count > 0 ? `Filter (${count})` : "Filter";
}

function getQuotationsFilterChipLabel(filter) {
  if (!filter || typeof filter !== "object") return "Filter";
  return `${String(filter.field || "field")} ${String(filter.op || "eq")} ${String(filter.value || "")}`;
}

function renderQuotationsQueryChips() {
  const host = document.getElementById("quotationsQueryChips");
  if (!host || !window.SearchService || typeof window.SearchService.getState !== "function") return;

  const state = window.SearchService.getState("quotations");
  const filters = Array.isArray(state.filters) ? state.filters : [];
  const sort = Array.isArray(state.sort) ? state.sort : [];

  host.innerHTML = "";

  filters.forEach((filter, index) => {
    const chip = document.createElement("button");
    chip.className = "secondary query-chip";
    chip.type = "button";
    chip.textContent = `${getQuotationsFilterChipLabel(filter)} ×`;
    chip.addEventListener("click", () => removeQuotationsFilterChip(index));
    host.appendChild(chip);
  });

  if (sort.length) {
    const first = sort[0];
    if (!isDefaultQuotationsSort(first)) {
      const chip = document.createElement("button");
      chip.className = "secondary query-chip";
      chip.type = "button";
      chip.textContent = `${getQuotationsSortChipLabel(first)} ×`;
      chip.addEventListener("click", clearQuotationsSortChip);
      host.appendChild(chip);
    }
  }
}

function removeQuotationsFilterChip(index) {
  if (!window.SearchService || typeof window.SearchService.getState !== "function") return;
  const state = window.SearchService.getState("quotations");
  const filters = Array.isArray(state.filters) ? state.filters.slice() : [];
  filters.splice(index, 1);
  if (typeof window.SearchService.setFilters === "function") {
    window.SearchService.setFilters("quotations", filters);
  }
  renderQuotationsWorkspace();
}

function clearQuotationsSortChip() {
  if (window.SearchService && typeof window.SearchService.clearSort === "function") {
    window.SearchService.clearSort("quotations");
  }
  renderQuotationsWorkspace();
}

function clearQuotationsQueryChips() {
  if (window.SearchService) {
    if (typeof window.SearchService.clearFilters === "function") {
      window.SearchService.clearFilters("quotations");
    }
    if (typeof window.SearchService.clearSort === "function") {
      window.SearchService.clearSort("quotations");
    }
  }
  renderQuotationsWorkspace();
}

function refreshQuotationsSavedViews() {
  const select = document.getElementById("quotationsSavedView");
  if (!select || !window.SearchService || typeof window.SearchService.listViews !== "function") return;

  const views = window.SearchService.listViews("module", "quotations")
    .filter((view) => String(view.scope || "") === "quotations" || String(view.scope || "") === "*");

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

async function saveQuotationsCurrentView() {
  if (!window.SearchService || typeof window.SearchService.saveView !== "function") return;
  const name = await window.AppDialog.prompt("Saved view name", "Quotations View", "Save View");
  if (!name || !name.trim()) return;
  window.SearchService.saveView({ name: name.trim(), module: "quotations", scope: "module" });
  refreshQuotationsSavedViews();
}

function applyQuotationsSavedView() {
  if (!window.SearchService || typeof window.SearchService.applyView !== "function") return;
  const id = document.getElementById("quotationsSavedView")?.value || "";
  if (!id) return;
  window.SearchService.applyView(id, "quotations");
  renderQuotationsWorkspace();
}

function deleteQuotationsSavedView() {
  if (!window.SearchService || typeof window.SearchService.deleteView !== "function") return;
  const id = document.getElementById("quotationsSavedView")?.value || "";
  if (!id) return;
  window.SearchService.deleteView(id);
  refreshQuotationsSavedViews();
  renderQuotationsWorkspace();
}

function openQuotationsSortModal() {
  const modal = document.getElementById("quotationsSortModal");
  if (modal) {
    modal.classList.remove("hidden");
    modal.style.display = "flex";
  }
}

function closeQuotationsSortModal() {
  const modal = document.getElementById("quotationsSortModal");
  if (modal) {
    modal.classList.add("hidden");
    modal.style.display = "none";
  }
}

function applyQuotationsSortModal() {
  const field = document.getElementById("quotationsSortField")?.value || "updatedAt";
  const direction = document.getElementById("quotationsSortDirection")?.value || "desc";
  const type = field === "total" ? "number" : (field === "updatedAt" ? "date" : "string");

  if (window.SearchService && typeof window.SearchService.setSort === "function") {
    window.SearchService.setSort("quotations", [{ field, direction, type }]);
  }

  closeQuotationsSortModal();
  updateQuotationsSortIndicator();
  renderQuotationsWorkspace();
}

function clearQuotationsSortModal() {
  const fieldEl = document.getElementById("quotationsSortField");
  const directionEl = document.getElementById("quotationsSortDirection");
  if (fieldEl) fieldEl.value = "updatedAt";
  if (directionEl) directionEl.value = "desc";

  if (window.SearchService && typeof window.SearchService.clearSort === "function") {
    window.SearchService.clearSort("quotations");
  }

  closeQuotationsSortModal();
  updateQuotationsSortIndicator();
  renderQuotationsWorkspace();
}

function renderQuotationsWorkspace() {
  updateQuotationsSortIndicator();
  renderQuotationsQueryChips();
  refreshQuotationsSavedViews();
  let rows = getQuotationRegistryRows().slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  if (window.SearchService && typeof window.SearchService.applyModuleSearch === "function") {
    const queryResult = window.SearchService.applyModuleSearch("quotations", rows);
    rows = Array.isArray(queryResult.results) ? queryResult.results : rows;
  }

  const draft = [];
  const accepted = [];
  const expired = [];
  const converted = [];

  rows.forEach((row) => {
    const status = resolvePlanStatus(row);
    if (status === "draft") draft.push(row);
    else if (status === "accepted") accepted.push(row);
    else if (status === "expired") expired.push(row);
    else converted.push(row);
  });

  renderWorkspaceSection("draftPlansList", draft);
  renderWorkspaceSection("acceptedPlansList", accepted);
  renderWorkspaceSection("expiredPlansList", expired);
  renderWorkspaceSection("convertedPlansList", converted);
}

function createNewPlan() {
  localStorage.removeItem("activeQuotationId");
  window.location.href = "quotation.html";
}

function openPlan(quotationId) {
  const row = getQuotationRegistryRows().find((x) => String(x.id) === String(quotationId));
  if (!row) return;

  const linkedOrder = resolveLinkedOrder(row);
  if (!linkedOrder) {
    localStorage.setItem("activeQuotationId", JSON.stringify(String(quotationId)));
    window.location.href = "quotation.html";
    return;
  }

  const modal = document.getElementById("planNavigationModal");
  const info = document.getElementById("planNavigationInfo");
  const openPlanBtn = document.getElementById("openPlanBtn");
  const openOrderBtn = document.getElementById("openLinkedOrderBtn");

  if (!modal || !info || !openPlanBtn || !openOrderBtn) return;

  info.textContent = `${row.quotationNo || row.id} has a linked order ${linkedOrder.orderNo || linkedOrder.id}.`;
  openPlanBtn.onclick = () => {
    localStorage.setItem("activeQuotationId", JSON.stringify(String(quotationId)));
    window.location.href = "quotation.html";
  };
  openOrderBtn.onclick = () => {
    localStorage.setItem("activeOrderId", JSON.stringify(String(linkedOrder.id)));
    window.location.href = "order.html";
  };

  modal.classList.remove("hidden");
}

function closePlanNavigationModal() {
  const modal = document.getElementById("planNavigationModal");
  if (modal) modal.classList.add("hidden");
}

function continueEditingPlan(quotationId) {
  localStorage.setItem("activeQuotationId", JSON.stringify(String(quotationId)));
  window.location.href = "quotation.html";
}

async function deletePlan(quotationId) {
  const rows = getQuotationRegistryRows();
  const idx = rows.findIndex((row) => String(row.id) === String(quotationId));
  if (idx === -1) {
    if (typeof showToast === "function") showToast("Plan not found", "warning");
    return;
  }

  const row = rows[idx];
  const linkedOrder = resolveLinkedOrder(row);
  const allow = !linkedOrder || await window.AppDialog.confirm("This plan has a linked order. Delete plan and keep order record?", "Confirm Deletion");
  if (!allow) return;

  rows.splice(idx, 1);
  saveQuotationRegistryRows(rows);

  if (String(localStorage.getItem("activeQuotationId") || "").includes(String(quotationId))) {
    localStorage.removeItem("activeQuotationId");
  }

  if (window.DocWorkflow && typeof window.DocWorkflow.upsertRelation === "function") {
    window.DocWorkflow.upsertRelation({ quotationId, orderId: linkedOrder ? linkedOrder.id : null, relationshipStatus: "archived" });
  }

  renderQuotationsWorkspace();
  if (typeof showToast === "function") showToast("Purchase plan removed", "success");
}

document.addEventListener("DOMContentLoaded", renderQuotationsWorkspace);
