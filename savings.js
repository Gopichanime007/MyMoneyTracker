/* =========================
   💰 STORAGE
========================= */
function getSavings() {
  return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}

function saveSavings(data) {
  localStorage.setItem("savingsTransactions", JSON.stringify(data));
}

/* =========================
   ➕ ADD
========================= */
function addSavings() {
  let type = document.getElementById("sType").value;
  let amount = Number(document.getElementById("sAmount").value);
  let person = document.getElementById("sPerson").value;
  let note = document.getElementById("sNote").value;

  if (!amount) return alert("Enter amount");

  amount = type === "expense"
    ? -Math.abs(amount)
    : Math.abs(amount);

  let data = getSavings();

  data.push({
    id: Date.now(),
    type,
    amount,
    person,
    note,
    date: new Date().toISOString()
  });

  saveSavings(data);

  // reset
  document.getElementById("sAmount").value = "";
  document.getElementById("sPerson").value = "";
  document.getElementById("sNote").value = "";

  loadSavings();
  showSavingsScreen("home");
}

/* =========================
   📊 LOAD UI
========================= */
function loadSavings() {
  let data = getSavings();

  let total = data.reduce((sum, t) => sum + t.amount, 0);

  let balanceEl = document.getElementById("savingsBalance");
  if (balanceEl) {
    balanceEl.innerText = "₹" + total;
  }

  let container = document.getElementById("savingsHistory");
  if (!container) return;

  container.innerHTML = "";

  data.slice().reverse().forEach(t => {
    let div = document.createElement("div");
    div.className = "expense-item";

    div.innerHTML = `
      <strong>${t.person || "Self"}</strong> - ₹${t.amount}<br>
      <small>${t.type} • ${new Date(t.date).toLocaleString()}</small>
    `;

    container.appendChild(div);
  });
}

/* =========================
   🧭 NAVIGATION
========================= */
function showSavingsScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));

  let el = document.getElementById(id);
  if (el) el.classList.add("active");
}