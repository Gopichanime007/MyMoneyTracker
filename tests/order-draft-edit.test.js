function buildOrderDom() {
  document.body.innerHTML = `
    <span id="orderStatusLabel"></span>
    <span id="orderIdLabel"></span>
    <span id="orderNoLabel"></span>
    <span id="orderCreatedLabel"></span>
    <span id="orderTotalAmount"></span>
    <span id="orderQuotationLabel"></span>
    <span id="orderPurposeLabel"></span>
    <span id="orderSourceLabel"></span>

    <input id="oPurposeInput" />
    <select id="oSourceType"><option value=""></option><option value="savings">savings</option></select>
    <select id="oSourceValue"><option value=""></option></select>

    <button id="addOrderItemBtn"></button>
    <button id="addOrderChargeBtn"></button>

    <details class="secondary-accordion" id="fundingAccordion">
      <summary>Funding Diagnostics</summary>
      <div id="sourcePreview"></div>
    </details>

    <details class="secondary-accordion" id="timelineAccordion">
      <summary>Timeline</summary>
      <div data-order-step="draft"></div>
      <div data-order-step="confirmed"></div>
      <div data-order-step="processing"></div>
      <div data-order-step="completed"></div>
    </details>

    <details class="secondary-accordion" id="auditAccordion">
      <summary>Audit and Activity</summary>
      <div id="orderAuditTrail"></div>
    </details>

    <button data-order-action="confirmed"></button>
    <button data-order-action="processing"></button>
    <button data-order-action="completed"></button>
    <button data-order-action="cancelled"></button>

    <div id="orderItems"></div>
    <div id="orderChargesList"></div>

    <span id="oSubtotal"></span>
    <span id="oGSTAmount"></span>
    <span id="oFinalTotal"></span>

    <select id="oPaymentType"><option value=""></option><option value="UPI">UPI</option></select>

    <div id="orderItemModal"></div>
    <input id="oiName" />
    <input id="oiPrice" />
    <input id="oiQty" />
    <input id="oiSource" />
    <input id="oiLink" />

    <div id="orderChargeModal"></div>
    <select id="ocType">
      <option value="delivery">delivery</option>
      <option value="gst">gst</option>
      <option value="discount">discount</option>
      <option value="custom">custom</option>
    </select>
    <input id="ocLabel" />
    <select id="ocAdjustmentType"><option value="add">add</option><option value="deduct">deduct</option></select>
    <input id="ocValue" />
    <select id="ocMode"><option value="fixed">fixed</option><option value="percent">percent</option></select>
    <select id="ocApplyTo"><option value="all">all</option></select>
  `;
}

function installOrderDeps() {
  window.showToast = jest.fn();
  window.formatCurrency = (v) => `INR ${Number(v || 0).toFixed(2)}`;
  window.getDailyLimit = () => 0;
  window.AppDialog = {
    confirm: jest.fn(async () => true),
    prompt: jest.fn(async () => "")
  };
  window.DocWorkflow = {
    findOrderForQuotation: jest.fn(() => null),
    getRelationByQuotationId: jest.fn(() => null)
  };
}

function seedDraftOrder() {
  const now = new Date().toISOString();
  const row = {
    id: "ord_draft_1",
    orderNo: "ORD-DRAFT-1",
    quotationId: "qt_1",
    quotationNo: "QT-1",
    status: "draft",
    statusHistory: [{ at: now, from: null, to: "draft", note: "created" }],
    purpose: "Office setup",
    items: [{ id: "i1", name: "Chair", price: 100, qty: 1, source: "Store", link: "", total: 100 }],
    charges: [{ id: "c1", type: "delivery", label: "delivery", adjustmentType: "add", value: 20, mode: "fixed", appliesTo: "all" }],
    subtotal: 100,
    gst: 0,
    total: 120,
    plannedAmount: 120,
    sourceType: "savings",
    sourceId: "sav-1",
    sourceName: "Main Savings",
    paymentType: null,
    createdAt: now,
    updatedAt: now,
    financialPosted: false
  };

  localStorage.setItem("orders", JSON.stringify([row]));
  localStorage.setItem("activeOrderId", JSON.stringify("ord_draft_1"));
}

