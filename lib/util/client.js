'use strict';

const validate = require('./validate');
const BackupResultIdentifier = require('../structs/BackupResultIdentifier');

/**
 * TODO
 *
 * @param {string} identifier
 * @param {object} [validProps]
 * @returns {null|BackupResultIdentifier}
 */
exports.parseBackupResultIdentifier = function(identifier, validProps) {
	if (!identifier || typeof identifier !== 'string') {
		return null;
	}

	const split = identifier.split('.', 3);
	if (split.length !== 3) {
		return null;
	}

	const backupType = split[0];
	const clientId = split[1];
	const clientKey = split[2];

	if (!validate.isValidBackupType(backupType)) {
		return null;
	}

	if (!validate.isValidClientId(clientId)) {
		return null;
	}

	if (!validate.isValidClientKey(clientKey)) {
		return null;
	}

	if (validProps) {
		if (validProps.backupType && validProps.backupType !== backupType) {
			return null;
		}

		if (validProps.clientId && validProps.clientId !== clientId) {
			return null;
		}

		if (validProps.clientKey && validProps.clientKey !== clientKey) {
			return null;
		}
	}

	return new BackupResultIdentifier(
		identifier,
		backupType,
		clientId,
		clientKey
	);
};
