/**
 * MyMoneyTracker - Job Queue
 *
 * Responsible for creating and managing jobs.
 *
 * This module does NOT:
 * - Execute jobs
 * - Import files
 * - Render UI
 * - Handle job logs
 *
 * It manages the Job lifecycle and delegates persistence
 * to JobStorage.
 */

const JobQueue = (() => {

    const STATUS = {
        QUEUED: 'Queued',
        RUNNING: 'Running',
        COMPLETED: 'Completed',
        FAILED: 'Failed',
        CANCELLED: 'Cancelled'
    };

    const TYPE = {
        JSON_IMPORT: 'JSON_IMPORT',
        CSV_IMPORT: 'CSV_IMPORT'
    };

    /**
     * Generate a unique Job ID.
     *
     * @returns {string}
     */
    function generateJobId() {
        return `JOB-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;
    }

    /**
     * Create a new Job.
     *
     * @param {Object} options
     * @returns {Object}
     */
    function createJob(options = {}) {
        const {
            name = 'Untitled Job',
            type,
            fileName = '',
            payload = ''
        } = options;

        if (!type) {
            throw new Error('Job type is required.');
        }

        if (!Object.values(TYPE).includes(type)) {
            throw new Error(`Unsupported job type: ${type}`);
        }

        const now = new Date().toISOString();

        const job = {
            id: generateJobId(),

            name,
            type,

            status: STATUS.QUEUED,

            fileName,
            payload,

            createdAt: now,
            startedAt: null,
            completedAt: null,

            progress: 0,

            totalRecords: 0,
            processedRecords: 0,

            successCount: 0,
            warningCount: 0,
            errorCount: 0,

            errorMessage: null
        };

        JobStorage.addJob(job);

        return job;
    }

    /**
     * Get all Jobs.
     *
     * @returns {Array}
     */
    function getJobs() {
        return JobStorage.getJobs();
    }

    /**
     * Get a Job by ID.
     *
     * @param {string} jobId
     * @returns {Object|null}
     */
    function getJob(jobId) {
        return JobStorage.getJob(jobId);
    }

    /**
     * Update Job status.
     *
     * @param {string} jobId
     * @param {string} status
     * @param {Object} additionalUpdates
     * @returns {Object|null}
     */
    function updateStatus(jobId, status, additionalUpdates = {}) {
        if (!Object.values(STATUS).includes(status)) {
            throw new Error(`Invalid job status: ${status}`);
        }

        return JobStorage.updateJob(jobId, {
            status,
            ...additionalUpdates
        });
    }

    /**
     * Mark a Job as Running.
     *
     * @param {string} jobId
     * @returns {Object|null}
     */
    function startJob(jobId) {
        return updateStatus(jobId, STATUS.RUNNING, {
            startedAt: new Date().toISOString(),
            errorMessage: null
        });
    }

    /**
     * Mark a Job as Completed.
     *
     * @param {string} jobId
     * @param {Object} additionalUpdates
     * @returns {Object|null}
     */
    function completeJob(jobId, additionalUpdates = {}) {
        return updateStatus(jobId, STATUS.COMPLETED, {
            progress: 100,
            completedAt: new Date().toISOString(),
            ...additionalUpdates
        });
    }

    /**
     * Mark a Job as Failed.
     *
     * @param {string} jobId
     * @param {string} errorMessage
     * @param {Object} additionalUpdates
     * @returns {Object|null}
     */
    function failJob(jobId, errorMessage, additionalUpdates = {}) {
        return updateStatus(jobId, STATUS.FAILED, {
            completedAt: new Date().toISOString(),
            errorMessage: errorMessage || 'Unknown error.',
            ...additionalUpdates
        });
    }

    /**
     * Cancel a queued Job.
     *
     * Running Jobs should not be cancelled through this method yet.
     * Cancellation handling will be implemented by the Job Runner.
     *
     * @param {string} jobId
     * @returns {Object|null}
     */
    function cancelJob(jobId) {
        const job = getJob(jobId);

        if (!job) {
            return null;
        }

        if (job.status !== STATUS.QUEUED) {
            throw new Error(
                `Only queued jobs can be cancelled. Current status: ${job.status}`
            );
        }

        return updateStatus(jobId, STATUS.CANCELLED, {
            completedAt: new Date().toISOString()
        });
    }

    /**
     * Delete a Job.
     *
     * Running Jobs cannot be deleted.
     *
     * @param {string} jobId
     * @returns {boolean}
     */
    function deleteJob(jobId) {
        const job = getJob(jobId);

        if (!job) {
            return false;
        }

        if (job.status === STATUS.RUNNING) {
            throw new Error(
                'Running jobs cannot be deleted.'
            );
        }

        return JobStorage.deleteJob(jobId);
    }

    /**
     * Update Job progress and counters.
     *
     * @param {string} jobId
     * @param {Object} progressData
     * @returns {Object|null}
     */
    function updateProgress(jobId, progressData = {}) {
        const job = getJob(jobId);

        if (!job) {
            return null;
        }

        const {
            progress,
            totalRecords,
            processedRecords,
            successCount,
            warningCount,
            errorCount
        } = progressData;

        const updates = {};

        if (progress !== undefined) {
            updates.progress = Math.max(
                0,
                Math.min(100, progress)
            );
        }

        if (totalRecords !== undefined) {
            updates.totalRecords = totalRecords;
        }

        if (processedRecords !== undefined) {
            updates.processedRecords = processedRecords;
        }

        if (successCount !== undefined) {
            updates.successCount = successCount;
        }

        if (warningCount !== undefined) {
            updates.warningCount = warningCount;
        }

        if (errorCount !== undefined) {
            updates.errorCount = errorCount;
        }

        return JobStorage.updateJob(jobId, updates);
    }

    return {
        STATUS,
        TYPE,

        createJob,
        getJobs,
        getJob,

        updateStatus,
        startJob,
        completeJob,
        failJob,
        cancelJob,
        deleteJob,

        updateProgress
    };

})();