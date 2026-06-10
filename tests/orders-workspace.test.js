function buildOrdersDom() {
  document.body.innerHTML = `
    <button id="ordersFilterActionBtn">Filter</button>
    <select id="ordersStatusFilter"><option value="all">all</option></select>
    <details class="secondary-accordion advanced-controls" id="ordersAdvancedAccordion">
      <summary>Advanced Filters and Views</summary>
      <div class="accordion-body"><div id="ordersQueryChips"></div></div>
    </details>
    <div id="ordersList"></div>
    <div id="ordersFilterModal" class="modal hidden"></div>
    <div id="ordersSortModal" class="modal hidden"></div>
    <div id="ordersFilterBuilderRoot"></div>
    <select id="ordersSavedView"></select>
    <select id="ordersSortField"><option value="updatedAt">updatedAt</option></select>
    <select id="ordersSortDirection"><option value="desc">desc</option></select>
    <div id="deleteModal" class="modal hidden"></div>
    <input id="deleteReason" />
  `;
}

function installOrdersDeps() {
  window.showToast = jest.fn();
  window.formatCurrency = (v) => `INR ${Number(v || 0).toFixed(2)}`;
  window.AppDialog = {
    confirm: jest.fn(async () => true),
    alert: jest.fn()
  };
  window.SearchService = {
    getState: jest.fn(() => ({ filters: [], sort: [{ field: "updatedAt", direction: "desc" }] })),
    applyModuleSearch: jest.fn((_module, rows) => ({ results: rows })),
    applyModuleQuery: jest.fn((_module, rows) => rows),
    setFilters: jest.fn(),
    clearFilters: jest.fn(),
    setSort: jest.fn()
  };
}

function seedOrderWorkspaceData() {
  const now = new Date().toISOString();
  localStorage.setItem("orders", JSON.stringify([
    {
      id: "ord_ws_1",
      orderNo: "ORD-WS-1",
      quotationNo: "QT-WS-1",
      status: "processing",
      statusHistory: [
        { at: now, from: null, to: "draft", note: "created" },
        { at: now, from: "draft", to: "confirmed", note: "approved" },
        { at: now, from: "confirmed", to: "processing", note: "packaging" }
      ],
      purpose: "Workspace regression",
      sourceName: "Main Savings",
      sourceType: "savings",
      sourceId: "sav-1",
      paymentType: "UPI",
      plannedAmount: 1200,
      total: 1250,
      items: [{ id: "i1", name: "Laptop Stand", qty: 1, price: 1000 }],
      charges: [{ id: "c1", type: "delivery", label: "delivery", value: 250, mode: "fixed", adjustmentType: "add" }],
      updatedAt: now,
      createdAt: now,
      financialPosted: false
    }
  ]));
}

beforeEach(() => {
  localStorage.clear();
  jest.resetModules();
  buildOrdersDom();
  installOrdersDeps();
  seedOrderWorkspaceData();
  require("../assets/scripts/orders.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
});

test("Orders card renders timeline and audit accordions and both toggle", async () => {
  window.toggleOrder("ord_ws_1");

  const host = document.getElementById("items-ord_ws_1");
  const summaries = Array.from(host.querySelectorAll("details.secondary-accordion summary"));
  const timelineSummary = summaries.find((el) => String(el.textContent || "").includes("Timeline"));
  const auditSummary = summaries.find((el) => String(el.textContent || "").includes("Audit and Activity"));

  expect(timelineSummary).toBeTruthy();
  expect(auditSummary).toBeTruthy();

  const timelineDetails = timelineSummary.parentElement;
  const auditDetails = auditSummary.parentElement;

  expect(timelineDetails.hasAttribute("open")).toBe(false);
  timelineSummary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(timelineDetails.hasAttribute("open")).toBe(true);

  timelineSummary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(timelineDetails.hasAttribute("open")).toBe(false);

  expect(auditDetails.hasAttribute("open")).toBe(false);
  auditSummary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(auditDetails.hasAttribute("open")).toBe(true);

  const timelineBodyText = String(timelineDetails.textContent || "");
  const auditBodyText = String(auditDetails.textContent || "");
  expect(timelineBodyText).toContain("packaging");
  expect(auditBodyText).toContain("Quotation:");
});
