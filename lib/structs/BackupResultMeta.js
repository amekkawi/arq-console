'use strict';

/**
 * TODO
 *
 * @property {string} deliveryType
 * @property {string} clientId
 * @property {string} backupType
 * @property {string} backupId
 */
class BackupResultMeta {

	/**
	 * @param {string} deliveryType
	 * @param {string} clientId
	 * @param {string} clientKey
	 * @param {string} backupType
	 * @param {string} backupId
	 */
	constructor(deliveryType, clientId, clientKey, backupType, backupId) {
		this.deliveryType = deliveryType;
		this.clientId = clientId;
		this.clientKey = clientKey;
		this.backupType = backupType;
		this.backupId = backupId;
	}
}

module.exports = BackupResultMeta;
