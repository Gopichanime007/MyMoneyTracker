function buildQuotationDom() {
  document.body.innerHTML = `
    <input id="quotationPurpose" />
    <input id="quotationValidityDate" type="date" />
    <span id="quotationStatusLabel"></span>
    <span id="quotationNoLabel"></span>
    <div id="quotationStatusTimeline">
      <span data-status-step="draft"></span>
      <span data-status-step="accepted"></span>
      <span data-status-step="converted"></span>
    </div>
    <div id="quotationStatusActions">
      <button data-quote-action="accepted"></button>
      <button data-quote-action="draft"></button>
    </div>
    <button id="addQuotationItemBtn"></button>
    <button id="addQuotationChargeBtn"></button>
    <button id="clearQuotationBtn"></button>
    <button id="saveDraftBtn"></button>
    <button id="convertQuotationBtn"></button>

    <select id="qSourceType">
      <option value="">Select</option>
      <option value="savings">Savings</option>
      <option value="budget">Budget</option>
    </select>
    <select id="qSourceValue">
      <option value="">Select Funding Account</option>
    </select>
    <div id="qFundingPreview"></div>

    <div id="quotationItems"></div>
    <div id="chargesList"></div>
    <span id="qSubtotal"></span>
    <span id="qGSTAmount"></span>
    <span id="qFinalTotal"></span>
    <div id="quotationAuditTrail"></div>

    <div id="itemModal" style="display:none"></div>
    <div id="chargeModal" style="display:none"></div>

    <input id="mName" />
    <input id="mPrice" />
    <input id="mQty" />
    <select id="mUnit"><option value="pcs">pcs</option></select>
    <select id="mSource"><option value="">Source</option></select>
    <input id="newSourceInput" />
    <input id="mLink" />

    <select id="cType">
      <option value="delivery">delivery</option>
      <option value="gst">gst</option>
      <option value="discount">discount</option>
      <option value="custom">custom</option>
    </select>
    <input id="cCustomLabel" />
    <select id="cAdjustmentType"><option value="add">add</option><option value="deduct">deduct</option></select>
    <input id="cValue" />
    <select id="cMode"><option value="fixed">fixed</option><option value="percent">percent</option></select>
    <select id="cApplyTo"><option value="all">All Items</option></select>
    <span id="fixedCurrencyOption"></span>
  `;
}

function installQuotationDeps() {
  window.showToast = jest.fn();
  window.formatCurrency = (v) => `INR ${Number(v || 0).toFixed(2)}`;
  window.getCurrency = () => "INR";
  window.open = jest.fn();
  window.AppDialog = {
    alert: jest.fn(),
    confirm: jest.fn(async () => true)
  };

  window.DocWorkflow = {
    keys: {
      quotationRegistry: "quotationRegistry",
      quotationMeta: "quotationMeta",
      activeQuotation: "activeQuotationId"
    },
    generateDocumentNumber: jest.fn(() => "QT-1001"),
    getQuotationRegistry: jest.fn(() => JSON.parse(localStorage.getItem("quotationRegistry") || "[]")),
    saveQuotationRegistry: jest.fn((rows) => localStorage.setItem("quotationRegistry", JSON.stringify(rows || []))),
    getRelationByQuotationId: jest.fn((quotationId) => {
      const rows = JSON.parse(localStorage.getItem("documentRelations") || "[]");
      return rows.find((row) => String(row.quotationId || "") === String(quotationId || "")) || null;
    }),
    upsertRelation: jest.fn(),
    getFundingSourceSummaries: jest.fn((type) => {
      if (type !== "savings") return [];
      return [{ id: "fund-1", name: "Wallet A", remaining: 5000 }];
    })
  };
}

function loadQuotationModule() {
  buildQuotationDom();
  installQuotationDeps();
  require("../assets/scripts/quotation.js");
}

function configureCoreDraftFields() {
  const purpose = document.getElementById("quotationPurpose");
  purpose.value = "Laptop purchase";
  purpose.dispatchEvent(new Event("blur"));

  const sourceType = document.getElementById("qSourceType");
  sourceType.value = "savings";
  sourceType.dispatchEvent(new Event("change"));

  const sourceValue = document.getElementById("qSourceValue");
  sourceValue.value = "fund-1";
  sourceValue.dispatchEvent(new Event("change"));
}

function addOneItem(opts = {}) {
  const name = opts.name || "Item A";
  const price = opts.price == null ? 100 : opts.price;
  const qty = opts.qty == null ? 2 : opts.qty;
  document.getElementById("mName").value = String(name);
  document.getElementById("mPrice").value = String(price);
  document.getElementById("mQty").value = String(qty);
  document.getElementById("mUnit").value = "pcs";
  document.getElementById("mSource").value = "";
  document.getElementById("mLink").value = "";
  window.addItemFromModal();
}

function addOneCharge() {
  document.getElementById("cType").value = "delivery";
  document.getElementById("cValue").value = "50";
  document.getElementById("cMode").value = "fixed";
  document.getElementById("cApplyTo").value = "all";
  window.addCharge();
}

