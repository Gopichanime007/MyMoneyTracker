(function (globalScope) {
    'use strict';

    var STORAGE_KEY = 'query.state.v1';
    var VIEWS_STORAGE_KEY = 'query.views.v1';
    var MODULES = ['expenses', 'savings', 'orders', 'quotations'];

    function hasQueryEngine() {
        return Boolean(globalScope.QueryEngine && typeof globalScope.QueryEngine.createQueryStateStore === 'function');
    }

    function readPersistedState() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                return {};
            }
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (_err) {
            return {};
        }
    }

    function writePersistedState(stateMap) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stateMap || {}));
        } catch (_err) {
            // Ignore quota/storage errors to keep runtime resilient.
        }
    }

    function readPersistedViews() {
        try {
            var raw = localStorage.getItem(VIEWS_STORAGE_KEY);
            if (!raw) {
                return [];
            }
            var parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (_err) {
            return [];
        }
    }

    function writePersistedViews(views) {
        try {
            localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(Array.isArray(views) ? views : []));
        } catch (_err) {
            // Ignore storage errors to keep runtime resilient.
        }
    }

    function normalizeModuleName(moduleName) {
        return typeof moduleName === 'string' && moduleName.trim() ? moduleName.trim() : 'global';
    }

    function createFallbackStateStore(initialState) {
        var state = initialState || {};

        function getState(moduleName) {
            var key = normalizeModuleName(moduleName);
            return state[key] || {
                version: 'v1',
                module: key,
                search: { text: '', fields: [] },
                filters: [],
                sort: []
            };
        }

        function setState(moduleName, descriptor) {
            var key = normalizeModuleName(moduleName);
            state[key] = descriptor || getState(key);
            return getState(key);
        }

        function patchState(moduleName, partial) {
            var key = normalizeModuleName(moduleName);
            var current = getState(key);
            var next = Object.assign({}, current, partial || {});
            if (partial && partial.search) {
                next.search = Object.assign({}, current.search || {}, partial.search);
            }
            return setState(key, next);
        }

        function resetState(moduleName) {
            var key = normalizeModuleName(moduleName);
            delete state[key];
            return getState(key);
        }

        return {
            getState: getState,
            setState: setState,
            patchState: patchState,
            resetState: resetState,
            subscribe: function () {
                return function noop() {};
            }
        };
    }

    function createSearchService() {
        var persisted = readPersistedState();
        var persistedViews = readPersistedViews();
        var store = hasQueryEngine()
            ? globalScope.QueryEngine.createQueryStateStore(persisted)
            : createFallbackStateStore(persisted);

        var adapters = {};
        var views = Array.isArray(persistedViews) ? persistedViews.slice() : [];
        var debounceTimers = {};

        function registerAdapter(moduleName, config) {
            var key = normalizeModuleName(moduleName);
            var source = config || {};
            adapters[key] = {
                searchFields: Array.isArray(source.searchFields) ? source.searchFields.filter(function (field) {
                    return typeof field === 'string' && field.length > 0;
                }) : [],
                normalizeItem: typeof source.normalizeItem === 'function' ? source.normalizeItem : null
            };
            return adapters[key];
        }

        function getAdapter(moduleName) {
            var key = normalizeModuleName(moduleName);
            if (!adapters[key]) {
                registerAdapter(key, {});
            }
            return adapters[key];
        }

        function serializeState() {
            var out = {};
            Object.keys(adapters).forEach(function (moduleName) {
                out[moduleName] = store.getState(moduleName);
            });
            MODULES.forEach(function (moduleName) {
                out[moduleName] = store.getState(moduleName);
            });
            return out;
        }

        function persist() {
            writePersistedState(serializeState());
        }

        function persistViews() {
            writePersistedViews(views);
        }

        function createViewId() {
            return 'qv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        }

        function normalizeScope(scope, moduleName) {
            if (scope === 'global') {
                return '*';
            }
            return normalizeModuleName(moduleName);
        }

        function listViews(scope, moduleName) {
            var resolvedScope = scope === 'global' ? '*' : normalizeModuleName(moduleName);
            return views.filter(function (view) {
                if (resolvedScope === '*') {
                    return String(view.scope || '') === '*';
                }
                return String(view.scope || '') === resolvedScope || String(view.scope || '') === '*';
            });
        }

        function saveView(payload) {
            var source = payload || {};
            var moduleName = normalizeModuleName(source.module);
            var now = new Date().toISOString();
            var view = {
                id: createViewId(),
                name: typeof source.name === 'string' && source.name.trim() ? source.name.trim() : 'Untitled View',
                module: moduleName,
                scope: normalizeScope(source.scope, moduleName),
                query: source.query || store.getState(moduleName),
                createdAt: now,
                updatedAt: now
            };
            views.push(view);
            persistViews();
            return view;
        }

        function updateView(viewId, patch) {
            var idx = views.findIndex(function (view) {
                return String(view.id) === String(viewId);
            });
            if (idx === -1) {
                return null;
            }
            var current = views[idx];
            var next = Object.assign({}, current, patch || {}, {
                updatedAt: new Date().toISOString()
            });
            if (patch && patch.scope) {
                next.scope = normalizeScope(patch.scope, next.module || current.module);
            }
            views[idx] = next;
            persistViews();
            return next;
        }

        function deleteView(viewId) {
            var before = views.length;
            views = views.filter(function (view) {
                return String(view.id) !== String(viewId);
            });
            var deleted = views.length !== before;
            if (deleted) {
                persistViews();
            }
            return deleted;
        }

        function applyView(viewId, moduleName) {
            var targetModule = normalizeModuleName(moduleName);
            var view = views.find(function (entry) {
                return String(entry.id) === String(viewId);
            });
            if (!view) {
                return null;
            }
            var query = view.query || {};
            var effectiveModule = view.scope === '*' ? targetModule : normalizeModuleName(view.module);
            var next = store.setState(effectiveModule, query);
            persist();
            return next;
        }

        function setSearchText(moduleName, text, fields) {
            var key = normalizeModuleName(moduleName);
            var adapter = getAdapter(key);
            var searchFields = Array.isArray(fields) && fields.length ? fields : adapter.searchFields;
            var current = store.getState(key);

            var next = store.setState(key, {
                version: 'v1',
                module: key,
                search: {
                    text: typeof text === 'string' ? text : '',
                    fields: searchFields
                },
                filters: Array.isArray(current.filters) ? current.filters : [],
                sort: Array.isArray(current.sort) ? current.sort : []
            });

            persist();
            return next;
        }

        function scheduleSearch(moduleName, text, fields, delayMs, callback) {
            var key = normalizeModuleName(moduleName);
            var delay = Number.isFinite(Number(delayMs)) ? Math.max(0, Number(delayMs)) : 150;

            if (debounceTimers[key]) {
                clearTimeout(debounceTimers[key]);
            }

            debounceTimers[key] = setTimeout(function () {
                debounceTimers[key] = null;
                var state = setSearchText(key, text, fields);
                if (typeof callback === 'function') {
                    callback(state);
                }
            }, delay);
        }

        function clearSearch(moduleName) {
            var key = normalizeModuleName(moduleName);
            var current = store.getState(key);
            var next = store.setState(key, {
                version: 'v1',
                module: key,
                search: {
                    text: '',
                    fields: (getAdapter(key).searchFields || []).slice()
                },
                filters: Array.isArray(current.filters) ? current.filters : [],
                sort: Array.isArray(current.sort) ? current.sort : []
            });
            persist();
            return next;
        }

        function setFilters(moduleName, filters) {
            var key = normalizeModuleName(moduleName);
            var current = store.getState(key);
            var next = store.setState(key, {
                version: 'v1',
                module: key,
                search: current.search || { text: '', fields: [] },
                filters: Array.isArray(filters) ? filters : [],
                sort: Array.isArray(current.sort) ? current.sort : []
            });
            persist();
            return next;
        }

        function clearFilters(moduleName) {
            return setFilters(moduleName, []);
        }

        function setSort(moduleName, sortList) {
            var key = normalizeModuleName(moduleName);
            var current = store.getState(key);
            var next = store.setState(key, {
                version: 'v1',
                module: key,
                search: current.search || { text: '', fields: [] },
                filters: Array.isArray(current.filters) ? current.filters : [],
                sort: Array.isArray(sortList) ? sortList : []
            });
            persist();
            return next;
        }

        function clearSort(moduleName) {
            return setSort(moduleName, []);
        }

        function buildPeriodFilterDescriptor(field, periodType, from, to, now) {
            return {
                version: 'v1',
                field: typeof field === 'string' && field ? field : 'date',
                op: 'period',
                value: {
                    type: periodType || 'all',
                    from: from || null,
                    to: to || null,
                    now: now || null
                }
            };
        }

        function applyModuleSearch(moduleName, rows, overrides) {
            var key = normalizeModuleName(moduleName);
            var list = Array.isArray(rows) ? rows : [];
            var descriptor = store.getState(key);
            var adapter = getAdapter(key);
            var options = overrides || {};

            var searchFields = Array.isArray(options.searchFields) && options.searchFields.length
                ? options.searchFields
                : adapter.searchFields;

            var rawFilters = Array.isArray(descriptor.filters) ? descriptor.filters : [];
            var groupAnyFilter = rawFilters.find(function (item) {
                return item && item.op === 'group_any' && item.value && Array.isArray(item.value.conditions);
            });
            var filtersWithoutGroupAny = rawFilters.filter(function (item) {
                return !(item && item.op === 'group_any');
            });

            var normalizedDescriptor = {
                version: 'v1',
                module: key,
                search: {
                    text: String((descriptor.search && descriptor.search.text) || ''),
                    fields: searchFields
                },
                filters: filtersWithoutGroupAny,
                sort: Array.isArray(descriptor.sort) ? descriptor.sort : []
            };

            if (!hasQueryEngine() || typeof globalScope.QueryEngine.runQueryPipeline !== 'function') {
                return {
                    descriptor: normalizedDescriptor,
                    totalCount: list.length,
                    normalizedCount: list.length,
                    resultCount: list.length,
                    results: list
                };
            }

            var normalizer = options.normalizeItem || adapter.normalizeItem;
            var result = globalScope.QueryEngine.runQueryPipeline(list, normalizedDescriptor, {
                normalizeItem: typeof normalizer === 'function' ? normalizer : function identity(item) { return item; }
            });

            if (!groupAnyFilter || !globalScope.QueryEngine || typeof globalScope.QueryEngine.evaluateFilterDescriptorV1 !== 'function') {
                return result;
            }

            var groupConditions = groupAnyFilter.value.conditions;
            var groupedResults = (Array.isArray(result.results) ? result.results : []).filter(function (row) {
                return groupConditions.some(function (condition) {
                    return globalScope.QueryEngine.evaluateFilterDescriptorV1(row, condition);
                });
            });

            return {
                descriptor: result.descriptor,
                totalCount: result.totalCount,
                normalizedCount: result.normalizedCount,
                resultCount: groupedResults.length,
                results: groupedResults
            };
        }

        function applyLegacyDateFilter(moduleName, rows, periodType, from, to, now, fieldName) {
            var key = normalizeModuleName(moduleName);
            var current = store.getState(key);
            var period = periodType || 'all';
            var filterList = [];

            if (period !== 'all') {
                filterList.push(buildPeriodFilterDescriptor(fieldName || 'date', period, from, to, now));
            }

            var descriptor = {
                version: 'v1',
                module: key,
                search: current.search || { text: '', fields: (getAdapter(key).searchFields || []).slice() },
                filters: filterList,
                sort: Array.isArray(current.sort) ? current.sort : []
            };

            if (!hasQueryEngine() || typeof globalScope.QueryEngine.runQueryPipeline !== 'function') {
                return {
                    descriptor: descriptor,
                    totalCount: Array.isArray(rows) ? rows.length : 0,
                    normalizedCount: Array.isArray(rows) ? rows.length : 0,
                    resultCount: Array.isArray(rows) ? rows.length : 0,
                    results: Array.isArray(rows) ? rows : []
                };
            }

            return globalScope.QueryEngine.runQueryPipeline(Array.isArray(rows) ? rows : [], descriptor, {
                normalizeItem: function identity(item) { return item; }
            });
        }

        function getState(moduleName) {
            return store.getState(normalizeModuleName(moduleName));
        }

        function setState(moduleName, descriptor) {
            var next = store.setState(normalizeModuleName(moduleName), descriptor);
            persist();
            return next;
        }

        return {
            STORAGE_KEY: STORAGE_KEY,
            VIEWS_STORAGE_KEY: VIEWS_STORAGE_KEY,
            registerAdapter: registerAdapter,
            getAdapter: getAdapter,
            getState: getState,
            setState: setState,
            setSearchText: setSearchText,
            scheduleSearch: scheduleSearch,
            clearSearch: clearSearch,
            setFilters: setFilters,
            clearFilters: clearFilters,
            setSort: setSort,
            clearSort: clearSort,
            buildPeriodFilterDescriptor: buildPeriodFilterDescriptor,
            applyModuleSearch: applyModuleSearch,
            applyLegacyDateFilter: applyLegacyDateFilter,
            listViews: listViews,
            saveView: saveView,
            updateView: updateView,
            deleteView: deleteView,
            applyView: applyView,
            persist: persist
        };
    }

    var service = createSearchService();

    service.registerAdapter('expenses', {
        searchFields: ['type', 'category', 'purpose', 'entity', 'paymentType', 'budgetId', 'person', 'resolutionType', 'refundType', 'id']
    });

    service.registerAdapter('savings', {
        searchFields: ['type', 'note', 'entity', 'paymentType', 'sourceId', 'person', 'refundType', 'resolutionType', 'id']
    });

    service.registerAdapter('orders', {
        searchFields: ['id', 'orderNo', 'purpose', 'status', 'quotationNo', 'quotationId', 'sourceType', 'sourceName', 'paymentType']
    });

    service.registerAdapter('quotations', {
        searchFields: ['id', 'quotationNo', 'purpose', 'status', 'fundingSourceType', 'fundingSourceName']
    });

    MODULES.forEach(function (moduleName) {
        var state = service.getState(moduleName);
        if (!state.search || !Array.isArray(state.search.fields) || !state.search.fields.length) {
            service.setSearchText(moduleName, (state.search && state.search.text) || '', service.getAdapter(moduleName).searchFields);
        }
    });

    globalScope.SearchService = service;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = service;
    }
}(typeof window !== 'undefined' ? window : globalThis));
