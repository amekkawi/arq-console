'use strict';

const Service = require('../Service');

/**
 * TODO
 *
 * @property {Services} services
 */
class DBService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	/**
	 * TODO
	 *
	 * @abstract
	 * @param {number} clientId
	 * @param {object} [options]
	 * @param {string[]} [options.attributes]
	 * @returns {Promise.<object>}
	 */
	getClient(clientId, options) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('DBService#getClient not implemented'));
	}

	/**
	 * TODO
	 *
	 * @param {number} clientId
	 * @param {string} clientKey
	 * @returns {Promise.<string>} Resolves to "NOT_FOUND", "MATCH" or "KEY_MISMATCH"
	 */
	verifyClient(clientId, clientKey) {
		return this.getClient(clientId, {
			attributes: [
				'clientId',
				'clientKey',
			],
		})
			.then((clientDoc) => {
				if (!clientDoc) {
					return 'NOT_FOUND';
				}
				else if (clientDoc.clientKey === clientKey) {
					return 'MATCH';
				}
				else {
					return 'KEY_MISMATCH';
				}
			});
	}

	/**
	 * TODO
	 *
	 * @abstract
	 * @param {BackupResultMeta} backupResultMeta
	 * @param {BackupResultMetrics} backupResultMetrics
	 * @returns {Promise}
	 */
	addBackupResult(backupResultMeta, backupResultMetrics) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('DBService#addBackupResult not implemented'));
	}

	/**
	 * TODO
	 *
	 * @abstract
	 * @param {string} clientId
	 * @param {BackupResultMetrics[]} backupResultMetricsBatch
	 * @returns {Promise}
	 */
	incrementBackupResultMetrics(clientId, backupResultMetricsBatch) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('DBService#incrementBackupResultMetrics not implemented'));
	}
}

module.exports = DBService;
