// PDF Generator - orchestrates utilities & renderers
(function () {
    class Pager {
        constructor(doc) {
            this.doc = doc;
            this.pageHeight = doc.internal.pageSize.getHeight();
            this.pageWidth = doc.internal.pageSize.getWidth();
            this.top = 20;
            this.bottom = this.pageHeight - 20;
            this.y = this.top;
            this.meta = {};
        }

        need(height) {
            return this.y + height > this.bottom;
        }

        addPage() {
            this.doc.addPage();
            this.y = this.top;
            if (window.pdfRenderers && this.meta) {
                // redraw header per page
                window.pdfRenderers.drawHeader(this.doc, this, this.meta, window.pdfTheme.createPdfTheme(localStorage.getItem('theme')));
            }
        }
    }

    function generatePdfReport(opts = {}) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const pager = new Pager(doc);

        const dataSource = Array.isArray(opts.data) && opts.data.length ? opts.data : (window.currentFilteredExpenses && window.currentFilteredExpenses.length ? window.currentFilteredExpenses : (typeof getExpenses === 'function' ? getExpenses() : []));

        // metadata
        const meta = {
            title: 'Money Tracker Report',
            generatedAt: new Date().toLocaleString(),
            filter: (window.currentHistoryFilter && window.currentHistoryFilter.label) || 'All'
        };
        pager.meta = meta;

        const theme = window.pdfTheme.createPdfTheme(localStorage.getItem('theme'));

        // header
        pdfRenderers.drawHeader(doc, pager, meta, theme);

        // summary totals
        const totals = {
            income: dataSource.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0),
            expense: dataSource.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0)
        };
        totals.net = totals.income - totals.expense;

        pdfRenderers.drawSummaryCards(doc, pager, totals, theme);

        // table columns
        const cols = {
            date: { x: 17, label: 'Date' },
            type: { x: 47, label: 'Type' },
            category: { x: 67, label: 'Category' },
            payType: { x: 97, label: 'PayType' },
            amount: { x: 137, label: 'Amount', align: 'right' },
            purpose: { x: 147, label: 'Purpose' }
        };

        // table header
        if (pager.need(30)) pager.addPage();
        pdfRenderers.drawTableHeader(doc, pager, {
            date: { x: cols.date.x, label: 'Date', align: 'center' },
            type: { x: cols.type.x, label: 'Type', align: 'center' },
            category: { x: cols.category.x, label: 'Category' },
            payType: { x: cols.payType.x, label: 'PayType' },
            amount: { x: cols.amount.x, label: 'Amount', align: 'right' },
            purpose: { x: cols.purpose.x, label: 'Purpose' }
        }, theme);

        // rows
        dataSource.forEach((e, idx) => {
            const row = {
                date: new Date(e.date).toLocaleDateString('en-IN'),
                type: e.type ? e.type.toUpperCase() : (e.amount < 0 ? 'EXPENSE' : 'INCOME'),
                category: e.category || 'Others',
                payment: e.paymentType || e.entity || '-',
                amount: Number(e.amount || 0),
                purpose: e.purpose || 'N/A'
            };

            // estimate height needed
            const approxLines = Math.ceil((row.purpose.length || 1) / 20);
            const estimatedHeight = Math.max(9, approxLines * 5);
            if (pager.need(estimatedHeight + 10)) pager.addPage();

            pdfRenderers.drawTableRow(doc, pager, {
                date: cols.date,
                type: cols.type,
                category: cols.category,
                payType: cols.payType,
                amount: cols.amount,
                purpose: cols.purpose
            }, row, { striped: idx % 2 === 0 });
        });

        // budget summary
        if (pager.need(60)) pager.addPage();

        const budgets = (typeof getBudgets === 'function' ? getBudgets() : []).filter(b => dataSource.some(e => e.periodKey === b.periodKey));
        const budgetTotals = window.pdfUtils.computeBudgetTotals(budgets, dataSource);

        const summaryCols = { name: { x: 15 }, allocated: { x: 90 }, spent: { x: 140 }, remaining: { x: 195 } };

        pdfRenderers.drawBudgetSummary(doc, pager, budgetTotals, summaryCols);

        // totals
        pager.y += 8;
        doc.setDrawColor(180);
        doc.line(10, pager.y, 200, pager.y);
        pager.y += 8;

        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text('Total Budget', summaryCols.name.x, pager.y);
        doc.setTextColor(0, 120, 255);
        const totalBudget = budgetTotals.reduce((s, it) => s + it.allocated, 0);
        const totalSpent = budgetTotals.reduce((s, it) => s + it.spent, 0);
        const totalRemaining = budgetTotals.reduce((s, it) => s + it.remaining, 0);
        doc.text(window.pdfUtils.formatPdfCurrency(totalBudget), summaryCols.allocated.x, pager.y, { align: 'right' });
        pager.y += 8;
        doc.setTextColor(0);
        doc.text('Total Spent', summaryCols.name.x, pager.y);
        doc.setTextColor(220, 0, 0);
        doc.text(window.pdfUtils.formatPdfCurrency(totalSpent), summaryCols.spent.x, pager.y, { align: 'right' });
        pager.y += 8;
        doc.setTextColor(0);
        doc.text('Remaining', summaryCols.name.x, pager.y);
        doc.setTextColor(totalRemaining < 0 ? 220 : 0, totalRemaining < 0 ? 0 : 150, 0);
        doc.text(window.pdfUtils.formatPdfCurrency(totalRemaining), summaryCols.remaining.x, pager.y, { align: 'right' });

        // metadata footer
        pager.y += 12;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text(`Exported: ${meta.generatedAt}`, 14, pager.y);

        const fileName = opts.fileName || `money-tracker-report-${new Date().toISOString().slice(0,10)}.pdf`;
        doc.save(fileName);
        return doc;
    }

    window.generatePdfReport = generatePdfReport;
})();
