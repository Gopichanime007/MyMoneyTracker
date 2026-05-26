const isSavingsPage = window.location.pathname.includes("savings");
let currentFilteredExpenses = [];
// =========================
// 💱 CURRENCY CORE SYSTEM
// =========================

// Base currency (never changes)
const BASE_CURRENCY = "INR";

// Currency symbols
const currencySymbols = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£"
};

// Static exchange rates (relative to INR)
const exchangeRates = {
    INR: 1,
    USD: 0.012,
    EUR: 0.011,
    GBP: 0.0095
};

// =========================
// 🧠 USER SELECTED CURRENCY
// =========================


function getCurrencyCode() {
    try {
        let code = localStorage.getItem("currencyCode") || "INR";
        return code;
    } catch (err) {
        return "INR";
    }
}

function setCurrencyCode(code) {
    try {
        localStorage.setItem("currencyCode", code);
    } catch (err) {
    }
}
// =========================
// 🔄 CONVERSION
// =========================

// Convert from BASE (INR) → Selected Currency
function convertFromBase(amount) {
    try {
        let code = getCurrencyCode();
        let rate = exchangeRates[code] || 1;
        let result = amount * rate;

        return result;
    } catch (err) {
        return amount;
    }
}

// Convert from Selected Currency → BASE (INR)
function convertToBase(amount) {
    try {
        let code = getCurrencyCode();
        let rate = exchangeRates[code] || 1;
        let result = amount / rate;
        return result;
    } catch (err) {
        return amount;
    }
}

// =========================
// 💰 FORMAT (USE EVERYWHERE)
// =========================

function formatCurrency(amount) {
    try {
        let code = getCurrencyCode();
        let symbol = currencySymbols[code] || "₹";

        let converted = convertFromBase(amount);

        let result = symbol + " " + converted.toFixed(2);

        return result;

    } catch (err) {
        return amount;
    }
}


function changeCurrency(code) {

    try {
        setCurrencyCode(code);

        loadDashboard();
        loadHistory();
        loadBudgetScreen();
        renderBudgetEntries();
        renderCategoryBreakdown(groupByCategory(getExpenses()));
        updateBudgetEfficiency();


    } catch (err) {
    }
}

/* =========================
   📦 STORAGE LAYER
========================= */

function getExpenses() {

    try {
        let data = JSON.parse(localStorage.getItem("expenses")) || [];
        return data;
    } catch (err) {
        return [];
    }
}
function calculateSpentForPeriod(start, end) {

    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

    let startTime = new Date(start).getTime();
    let endTime = end
        ? new Date(end).getTime()
        : new Date().getTime();

    return expenses
        .filter(e => {
            let d = new Date(e.date).getTime();
            return d >= startTime && d <= endTime && e.amount < 0;
        })
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);
}

// function getBudgetForPeriod(start, end) {

//     let budgets = JSON.parse(localStorage.getItem("budgets")) || [];

//     // build periodKey
//     let s = new Date(start).toISOString().slice(0, 10);
//     let e = end
//         ? new Date(end).toISOString().slice(0, 10)
//         : new Date().toISOString().slice(0, 10);

//     let periodKey = `${s}_to_${e}`;

//     // find matching budgets
//     let filtered = budgets.filter(b => b.periodKey === periodKey);

//     if (!filtered.length) return null;

//     return {
//         totalAllocated: filtered.reduce((sum, b) => sum + (b.totalAllocated || 0), 0)
//     };
// }

function getBudgetForPeriod(start, end) {

    let budgets =
        JSON.parse(
            localStorage.getItem("budgets")
        ) || [];

    function safeDate(date) {

        let d = new Date(date);

        return [
            d.getFullYear(),
            String(d.getMonth() + 1)
                .padStart(2, "0"),
            String(d.getDate())
                .padStart(2, "0")
        ].join("-");
    }

    let s = safeDate(start);

    let e = end
        ? safeDate(end)
        : safeDate(new Date());

    let periodKey =
        `${s}_to_${e}`;

    let filtered = budgets.filter(
        b => b.periodKey === periodKey
    );

    if (!filtered.length)
        return null;

    return {
        totalAllocated:
            filtered.reduce(
                (sum, b) =>
                    sum + (b.totalAllocated || 0),
                0
            )
    };
}
function saveExpenses(data) {

    try {
        localStorage.setItem("expenses", JSON.stringify(data));
    } catch (err) {
    }
}

function getBudgets() {

    try {
        let data = JSON.parse(localStorage.getItem("budgets")) || [];
        return data;
    } catch (err) {
        return [];
    }
}
function saveBudgets(data) {

    try {
        localStorage.setItem("budgets", JSON.stringify(data));
    } catch (err) {
    }
}


function getSavings() {
    return JSON.parse(localStorage.getItem("savingsTransactions")) || [];
}

function saveSavings(data) {
    localStorage.setItem("savingsTransactions", JSON.stringify(data));
}


/* =========================
   🧠 CORE LOGIC
========================= */

// ➕ Add Expense

function addExpense(obj) {

    try {

        let expenses = getExpenses();

        let type =
            obj.type ||
            (obj.amount < 0 ? "expense" : "income");

        let category =
            obj.category || "Others";

        // =========================
        // 💱 BASE CONVERSION
        // =========================
        let baseAmount =
            convertToBase(obj.amount);

        // =========================
        // 📅 SAFE DATE
        // =========================
        let finalDate =
            obj.date ||
            new Date().toISOString();

        let dateObj =
            new Date(finalDate);

        // =========================
        // 📦 MONTH KEY
        // =========================
        let monthKey = [
            dateObj.getFullYear(),
            String(dateObj.getMonth() + 1)
                .padStart(2, "0")
        ].join("-");

        // =========================
        // 🧠 ENTRY
        // =========================
        let newEntry = {

            id:
                crypto.randomUUID
                    ? crypto.randomUUID()
                    : "exp_" + Date.now() + "_" + Math.random(),

            type,

            amount: baseAmount,

            category,

            purpose:
                obj.purpose || "",

            budgetId:
                obj.budgetId || null,

            paymentType:
                obj.paymentType ||
                obj.entity ||
                "Cash",

            entity:
                obj.entity ||
                obj.paymentType ||
                "Cash",

            date: finalDate,

            monthKey,

            createdAt:
                new Date().toISOString(),

            updatedAt:
                new Date().toISOString(),

            splitId: obj.splitId || null,
            splitIndex: obj.splitIndex || null,
            isSplit: obj.isSplit || false,
            linkedTransactionId: obj.linkedTransactionId || null,

            // deep-clone allocationTrail if provided; otherwise, if budgetId provided for expense/loss,
            // create a single allocation entry for backward compatibility
            allocationTrail: obj.allocationTrail && Array.isArray(obj.allocationTrail)
                ? JSON.parse(JSON.stringify(obj.allocationTrail))
                : ((obj.budgetId && (type === "expense" || type === "loss"))
                    ? [{ budgetId: obj.budgetId, amount: Math.abs(baseAmount) }]
                    : [])
                    ,
                    attachmentId: obj.attachmentId || null
        };

        expenses.push(newEntry);

        saveExpenses(expenses);

        return newEntry;

    } catch (err) {

        console.error("addExpense error:", err);

        return null;
    }
}


// ❌ Delete Expense
// function deleteExpenseByIndex(index) {

//     try {
//         let expenses = getExpenses();

//         if (index < 0 || index >= expenses.length) return;

//         expenses.splice(index, 1);

//         saveExpenses(expenses);


//     } catch (err) {
//     }
// }



// 📊 Budget Balance
function getBudgetBalance(budgetId) {
    let expenses = getExpenses();

    let spent = expenses
        .filter(e =>
            e.budgetId === budgetId &&
            e.amount < 0
        )
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let budgets = getBudgets();

    let allocated = budgets
        .filter(b => b.budgetId === budgetId)
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    return allocated - spent;
}


/* =========================
   🔔 SIMPLE TOAST (NO SPAM)
========================= */


let toastTimeout;

function showToast(msg) {

    try {

        clearTimeout(toastTimeout);

        let el = document.getElementById("toast");

        if (!el) {

            el = document.createElement("div");
            el.id = "toast";

            document.body.appendChild(el);
        }

        el.innerText = msg;

        // ✅ show
        el.classList.add("show-toast");

        // ✅ auto hide
        toastTimeout = setTimeout(() => {

            el.classList.remove("show-toast");

        }, 1500);

    } catch (err) {

        console.error(err);
    }
}



/* =========================
   🖥️ UI FUNCTIONS
========================= */

// 📜 Load History
function loadHistory(list = getExpenses()) {

    try {
        currentFilteredExpenses = list;

        let container = document.getElementById("historyList");
        if (!container) return;

        container.innerHTML = "";

        if (!list.length) {
            container.innerHTML = `<p style="text-align:center; color:#888;">No data yet 📭</p>`;
            return;
        }

        list.forEach((e, index) => {

            let div = document.createElement("div");
            div.className = "expense-item";

            let category = e.category || e.type || "Entry";
            let purpose = e.purpose ? ` • ${e.purpose}` : "";
            let title = category + purpose;
            let amount = formatCurrency(e.amount);
            let color = e.amount < 0 ? "#ff5252" : "#4caf50";

            let meta = `${e.paymentType || e.entity || e.sourceName || "-"}`;
            let date = new Date(e.date).toLocaleString("en-IN");

            // left: optional thumbnail + text
            div.innerHTML = `
                <div style="display:flex;gap:8px;align-items:center;">
                  <div class="expense-thumb" data-attachment-id="${e.attachmentId||''}">
                    ${e.attachmentId?'<img class="remo-attachment-thumb" src="" alt="attachment" />':''}
                  </div>
                  <div>
                    <strong>${title}</strong><br>
                    <small style="color:#888;">${meta} • ${date}</small>
                  </div>
                </div>

                <div style="text-align:right;">
                    <div style="color:${color}; font-weight:600;">${amount}</div>
                    <button class="delete-btn" onclick="deleteExpenseUI('${e.id}')" title="Delete"> 
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18"></path>
                        <path d="M8 6V4h8v2"></path>
                        <path d="M19 6l-1 14H6L5 6"></path>
                        <path d="M10 11v6"></path>
                        <path d="M14 11v6"></path>
                      </svg>
                    </button>
                </div>
            `;

            // after inserting, if attachment present, populate thumbnail
            if (e.attachmentId) {
                try{
                    const thumbEl = div.querySelector('.remo-attachment-thumb');
                    if(thumbEl){
                        const loader = window.reMoAttachments && window.reMoAttachments.getThumbnailUrl ? window.reMoAttachments.getThumbnailUrl : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.getThumbnailUrl);
                        if(loader){
                            loader(e.attachmentId).then(src=>{ if(src) thumbEl.src = src; }).catch(()=>{});
                        } else {
                            // fallback to preview via localStorage API
                            const prev = window.reMoAttachments && window.reMoAttachments.getPreview ? window.reMoAttachments.getPreview(e.attachmentId) : null;
                            if(prev) thumbEl.src = prev;
                        }
                        // click to open full viewer
                        thumbEl.addEventListener('click', async (ev)=>{
                            ev.stopPropagation();
                            const loaderFull = window.reMoAttachments && window.reMoAttachments.getImageUrl ? window.reMoAttachments.getImageUrl : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.getImageUrl);
                            if(loaderFull){ const src = await loaderFull(e.attachmentId); if(src) openAttachmentViewer(src); }
                        });
                    }
                }catch(err){console.warn('thumb render err',err)}
            }

            container.appendChild(div);
        });

    } catch (err) {
        console.error("History error:", err);
    }
}


function deleteExpenseUI(id) {

    try {

        let expenses = getExpenses();

        let entry = getExpenses().find(e => String(e.id) === String(id));

        if (!entry) return;

        // 🔥 DELETE SPLIT GROUP
        if (entry.splitId) {

            expenses = expenses.filter(
                e => e.splitId !== entry.splitId
            );

        } else {

            expenses = expenses.filter(
                e => e.id !== entry.id
            );
        }

        saveExpenses(expenses);

        loadHistory();
        loadDashboard();
        loadGraph();
        updateBudgetEfficiency();
        renderBudgetEntries();
        loadBudgetOptions();

        showToast("Deleted");

    } catch (err) {

        console.error(err);
    }
}


/* =========================
   ➕ FORM HANDLER
========================= */

async function handleAddExpense() {

    let amount = Number(document.getElementById("amount")?.value);
    let category = document.getElementById("category")?.value;
    let purpose = document.getElementById("purpose")?.value;
    let date = document.getElementById("expenseDate")?.value;
    let type = document.getElementById("entryType")?.value;
    let paymentType = document.getElementById("paymentType")?.value;
    let budgetId = document.getElementById("budgetSelect")?.value;

    // ✅ VALIDATION
    if (!amount) {
        showToast("Enter amount");
        return;
    }

    if (type === "expense" && !budgetId) {
        showToast("Select budget");
        return;
    }

    // ✅ SIGN FIX
    amount = type === "expense"
        ? -Math.abs(amount)
        : Math.abs(amount);

    // =========================
    // 🧠 DATE FIX LOGIC
    // =========================
    let selectedDate = date ? new Date(date) : new Date();
    let today = new Date();

    if (selectedDate.toDateString() === today.toDateString()) {
        // ✅ TODAY → current time
        selectedDate = new Date();
    } else {
        // ✅ PAST → end of day
        selectedDate.setHours(23, 59, 59, 999);
    }

    // =========================
    // ➕ SAVE EXPENSE
    // =========================
    // addExpense({
    //     amount,
    //     category,
    //     purpose,
    //     date: selectedDate.toISOString(), // ✅ FIXED
    //     type,
    //     paymentType,
    //     budgetId
    // });

    if (type === "expense") {
        // handle possible attachment (store first to get attachmentId)
        const attachmentId = await storeAttachmentFromInput('expenseAttachment');
        await handleExpenseSave(Math.abs(amount), attachmentId);
        return;
    }
    // non-expense flows (income, transfer etc.) may still have attachments
    const nonExpAttachmentId = await storeAttachmentFromInput('expenseAttachment');
    addExpense({
        amount,
        category,
        purpose,
        date: selectedDate.toISOString(),
        type,
        paymentType,
        budgetId,
        linkedTransactionId,
        attachmentId: nonExpAttachmentId
    });
    // =========================
    // 🔄 UI UPDATES
    // =========================
    showToast("Added");

    resetForm();
    loadHistory();
    loadBudgetOptions();
    loadDashboard();   // 🔥 important
    loadGraph();
    updateProgressBar();
    updateBudgetEfficiency();
    renderBudgetEntries();
    loadBudgetOptions();  // 🔥 refresh graph
}


// 🧹 Reset Form
function resetForm() {
    document.getElementById("amount").value = "";
    document.getElementById("purpose").value = "";

    let today = new Date().toISOString().split("T")[0];
    document.getElementById("expenseDate").value = today;
}

function saveExpenseDirect(amount, budget) {

    addExpense({
        amount: -Math.abs(amount),
        budgetId: budget.budgetId,
        category: "General",
        purpose: "Auto Split",
        paymentType: "Auto"
    });

}

// ✅ ALWAYS RUN FOOTER (independent)
window.addEventListener("load", function () {
    if (isSavingsPage) {
        console.log("🚫 script.js blocked on savings page");
        return;
    }
    try {
        injectGlobalFooter();

        loadHistory();
        initCategories();
        loadTheme();
        updateUI();
        loadBudgetOptions();
        loadDashboard();
        loadBudgetScreen();
        loadGraph("day");
        updateBudgetEfficiency();

        let today = new Date().toISOString().split("T")[0];
        let dateInput = document.getElementById("expenseDate");
        if (dateInput) dateInput.value = today;

        renderCategoryList();
        setDefaultDate();
        bindRemainingCard();
        renderBudgetEntries();
        renderCategoryBreakdown();
        startHeadline();

    } catch (e) {
    }
});
function showScreen(id) {
    const screens = document.querySelectorAll(".screen");
    const buttons = document.querySelectorAll(".nav button");

    screens.forEach(s => s.classList.remove("active"));
    document.getElementById(id)?.classList.add("active");

    buttons.forEach(btn => btn.classList.remove("active"));
    document.querySelector(`[data-screen="${id}"]`)?.classList.add("active");

    if (id === "history") loadHistory();
    if (id === "budgetEntries") {
        renderBudgetEntries();
    }
    if (id === "graph") {
        loadGraph();
    }
}

function getCategories() {
    return JSON.parse(localStorage.getItem("categories")) || [];
}

function saveCategories(data) {
    localStorage.setItem("categories", JSON.stringify(data));
}

function initCategories() {
    let categories = getCategories();

    if (!categories.length) {
        categories = ["Food", "Travel", "Bills", "Entertainment", "Loan", "Recovery", "Others"];
        saveCategories(categories);
    }

    loadCategories();
}

