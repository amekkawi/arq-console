'use strict';

const Service = require('../Service');

/**
 * TODO
 *
 * @property {Services} services
 */
class StorageService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	/**
	 * Store raw content for a delivered backup result into storage.
	 *
	 * @param {string} backupId
	 * @param {*} content
	 * @returns {Promise}
	 */
	putBackupResultContent(backupId, content) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('StorageService#getBackupResultContent not implemented'));
	}

	/**
	 * Get the raw data for a received backup result.
	 *
	 * @param {string} backupId
	 * @returns {Promise.<Buffer>}
	 */
	getBackupResultContent(backupId) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('StorageService#getBackupResultContent not implemented'));
	}

	/**
	 * Transition a stored backup result to an "archived" state, indicating it has been ingested.
	 *
	 * @param {string} backupId
	 * @param {string} ingestId - Used to lookup logging related to the processing of the e-mail content.
	 * @returns {Promise}
	 */
	archiveBackupResultContent(backupId, ingestId) { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('StorageService#archiveBackupResultContent not implemented'));
	}

	/**
	 * Find stored backup results that have not been ingested and is older than the specified age.
	 *
	 * @param {string} deliveryType
	 * @param {number} minimumAge - Minimum number of seconds since content creation date.
	 * @returns {Promise.<OrphanedBackupResultContent[]>}
	 */
	findOrphanedBackupResultContent(deliveryType, minimumAge) { // eslint-disable-line no-unused-vars
		return Promise.reject(Error('StorageService#findOrphanedBackupResultContent not implemented'));
	}
}

const _deliveryType = Symbol('_deliveryType');
const _backupId = Symbol('_backupId');
const _createDate = Symbol('_createDate');

class OrphanedBackupResultContent {
	constructor(deliveryType, backupId, createDate) {
		this[_deliveryType] = deliveryType;
		this[_backupId] = backupId;
		this[_createDate] = createDate;
	}

	get deliveryType() {
		return this[_deliveryType];
	}

	get backupId() {
		return this[_backupId];
	}

	get createDate() {
		return this[_createDate];
	}
}

StorageService.OrphanedBackupResultContent = OrphanedBackupResultContent;

module.exports = StorageService;
