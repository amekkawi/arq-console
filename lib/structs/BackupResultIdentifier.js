'use strict';

class BackupResultIdentifier {
	constructor(original, backupType, clientId, clientKey) {
		this.original = original;
		this.backupType = backupType;
		this.clientId = clientId;
		this.clientKey = clientKey;
	}
}

module.exports = BackupResultIdentifier;