function addChargeEntry(opts = {}) {
  document.getElementById("cType").value = String(opts.type || "delivery");
  document.getElementById("cCustomLabel").value = String(opts.label || "");
  document.getElementById("cAdjustmentType").value = String(opts.adjustment || "add");
  document.getElementById("cValue").value = String(opts.value == null ? 0 : opts.value);
  document.getElementById("cMode").value = String(opts.mode || "fixed");
  document.getElementById("cApplyTo").value = String(opts.appliesTo || "all");
  window.addCharge();
}

function getFinalTotalNumber() {
  const el = document.getElementById("qFinalTotal");
  const text = String((el && (el.innerText || el.textContent)) || "");
  const cleaned = text.replace(/[^0-9.-]/g, "");
  return Number(cleaned || 0);
}

function getActiveQuotationId() {
  return JSON.parse(localStorage.getItem("activeQuotationId") || "null");
}

function getRegistryRow(id) {
  const rows = JSON.parse(localStorage.getItem("quotationRegistry") || "[]");
  return rows.find((r) => String(r.id) === String(id));
}

function simulateReopen(quotationId) {
  localStorage.setItem("activeQuotationId", JSON.stringify(String(quotationId)));
  localStorage.removeItem("quotationMeta");
  localStorage.removeItem("quotationData");
  localStorage.removeItem("quotationItems");
  localStorage.removeItem("quotationCharges");

  jest.resetModules();
  loadQuotationModule();
}

beforeEach(() => {
  localStorage.clear();
  jest.resetModules();
  loadQuotationModule();
});

test("Add Item -> Save Draft -> Reopen keeps item and passes validation", () => {
  configureCoreDraftFields();
  addOneItem();
  window.savePurchasePlanDraft();

  const quoteId = getActiveQuotationId();
  const before = getRegistryRow(quoteId);
  expect(Array.isArray(before.items)).toBe(true);
  expect(before.items.length).toBe(1);

  simulateReopen(quoteId);

  const rows = document.querySelectorAll("#quotationItems .table-row");
  expect(rows.length).toBe(1);

  window.savePurchasePlanDraft();
  expect(window.showToast).not.toHaveBeenCalledWith("Add at least one expense plan item.", "warning");
});

test("Add Item -> Add Charge -> Save Draft keeps both item and charge", () => {
  configureCoreDraftFields();
  addOneItem();
  addOneCharge();
  window.savePurchasePlanDraft();

  const quoteId = getActiveQuotationId();
  const row = getRegistryRow(quoteId);

  expect(Array.isArray(row.items)).toBe(true);
  expect(Array.isArray(row.charges)).toBe(true);
  expect(row.items.length).toBe(1);
  expect(row.charges.length).toBe(1);
});

test("Add Item -> Save -> Reopen -> Add Charge -> Save keeps existing item and charge", () => {
  configureCoreDraftFields();
  addOneItem();
  window.savePurchasePlanDraft();

  const quoteId = getActiveQuotationId();
  simulateReopen(quoteId);

  addOneCharge();
  window.savePurchasePlanDraft();

  const row = getRegistryRow(quoteId);
  expect(row.items.length).toBe(1);
  expect(row.charges.length).toBe(1);
});

test("Reopened draft remains editable", () => {
  configureCoreDraftFields();
  addOneItem();
  window.savePurchasePlanDraft();

  const quoteId = getActiveQuotationId();
  simulateReopen(quoteId);

  expect(document.getElementById("quotationStatusLabel").textContent).toBe("Draft");
  expect(document.getElementById("quotationPurpose").disabled).toBe(false);
  expect(document.getElementById("addQuotationItemBtn").disabled).toBe(false);
  expect(document.getElementById("addQuotationChargeBtn").disabled).toBe(false);
  expect(document.getElementById("saveDraftBtn").disabled).toBe(false);
});

test("Direction-based charge engine computes expected mixed total with custom add", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Laptop", price: 250, qty: 1 });

  addChargeEntry({ type: "delivery", value: 100, mode: "fixed" });
  addChargeEntry({ type: "gst", value: 100, mode: "fixed" });
  addChargeEntry({ type: "discount", value: 25, mode: "fixed" });
  addChargeEntry({ type: "custom", label: "Handling Fee", value: 20, mode: "fixed", adjustment: "add" });

  expect(getFinalTotalNumber()).toBeCloseTo(445, 2);

  window.savePurchasePlanDraft();
  const row = getRegistryRow(getActiveQuotationId());
  const customCharge = row.charges.find((c) => c.type === "custom");
  expect(customCharge.adjustmentType).toBe("add");
});

test("Custom deduct charge reduces total", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Laptop", price: 250, qty: 1 });

  addChargeEntry({ type: "delivery", value: 100, mode: "fixed" });
  addChargeEntry({ type: "gst", value: 100, mode: "fixed" });
  addChargeEntry({ type: "discount", value: 25, mode: "fixed" });
  addChargeEntry({ type: "custom", label: "Loyalty Discount", value: 20, mode: "fixed", adjustment: "deduct" });

  expect(getFinalTotalNumber()).toBeCloseTo(405, 2);
});

