beforeEach(() => {
    localStorage.clear();
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
    require('../assets/scripts/searchService.js');
});

test('Filter descriptor executes basic contains and numeric conditions', () => {
    const rows = [
        { id: '1', purpose: 'Fuel refill', amount: 300, date: '2026-06-08T09:00:00Z' },
        { id: '2', purpose: 'Groceries', amount: 900, date: '2026-06-07T09:00:00Z' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        filters: [
            { field: 'purpose', op: 'contains', value: 'fuel' },
            { field: 'amount', op: 'lte', value: 500 }
        ]
    });

    expect(result.resultCount).toBe(1);
    expect(result.results[0].id).toBe('1');
});

test('Filter descriptor supports grouped OR conditions', () => {
    const rows = [
        { id: '1', status: 'draft', type: 'expense' },
        { id: '2', status: 'open', type: 'income' },
        { id: '3', status: 'cancelled', type: 'refund' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        filters: [
            {
                logic: 'or',
                conditions: [
                    { field: 'status', op: 'eq', value: 'open' },
                    { field: 'type', op: 'eq', value: 'refund' }
                ]
            }
        ]
    });

    expect(result.results.map((r) => r.id)).toEqual(['2', '3']);
});

test('Period filter supports custom date range', () => {
    const rows = [
        { id: '1', date: '2026-06-01T10:00:00Z' },
        { id: '2', date: '2026-06-08T10:00:00Z' },
        { id: '3', date: '2026-06-20T10:00:00Z' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        filters: [
            {
                field: 'date',
                op: 'period',
                value: {
                    type: 'custom',
                    from: '2026-06-05',
                    to: '2026-06-10'
                }
            }
        ]
    });

    expect(result.results.map((r) => r.id)).toEqual(['2']);
});

test('Date filters normalize timestamp values against day-level date inputs', () => {
    const rows = [
        { id: '1', date: '2026-06-08T09:00:00Z', purpose: 'Fuel' },
        { id: '2', date: '2026-06-09T09:00:00Z', purpose: 'Food' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        filters: [
            { field: 'date', op: 'eq', value: '2026-06-08' }
        ]
    });

    expect(result.results.map((r) => r.id)).toEqual(['1']);
});

test('Legacy date filter wrapper returns this week records', () => {
    const rows = [
        { id: '1', date: '2026-06-08T10:00:00Z', purpose: 'Fuel' },
        { id: '2', date: '2026-06-06T10:00:00Z', purpose: 'Food' },
        { id: '3', date: '2026-05-20T10:00:00Z', purpose: 'Rent' }
    ];

    const result = window.SearchService.applyLegacyDateFilter(
        'expenses',
        rows,
        'week',
        null,
        null,
        '2026-06-08T12:00:00Z',
        'date'
    );

    expect(result.results.map((r) => r.id)).toEqual(['1', '2']);
});

test('Legacy date filter wrapper preserves active search state', () => {
    const rows = [
        { id: '1', date: '2026-06-08T10:00:00Z', purpose: 'Fuel refill' },
        { id: '2', date: '2026-06-08T11:00:00Z', purpose: 'Groceries' }
    ];

    window.SearchService.setSearchText('expenses', 'fuel');

    const result = window.SearchService.applyLegacyDateFilter(
        'expenses',
        rows,
        'today',
        null,
        null,
        '2026-06-08T12:00:00Z',
        'date'
    );

    expect(result.results.map((r) => r.id)).toEqual(['1']);
});
