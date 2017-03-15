'use strict';

class VerifyIdentifierResult {
	constructor(status, identifier) {
		this.status = status;
		this.identifier = identifier;
	}
}

VerifyIdentifierResult.INVALID_IDENTIFIER = 'INVALID_IDENTIFIER';
VerifyIdentifierResult.CLIENT_KEY_MATCHED = 'CLIENT_KEY_MATCHED';
VerifyIdentifierResult.CLIENT_NOT_FOUND = 'CLIENT_NOT_FOUND';
VerifyIdentifierResult.CLIENT_KEY_MISMATCH = 'CLIENT_KEY_MISMATCH';

module.exports = VerifyIdentifierResult;
