/**
 * MyMoneyTracker - Job Storage
 *
 * Responsible only for persisting and retrieving Job Queue data.
 *
 * This module does NOT:
 * - Execute jobs
 * - Import files
 * - Render UI
 * - Write job logs
 *
 * It provides the persistence layer for the Job Queue system.
 */

const JOB_STORAGE_KEY = 'myMoneyTracker_jobQueue';

const JobStorage = (() => {

    /**
     * Read all stored jobs.
     *
     * @returns {Array}
     */
    function getJobs() {
        try {
            const storedJobs = localStorage.getItem(JOB_STORAGE_KEY);

            if (!storedJobs) {
                return [];
            }

            const jobs = JSON.parse(storedJobs);

            return Array.isArray(jobs) ? jobs : [];
        } catch (error) {
            console.error('JobStorage: Failed to read jobs.', error);
            return [];
        }
    }

    /**
     * Save all jobs.
     *
     * @param {Array} jobs
     */
    function saveJobs(jobs) {
        if (!Array.isArray(jobs)) {
            throw new Error('JobStorage.saveJobs expects an array.');
        }

        localStorage.setItem(
            JOB_STORAGE_KEY,
            JSON.stringify(jobs)
        );
    }

    /**
     * Add a new job.
     *
     * @param {Object} job
     * @returns {Object}
     */
    function addJob(job) {
        if (!job || typeof job !== 'object') {
            throw new Error('JobStorage.addJob expects a job object.');
        }

        const jobs = getJobs();

        jobs.push(job);

        saveJobs(jobs);

        return job;
    }

    /**
     * Find a job by ID.
     *
     * @param {string} jobId
     * @returns {Object|null}
     */
    function getJob(jobId) {
        const jobs = getJobs();

        return jobs.find(job => job.id === jobId) || null;
    }

    /**
     * Update an existing job.
     *
     * @param {string} jobId
     * @param {Object} updates
     * @returns {Object|null}
     */
    function updateJob(jobId, updates) {
        const jobs = getJobs();

        const index = jobs.findIndex(job => job.id === jobId);

        if (index === -1) {
            return null;
        }

        jobs[index] = {
            ...jobs[index],
            ...updates
        };

        saveJobs(jobs);

        return jobs[index];
    }

    /**
     * Delete a job.
     *
     * @param {string} jobId
     * @returns {boolean}
     */
    function deleteJob(jobId) {
        const jobs = getJobs();

        const filteredJobs = jobs.filter(job => job.id !== jobId);

        if (filteredJobs.length === jobs.length) {
            return false;
        }

        saveJobs(filteredJobs);

        return true;
    }

    /**
     * Remove all jobs.
     *
     * Intended mainly for development/testing.
     */
    function clearJobs() {
        localStorage.removeItem(JOB_STORAGE_KEY);
    }

    return {
        getJobs,
        saveJobs,
        addJob,
        getJob,
        updateJob,
        deleteJob,
        clearJobs
    };

})();