// =========================
// 🚀 INIT
// =========================
// Initializes page: loads data, sets date, loads sources, applies theme
window.onload = function () {
    loadSavings();
    setTodayDate();
    loadSourceOptions();
    handleSavingsTypeChange(); // 👈 IMPORTANT
    loadBudgetYears();

    let theme = localStorage.getItem("theme") || "#4caf50";
    document.documentElement.style.setProperty("--theme", theme);
};

/* =========================
   🧠 MASTER LEDGER (SAVINGS)
========================= */
//Show Toast
let activeToast = null;

// Shows a single temporary toast message (replaces previous one to avoid spam)
function showToast(message, type = "info") {
    if (activeToast) activeToast.remove();

    let toast = document.createElement("div");
    toast.className = "simple-toast";
    toast.innerText = message;

    const colors = {
        success: "#4caf50",
        error: "#e53935",
        warning: "#fb8c00",
        info: "#333"
    };

    toast.style.background = colors[type] || "#333";

    document.body.appendChild(toast);
    activeToast = toast;

    setTimeout(() => {
        toast.remove();
        activeToast = null;
    }, 1500);
}
// =========================
// 📦 STORAGE
// =========================

// Fetch all savings transactions from localStorage
function getSavings() {
    return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}
// Save updated savings transactions into localStorage
function saveSavings(data) {
    localStorage.setItem("savingsTransactions", JSON.stringify(data));
}

