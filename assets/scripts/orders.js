// =========================
// 📦 GET ORDERS
// =========================
function getOrders() {
  return JSON.parse(localStorage.getItem("orders")) || [];
}


// =========================
// 🎯 RENDER ORDERS
// =========================
function renderOrders() {
  const orders = getOrders();
  const container = document.getElementById("ordersList");

  if (!orders.length) {
    container.innerHTML = `
      <div class="empty">
        📦 No orders yet<br>
        <small>Start by creating a purchase</small>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  [...orders].reverse().forEach(order => {

    const div = document.createElement("div");
    div.className = "order-card";

    const date = order.date
      ? new Date(order.date).toLocaleString("en-IN")
      : "-";

    const itemsHTML = (order.items || []).map(i => `
      <div class="item-row">
        <span>${i.name || "-"}</span>
        <span>${i.qty || 0} × ₹${i.price || 0}</span>
      </div>
    `).join("");

    div.innerHTML = `
      <div class="order-header" onclick="toggleOrder('${order.id}')">

        <div>
          <strong>₹${order.total || 0}</strong>
          <small>${date}</small>
        </div>

        <div class="header-right">
          <span class="badge">${order.sourceType || "-"}</span>
          <span class="arrow">▼</span>
        </div>

      </div>

      <div class="order-items" id="items-${order.id}">

        <div class="order-meta">
          ${(order.sourceName || order.note || "-")} • 
          ${getPaymentIcon(order.paymentType)} ${order.paymentType || "-"}
        </div>

        ${itemsHTML}

        <button class="delete-btn" 
          onclick="event.stopPropagation(); openDeleteModal('${order.id}')">
          🗑 Delete
        </button>

      </div>
    `;

    container.appendChild(div);
  });
}

// =========================
// 🚀 INIT
// =========================
document.addEventListener("DOMContentLoaded", renderOrders);

// =========================
// 🔽 TOGGLE EXPAND
// =========================
function toggleOrder(id) {
  const el = document.getElementById("items-" + id);
  if (!el) return;

  const header = el.previousElementSibling;
  const arrow = header ? header.querySelector(".arrow") : null;

  el.classList.toggle("open");

  if (arrow) {
    arrow.classList.toggle("rotate");
  }
}


// =========================
// 🗑 DELETE ORDER
// =========================
let deleteTargetId = null;

// =========================
// 🗑 OPEN MODAL
// =========================
function openDeleteModal(id) {
  deleteTargetId = id;

  document.getElementById("deleteReason").value = "";
  document.getElementById("deleteModal").classList.remove("hidden");
}

// =========================
// ❌ CLOSE MODAL
// =========================
function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById("deleteModal").classList.add("hidden");
}

// =========================
// ✅ CONFIRM DELETE
// =========================
function confirmDelete() {

  if (!deleteTargetId) return;

  let reason = document.getElementById("deleteReason").value.trim();
  if (!reason) reason = "Order deleted";

  let orders = JSON.parse(localStorage.getItem("orders")) || [];
  let order = orders.find(o => o.id == deleteTargetId);

  if (!order) {
    alert("Order not found ❌");
    closeDeleteModal();
    return;
  }

  if (!order.sourceId) {
    alert("Invalid source ❌");
    closeDeleteModal();
    return;
  }

  const sourceId = Number(order.sourceId);

  // =========================
  // 🔁 REFUND TO SAVINGS
  // =========================
  if (order.sourceType === "savings") {

    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    savings.push({
      id: Date.now(),
      amount: Math.abs(order.total) || 0,

      type: "refund",
      note: order.sourceName || "Refund",
      purpose: reason,

      sourceId: sourceId,
      paymentType: order.paymentType || "Unknown",
      date: new Date().toISOString()
    });

    localStorage.setItem("savingsTransactions", JSON.stringify(savings));
  }

  // =========================
  // 🔵 UPDATE BUDGET
  // =========================
  //  if(order.sourceType === "budget") {

  //     let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

  //     let b = budgets.find(x => Number(x.id) === sourceId);

  //     if (b) {
  //       b.used = (b.used || 0) - Math.abs(order.total || 0);
  //       if (b.used < 0) b.used = 0;
  //     }

  //     localStorage.setItem("budgets", JSON.stringify(budgets));
  //   } i

  // =========================
  // 🧾 LOG REFUND
  // =========================
  let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

  expenses.push({
    id: Date.now(),
    amount: Math.abs(order.total) || 0,

    type: "refund",
    purpose: reason,

    sourceId: sourceId,
    sourceName: order.sourceName || "-",
    sourceType: order.sourceType,

    budgetId: order.budgetId,   // 🔥 CRITICAL FIX

    paymentType: order.paymentType || "Unknown",
    date: new Date().toISOString()
  });

  localStorage.setItem("expenses", JSON.stringify(expenses));

  // =========================
  // 🗑 REMOVE ORDER
  // =========================
  orders = orders.filter(o => o.id != deleteTargetId);
  localStorage.setItem("orders", JSON.stringify(orders));

  closeDeleteModal();
  renderOrders();
}


// =========================
// 💳 PAYMENT ICON
// =========================
function getPaymentIcon(type) {
  if (type === "UPI") return "📱";
  if (type === "Cash") return "💵";
  if (type === "Card") return "💳";
  return "💰";
}

/*
   ██████╗  ██████╗ ██████╗ ██╗ ██████╗██╗  ██╗  █████╗ ███╗   ██╗██╗███╗   ███╗███████╗
  ██╔════╝ ██╔═══██╗██╔══██╗██║██╔════╝██║  ██╔╝██╔══██╗████╗  ██║██║████╗ ████║██╔════╝
  ██║  ███╗██║   ██║██████╔╝██║██║     █████╔╝  ███████║██╔██╗ ██║██║██╔████╔██║█████╗
  ██║   ██║██║   ██║██╔═══╝ ██║██║     ██╔═ ██╗ ██╔══██║██║╚██╗██║██║██║╚██╔╝██║██╔══╝
  ╚██████╔╝╚██████╔╝██║     ██║╚██████╗██║  ██╗ ██║  ██║██║ ╚████║██║██║ ╚═╝ ██║███████╗
   ╚═════╝  ╚═════╝ ╚═╝     ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝╚═╝╚═╝     ╚═╝╚══════╝

   Signed by: Gopichanime
*/

// =====================================
// Author: Gopichanime
// Created: 2026
// Description: Money Tracker Core Logic
// =====================================
/*
   ____   ___  ____  ___ ____ _   _    _    _   _ ___ __  __ _____ 
  / ___| / _ \|  _ \|_ _/ ___| | | |  / \  | \ | |_ _|  \/  | ____|
 | |  _ | | | | |_) || | |   | |_| | / _ \ |  \| || || |\/| |  _|  
 | |_| || |_| |  __/ | | |___|  _  |/ ___ \| |\  || || |  | | |___ 
  \____| \___/|_|   |___\____|_| |_/_/   \_\_| \_|___|_|  |_|_____|

   Signed by: GOPICHANIME 🐉
*/