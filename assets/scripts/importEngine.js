/**
 * MyMoneyTracker - Import Engine
 *
 * Central import-processing layer.
 *
 * The Import Engine is intentionally UI-independent.
 *
 * It is responsible for:
 * - Reading Job payloads
 * - Parsing JSON
 * - Validating import versions
 * - Normalizing import data
 * - Validating the normalized payload
 * - Delegating application data mapping
 * - Returning structured import results
 *
 * It does NOT:
 * - Render UI
 * - Open/close modals
 * - Show toasts
 * - Read from #importText
 * - Refresh screens
 * - Manage the Job Queue
 * - Duplicate application-specific storage logic
 *
 * The actual application data mapping is provided by
 * applyImportData() in script.js.
 *
 * Manual Import and Job Queue Import therefore use the
 * same import-processing pipeline.
 */

const ImportEngine = (() => {

    const handlers = {};


    /**
     * ---------------------------------------------------------
     * IMPORT TYPES
     * ---------------------------------------------------------
     */

    const TYPE = {
        JSON_IMPORT: 'JSON_IMPORT',
        CSV_IMPORT: 'CSV_IMPORT'
    };


    /**
     * ---------------------------------------------------------
     * HANDLER REGISTRATION
     * ---------------------------------------------------------
     */

    /**
     * Register an import handler for a specific Job type.
     *
     * @param {string} jobType
     * @param {Function} handler
     */
    function registerHandler(jobType, handler) {

        if (!jobType) {
            throw new Error(
                'ImportEngine.registerHandler requires a job type.'
            );
        }

        if (typeof handler !== 'function') {
            throw new Error(
                `Import handler for ${jobType} must be a function.`
            );
        }

        handlers[jobType] = handler;
    }


    /**
     * Check whether an import handler exists.
     *
     * @param {string} jobType
     * @returns {boolean}
     */
    function hasHandler(jobType) {

        return typeof handlers[jobType] === 'function';
    }


    /**
     * Get the registered handler for a Job type.
     *
     * @param {string} jobType
     * @returns {Function|null}
     */
    function getHandler(jobType) {

        return handlers[jobType] || null;
    }


    /**
     * ---------------------------------------------------------
     * GLOBAL FUNCTION RESOLVER
     * ---------------------------------------------------------
     *
     * Existing MyMoneyTracker import helpers live in script.js.
     *
     * We resolve them at execution time rather than copying
     * their implementation into this module.
     *
     * This prevents duplicate business logic.
     */

    function getGlobalFunction(name) {

        if (
            typeof window !== 'undefined' &&
            typeof window[name] === 'function'
        ) {
            return window[name];
        }

        if (
            typeof globalThis !== 'undefined' &&
            typeof globalThis[name] === 'function'
        ) {
            return globalThis[name];
        }

        return null;
    }


    /**
     * Get a required application function.
     *
     * @param {string} name
     * @returns {Function}
     */
    function requireGlobalFunction(name) {

        const fn = getGlobalFunction(name);

        if (!fn) {
            throw new Error(
                `Required import function is unavailable: ${name}`
            );
        }

        return fn;
    }


    /**
     * ---------------------------------------------------------
     * JOB VALIDATION
     * ---------------------------------------------------------
     */

    /**
     * Validate the basic structure of an import Job.
     *
     * @param {Object} job
     */
    function validateJob(job) {

        if (!job || typeof job !== 'object') {
            throw new Error(
                'ImportEngine requires a valid Job.'
            );
        }

        if (!job.id) {
            throw new Error(
                'Import Job is missing an ID.'
            );
        }

        if (!job.type) {
            throw new Error(
                'Import Job is missing a Job type.'
            );
        }

        if (!job.fileName) {
            throw new Error(
                'Import Job is missing a file name.'
            );
        }

        if (
            job.payload === undefined ||
            job.payload === null ||
            job.payload === ''
        ) {
            throw new Error(
                'Import Job does not contain file data.'
            );
        }
    }


    /**
     * ---------------------------------------------------------
     * JSON PARSING
     * ---------------------------------------------------------
     */

    /**
     * Parse JSON text.
     *
     * This function only parses JSON.
     * It does not import application data.
     *
     * @param {string} payload
     * @returns {*}
     */
    function parseJSON(payload) {

        if (typeof payload !== 'string') {
            throw new Error(
                'JSON payload must be a string.'
            );
        }

        try {

            return JSON.parse(payload);

        } catch (error) {

            const getErrorMessage =
                getGlobalFunction(
                    'getJsonParseErrorMessage'
                );

            if (getErrorMessage) {

                throw new Error(
                    getErrorMessage(error)
                );
            }

            throw new Error(
                `JSON Parse Error: ${error?.message || 'Invalid JSON'
                }`
            );
        }
    }


    /**
     * ---------------------------------------------------------
     * JSON SUMMARY
     * ---------------------------------------------------------
     */

    /**
     * Get a simple summary of parsed JSON.
     *
     * @param {*} data
     * @returns {Object}
     */
    function getJSONSummary(data) {

        if (Array.isArray(data)) {

            return {
                structure: 'array',
                recordCount: data.length
            };
        }

        if (
            data &&
            typeof data === 'object'
        ) {

            return {
                structure: 'object',
                keys: Object.keys(data),
                recordCount: 1
            };
        }

        return {
            structure: typeof data,
            recordCount: 1
        };
    }


    /**
     * ---------------------------------------------------------
     * IMPORT PAYLOAD
     * ---------------------------------------------------------
     *
     * This is the central import API.
     *
     * It receives raw JSON text and performs:
     *
     * 1. Text normalization
     * 2. JSON parsing
     * 3. Version validation
     * 4. Payload normalization
     * 5. Diagnostics
     * 6. Schema validation
     * 7. Application data mapping
     * 8. Structured result generation
     *
     * It does not perform UI operations.
     */

    async function importPayload(
        payload,
        options = {}
    ) {

        const {
            updateProgress,
            info,
            warning,
            error,
            fileName = 'import.json'
        } = options;


        /**
         * -----------------------------------------------------
         * 1. RAW TEXT NORMALIZATION
         * -----------------------------------------------------
         */

        const normalizeImportRawText =
            requireGlobalFunction(
                'normalizeImportRawText'
            );


        const text =
            normalizeImportRawText(
                payload
            );


        if (!text) {

            throw new Error(
                'Import file contains no data.'
            );
        }


        updateProgress?.({
            progress: 10
        });


        info?.(
            'Import text normalized.',
            {
                fileName,
                contentLength:
                    text.length
            }
        );


        /**
         * -----------------------------------------------------
         * 2. JSON PARSE
         * -----------------------------------------------------
         */

        let parsed;

        try {

            parsed =
                parseJSON(text);

        } catch (parseError) {

            error?.(
                'JSON parsing failed.',
                {
                    message:
                        parseError?.message ||
                        'Invalid JSON'
                }
            );

            throw parseError;
        }


        updateProgress?.({
            progress: 20
        });


        /**
         * -----------------------------------------------------
         * 3. VERSION VALIDATION
         * -----------------------------------------------------
         */

        const validateIncomingImportVersion =
            requireGlobalFunction(
                'validateIncomingImportVersion'
            );


        const incomingVersion =
            validateIncomingImportVersion(
                parsed &&
                    parsed.meta &&
                    Object.prototype.hasOwnProperty.call(
                        parsed.meta,
                        'version'
                    )
                    ? parsed.meta.version
                    : null
            );


        if (!incomingVersion.supported) {

            const errorMessage =
                `Unsupported Version: ${incomingVersion.display
                }`;


            error?.(
                'Import version validation failed.',
                {
                    version:
                        incomingVersion.display
                }
            );


            throw new Error(
                errorMessage
            );
        }


        info?.(
            'Import version validated.',
            {
                version:
                    incomingVersion.display,

                normalizedVersion:
                    incomingVersion.normalized
            }
        );


        updateProgress?.({
            progress: 30
        });


        /**
         * -----------------------------------------------------
         * 4. PAYLOAD NORMALIZATION
         * -----------------------------------------------------
         */

        const normalizeImportPayload =
            requireGlobalFunction(
                'normalizeImportPayload'
            );


        const normalizationResult =
            normalizeImportPayload(
                parsed
            );


        const normalizedParsed =
            normalizationResult.normalized;


        const normalizationReport =
            normalizationResult.report || {};


        if (
            Array.isArray(
                normalizationReport.warnings
            ) &&
            normalizationReport.warnings.length
        ) {

            normalizationReport.warnings.forEach(
                message => {

                    warning?.(
                        message,
                        {
                            source:
                                'normalization'
                        }
                    );
                }
            );
        }


        updateProgress?.({
            progress: 45
        });


        /**
         * -----------------------------------------------------
         * 5. IMPORT DIAGNOSTICS
         * -----------------------------------------------------
         */

        const buildImportDiagnostics =
            requireGlobalFunction(
                'buildImportDiagnostics'
            );


        const diagnostics =
            buildImportDiagnostics(
                normalizedParsed
            );


        const found = {

            expenses:
                Number(
                    diagnostics.expensesCount || 0
                ),

            savings:
                Number(
                    diagnostics.savingsCount || 0
                ),

            budgets:
                Number(
                    diagnostics.budgetsCount || 0
                ),

            budgetPeriods:
                Number(
                    diagnostics.budgetPeriodsCount || 0
                )
        };


        const totalRecords =
            found.expenses +
            found.savings +
            found.budgets +
            found.budgetPeriods;


        updateProgress?.({
            progress: 55,
            totalRecords
        });


        /**
         * -----------------------------------------------------
         * 6. SCHEMA VALIDATION
         * -----------------------------------------------------
         */

        const validateImportPayload =
            requireGlobalFunction(
                'validateImportPayload'
            );


        const validation =
            validateImportPayload(
                normalizedParsed
            );


        if (
            Array.isArray(
                validation.warnings
            ) &&
            validation.warnings.length
        ) {

            validation.warnings.forEach(
                message => {

                    warning?.(
                        message,
                        {
                            source:
                                'schema-validation'
                        }
                    );
                }
            );
        }


        if (
            Array.isArray(
                validation.errors
            ) &&
            validation.errors.length
        ) {

            validation.errors.forEach(
                message => {

                    error?.(
                        message,
                        {
                            source:
                                'schema-validation'
                        }
                    );
                }
            );


            throw new Error(
                validation.errors.join('; ')
            );
        }


        const data =
            validation.normalized;


        updateProgress?.({
            progress: 65
        });


        /**
         * -----------------------------------------------------
         * 7. APPLICATION DATA MAPPING
         * -----------------------------------------------------
         *
         * Validation is complete at this point.
         *
         * If applyData is explicitly false, stop here.
         *
         * This allows the same import pipeline to be used
         * for read-only validation / preview operations.
         */

        if (options.applyData === false) {

            return {
                success: true,

                version:
                    incomingVersion.display,

                found,

                imported: {},

                warnings:
                    Array.isArray(
                        normalizationReport.warnings
                    )
                        ? normalizationReport.warnings
                        : [],

                errors: [],

                normalization:
                    normalizationReport,

                totalRecords,

                processedRecords: 0,

                successCount: 0,

                warningCount:
                    Array.isArray(
                        normalizationReport.warnings
                    )
                        ? normalizationReport.warnings.length
                        : 0,

                errorCount: 0
            };
        }


        /**
         * -----------------------------------------------------
         * APPLICATION DATA MAPPING
         * -----------------------------------------------------
         */

        const applyImportData =
            requireGlobalFunction(
                'applyImportData'
            );


        const imported =
            applyImportData(
                data
            );


        /**
         * Count entities actually processed by the
         * application mapping layer.
         */

        const processedRecords =
            Object.values(
                imported || {}
            )
                .reduce(
                    (
                        total,
                        count
                    ) => {

                        return total +
                            (
                                Number(count) ||
                                0
                            );
                    },
                    0
                );


        updateProgress?.({

            progress: 90,

            totalRecords,

            processedRecords,

            successCount:
                processedRecords
        });


        /**
         * -----------------------------------------------------
         * 8. RESULT
         * -----------------------------------------------------
         */

        const warnings = [

            ...(
                Array.isArray(
                    validation.warnings
                )
                    ? validation.warnings
                    : []
            ),

            ...(
                Array.isArray(
                    normalizationReport.warnings
                )
                    ? normalizationReport.warnings
                    : []
            )
        ];


        const result = {

            success: true,

            version:
                validation.version ||
                incomingVersion.display ||
                'unknown',

            found,

            imported:
                imported || {},

            warnings,

            errors: [],

            normalization:
                normalizationReport,

            totalRecords,

            processedRecords,

            successCount:
                processedRecords,

            warningCount:
                warnings.length,

            errorCount: 0
        };


        info?.(
            'Import data mapped successfully.',
            {
                imported:
                    result.imported,

                processedRecords:
                    result.processedRecords,

                warningCount:
                    result.warningCount
            }
        );


        updateProgress?.({

            progress: 100,

            totalRecords:
                result.totalRecords,

            processedRecords:
                result.processedRecords,

            successCount:
                result.successCount,

            warningCount:
                result.warningCount,

            errorCount:
                result.errorCount
        });


        return result;
    }


    /**
     * ---------------------------------------------------------
     * VALIDATE PAYLOAD
     * ---------------------------------------------------------
     *
     * Performs the complete import validation pipeline without
     * modifying application storage.
     *
     * This is intentionally separate from importPayload().
     *
     * validatePayload()
     *     Parse
     *     ↓
     *     Version validation
     *     ↓
     *     Normalization
     *     ↓
     *     Diagnostics
     *     ↓
     *     Schema validation
     *     ↓
     *     Return validation result
     *
     * It does NOT call:
     *
     *     applyImportData()
     *
     * Therefore it is safe for:
     * - Preview
     * - Pre-flight validation
     * - Job validation
     * - "Validate before Run"
     */

    async function validatePayload(
        payload,
        options = {}
    ) {

        return importPayload(
            payload,
            {
                ...options,
                applyData: false
            }
        );
    }


    /**
     * ---------------------------------------------------------
     * JOB EXECUTION
     * ---------------------------------------------------------
     */

    async function execute(job) {

        validateJob(job);


        const handler =
            getHandler(
                job.type
            );


        if (!handler) {

            throw new Error(
                `No import handler registered for Job type: ${job.type
                }`
            );
        }


        JobLogger.info(
            job.id,
            'Import started.',
            {
                fileName:
                    job.fileName,

                type:
                    job.type
            }
        );


        try {

            const result =
                await handler({

                    job,


                    /**
                     * Report progress.
                     */

                    updateProgress:
                        data => {

                            JobQueue.updateProgress(
                                job.id,
                                data
                            );
                        },


                    /**
                     * Informational log.
                     */

                    info:
                        (
                            message,
                            details = {}
                        ) => {

                            JobLogger.info(
                                job.id,
                                message,
                                details
                            );
                        },


                    /**
                     * Warning log.
                     */

                    warning:
                        (
                            message,
                            details = {}
                        ) => {

                            JobLogger.warning(
                                job.id,
                                message,
                                details
                            );
                        },


                    /**
                     * Error log.
                     */

                    error:
                        (
                            message,
                            details = {}
                        ) => {

                            JobLogger.error(
                                job.id,
                                message,
                                details
                            );
                        }
                });


            const statistics =
                normalizeResult(
                    result
                );


            JobQueue.updateProgress(
                job.id,
                {

                    progress: 100,

                    totalRecords:
                        statistics.totalRecords,

                    processedRecords:
                        statistics.processedRecords,

                    successCount:
                        statistics.successCount,

                    warningCount:
                        statistics.warningCount,

                    errorCount:
                        statistics.errorCount
                }
            );


            JobLogger.info(
                job.id,
                'Import completed.',
                {
                    statistics
                }
            );


            return statistics;

        } catch (error) {

            JobLogger.error(
                job.id,
                'Import failed.',
                {
                    message:
                        error?.message ||
                        'Unknown error.',

                    stack:
                        error?.stack ||
                        null
                }
            );


            throw error;
        }
    }


    /**
     * ---------------------------------------------------------
     * RESULT NORMALIZATION
     * ---------------------------------------------------------
     */

    /**
     * Normalize handler results so every import type
     * returns the same statistics structure.
     *
     * @param {Object} result
     * @returns {Object}
     */

    function normalizeResult(
        result = {}
    ) {

        return {

            success:
                result.success !== false,

            version:
                result.version ||
                'unknown',

            found:
                result.found ||
                {},

            imported:
                result.imported ||
                {},

            warnings:
                Array.isArray(
                    result.warnings
                )
                    ? result.warnings
                    : [],

            errors:
                Array.isArray(
                    result.errors
                )
                    ? result.errors
                    : [],

            normalization:
                result.normalization ||
                {},

            totalRecords:
                Number(
                    result.totalRecords
                ) || 0,

            processedRecords:
                Number(
                    result.processedRecords
                ) || 0,

            successCount:
                Number(
                    result.successCount
                ) || 0,

            warningCount:
                Number(
                    result.warningCount
                ) || 0,

            errorCount:
                Number(
                    result.errorCount
                ) || 0
        };
    }


    /**
     * ---------------------------------------------------------
     * BUILT-IN JSON HANDLER
     * ---------------------------------------------------------
     *
     * JSON jobs use the same central importPayload()
     * implementation used by Manual Import.
     */

    registerHandler(
        TYPE.JSON_IMPORT,
        async context => {

            const {
                job,
                updateProgress,
                info,
                warning,
                error
            } = context;


            return importPayload(
                job.payload,
                {
                    fileName:
                        job.fileName,

                    updateProgress,

                    info,

                    warning,

                    error
                }
            );
        }
    );


    /**
     * ---------------------------------------------------------
     * CSV HANDLER PLACEHOLDER
     * ---------------------------------------------------------
     *
     * CSV support is intentionally not implemented yet.
     *
     * The Job Queue already understands CSV_IMPORT as a type,
     * but we do not want to pretend CSV importing exists until
     * its application-specific mapping has been designed.
     */


    /**
     * ---------------------------------------------------------
     * PUBLIC API
     * ---------------------------------------------------------
     */

    return {

        TYPE,

        registerHandler,

        hasHandler,

        getHandler,

        validateJob,

        parseJSON,

        getJSONSummary,

        validatePayload,

        importPayload,

        execute,

        normalizeResult
    };

})();