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

  list.forEach((plan) => host.appendChild(renderPlanCard(plan)));
}

function openQuotationsFilterModal() {
  const modal = document.getElementById("quotationsFilterModal");
  if (modal) modal.classList.remove("hidden");
}

function closeQuotationsFilterModal() {
  const modal = document.getElementById("quotationsFilterModal");
  if (modal) modal.classList.add("hidden");
}

function applyQuotationsFilterModal() {
  if (window.SearchService && typeof window.SearchService.setFilters === "function") {
    const field = document.getElementById("quotationsFilterField")?.value || "";
    const op = document.getElementById("quotationsFilterOperator")?.value || "contains";
    const value = document.getElementById("quotationsFilterValue")?.value || "";
    const filters = field && value.trim() ? [{ field, op, value: value.trim() }] : [];
    window.SearchService.setFilters("quotations", filters);
  }

  closeQuotationsFilterModal();
  renderQuotationsWorkspace();
}

function clearQuotationsFilterModal() {
  const fieldEl = document.getElementById("quotationsFilterField");
  const opEl = document.getElementById("quotationsFilterOperator");
  const valueEl = document.getElementById("quotationsFilterValue");

  if (fieldEl) fieldEl.value = "quotationNo";
  if (opEl) opEl.value = "contains";
  if (valueEl) valueEl.value = "";

  if (window.SearchService && typeof window.SearchService.clearFilters === "function") {
    window.SearchService.clearFilters("quotations");
  }

  closeQuotationsFilterModal();
  renderQuotationsWorkspace();
}

function updateQuotationsSortIndicator() {
  const indicator = document.getElementById("quotationsSortIndicator");
  if (!indicator || !window.SearchService || typeof window.SearchService.getState !== "function") return;
  const state = window.SearchService.getState("quotations");
  const sort = Array.isArray(state.sort) ? state.sort : [];
  if (!sort.length) {
    indicator.textContent = "Sort: Default";
    return;
  }
  indicator.textContent = `Sort: ${String(sort[0].field || "updatedAt")} (${String(sort[0].direction || "asc")})`;
}

function openQuotationsSortModal() {
  const modal = document.getElementById("quotationsSortModal");
  if (modal) modal.classList.remove("hidden");
}

function closeQuotationsSortModal() {
  const modal = document.getElementById("quotationsSortModal");
  if (modal) modal.classList.add("hidden");
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

function deletePlan(quotationId) {
  const rows = getQuotationRegistryRows();
  const idx = rows.findIndex((row) => String(row.id) === String(quotationId));
  if (idx === -1) {
    if (typeof showToast === "function") showToast("Plan not found", "warning");
    return;
  }

  const row = rows[idx];
  const linkedOrder = resolveLinkedOrder(row);
  const allow = !linkedOrder || confirm("This plan has a linked order. Delete plan and keep order record?");
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