test("Mixed fixed and percent add/deduct charges calculate correctly", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Item A", price: 200, qty: 1 });

  addChargeEntry({ type: "gst", value: 10, mode: "percent" });
  addChargeEntry({ type: "delivery", value: 10, mode: "fixed" });
  addChargeEntry({ type: "custom", label: "Promo", value: 5, mode: "percent", adjustment: "deduct" });

  // 200 + 20 + 10 - 10 = 220
  expect(getFinalTotalNumber()).toBeCloseTo(220, 2);
});

test("Legacy custom charge remains excluded and save blocks until direction is set", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Legacy Item", price: 200, qty: 1 });
  addChargeEntry({ type: "custom", label: "Legacy Custom", value: 50, mode: "fixed", adjustment: "add" });
  window.savePurchasePlanDraft();

  const quoteId = getActiveQuotationId();
  const rows = JSON.parse(localStorage.getItem("quotationRegistry") || "[]");
  const idx = rows.findIndex((r) => String(r.id) === String(quoteId));
  rows[idx].charges[0] = {
    ...rows[idx].charges[0],
    adjustmentType: null
  };
  localStorage.setItem("quotationRegistry", JSON.stringify(rows));

  simulateReopen(quoteId);

  expect(getFinalTotalNumber()).toBeCloseTo(200, 2);

  window.showToast.mockClear();
  window.savePurchasePlanDraft();
  expect(window.showToast).toHaveBeenCalledWith(
    "Set Add Amount or Deduct Amount for legacy custom charges before saving.",
    "warning"
  );
});

test("Quotation to order conversion preserves direction-based totals", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Converted Item", price: 120, qty: 2 }); // 240
  addChargeEntry({ type: "delivery", value: 30, mode: "fixed" });
  addChargeEntry({ type: "custom", label: "Manual Adj", value: 10, mode: "fixed", adjustment: "deduct" });

  expect(getFinalTotalNumber()).toBeCloseTo(260, 2);

  window.setQuotationStatus("accepted");
  window.convertToOrder();

  const orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expect(orders.length).toBe(1);
  expect(Number(orders[0].total)).toBeCloseTo(260, 2);
});

test("Quotation locks when linked relation/order exists even if status is draft", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Lock Item", price: 200, qty: 1 });

  const quoteId = getActiveQuotationId();
  localStorage.setItem("orders", JSON.stringify([
    { id: "ord_lock_1", orderNo: "ORD-10023", quotationId: quoteId, status: "draft", total: 200 }
  ]));
  localStorage.setItem("documentRelations", JSON.stringify([
    { quotationId: quoteId, orderId: "ord_lock_1", relationshipStatus: "linked" }
  ]));

  simulateReopen(quoteId);

  expect(document.getElementById("quotationPurpose").disabled).toBe(true);
  expect(document.getElementById("addQuotationItemBtn").disabled).toBe(true);
  expect(document.getElementById("addQuotationChargeBtn").disabled).toBe(true);
  expect(document.getElementById("saveDraftBtn").disabled).toBe(true);

  window.showToast.mockClear();
  document.getElementById("mName").value = "Blocked Item";
  document.getElementById("mPrice").value = "100";
  document.getElementById("mQty").value = "1";
  window.addItemFromModal();

  expect(window.showToast).toHaveBeenCalledWith(
    expect.stringContaining("Quotation is locked because it is linked"),
    "warning"
  );
});

test("convertedOrderId evidence locks quotation without relation row", () => {
  configureCoreDraftFields();
  addOneItem({ name: "History Item", price: 150, qty: 1 });
  window.savePurchasePlanDraft();

  const quoteId = getActiveQuotationId();
  const rows = JSON.parse(localStorage.getItem("quotationRegistry") || "[]");
  const idx = rows.findIndex((row) => String(row.id) === String(quoteId));
  rows[idx].status = "draft";
  rows[idx].convertedOrderId = "ord_historical_1";
  localStorage.setItem("quotationRegistry", JSON.stringify(rows));
  localStorage.setItem("orders", JSON.stringify([]));
  localStorage.removeItem("documentRelations");

  simulateReopen(quoteId);

  expect(document.getElementById("quotationPurpose").disabled).toBe(true);
  expect(document.getElementById("addQuotationItemBtn").disabled).toBe(true);
  expect(document.getElementById("addQuotationChargeBtn").disabled).toBe(true);
});

test("Repeated conversion attempt opens existing order and does not create duplicate", () => {
  configureCoreDraftFields();
  addOneItem({ name: "Dedupe Item", price: 200, qty: 1 });
  addChargeEntry({ type: "delivery", value: 50, mode: "fixed" });

  window.setQuotationStatus("accepted");
  window.convertToOrder();

  let orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expect(orders.length).toBe(1);
  const firstOrderId = String(orders[0].id);

  const quoteId = getActiveQuotationId();
  simulateReopen(quoteId);
  window.convertToOrder();

  orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expect(orders.length).toBe(1);
  expect(String(orders[0].id)).toBe(firstOrderId);
  expect(JSON.parse(localStorage.getItem("activeOrderId") || "null")).toBe(firstOrderId);
});
