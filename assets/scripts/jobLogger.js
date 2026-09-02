/**
 * MyMoneyTracker - Job Logger
 *
 * Responsible for creating and retrieving logs for Jobs.
 *
 * This module does NOT:
 * - Execute Jobs
 * - Import data
 * - Render UI
 * - Change Job status
 *
 * It only manages Job Log entries.
 */

const JobLogger = (() => {

    const LOG_STORAGE_KEY = 'myMoneyTracker_jobLogs';

    const LEVEL = {
        INFO: 'INFO',
        WARNING: 'WARNING',
        ERROR: 'ERROR'
    };

    /**
     * Get all stored logs.
     *
     * @returns {Array}
     */
    function getAllLogs() {
        try {
            const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);

            if (!storedLogs) {
                return [];
            }

            const logs = JSON.parse(storedLogs);

            return Array.isArray(logs) ? logs : [];
        } catch (error) {
            console.error(
                'JobLogger: Failed to read logs.',
                error
            );

            return [];
        }
    }

    /**
     * Save all logs.
     *
     * @param {Array} logs
     */
    function saveLogs(logs) {

        if (!Array.isArray(logs)) {
            throw new Error(
                'JobLogger.saveLogs expects an array.'
            );
        }

        localStorage.setItem(
            LOG_STORAGE_KEY,
            JSON.stringify(logs)
        );
    }

    /**
     * Create a new log entry.
     *
     * @param {string} jobId
     * @param {string} level
     * @param {string} message
     * @param {Object} details
     * @returns {Object}
     */
    function log(jobId, level, message, details = {}) {

        if (!jobId) {
            throw new Error(
                'JobLogger.log requires a Job ID.'
            );
        }

        if (!Object.values(LEVEL).includes(level)) {
            throw new Error(
                `Invalid log level: ${level}`
            );
        }

        if (!message) {
            throw new Error(
                'JobLogger.log requires a message.'
            );
        }

        const logEntry = {
            id: generateLogId(),

            jobId,

            timestamp: new Date().toISOString(),

            level,

            message,

            details: {
                ...details
            }
        };

        const logs = getAllLogs();

        logs.push(logEntry);

        saveLogs(logs);

        return logEntry;
    }

    /**
     * Create an INFO log.
     *
     * @param {string} jobId
     * @param {string} message
     * @param {Object} details
     * @returns {Object}
     */
    function info(jobId, message, details = {}) {
        return log(
            jobId,
            LEVEL.INFO,
            message,
            details
        );
    }

    /**
     * Create a WARNING log.
     *
     * @param {string} jobId
     * @param {string} message
     * @param {Object} details
     * @returns {Object}
     */
    function warning(jobId, message, details = {}) {
        return log(
            jobId,
            LEVEL.WARNING,
            message,
            details
        );
    }

    /**
     * Create an ERROR log.
     *
     * @param {string} jobId
     * @param {string} message
     * @param {Object} details
     * @returns {Object}
     */
    function error(jobId, message, details = {}) {
        return log(
            jobId,
            LEVEL.ERROR,
            message,
            details
        );
    }

    /**
     * Get logs belonging to a specific Job.
     *
     * @param {string} jobId
     * @returns {Array}
     */
    function getLogs(jobId) {

        if (!jobId) {
            return [];
        }

        return getAllLogs()
            .filter(logEntry => logEntry.jobId === jobId)
            .sort((a, b) => {
                return new Date(a.timestamp) -
                    new Date(b.timestamp);
            });
    }

    /**
     * Get the latest log for a Job.
     *
     * @param {string} jobId
     * @returns {Object|null}
     */
    function getLatestLog(jobId) {

        const logs = getLogs(jobId);

        if (logs.length === 0) {
            return null;
        }

        return logs[logs.length - 1];
    }

    /**
     * Get the number of logs for a Job.
     *
     * @param {string} jobId
     * @returns {number}
     */
    function getLogCount(jobId) {
        return getLogs(jobId).length;
    }

    /**
     * Delete all logs belonging to a Job.
     *
     * This should normally be called when a Job itself
     * is permanently deleted.
     *
     * @param {string} jobId
     * @returns {number}
     */
    function deleteJobLogs(jobId) {

        const logs = getAllLogs();

        const remainingLogs = logs.filter(
            logEntry => logEntry.jobId !== jobId
        );

        const deletedCount =
            logs.length - remainingLogs.length;

        if (deletedCount > 0) {
            saveLogs(remainingLogs);
        }

        return deletedCount;
    }

    /**
     * Clear every Job Log.
     *
     * Intended mainly for development/testing.
     */
    function clearLogs() {
        localStorage.removeItem(LOG_STORAGE_KEY);
    }

    /**
     * Generate a unique Log ID.
     *
     * @returns {string}
     */
    function generateLogId() {

        return `LOG-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 8)
            .toUpperCase()}`;
    }

    return {
        LEVEL,

        getAllLogs,

        log,
        info,
        warning,
        error,

        getLogs,
        getLatestLog,
        getLogCount,

        deleteJobLogs,
        clearLogs
    };

})();