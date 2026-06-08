beforeEach(() => {
    localStorage.clear();
    jest.resetModules();
    require('../assets/scripts/queryEngine.js');
    require('../assets/scripts/searchService.js');
});

test('Saved views persist under query.views.v1', () => {
    window.SearchService.setSearchText('expenses', 'fuel');
    const created = window.SearchService.saveView({
        name: 'Fuel view',
        module: 'expenses',
        scope: 'module'
    });

    expect(created).toBeTruthy();
    expect(created.id).toMatch(/^qv_/);

    const raw = localStorage.getItem('query.views.v1');
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].name).toBe('Fuel view');
});

test('Saved views support module and global scope listing', () => {
    window.SearchService.saveView({ name: 'Global A', module: 'expenses', scope: 'global' });
    window.SearchService.saveView({ name: 'Orders A', module: 'orders', scope: 'module' });

    const globalViews = window.SearchService.listViews('global', 'expenses');
    const orderViews = window.SearchService.listViews('module', 'orders');

    expect(globalViews.length).toBe(1);
    expect(globalViews[0].scope).toBe('*');

    expect(orderViews.length).toBe(2);
    expect(orderViews.some((v) => v.scope === 'orders')).toBe(true);
});

test('Saved views can be edited and deleted', () => {
    const created = window.SearchService.saveView({
        name: 'Old Name',
        module: 'savings',
        scope: 'module'
    });

    const updated = window.SearchService.updateView(created.id, { name: 'New Name' });
    expect(updated.name).toBe('New Name');

    const deleted = window.SearchService.deleteView(created.id);
    expect(deleted).toBe(true);
    expect(window.SearchService.listViews('module', 'savings').length).toBe(0);
});

test('Saved view apply restores query state', () => {
    window.SearchService.setSearchText('orders', 'open');
    window.SearchService.setFilters('orders', [{ field: 'status', op: 'eq', value: 'open' }]);
    const view = window.SearchService.saveView({
        name: 'Open Orders',
        module: 'orders',
        scope: 'module'
    });

    window.SearchService.clearSearch('orders');
    window.SearchService.clearFilters('orders');

    const applied = window.SearchService.applyView(view.id, 'orders');
    expect(applied.search.text).toBe('open');
    expect(applied.filters.length).toBe(1);
});
