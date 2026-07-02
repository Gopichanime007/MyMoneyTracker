/* =========================
   ⚙️ BUDGET EFFICIENCY LEDGER
========================= */

(function () {
    const DAILY_SPENDING_LIMIT_KEY = "dailySpendingLimit";
    const EFFICIENCY_SORT_KEY = "budgetEfficiencySortMode";
    const DEFAULT_DAILY_SPENDING_LIMIT = 100;

    function asNumber(value) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }

    function toDateKey(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return null;
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function isSpendEntry(entry) {
        if (!entry || typeof entry !== "object") return false;
        const amount = Number(entry.amount || 0);
        const type = String(entry.type || "").toLowerCase();
        return amount < 0 || ["expense", "loss", "transfer"].includes(type);
    }

    function getDailySpendingLimit() {
        try {
            const raw = localStorage.getItem(DAILY_SPENDING_LIMIT_KEY);
            if (raw === null || raw === "") return DEFAULT_DAILY_SPENDING_LIMIT;
            const parsed = asNumber(raw);
            return parsed == null || parsed < 0 ? DEFAULT_DAILY_SPENDING_LIMIT : parsed;
        } catch (_err) {
            return DEFAULT_DAILY_SPENDING_LIMIT;
        }
    }

    function saveDailySpendingLimit(value) {
        const parsed = asNumber(value);
        if (parsed == null || parsed < 0) {
            localStorage.removeItem(DAILY_SPENDING_LIMIT_KEY);
            return null;
        }
        const normalized = Math.round(parsed * 100) / 100;
        localStorage.setItem(DAILY_SPENDING_LIMIT_KEY, String(normalized));
        return normalized;
    }

    function getEfficiencySortMode() {
        const fallback = "date_desc";
        const allowed = new Set(["date_desc", "date_asc", "savings_desc", "savings_asc", "overspend_desc", "overspend_asc"]);
        const raw = String(localStorage.getItem(EFFICIENCY_SORT_KEY) || fallback).trim();
        return allowed.has(raw) ? raw : fallback;
    }

    function saveEfficiencySortMode(mode) {
        const allowed = new Set(["date_desc", "date_asc", "savings_desc", "savings_asc", "overspend_desc", "overspend_asc"]);
        const next = allowed.has(String(mode || "").trim()) ? String(mode).trim() : "date_desc";
        localStorage.setItem(EFFICIENCY_SORT_KEY, next);
        return next;
    }

    function calculateBudgetEfficiencyLedger(expensesInput, options = {}) {
        const expenses = Array.isArray(expensesInput) ? expensesInput : [];
        const dailyLimit = Number.isFinite(Number(options.dailyLimit))
            ? Number(options.dailyLimit)
            : getDailySpendingLimit();

        const rowsByDate = new Map();
        for (const entry of expenses) {
            if (!isSpendEntry(entry)) continue;
            const key = toDateKey(entry.date);
            if (!key) continue;
            const amount = Math.abs(Number(entry.amount || 0));
            const row = rowsByDate.get(key) || { date: key, spent: 0, items: [] };
            row.spent += amount;
            row.items.push(entry);
            rowsByDate.set(key, row);
        }

        const ledger = [];
        const savingsQueue = [];
        const orderedDates = Array.from(rowsByDate.keys()).sort((a, b) => a.localeCompare(b));
        let runningBalance = 0;
        let totalBudget = 0;
        let totalSpent = 0;
        let totalSaved = 0;
        let totalOverspent = 0;

        for (const date of orderedDates) {
            const day = rowsByDate.get(date);
            const budget = Math.max(0, Number(dailyLimit || 0));
            const spent = Math.max(0, Number(day.spent || 0));
            const saved = Math.max(0, budget - spent);
            const overspent = Math.max(0, spent - budget);

            totalBudget += budget;
            totalSpent += spent;
            totalSaved += saved;
            totalOverspent += overspent;

            runningBalance += saved;
            if (saved > 0) {
                savingsQueue.push({ date, remaining: saved });
            }

            const coveredFrom = [];
            let remainingOverspend = overspent;

            // FIFO allocation: consume the oldest savings first so the coverage chain
            // reflects the exact historical source of every overspent rupee.
            while (remainingOverspend > 0 && savingsQueue.length > 0) {
                const source = savingsQueue[0];
                const use = Math.min(source.remaining, remainingOverspend);
                if (use > 0) {
                    coveredFrom.push({ date: source.date, amount: use });
                    source.remaining -= use;
                    runningBalance -= use;
                    remainingOverspend -= use;
                }
                if (source.remaining <= 0) {
                    savingsQueue.shift();
                }
            }

            ledger.push({
                date,
                budget,
                spent,
                saved,
                overspent,
                runningBalance: Math.max(0, Math.round(runningBalance * 100) / 100),
                coveredFrom
            });
        }

        return {
            ledger,
            summary: {
                dailyLimit,
                totalBudget,
                totalSpent,
                totalSaved,
                totalOverspent,
                budgetBank: ledger.length ? ledger[ledger.length - 1].runningBalance : 0,
                weeklySavingsRate: totalBudget > 0 ? (totalSaved / totalBudget) * 100 : 0
            }
        };
    }

    function getEfficiencyStatus(day, limit) {
        if (!day) return { label: "", tone: "neutral" };
        if (Number(day.overspent || 0) > 0) return { label: "Overspent", tone: "danger" };
        if (limit > 0 && Number(day.spent || 0) >= Number(limit) * 0.9) return { label: "Near Limit", tone: "warning" };
        return { label: "Under Budget", tone: "success" };
    }

    function renderEfficiencyDashboard() {
        const host = document.getElementById("efficiencyDashboard");
        if (!host) return;

        const limitConfigured = localStorage.getItem(DAILY_SPENDING_LIMIT_KEY) !== null;
        const expenses = typeof getExpenses === "function" ? getExpenses() : [];

        if (!limitConfigured) {
            host.innerHTML = `<p class="empty-state">Please configure Daily Spending Limit in Settings.</p>`;
            return;
        }

        if (!Array.isArray(expenses) || !expenses.length) {
            host.innerHTML = `<p class="empty-state">No transactions available to calculate efficiency.</p>`;
            return;
        }

        const ledgerResult = calculateBudgetEfficiencyLedger(expenses, { dailyLimit: getDailySpendingLimit() });
        const sortMode = getEfficiencySortMode();
        const rows = ledgerResult.ledger.slice();

        rows.sort((a, b) => {
            if (sortMode === "savings_desc" || sortMode === "savings_asc") {
                const diff = Number(a.saved || 0) - Number(b.saved || 0);
                return sortMode === "savings_desc" ? -diff : diff;
            }
            if (sortMode === "overspend_desc" || sortMode === "overspend_asc") {
                const diff = Number(a.overspent || 0) - Number(b.overspent || 0);
                return sortMode === "overspend_desc" ? -diff : diff;
            }
            const diff = a.date.localeCompare(b.date);
            return sortMode === "date_asc" ? diff : -diff;
        });

        const cards = [
            { label: "Budget Bank", value: formatCurrency(ledgerResult.summary.budgetBank) },
            { label: "Weekly Savings Rate", value: `${ledgerResult.summary.weeklySavingsRate.toFixed(2)}%` },
            { label: "Total Budget", value: formatCurrency(ledgerResult.summary.totalBudget) },
            { label: "Total Spent", value: formatCurrency(ledgerResult.summary.totalSpent) },
            { label: "Total Saved", value: formatCurrency(ledgerResult.summary.totalSaved) }
        ];

        const header = `
            <div class="efficiency-summary-grid">
                ${cards.map((card) => `
                    <div class="efficiency-summary-card">
                        <small>${escapeHtml(card.label)}</small>
                        <strong>${escapeHtml(card.value)}</strong>
                    </div>
                `).join("")}
            </div>

            <div class="efficiency-toolbar">
                <label>
                    Sort By
                    <select id="efficiencySortSelect" onchange="saveEfficiencySortMode(this.value);renderEfficiencyDashboard();">
                        <option value="date_desc">Date: Newest</option>
                        <option value="date_asc">Date: Oldest</option>
                        <option value="savings_desc">Savings: High to Low</option>
                        <option value="savings_asc">Savings: Low to High</option>
                        <option value="overspend_desc">Overspending: High to Low</option>
                        <option value="overspend_asc">Overspending: Low to High</option>
                    </select>
                </label>
            </div>

            <div class="efficiency-grid-wrap">
                <div class="efficiency-grid-header">
                    <span>Date</span>
                    <span>Budget</span>
                    <span>Spent</span>
                    <span>Saved</span>
                    <span>Overspent</span>
                    <span>Running Bank</span>
                    <span>Status</span>
                    <span>Coverage</span>
                </div>
                <div class="efficiency-grid-body">
        `;

        const body = rows.length ? rows.map((day) => {
            const status = getEfficiencyStatus(day, getDailySpendingLimit());
            const dateLabel = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short" });
            const coverageCount = Array.isArray(day.coveredFrom) ? day.coveredFrom.length : 0;
            return `
                <button type="button" class="efficiency-row tone-${status.tone}${day.overspent > 0 ? " clickable" : ""}" data-date="${escapeHtml(day.date)}">
                    <span>${escapeHtml(dateLabel)}</span>
                    <span>${escapeHtml(formatCurrency(day.budget))}</span>
                    <span>${escapeHtml(formatCurrency(day.spent))}</span>
                    <span>${escapeHtml(formatCurrency(day.saved))}</span>
                    <span>${escapeHtml(formatCurrency(day.overspent))}</span>
                    <span>${escapeHtml(formatCurrency(day.runningBalance))}</span>
                    <span class="efficiency-pill">${escapeHtml(status.label)}</span>
                    <span class="efficiency-coverage-count">${coverageCount ? `${coverageCount} source${coverageCount > 1 ? "s" : ""}` : ""}</span>
                </button>
            `;
        }).join("") : `<p class="empty-state">No transactions available to calculate efficiency.</p>`;

        host.innerHTML = `${header}${body}</div></div>`;

        const select = document.getElementById("efficiencySortSelect");
        if (select) select.value = sortMode;

        host.querySelectorAll(".efficiency-row.clickable").forEach((row) => {
            row.addEventListener("click", () => {
                const day = rows.find((entry) => String(entry.date) === String(row.dataset.date));
                if (!day) return;
                const modal = document.getElementById("efficiencyCoverageModal");
                const bodyEl = document.getElementById("efficiencyCoverageBody");
                const titleEl = document.getElementById("efficiencyCoverageTitle");
                if (!modal || !bodyEl || !titleEl) return;

                const weekday = new Date(`${day.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long" });
                titleEl.textContent = `${weekday} Overspend ${formatCurrency(day.overspent)}`;

                const coverage = Array.isArray(day.coveredFrom) ? day.coveredFrom : [];
                bodyEl.innerHTML = coverage.length ? `
                    <h4>Covered By</h4>
                    <div class="efficiency-coverage-list">
                        ${coverage.map((entry) => `<div class="efficiency-coverage-row"><span>${escapeHtml(new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }))} Savings</span><strong>${escapeHtml(formatCurrency(entry.amount))}</strong></div>`).join("")}
                    </div>
                ` : `<p class="empty-state">No previous savings were required for this day.</p>`;
                modal.style.display = "flex";
                modal.classList.remove("hidden");
            });
        });
    }

    function refreshDailySpendingLimitUI() {
        const input = document.getElementById("dailySpendingLimitInput");
        if (!input) return;
        const raw = localStorage.getItem(DAILY_SPENDING_LIMIT_KEY);
        input.value = raw === null ? "" : String(getDailySpendingLimit());
    }

    function saveDailySpendingLimitFromUI() {
        const input = document.getElementById("dailySpendingLimitInput");
        if (!input) return null;
        const saved = saveDailySpendingLimit(input.value);
        refreshDailySpendingLimitUI();
        if (typeof renderEfficiencyDashboard === "function") renderEfficiencyDashboard();
        if (typeof showToast === "function") showToast(saved == null ? "Daily Spending Limit cleared" : "Daily Spending Limit saved");
        return saved;
    }

    function closeEfficiencyCoverageModal() {
        const modal = document.getElementById("efficiencyCoverageModal");
        if (!modal) return;
        modal.style.display = "none";
        modal.classList.add("hidden");
    }

    if (typeof window !== "undefined") {
        window.getDailySpendingLimit = getDailySpendingLimit;
        window.saveDailySpendingLimit = saveDailySpendingLimit;
        window.getEfficiencySortMode = getEfficiencySortMode;
        window.saveEfficiencySortMode = saveEfficiencySortMode;
        window.calculateBudgetEfficiencyLedger = calculateBudgetEfficiencyLedger;
        window.renderEfficiencyDashboard = renderEfficiencyDashboard;
        window.refreshDailySpendingLimitUI = refreshDailySpendingLimitUI;
        window.saveDailySpendingLimitFromUI = saveDailySpendingLimitFromUI;
        window.closeEfficiencyCoverageModal = closeEfficiencyCoverageModal;
    }
}());