function updateSeedOrder(patch) {
  const rows = JSON.parse(localStorage.getItem("orders") || "[]");
  if (!rows.length) return;
  rows[0] = { ...rows[0], ...patch };
  localStorage.setItem("orders", JSON.stringify(rows));
}

function seedSavingsWallet(amount = 1000) {
  localStorage.setItem("savingsTransactions", JSON.stringify([
    {
      id: "sav-1",
      amount,
      note: "Main Savings",
      date: new Date().toISOString()
    }
  ]));
}

beforeEach(() => {
  localStorage.clear();
  jest.resetModules();
  buildOrderDom();
  installOrderDeps();
  seedDraftOrder();
  require("../assets/scripts/order.js");
  document.dispatchEvent(new Event("DOMContentLoaded"));
});

test("Draft order item and charge edits persist after render cycle", () => {
  window.updateOrderItemField("i1", "qty", "2");
  window.updateOrderItemField("i1", "price", "150");

  document.getElementById("ocType").value = "custom";
  document.getElementById("ocLabel").value = "Negotiation";
  document.getElementById("ocAdjustmentType").value = "deduct";
  document.getElementById("ocValue").value = "30";
  document.getElementById("ocMode").value = "fixed";
  document.getElementById("ocApplyTo").value = "all";
  window.addOrderCharge();

  const rows = JSON.parse(localStorage.getItem("orders") || "[]");
  expect(rows).toHaveLength(1);
  expect(Number(rows[0].items[0].qty)).toBe(2);
  expect(Number(rows[0].items[0].price)).toBe(150);
  expect(rows[0].charges.some((c) => c.label === "Negotiation")).toBe(true);
  expect(Number(rows[0].subtotal)).toBeCloseTo(300, 2);
  expect(Number(rows[0].total)).toBeCloseTo(290, 2);
});

test("Order add-charge custom label visibility follows charge type", () => {
  const type = document.getElementById("ocType");
  const label = document.getElementById("ocLabel");

  window.openOrderChargeModal();
  expect(label.style.display).toBe("none");

  type.value = "delivery";
  type.dispatchEvent(new Event("change"));
  expect(label.style.display).toBe("none");

  type.value = "gst";
  type.dispatchEvent(new Event("change"));
  expect(label.style.display).toBe("none");

  type.value = "discount";
  type.dispatchEvent(new Event("change"));
  expect(label.style.display).toBe("none");

  type.value = "custom";
  type.dispatchEvent(new Event("change"));
  expect(label.style.display).toBe("block");

  window.closeOrderChargeModal();
  window.openOrderChargeModal();
  expect(label.style.display).toBe("none");
});

test("Budget-funded confirm still shows daily-limit warning", async () => {
  window.getDailyLimit = () => 10;
  window.AppDialog.confirm = jest.fn(async () => true);

  localStorage.setItem("budgets", JSON.stringify([
    {
      id: "budget-1",
      budgetId: "budget-1",
      name: "Ops Budget",
      totalAllocated: 1000
    }
  ]));

  updateSeedOrder({
    sourceType: "budget",
    sourceId: "budget-1",
    sourceName: "Ops Budget"
  });

  document.getElementById("oPaymentType").value = "UPI";
  await window.completePurchase();

  expect(window.AppDialog.confirm).toHaveBeenCalledWith(expect.stringContaining("Daily limit exceeded."));
});

test("Savings-funded confirm skips daily-limit warning", async () => {
  window.getDailyLimit = () => 10;
  window.AppDialog.confirm = jest.fn(async () => true);

  seedSavingsWallet(1000);

  updateSeedOrder({
    sourceType: "savings",
    sourceId: "sav-1",
    sourceName: "Main Savings"
  });

  document.getElementById("oPaymentType").value = "UPI";
  await window.completePurchase();

  expect(window.AppDialog.confirm).not.toHaveBeenCalledWith(expect.stringContaining("Daily limit exceeded."));
});

