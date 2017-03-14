'use strict';

const validate = require('./validate');

/**
 * TODO
 *
 * @param {string[]} recipients
 * @param {object} [validProps]
 * @returns {EmailRecipient[]}
 */
exports.parseEmailRecipients = function(recipients, validProps) {
	return recipients
		.map((recipient) =>
			exports.parseEmailRecipient(recipient, validProps)
		)
		.filter(Boolean);
};

/**
 * TODO
 *
 * @param {string} emailAddress
 * @param {object} [validProps]
 * @returns {null|EmailRecipient}
 */
exports.parseEmailRecipient = function(emailAddress, validProps) {
	if (!emailAddress || typeof emailAddress !== 'string') {
		return null;
	}

	const atSplit = emailAddress.split('@');
	if (atSplit.length !== 2) {
		return null;
	}

	const domain = atSplit[1];

	const nameSplit = atSplit[0].split('+', 2);
	if (nameSplit.length !== 2) {
		return null;
	}

	const prefix = nameSplit[0];

	const idKeySplit = nameSplit[1].split('.', 3);
	if (idKeySplit.length !== 3) {
		return null;
	}

	const backupType = idKeySplit[0];
	const clientId = idKeySplit[1];
	const clientKey = idKeySplit[2];

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
		if (validProps.prefix && validProps.prefix !== prefix) {
			return null;
		}

		if (validProps.domain && validProps.domain !== domain) {
			return null;
		}

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

	return new EmailRecipient(
		emailAddress,
		prefix,
		backupType,
		clientId,
		clientKey,
		domain
	);
};

class EmailRecipient {
	constructor(original, prefix, backupType, clientId, clientKey, domain) {
		this.original = original;
		this.prefix = prefix;
		this.backupType = backupType;
		this.clientId = clientId;
		this.clientKey = clientKey;
		this.domain = domain;
	}
}
exports.EmailRecipient = EmailRecipient;