function loadCategories() {
    let select = document.getElementById("category");
    if (!select) return;

    let categories = getCategories();

    select.innerHTML = "";

    //let categories = getCategories();

    if (!categories.length) {
        let option = document.createElement("option");
        option.value = "";
        option.textContent = "No categories - Add one";
        select.appendChild(option);
        return;
    }

    categories.forEach(cat => {
        let option = document.createElement("option");
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function addCategory() {
    let input = document.getElementById("newCategory");
    let val = input.value.trim();

    if (!val) return;

    let categories = getCategories();

    if (categories.includes(val)) {
        showToast("Already exists");
        return;
    }

    categories.push(val);
    saveCategories(categories);

    input.value = "";

    loadCategories();
    renderCategoryList();
}

function deleteCategory(index) {
    let categories = getCategories();

    categories.splice(index, 1);

    saveCategories(categories);

    loadCategories();
    renderCategoryList();
}

function renderCategoryList() {
    let container = document.getElementById("categoryList");
    if (!container) return;

    let categories = getCategories();

    container.innerHTML = "";

    categories.forEach((cat, i) => {
        let div = document.createElement("div");

        div.innerHTML = `
  <div class="cat-row">
    <span class="cat-name">${cat}</span>
    <button class="cat-delete" onclick="deleteCategory(${i})">✕</button>
  </div>
`;

        container.appendChild(div);
    });
}


function setDefaultDate() {
    let today = new Date().toISOString().split("T")[0];
    let el = document.getElementById("expenseDate");

    if (el) el.value = today;
}

function showDate() {
    let el = document.getElementById("dateDisplay");
    if (el) el.innerText = new Date().toLocaleString();
}

function changeTheme(c) {
    localStorage.setItem("theme", c);
    document.documentElement.style.setProperty("--theme", c);
}

function loadTheme() {
    let t = localStorage.getItem("theme");
    if (t) changeTheme(t);
}

function updateUI() {
    let expenses = getExpenses();

    let total = expenses.reduce((s, e) => s + e.amount, 0);

    let spent = expenses
        .filter(e => e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    let income = expenses
        .filter(e => e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    let elSpent = document.getElementById("spent");
    let elIncome = document.getElementById("income");

    if (elSpent) elSpent.innerText = formatCurrency(spent);
    if (elIncome) elIncome.innerText = formatCurrency(income);
}

// function handleFilter(type) {
//     let expenses = getExpenses();
//let now = new Date(); // ✅ rename

//     let filtered = expenses.filter(e => {
//         let d = new Date(e.date);

//         if (type === "today") return d.toDateString() === now.toDateString();

//         if (type === "month") {
//             return (
//                 d.getMonth() === now.getMonth() &&
//                 d.getFullYear() === now.getFullYear()
//             );
//         }

//         return true;
//     });

//     loadHistory(filtered);
// }

function getSelectedBudgetId() {
    let select = document.getElementById("budgetSelect");
    return select ? select.value : null;
}


function applyDateFilter() {

    const from =
        document.getElementById("fromDate").value;

    const to =
        document.getElementById("toDate").value;

    const expenses = getExpenses();

    function normalize(date) {

        let d = new Date(date);

        return new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
        ).getTime();
    }

    const fromTime =
        from ? normalize(from) : null;

    const toTime =
        to ? normalize(to) : null;

    const filtered = expenses.filter(e => {

        let d = normalize(e.date);

        if (fromTime && !toTime) {
            return d === fromTime;
        }

        if (!fromTime && toTime) {
            return d <= toTime;
        }

        if (fromTime && toTime) {
            return d >= fromTime &&
                d <= toTime;
        }

        return true;
    });

    loadHistory(filtered);

    if (typeof loadGraph === "function") {

        loadGraph(
            "custom",
            filtered,
            {
                start: from,
                end: to
            }
        );
    }

    if (typeof renderCategoryBreakdown === "function") {

        renderCategoryBreakdown(
            groupByCategory(filtered)
        );
    }
}

function applyPeriod(type) {

    let expenses = getExpenses();

    let filtered =
        filterDataByType(type, expenses);

    loadHistory(filtered);

    if (typeof loadGraph === "function") {
        loadGraph(type, filtered);
    }

    if (typeof renderCategoryBreakdown === "function") {
        renderCategoryBreakdown(
            groupByCategory(filtered)
        );
    }
}

function getInsights() {
    let data = getExpenses();

    if (!data.length) return;

    let total = data.reduce((s, e) => s + Math.abs(e.amount), 0);

    let topCategory = {};

    data.forEach(e => {
        if (!topCategory[e.category]) topCategory[e.category] = 0;
        topCategory[e.category] += Math.abs(e.amount);
    });

    let maxCat = Object.keys(topCategory).reduce((a, b) =>
        topCategory[a] > topCategory[b] ? a : b
    );

    showToast(`Top spending: ${maxCat}`);
}

function openDateModal() {
    let modal = document.getElementById("dateModal");
    if (modal) modal.style.display = "flex";
}

function closeDateModal() {
    let modal = document.getElementById("dateModal");
    if (modal) modal.style.display = "none";
}


function downloadPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const dataSource = currentFilteredExpenses.length
        ? currentFilteredExpenses
        : getExpenses();

    let y = 12;

    // =========================
    // 🟢 HEADER CARD
    // =========================
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(10, 8, 190, 22, 3, 3, "F");

    doc.setFontSize(16); // 🔽 reduced
    doc.setFont(undefined, "bold");
    doc.text("Money Tracker Report", 14, 17);

    doc.setFontSize(8); // 🔽 reduced
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);
    doc.text(`Total Entries: ${dataSource.length}`, 14, 26);

    doc.setTextColor(0);
    y = 34;

    // =========================
    // 💰 SUMMARY CARDS
    // =========================
    const drawCard = (x, title, value, r, g, b) => {
        doc.setFillColor(252, 252, 252);
        doc.setDrawColor(230);
        doc.roundedRect(x, y, 60, 18, 3, 3, "FD");

        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(title, x + 5, y + 6);

        doc.setFontSize(11);
        doc.setTextColor(r, g, b);
        doc.text(`${formatCurrencyPDF(value)}`, x + 5, y + 13);
    };

    const totalIncome = dataSource.filter(e => e.amount > 0)
        .reduce((s, e) => s + e.amount, 0);

    const totalExpense = dataSource.filter(e => e.amount < 0)
        .reduce((s, e) => s + Math.abs(e.amount), 0);

    const net = totalIncome - totalExpense;

    drawCard(10, "Income", totalIncome, 0, 150, 0);
    drawCard(75, "Expense", totalExpense, 200, 0, 0);
    drawCard(140, "Net", net, net >= 0 ? 0 : 200, net >= 0 ? 150 : 0, 0);

    y += 28;

    // =========================
    // 📊 TABLE HEADER
    // =========================
    const col = {
        date: 17,
        type: 47,
        category: 67,
        payType: 97,   // 👈 move slightly left
        amount: 137,    // 👈 move right (important)
        purpose: 147    // 👈 give space for wrapping
    };

    const theme = localStorage.getItem("theme") || "#4caf50";
    const { r, g, b } = hexToRgb(theme);

    doc.setFillColor(Math.max(0, r - 20), Math.max(0, g - 20), Math.max(0, b - 20));
    doc.rect(10, y - 5, 190, 9, "F"); // 🔽 reduced height

    doc.setTextColor(255);
    doc.setFont(undefined, "bold");
    doc.setFontSize(9); // 🔽 reduced

    doc.text("Date", col.date, y + 2, { align: "center" });
    doc.text("Type", col.type, y + 2, { align: "center" });

    doc.text("Category", col.category, y + 2, { align: "left" });
    doc.text("PayType", col.payType, y + 2, { align: "left" });

    doc.text("Amount", col.amount, y + 2, { align: "right" });

    doc.text("Purpose", col.purpose, y + 2, { align: "left" });

    y += 9;

    // =========================
    // 📄 TABLE DATA
    // =========================
    doc.setTextColor(0);
    doc.setFont(undefined, "normal");
    doc.setFontSize(8); // 🔽 reduced

    dataSource.forEach((e, index) => {
        const date = new Date(e.date).toLocaleDateString("en-IN");
        const category = e.category || "Others";
        const amount = Number(e.amount || 0);
        const purpose = e.purpose || "N/A";
        const payment = e.paymentType || e.entity || "-";
        const type = e.type ? e.type.toUpperCase() : (amount < 0 ? "EXPENSE" : "INCOME");

        const formatted = new Intl.NumberFormat("en-IN").format(Math.abs(amount));

        if (y > 280) {
            doc.addPage();
            y = 20;
        }

        if (index % 2 === 0) {
            doc.setFillColor(248, 248, 248);
            doc.rect(10, y - 4, 190, 8, "F");
        }

        doc.text(date, col.date, y, { align: "center" });

        doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);
        doc.text(type, col.type, y, { align: "center" });

        doc.setTextColor(0);
        doc.text(category, col.category, y);

        doc.text(payment, col.payType, y);

        doc.setTextColor(amount < 0 ? 200 : 0, amount < 0 ? 0 : 150, 0);
        doc.text(formatCurrencyPDF(amount), col.amount, y, { align: "right" });

        doc.setTextColor(0);

        // ✅ Control width for purpose column
        let maxWidth = 50;   // 👈 reduce from 40 → better fit

        let splitPurpose = doc.splitTextToSize(purpose, maxWidth);

        // ✅ Draw text
        doc.text(splitPurpose, col.purpose, y);

        // ✅ Adjust row height dynamically
        let lineHeight = 5;
        let rowHeight = Math.max(9, splitPurpose.length * lineHeight);

        y += rowHeight;
    });

    // =========================
    // 🟣 BUDGET SUMMARY
    // =========================
    // =========================
    // 🟣 BUDGET SUMMARY (PERIOD BASED)
    // =========================
    y += 8;

    doc.setDrawColor(200);
    doc.line(10, y, 200, y);

    y += 6;

    doc.setFontSize(11);
    doc.setFont(undefined, "bold");
    doc.text("Budget Summary (Active Period)", 14, y);

    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text("Overview of budget vs spending", 14, y);

    doc.setTextColor(0);
    y += 5;

    // 🔥 PERIOD-BASED TOTALS
    let totalBudget = getTotalBudget();

    let totalSpent = dataSource
        .filter(e => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let remaining = totalBudget - totalSpent;

    doc.setFont(undefined, "bold");
    doc.setFontSize(9);

    doc.text("Total Budget:", 14, y);
    doc.text(formatCurrencyPDF(totalBudget), 90, y);

    y += 6;

    doc.text(
        "Spent",
        summaryCols.spent,
        y + 1,
        { align: "right" }
    );

    doc.text(
        "Remaining",
        summaryCols.remaining,
        y + 1,
        { align: "right" }
    );

    y += 10;


    // =========================
    // 📦 BUDGET ALLOCATIONS
    // =========================

    // =========================
    // 📦 BUDGET ENTRIES
    // =========================

    let budgets =
        getBudgets()

            .filter(b => {

                // respect active PDF filter
                return dataSource.some(
                    e =>
                        e.periodKey ===
                        b.periodKey
                );
            });


    // =========================
    // 💰 TOTALS
    // =========================

    let totalBudget = 0;

    let totalSpent = 0;

    let totalRemaining = 0;


    // =========================
    // 📄 PRINT BUDGET ROWS
    // =========================

    budgets.forEach((b, index) => {

        // =========================
        // 💵 ALLOCATED
        // =========================

        let allocated =
            Math.abs(
                b.totalAllocated || 0
            );

        // =========================
        // 💸 SPENT
        // =========================

        let spent =
            dataSource

                .filter(e =>

                    (
                        e.type === "expense" ||
                        e.type === "loss"
                    )

                    &&

                    e.budgetId ===
                    b.budgetId
                )

                .reduce(
                    (sum, e) =>

                        sum +
                        Math.abs(
                            e.amount || 0
                        ),

                    0
                );

        // =========================
        // 💰 RECOVERY
        // =========================

        let recovered =
            dataSource

                .filter(e =>

                    e.type ===
                    "recovery"

                    &&

                    e.budgetId ===
                    b.budgetId
                )

                .reduce(
                    (sum, e) =>

                        sum +
                        Math.abs(
                            e.amount || 0
                        ),

                    0
                );

        // =========================
        // 📊 REMAINING
        // =========================

        let remaining =
            allocated -
            spent +
            recovered;


        // =========================
        // 📈 TOTALS
        // =========================

        totalBudget += allocated;

        totalSpent += spent;

        totalRemaining += remaining;


        // =========================
        // 🎨 ALT ROW BG
        // =========================

        if (index % 2 === 0) {

            doc.setFillColor(
                248,
                248,
                248
            );

            doc.rect(
                10,
                y - 4,
                190,
                8,
                "F"
            );
        }


        // =========================
        // 🏷 NAME
        // =========================

        doc.setTextColor(0);

        doc.setFont(
            undefined,
            "normal"
        );

        doc.text(
            b.note ||
            b.name ||
            "Budget",
            summaryCols.name,
            y
        );


        // =========================
        // 💵 ALLOCATED
        // =========================

        doc.setTextColor(
            0,
            120,
            255
        );

        doc.text(
            formatCurrencyPDF(
                allocated
            ),
            summaryCols.allocated,
            y,
            { align: "right" }
        );


        // =========================
        // 💸 SPENT
        // =========================

        doc.setTextColor(
            220,
            0,
            0
        );

        doc.text(
            formatCurrencyPDF(
                spent
            ),
            summaryCols.spent,
            y,
            { align: "right" }
        );


        // =========================
        // 💰 REMAINING
        // =========================

        doc.setTextColor(

            remaining < 0
                ? 220
                : 0,

            remaining < 0
                ? 0
                : 150,

            0
        );

        doc.text(
            formatCurrencyPDF(
                remaining
            ),
            summaryCols.remaining,
            y,
            { align: "right" }
        );

        doc.setTextColor(0);

        y += 8;
    });


    // =========================
    // 📏 TOTAL DIVIDER
    // =========================

    y += 2;

    doc.setDrawColor(180);

    doc.line(10, y, 200, y);

    y += 8;


    // =========================
    // 📊 TOTAL SUMMARY
    // =========================

    doc.setFont(
        undefined,
        "bold"
    );


    // =========================
    // 💵 TOTAL BUDGET
    // =========================

    doc.setTextColor(0);

    doc.text(
        "Total Budget",
        summaryCols.name,
        y
    );

    doc.setTextColor(
        0,
        120,
        255
    );

    doc.text(
        formatCurrencyPDF(
            totalBudget
        ),
        summaryCols.allocated,
        y,
        { align: "right" }
    );

    y += 8;


    // =========================
    // 💸 TOTAL SPENT
    // =========================

    doc.setTextColor(0);

    doc.text(
        "Total Spent",
        summaryCols.name,
        y
    );

    doc.setTextColor(
        220,
        0,
        0
    );

    doc.text(
        formatCurrencyPDF(
            totalSpent
        ),
        summaryCols.spent,
        y,
        { align: "right" }
    );

    y += 8;


    // =========================
    // 💰 TOTAL REMAINING
    // =========================

    doc.setTextColor(0);

    doc.text(
        "Remaining",
        summaryCols.name,
        y
    );

    doc.setTextColor(

        totalRemaining < 0
            ? 220
            : 0,

        totalRemaining < 0
            ? 0
            : 150,

        0
    );

    doc.text(
        formatCurrencyPDF(
            totalRemaining
        ),
        summaryCols.remaining,
        y,
        { align: "right" }
    );

    doc.setTextColor(0);
    // =========================
    // 💾 SAVE
    // =========================
    doc.save("money-tracker-report.pdf");
}
=== COMMENTED OLD DOWNLOAD END === */

// New PDF wrapper (calls modular PDF generator when available)
function downloadPDF() {
    const dataSource = (window.currentFilteredExpenses && window.currentFilteredExpenses.length) ? window.currentFilteredExpenses : (typeof getExpenses === 'function' ? getExpenses() : []);
    if (typeof window.generatePdfReport === 'function') {
        window.generatePdfReport({ data: dataSource });
        return;
    }

    // Fallback to legacy simple export if new generator not available
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text('Money Tracker (legacy) - No advanced PDF engine available', 10, 20);
    doc.save('money-tracker-report.pdf');
}

function hexToRgb(hex) {
    hex = hex.replace("#", "");

    if (hex.length === 3) {
        hex = hex.split("").map(x => x + x).join("");
    }

    let bigint = parseInt(hex, 16);

    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    return { r, g, b };
}

// =========================
// ReMo AI — Floating Companion
// Lightweight UI + Insight engine (local fallback)
// =========================

(function registerReMoAI() {
    // Inject minimal styles so no external CSS changes required
    const css = `
    .remo-ai-bubble{position:fixed;right:18px;bottom:78px;z-index:1200;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(16,24,40,0.12);backdrop-filter:blur(6px);cursor:pointer;transition:transform .18s ease,box-shadow .18s;}
    .remo-ai-bubble:hover{transform:translateY(-4px);box-shadow:0 10px 30px rgba(16,24,40,0.16);}
    .remo-ai-bubble .icon{width:28px;height:28px}
    .remo-ai-panel{position:fixed;right:12px;bottom:12px;z-index:1200;width:360px;max-height:78vh;background:var(--remo-panel-bg,#ffffff);color:var(--remo-panel-fg,#111827);border-radius:12px;box-shadow:0 20px 50px rgba(2,6,23,0.3);overflow:hidden;display:flex;flex-direction:column;transform:translateY(12px);opacity:0;pointer-events:none;transition:opacity .18s ease,transform .22s ease}
    .remo-ai-panel.open{opacity:1;pointer-events:auto;transform:translateY(0)}
    .remo-ai-header{padding:12px 14px;border-bottom:1px solid rgba(0,0,0,0.06);display:flex;align-items:center;gap:10px}
    .remo-title{font-weight:700;font-size:14px}
    .remo-sub{font-size:11px;color:rgba(0,0,0,0.5)}
    .remo-body{padding:10px;overflow:auto;flex:1;display:flex;flex-direction:column;gap:8px}
    .remo-chips{display:flex;flex-wrap:wrap;gap:8px}
    .remo-chip{background:rgba(0,0,0,0.06);padding:6px 10px;border-radius:999px;font-size:12px;cursor:pointer}
    .remo-messages{display:flex;flex-direction:column;gap:8px}
    .remo-msg{padding:8px 10px;border-radius:8px;background:rgba(0,0,0,0.03);font-size:13px}
    .remo-input{display:flex;gap:8px;padding:10px;border-top:1px solid rgba(0,0,0,0.06)}
    .remo-input input{flex:1;padding:8px;border-radius:8px;border:1px solid rgba(0,0,0,0.08)}
    .remo-send{background:var(--accent,#0ea5a4);color:#fff;padding:8px 10px;border-radius:8px;cursor:pointer}
    .remo-attachment-thumb{width:36px;height:36px;border-radius:6px;object-fit:cover}
    @media (prefers-color-scheme:dark){
        .remo-ai-bubble{background:linear-gradient(180deg,#0f1724,rgba(15,23,36,0.9));}
        .remo-ai-panel{--remo-panel-bg:#0b1220;--remo-panel-fg:#e6eef7}
        .remo-chip{background:rgba(255,255,255,0.04)}
        .remo-msg{background:rgba(255,255,255,0.02)}
    }
    `;

    const style = document.createElement('style');
    style.setAttribute('data-remo-ai','1');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // Create bubble
    function createBubble() {
        const bubble = document.createElement('button');
        bubble.className = 'remo-ai-bubble';
        bubble.setAttribute('aria-label','Open ReMo AI');
        bubble.innerHTML = `
            <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                </defs>
                <circle cx="12" cy="12" r="10" fill="url(#g)" />
                <g fill="#fff">
                    <path d="M8 11.5c0-2.5 2-4.5 4.5-4.5S17 9 17 11.5 15 16 12.5 16 8 14 8 11.5z" opacity=".95"/>
                </g>
                <defs>
                    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                        <stop offset="0" stop-color="#2b6cb0"/>
                        <stop offset="1" stop-color="#06b6d4"/>
                    </linearGradient>
                </defs>
            </svg>`;

        document.body.appendChild(bubble);
        return bubble;
    }

    // Create panel
    function createPanel() {
        const panel = document.createElement('div');
        panel.className = 'remo-ai-panel';
        panel.innerHTML = `
            <div class="remo-ai-header">
                <div style="width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;background:linear-gradient(180deg,#0f1724,#0ea5a4);color:#fff">R</div>
                <div>
                    <div class="remo-title">ReMo AI</div>
                    <div class="remo-sub">Your intelligent finance companion</div>
                </div>
            </div>
            <div class="remo-body">
                <div class="remo-chips" data-chips></div>
                <div class="remo-messages" data-messages></div>
            </div>
            <div class="remo-input">
                <input placeholder="Ask ReMo (e.g. 'Where did I spend most this week?')" data-userinput />
                <button class="remo-send" data-send>Ask</button>
            </div>
        `;

        document.body.appendChild(panel);
        return panel;
    }

    // Lightweight insight engine
    function topCategory(expenses, periodStart, periodEnd) {
        const filtered = expenses.filter(e => {
            const d = new Date(e.date);
            if (periodStart && d < periodStart) return false;
            if (periodEnd && d > periodEnd) return false;
            return true;
        });
        const sums = {};
        filtered.forEach(e => {
            const cat = e.category || 'Others';
            sums[cat] = (sums[cat] || 0) + Math.abs(Number(e.amount || 0));
        });
        const entries = Object.entries(sums).sort((a,b)=>b[1]-a[1]);
        return entries[0] ? {category:entries[0][0], amount:entries[0][1]} : null;
    }

    function sumRange(expenses, periodStart, periodEnd) {
        return expenses.filter(e => {
            const d = new Date(e.date);
            if (periodStart && d < periodStart) return false;
            if (periodEnd && d > periodEnd) return false;
            return true;
        }).reduce((s,e)=>s+Number(e.amount||0),0);
    }

    function formatCurrencyShort(v){
        try{ return formatCurrencyPDF ? formatCurrencyPDF(v) : new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR'}).format(v);}catch(e){return v}
    }

    function renderMessage(text, append=true) {
        const messages = document.querySelector('.remo-messages');
        if(!messages) return;
        const el = document.createElement('div');
        el.className='remo-msg';
        el.textContent = text;
        if(append) messages.appendChild(el);
        messages.scrollTop = messages.scrollHeight;
    }

    function generateInsightIntent(intent) {
        const expenses = (window.currentFilteredExpenses && window.currentFilteredExpenses.length) ? window.currentFilteredExpenses : (typeof getExpenses === 'function' ? getExpenses() : []);
        const now = new Date();
        function sumRangeFor(arr, start, end){ return arr.reduce((s,e)=>{
            const d = new Date(e.date);
            if(d>=start && d<=end) return s + Number(e.amount||0); return s;
        },0); }
        function topCategories(arr, start, end, limit=3){
            const m = {};
            arr.forEach(e=>{ const d=new Date(e.date); if(d>=start && d<=end){ const k = e.category||'Uncategorized'; m[k]=(m[k]||0)+Math.abs(Number(e.amount||0)); }});
            return Object.keys(m).map(k=>({category:k,amount:m[k]})).sort((a,b)=>b.amount-a.amount).slice(0,limit);
        }
        if(intent === 'top-spend-week'){
            const start = new Date(now); start.setDate(now.getDate()-7);
            const top = topCategory(expenses, start, now);
            if(top) return `Top spending in last 7 days: ${top.category} — ${formatCurrencyShort(top.amount)}`;
            return 'No expenses found in the last 7 days.';
        }
        if(intent === 'spending-trends' || intent === 'show-spending-trends'){
            const day7 = new Date(now); day7.setDate(now.getDate()-7);
            const day30 = new Date(now); day30.setDate(now.getDate()-30);
            const spend7 = Math.abs(sumRangeFor(expenses.filter(e=>Number(e.amount)<0), day7, now));
            const spend30 = Math.abs(sumRangeFor(expenses.filter(e=>Number(e.amount)<0), day30, now));
            const avg7 = (spend7/7)||0;
            const avg30 = (spend30/30)||0;
            const trend = avg7 > avg30 ? 'increasing' : (avg7 < avg30 ? 'decreasing' : 'stable');
            return `7-day avg ${formatCurrencyShort(avg7)}; 30-day avg ${formatCurrencyShort(avg30)} — trend ${trend}.`;
        }
        if(intent === 'category-analysis'){
            const start = new Date(now); start.setDate(now.getDate()-30);
            const top = topCategories(expenses, start, now, 5);
            if(!top.length) return 'No category data for last 30 days.';
            return 'Top categories (30d): ' + top.map(t=>`${t.category} ${formatCurrencyShort(t.amount)}`).join(', ');
        }
        if(intent === 'savings-progress'){
            const savings = (typeof getSavings==='function')?getSavings():[];
            const total = savings.reduce((s,x)=>s+Number(x.amount||0),0);
            return `You have ${formatCurrencyShort(total)} in savings (${savings.length} entries).`;
        }
        if(intent === 'end-of-day-summary'){
            const start = new Date(now); start.setHours(0,0,0,0);
            const end = new Date(now); end.setHours(23,59,59,999);
            const incomes = expenses.filter(e=>Number(e.amount)>0 && new Date(e.date)>=start && new Date(e.date)<=end);
            const outs = expenses.filter(e=>Number(e.amount)<0 && new Date(e.date)>=start && new Date(e.date)<=end);
            const inAmt = incomes.reduce((s,e)=>s+Number(e.amount||0),0);
            const outAmt = outs.reduce((s,e)=>s+Number(e.amount||0),0);
            return `Today: ${incomes.length} income(s) ${formatCurrencyShort(inAmt)}; ${outs.length} expense(s) ${formatCurrencyShort(Math.abs(outAmt))}.`;
        }
        if(intent === 'savings-month'){
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const income = sumRange(expenses.filter(e=>Number(e.amount)>0), start, now);
            const expense = Math.abs(sumRange(expenses.filter(e=>Number(e.amount)<0), start, now));
            const saved = income - expense;
            return `This month: Income ${formatCurrencyShort(income)}, Expense ${formatCurrencyShort(expense)}, Savings ${formatCurrencyShort(saved)}`;
        }
        if(intent === 'budget-alerts'){
            const budgets = (typeof getBudgets==='function')?getBudgets():[];
            const alerts = [];
            budgets.forEach(b=>{
                const allocated = Math.abs(b.totalAllocated||0);
                const spent = expenses.filter(e=> (e.type==='expense'||e.type==='loss') && e.budgetId===b.budgetId).reduce((s,e)=>s+Math.abs(Number(e.amount||0)),0);
                if(allocated>0 && spent/allocated >= 0.85) alerts.push(`${b.name||b.note||'Budget'} is ${Math.round((spent/allocated)*100)}% used`);
            });
            return alerts.length?alerts.join('; '):'No budget alerts.';
        }
        if(intent === 'compare-last-month'){
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth()-1, 1);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
            const thisSpend = Math.abs(sumRange(expenses.filter(e=>Number(e.amount)<0), thisMonthStart, now));
            const lastSpend = Math.abs(sumRange(expenses.filter(e=>Number(e.amount)<0), lastMonthStart, lastMonthEnd));
            const diff = thisSpend - lastSpend;
            return `Expense this month ${formatCurrencyShort(thisSpend)}. Last month ${formatCurrencyShort(lastSpend)}. Change ${formatCurrencyShort(diff)}.`;
        }

        return "I couldn't compute that automatically. Try a quick suggestion.";
    }

    function handlePreset(promptKey){
        const map = {
            'Where did I spend most this week?':'top-spend-week',
            'How much did I save this month?':'savings-month',
            'Which category exceeds budget?':'budget-alerts',
            'What changed compared to last month?':'compare-last-month',
            'Show spending trends':'spending-trends'
        };
        const intent = map[promptKey]||promptKey;
        renderMessage(promptKey);
        const reply = generateInsightIntent(intent);
        setTimeout(()=>renderMessage(reply),200);
    }

    function openPanel(panel){
        panel.classList.add('open');
        // populate chips
        const chips = panel.querySelector('[data-chips]');
        if(chips && chips.children.length===0){
            ['Where did I spend most this week?','How much did I save this month?','Which category exceeds budget?','What changed compared to last month?','Show spending trends'].forEach(t=>{
                const b = document.createElement('button');
                b.className='remo-chip';
                b.textContent = t;
                b.onclick = ()=>handlePreset(t);
                chips.appendChild(b);
            });
        }
        panel.querySelector('[data-messages]').innerHTML='';
        renderMessage('Hi — I am ReMo. I can show insights, reminders and quick actions.');
    }

    function init() {
        try{
            // load ReMo styles (lightweight)
            if(!document.querySelector('link[data-remo-css]')){
                const l = document.createElement('link');
                l.rel = 'stylesheet';
                l.href = 'assets/styles/remo.css';
                l.setAttribute('data-remo-css','1');
                document.head.appendChild(l);
            }

            // lazy-load attachments module (IndexedDB-backed) for offline-first attachments
            if(!window.reMoAttachmentsIndexed && !document.querySelector('script[data-remo-attach]')){
                const s = document.createElement('script');
                s.src = 'assets/scripts/remo/attachments.js';
                s.setAttribute('data-remo-attach','1');
                document.body.appendChild(s);
            }

            // schedule light daily summary notification (runs while app is open)
            try{
                scheduleDailySummary(20); // 20:00 local
            }catch(e){/* ignore */}

            const bubble = createBubble();
            const panel = createPanel();

            bubble.addEventListener('click',()=>{
                if(panel.classList.contains('open')){ panel.classList.remove('open'); }
                else{ openPanel(panel); }
            });

            // Send handler
            panel.querySelector('[data-send]').addEventListener('click',()=>{
                const input = panel.querySelector('[data-userinput]');
                const text = (input.value||'').trim();
                if(!text) return;
                renderMessage(text);
                // naive intent detection
                const l = text.toLowerCase();
                if(l.includes('food')||l.includes('where')||l.includes('most')) handlePreset('Where did I spend most this week?');
                else if(l.includes('save')||l.includes('saving')||l.includes('how much did i save')) handlePreset('How much did I save this month?');
                else if(l.includes('budget')||l.includes('exceed')) handlePreset('Which category exceeds budget?');
                else if(l.includes('compare')||l.includes('changed')||l.includes('last month')) handlePreset('What changed compared to last month?');
                else {
                    // fallback: try to compute simple numeric answers
                    const reply = generateInsightIntent(text);
                    setTimeout(()=>renderMessage(reply),200);
                }
                input.value='';
            });

            // keyboard enter
            panel.querySelector('[data-userinput]').addEventListener('keydown',(e)=>{
                if(e.key==='Enter') panel.querySelector('[data-send]').click();
            });

            // gentle entrance animation
            setTimeout(()=>bubble.style.transform='translateY(0)',100);
        }catch(e){console.warn('ReMo init failed',e)}
    }

    // Initialize after load
    if(document.readyState==='complete') init(); else window.addEventListener('load',init);

    // Attachment helper (switches to IndexedDB-backed implementation when available)
    window.reMoAttachments = window.reMoAttachmentsIndexed || {
        storePreview: async function(transactionId, file){
            if(!file) return null;
            return new Promise((res,rej)=>{
                const fr = new FileReader();
                fr.onload = ()=>{
                    try{ const key = `remo:attach:${transactionId}`; localStorage.setItem(key, fr.result); res(fr.result); }catch(err){rej(err)}
                };
                fr.onerror = rej;
                fr.readAsDataURL(file);
            });
        },
        getPreview: function(transactionId){ return localStorage.getItem(`remo:attach:${transactionId}`); },
        remove: function(transactionId){ localStorage.removeItem(`remo:attach:${transactionId}`); }
    };

})();

// =========================
// Attachment viewer + input wiring
// =========================

function openAttachmentViewer(src) {
    // remove existing
    let existing = document.getElementById('remo-attach-viewer');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'remo-attach-viewer';
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = 'rgba(0,0,0,0.85)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = 1400;
    overlay.style.cursor = 'zoom-out';

    const img = document.createElement('img');
    img.src = src;
    img.style.maxWidth = '94%';
    img.style.maxHeight = '94%';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 20px 50px rgba(0,0,0,0.6)';
    let zoomed = false;
    img.addEventListener('dblclick', () => {
        zoomed = !zoomed;
        img.style.transform = zoomed ? 'scale(1.6)' : 'scale(1)';
    });

    overlay.addEventListener('click', () => overlay.remove());

    overlay.appendChild(img);
    document.body.appendChild(overlay);
}

function setupAttachmentInputs() {
    // expense attachment
    const expInput = document.getElementById('expenseAttachment');
    const expPreview = document.getElementById('expenseAttachmentPreview');
    const expWrapper = document.getElementById('expenseAttachmentPreviewWrapper');
    const expRemove = document.getElementById('expenseAttachmentRemove');
    if (expInput) {
        expInput.addEventListener('change', async function () {
            const file = this.files && this.files[0];
            if (!file) return;
            // show temporary preview using object URL
            // revoke previous preview url if present
            if(expPreview && expPreview.dataset._previewUrl){ try{ URL.revokeObjectURL(expPreview.dataset._previewUrl); }catch(e){} }
            const url = URL.createObjectURL(file);
            if (expPreview) { expPreview.src = url; expPreview.dataset._previewUrl = url; expWrapper.style.display = 'block'; expRemove.style.display = 'inline'; }
            expPreview.onclick = ()=>openAttachmentViewer(url);
        });
        if (expRemove) expRemove.addEventListener('click', ()=>{ if(expPreview && expPreview.dataset._previewUrl){ try{ URL.revokeObjectURL(expPreview.dataset._previewUrl);}catch(e){} expPreview.dataset._previewUrl=''; } expInput.value = ''; if(expWrapper) expWrapper.style.display='none'; expRemove.style.display='none'; });
    }

    const sInput = document.getElementById('sAttachment');
    const sPreview = document.getElementById('sAttachmentPreview');
    const sWrapper = document.getElementById('sAttachmentPreviewWrapper');
    const sRemove = document.getElementById('sAttachmentRemove');
    if (sInput) {
        sInput.addEventListener('change', function () {
            const file = this.files && this.files[0];
            if (!file) return;
            if(sPreview && sPreview.dataset._previewUrl){ try{ URL.revokeObjectURL(sPreview.dataset._previewUrl); }catch(e){} }
            const url = URL.createObjectURL(file);
            if (sPreview) { sPreview.src = url; sPreview.dataset._previewUrl = url; sWrapper.style.display = 'block'; sRemove.style.display = 'inline'; }
            sPreview.onclick = ()=>openAttachmentViewer(url);
        });
        if (sRemove) sRemove.addEventListener('click', ()=>{ if(sPreview && sPreview.dataset._previewUrl){ try{ URL.revokeObjectURL(sPreview.dataset._previewUrl);}catch(e){} sPreview.dataset._previewUrl=''; } sInput.value=''; if(sWrapper) sWrapper.style.display='none'; sRemove.style.display='none'; });
    }
}

// initialize attachment inputs on DOM ready
if (document.readyState === 'complete') setupAttachmentInputs(); else window.addEventListener('load', setupAttachmentInputs);

// Helper: store attachment from a file input element id and return attachmentId (or null)
async function storeAttachmentFromInput(inputId){
    const fileInput = document.getElementById(inputId);
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
    if(!file) return null;
    const store = window.reMoAttachments && window.reMoAttachments.storeImage ? window.reMoAttachments.storeImage : (window.reMoAttachmentsIndexed && window.reMoAttachmentsIndexed.storeImage);
    if(!store) return null;
    try{
        const res = await store(null, file);
        return res && res.id ? res.id : null;
    }catch(err){
        console.warn('Attachment store failed', err);
        return null;
    }
}

function scheduleDailySummary(hour=20){
    if(!('Notification' in window)) return;
    function computeSummary(){
        const expenses = (typeof getExpenses==='function')?getExpenses():[];
        const now = new Date();
        const start = new Date(now); start.setHours(0,0,0,0);
        const end = new Date(now); end.setHours(23,59,59,999);
        const ins = expenses.filter(e=>Number(e.amount)>0 && new Date(e.date)>=start && new Date(e.date)<=end);
        const outs = expenses.filter(e=>Number(e.amount)<0 && new Date(e.date)>=start && new Date(e.date)<=end);
        const inAmt = ins.reduce((s,e)=>s+Number(e.amount||0),0);
        const outAmt = outs.reduce((s,e)=>s+Number(e.amount||0),0);
        return `Today: ${ins.length} incomes ${formatCurrencyShort(inAmt)} · ${outs.length} expenses ${formatCurrencyShort(Math.abs(outAmt))}`;
    }
    function scheduleNext(){
        const now = new Date();
        const next = new Date(now);
        next.setHours(hour,0,0,0);
        if(next<=now) next.setDate(next.getDate()+1);
        const ms = next - now;
        setTimeout(async ()=>{
            if(Notification.permission!=='granted'){
                try{ await Notification.requestPermission(); }catch(e){}
            }
            if(Notification.permission==='granted'){
                const body = computeSummary();
                const n = new Notification('ReMo Daily Summary', { body });
                n.onclick = ()=>window.focus();
            }
            scheduleNext();
        }, ms);
    }
    scheduleNext();
}

// Cleanup orphaned attachments not referenced by any transaction
async function cleanupOrphanAttachments(olderThanDays=30){
    const at = window.reMoAttachments || window.reMoAttachmentsIndexed;
    if(!at || !at.listIds) return;
    try{
        const ids = await at.listIds();
        const used = new Set();
        if(typeof getExpenses === 'function') getExpenses().forEach(e=>{ if(e.attachmentId) used.add(String(e.attachmentId)); });
        if(typeof getSavings === 'function') getSavings().forEach(s=>{ if(s.attachmentId) used.add(String(s.attachmentId)); });
        const cutoff = Date.now() - (olderThanDays*24*60*60*1000);
        for(const id of ids){
            if(used.has(String(id))) continue;
            let rec = null;
            try{ rec = await at.getRecord(id); }catch(e){}
            const created = rec && rec.createdAt ? Number(rec.createdAt) : null;
            if(created && created > 0 && created < cutoff){
                try{ await at.remove(id); console.info('Removed orphan attachment', id); }catch(e){console.warn('Failed remove orphan',id,e)}
            }
        }
    }catch(err){ console.warn('cleanupOrphanAttachments failed',err); }
}

// run a light cleanup on startup (non-blocking)
setTimeout(()=>cleanupOrphanAttachments(30), 2000);

function getTotalBudget(monthKey) {
    let budgets = getBudgets();

    let filtered = filterBudgetsByActivePeriod(budgets);

    return filtered
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);
}

function saveExpense() {
    handleAddExpense();
}
function exportPDF() {
    downloadPDF();
}
function handleGraphFilter(type) {
    loadGraph(type);
}
function openCustomModal() {
    openDateModal();
}

function applyPeriodFromModal() {

    let from = document.getElementById("startDate").value;
    let to = document.getElementById("endDate").value;

    let expenses = getExpenses();

    // 🔥 normalize to remove time issues
    function normalize(dateStr) {
        let d = new Date(dateStr);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    }

    let fromTime = from ? normalize(from) : null;
    let toTime = to ? normalize(to) : null;

    let filtered = expenses.filter(e => {

        let d = new Date(e.date);
        let entryTime = new Date(
            d.getFullYear(),
            d.getMonth(),
            d.getDate()
        ).getTime();

        if (fromTime && !toTime) return entryTime === fromTime;
        if (!fromTime && toTime) return entryTime <= toTime;
        if (fromTime && toTime) return entryTime >= fromTime && entryTime <= toTime;

        return true;
    });


    // =========================
    // ✅ UPDATE HISTORY
    // =========================
    if (typeof loadHistory === "function") {
        loadHistory(filtered);
    }

    // =========================
    // ✅ UPDATE GRAPH (THIS WAS MISSING)
    // =========================
    if (typeof loadGraph === "function") {
        loadGraph("custom", filtered, { start: from, end: to });
    }

    // =========================
    // ✅ UPDATE CATEGORY BREAKDOWN
    // =========================
    if (typeof renderCategoryBreakdown === "function") {
        renderCategoryBreakdown(groupByCategory(filtered));
    }

    // =========================
    // ✅ UPDATE DROPDOWN LABEL
    // =========================
    updateCustomPeriodLabel(from, to);

    // =========================
    // ✅ CLOSE MODAL
    // =========================
    closePeriod();
}

function loadBudgetOptions() {

    let select = document.getElementById("budgetSelect");
    if (!select) return;

    let budgets = getBudgets();
    let expenses = getExpenses();

    select.innerHTML = "";

    let filtered = filterBudgetsByActivePeriod(budgets);

    if (!filtered.length) {
        let opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No budgets available";
        select.appendChild(opt);
        return;
    }

    filtered.forEach(b => {

        // 🔥 Calculate spent per budget
        let spent = expenses
            .filter(e =>
                e.budgetId === b.budgetId &&
                e.amount < 0
            )
            .reduce((sum, e) => sum + Math.abs(e.amount), 0);

        let remaining = (b.totalAllocated || 0) - spent;

        let opt = document.createElement("option");
        opt.value = b.budgetId;

        // 🔥 FIX: Proper label using periodKey
        let label;

        if (b.periodKey) {
            let [start, end] = b.periodKey.split("_to_");

            label = `${formatDateShort(start)} → ${formatDateShort(end)}`;

        } else if (b.monthKey) {

            label = formatMonth(b.monthKey);

        } else {

            label = "No Date";

        }

        opt.textContent = `${label} (${b.entity}) — ${formatCurrency(remaining)} left`;

        select.appendChild(opt);
    });
}
function formatDateShort(date) {
    return new Date(date).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}

function formatBudgetName(budget) {

    if (!budget) return "Unknown";

    // 🔥 If full object passed
    if (typeof budget === "object") {

        if (budget.periodKey) {
            let [start, end] = budget.periodKey.split("_to_");
            return `${format(start)} → ${format(end)}`;
        }

        if (budget.monthKey) {
            return formatMonth(budget.monthKey);
        }

        return "No Date";
    }

    // 🔥 Fallback if only ID passed (legacy)
    let parts = budget.split("_");

    if (parts.length < 3) return budget;

    let part1 = parts[1];
    let part2 = parts[2];

    let year, month;

    if (part1.length === 4) {
        year = part1;
        month = part2;
    } else {
        month = part1;
        year = part2;
    }

    let date = new Date(`${year}-${month}-01`);

    return date.toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}

// Saves manual budget entry from UI
function saveBudget() {
    let amount = Number(document.getElementById("budgetAmount").value);
    let month = document.getElementById("budgetMonth").value;

    if (!amount || !month) {
        showToast("Enter amount & month");
        return;
    }

    let budgetId = "budget_" + month.replace("-", "_");

    createOrUpdateBudget(budgetId, {
        amount: amount,
        sourceId: "manual",
        entity: "Manual",
        note: "Manual Entry",
        date: new Date().toISOString(),
        monthKey: month
    });

    showToast("Budget saved");

    loadBudgetOptions();
}
// Placeholder for quotation feature (future)

// Shares exported PDF (basic fallback)
function sharePDF() {
    downloadPDF();
    showToast("Download started (share manually)");
}
// Handles theme selection
function handleTheme(val) {
    if (val === "custom") {
        document.getElementById("colorPicker").style.display = "flex"
    } else {
        changeTheme(val);
    }
}
// Applies custom color theme
function applyCustomColor(color) {
    changeTheme(color);
}

// Opens category modal
function openCategoryModal() {
    document.getElementById("categoryModal").style.display = "flex";
}

// Closes category modal
function closeCategoryModal() {
    document.getElementById("categoryModal").style.display = "none";
}
// Opens period modal
function openPeriod() {
    document.getElementById("periodModal").style.display = "flex";
}

// Closes period modal
function closePeriod() {
    document.getElementById("periodModal").style.display = "none";
}
// Exports full data backup as JSON
// function exportDataAsJSON() {
//     let data = {
//         expenses: getExpenses(),
//         budgets: getBudgets(),
//         savings: getSavings(),
//         orders: JSON.parse(localStorage.getItem("orders")) || [] // ✅ ADDED
//     };

//     let blob = new Blob(
//         [JSON.stringify(data, null, 2)],
//         { type: "application/json" }
//     );

//     let url = URL.createObjectURL(blob);

//     let a = document.createElement("a");
//     a.href = url;
//     a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
//     a.click();

//     URL.revokeObjectURL(url); // ✅ cleanup
// }
// function exportDataAsJSON() {

//     let data = {
//         expenses: getExpenses() || [],
//         budgets: getBudgets() || [],
//         savings: getSavings() || [],
//         orders: JSON.parse(localStorage.getItem("orders")) || []
//     };

//     try {
//         let json = JSON.stringify(data, null, 2);

//         let blob = new Blob([json], { type: "application/json" });
//         let url = URL.createObjectURL(blob);

//         // 🔥 MOBILE SAFE DOWNLOAD
//         let a = document.createElement("a");
//         a.href = url;
//         a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

//         document.body.appendChild(a);

//         // 👉 TRY DOWNLOAD
//         a.click();

//         // 👉 CLEANUP
//         setTimeout(() => {
//             document.body.removeChild(a);
//             URL.revokeObjectURL(url);
//         }, 1000);

//         // =========================
//         // 🔥 FALLBACK (IMPORTANT)
//         // =========================
//         setTimeout(() => {
//             // If download didn't happen → open manually
//             window.open(url, "_blank");
//         }, 500);

//     } catch (err) {

//         // 🔥 FINAL FALLBACK (copy)
//         let json = JSON.stringify(data, null, 2);
//         prompt("Copy your backup manually:", json);
//     }
// }

// Imports JSON backup into localStorage
// function importData() {
//     let text = document.getElementById("importText").value;

//     if (!text) {
//         showToast("Paste data");
//         return;
//     }

//     let data = JSON.parse(text);

//     if (data.expenses) saveExpenses(data.expenses);
//     if (data.budgets) saveBudgets(data.budgets);
//     if (data.savings) saveSavings(data.savings);

//     showToast("Imported successfully");
// }
// function importData() {
//     let text = document.getElementById("importText").value;

//     if (!text) {
//         showToast("Paste data");
//         return;
//     }

//     try {
//         let data = JSON.parse(text);

//         if (data.expenses) saveExpenses(data.expenses);
//         if (data.budgets) saveBudgets(data.budgets);
//         if (data.savings) saveSavings(data.savings);

//         showToast("Imported successfully");

//         // 🔄 Refresh UI
//         loadHistory();
//         loadBudgetOptions();
//         loadDashboard();
//         loadGraph();
//         renderBudgetEntries();   // 🔥 ADD THIS

//         // 🧹 Clear input
//         document.getElementById("importText").value = "";

//         // ❌ Close modal
//         closeImportModal();

//     } catch (err) {
//         showToast("Invalid JSON ❌");
//     }
// }
function importData() {

    let text = document.getElementById("importText").value;

    if (!text) {
        showToast("Paste data");
        return;
    }

    try {
        let data = JSON.parse(text);

        // =========================
        // 🧠 BASIC VALIDATION
        // =========================
        if (!data || typeof data !== "object") {
            throw new Error("Invalid structure");
        }

        // =========================
        // 🔥 CORE TABLES
        // =========================
        if (Array.isArray(data.expenses)) {
            saveExpenses(data.expenses);
        }

        if (Array.isArray(data.budgets)) {
            saveBudgets(data.budgets);
        }

        if (Array.isArray(data.savings)) {
            saveSavings(data.savings);
        }

        // =========================
        // 📦 ORDERS
        // =========================
        if (Array.isArray(data.orders)) {
            localStorage.setItem("orders", JSON.stringify(data.orders));
        }

        // =========================
        // 🧩 EXTRA TABLES (NEW)
        // =========================
        if (Array.isArray(data.categories)) {
            localStorage.setItem("categories", JSON.stringify(data.categories));
        }

        if (Array.isArray(data.persons)) {
            localStorage.setItem("persons", JSON.stringify(data.persons));
        }

        if (Array.isArray(data.budgetPeriods)) {
            localStorage.setItem("bp", JSON.stringify(data.budgetPeriods));
        }

        // =========================
        // ⚙️ SETTINGS
        // =========================
        if (data.settings) {
            if (data.settings.theme) {
                localStorage.setItem("theme", data.settings.theme);
            }

            if (data.settings.currencyCode) {
                localStorage.setItem("currencyCode", data.settings.currencyCode);
            }
        }

        // =========================
        // 🧠 META (OPTIONAL FUTURE USE)
        // =========================
        if (data.meta) {
            console.log("Imported version:", data.meta.version);
        }

        showToast("Import successful ✅");

        // =========================
        // 🔄 FULL UI REFRESH
        // =========================
        loadHistory();
        loadBudgetOptions();
        loadDashboard();
        loadGraph();
        updateBudgetEfficiency();

        if (typeof renderBudgetEntries === "function") {
            renderBudgetEntries();
        }

        if (typeof renderIncomeList === "function") {
            renderIncomeList();
        }

        if (typeof loadSavings === "function") {
            loadSavings();
        }

        // =========================
        // 🧹 CLEANUP
        // =========================
        document.getElementById("importText").value = "";
        closeImportModal();

    } catch (err) {

        console.error(err);
        showToast("Invalid or incompatible backup ❌");
    }
}
// Fixes old data structure to new system
function runMigration() {
    let budgets = getBudgets();

    budgets.forEach(b => {
        if (b.amount && !b.totalAllocated) {
            b.totalAllocated = b.amount;
            delete b.amount;
        }
    });

    saveBudgets(budgets);

    showToast("Migration done");
}
function openQuotation() {
    window.location.href = "pages/quotation.html";
}

// =========================
// 🔗 OPEN SAVINGS PAGE
// =========================
// Navigates user to savings screen
// function openSavingsPage() {
//     window.location.href = "savings.html";
// }
// =========================
// 🔗 NAVIGATE TO SAVINGS
// =========================
// Opens savings page when Remaining card is clicked
function bindRemainingCard() {
    let card = document.getElementById("remainingCard");

    if (!card) return;

    card.addEventListener("click", () => {
        window.location.href = "pages/savings.html";
    });
}
// =========================
// 📊 LOAD DASHBOARD SUMMARY
// =========================
// Calculates Budget, Spent, Remaining, Today
// function loadDashboard() {

//     let savings = getSavings();   // always latest
//     let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
//     let expenses = JSON.parse(localStorage.getItem("expenses")) || [];

//     // 💰 TOTAL SAVINGS
//     let totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

//     // 📦 TOTAL BUDGET
//     let currentMonth = new Date().toISOString().slice(0, 7);

//     let totalBudget = budgets
//         .filter(b => b.monthKey === currentMonth)
//         .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//     // 💰 INCOME
//     let totalIncome = expenses
//         .filter(e =>
//             e.amount > 0 &&
//             e.monthKey === currentMonth   // 🔥 IMPORTANT
//         )
//         .reduce((sum, e) => sum + e.amount, 0);

//     // 💸 EXPENSE
//     let totalSpent = expenses
//         .filter(e =>
//             e.amount < 0 &&
//             e.monthKey === currentMonth   // 🔥 IMPORTANT
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // 📊 NET
//     let net = totalIncome - totalSpent;

//     // 🟢 REMAINING (based on budget)
//     let remaining = totalBudget - totalSpent;

//     // 📅 TODAY SPENT
//     let today = new Date().toDateString();

//     let todaySpent = expenses
//         .filter(e =>
//             new Date(e.date).toDateString() === today &&
//             e.amount < 0
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // =========================
//     // 🖥️ UPDATE UI
//     // =========================
//     document.getElementById("budgetValue").innerText = totalBudget;
//     document.getElementById("spent").innerText = totalSpent;
//     document.getElementById("remaining").innerText = remaining;
//     document.getElementById("todaySpent").innerText = todaySpent;
//     document.getElementById("incomeValue").innerText = totalIncome;
//     document.getElementById("netValue").innerText = net;
// }
// function loadDashboard() {

//     let savings = getSavings();
//     let budgets = getBudgets();
//     let expenses = getExpenses();

//     let currentMonth = new Date().toISOString().slice(0, 7);

//     // 💰 TOTAL SAVINGS
//     let totalSavings = savings.reduce((sum, t) => sum + t.amount, 0);

//     // 📦 TOTAL BUDGET (ONLY CURRENT MONTH)
//     let totalBudget = budgets
//         .filter(b => b.monthKey === currentMonth)
//         .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//     // 💰 INCOME (ONLY CURRENT MONTH)
//     let totalIncome = expenses
//         .filter(e => e.amount > 0 && e.monthKey === currentMonth)
//         .reduce((sum, e) => sum + e.amount, 0);

//     // 💸 EXPENSE (ONLY CURRENT MONTH)
//     let totalSpent = expenses
//         .filter(e => e.amount < 0 && e.monthKey === currentMonth)
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // 📊 NET
//     let net = totalIncome - totalSpent;

//     // 🟢 REMAINING
//     let remaining = totalBudget - totalSpent;

//     // 📅 TODAY SPENT
//     let today = new Date().toDateString();

//     let todaySpent = expenses
//         .filter(e =>
//             new Date(e.date).toDateString() === today &&
//             e.amount < 0
//         )
//         .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//     // UI
//     document.getElementById("budgetValue").innerText = totalBudget;
//     document.getElementById("spent").innerText = totalSpent;
//     document.getElementById("remaining").innerText = remaining;
//     document.getElementById("todaySpent").innerText = todaySpent;
//     document.getElementById("incomeValue").innerText = totalIncome;
//     document.getElementById("netValue").innerText = net;
// }
function loadDashboard() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    // =========================
    // 📦 ACTIVE DATA
    // =========================
    let filteredBudgets =
        filterBudgetsByActivePeriod(budgets);

    let filteredExpenses =
        filterByActivePeriod(expenses);

    // =========================
    // 💰 TOTALS
    // =========================
    let totalBudget = filteredBudgets
        .reduce((sum, b) =>
            sum + (b.totalAllocated || 0), 0);

    let totalIncome = filteredExpenses
        .filter(e => e.amount > 0)
        .reduce((sum, e) =>
            sum + e.amount, 0);

    let totalSpent = filteredExpenses
        .filter(e => e.amount < 0)
        .reduce((sum, e) =>
            sum + Math.abs(e.amount), 0);

    let remaining =
        totalBudget - totalSpent;

    let net =
        totalIncome - totalSpent;

    // =========================
    // 📅 TODAY
    // =========================
    let today = new Date();

    today.setHours(0, 0, 0, 0);

    let endOfDay = new Date(today);

    endOfDay.setHours(23, 59, 59, 999);

    let todaySpent = filteredExpenses
        .filter(e => {

            if (e.amount >= 0) return false;

            let d = new Date(e.date);

            return d >= today &&
                d <= endOfDay;

        })
        .reduce((sum, e) =>
            sum + Math.abs(e.amount), 0);

    // =========================
    // 🖥️ SAFE UI
    // =========================
    function setText(id, value) {

        let el =
            document.getElementById(id);

        if (el) {
            el.innerText = value;
        }
    }

    setText(
        "budgetValue",
        formatCurrency(totalBudget)
    );

    setText(
        "spent",
        formatCurrency(totalSpent)
    );

    setText(
        "remaining",
        formatCurrency(remaining)
    );

    setText(
        "todaySpent",
        formatCurrency(todaySpent)
    );

    setText(
        "incomeValue",
        formatCurrency(totalIncome)
    );

    setText(
        "netValue",
        formatCurrency(net)
    );

    updateProgressBar();
}
// =========================
// 📦 LOAD BUDGET SCREEN
// =========================
// Loads current month's budget into UI
function loadBudgetScreen() {

    let budgets = getBudgets();

    let filtered = filterBudgetsByActivePeriod(budgets);

    let total = filtered
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let budgetEl = document.getElementById("currentBudget");
    if (budgetEl) budgetEl.innerText = formatCurrency(total);

    let daily = getDailyLimit();

    let dailyEl = document.getElementById("calculatedDaily"); // ✅ FIXED
    if (dailyEl) dailyEl.innerText = formatCurrency(daily);
}
// =========================
// 📜 RENDER BUDGET LIST
// =========================
// Displays all budget entries
function renderBudgetEntries() {

    let budgets = JSON.parse(localStorage.getItem("budgets")) || [];
    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetEntries");
    if (!container) return;

    container.innerHTML = "";

    if (!budgets.length) {
        container.innerHTML = "<p>No budget entries</p>";
        return;
    }

    // 🔥 GROUP BY SOURCE + PERIOD
    let map = {};

    budgets.forEach(b => {

        let key = b.sourceId + "_" + (b.periodKey || "no_period");

        if (!map[key]) {
            map[key] = {
                sourceId: b.sourceId,
                periodKey: b.periodKey,
                totalAllocated: 0,
                entity: b.entity
            };
        }

        map[key].totalAllocated += b.totalAllocated || 0;
    });

    let list = Object.values(map).reverse();

    list.forEach(g => {

        // 🔥 Use periodKey-based matching
        let relatedBudgetIds = budgets
            .filter(b =>
                b.sourceId === g.sourceId &&
                b.periodKey === g.periodKey
            )
            .map(b => b.budgetId);

        // calculate used taking allocationTrail into account
        let used = 0;
        expenses.forEach(e => {
            if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
                e.allocationTrail.forEach(a => {
                    if (relatedBudgetIds.includes(a.budgetId) && (e.type === 'expense' || e.type === 'loss')) {
                        used += Number(a.amount) || 0;
                    }
                    if (relatedBudgetIds.includes(a.budgetId) && e.type === 'recovery') {
                        used -= Number(a.amount) || 0;
                    }
                });
            } else {
                if (relatedBudgetIds.includes(e.budgetId)) {
                    if (e.amount < 0) used += Math.abs(e.amount);
                    if (e.type === 'recovery') used -= Math.abs(e.amount);
                }
            }
        });

        let remaining = g.totalAllocated - used;

        let source = savings.find(s => s.id === g.sourceId);
        let name = source ? (source.note || source.entity) : "Budget";

        // 🔥 Proper label
        let label = "No Date";

        if (g.periodKey) {
            let [start, end] = g.periodKey.split("_to_");
            label = `${formatDateShort(start)} → ${formatDateShort(end)}`;
        }

        // Responsive: render table on narrow screens
        const isMobile = window.innerWidth && window.innerWidth <= 640;
        if (isMobile) {
            // create table if not exists
            let table = container.querySelector('table.budgets-table');
            if (!table) {
                table = document.createElement('table');
                table.className = 'budgets-table';
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                table.innerHTML = `
                    <thead>
                        <tr style="background:#f0f0f0; text-align:left;">
                            <th style="padding:8px;">Name</th>
                            <th style="padding:8px;">Period</th>
                            <th style="padding:8px; text-align:right;">Allocated</th>
                            <th style="padding:8px; text-align:right;">Used</th>
                            <th style="padding:8px; text-align:right;">Remaining</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                `;
                container.appendChild(table);
            }

            const tbody = table.querySelector('tbody');
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="padding:8px; border-bottom:1px solid #eee;">${name}</td>
                <td style="padding:8px; border-bottom:1px solid #eee;">${label}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(g.totalAllocated)}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(used)}</td>
                <td style="padding:8px; border-bottom:1px solid #eee; text-align:right;">${formatCurrency(remaining)}</td>
            `;
            row.onclick = () => openBudgetDetails(g);
            tbody.appendChild(row);
        } else {
            let div = document.createElement("div");
            div.className = "income-card";

            div.innerHTML = `
            <div class="budget-card">

                <div class="budget-left">
                    <div class="budget-title">${name}</div>
                    <div class="budget-sub">${label}</div>
                </div>

                <div class="budget-right">
                    <div class="budget-amount">${formatCurrency(g.totalAllocated)}</div>
                    <div class="budget-status ${remaining <= 0 ? "exhausted" : "active"}">
                        ${remaining <= 0 ? "Exhausted" : `${formatCurrency(remaining)} left`}
                    </div>
                </div>

            </div>
            `;

            div.style.cursor = "pointer";
            div.onclick = () => openBudgetDetails(g);

            container.appendChild(div);
        }
    });
}

function openBudgetDetails(group) {
    let budgets = getBudgets();
    let expenses = JSON.parse(localStorage.getItem("expenses")) || [];
    let savings = JSON.parse(localStorage.getItem("savingsTransactions")) || [];

    let container = document.getElementById("budgetDetailsContainer");
    if (!container) return;

    let source = savings.find(s => s.id === group.sourceId);
    let name = source ? (source.note || source.entity) : "Budget";

    let related = [];

    // 🔥 Filter by period
    if (group.periodKey) {

        let [start, end] = group.periodKey.split("_to_");

        let s = new Date(start).getTime();
        let en = new Date(end).getTime();

        let relatedBudgetIds = budgets
            .filter(b =>
                b.sourceId === group.sourceId &&
                b.periodKey === group.periodKey
            )
            .map(b => b.budgetId);

        related = expenses.filter(e =>
            relatedBudgetIds.includes(e.budgetId)
        );
    }

    let used = related
        .filter(e => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let credited = related
        .filter(e => e.amount > 0)
        .reduce((sum, e) => sum + e.amount, 0);

    let remaining = group.totalAllocated - used + credited;

    // 🔥 Proper label
    let label = "No Date";

    if (group.periodKey) {
        let [start, end] = group.periodKey.split("_to_");
        label = `${formatDateShort(start)} → ${formatDateShort(end)}`;
    }

    let entriesHtml = "";

    if (!related.length) {
        entriesHtml = "<p>No entries</p>";
    } else {
        related.forEach(e => {

            let color = e.amount < 0 ? "#ff5252" : "#4caf50";

            entriesHtml += `
                <div class="expense-item">
                    <div>
                        <strong>${e.purpose || e.category || "Entry"}</strong><br>
                        <small>${new Date(e.date).toLocaleString()}</small>
                    </div>

                    <div style="color:${color}; font-weight:600;">
                        ${formatCurrency(Math.abs(e.amount))}
                    </div>
                </div>
            `;
        });
    }

    showScreen("budgetDetails");

    container.innerHTML = `
    
    <div class="card" style="
        border-radius:16px;
        padding:16px;
        background:#f7f7f7;
        box-shadow: 0 8px 20px rgba(0,0,0,0.08);
    ">

        <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="margin:0;">${name}</h3>
                <small style="color:#666;">${label}</small>
            </div>

            <button onclick="goBackToBudgets()" style="
                background:#eee;
                border:none;
                padding:6px 12px;
                border-radius:8px;
                cursor:pointer;
            ">
                ← Back
            </button>
        </div>

        <div style="margin-top:14px; display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            
            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Allocated</small>
                <div>${formatCurrency(group.totalAllocated)}</div>
            </div>

            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Used</small>
                <div style="color:#ff5252;">${formatCurrency(used)}</div>
            </div>

            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Credited</small>
                <div style="color:#4caf50;">${formatCurrency(credited)}</div>
            </div>

            <div style="background:white; padding:10px; border-radius:10px;">
                <small>Remaining</small>
                <div style="color:#4caf50;">${formatCurrency(remaining)}</div>
            </div>

        </div>

        <hr style="margin:16px 0;">

        <h4>Entries</h4>

        ${entriesHtml}

    </div>
    `;
}

function goBackToBudgets() {
    showScreen("budgets");
    renderBudgetEntries();
}
// =========================
// 📅 CALCULATE DAILY LIMIT
// =========================
// Returns how much you can spend per day
function getDailyLimit() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    // =========================
    // 📦 ACTIVE BUDGETS
    // =========================
    let filteredBudgets = filterBudgetsByActivePeriod(budgets);

    let totalBudget = filteredBudgets
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    // =========================
    // 💸 SPENT
    // =========================
    let filteredExpenses = filterByActivePeriod(expenses);

    let spent = filteredExpenses
        .filter(e => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    // =========================
    // 💰 REMAINING
    // =========================
    let remaining = totalBudget - spent;

    // =========================
    // 📅 DAYS LEFT (PERIOD BASED)
    // =========================
    let period = getActiveBudgetPeriod();

    let daysLeft = 1;

    if (period) {

        let today = new Date();

        // normalize today
        today.setHours(0, 0, 0, 0);

        let end = period.end
            ? new Date(period.end)
            : new Date();

        // normalize end
        end.setHours(0, 0, 0, 0);

        // ✅ ADD EXTRA DAYS
        end.setDate(end.getDate() + (period.extraDays || 0));

        // ✅ calculate remaining days
        let diff = end - today;

        daysLeft = Math.max(
            1,
            Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1
        );
    }

    // =========================
    // 🧠 SAFETY
    // =========================
    if (daysLeft <= 0) return 0;

    // =========================
    // 📊 DAILY LIMIT
    // =========================
    return Math.floor(remaining / daysLeft);
}

// =========================
// 📊 LOAD GRAPH (MERGED VERSION)
// =========================
// Shows day/week/month + category breakdown
// let chart;

// function loadGraph(type = "day", data = null, customRange = null) {

//     const ctx = document.getElementById("myChart");
//     if (!ctx || !window.Chart) return;

//     if (chart) chart.destroy();

//     const expenses = data || getExpenses();
//     const now = new Date();

//     const dataset = groupData(expenses, type, now, customRange);

//     const chartData = prepareChartData(dataset);
//     const datasets = createDatasets(chartData);

//     chart = new Chart(ctx, {
//         type: "bar",
//         data: {
//             labels: chartData.labels,
//             datasets: datasets
//         },
//         options: getChartOptions(type, expenses, dataset, now, customRange)
//     });

//     // 🔥 Initial Category Breakdown
//     const filtered = filterDataByType(type, expenses, now, customRange);
//     renderCategoryBreakdown(groupByCategory(filtered));
// }
// function prepareChartData(dataset) {
//     return {
//         labels: dataset.map(d => d.label),
//         expense: dataset.map(d => d.exp),
//         income: dataset.map(d => d.inc),
//         total: dataset.map(d => d.inc - d.exp)
//     };
// }
// function createDatasets(data) {

//     function getFixedDailyBudget() {
//         let budgets = getBudgets();
//         let currentMonth = new Date().toISOString().slice(0, 7);

//         let filteredBudgets = filterBudgetsByActivePeriod(budgets);

//         let total = filteredBudgets
//             .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

//         let today = new Date();
//         let totalDays = new Date(
//             today.getFullYear(),
//             today.getMonth() + 1,
//             0
//         ).getDate();

//         return Math.floor(total / totalDays);
//     }

//     const fixedDaily = getFixedDailyBudget();
//     const budgetData = data.labels.map(() => fixedDaily);

//     return [
//         {
//             label: "Expense",
//             data: data.expense,
//             backgroundColor: "rgba(255,99,132,0.7)"
//         },
//         {
//             label: "Income",
//             data: data.income,
//             backgroundColor: "rgba(75,192,192,0.7)"
//         },
//         {
//             label: "Total",
//             data: data.total,
//             type: "line",
//             borderColor: "purple",
//             tension: 0.4
//         },
//         {
//             label: "Budget",
//             data: budgetData,
//             type: "line",
//             borderColor: "orange",
//             borderDash: [5, 5]
//         }
//     ];
// }
// function getChartOptions(type, expenses, dataset, now, customRange) {

//     return {
//         responsive: true,
//         maintainAspectRatio: false,

//         plugins: {
//             tooltip: {
//                 mode: "index",
//                 intersect: false,
//                 callbacks: {
//                     label: function (ctx) {
//                         return `${ctx.dataset.label}: ${formatCurrency(ctx.raw)}`;
//                     }
//                 }
//             }
//         },

//         scales: {
//             x: {
//                 ticks: {
//                     maxRotation: 45,
//                     minRotation: 45
//                 }
//             },
//             y: {
//                 beginAtZero: true
//             }
//         },

//         onClick: function (evt, elements) {
//             if (!elements.length) return;

//             const index = elements[0].index;
//             const filtered = handlePointClick(type, index, expenses, dataset, now, customRange);

//             renderCategoryBreakdown(groupByCategory(filtered));
//         }
//     };
// }
// function handlePointClick(type, index, expenses, dataset, now, customRange) {

//     // ✅ DAY (hour-based)
//     if (type === "day") {
//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d.getHours() === index &&
//                 d.toDateString() === now.toDateString();
//         });
//     }

//     // ✅ RANGE (date-based)
//     const selected = dataset[index];
//     if (!selected || !selected.key) return [];

//     return expenses.filter(e => {
//         const d = new Date(e.date);
//         const dKey = d.toLocaleDateString("en-CA");

//         return dKey === selected.key;
//     });
// }
// function filterDataByType(type, expenses, now, customRange) {

//     if (type === "day") {
//         return expenses.filter(e =>
//             new Date(e.date).toDateString() === now.toDateString()
//         );
//     }

//     if (type === "week") {
//         const start = new Date(now);
//         start.setDate(now.getDate() - now.getDay());

//         const end = new Date(start);
//         end.setDate(start.getDate() + 6);

//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d >= start && d <= end;
//         });
//     }

//     if (type === "month") {
//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d.getMonth() === now.getMonth();
//         });
//     }

//     if (type === "custom" && customRange) {
//         return expenses.filter(e => {
//             const d = new Date(e.date);
//             return d >= new Date(customRange.start) &&
//                 d <= new Date(customRange.end);
//         });
//     }

//     return [];
// }

let chart;
function loadGraph(type = "day", data = null, customRange = null) {

    const ctx = document.getElementById("myChart");
    if (!ctx || !window.Chart) return;

    if (chart) chart.destroy();

    const expenses = data || getExpenses();

    const dataset = groupData(expenses, type, null, customRange);

    const chartData = prepareChartData(dataset);
    const datasets = createDatasets(chartData, dataset);

    chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels: chartData.labels,
            datasets: datasets
        },
        options: getChartOptions(type, expenses, dataset, customRange)
    });

    const filtered = filterDataByType(type, expenses, customRange);
    renderCategoryBreakdown(groupByCategory(filtered));
}

function prepareChartData(dataset) {
    return {
        labels: dataset.map(d => d.label),
        expense: dataset.map(d => d.exp),
        income: dataset.map(d => d.inc),

        // 🔥 keep total (for tooltip only)
        total: dataset.map(d => d.inc - d.exp)
    };
}
function createDatasets(data, dataset) {

    function getFixedDailyBudget() {

        let budgets = getBudgets();

        // 🔥 periodKey based filtering
        let activeBudgets = filterBudgetsByActivePeriod(budgets);

        let total = activeBudgets.reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

        // 🔥 get period days
        let period = getActiveBudgetPeriod();

        let totalDays = 30;

        if (period) {

            let s = new Date(period.start);
            let e = period.end ? new Date(period.end) : new Date();

            totalDays = Math.max(
                1,
                Math.floor((e - s) / (1000 * 60 * 60 * 24)) + 1
            );

            // ✅ ADD EXTRA DAYS
            totalDays += (period.extraDays || 0);
        }

        return Math.floor(total / totalDays);
    }

    const budgetData = dataset.map(d => d.budget || 0);

    return [
        {
            label: "Expense",
            data: data.expense,
            backgroundColor: "rgba(255,99,132,0.7)"
        },
        {
            label: "Income",
            data: data.income,
            backgroundColor: "rgba(75,192,192,0.7)"
        },
        // ❌ REMOVED TOTAL LINE
        {
            label: "Budget",
            data: budgetData,
            type: "line",
            borderColor: "orange",
            borderDash: [5, 5]
        }
    ];
}

function getChartOptions(type, expenses, dataset, customRange) {

    return {
        responsive: true,
        maintainAspectRatio: false,

        interaction: {
            mode: "index",
            intersect: false
        },

        plugins: {
            tooltip: {
                backgroundColor: "#111",
                borderColor: "#333",
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10,
                displayColors: false,

                callbacks: {

                    title: function (items) {
                        return items[0].label;
                    },

                    label: function () {
                        return null;
                    },

                    afterBody: function (items) {

                        if (!items.length) return;

                        let index = items[0].dataIndex;
                        let point = dataset[index] || {};

                        let expense = point.exp || 0;
                        let income = point.inc || 0;
                        let budget = point.budget || 0;
                        let total = income - expense;

                        let netColor = total >= 0 ? "" : "";

                        return [
                            `Expense  : ${formatCurrency(expense)}`,
                            `Income   : ${formatCurrency(income)}`,
                            `Budget   : ${formatCurrency(budget)}`,
                            `-----------------------`,
                            `Net      : ${netColor} ${formatCurrency(total)}`
                        ];
                    }
                }
            },

            legend: {
                labels: {
                    color: "#555",
                    usePointStyle: true
                }
            }
        },

        scales: {
            x: {
                grid: {
                    display: true,
                    color: "rgba(0,0,0,0.08)"
                },
                ticks: {
                    color: "#333",
                    autoSkip: true,
                    maxRotation: 90,
                    minRotation: 90
                }
            },

            y: {
                beginAtZero: true,
                grid: {
                    color: "rgba(0,0,0,0.08)"
                },
                ticks: {
                    color: "#333",
                    callback: function (value) {
                        return formatCurrency(value);
                    }
                }
            }
        },

        animation: {
            duration: 700,
            easing: "easeOutQuart"
        },

        onClick: function (evt, elements) {

            if (!elements.length) return;

            const index = elements[0].index;

            const filtered = handlePointClick(
                type,
                index,
                expenses,
                dataset,
                customRange
            );

            renderCategoryBreakdown(groupByCategory(filtered));
        }
    };
}

function filterDataByType(
    type,
    expenses,
    customRange = null
) {

    type =
        (type || "month").toLowerCase();

    let start;
    let end;

    let now = new Date();

    // =========================
    // 📅 TODAY
    // =========================
    if (type === "day") {

        start = new Date();

        start.setHours(0, 0, 0, 0);

        end = new Date();

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 📅 WEEK
    // =========================
    else if (type === "week") {

        start = new Date(now);

        start.setDate(
            now.getDate() - now.getDay()
        );

        start.setHours(0, 0, 0, 0);

        end = new Date(start);

        end.setDate(
            start.getDate() + 6
        );

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 📅 MONTH / ACTIVE PERIOD
    // =========================
    else if (type === "month") {

        let period =
            getActiveBudgetPeriod();

        if (period) {

            start =
                new Date(period.start);

            end =
                period.end
                    ? new Date(period.end)
                    : new Date();

        } else {

            start = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            end = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0
            );
        }

        start.setHours(0, 0, 0, 0);

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 📅 CUSTOM
    // =========================
    else if (
        type === "custom" &&
        customRange
    ) {

        start =
            new Date(customRange.start);

        end =
            new Date(customRange.end);

        start.setHours(0, 0, 0, 0);

        end.setHours(23, 59, 59, 999);
    }

    // =========================
    // 🧠 FILTER
    // =========================
    return expenses.filter(e => {

        let d = new Date(e.date);

        return d >= start &&
            d <= end;
    });
}

// function filterByIndex(data, type, index, now) {
//     return data.filter(e => {
//         let d = e.date ? new Date(e.date) : null;

//         if (!d || isNaN(d.getTime())) return;

//         if (type === "day") {
//             return d.getHours() === index &&
//                 d.toDateString() === now.toDateString();
//         }

//         if (type === "week") {
//             let start = new Date(now);
//             start.setDate(now.getDate() - now.getDay());

//             let selected = new Date(start);
//             selected.setDate(start.getDate() + index);

//             return d.toDateString() === selected.toDateString();
//         }

//         if (type === "month") {
//             return d.getDate() === index + 1 &&
//                 d.getMonth() === now.getMonth();
//         }
//     });
// }

// Default filter
// function filterByType(data, type, now) {
//     return data.filter(e => {
//         let d = e.date ? new Date(e.date) : null;

//         if (!d || isNaN(d.getTime())) return;

//         if (type === "day") return d.toDateString() === now.toDateString();

//         if (type === "week") {
//             let start = new Date(now);
//             start.setDate(now.getDate() - now.getDay());
//             return d >= start;
//         }

//         if (type === "month") {
//             return d.getMonth() === now.getMonth();
//         }

//         return true;
//     });
// }

// =========================
// 📊 GROUP BY CATEGORY
// =========================
// Converts list → category totals
function groupByCategory(data) {
    let map = {};

    data.forEach(e => {
        if (e.amount < 0) {
            let cat = e.category || "Other";

            if (!map[cat]) map[cat] = 0;

            map[cat] += Math.abs(e.amount);
        }
    });

    return map;
}

// =========================
// 📊 RENDER CATEGORY BREAKDOWN
// =========================
// Displays category-wise spending
function renderCategoryBreakdown(map) {

    let container = document.getElementById("categoryBreakdown");
    if (!container) return;

    container.innerHTML = "";

    // ✅ FIX: handle undefined/null safely
    if (!map || typeof map !== "object") {
        container.innerHTML = "<p>No data</p>";
        return;
    }

    let entries = Object.entries(map);

    if (!entries.length) {
        container.innerHTML = "<p>No data</p>";
        return;
    }

    entries.forEach(([cat, amt]) => {
        let div = document.createElement("div");

        div.style.display = "flex";
        div.style.justifyContent = "space-between";
        div.style.padding = "6px 0";

        div.innerHTML = `
            <span>${cat}</span>
            <strong>${formatCurrency(amt)}</strong>
        `;

        container.appendChild(div);
    });
}

function groupData(expenses, type, now, customRange = null) {

    now = new Date();

    let map = {};

    // =========================
    // 📅 SAFE DATE KEY
    // =========================
    function formatDateSafe(date) {

        let d = new Date(date);

        return [
            d.getFullYear(),
            String(d.getMonth() + 1).padStart(2, "0"),
            String(d.getDate()).padStart(2, "0")
        ].join("-");
    }

    // =========================
    // 📊 DAY VIEW
    // =========================
    if (type === "day") {

        for (let i = 0; i < 24; i++) {

            map[i] = {
                exp: 0,
                inc: 0,
                budget: getDailyLimit()
            };
        }

        expenses.forEach(e => {

            let d = new Date(e.date);

            if (d.toDateString() !== now.toDateString()) {
                return;
            }

            let hour = d.getHours();

            if (e.amount < 0) {

                map[hour].exp += Math.abs(e.amount);

            } else {

                map[hour].inc += e.amount;
            }
        });

        return Object.keys(map).map(h => ({

            key: h,

            label: h + ":00",

            exp: map[h].exp,

            inc: map[h].inc,

            budget: map[h].budget
        }));
    }

    // =========================
    // 📅 RANGE SETUP
    // =========================
    let start;
    let end;

    // WEEK
    if (type === "week") {

        start = new Date(now);

        start.setDate(
            now.getDate() - now.getDay()
        );

        end = new Date(start);

        end.setDate(
            start.getDate() + 6
        );
    }

    // MONTH / ACTIVE PERIOD
    else if (type === "month") {

        let period =
            getActiveBudgetPeriod();

        if (period) {

            start = new Date(period.start);

            end = period.end
                ? new Date(period.end)
                : new Date();

        } else {

            start = new Date(
                now.getFullYear(),
                now.getMonth(),
                1
            );

            end = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0
            );
        }
    }

    // CUSTOM
    else if (type === "custom") {

        if (
            customRange &&
            customRange.start &&
            customRange.end
        ) {

            start =
                new Date(customRange.start);

            end =
                new Date(customRange.end);

        } else {

            let period =
                getActiveBudgetPeriod();

            if (period) {

                start =
                    new Date(period.start);

                end =
                    period.end
                        ? new Date(period.end)
                        : new Date();
            }
        }
    }

    // =========================
    // 🧠 SAFETY
    // =========================
    if (!start || !end) {
        return [];
    }

    start.setHours(0, 0, 0, 0);

    end.setHours(23, 59, 59, 999);

    // =========================
    // 💰 INITIAL RUNNING BUDGET
    // =========================
    let runningBudget =
        getTotalBudget();

    // =========================
    // 🗓️ BUILD DATE MAP
    // =========================
    let current =
        new Date(start);

    while (current <= end) {

        let key =
            formatDateSafe(current);

        map[key] = {

            key: key,

            label:
                current.toLocaleDateString(
                    "en-IN",
                    {
                        day: "numeric",
                        month: "short"
                    }
                ),

            exp: 0,

            inc: 0,

            budget: runningBudget
        };

        current.setDate(
            current.getDate() + 1
        );
    }

    // =========================
    // 📦 SORT EXPENSES
    // =========================
    let sortedExpenses =
        [...expenses].sort(
            (a, b) =>
                new Date(a.date) -
                new Date(b.date)
        );

    // =========================
    // 📊 FILL DATA
    // =========================
    sortedExpenses.forEach(e => {

        let key =
            formatDateSafe(e.date);

        if (!map[key]) {
            return;
        }

        // EXPENSE
        if (e.amount < 0) {

            let abs =
                Math.abs(e.amount);

            map[key].exp += abs;

        }

        // INCOME
        else {

            map[key].inc += e.amount;
        }
    });

    // =========================
    // 📉 CUMULATIVE BUDGET LINE
    // =========================
    let remainingBudget =
        getTotalBudget();

    Object.values(map).forEach(day => {

        day.budget =
            remainingBudget;

        remainingBudget -=
            day.exp;
    });

    return Object.values(map);
}

// function groupByCategory(expenses) {

//     let map = {};

//     expenses.forEach(e => {
//         if (e.amount < 0) { // only expense
//             let cat = e.category || "Other";

//             if (!map[cat]) map[cat] = 0;

//             map[cat] += Math.abs(e.amount);
//         }
//     });

//     return map;
// }


function getLoanSummary() {
    let expenses = getExpenses();

    let loans = {};

    expenses.forEach(e => {
        if (!e.entity) return;

        if (!loans[e.entity]) {
            loans[e.entity] = {
                given: 0,
                received: 0
            };
        }

        if (e.amount < 0) {
            loans[e.entity].given += Math.abs(e.amount);
        }

        if (e.amount > 0 && e.category === "Recovery") {
            loans[e.entity].received += e.amount;
        }
    });

    let result = [];

    for (let person in loans) {
        let given = loans[person].given;
        let received = loans[person].received;

        result.push({
            person,
            given,
            received,
            pending: given - received
        });
    }

    return result;
}
function renderLoanSummary() {
    let container = document.getElementById("loanSummary");
    if (!container) return;

    let data = getLoanSummary();

    container.innerHTML = "";

    if (!data || !data.length) {
        container.innerHTML = "<p>No loans yet</p>";
        return;
    }

    data.forEach(item => {

        let wrapper = document.createElement("div");

        let statusColor = item.pending > 0 ? "red" : "green";
        let statusText = item.pending > 0 ? "Pending" : "Cleared";

        wrapper.innerHTML = `
            <div style="margin-bottom:12px;">
                <strong>${item.person}</strong><br>

                Given: ${formatCurrency(item.given)} |
                Received: ${formatCurrency(item.received)} <br>

                <span style="color:${statusColor}; font-weight:600;">
                    ${statusText}: ${formatCurrency(item.pending)}
                </span>
            </div>
        `;

        container.appendChild(wrapper);
    });
}

// function renderBudgetEntries() {
//     let container = document.getElementById("budgetEntries");
//     if (!container) return;

//     let budgets = getBudgets();
//     let expenses = getExpenses();

//     container.innerHTML = "";

//     if (!budgets.length) {
//         container.innerHTML = "<p>No budget entries</p>";
//         return;
//     }

//     budgets.forEach(b => {

//         // 🔥 calculate spent
//         let spent = expenses
//             .filter(e => e.budgetId === b.budgetId && e.type === "expense")
//             .reduce((sum, e) => sum + Math.abs(e.amount), 0);

//         let remaining = (b.totalAllocated || 0) - spent;

//         let div = document.createElement("div");
//         div.className = "budget-card";

//         div.innerHTML = `
//             <div>
//                 <strong>${formatBudgetName(b.budgetId)}</strong><br>
//                 <small>${b.entity}</small>
//             </div>

//             <div style="margin-top:6px;">
//                 Allocated: ₹${b.totalAllocated || 0}<br>
//                 Spent: ₹${spent}<br>
//                 <strong style="color:${remaining >= 0 ? 'green' : 'red'}">
//                     Remaining: ${formatCurrency(remaining)}
//                 </strong>
//             </div>
//         `;

//         container.appendChild(div);
//     });
// }
function openBudgetScreen() {
    renderBudgetEntries();  // 🔥 MUST
}

// =========================
// 🗓️ FORMAT HELPERS
// =========================
function formatMonth(monthKey) {
    if (!monthKey) return "No Date";

    let [year, month] = monthKey.split("-");
    let date = new Date(year, month - 1);

    return date.toLocaleString("default", {
        month: "short",
        year: "numeric"
    });
}
function openImportModal() {
    let modal = document.getElementById("importModal");
    if (modal) modal.style.display = "flex";
}

function closeImportModal() {
    let modal = document.getElementById("importModal");
    if (modal) modal.style.display = "none";
}

function handleFileImport(event) {
    let file = event.target.files[0];
    if (!file) return;

    let reader = new FileReader();

    reader.onload = function (e) {
        let text = e.target.result;

        document.getElementById("importText").value = text;
    };

    reader.readAsText(file);
}


function openConfirm() {
    document.getElementById("confirmModal").style.display = "flex";
}

function closeConfirm() {
    document.getElementById("confirmModal").style.display = "none";
}

function confirmReset() {
    localStorage.clear();
    location.reload();
}

function setColorByCode(hex) {
    let picker = document.getElementById("colorPicker");

    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    picker.value = hex;

    // Apply to your app
    applyCustomColor(hex);
}
function applyHex() {
    let hex = document.getElementById("hexInput").value;

    if (!hex) return;

    if (!hex.startsWith("#")) {
        hex = "#" + hex;
    }

    document.getElementById("colorPicker").value = hex;
    applyCustomColor(hex);
}

function updateProgressBar() {

    let budgets = getBudgets();
    let expenses = getExpenses();

    let filteredBudgets = filterBudgetsByActivePeriod(budgets);

    let totalBudget = filteredBudgets
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let filtered = filterByActivePeriod(expenses);

    let totalSpent = filtered
        .filter(e => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let percent = totalBudget
        ? (totalSpent / totalBudget) * 100
        : 0;

    percent = Math.min(percent, 100);

    let fill = document.getElementById("progressFill");
    let text = document.getElementById("progressText");

    if (fill) fill.style.width = percent + "%";
    if (text) text.innerText = `${percent.toFixed(1)}% used`;
}
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

function injectGlobalFooter() {
    const year = new Date().getFullYear(); // ✅ dynamic year

    const footer = document.createElement("div");
    footer.className = "app-signature";

    footer.innerHTML = `
        <div>Developed by <strong>Gopichaninme</strong></div>
        <small style="opacity:0.7;">© ${year} All rights reserved</small>
    `;

    document.querySelector(".app")?.appendChild(footer);
}

// // =========================
// // 🔔 CONFIG
// // =========================
// const NOTIF_KEY = "notificationsEnabled";
// const CHECK_INTERVAL = 15000; // 15 sec
// const INSIGHT_INTERVAL = 3600000; // 1 hour

// let lastAlertTime = 0;
// let lastUsageLevel = 0;

// // =========================
// // 🔐 PERMISSION
// // =========================
// async function requestNotificationPermission() {
//     if (!("Notification" in window)) return;

//     try {
//         const permission = await Notification.requestPermission();
//         console.log("🔐 Permission:", permission);
//         updateNotificationStatus();
//     } catch (err) {
//         console.error("Permission Error:", err);
//     }
// }

// // =========================
// // 📩 UNIVERSAL NOTIFY
// // =========================
// function notify(title, body) {
//     try {
//         // 📱 Android bridge (if exists)
//         if (window.Android && typeof Android.showNotification === "function") {
//             Android.showNotification(title, body);
//             return;
//         }

//         // 🌐 Browser notification
//         if ("Notification" in window && Notification.permission === "granted") {
//             new Notification(title, { body });
//             return;
//         }

//         // 🔄 fallback
//         toast(`${title} - ${body}`);

//     } catch (e) {
//         console.error("Notify error:", e);
//         toast(body);
//     }
// }

// // =========================
// // 📊 BUDGET ALERT ENGINE
// // =========================
// function checkBudgetUsage() {
//     const expenses = JSON.parse(localStorage.getItem("expenses")) || [];
//     const budgets = JSON.parse(localStorage.getItem("budgets")) || [];

//     if (!budgets.length) return;

//     const totalSpent = expenses.reduce((sum, e) =>
//         sum + (e.amount < 0 ? Math.abs(e.amount) : 0), 0);

//     const totalBudget = budgets.reduce((sum, b) =>
//         sum + (b.totalAllocated || 0), 0);

//     if (!totalBudget) return;

//     const usage = totalSpent / totalBudget;

//     // 🔥 Trigger only on crossing threshold
//     if (usage > 0.8 && lastUsageLevel <= 0.8) {
//         notify("⚠️ Budget Alert", `You crossed 80% usage`);
//     }

//     lastUsageLevel = usage;
// }

// // =========================
// // 💡 SMART INSIGHT ENGINE
// // =========================
// function generateInsight() {
//     const expenses = JSON.parse(localStorage.getItem("expenses")) || [];

//     if (!expenses.length) {
//         return "Start tracking your expenses to unlock insights 📊";
//     }

//     const total = expenses.reduce((s, e) => s + Math.abs(e.amount), 0);

//     const today = new Date().toISOString().split("T")[0];
//     const todaySpent = expenses
//         .filter(e => e.date === today)
//         .reduce((s, e) => s + Math.abs(e.amount), 0);

//     const insights = [
//         "💡 You're building a strong habit. Keep going!",
//         "📉 Cutting one small expense daily saves big monthly",
//         `💰 Total tracked spending: ₹${total}`,
//         `📅 Today you spent ₹${todaySpent}`,
//         "🎯 Try a 'No Spend Day' challenge today",
//         "📊 Review your top category and optimize it",
//         "⚡ Smart move: Track every rupee, even small ones",
//         "🧠 Awareness = Control. You're improving already",
//         "📈 Consistency beats motivation",
//         "🔍 Look for one expense you can eliminate today"
//     ];

//     return insights[Math.floor(Math.random() * insights.length)];
// }

// // =========================
// // ⏱️ HOURLY INSIGHT ENGINE
// // =========================
// function startInsights() {
//     setInterval(() => {
//         const enabled = localStorage.getItem(NOTIF_KEY) !== "false";
//         if (!enabled) return;

//         notify("💡 Smart Insight", generateInsight());

//     }, INSIGHT_INTERVAL);
// }

// // =========================
// // 🔘 TOGGLE CONTROL
// // =========================
// function toggleNotifications() {
//     let enabled = localStorage.getItem(NOTIF_KEY) !== "false";

//     enabled = !enabled;
//     localStorage.setItem(NOTIF_KEY, enabled);

//     updateToggleButton();

//     toast(enabled ? "Notifications ON 🔔" : "Notifications OFF ⛔");
// }

// function updateToggleButton() {
//     const btn = document.getElementById("notifToggleBtn");
//     if (!btn) return;

//     const enabled = localStorage.getItem(NOTIF_KEY) !== "false";
//     btn.innerText = enabled ? "Stop Notifications" : "Start Notifications";
// }

// // =========================
// // 📊 STATUS UI
// // =========================
// function updateNotificationStatus() {
//     const el = document.getElementById("notifStatus");
//     if (!el) return;

//     if (!("Notification" in window)) {
//         el.innerText = "Status: Not supported ❌";
//         return;
//     }

//     el.innerText = "Status: " + Notification.permission;
// }

// // =========================
// // 🧪 TEST
// // =========================
// function testNotification() {
//     notify("🧪 Test Notification", "Everything working perfectly 🎉");
// }

// // =========================
// // 🎨 TOAST (fallback)
// // =========================
// function toast(msg) {
//     const div = document.createElement("div");
//     div.innerText = msg;
//     div.style = `
//         position:fixed;
//         bottom:20px;
//         left:50%;
//         transform:translateX(-50%);
//         background:#333;
//         color:#fff;
//         padding:10px 15px;
//         border-radius:8px;
//         z-index:9999;
//     `;
//     document.body.appendChild(div);
//     setTimeout(() => div.remove(), 3000);
// }

// // =========================
// // 🚀 INIT
// // =========================
// (function initNotificationSystem() {
//     requestNotificationPermission();
//     updateNotificationStatus();
//     updateToggleButton();

//     setInterval(checkBudgetUsage, CHECK_INTERVAL);
//     startInsights();
// })();

// function enableNotifications() {
//     requestNotificationPermission();
// }
function handleFilter(type) {

    if (type === "period") {

        openPeriod();

        return;
    }

    let expenses =
        getExpenses();

    let filtered =
        filterDataByType(
            type,
            expenses
        );

    loadHistory(filtered);

    if (typeof loadGraph === "function") {

        loadGraph(type, filtered);
    }

    if (
        typeof renderCategoryBreakdown ===
        "function"
    ) {

        renderCategoryBreakdown(
            groupByCategory(filtered)
        );
    }
}
function formatDateLabel(dateStr) {
    let d = new Date(dateStr);

    return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short"
    });
}

