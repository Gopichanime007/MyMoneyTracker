// PDF rendering primitives
(function () {
    function drawHeader(doc, pager, meta, theme) {
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(10, 8, 190, 22, 3, 3, 'F');
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text(meta.title || 'Report', 14, 17);
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`Generated: ${meta.generatedAt}`, 14, 22);
        doc.text(meta.filter || 'All', 14, 26);
        pager.y = 38;
    }

    function drawSummaryCards(doc, pager, totals, theme) {
        const drawCard = (x, title, value, color) => {
            doc.setFillColor(252, 252, 252);
            doc.setDrawColor(230);
            doc.roundedRect(x, pager.y, 60, 18, 3, 3, 'FD');
            doc.setFontSize(8);
            doc.setTextColor(120);
            doc.text(title, x + 5, pager.y + 6);
            doc.setFontSize(11);
            doc.setTextColor(color.r, color.g, color.b);
            doc.text(window.pdfUtils.formatPdfCurrency(value), x + 5, pager.y + 13);
        };

        drawCard(10, 'Income', totals.income, { r: 0, g: 150, b: 0 });
        drawCard(75, 'Expense', totals.expense, { r: 200, g: 0, b: 0 });
        drawCard(140, 'Net', totals.net, totals.net >= 0 ? { r: 0, g: 150, b: 0 } : { r: 200, g: 0, b: 0 });
        pager.y += 28;
    }

    function drawTableHeader(doc, pager, cols, theme) {
        const { r, g, b } = theme.primaryDark;
        doc.setFillColor(Math.max(0, r), Math.max(0, g), Math.max(0, b));
        doc.rect(10, pager.y - 5, 190, 9, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        Object.keys(cols).forEach(k => {
            const cfg = cols[k];
            doc.text(cfg.label, cfg.x, pager.y + 2, cfg.align ? { align: cfg.align } : undefined);
        });
        pager.y += 9;
    }

    function drawTableRow(doc, pager, cols, row, opts = {}) {
        const startY = pager.y;
        const maxWidthPurpose = 50;
        if (opts.striped) {
            doc.setFillColor(248, 248, 248);
            doc.rect(10, pager.y - 4, 190, 8, 'F');
        }

        doc.setTextColor(0);
        doc.setFont(undefined, 'normal');
        doc.setFontSize(8);

        doc.text(row.date, cols.date.x, pager.y, { align: 'center' });
        doc.setTextColor(row.amount < 0 ? 200 : 0, row.amount < 0 ? 0 : 150, 0);
        doc.text(row.type, cols.type.x, pager.y, { align: 'center' });
        doc.setTextColor(0);
        doc.text(row.category, cols.category.x, pager.y);
        doc.text(row.payment, cols.payType.x, pager.y);
        doc.setTextColor(row.amount < 0 ? 200 : 0, row.amount < 0 ? 0 : 150, 0);
        doc.text(window.pdfUtils.formatPdfCurrency(row.amount), cols.amount.x, pager.y, { align: 'right' });
        doc.setTextColor(0);

        let splitPurpose = doc.splitTextToSize(row.purpose || 'N/A', maxWidthPurpose);
        doc.text(splitPurpose, cols.purpose.x, pager.y);
        const lineHeight = 5;
        const rowHeight = Math.max(9, splitPurpose.length * lineHeight);
        pager.y += rowHeight;
        return pager.y - startY; // used by pager
    }

    function drawBudgetSummary(doc, pager, items, cols) {
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.setTextColor(0);
        doc.text('Budget Summary', 14, pager.y);
        pager.y += 6;
        doc.setFontSize(8);
        doc.setTextColor(120);
        doc.text('Budget allocation and spending overview', 14, pager.y);
        pager.y += 8;

        // Header row
        doc.setFillColor(200, 200, 200);
        doc.rect(10, pager.y - 5, 190, 9, 'F');
        doc.setTextColor(255);
        doc.setFont(undefined, 'bold');
        doc.setFontSize(9);
        doc.text('Budget', cols.name.x, pager.y + 1);
        doc.text('Allocated', cols.allocated.x, pager.y + 1, { align: 'right' });
        doc.text('Spent', cols.spent.x, pager.y + 1, { align: 'right' });
        doc.text('Remaining', cols.remaining.x, pager.y + 1, { align: 'right' });
        pager.y += 10;

        items.forEach((it, idx) => {
            if (idx % 2 === 0) {
                doc.setFillColor(248, 248, 248);
                doc.rect(10, pager.y - 4, 190, 8, 'F');
            }
            doc.setTextColor(0);
            doc.setFont(undefined, 'normal');
            doc.text(it.budget.note || it.budget.name || 'Budget', cols.name.x, pager.y);
            doc.setTextColor(0, 120, 255);
            doc.text(window.pdfUtils.formatPdfCurrency(it.allocated), cols.allocated.x, pager.y, { align: 'right' });
            doc.setTextColor(220, 0, 0);
            doc.text(window.pdfUtils.formatPdfCurrency(it.spent), cols.spent.x, pager.y, { align: 'right' });
            doc.setTextColor(it.remaining < 0 ? 220 : 0, it.remaining < 0 ? 0 : 150, 0);
            doc.text(window.pdfUtils.formatPdfCurrency(it.remaining), cols.remaining.x, pager.y, { align: 'right' });
            pager.y += 8;
        });

    }

    window.pdfRenderers = {
        drawHeader,
        drawSummaryCards,
        drawTableHeader,
        drawTableRow,
        drawBudgetSummary
    };
})();
