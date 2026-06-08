(function (globalScope) {
    'use strict';

    var STORAGE_KEY = 'query.state.v1';
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
        var store = hasQueryEngine()
            ? globalScope.QueryEngine.createQueryStateStore(persisted)
            : createFallbackStateStore(persisted);

        var adapters = {};

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

        function applyModuleSearch(moduleName, rows, overrides) {
            var key = normalizeModuleName(moduleName);
            var list = Array.isArray(rows) ? rows : [];
            var descriptor = store.getState(key);
            var adapter = getAdapter(key);
            var options = overrides || {};

            var searchFields = Array.isArray(options.searchFields) && options.searchFields.length
                ? options.searchFields
                : adapter.searchFields;

            var normalizedDescriptor = {
                version: 'v1',
                module: key,
                search: {
                    text: String((descriptor.search && descriptor.search.text) || ''),
                    fields: searchFields
                },
                filters: Array.isArray(descriptor.filters) ? descriptor.filters : [],
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
            return globalScope.QueryEngine.runQueryPipeline(list, normalizedDescriptor, {
                normalizeItem: typeof normalizer === 'function' ? normalizer : function identity(item) { return item; }
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
            registerAdapter: registerAdapter,
            getAdapter: getAdapter,
            getState: getState,
            setState: setState,
            setSearchText: setSearchText,
            clearSearch: clearSearch,
            applyModuleSearch: applyModuleSearch,
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
