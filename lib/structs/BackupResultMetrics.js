'use strict';

/**
 * TODO
 *
 * @property {string} backupDate
 * @property {number} duration
 * @property {number} totalItems
 * @property {number} totalBytes
 * @property {number} errorCount
 * @property {string[]} errorMessages
 */
class BackupResultMetrics {

	/**
	 * @param {object} metrics
	 * @param {string} metrics.backupDate
	 * @param {number} [metrics.duration=0]
	 * @param {number} [metrics.totalItems=0]
	 * @param {number} [metrics.totalBytes=0]
	 * @param {number} [metrics.errorCount=0]
	 * @param {string[]} [metrics.errorMessages]
	 */
	constructor(metrics) {
		this.backupDate = metrics.backupDate;
		this.duration = metrics.duration || 0;
		this.totalItems = metrics.totalItems || 0;
		this.totalBytes = metrics.totalBytes || 0;
		this.errorCount = metrics.errorCount || 0;

		if (metrics.errorMessages && metrics.errorMessages.length) {
			this.errorMessages = metrics.errorMessages;
		}
	}
}

module.exports = BackupResultMetrics;
