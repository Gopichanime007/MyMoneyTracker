/**
 * MyMoneyTracker - Job Runner
 *
 * Responsible for executing queued Jobs.
 *
 * Flow:
 *
 * Queued
 *   ↓
 * Running
 *   ↓
 * ImportEngine
 *   ↓
 * Completed / Failed
 *
 * This module does NOT:
 * - Render UI
 * - Parse JSON/CSV itself
 * - Contain application-specific import logic
 *
 * It coordinates JobQueue and ImportEngine.
 */

const JobRunner = (() => {

    let isRunning = false;

    /**
     * Get the next queued Job.
     *
     * Jobs are processed in creation order.
     *
     * @returns {Object|null}
     */
    function getNextQueuedJob() {

        const jobs = JobQueue.getJobs();

        const queuedJobs = jobs
            .filter(job =>
                job.status === JobQueue.STATUS.QUEUED
            )
            .sort((a, b) => {
                return new Date(a.createdAt) -
                    new Date(b.createdAt);
            });

        return queuedJobs.length > 0
            ? queuedJobs[0]
            : null;
    }

    /**
     * Execute a single Job.
     *
     * @param {Object} job
     * @returns {Promise<Object>}
     */
    async function executeJob(job) {

        if (!job) {
            throw new Error(
                'JobRunner.executeJob requires a Job.'
            );
        }

        JobQueue.startJob(job.id);

        JobLogger.info(
            job.id,
            'Job started.',
            {
                jobName: job.name,
                jobType: job.type,
                fileName: job.fileName
            }
        );

        try {

            /*
             * ImportEngine is responsible for:
             *
             * - Validating the Job
             * - Selecting the correct handler
             * - Processing the import
             * - Updating progress
             * - Writing import logs
             */
            const statistics =
                await ImportEngine.execute(job);

            const completedJob =
                JobQueue.completeJob(
                    job.id,
                    {
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
                'Job completed successfully.',
                {
                    statistics
                }
            );

            return completedJob;

        } catch (error) {

            const errorMessage =
                error?.message ||
                'Job execution failed.';

            const failedJob =
                JobQueue.failJob(
                    job.id,
                    errorMessage
                );

            JobLogger.error(
                job.id,
                'Job execution failed.',
                {
                    message: errorMessage,
                    stack: error?.stack || null
                }
            );

            console.error(
                `JobRunner: Job ${job.id} failed.`,
                error
            );

            return failedJob;
        }
    }

    /**
     * Start processing the next queued Job.
     *
     * Only one Job is executed at a time.
     *
     * @returns {Promise<Object|null>}
     */
    async function runNext() {

        if (isRunning) {
            return null;
        }

        const job = getNextQueuedJob();

        if (!job) {
            return null;
        }

        isRunning = true;

        try {

            return await executeJob(job);

        } finally {

            isRunning = false;
        }
    }

    /**
     * Process all currently queued Jobs sequentially.
     *
     * @returns {Promise<Array>}
     */
    async function runAll() {

        if (isRunning) {
            return [];
        }

        const completedJobs = [];

        while (true) {

            const job = getNextQueuedJob();

            if (!job) {
                break;
            }

            const result = await runNext();

            if (result) {
                completedJobs.push(result);
            }
        }

        return completedJobs;
    }

    /**
     * Check whether the Runner is currently executing.
     *
     * @returns {boolean}
     */
    function isExecuting() {
        return isRunning;
    }

    return {
        runNext,
        runAll,
        isExecuting
    };

})();