// =========================
// 🏗️ ENTRY FACTORY
// =========================
// Creates a standardized savings entry object (used for all transaction types)
function createSavingsEntry({
    type,
    amount,
    sourceId = null,
    entity = "Cash",
    person = null,
    note = "",
    date = new Date().toISOString()
}) {
    return {
        id: Date.now(),

        type, // income | transfer | budget_allocation

        amount,

        sourceId,

        entity,

        person,

        note,

        date,

        monthKey: date.slice(0, 7),

        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// =========================
// ➕ ADD ENTRY
// =========================
// Handles adding income, transfer, or budget allocation into savings ledger
function addSavings() {
    let type = document.getElementById("sType").value;
    let amount = Number(document.getElementById("sAmount").value);
    let note = document.getElementById("sNote").value;
    let dateInput = document.getElementById("sDate").value;
    let entity = document.getElementById("sPayment").value;

    let period = document.getElementById("budgetPeriod")?.value;
    let budgetDate = document.getElementById("budgetDate")?.value;

    if (!amount || amount <= 0) {
        showToast("Enter valid amount ❗", "warning");
        return;
    }

    let selectedDate;

    if (!dateInput) {
        // ✅ No date → current time
        selectedDate = new Date();
    } else {
        let inputDate = new Date(dateInput);
        let today = new Date();

        if (inputDate.toDateString() === today.toDateString()) {
            // ✅ TODAY → current time
            selectedDate = new Date();
        } else {
            // ✅ PAST → END OF DAY (EOD)
            selectedDate = new Date(inputDate);
            selectedDate.setHours(23, 59, 59, 999);
        }
    }

    let date = selectedDate.toISOString();

    let data = getSavings();

    // =========================
    // 💰 INCOME
    // =========================
    if (type === "income") {
        let entry = createSavingsEntry({
            type: "income",
            amount: Math.abs(amount),
            entity,
            note,
            date
        });

        data.push(entry);
    }

    // =========================
    // 🔁 TRANSFER
    // =========================
    else if (type === "transfer") {

        let person = document.getElementById("sEntity").value;
        let sourceId = Number(document.getElementById("sourceSelect").value);

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let entry = createSavingsEntry({
            type: "transfer",
            amount: -Math.abs(amount),
            sourceId, // ✅ FIX
            person,
            entity,
            note,
            date
        });

        data.push(entry);
    }

    // =========================
    // 📦 BUDGET ALLOCATION
    // =========================
    else if (type === "withdraw_budget") {

        let sourceId = Number(document.getElementById("sourceSelect").value);

        if (!budgetDate) {
            showToast("Select budget date ❗", "warning");
            return;
        }

        if (!sourceId) {
            showToast("Select source ❗", "warning");
            return;
        }

        let budgetId = generateBudgetId(period, budgetDate);

        // ✅ create/update budget
        let entry = createSavingsEntry({
            type: "budget_allocation",
            amount: -Math.abs(amount),
            sourceId,
            entity,
            note,
            date
        });

        // 🔥 Correct call
        createOrUpdateBudget(budgetId, entry);

        data.push(entry);
    }
    console.log("Selected Date:", selectedDate);
    console.log("ISO Date:", selectedDate.toISOString());
    saveSavings(data);
    loadSavings();
    loadSourceOptions();

    showToast("Saved successfully ✅", "success");

    resetSavingsForm();
}

// =========================
// 📦 BUDGET CREATION (FROM SAVINGS)
// =========================
// Creates or updates monthly budget based on savings allocation
function createOrUpdateBudgetFromSavings(entry) {
    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

    let budgetId = "budget_" + entry.monthKey;

    let existing = budgets.find(b => b.budgetId === budgetId);

    if (existing) {
        existing.totalAllocated += Math.abs(entry.amount);
        existing.updatedAt = new Date().toISOString();
    } else {
        budgets.push({
            id: Date.now(),
            type: "budget",
            totalAllocated: Math.abs(entry.amount),
            sourceId: entry.sourceId,
            budgetId,
            entity: entry.entity,
            note: entry.note,
            date: entry.date,
            monthKey: entry.monthKey,
            createdAt: new Date().toISOString()
        });
    }

    localStorage.setItem("budgets", JSON.stringify(budgets));
}

// =========================
// 📊 LOAD UI
// =========================

// Calculates totals and updates savings dashboard UI
function loadSavings() {
    let data = getSavings();

    let total = data.reduce((sum, t) => sum + t.amount, 0);

    let allocated = data
        .filter(t => t.type === "budget_allocation")
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    let available = total;

    document.getElementById("savingsBalance").innerText = "₹" + total;

    let allocatedEl = document.getElementById("allocatedToBudget");
    if (allocatedEl) allocatedEl.innerText = "₹" + allocated;

    let availableEl = document.getElementById("availableBalance");
    if (availableEl) availableEl.innerText = "₹" + available;

    renderSavingsHistory(data);
}

// =========================
// 📜 HISTORY
// =========================
// Renders all savings transactions into UI list (latest first)
// function renderSavingsHistory(data) {
//     let container = document.getElementById("savingsHistory");
//     if (!container) return;

//     container.innerHTML = "";

//     data.slice().reverse().forEach(t => {
//         let div = document.createElement("div");
//         div.className = "expense-item";

//         let labelMap = {
//             income: "💰 Income",
//             transfer: "🔁 Transfer",
//             budget_allocation: "📦 Budget"
//         };

//         let label = labelMap[t.type] || t.type;
//         let color = t.amount < 0 ? "red" : "green";

//         div.innerHTML = `
//       <div>
//         <strong>${t.note || t.person || "Entry"}</strong><br>
//         <small>${label} • ${new Date(t.date).toLocaleString()}</small>
//       </div>
//       <div style="color:${color}; font-weight:600;">
//         ₹${Math.abs(t.amount)}
//       </div>
//     `;

//         container.appendChild(div);
//     });
// }
function renderSavingsHistory(data) {
    let container = document.getElementById("savingsHistory");
    if (!container) return;

    container.innerHTML = "";

    data.slice().reverse().forEach((t, index) => {

        let realIndex = data.length - 1 - index; // 🔥 FIX INDEX

        let div = document.createElement("div");
        div.className = "expense-item";

        let labelMap = {
            income: "💰 Income",
            transfer: "🔁 Transfer",
            budget_allocation: "📦 Budget"
        };

        let label = labelMap[t.type] || t.type;
        let color = t.amount < 0 ? "red" : "green";

        div.innerHTML = `
        <div>
            <strong>${t.note || t.person || "Entry"}</strong><br>
            <small>${label} • ${new Date(t.date).toLocaleString()}</small>
        </div>

        <div style="display:flex; align-items:center; gap:10px;">
            <span style="color:${color}; font-weight:600;">
                ₹${Math.abs(t.amount)}
            </span>

            <button onclick="deleteSavings(${realIndex})" 
                    style="background:none; border:none; cursor:pointer; font-size:16px;">
                🗑
            </button>
        </div>
        `;

        container.appendChild(div);
    });
}
// =========================
// 🔗 SOURCES
// =========================
// Returns all income entries (used as available sources)
function getAvailableSources() {
    return getSavings().filter(t => t.type === "income");
}
// Loads income sources into dropdown with remaining balance
function loadSourceOptions() {
    let select = document.getElementById("sourceSelect");
    if (!select) return;

    let data = getSavings();
    let sources = data.filter(t => t.type === "income");

    select.innerHTML = "";

    if (!sources.length) {
        let option = document.createElement("option");
        option.value = "";
        option.textContent = "No sources available";
        select.appendChild(option);
        return;
    }

    select.innerHTML = "<option value=''>Select Source</option>";

    sources.forEach(s => {
        let used = data
            .filter(t => Number(t.sourceId) === s.id)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        let remaining = s.amount - used;

        if (remaining <= 0) return;

        let option = document.createElement("option");
        option.value = s.id;
        option.textContent = `${s.note || "Income"} (₹${remaining} left)`;

        select.appendChild(option);
    });
}

// =========================
// 🔄 RESET FORM
// =========================
function resetSavingsForm() {
    document.getElementById("sAmount").value = "";
    document.getElementById("sNote").value = "";
    document.getElementById("sourceSelect").value = "";
    document.getElementById("sType").value = "income";

    setTodayDate();
}

// =========================
// 📅 DEFAULT DATE
// =========================
// Sets today's date as default in date input field
function setTodayDate() {
    let today = new Date().toISOString().split("T")[0];
    let dateInput = document.getElementById("sDate");

    if (dateInput) {
        dateInput.value = today;
    }
}



//Filter
let filteredSavingsData = [];
// Filters savings data by time (today, week, month, all) and updates UI
function handleSavingsFilter(type) {
    let data = getSavings();
    let now = new Date();

    // 🆕 CUSTOM PERIOD
    if (type === "period") {
        let modal = document.getElementById("savingsDateModal");
        if (modal) modal.style.display = "flex";
        return;
    }

    if (type === "today") {
        filteredSavingsData = data.filter(t =>
            new Date(t.date).toDateString() === now.toDateString()
        );
    }
    else if (type === "week") {
        let start = new Date();
        start.setDate(now.getDate() - 7);

        filteredSavingsData = data.filter(t =>
            new Date(t.date) >= start
        );
    }
    else if (type === "month") {
        filteredSavingsData = data.filter(t => {
            let d = new Date(t.date);
            return d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear();
        });
    }
    else {
        filteredSavingsData = data;
    }

    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);
}

// Generates income vs expense chart using filtered or full data
function loadSavingsGraph(data) {
    let d = data || getSavings();

    let income = 0;
    let expense = 0;

    d.forEach(t => {
        if (t.amount > 0) income += t.amount;
        else expense += Math.abs(t.amount);
    });

    let ctx = document.getElementById("savingsChart");
    if (!ctx) return;

    if (window.sChart) window.sChart.destroy();

    window.sChart = new Chart(ctx, {
        type: "doughnut",
        data: {
            labels: ["Income", "Expense"],
            datasets: [{
                data: [income, expense],
                backgroundColor: ["#4caf50", "#ff5252"]
            }]
        }
    });
}

// Switches between different UI screens (home, graph, income, details)
function showSavingsScreen(id) {
    // Switch screens
    document.querySelectorAll(".screen").forEach(s =>
        s.classList.remove("active")
    );

    document.getElementById(id).classList.add("active");

    // 🔥 FIX: update nav active button
    document.querySelectorAll(".nav button").forEach(btn => {
        btn.classList.remove("active");
    });

    let activeBtn = document.querySelector(`.nav button[data-screen="${id}"]`);
    if (activeBtn) activeBtn.classList.add("active");

    // Existing logic
    if (id === "graph") {
        loadSavingsGraph(filteredSavingsData.length ? filteredSavingsData : getSavings());
    }

    if (id === "income") {
        renderIncomeList();
    }
}

// Calculates total used and remaining amount for a selected income source
function getSourceSummary(sourceId) {
    let data = getSavings();

    let income = data.find(t => t.id === Number(sourceId));
    if (!income) return null;

    let outgoing = data.filter(t => Number(t.sourceId) === income.id);

    let totalOutgoing = outgoing.reduce(
        (sum, t) => sum + Math.abs(t.amount),
        0
    );

    return {
        name: income.note || "Income",
        totalIncome: income.amount,
        totalOutgoing,
        remaining: income.amount - totalOutgoing,
        entries: outgoing
    };
}

// Displays detailed breakdown of a selected income source
function renderSourceDetails(sourceId) {
    let summary = getSourceSummary(sourceId);
    if (!summary) return;

    let container = document.getElementById("sourceDetails");
    if (!container) return;

    container.innerHTML = `
    <h3>${summary.name}</h3>
    <p>💰 Income: ₹${summary.totalIncome}</p>
    <p>📉 Used: ₹${summary.totalOutgoing}</p>
    <p>🟢 Remaining: ₹${summary.remaining}</p>
  `;
}

// Renders all income entries and allows navigation to detailed view
function renderIncomeList() {
    let data = getSavings();
    let incomes = data.filter(t => t.type === "income");

    let container = document.getElementById("incomeList");
    if (!container) return;

    container.innerHTML = "";

    incomes.slice().reverse().forEach(i => {

        // 🔥 CALCULATE USED
        let used = data
            .filter(t => Number(t.sourceId) === i.id)
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);

        let remaining = i.amount - used;

        let div = document.createElement("div");
        div.className = "income-card";

        let date = new Date(i.date);

        // 📅 Month + Year (from old version)
        let monthYear = date.toLocaleString("en-IN", {
            month: "short",
            year: "numeric"
        });

        // 🏷 Name logic
        let name = i.note || `${monthYear} Income`;

        // 🔥 Status text (merged logic)
        let statusText = "";
        let statusClass = "";

        if (remaining <= 0) {
            statusText = "❌ All used";
            statusClass = "red";
        } else {
            statusText = `₹${remaining} left`;
            statusClass = "green";
        }

        div.innerHTML = `
      <div class="income-left">
        <strong>${name}</strong>
        <small>${monthYear}</small>
      </div>

      <div class="income-right">
        <span class="amount">₹${i.amount}</span>
        <span class="remaining ${statusClass}">
          ${statusText}
        </span>
      </div>
    `;

        // 🔥 CLICK → DETAILS
        div.style.cursor = "pointer";
        div.onclick = () => {
            showSavingsScreen("details");
            renderSourceDetails(i.id);
        };

        container.appendChild(div);
    });
}
// Closes the savings date filter modal
function closeSavingsModal() {
    let modal = document.getElementById("savingsDateModal");
    if (modal) modal.style.display = "none";
}

