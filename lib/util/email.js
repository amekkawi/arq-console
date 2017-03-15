'use strict';

const clientUtil = require('./client');
const BackupResultIdentifier = require('../structs/BackupResultIdentifier');

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

	const identifier = clientUtil.parseBackupResultIdentifier(nameSplit[1], validProps);
	if (!identifier) {
		return null;
	}

	if (validProps) {
		if (validProps.prefix && validProps.prefix !== prefix) {
			return null;
		}

		if (validProps.domain && validProps.domain !== domain) {
			return null;
		}
	}

	return new EmailRecipient(
		emailAddress,
		prefix,
		identifier.backupType,
		identifier.clientId,
		identifier.clientKey,
		domain
	);
};

class EmailRecipient extends BackupResultIdentifier {
	constructor(original, prefix, backupType, clientId, clientKey, domain) {
		super(original, backupType, clientId, clientKey);
		this.prefix = prefix;
		this.domain = domain;
	}
}
exports.EmailRecipient = EmailRecipient;
