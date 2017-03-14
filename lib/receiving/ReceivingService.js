'use strict';

const emailUtil = require('../util/email');
const PromiseTry = require('../util/promise').PromiseTry;
const Service = require('../Service');

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
}

class VerifyEmailRecipientsResult {
	constructor(status, matching, nonMatching) {
		this.status = status;
		this.matching = matching;
		this.nonMatching = nonMatching;
	}
}

ReceivingService.VerifyEmailRecipientsResult = VerifyEmailRecipientsResult;

VerifyEmailRecipientsResult.NO_MATCHES = 'NO_MATCHES';
VerifyEmailRecipientsResult.CLIENT_KEY_MATCHED = 'CLIENT_KEY_MATCHED';
VerifyEmailRecipientsResult.CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND';
VerifyEmailRecipientsResult.CLIENT_KEY_MISMATCH = 'CLIENT_KEY_MISMATCH';

module.exports = ReceivingService;