function updateCustomPeriodLabel(from, to) {
    const select = document.getElementById("filterType");
    const option = select.querySelector('option[value="period"]');

    if (from && to) {
        option.textContent = `Custom Period (${formatDateLabel(from)} → ${formatDateLabel(to)})`;
    } else if (from) {
        option.textContent = `Custom Period (${formatDateLabel(from)})`;
    } else {
        option.textContent = "Custom Period";
    }

    select.value = "period"; // keep selected
}

// function exportDataAsExcel() {

//     let data = {
//         expenses: getExpenses() || [],
//         budgets: getBudgets() || [],
//         savings: getSavings() || [],
//         orders: JSON.parse(localStorage.getItem("orders")) || []
//     };

//     // =========================
//     // 🧠 HELPER: Normalize Order ID
//     // =========================
//     function normalizeOrderId(id) {
//         let str = String(id || "");
//         return str.startsWith("order_") ? str : "order_" + str;
//     }

//     // =========================
//     // 📦 CREATE WORKBOOK
//     // =========================
//     let wb = XLSX.utils.book_new();

//     // =========================
//     // 📄 SHEET 1: EXPENSES
//     // =========================
//     let expSheet = XLSX.utils.json_to_sheet(
//         data.expenses.map(e => ({
//             ...e,
//             sourceId: e.sourceId ? String(e.sourceId) : ""
//         }))
//     );
//     XLSX.utils.book_append_sheet(wb, expSheet, "Expenses");

