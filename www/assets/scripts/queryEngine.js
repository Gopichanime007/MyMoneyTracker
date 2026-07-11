(function (globalScope) {
    'use strict';

    var QUERY_DESCRIPTOR_VERSION = 'v1';
    var QUERY_CACHE_LIMIT = 60;
    var queryPipelineCache = new Map();
    var predicateCache = new Map();

    function cloneJsonSafe(value) {
        if (value === undefined) {
            return undefined;
        }
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeString(value) {
        if (value === null || value === undefined) {
            return '';
        }
        return String(value).toLowerCase().trim();
    }

    function normalizeArray(value) {
        if (!Array.isArray(value)) {
            return [];
        }
        return value.slice();
    }

    function pruneCache(cacheMap, maxSize) {
        if (cacheMap.size <= maxSize) {
            return;
        }
        var keys = Array.from(cacheMap.keys());
        while (cacheMap.size > maxSize && keys.length) {
            cacheMap.delete(keys.shift());
        }
    }

    function createSortDescriptorV1(input) {
        var source = input || {};
        return {
            version: QUERY_DESCRIPTOR_VERSION,
            field: typeof source.field === 'string' ? source.field : '',
            direction: source.direction === 'desc' ? 'desc' : 'asc',
            type: typeof source.type === 'string' ? source.type : 'string',
            nulls: source.nulls === 'first' ? 'first' : 'last',
            secondary: normalizeArray(source.secondary).map(function (item) {
                return createSortDescriptorV1(item);
            })
        };
    }

    function createQueryDescriptorV1(input) {
        var source = input || {};
        var search = source.search || {};

        return {
            version: QUERY_DESCRIPTOR_VERSION,
            module: typeof source.module === 'string' ? source.module : 'global',
            search: {
                text: typeof search.text === 'string' ? search.text : '',
                fields: normalizeArray(search.fields).filter(function (field) {
                    return typeof field === 'string' && field.length > 0;
                })
            },
            filters: normalizeArray(source.filters),
            sort: normalizeArray(source.sort).map(function (item) {
                return createSortDescriptorV1(item);
            })
        };
    }

    function createFilterDescriptorV1(input) {
        var source = input || {};
        return {
            version: QUERY_DESCRIPTOR_VERSION,
            field: typeof source.field === 'string' ? source.field : '',
            op: typeof source.op === 'string' ? source.op : 'eq',
            value: source.value,
            values: normalizeArray(source.values),
            from: source.from,
            to: source.to,
            logic: source.logic === 'or' ? 'or' : 'and',
            conditions: normalizeArray(source.conditions).map(function (condition) {
                return createFilterDescriptorV1(condition);
            })
        };
    }

    function createQueryStateStore(initialStateByModule) {
        var state = {};
        var subscribers = {};
        var seed = initialStateByModule || {};

        Object.keys(seed).forEach(function (moduleName) {
            state[moduleName] = createQueryDescriptorV1(seed[moduleName]);
        });

        function getState(moduleName) {
            var key = moduleName || 'global';
            if (!state[key]) {
                state[key] = createQueryDescriptorV1({ module: key });
            }
            return cloneJsonSafe(state[key]);
        }

        function emit(moduleName) {
            var key = moduleName || 'global';
            var listeners = subscribers[key] || [];
            var snapshot = getState(key);
            listeners.forEach(function (listener) {
                listener(snapshot);
            });
        }

        function setState(moduleName, descriptor) {
            var key = moduleName || 'global';
            state[key] = createQueryDescriptorV1(descriptor || { module: key });
            emit(key);
            return getState(key);
        }

        function patchState(moduleName, partial) {
            var key = moduleName || 'global';
            var next = Object.assign({}, getState(key), partial || {});
            return setState(key, next);
        }

        function resetState(moduleName) {
            var key = moduleName || 'global';
            return setState(key, { module: key });
        }

        function subscribe(moduleName, listener) {
            var key = moduleName || 'global';
            if (typeof listener !== 'function') {
                return function noop() {};
            }
            if (!subscribers[key]) {
                subscribers[key] = [];
            }
            subscribers[key].push(listener);
            return function unsubscribe() {
                subscribers[key] = (subscribers[key] || []).filter(function (fn) {
                    return fn !== listener;
                });
            };
        }

        return {
            getState: getState,
            setState: setState,
            patchState: patchState,
            resetState: resetState,
            subscribe: subscribe
        };
    }

    function compareByType(left, right, type) {
        if (left === right) {
            return 0;
        }

        var normalizedType = type || 'string';

        if (normalizedType === 'boolean') {
            return Number(Boolean(left)) - Number(Boolean(right));
        }

        if (normalizedType === 'number' || normalizedType === 'currency') {
            var leftNumber = Number(String(left).replace(/[^0-9+.\-]/g, ''));
            var rightNumber = Number(String(right).replace(/[^0-9+.\-]/g, ''));
            return leftNumber - rightNumber;
        }

        if (normalizedType === 'date') {
            return new Date(left).getTime() - new Date(right).getTime();
        }

        if (normalizedType === 'natural') {
            return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' });
        }

        return String(left).localeCompare(String(right));
    }

    function runSearch(rows, descriptor) {
        var search = descriptor.search || {};
        var text = normalizeString(search.text);
        if (!text) {
            return rows;
        }

        var fields = normalizeArray(search.fields);
        if (!fields.length && rows.length) {
            fields = Object.keys(rows[0]);
        }

        return rows.filter(function (row) {
            var indexedSearch = fields.map(function (field) {
                return normalizeString(row[field]);
            }).join('\u0000');
            return indexedSearch.indexOf(text) !== -1;
        });
    }

    function toComparableDate(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (value instanceof Date) {
            var dateValue = value.getTime();
            return Number.isFinite(dateValue) ? dateValue : null;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }

        if (typeof value === 'string') {
            var trimmed = value.trim();
            if (!trimmed) {
                return null;
            }

            var numeric = Number(trimmed);
            if (Number.isFinite(numeric)) {
                return numeric;
            }

            var parsed = new Date(trimmed);
            var time = parsed.getTime();
            if (Number.isFinite(time)) {
                return time;
            }

            var simple = Date.parse(trimmed);
            return Number.isFinite(simple) ? simple : null;
        }

        var parsedValue = new Date(value);
        var parsedTime = parsedValue.getTime();
        return Number.isFinite(parsedTime) ? parsedTime : null;
    }

    function normalizeComparableValue(value) {
        var comparable = toComparableDate(value);
        if (comparable === null) {
            return null;
        }

        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
            return new Date(value + 'T00:00:00').getTime();
        }

        return comparable;
    }

    function coerceComparableValue(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            var trimmed = value.trim();
            if (!trimmed) {
                return null;
            }
            var simpleDateMatch = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
            if (simpleDateMatch) {
                return new Date(trimmed + 'T00:00:00').getTime();
            }
        }

        return normalizeComparableValue(value);
    }

    function coerceComparableDateKey(value) {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            var trimmed = value.trim();
            if (!trimmed) {
                return null;
            }
            if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                return trimmed;
            }
            var parsed = new Date(trimmed);
            if (Number.isFinite(parsed.getTime())) {
                return parsed.toISOString().slice(0, 10);
            }
            return null;
        }

        if (value instanceof Date) {
            var dateValue = value.getTime();
            return Number.isFinite(dateValue) ? new Date(dateValue).toISOString().slice(0, 10) : null;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            return new Date(value).toISOString().slice(0, 10);
        }

        var fallback = new Date(value);
        return Number.isFinite(fallback.getTime()) ? fallback.toISOString().slice(0, 10) : null;
    }

    function evaluatePeriodValue(value, periodDef) {
        var period = periodDef || {};
        var now = period.now ? new Date(period.now) : new Date();
        var target = toComparableDate(value);
        if (target === null) {
            return false;
        }

        var start = null;
        var end = null;

        if (period.type === 'today') {
            start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        } else if (period.type === 'week') {
            var weekStart = new Date(now);
            weekStart.setDate(now.getDate() - 6);
            weekStart.setHours(0, 0, 0, 0);
            start = weekStart.getTime();
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        } else if (period.type === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
            end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        } else {
            start = period.from ? toComparableDate(period.from) : null;
            end = period.to ? toComparableDate(period.to) : null;
            if (start !== null) {
                var startDay = new Date(start);
                startDay.setHours(0, 0, 0, 0);
                start = startDay.getTime();
            }
            if (end !== null) {
                var endDay = new Date(end);
                endDay.setHours(23, 59, 59, 999);
                end = endDay.getTime();
            }
        }

        if (start !== null && target < start) {
            return false;
        }
        if (end !== null && target > end) {
            return false;
        }
        return true;
    }

    function evaluateFilter(row, filter) {
        if (!filter || typeof filter !== 'object') {
            return true;
        }

        if (typeof filter.predicate === 'function') {
            return Boolean(filter.predicate(row));
        }

        var descriptor = createFilterDescriptorV1(filter);

        if (descriptor.conditions.length) {
            if (descriptor.logic === 'or') {
                return descriptor.conditions.some(function (condition) {
                    return evaluateFilter(row, condition);
                });
            }

            return descriptor.conditions.every(function (condition) {
                return evaluateFilter(row, condition);
            });
        }

        if (!descriptor.field || !descriptor.op) {
            return true;
        }

        var value = row[descriptor.field];
        var target = descriptor.value;
        var comparableValue = coerceComparableValue(value);
        var comparableTarget = coerceComparableValue(target);

        if (descriptor.op === 'eq') {
            var dateKeyValue = coerceComparableDateKey(value);
            var dateKeyTarget = coerceComparableDateKey(target);
            if (dateKeyValue !== null && dateKeyTarget !== null) {
                return dateKeyValue === dateKeyTarget;
            }
            if (comparableValue !== null && comparableTarget !== null) {
                return comparableValue === comparableTarget;
            }
            return value === target;
        }
        if (descriptor.op === 'neq') {
            var neqDateKeyValue = coerceComparableDateKey(value);
            var neqDateKeyTarget = coerceComparableDateKey(target);
            if (neqDateKeyValue !== null && neqDateKeyTarget !== null) {
                return neqDateKeyValue !== neqDateKeyTarget;
            }
            if (comparableValue !== null && comparableTarget !== null) {
                return comparableValue !== comparableTarget;
            }
            return value !== target;
        }
        if (descriptor.op === 'gt') {
            if (comparableValue !== null && comparableTarget !== null) {
                return comparableValue > comparableTarget;
            }
            return value > target;
        }
        if (descriptor.op === 'gte') {
            if (comparableValue !== null && comparableTarget !== null) {
                return comparableValue >= comparableTarget;
            }
            return value >= target;
        }
        if (descriptor.op === 'lt') {
            if (comparableValue !== null && comparableTarget !== null) {
                return comparableValue < comparableTarget;
            }
            return value < target;
        }
        if (descriptor.op === 'lte') {
            if (comparableValue !== null && comparableTarget !== null) {
                return comparableValue <= comparableTarget;
            }
            return value <= target;
        }
        if (descriptor.op === 'contains') {
            return normalizeString(value).indexOf(normalizeString(target)) !== -1;
        }
        if (descriptor.op === 'starts_with') {
            return normalizeString(value).indexOf(normalizeString(target)) === 0;
        }
        if (descriptor.op === 'ends_with') {
            var left = normalizeString(value);
            var right = normalizeString(target);
            return right ? left.slice(-right.length) === right : false;
        }
        if (descriptor.op === 'in' && Array.isArray(target)) {
            return target.indexOf(value) !== -1;
        }
        if (descriptor.op === 'between') {
            var min = descriptor.from !== undefined ? descriptor.from : target;
            var max = descriptor.to !== undefined ? descriptor.to : target;
            var lowerBound = coerceComparableValue(min);
            var upperBound = coerceComparableValue(max);
            if (lowerBound !== null && comparableValue !== null && comparableValue < lowerBound) {
                return false;
            }
            if (upperBound !== null && comparableValue !== null && comparableValue > upperBound) {
                return false;
            }
            if (lowerBound === null && upperBound === null) {
                return true;
            }
            if (comparableValue === null) {
                return value >= min && value <= max;
            }
            return true;
        }
        if (descriptor.op === 'period') {
            return evaluatePeriodValue(value, target || descriptor);
        }

        return true;
    }

    function runFilter(rows, descriptor) {
        var filters = normalizeArray(descriptor.filters);
        if (!filters.length) {
            return rows;
        }

        function compileFilterEvaluator(filter) {
            if (!filter || typeof filter !== 'object') {
                return function alwaysTrue() { return true; };
            }

            if (typeof filter.predicate === 'function') {
                return function predicateEvaluator(row) {
                    return Boolean(filter.predicate(row));
                };
            }

            var cacheKey;
            try {
                cacheKey = JSON.stringify(filter);
            } catch (error) {
                cacheKey = '';
            }

            if (cacheKey && predicateCache.has(cacheKey)) {
                return predicateCache.get(cacheKey);
            }

            var compiled = function compiledEvaluator(row) {
                return evaluateFilter(row, filter);
            };

            if (cacheKey) {
                predicateCache.set(cacheKey, compiled);
                pruneCache(predicateCache, QUERY_CACHE_LIMIT * 2);
            }

            return compiled;
        }

        var evaluators = filters.map(function (filter) {
            return compileFilterEvaluator(filter);
        });

        return rows.filter(function (row) {
            return evaluators.every(function (evaluate) {
                return evaluate(row);
            });
        });
    }

    function buildComparator(sortDescriptor) {
        return function (leftRow, rightRow) {
            var left = leftRow.item[sortDescriptor.field];
            var right = rightRow.item[sortDescriptor.field];

            if (left === null || left === undefined || right === null || right === undefined) {
                if (left === right) {
                    return 0;
                }
                if (left === null || left === undefined) {
                    return sortDescriptor.nulls === 'first' ? -1 : 1;
                }
                return sortDescriptor.nulls === 'first' ? 1 : -1;
            }

            var compared = compareByType(left, right, sortDescriptor.type);
            if (sortDescriptor.direction === 'desc') {
                compared = compared * -1;
            }
            return compared;
        };
    }

    function runSort(rows, descriptor) {
        var sortList = normalizeArray(descriptor.sort);
        if (!sortList.length) {
            return rows;
        }

        function flattenDescriptors(list) {
            var flattened = [];

            function append(item) {
                if (!item) {
                    return;
                }
                var normalized = createSortDescriptorV1(item);
                flattened.push(normalized);
                normalized.secondary.forEach(function (nextItem) {
                    append(nextItem);
                });
            }

            list.forEach(function (item) {
                append(item);
            });

            return flattened;
        }

        var flattenedSortList = flattenDescriptors(sortList);

        var comparators = flattenedSortList
            .filter(function (item) {
                return item && typeof item.field === 'string' && item.field.length > 0;
            })
            .map(function (item) {
                return buildComparator(createSortDescriptorV1(item));
            });

        if (!comparators.length) {
            return rows;
        }

        return rows
            .map(function (item, index) {
                return { item: item, index: index };
            })
            .sort(function (left, right) {
                for (var i = 0; i < comparators.length; i += 1) {
                    var compared = comparators[i](left, right);
                    if (compared !== 0) {
                        return compared;
                    }
                }
                return left.index - right.index;
            })
            .map(function (entry) {
                return entry.item;
            });
    }

    function runQueryPipeline(items, descriptor, options) {
        var sourceItems = Array.isArray(items) ? items : [];
        var query = createQueryDescriptorV1(descriptor || {});
        var opts = options || {};
        var normalizer = typeof opts.normalizeItem === 'function' ? opts.normalizeItem : function (item) { return item; };

        var cacheKey = '';
        if (opts.cache !== false) {
            try {
                cacheKey = JSON.stringify({
                    query: query,
                    totalCount: sourceItems.length,
                    first: sourceItems[0] || null,
                    last: sourceItems[sourceItems.length - 1] || null
                });
            } catch (error) {
                cacheKey = '';
            }
        }

        if (cacheKey && queryPipelineCache.has(cacheKey)) {
            return cloneJsonSafe(queryPipelineCache.get(cacheKey));
        }

        var normalized = sourceItems
            .map(function (item) {
                return normalizer(item);
            })
            .filter(function (item) {
                return Boolean(item);
            });

        var searched = runSearch(normalized, query);
        var filtered = runFilter(searched, query);
        var sorted = runSort(filtered, query);

        var result = {
            descriptor: query,
            totalCount: sourceItems.length,
            normalizedCount: normalized.length,
            resultCount: sorted.length,
            results: sorted
        };

        if (cacheKey) {
            queryPipelineCache.set(cacheKey, cloneJsonSafe(result));
            pruneCache(queryPipelineCache, QUERY_CACHE_LIMIT);
        }

        return result;
    }

    var api = {
        QUERY_DESCRIPTOR_VERSION: QUERY_DESCRIPTOR_VERSION,
        createQueryDescriptorV1: createQueryDescriptorV1,
        createFilterDescriptorV1: createFilterDescriptorV1,
        createSortDescriptorV1: createSortDescriptorV1,
        createQueryStateStore: createQueryStateStore,
        evaluateFilterDescriptorV1: evaluateFilter,
        runQueryPipeline: runQueryPipeline
    };

    globalScope.QueryEngine = api;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
}(typeof window !== 'undefined' ? window : globalThis));
