'use strict';

class AppError extends Error {

	/**
	 * @param {string} message
	 * @param {string|number} [code]
	 * @param {object} [meta]
	 */
	constructor(message, code, meta) {
		super();
		this.message = message;
		this.name = this.constructor.name;

		if (arguments.length === 2 && code !== null && typeof code === 'object') {
			meta = code;
			code = null;
		}

		if (typeof code === 'string' || typeof code === 'number') {
			this.code = code;
		}

		if (meta !== null && typeof meta === 'object') {
			Object.assign(this, meta);
		}

		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, this.constructor);
		}
		else {
			this.stack = (new Error(message)).stack;
		}
	}
}

class InvalidClientError extends AppError {
	constructor(message, code, clientId, meta) {
		super(message, code, meta);
		this.clientId = clientId;
	}
}

class InvalidBackupPayloadError extends AppError {
	constructor(message, code, ingestId, backupId, meta) {
		super(message, code, meta);
		this.ingestId = ingestId;
		this.backupId = backupId;
	}
}

class PayloadExtractError extends AppError {
	constructor(message) {
		super(message);
	}
}

exports.AppError = AppError;
exports.InvalidClientError = InvalidClientError;
exports.InvalidBackupPayloadError = InvalidBackupPayloadError;
exports.PayloadExtractError = PayloadExtractError;
