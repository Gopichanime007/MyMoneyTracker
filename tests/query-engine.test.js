beforeAll(() => {
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
});

test('QueryDescriptorV1 defaults are backward-safe', () => {
    const descriptor = window.QueryEngine.createQueryDescriptorV1();

    expect(descriptor.version).toBe('v1');
    expect(descriptor.search.text).toBe('');
    expect(Array.isArray(descriptor.search.fields)).toBe(true);
    expect(Array.isArray(descriptor.filters)).toBe(true);
    expect(Array.isArray(descriptor.sort)).toBe(true);
});

test('SortDescriptorV1 normalizes invalid values', () => {
    const descriptor = window.QueryEngine.createSortDescriptorV1({
        field: 'amount',
        direction: 'downward',
        type: 'number',
        nulls: 'first'
    });

    expect(descriptor.version).toBe('v1');
    expect(descriptor.direction).toBe('asc');
    expect(descriptor.type).toBe('number');
    expect(descriptor.nulls).toBe('first');
});

test('Query State Store set/patch/reset and subscribe works', () => {
    const store = window.QueryEngine.createQueryStateStore();
    const snapshots = [];

    const unsubscribe = store.subscribe('expenses', (state) => {
        snapshots.push(state);
    });

    store.setState('expenses', {
        module: 'expenses',
        search: { text: 'fuel', fields: ['purpose'] }
    });

    store.patchState('expenses', {
        filters: [{ field: 'type', op: 'eq', value: 'expense' }]
    });

    expect(snapshots.length).toBe(2);
    expect(snapshots[0].search.text).toBe('fuel');
    expect(snapshots[1].filters.length).toBe(1);

    const state = store.getState('expenses');
    state.search.text = 'tampered';
    expect(store.getState('expenses').search.text).toBe('fuel');

    store.resetState('expenses');
    expect(store.getState('expenses').search.text).toBe('');

    unsubscribe();
});

test('Query pipeline runs normalize -> search -> filter -> sort', () => {
    const rows = [
        { id: '1', amount: 300, type: 'expense', purpose: 'Fuel', date: '2026-01-02' },
        { id: '2', amount: 100, type: 'expense', purpose: 'Food', date: '2026-01-01' },
        { id: '3', amount: 100, type: 'income', purpose: 'Bonus', date: '2026-01-03' }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        search: { text: 'o', fields: ['purpose'] },
        filters: [{ field: 'type', op: 'eq', value: 'expense' }],
        sort: [
            { field: 'amount', type: 'number', direction: 'asc' },
            { field: 'date', type: 'date', direction: 'asc' }
        ]
    }, {
        normalizeItem: (item) => ({
            id: item.id,
            amount: Number(item.amount),
            type: String(item.type),
            purpose: String(item.purpose),
            date: item.date
        })
    });

    expect(result.totalCount).toBe(3);
    expect(result.normalizedCount).toBe(3);
    expect(result.resultCount).toBe(1);
    expect(result.results[0].id).toBe('2');
});

test('Query pipeline uses stable sort when values are equal', () => {
    const rows = [
        { id: 'a', amount: 100 },
        { id: 'b', amount: 100 },
        { id: 'c', amount: 100 }
    ];

    const result = window.QueryEngine.runQueryPipeline(rows, {
        sort: [{ field: 'amount', type: 'number', direction: 'asc' }]
    });

    expect(result.results.map((item) => item.id)).toEqual(['a', 'b', 'c']);
});
