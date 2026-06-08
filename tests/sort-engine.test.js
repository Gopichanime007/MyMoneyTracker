beforeEach(() => {
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
});

test('Sort engine uses secondary descriptors for deterministic ordering', () => {
    const rows = [
        { id: 'a', amount: 100, date: '2026-06-08T10:00:00Z' },
        { id: 'b', amount: 100, date: '2026-06-07T10:00:00Z' },
        { id: 'c', amount: 200, date: '2026-06-06T10:00:00Z' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        sort: [
            {
                field: 'amount',
                type: 'number',
                direction: 'asc',
                secondary: [
                    { field: 'date', type: 'date', direction: 'asc' }
                ]
            }
        ]
    });

    expect(result.results.map((row) => row.id)).toEqual(['b', 'a', 'c']);
});

test('Sort engine supports natural comparator type', () => {
    const rows = [
        { id: '1', label: 'Item 10' },
        { id: '2', label: 'Item 2' },
        { id: '3', label: 'Item 1' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        sort: [{ field: 'label', type: 'natural', direction: 'asc' }]
    });

    expect(result.results.map((row) => row.label)).toEqual(['Item 1', 'Item 2', 'Item 10']);
});

test('Sort engine supports currency comparator type', () => {
    const rows = [
        { id: 'x', amount: '₹ 1,200.00' },
        { id: 'y', amount: '₹ 250.00' },
        { id: 'z', amount: '₹ 900.00' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        sort: [{ field: 'amount', type: 'currency', direction: 'asc' }]
    });

    expect(result.results.map((row) => row.id)).toEqual(['y', 'z', 'x']);
});

test('Sort engine remains stable when comparator values are equal', () => {
    const rows = [
        { id: 'k1', amount: 500 },
        { id: 'k2', amount: 500 },
        { id: 'k3', amount: 500 }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        sort: [{ field: 'amount', type: 'number', direction: 'asc' }]
    });

    expect(result.results.map((row) => row.id)).toEqual(['k1', 'k2', 'k3']);
});
