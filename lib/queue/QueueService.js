'use strict';

const Service = require('../Service');

/**
 * TODO
 *
 * @property {Services} services
 */
class QueueService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	/**
	 * Get the approximate number of backup results available in the receiving queue.
	 *
	 * @abstract
	 * @returns {Promise.<number>}
	 */
	getAvailableReceivedBackupResults() {
		return Promise.reject(new Error('QueueService#getAvailableReceivedBackupResults not implemented'));
	}

	/**
	 * Queue backup results into the receiving queue.
	 *
	 * @abstract
	 * @param {BackupResultIdentifier} identifier
	 * @param {string} backupId
	 * @returns {Promise}
	 */
	queueReceivedBackupResults(identifier, backupId) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('QueueService#queueReceivedBackupResults not implemented'));
	}

	/**
	 * Dequeue up to the specified number of backup results from the receiving queue.
	 *
	 * @abstract
	 * @param {number} maxDequeue
	 * @returns {Promise.<(string|object)[]>}
	 */
	dequeueReceivedBackupResults(maxDequeue) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('QueueService#dequeueReceivedBackupResults not implemented'));
	}

	/**
	 * Called when a dequeued backup result was successfully ingested, allowing for cleanup.
	 *
	 * This is needed by queues that require confirmation (i.e. AWS SQS) so the item isn't
	 * added back to the queue after a timeout.
	 *
	 * @abstract
	 * @param {string|object} queueMessage
	 * @returns {Promise}
	 */
	resolveReceivedBackupResult(queueMessage) { // eslint-disable-line no-unused-vars
		return Promise.resolve();
	}
}

module.exports = QueueService;