//     // =========================
//     // 📄 SHEET 2: BUDGETS
//     // =========================
//     let budSheet = XLSX.utils.json_to_sheet(
//         data.budgets.map(b => ({
//             ...b,
//             id: b.id ? String(b.id) : ""
//         }))
//     );
//     XLSX.utils.book_append_sheet(wb, budSheet, "Budgets");

//     // =========================
//     // 📄 SHEET 3: SAVINGS
//     // =========================
//     let savSheet = XLSX.utils.json_to_sheet(
//         data.savings.map(s => ({
//             ...s,
//             id: s.id ? String(s.id) : "",
//             sourceId: s.sourceId ? String(s.sourceId) : ""
//         }))
//     );
//     XLSX.utils.book_append_sheet(wb, savSheet, "Savings");

//     // =========================
//     // 📄 SHEET 4: ORDERS
//     // =========================
//     let ordersSheetData = data.orders.map(o => ({
//         orderId: normalizeOrderId(o.id),

//         subtotal: Number(o.subtotal) || 0,
//         gst: Number(o.gst) || 0,
//         total: Number(o.total) || 0,

//         sourceName: o.sourceName || "",
//         sourceType: o.sourceType || "",
//         paymentType: o.paymentType || "",

//         date: o.date || ""
//     }));