// Controls UI fields based on selected type (income / transfer / budget)
function handleSavingsTypeChange() {
    let type = document.getElementById("sType").value;

    let source = document.getElementById("sourceWrapper");
    let budget = document.getElementById("budgetConfig");

    if (type === "transfer") {
        source.style.display = "block";
        budget.style.display = "none";

    } else if (type === "withdraw_budget") {
        source.style.display = "block";   // 🔥 CHANGE HERE
        budget.style.display = "block";

    } else {
        source.style.display = "none";
        budget.style.display = "none";
    }
}

function loadBudgetYears() {
    let yearSelect = document.getElementById("budgetYear");
    if (!yearSelect) return;

    let currentYear = new Date().getFullYear();

    for (let i = currentYear - 2; i <= currentYear + 5; i++) {
        let opt = document.createElement("option");
        opt.value = i;
        opt.textContent = i;
        yearSelect.appendChild(opt);
    }

    yearSelect.value = currentYear;
}

function applySavingsDateFilter() {
    let from = document.getElementById("sFromDate").value;
    let to = document.getElementById("sToDate").value;

    if (!from || !to) {
        showToast("Select both dates ❗", "warning");
        return;
    }

    let fromDate = new Date(from);
    let toDate = new Date(to);

    let data = getSavings();

    filteredSavingsData = data.filter(t => {
        let d = new Date(t.date);
        return d >= fromDate && d <= toDate;
    });

    renderSavingsHistory(filteredSavingsData);
    loadSavingsGraph(filteredSavingsData);

    closeSavingsModal();
}

