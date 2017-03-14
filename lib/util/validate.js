'use strict';

exports.backupTypeRegEx = /^(?=[a-z])[a-z0-9_-]{0,9}[a-z0-9]$/;
exports.clientIdRegEx = /^(?=[A-Za-z0-9])[A-Za-z0-9_-]{2,49}[A-Za-z0-9]$/;
exports.clientKeyRegEx = /^[A-Za-z0-9]{3,50}$/;

exports.isValidBackupType = function(backupType) {
	return typeof backupType === 'string' && backupType.length > 0 && !!backupType.match(exports.backupTypeRegEx);
};

exports.isValidClientId = function(clientId) {
	return typeof clientId === 'string' && clientId.length > 0 && !!clientId.match(exports.clientIdRegEx);
};

exports.isValidClientKey = function(clientKey) {
	return typeof clientKey === 'string' && clientKey.length > 0 && !!clientKey.match(exports.clientKeyRegEx);
};
