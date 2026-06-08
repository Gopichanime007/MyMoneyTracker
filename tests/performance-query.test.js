beforeAll(() => {
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
});

function buildRows(count) {
    var rows = [];
    for (var i = 0; i < count; i += 1) {
        rows.push({
            id: 'row-' + i,
            purpose: i % 11 === 0 ? 'fuel refill' : 'groceries',
            status: i % 3 === 0 ? 'approved' : 'draft',
            amount: (i % 5000) + 100,
            date: new Date(2026, i % 12, (i % 28) + 1).toISOString()
        });
    }
    return rows;
}

[100, 1000, 10000].forEach((size) => {
    test('Query pipeline handles ' + size + ' rows within reasonable time', () => {
        var rows = buildRows(size);
        var start = Date.now();

        var result = window.QueryEngine.runQueryPipeline(rows, {
            module: 'orders',
            search: { text: 'fuel', fields: ['purpose'] },
            filters: [{ field: 'status', op: 'eq', value: 'approved' }],
            sort: [
                { field: 'amount', type: 'number', direction: 'desc' },
                { field: 'date', type: 'date', direction: 'asc' }
            ]
        });

        var elapsedMs = Date.now() - start;

        expect(result.resultCount).toBeGreaterThanOrEqual(0);
        expect(result.resultCount).toBeLessThanOrEqual(size);
        expect(elapsedMs).toBeLessThan(5000);
    });
});
