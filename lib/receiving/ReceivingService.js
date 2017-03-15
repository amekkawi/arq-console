'use strict';

const emailUtil = require('../util/email');
const clientUtil = require('../util/client');
const PromiseTry = require('../util/promise').PromiseTry;
const Service = require('../Service');
const VerifyEmailRecipientsResult = require('../structs/VerifyEmailRecipientsResult');
const VerifyIdentifierResult = require('../structs/VerifyIdentifierResult');

/**
 * TODO
 *
 * @property {Services} services
 */
class ReceivingService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	/**
	 * Verify that the list of recipients contains at least one valid e-mail
	 * address, and that the first valid e-mail address has a client ID and
	 * key that are in the DB.
	 *
	 * @param {string[]} recipients
	 * @returns {Promise.<VerifyEmailRecipientsResult>}
	 */
	verifyEmailRecipients(recipients) {
		return PromiseTry(() => {
			const validProps = {
				prefix: this.services.config.RECEIVING_EMAIL_PREFIX,
				domain: this.services.config.RECEIVING_EMAIL_DOMAIN,
			};

			const matching = [];
			const nonMatching = [];

			for (const recipient of recipients) {
				const parsed = emailUtil.parseEmailRecipient(recipient, validProps);
				if (parsed) {
					matching.push(parsed);
				}
				else {
					nonMatching.push(recipient);
				}
			}

			if (!matching.length) {
				return new VerifyEmailRecipientsResult(
					VerifyEmailRecipientsResult.NO_MATCHES,
					matching,
					nonMatching
				);
			}
			else {
				const clientId = matching[0].clientId;
				const clientKey = matching[0].clientKey;

				return this.services.db.verifyClient(clientId, clientKey)
					.then((result) => {
						if (result === 'MATCH') {
							return new VerifyEmailRecipientsResult(
								VerifyEmailRecipientsResult.CLIENT_KEY_MATCHED,
								matching,
								nonMatching
							);
						}
						else if (result === 'NOT_FOUND') {
							return new VerifyEmailRecipientsResult(
								VerifyEmailRecipientsResult.CLIENT_NOT_FOUND,
								matching,
								nonMatching
							);
						}
						else {
							return new VerifyEmailRecipientsResult(
								VerifyEmailRecipientsResult.CLIENT_KEY_MISMATCH,
								matching,
								nonMatching
							);
						}
					});
			}
		});
	}

	/**
	 * Verify that the identifier string is valid and that the
	 * client ID and key match a client record in the DB.
	 *
	 * @param {string} identifier
	 * @returns {VerifyIdentifierResult}
	 */
	verifyBackupResultIdentifier(identifier) {
		return PromiseTry(() => {
			const parsedIdentifier = clientUtil.parseBackupResultIdentifier(identifier);
			if (!parsedIdentifier) {
				return new VerifyIdentifierResult(
					VerifyIdentifierResult.INVALID_IDENTIFIER,
					null
				);
			}

			return this.services.db.verifyClient(
				parsedIdentifier.clientId,
				parsedIdentifier.clientKey
			)
				.then((result) => {
					if (result === 'MATCH') {
						return new VerifyIdentifierResult(
							VerifyIdentifierResult.CLIENT_KEY_MATCHED,
							parsedIdentifier
						);
					}
					else if (result === 'NOT_FOUND') {
						return new VerifyIdentifierResult(
							VerifyIdentifierResult.CLIENT_NOT_FOUND,
							parsedIdentifier
						);
					}
					else {
						return new VerifyIdentifierResult(
							VerifyIdentifierResult.CLIENT_KEY_MISMATCH,
							parsedIdentifier
						);
					}
				});
		});
	}

	/**
	 * Store and queue a backup result that has been received.
	 *
	 * @param {BackupResultIdentifier} identifier
	 * @param {string} backupId
	 * @param {string|Buffer} body
	 * @returns {Promise}
	 */
	receiveBackupResult(identifier, backupId, body) {
		return this.services.storage.putBackupResultContent(
			backupId,
			JSON.stringify({
				type: 'BackupResult',
				receivedDate: new Date().toISOString(),
				identifier,
				isBase64: Buffer.isBuffer(body),
				body: Buffer.isBuffer(body)
					? body.toString('base64')
					: body,
			})
		)
			.then(() => {
				return this.services.queue.queueReceivedBackupResults(identifier, backupId);
			});
	}
}

module.exports = ReceivingService;