function goToDashboard() {
    window.location.href = "index.html";
}
// Navigate to transfers page (future)
function goToTransfers() {
    showToast("Transfers coming soon 🔁");
}

// =========================
// 📄 EXPORT SAVINGS PDF
// =========================
// Generates a structured savings report with header, table, and totals
function exportSavingsPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let data = getSavings();

    if (!data.length) {
        showToast("No data to export", "warning");
        return;
    }

    let y = 20;

    // =========================
    // 🟢 HEADER
    // =========================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Savings Report", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 20);

    y = 30;

    // =========================
    // 🟡 TABLE HEADER
    // =========================
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);

    doc.text("Date", 14, y);
    doc.text("Type", 50, y);
    doc.text("Entity", 80, y);
    doc.text("Amount", 140, y);

    y += 6;

    doc.setDrawColor(200);
    doc.line(14, y, 195, y);

    y += 6;

    // =========================
    // 🔵 DATA ROWS
    // =========================
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);

    let totalIncome = 0;
    let totalExpense = 0;

    data.forEach((t) => {

        let date = new Date(t.date).toLocaleDateString("en-IN");
        let type = t.type || "-";
        let entity = t.entity || "-";
        let amount = t.amount || 0;

        // Totals
        if (amount > 0) totalIncome += amount;
        else totalExpense += Math.abs(amount);

        // Page break
        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        // Color (green for +, red for -)
        if (amount < 0) {
            doc.setTextColor(200, 0, 0);
        } else {
            doc.setTextColor(0, 150, 0);
        }

        doc.text(date, 14, y);
        doc.text(type, 50, y);
        doc.text(entity, 80, y);
        doc.text(`₹${Math.abs(amount)}`, 140, y);

        doc.setTextColor(0);

        y += 7;
    });

    // =========================
    // 🟣 SUMMARY
    // =========================
    y += 10;

    doc.setDrawColor(180);
    doc.line(14, y, 195, y);

    y += 8;

    doc.setFont("helvetica", "bold");

    doc.setTextColor(0, 150, 0);
    doc.text(`Total Income: ₹${totalIncome}`, 14, y);

    y += 7;

    doc.setTextColor(200, 0, 0);
    doc.text(`Total Outgoing: ₹${totalExpense}`, 14, y);

    y += 7;

    doc.setTextColor(0);
    doc.text(`Net Balance: ₹${totalIncome - totalExpense}`, 14, y);

    // =========================
    // 💾 SAVE
    // =========================
    doc.save("savings-report.pdf");

    showToast("Savings report downloaded 📄", "success");
}
// Converts HEX color to RGB (used for dynamic theming if needed)
function hexToRgb(hex) {
    hex = hex.replace("#", "");

    let bigint = parseInt(hex, 16);

    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

// =========================
// ❌ DELETE SAVINGS ENTRY
// =========================
// Removes a savings transaction by index
function deleteSavings(index) {
    let data = getSavings();

    data.splice(index, 1);

    saveSavings(data);

    loadSavings(); // refresh UI

    showToast("Deleted successfully 🗑", "success");
}


function handleBudgetPeriodChange() {

    let period = document.getElementById("budgetPeriod").value;
    let input = document.getElementById("budgetDate");

    if (period === "month") {
        input.type = "month";
    } else {
        input.type = "date";
    }

    // ✅ auto set today if empty
    if (!input.value) {
        input.valueAsDate = new Date();
    }
}

function generateBudgetId(period, date) {

    let d = new Date(date);

    if (period === "day") {
        return "budget_day_" + d.toLocaleDateString("en-CA");
    }

    if (period === "week") {
        let start = new Date(d);
        start.setDate(d.getDate() - d.getDay());
        return "budget_week_" + start.toLocaleDateString("en-CA");
    }

    if (period === "month") {
        let y = d.getFullYear();
        let m = String(d.getMonth() + 1).padStart(2, "0");
        return "budget_" + y + "_" + m;
    }

    return null;
}


function createOrUpdateBudget(budgetId, entry) {
    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    // 🔥 filter all entries for this budget
    let related = savings.filter(t =>
        t.type === "budget_allocation" &&
        t.monthKey === entry.monthKey
    );

    let total = related.reduce((sum, t) => sum + Math.abs(t.amount), 0);

    let existing = budgets.find(b => b.budgetId === budgetId);

    if (existing) {
        existing.totalAllocated = total; // 🔥 FIX (not +=)
        existing.updatedAt = new Date().toISOString();
    } else {
        budgets.push({
            id: Date.now(),
            type: "budget",

            budgetId,
            sourceId: entry.sourceId,

            totalAllocated: total,

            entity: entry.entity,
            note: entry.note,

            date: entry.date,
            monthKey: entry.monthKey,

            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }

    localStorage.setItem("budgets", JSON.stringify(budgets));
}