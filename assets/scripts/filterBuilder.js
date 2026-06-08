(function (globalScope) {
    'use strict';

    var OPERATOR_LIBRARY = {
        text: [
            { value: 'eq', label: 'Equals' },
            { value: 'neq', label: 'Not Equals' },
            { value: 'contains', label: 'Contains' }
        ],
        number: [
            { value: 'eq', label: 'Equal To' },
            { value: 'gt', label: 'Greater Than' },
            { value: 'gte', label: 'Greater Than Or Equal' },
            { value: 'lt', label: 'Less Than' },
            { value: 'lte', label: 'Less Than Or Equal' },
            { value: 'between', label: 'Between' }
        ],
        enum: [
            { value: 'eq', label: 'Equals' },
            { value: 'neq', label: 'Not Equals' }
        ],
        presence: [
            { value: 'exists', label: 'Exists' },
            { value: 'not_exists', label: 'Does Not Exist' }
        ]
    };

    var PERIOD_OPTIONS = [
        { value: 'today', label: 'Today' },
        { value: 'week', label: 'This Week' },
        { value: 'month', label: 'This Month' },
        { value: 'last_week', label: 'Last Week' },
        { value: 'last_month', label: 'Last Month' },
        { value: 'year', label: 'This Year' },
        { value: 'custom', label: 'Custom' }
    ];

    function normalizeString(value) {
        return String(value || '').trim();
    }

    function mapTemplateByKey(templates) {
        var out = {};
        templates.forEach(function (template) {
            if (template && template.key) {
                out[String(template.key)] = template;
            }
        });
        return out;
    }

    function mapTemplateByField(templates) {
        var out = {};
        templates.forEach(function (template) {
            if (template && template.field) {
                out[String(template.field)] = template;
            }
        });
        return out;
    }

    function createConditionFromTemplate(template) {
        var operators = Array.isArray(template.operators) && template.operators.length
            ? template.operators
            : (OPERATOR_LIBRARY[template.type] || OPERATOR_LIBRARY.text);
        var firstOperator = operators[0] ? operators[0].value : 'eq';
        return {
            id: 'cond_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            key: template.key,
            field: template.field,
            label: template.label,
            type: template.type,
            operators: operators,
            operator: firstOperator,
            value: '',
            from: '',
            to: '',
            hint: template.hint || '',
            options: Array.isArray(template.options) ? template.options.slice() : []
        };
    }

    function buildDescriptorFromCondition(condition) {
        if (!condition || !condition.field || !condition.operator) {
            return null;
        }

        if (condition.type === 'presence') {
            return {
                version: 'v1',
                field: condition.field,
                op: condition.operator,
                value: true
            };
        }

        if (condition.operator === 'between') {
            return {
                version: 'v1',
                field: condition.field,
                op: 'between',
                from: condition.from,
                to: condition.to
            };
        }

        return {
            version: 'v1',
            field: condition.field,
            op: condition.operator,
            value: condition.value
        };
    }

    function createFilterBuilder(config) {
        var cfg = config || {};
        var templates = Array.isArray(cfg.templates) ? cfg.templates.slice() : [];
        var templatesByKey = mapTemplateByKey(templates);
        var templatesByField = mapTemplateByField(templates);

        var state = {
            period: 'all',
            from: '',
            to: '',
            matchLogic: 'all',
            searchText: '',
            activeConditions: [],
            passthroughFilters: []
        };

        var root = null;

        function getTemplateList() {
            return templates.slice();
        }

        function setRoot(element) {
            root = element;
        }

        function listAvailableTemplates() {
            var used = {};
            state.activeConditions.forEach(function (condition) {
                used[String(condition.key)] = true;
            });

            var term = normalizeString(state.searchText).toLowerCase();

            return getTemplateList().filter(function (template) {
                if (!template || used[String(template.key)]) {
                    return false;
                }
                if (!term) {
                    return true;
                }
                return String(template.label || '').toLowerCase().indexOf(term) !== -1;
            });
        }

        function emitChange() {
            if (typeof cfg.onChange === 'function') {
                cfg.onChange(getState());
            }
            render();
        }

        function addCondition(templateKey) {
            var template = templatesByKey[String(templateKey)];
            if (!template) {
                return;
            }
            state.activeConditions.push(createConditionFromTemplate(template));
            emitChange();
        }

        function removeCondition(conditionId) {
            state.activeConditions = state.activeConditions.filter(function (condition) {
                return String(condition.id) !== String(conditionId);
            });
            emitChange();
        }

        function updateCondition(conditionId, patch) {
            state.activeConditions = state.activeConditions.map(function (condition) {
                if (String(condition.id) !== String(conditionId)) {
                    return condition;
                }
                var next = Object.assign({}, condition, patch || {});
                if (next.operator !== 'between') {
                    next.from = '';
                    next.to = '';
                }
                if (next.type === 'presence') {
                    next.value = '';
                    next.from = '';
                    next.to = '';
                }
                return next;
            });
            emitChange();
        }

        function clearAll() {
            state.period = 'all';
            state.from = '';
            state.to = '';
            state.matchLogic = 'all';
            state.searchText = '';
            state.activeConditions = [];
            state.passthroughFilters = [];
            emitChange();
        }

        function getDescriptors() {
            var descriptors = [];

            if (state.period !== 'all') {
                descriptors.push({
                    version: 'v1',
                    field: cfg.dateField || 'date',
                    op: 'period',
                    value: {
                        type: state.period,
                        from: state.from || null,
                        to: state.to || null,
                        now: null
                    }
                });
            }

            var compiled = state.activeConditions
                .map(buildDescriptorFromCondition)
                .filter(function (descriptor) {
                    if (!descriptor) {
                        return false;
                    }
                    if (descriptor.op === 'between') {
                        return normalizeString(descriptor.from) && normalizeString(descriptor.to);
                    }
                    if (descriptor.op === 'exists' || descriptor.op === 'not_exists') {
                        return true;
                    }
                    return normalizeString(descriptor.value) !== '';
                });

            if (state.matchLogic === 'any' && compiled.length > 1) {
                descriptors.push({
                    version: 'v1',
                    field: '__filter_builder_group__',
                    op: 'group_any',
                    value: {
                        conditions: compiled
                    }
                });
            } else {
                descriptors = descriptors.concat(compiled);
            }

            return descriptors.concat(state.passthroughFilters || []);
        }

        function summarize() {
            var descriptors = getDescriptors();
            if (!descriptors.length) {
                return 'No active filters';
            }

            var parts = descriptors
                .filter(function (descriptor) {
                    return descriptor.op !== 'group_any';
                })
                .map(function (descriptor) {
                    if (descriptor.op === 'period' && descriptor.value) {
                        if (descriptor.value.type === 'custom') {
                            return 'Date in custom range';
                        }
                        return 'Date in ' + String(descriptor.value.type);
                    }
                    if (descriptor.op === 'between') {
                        return String(descriptor.field) + ' between ' + String(descriptor.from) + ' and ' + String(descriptor.to);
                    }
                    if (descriptor.op === 'exists') {
                        return String(descriptor.field) + ' exists';
                    }
                    if (descriptor.op === 'not_exists') {
                        return String(descriptor.field) + ' does not exist';
                    }
                    return String(descriptor.field) + ' ' + String(descriptor.op) + ' ' + String(descriptor.value || '');
                });

            var groupDescriptor = descriptors.find(function (descriptor) {
                return descriptor && descriptor.op === 'group_any' && descriptor.value && Array.isArray(descriptor.value.conditions);
            });
            if (groupDescriptor) {
                parts = groupDescriptor.value.conditions.map(function (condition) {
                    if (condition.op === 'between') {
                        return String(condition.field) + ' between ' + String(condition.from) + ' and ' + String(condition.to);
                    }
                    if (condition.op === 'exists') {
                        return String(condition.field) + ' exists';
                    }
                    if (condition.op === 'not_exists') {
                        return String(condition.field) + ' does not exist';
                    }
                    return String(condition.field) + ' ' + String(condition.op) + ' ' + String(condition.value || '');
                });
            }

            if (!parts.length) {
                return descriptors.length + ' Conditions Active';
            }

            var joiner = state.matchLogic === 'any' ? ' OR ' : ' AND ';
            return parts.join(joiner);
        }

        function getState() {
            return {
                period: state.period,
                from: state.from,
                to: state.to,
                matchLogic: state.matchLogic,
                searchText: state.searchText,
                activeConditions: state.activeConditions.slice(),
                passthroughFilters: state.passthroughFilters.slice()
            };
        }

        function setFromFilters(filters) {
            var list = Array.isArray(filters) ? filters : [];
            var nextConditions = [];
            var passthrough = [];
            var period = 'all';
            var from = '';
            var to = '';
            var matchLogic = 'all';

            list.forEach(function (descriptor) {
                if (!descriptor || typeof descriptor !== 'object') {
                    return;
                }

                if (descriptor.op === 'period' && String(descriptor.field) === String(cfg.dateField || 'date')) {
                    var value = descriptor.value || {};
                    period = value.type || 'all';
                    from = value.from || '';
                    to = value.to || '';
                    return;
                }

                if (descriptor.op === 'group_any' && descriptor.value && Array.isArray(descriptor.value.conditions)) {
                    matchLogic = 'any';
                    descriptor.value.conditions.forEach(function (condition) {
                        var template = templatesByField[String(condition.field)];
                        if (!template) {
                            return;
                        }
                        var item = createConditionFromTemplate(template);
                        item.operator = String(condition.op || item.operator);
                        if (item.operator === 'between') {
                            item.from = condition.from || '';
                            item.to = condition.to || '';
                        } else if (item.operator !== 'exists' && item.operator !== 'not_exists') {
                            item.value = condition.value === undefined || condition.value === null ? '' : String(condition.value);
                        }
                        nextConditions.push(item);
                    });
                    return;
                }

                var mappedTemplate = templatesByField[String(descriptor.field)];
                if (!mappedTemplate) {
                    passthrough.push(descriptor);
                    return;
                }

                var mappedCondition = createConditionFromTemplate(mappedTemplate);
                mappedCondition.operator = String(descriptor.op || mappedCondition.operator);
                if (mappedCondition.operator === 'between') {
                    mappedCondition.from = descriptor.from || '';
                    mappedCondition.to = descriptor.to || '';
                } else if (mappedCondition.operator !== 'exists' && mappedCondition.operator !== 'not_exists') {
                    mappedCondition.value = descriptor.value === undefined || descriptor.value === null ? '' : String(descriptor.value);
                }
                nextConditions.push(mappedCondition);
            });

            state.period = period;
            state.from = from;
            state.to = to;
            state.matchLogic = matchLogic;
            state.searchText = '';
            state.activeConditions = nextConditions;
            state.passthroughFilters = passthrough;

            render();
        }

        function createEl(tag, className, text) {
            var node = document.createElement(tag);
            if (className) {
                node.className = className;
            }
            if (text !== undefined) {
                node.textContent = text;
            }
            return node;
        }

        function renderDateSection(container) {
            var section = createEl('section', 'filter-builder-section');
            section.appendChild(createEl('h4', '', 'Date Filter'));
            section.appendChild(createEl('p', 'filter-builder-subtitle', 'Period'));

            var periodWrap = createEl('div', 'filter-builder-period-grid');
            PERIOD_OPTIONS.forEach(function (option) {
                var label = createEl('label', 'filter-builder-radio');
                var input = createEl('input');
                input.type = 'radio';
                input.name = 'fb_period_' + String(cfg.module || 'module');
                input.value = option.value;
                input.checked = state.period === option.value;
                input.addEventListener('change', function () {
                    state.period = option.value;
                    emitChange();
                });
                label.appendChild(input);
                label.appendChild(createEl('span', '', option.label));
                periodWrap.appendChild(label);
            });
            section.appendChild(periodWrap);

            if (state.period === 'custom') {
                var row = createEl('div', 'inline-row');
                var fromInput = createEl('input');
                fromInput.type = 'date';
                fromInput.value = state.from;
                fromInput.placeholder = 'From Date';
                fromInput.addEventListener('input', function () {
                    state.from = fromInput.value;
                });
                var toInput = createEl('input');
                toInput.type = 'date';
                toInput.value = state.to;
                toInput.placeholder = 'To Date';
                toInput.addEventListener('input', function () {
                    state.to = toInput.value;
                });
                row.appendChild(fromInput);
                row.appendChild(toInput);
                section.appendChild(row);
            }

            container.appendChild(section);
        }

        function renderAvailableSection(container) {
            var section = createEl('section', 'filter-builder-section');
            section.appendChild(createEl('h4', '', 'Available Filters'));

            var search = createEl('input');
            search.type = 'text';
            search.value = state.searchText;
            search.placeholder = 'Search filter fields...';
            search.addEventListener('input', function () {
                state.searchText = search.value;
                render();
            });
            section.appendChild(search);

            var chipWrap = createEl('div', 'filter-builder-chip-wrap');
            listAvailableTemplates().forEach(function (template) {
                var chip = createEl('button', 'secondary filter-builder-chip', '+ ' + String(template.label));
                chip.type = 'button';
                chip.addEventListener('click', function () {
                    addCondition(template.key);
                });
                chipWrap.appendChild(chip);
            });
            section.appendChild(chipWrap);

            container.appendChild(section);
        }

        function renderMatchLogicSection(container) {
            var section = createEl('section', 'filter-builder-section');
            section.appendChild(createEl('h4', '', 'Match Logic'));

            var allLabel = createEl('label', 'filter-builder-radio');
            var allInput = createEl('input');
            allInput.type = 'radio';
            allInput.name = 'fb_logic_' + String(cfg.module || 'module');
            allInput.value = 'all';
            allInput.checked = state.matchLogic === 'all';
            allInput.addEventListener('change', function () {
                state.matchLogic = 'all';
                emitChange();
            });
            allLabel.appendChild(allInput);
            allLabel.appendChild(createEl('span', '', 'ALL Conditions (AND)'));

            var anyLabel = createEl('label', 'filter-builder-radio');
            var anyInput = createEl('input');
            anyInput.type = 'radio';
            anyInput.name = 'fb_logic_' + String(cfg.module || 'module');
            anyInput.value = 'any';
            anyInput.checked = state.matchLogic === 'any';
            anyInput.addEventListener('change', function () {
                state.matchLogic = 'any';
                emitChange();
            });
            anyLabel.appendChild(anyInput);
            anyLabel.appendChild(createEl('span', '', 'ANY Condition (OR)'));

            section.appendChild(allLabel);
            section.appendChild(anyLabel);
            container.appendChild(section);
        }

        function renderConditionCard(condition) {
            var card = createEl('div', 'filter-builder-card');
            card.appendChild(createEl('h5', '', condition.label));

            var opSelect = createEl('select');
            condition.operators.forEach(function (operator) {
                var option = createEl('option');
                option.value = operator.value;
                option.textContent = operator.label;
                if (operator.value === condition.operator) {
                    option.selected = true;
                }
                opSelect.appendChild(option);
            });
            opSelect.addEventListener('change', function () {
                updateCondition(condition.id, { operator: opSelect.value });
            });
            card.appendChild(opSelect);

            if (condition.operator === 'between') {
                var betweenRow = createEl('div', 'inline-row');
                var fromInput = createEl('input');
                fromInput.type = condition.type === 'number' ? 'number' : 'text';
                fromInput.placeholder = 'From';
                fromInput.value = condition.from;
                fromInput.addEventListener('input', function () {
                    updateCondition(condition.id, { from: fromInput.value });
                });
                betweenRow.appendChild(fromInput);

                var toInput = createEl('input');
                toInput.type = condition.type === 'number' ? 'number' : 'text';
                toInput.placeholder = 'To';
                toInput.value = condition.to;
                toInput.addEventListener('input', function () {
                    updateCondition(condition.id, { to: toInput.value });
                });
                betweenRow.appendChild(toInput);
                card.appendChild(betweenRow);
            } else if (condition.type !== 'presence') {
                var valueInput = createEl('input');
                valueInput.type = condition.type === 'number' ? 'number' : 'text';
                valueInput.value = condition.value;
                valueInput.placeholder = 'Value';
                valueInput.addEventListener('input', function () {
                    updateCondition(condition.id, { value: valueInput.value });
                });
                card.appendChild(valueInput);
            }

            if (condition.hint) {
                card.appendChild(createEl('p', 'filter-builder-hint', 'Hint: ' + condition.hint));
            }

            var removeBtn = createEl('button', 'danger', 'Remove');
            removeBtn.type = 'button';
            removeBtn.addEventListener('click', function () {
                removeCondition(condition.id);
            });
            card.appendChild(removeBtn);

            return card;
        }

        function renderActiveSection(container) {
            var section = createEl('section', 'filter-builder-section');
            section.appendChild(createEl('h4', '', 'Active Filters'));

            if (!state.activeConditions.length) {
                section.appendChild(createEl('p', 'filter-builder-subtitle', 'No active filter conditions.'));
            } else {
                state.activeConditions.forEach(function (condition) {
                    section.appendChild(renderConditionCard(condition));
                });
            }

            container.appendChild(section);
        }

        function renderSummaryAndActions(container) {
            var summarySection = createEl('section', 'filter-builder-section');
            summarySection.appendChild(createEl('h4', '', 'Filter Summary'));
            summarySection.appendChild(createEl('p', 'filter-builder-summary', summarize()));
            container.appendChild(summarySection);

            var actions = createEl('div', 'modal-actions');

            var clearBtn = createEl('button', 'secondary', 'Clear');
            clearBtn.type = 'button';
            clearBtn.addEventListener('click', function () {
                clearAll();
                if (typeof cfg.onClear === 'function') {
                    cfg.onClear(getDescriptors());
                }
            });

            var saveBtn = createEl('button', 'secondary', 'Save Filter');
            saveBtn.type = 'button';
            saveBtn.addEventListener('click', function () {
                if (typeof cfg.onSave === 'function') {
                    cfg.onSave(getDescriptors());
                }
            });

            var applyBtn = createEl('button', 'primary', 'Apply Filters');
            applyBtn.type = 'button';
            applyBtn.addEventListener('click', function () {
                if (typeof cfg.onApply === 'function') {
                    cfg.onApply(getDescriptors());
                }
            });

            actions.appendChild(clearBtn);
            actions.appendChild(saveBtn);
            actions.appendChild(applyBtn);
            container.appendChild(actions);
        }

        function render() {
            if (!root) {
                return;
            }
            root.innerHTML = '';
            renderDateSection(root);
            renderAvailableSection(root);
            renderMatchLogicSection(root);
            renderActiveSection(root);
            renderSummaryAndActions(root);
        }

        return {
            mount: function (element) {
                setRoot(element);
                render();
            },
            render: render,
            getDescriptors: getDescriptors,
            setFromFilters: setFromFilters,
            getState: getState,
            clearAll: clearAll
        };
    }

    globalScope.FilterBuilder = {
        create: createFilterBuilder,
        OPERATOR_LIBRARY: OPERATOR_LIBRARY
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = globalScope.FilterBuilder;
    }
}(typeof window !== 'undefined' ? window : globalThis));
