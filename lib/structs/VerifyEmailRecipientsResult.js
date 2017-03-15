'use strict';

class VerifyEmailRecipientsResult {
	constructor(status, matching, nonMatching) {
		this.status = status;
		this.matching = matching;
		this.nonMatching = nonMatching;
	}
}

VerifyEmailRecipientsResult.NO_MATCHES = 'NO_MATCHES';
VerifyEmailRecipientsResult.CLIENT_KEY_MATCHED = 'CLIENT_KEY_MATCHED';
VerifyEmailRecipientsResult.CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND';
VerifyEmailRecipientsResult.CLIENT_KEY_MISMATCH = 'CLIENT_KEY_MISMATCH';

module.exports = VerifyEmailRecipientsResult;