test("Confirm transitions status but does not create financial transactions", async () => {
  seedSavingsWallet(1000);
  updateSeedOrder({
    sourceType: "savings",
    sourceId: "sav-1",
    sourceName: "Main Savings",
    financialPosted: false,
    financialEntryId: null
  });

  document.getElementById("oPaymentType").value = "UPI";
  await window.completePurchase();

  const orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expect(orders[0].status).toBe("confirmed");
  expect(orders[0].financialPosted).toBe(false);
  expect(orders[0].financialEntryId).toBeNull();

  const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  expect(expenses.length).toBe(0);

  const savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
  expect(savings.length).toBe(1);
});

test("Complete creates exactly one financial transaction and repeat complete cannot double-post", async () => {
  seedSavingsWallet(1000);
  updateSeedOrder({
    sourceType: "savings",
    sourceId: "sav-1",
    sourceName: "Main Savings",
    financialPosted: false,
    financialEntryId: null
  });

  document.getElementById("oPaymentType").value = "UPI";
  await window.completePurchase();
  await window.advanceOrderStatus("processing");
  await window.advanceOrderStatus("completed");

  let orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expect(orders[0].status).toBe("completed");
  expect(orders[0].financialPosted).toBe(true);
  expect(typeof orders[0].financialEntryId).toBe("string");

  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  expect(expenses.filter((row) => row.type === "expense" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);

  let savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");
  expect(savings.filter((row) => row.type === "expense" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);

  await window.advanceOrderStatus("completed");

  orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");

  expect(orders[0].financialPosted).toBe(true);
  expect(expenses.filter((row) => row.type === "expense" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);
  expect(savings.filter((row) => row.type === "expense" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);
});

test("Cancel posted savings-funded order creates one refund and repeat cancel is blocked", async () => {
  seedSavingsWallet(1000);
  window.AppDialog.confirm = jest.fn(async () => true);
  window.AppDialog.prompt = jest.fn(async () => "User requested cancellation");

  updateSeedOrder({
    status: "confirmed",
    financialPosted: true,
    sourceType: "savings",
    sourceId: "sav-1",
    sourceName: "Main Savings",
    paymentType: "UPI"
  });

  await window.cancelOrder();

  let orders = JSON.parse(localStorage.getItem("orders") || "[]");
  let expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  let savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");

  expect(orders[0].status).toBe("cancelled");
  expect(expenses.filter((row) => row.type === "refund" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);
  expect(savings.filter((row) => row.type === "refund" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);

  await window.cancelOrder();

  orders = JSON.parse(localStorage.getItem("orders") || "[]");
  expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");

  expect(orders[0].status).toBe("cancelled");
  expect(expenses.filter((row) => row.type === "refund" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);
  expect(savings.filter((row) => row.type === "refund" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);
});

test("Cancel posted budget-funded order creates expense refund only", async () => {
  window.AppDialog.confirm = jest.fn(async () => true);
  window.AppDialog.prompt = jest.fn(async () => "Budget cancellation");

  updateSeedOrder({
    status: "processing",
    financialPosted: true,
    sourceType: "budget",
    sourceId: "budget-1",
    sourceName: "Ops Budget",
    paymentType: "UPI"
  });

  await window.cancelOrder();

  const orders = JSON.parse(localStorage.getItem("orders") || "[]");
  const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
  const savings = JSON.parse(localStorage.getItem("savingsTransactions") || "[]");

  expect(orders[0].status).toBe("cancelled");
  expect(expenses.filter((row) => row.type === "refund" && row.linkedOrderId === "ord_draft_1")).toHaveLength(1);
  expect(savings.filter((row) => row.type === "refund" && row.linkedOrderId === "ord_draft_1")).toHaveLength(0);
});

test("Timeline accordion expands and collapses", async () => {
  const details = document.getElementById("timelineAccordion");
  const summary = details.querySelector("summary");

  expect(details.hasAttribute("open")).toBe(false);
  summary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(details.hasAttribute("open")).toBe(true);

  summary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(details.hasAttribute("open")).toBe(false);
});

test("Audit accordion expands and collapses", async () => {
  const details = document.getElementById("auditAccordion");
  const summary = details.querySelector("summary");

  expect(details.hasAttribute("open")).toBe(false);
  summary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(details.hasAttribute("open")).toBe(true);

  summary.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(details.hasAttribute("open")).toBe(false);
});
