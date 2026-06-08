beforeAll(() => {
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
    require('../assets/scripts/searchService.js');
});

beforeEach(() => {
    localStorage.clear();
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
    require('../assets/scripts/searchService.js');
});

test('SearchService registers default module adapters', () => {
    expect(window.SearchService).toBeTruthy();
    expect(window.SearchService.getAdapter('expenses').searchFields.length).toBeGreaterThan(0);
    expect(window.SearchService.getAdapter('savings').searchFields.length).toBeGreaterThan(0);
    expect(window.SearchService.getAdapter('orders').searchFields.length).toBeGreaterThan(0);
    expect(window.SearchService.getAdapter('quotations').searchFields.length).toBeGreaterThan(0);
});

test('SearchService persists query state under query.state.v1', () => {
    window.SearchService.setSearchText('expenses', 'fuel');

    const raw = localStorage.getItem('query.state.v1');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw);
    expect(parsed.expenses.search.text).toBe('fuel');
});

test('SearchService applies module search with adapter fields', () => {
    const rows = [
        { id: '1', purpose: 'Fuel refill', status: 'draft' },
        { id: '2', purpose: 'Groceries', status: 'draft' }
    ];

    window.SearchService.setSearchText('expenses', 'fuel');
    const result = window.SearchService.applyModuleSearch('expenses', rows);

    expect(result.resultCount).toBe(1);
    expect(result.results[0].id).toBe('1');
});

test('SearchService clearSearch keeps module fields and clears text', () => {
    window.SearchService.setSearchText('orders', 'open');
    const before = window.SearchService.getState('orders');
    expect(before.search.text).toBe('open');

    window.SearchService.clearSearch('orders');
    const after = window.SearchService.getState('orders');

    expect(after.search.text).toBe('');
    expect(Array.isArray(after.search.fields)).toBe(true);
    expect(after.search.fields.length).toBeGreaterThan(0);
});

test('SearchService setSort persists and clearSort resets', () => {
    window.SearchService.setSort('orders', [{ field: 'updatedAt', direction: 'desc', type: 'date' }]);

    const state = window.SearchService.getState('orders');
    expect(Array.isArray(state.sort)).toBe(true);
    expect(state.sort.length).toBe(1);
    expect(state.sort[0].field).toBe('updatedAt');

    window.SearchService.clearSort('orders');
    const after = window.SearchService.getState('orders');
    expect(Array.isArray(after.sort)).toBe(true);
    expect(after.sort.length).toBe(0);
});

test('SearchService restored persisted state after reload', () => {
    window.SearchService.setSearchText('quotations', 'laptop');

    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
    require('../assets/scripts/searchService.js');

    const state = window.SearchService.getState('quotations');
    expect(state.search.text).toBe('laptop');
});

test('SearchService scheduleSearch debounces rapid updates', () => {
    jest.useFakeTimers();

    window.SearchService.scheduleSearch('expenses', 'f', null, 120);
    window.SearchService.scheduleSearch('expenses', 'fu', null, 120);
    window.SearchService.scheduleSearch('expenses', 'fuel', null, 120);

    expect(window.SearchService.getState('expenses').search.text).toBe('');

    jest.advanceTimersByTime(140);

    expect(window.SearchService.getState('expenses').search.text).toBe('fuel');
    jest.useRealTimers();
});
