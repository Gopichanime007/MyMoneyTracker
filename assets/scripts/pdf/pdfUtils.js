// PDF Utility helpers (compatible with existing engines)
(function () {
    function hexToRgb(hex) {
        if (!hex) return { r: 76, g: 175, b: 80 };
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        let bigint = parseInt(hex, 16);
        return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
    }

    function formatPdfCurrency(amount) {
        // Prefer app-level helper if available
        try {
            if (typeof formatCurrency === 'function') {
                // Use centralized formatter but sanitize problematic glyphs for PDF
                const out = formatCurrency(amount);
                return sanitizeCurrencyForPdf(out);
            }
        } catch (e) { }

        // Fallback
        let value = Number(amount || 0);
        // Format with code/symbol fallback
        const code = (typeof getCurrencyCode === 'function') ? getCurrencyCode() : 'INR';
        const symbol = (typeof currencySymbols === 'object' && currencySymbols[code]) ? currencySymbols[code] : code;
        const formatted = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
        return sanitizeCurrencyForPdf(`${symbol} ${formatted}`);
    }

    function sanitizeCurrencyForPdf(text) {
        if (!text || typeof text !== 'string') return text;
        // jsPDF's default fonts sometimes don't render certain unicode symbols (like ₹).
        // Replace common symbols with ASCII-friendly alternatives for PDF output.
        return text.replace(/₹/g, 'Rs').replace(/€/g, 'EUR').replace(/£/g, 'GBP');
    }

    function computeBudgetTotals(budgets, expenses) {
        const result = [];

        budgets.forEach(b => {
            const allocated = Math.abs(b.totalAllocated || b.amount || 0);

            let spent = 0;
            let recovered = 0;

            expenses.forEach(e => {
                // Respect allocationTrail when present
                if (Array.isArray(e.allocationTrail) && e.allocationTrail.length) {
                    e.allocationTrail.forEach(a => {
                        if (String(a.budgetId) === String(b.budgetId)) {
                            if (e.type === 'expense' || e.type === 'loss') {
                                spent += Number(a.amount) || 0;
                            } else if (e.type === 'recovery') {
                                recovered += Number(a.amount) || 0;
                            }
                        }
                    });
                } else {
                    if (String(e.budgetId) === String(b.budgetId)) {
                        if (e.type === 'recovery') {
                            recovered += Math.abs(Number(e.amount) || 0);
                        } else if (e.type === 'expense' || e.type === 'loss') {
                            spent += Math.abs(Number(e.amount) || 0);
                        }
                    }
                }
            });

            const remaining = allocated - spent + recovered;

            result.push({
                budget: b,
                allocated,
                spent,
                recovered,
                remaining
            });
        });

        return result;
    }

    // Export
    window.pdfUtils = {
        hexToRgb,
        formatPdfCurrency,
        computeBudgetTotals
    };
})();