//     let ordersSheet = XLSX.utils.json_to_sheet(ordersSheetData);
//     XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");

//     // =========================
//     // 📄 SHEET 5: ORDER ITEMS
//     // =========================
//     let orderItems = [];

//     data.orders.forEach(o => {
//         let orderId = normalizeOrderId(o.id);

//         (o.items || []).forEach(i => {
//             orderItems.push({
//                 orderId: orderId,

//                 itemName: i.name || "",
//                 qty: Number(i.qty) || 0,
//                 price: Number(i.price) || 0,
//                 itemTotal: Number(i.total) || 0
//             });
//         });
//     });

//     let itemsSheet = XLSX.utils.json_to_sheet(orderItems);
//     XLSX.utils.book_append_sheet(wb, itemsSheet, "Order Items");

//     // =========================
//     // 💾 DOWNLOAD FILE
//     // =========================
//     XLSX.writeFile(
//         wb,
//         `money-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`
//     );
// }

function exportDataAsExcel() {

    let data = {
        expenses: getExpenses() || [],
        budgets: getBudgets() || [],
        savings: getSavings() || [],
        orders: JSON.parse(localStorage.getItem("orders")) || [],

        categories: JSON.parse(localStorage.getItem("categories")) || [],
        persons: JSON.parse(localStorage.getItem("persons")) || [],
        budgetPeriods: JSON.parse(localStorage.getItem("bp")) || []
    };

    function normalizeOrderId(id) {
        let str = String(id || "");
        return str.startsWith("order_") ? str : "order_" + str;
    }

    let wb = XLSX.utils.book_new();

    // =========================
    // 📄 EXPENSES
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.expenses),
        "Expenses"
    );

    // =========================
    // 📄 BUDGETS
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.budgets),
        "Budgets"
    );

    // =========================
    // 📄 SAVINGS
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.savings),
        "Savings"
    );

    // =========================
    // 📄 ORDERS
    // =========================
    let ordersSheet = XLSX.utils.json_to_sheet(
        data.orders.map(o => ({
            orderId: normalizeOrderId(o.id),
            subtotal: Number(o.subtotal) || 0,
            gst: Number(o.gst) || 0,
            total: Number(o.total) || 0,
            sourceName: o.sourceName || "",
            sourceType: o.sourceType || "",
            paymentType: o.paymentType || "",
            date: o.date || ""
        }))
    );

    XLSX.utils.book_append_sheet(wb, ordersSheet, "Orders");

    // =========================
    // 📄 ORDER ITEMS
    // =========================
    let orderItems = [];

    data.orders.forEach(o => {
        let orderId = normalizeOrderId(o.id);

        (o.items || []).forEach(i => {
            orderItems.push({
                orderId,
                itemName: i.name || "",
                qty: Number(i.qty) || 0,
                price: Number(i.price) || 0,
                itemTotal: Number(i.total) || (i.qty * i.price) || 0
            });
        });
    });

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(orderItems),
        "Order Items"
    );

    // =========================
    // 📄 EXTRA TABLES
    // =========================
    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.categories),
        "Categories"
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.persons),
        "Persons"
    );

    XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(data.budgetPeriods),
        "Budget Periods"
    );

    // =========================
    // 💾 DOWNLOAD
    // =========================
    XLSX.writeFile(
        wb,
        `money-tracker-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
}

function openBackupOptions() {
    document.getElementById("backupModal").style.display = "flex";
}

function closeBackupModal() {
    document.getElementById("backupModal").style.display = "none";
}

function toggleCategory() {
    openCategoryModal(); // your existing function

    let arrow = document.getElementById("catArrow");

    arrow.textContent = arrow.textContent === ">" ? "⌄" : ">";
}

function formatCurrencyPDF(amount) {
    let code = getCurrencyCode();
    let converted = convertFromBase(amount);

    return `${code}. ${converted.toFixed(2)}`;
}


/* =========================
   🧧 BUDGET PERIOD ENGINE
========================= */

// 🔹 Get active budget period
function getActiveBudgetPeriod() {
    let periods = JSON.parse(localStorage.getItem("bp")) || [];
    return periods.find(p => p.status === "active") || null;
}

// 🔹 Get active period key (GLOBAL SAFE)
function getActivePeriodKey() {

    let p =
        getActiveBudgetPeriod();

    if (!p) return null;

    function safeDate(date) {

        let d = new Date(date);

        return [
            d.getFullYear(),
            String(d.getMonth() + 1)
                .padStart(2, "0"),
            String(d.getDate())
                .padStart(2, "0")
        ].join("-");
    }

    let start =
        safeDate(p.start);

    let end =
        p.end
            ? safeDate(p.end)
            : safeDate(new Date());

    return `${start}_to_${end}`;
}

function isWithinBudgetPeriod(dateStr) {

    let period = getActiveBudgetPeriod();

    if (!period) return false;

    let d = new Date(dateStr);

    let start = new Date(period.start);

    let end = period.end
        ? new Date(period.end)
        : new Date();

    d.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return d >= start && d <= end;
}

function filterByActivePeriod(expenses) {

    let period =
        getActiveBudgetPeriod();

    // =========================
    // 📅 ACTIVE PERIOD
    // =========================
    if (period) {

        return expenses.filter(
            e => isWithinBudgetPeriod(e.date)
        );
    }

    // =========================
    // 📅 FALLBACK MONTH
    // =========================
    let now = new Date();

    return expenses.filter(e => {

        let d = new Date(e.date);

        return (
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear()
        );
    });
}
function filterBudgetsByActivePeriod(budgets) {
    let periodKey = typeof getActivePeriodKey === "function"
        ? getActivePeriodKey()
        : null;

    if (periodKey) {
        // Prefer period-based budgets
        return budgets.filter(b => b.periodKey === periodKey);
    }

    // Fallback → month
    let now = new Date();

    let currentMonth = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0")].join("-");
    return budgets.filter(b => b.monthKey === currentMonth);
}
function generateHeadline() {

    let budgets = getBudgets();
    let expenses = getExpenses();
    let period = getActiveBudgetPeriod();

    let messages = [];

    // =========================
    // 🚨 NO ACTIVE PERIOD
    // =========================
    if (!period) {
        messages.push("No active budget period. Please create or activate one.");
        messages.push("Budget tracking is currently running on fallback mode.");
        return messages.join("   •   ");
    }

    // =========================
    // 📦 NO BUDGET CREATED
    // =========================
    let activeBudgets = filterBudgetsByActivePeriod(budgets);

    if (!activeBudgets.length) {
        messages.push("No budget allocated for current period.");
        messages.push("Add a budget using 'Move to Budget' to start tracking.");
        return messages.join("   •   ");
    }

    // =========================
    // 📊 CALCULATE STATUS
    // =========================
    let filteredExpenses = filterByActivePeriod(expenses);

    let totalBudget = activeBudgets
        .reduce((sum, b) => sum + (b.totalAllocated || 0), 0);

    let spent = filteredExpenses
        .filter(e => e.amount < 0)
        .reduce((sum, e) => sum + Math.abs(e.amount), 0);

    let remaining = totalBudget - spent;

    let percent = totalBudget ? (spent / totalBudget) * 100 : 0;

    // =========================
    // 🚨 ALERT STATES
    // =========================
    if (remaining < 0) {
        messages.push("Overspending detected. Review your recent expenses.");
    }
    else if (percent > 80) {
        messages.push("Budget usage exceeded 80 percent. Monitor spending closely.");
    }
    else if (percent > 50) {
        messages.push("You have used more than half of your budget.");
    }
    else {
        messages.push("Spending is within safe range.");
    }

    // =========================
    // 🧠 SMART GUIDANCE
    // =========================
    messages.push("Keep tracking regularly to maintain control.");
    messages.push("Review expenses before making new allocations.");

    return messages.join("   •   ");
}

function startHeadline() {
    let el = document.getElementById("headlineText");
    if (!el) return;

    function update() {
        let text = generateHeadline();
        el.innerText = text;
    }

    update();

    // smooth refresh (avoid flicker)
    setInterval(update, 20000);
}

function prepareSplit(amount, budgets) {

    let remaining = amount;
    let result = [];

    for (let b of budgets) {

        if (remaining <= 0) break;

        let expenses = getExpenses();

        let spent = expenses
            .filter(e =>
                e.budgetId === b.budgetId &&
                e.amount < 0
            )
            .reduce((s, e) => s + Math.abs(e.amount), 0);

        let available = (b.totalAllocated || 0) - spent;// or remaining field
        if (available <= 0) continue;
        let use = Math.min(available, remaining);

        if (use > 0) {
            result.push({
                budget: b,
                amount: use
            });
            remaining -= use;
        }
    }

    return remaining > 0 ? null : result;
}

function handleExpenseSave(amount, attachmentId = null) {

    // =========================
    // ✅ VALIDATE
    // =========================
    if (!amount || amount <= 0) {

        showToast("Invalid amount");
        return;
    }

    // =========================
    // ✅ ACTIVE PERIOD CHECK
    // =========================
    let activePeriod = getActiveBudgetPeriod();

    if (!activePeriod) {

        showToast("No active budget period");
        return;
    }

    // =========================
    // ✅ FORM VALUES
    // =========================
    let category =
        document.getElementById("category")?.value || "Others";

    let purpose =
        document.getElementById("purpose")?.value || "";

    let paymentType =
        document.getElementById("paymentType")?.value || "Cash";

    // let date =
    //     document.getElementById("expenseDate")?.value ||
    //     new Date().toISOString();
    let rawDate =
        document.getElementById("expenseDate")?.value;

    let dateObj;

    if (!rawDate) {

        // no date selected
        dateObj = new Date();

    } else {

        let selected = new Date(rawDate);
        let today = new Date();

        // TODAY
        if (
            selected.toDateString() ===
            today.toDateString()
        ) {

            dateObj = new Date();

        } else {

            // PAST DATE = END OF DAY
            selected.setHours(23, 59, 59, 999);

            dateObj = selected;
        }
    }

    let date = dateObj.toISOString();

    // =========================
    // ✅ GET ACTIVE BUDGETS
    // =========================
    let budgets =
        filterBudgetsByActivePeriod(getBudgets());

    if (!budgets.length) {

        showToast("No budgets available");
        return;
    }

    // =========================
    // ✅ GET EXPENSES
    // =========================
    let expenses = getExpenses();

    // =========================
    // ✅ SORT BY AVAILABLE
    // =========================
    budgets.sort((a, b) => {

        let spentA = expenses
            .filter(e =>
                e.budgetId === a.budgetId &&
                e.amount < 0
            )
            .reduce((s, e) =>
                s + Math.abs(e.amount), 0);

        let spentB = expenses
            .filter(e =>
                e.budgetId === b.budgetId &&
                e.amount < 0
            )
            .reduce((s, e) =>
                s + Math.abs(e.amount), 0);

        let availableA =
            (a.totalAllocated || 0) - spentA;

        let availableB =
            (b.totalAllocated || 0) - spentB;

        return availableB - availableA;
    });

    // =========================
    // ✅ CHECK SINGLE BUDGET
    // =========================
    let single = budgets.find(b => {

        let spent = expenses
            .filter(e =>
                e.budgetId === b.budgetId &&
                e.amount < 0
            )
            .reduce((s, e) =>
                s + Math.abs(e.amount), 0);

        let available =
            (b.totalAllocated || 0) - spent;

        return available >= amount;
    });

    // =========================
    // ✅ DIRECT SAVE
    // =========================
    let split =
        prepareSplit(amount, budgets);

    // =========================
    // ❌ NOT ENOUGH BUDGET
    // =========================
    if (!split) {

        showToast("Not enough total budget");
        return;
    }

    // =========================
    // ✅ SINGLE DIRECT ENTRY
    // =========================
    if (split.length === 1) {

        let s = split[0];

            addExpense({
            amount: s.amount, // positive input; addExpense will normalize by type
            budgetId: s.budget.budgetId,
            allocationTrail: [{ budgetId: s.budget.budgetId, amount: s.amount }],
            category,
            purpose,
            paymentType,
            date,
            attachmentId: attachmentId || null,
            type: "expense"
        });

        loadDashboard();
        loadHistory();
        loadGraph();
        updateBudgetEfficiency();
        renderBudgetEntries();
        loadBudgetOptions();

        showToast("Expense added");

        resetForm();

        return;
    }

    // =========================
    // ✅ PREPARE SPLIT
    // =========================
    let split =
        prepareSplit(amount, budgets);

    // =========================
    // ❌ NOT ENOUGH BUDGET
    // =========================
    if (!split) {

        showToast("Not enough total budget");
        return;
    }

    // =========================
    // 🔥 OPEN SPLIT MODAL
    // =========================
    openSplitModal(split);
}

let pendingSplit = null;

function openSplitModal(split) {

    pendingSplit = split;

    let container = document.getElementById("splitDetails");

    container.innerHTML = `
        <p>This expense will be allocated as:</p>
        <ul>
            ${split.map(s => `
                <li>₹${s.amount} from ${s.budget.entity || "Budget"}</li>
            `).join("")}
        </ul>
    `;

    document.getElementById("splitModal").style.display = "flex";
}

function confirmSplit() {

    if (!pendingSplit) return;

    let category =
        document.getElementById("category")?.value || "Others";

    let purpose =
        document.getElementById("purpose")?.value || "";

    let paymentType =
        document.getElementById("paymentType")?.value || "Cash";

    // let date =
    //     document.getElementById("expenseDate")?.value ||
    //     new Date().toISOString();
    let rawDate =
        document.getElementById("expenseDate")?.value;

    let date =
        buildSmartExpenseDate(rawDate);

    let splitId = "split_" + Date.now();

        pendingSplit.forEach((s, index) => {

        addExpense({
            amount: -Math.abs(s.amount),

            budgetId: s.budget.budgetId,

            splitId: splitId,
            splitIndex: index + 1,
            isSplit: true,

            category,
            purpose,
            paymentType,
            date,
            type: "expense",
            attachmentId: attachmentId || null
        });
    });

    closeSplitModal();

    loadDashboard();
    updateBudgetEfficiency();
    renderBudgetEntries();
    loadBudgetOptions();
    loadHistory();
    loadGraph();

    showToast("Split expense added");

    resetForm();
}

function closeSplitModal() {
    document.getElementById("splitModal").style.display = "none";
    pendingSplit = null;
}

function updateBudgetEfficiency() {

    let dailyLimit =
        getDailyLimit();

    let expenses =
        filterByActivePeriod(
            getExpenses()
        );

    // =========================
    // 📅 TODAY
    // =========================
    let now = new Date();

    let start = new Date(now);

    start.setHours(0, 0, 0, 0);

    let end = new Date(now);

    end.setHours(23, 59, 59, 999);

    let todaySpent = expenses
        .filter(e => {

            if (e.amount >= 0)
                return false;

            let d =
                new Date(e.date);

            return d >= start &&
                d <= end;

        })
        .reduce((s, e) =>
            s + Math.abs(e.amount), 0);

    // =========================
    // 💰 SAVED TODAY
    // =========================
    let savedToday =
        Math.max(
            0,
            dailyLimit - todaySpent
        );

    // =========================
    // 📊 WEEK SAVED
    // =========================
    let weekStart = new Date(now);

    weekStart.setDate(
        now.getDate() - now.getDay()
    );

    weekStart.setHours(0, 0, 0, 0);

    let weekSpent = expenses
        .filter(e => {

            if (e.amount >= 0)
                return false;

            let d =
                new Date(e.date);

            return d >= weekStart &&
                d <= end;

        })
        .reduce((s, e) =>
            s + Math.abs(e.amount), 0);

    let weekExpected =
        dailyLimit * 7;

    let weekSaved =
        Math.max(
            0,
            weekExpected - weekSpent
        );

    // =========================
    // 🧠 PERIOD SAVED
    // =========================
    let budgets =
        filterBudgetsByActivePeriod(
            getBudgets()
        );

    let totalBudget = budgets
        .reduce((s, b) =>
            s + (b.totalAllocated || 0), 0);

    let totalSpent = expenses
        .filter(e => e.amount < 0)
        .reduce((s, e) =>
            s + Math.abs(e.amount), 0);

    let periodSaved =
        Math.max(
            0,
            totalBudget - totalSpent
        );

    // =========================
    // 🎯 UI
    // =========================
    function setText(id, value) {

        let el =
            document.getElementById(id);

        if (el) {
            el.innerText = value;
        }
    }

    setText(
        "savedToday",
        formatCurrency(savedToday)
    );

    setText(
        "savedWeek",
        formatCurrency(weekSaved)
    );

    setText(
        "savedPeriod",
        formatCurrency(periodSaved)
    );
}
function normalizeDate(date) {

    let d = new Date(date);

    d.setHours(0, 0, 0, 0);

    return d.getTime();
}

function buildSmartExpenseDate(rawDate) {

    if (!rawDate) {
        return new Date().toISOString();
    }

    let selected = new Date(rawDate);

    let today = new Date();

    // normalize compare
    let s = new Date(selected);
    let t = new Date(today);

    s.setHours(0, 0, 0, 0);
    t.setHours(0, 0, 0, 0);

    // TODAY
    if (s.getTime() === t.getTime()) {

        return new Date().toISOString();
    }

    // FUTURE
    if (s.getTime() > t.getTime()) {

        selected.setHours(0, 0, 0, 0);

        return selected.toISOString();
    }

    // PAST
    selected.setHours(23, 59, 59, 999);

    return selected.toISOString();
}

function getRemainingAmount(id) {
    let expensesAll = getExpenses();

    // 🔥 ORIGINAL ENTRY (lookup from full storage so parent rows remain findable)
    let original = expensesAll.find(e => String(e.id) === String(id));
    if (!original) return 0;

    // original total value (use allocationTrail if present)
    let originalTotal = 0;
    if (Array.isArray(original.allocationTrail) && original.allocationTrail.length) {
        originalTotal = original.allocationTrail.reduce((s, a) => s + (Number(a.amount) || 0), 0);
    } else {
        originalTotal = Math.abs(Number(original.amount) || 0);
    }

    // 🔥 TOTAL RECOVERED (exclude parent split containers from recovery sums)
    let expenses = expensesAll.filter(e => !isParentSplitContainer(e));

    let recovered = expenses
        .filter(e => String(e.linkedTransactionId) === String(id) && e.type === "recovery")
        .reduce((sum, e) => {
            if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
                return sum + e.allocationTrail.reduce((ss, a) => ss + (Number(a.amount) || 0), 0);
            }
            return sum + Math.abs(Number(e.amount) || 0);
        }, 0);

    let remaining = originalTotal - recovered;
    return Math.max(0, remaining);
}
// Budget Expense Module END script.js




// function exportDataAsJSON() {

//     let data = {
//         expenses: getExpenses() || [],
//         budgets: getBudgets() || [],
//         savings: getSavings() || [],
//         orders: JSON.parse(localStorage.getItem("orders")) || [],

//         // 🔥 NEW (IMPORTANT)
//         categories: JSON.parse(localStorage.getItem("categories")) || [],
//         persons: JSON.parse(localStorage.getItem("persons")) || [],
//         budgetPeriods: JSON.parse(localStorage.getItem("bp")) || [],

//         settings: {
//             theme: localStorage.getItem("theme") || "",
//             currencyCode: localStorage.getItem("currencyCode") || "INR"
//         },

//         meta: {
//             exportedAt: new Date().toISOString(),
//             version: "v2"
//         }
//     };

//     try {
//         let json = JSON.stringify(data, null, 2);

//         let blob = new Blob([json], { type: "application/json" });
//         let url = URL.createObjectURL(blob);

//         let a = document.createElement("a");
//         a.href = url;
//         a.download = `money-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;

//         document.body.appendChild(a);
//         a.click();

//         // fallback first
//         setTimeout(() => {
//             window.open(url, "_blank");
//         }, 500);

//         // cleanup later
//         setTimeout(() => {

//             document.body.removeChild(a);

//             URL.revokeObjectURL(url);

//         }, 3000);

//     } catch (err) {
//         let json = JSON.stringify(data, null, 2);
//         prompt("Copy your backup manually:", json);
//     }
// }

// // =========================
// // 🔄 AUTO BACKUP ENGINE
// // =========================

// function startAutoBackup() {

//     scheduleDailyBackup();
//     scheduleWeeklyBackup();
//     scheduleMonthlyBackup();
// }

// // =========================
// // DAILY
// // =========================

// function scheduleDailyBackup() {

//     const DAY_MS =
//         24 * 60 * 60 * 1000;

//     setInterval(() => {

//         createAutoBackup("daily");

//     }, DAY_MS);
// }

// // =========================
// // WEEKLY
// // =========================

// function scheduleWeeklyBackup() {

//     const WEEK_MS =
//         7 * 24 * 60 * 60 * 1000;

//     setInterval(() => {

//         createAutoBackup("weekly");

//     }, WEEK_MS);
// }

// // =========================
// // MONTHLY
// // =========================

// function scheduleMonthlyBackup() {

//     const MONTH_MS =
//         30 * 24 * 60 * 60 * 1000;

//     setInterval(() => {

//         createAutoBackup("monthly");

//     }, MONTH_MS);
// }

// // =========================
// // CREATE BACKUP
// // =========================

// function createAutoBackup(type) {

//     try {

//         const backupData = {

//             createdAt:
//                 new Date().toISOString(),

//             type,

//             data: getFullAppData()
//         };

//         localStorage.setItem(

//             `autoBackup_${type}`,

//             JSON.stringify(backupData)
//         );

//         console.log(
//             `✅ ${type} backup completed`
//         );

//     } catch (err) {

//         console.error(
//             `❌ ${type} backup failed`,
//             err
//         );
//     }
// }

// =========================
// 📦 GET FULL APP DATA
// =========================

function getFullAppData() {

    return {

        expenses:
            getExpenses() || [],

        budgets:
            getBudgets() || [],

        savings:
            getSavings() || [],

        orders:
            JSON.parse(
                localStorage.getItem("orders")
            ) || [],

        categories:
            JSON.parse(
                localStorage.getItem("categories")
            ) || [],

        persons:
            JSON.parse(
                localStorage.getItem("persons")
            ) || [],

        budgetPeriods:
            JSON.parse(
                localStorage.getItem("bp")
            ) || [],

        settings: {

            theme:
                localStorage.getItem("theme")
                || "",

            currencyCode:
                localStorage.getItem("currencyCode")
                || "INR"
        },

        meta: {

            exportedAt:
                new Date().toISOString(),

            version:
                "v2"
        }
    };
}

// =========================
// 📅 SAFE FILE DATE
// =========================

function getSafeDate() {

    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-");
}

// =========================
// 📤 MANUAL EXPORT
// =========================

function exportDataAsJSON() {

    try {

        const data =
            getFullAppData();

        const json =
            JSON.stringify(
                data,
                null,
                2
            );

        const blob =
            new Blob(
                [json],
                {
                    type:
                    "application/json"
                }
            );

        const url =
            URL.createObjectURL(blob);

        const a =
            document.createElement("a");

        a.href = url;

        a.download =
            `money-tracker-backup-${
                getSafeDate()
            }.json`;

        document.body.appendChild(a);

        a.click();

        document.body.removeChild(a);

        setTimeout(() => {

            URL.revokeObjectURL(url);

        }, 1000);

        console.log(
            "✅ Manual export completed"
        );

    } catch (err) {

        console.error(
            "❌ Export failed",
            err
        );
    }
}

// =========================
// 🔄 AUTO BACKUP ENGINE
// =========================

function startAutoBackup() {

    checkAndCreateBackup(
        "daily",
        1
    );

    checkAndCreateBackup(
        "weekly",
        7
    );

    checkAndCreateBackup(
        "monthly",
        30
    );
}

// =========================
// 🧠 SMART BACKUP CHECK
// =========================

function checkAndCreateBackup(
    type,
    requiredDays
) {

    try {

        const lastBackup =
            localStorage.getItem(
                `lastBackup_${type}`
            );

        const now =
            Date.now();

        if (!lastBackup) {

            createAutoBackup(type);

            return;
        }

        const diffDays =
            (now - Number(lastBackup))
            / (1000 * 60 * 60 * 24);

        if (diffDays >= requiredDays) {

            createAutoBackup(type);
        }

    } catch (err) {

        console.error(
            `❌ ${type} backup check failed`,
            err
        );
    }
}

// =========================
// 💾 CREATE AUTO BACKUP
// =========================

function createAutoBackup(type) {

    try {

        const backupData = {

            createdAt:
                new Date()
                .toISOString(),

            type,

            data:
                getFullAppData()
        };

        localStorage.setItem(

            `autoBackup_${type}`,

            JSON.stringify(
                backupData
            )
        );

        localStorage.setItem(

            `lastBackup_${type}`,

            Date.now().toString()
        );

        console.log(
            `✅ ${type} backup completed`
        );

    } catch (err) {

        console.error(
            `❌ ${type} backup failed`,
            err
        );
    }
}