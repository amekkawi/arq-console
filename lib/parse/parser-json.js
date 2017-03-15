'use strict';

const hasOwnProp = Object.prototype.hasOwnProperty;

exports.extractHTTPPostMetrics = function(services, contentBuffer) {
	return services.parse.parseJSONContent(contentBuffer)
		.then((json) => {
			if (typeof json.body !== 'string') {
				throw new Error('Expected "body" to be a string');
			}

			try {
				json.body = JSON.parse(
					json.isBase64
						? new Buffer(json.body, 'base64').toString('utf8')
						: json.body
				);
			}
			catch (err) {
				throw new Error(`Invalid JSON (${err.message})`);
			}

			if (!json.body || typeof json.body !== 'object') {
				throw new Error(`Invalid JSON (non-object)`);
			}

			return json;
		})
		.then((json) => {
			const result = {
				backupDate: json.receivedDate,
				duration: 0,
				totalBytes: 0,
				totalItems: 0,
				errorCount: 0,
				errorMessages: [],
			};

			if (hasOwnProp.call(json.body, 'backupDate')) {
				if (Number.isNaN(Date.parse(json.body.backupDate))) {
					throw new Error(`Invalid "backupDate": ${JSON.stringify(json.body.backupDate)}`);
				}
				result.backupDate = json.body.backupDate;
			}

			['duration', 'totalBytes', 'totalItems', 'errorCount'].forEach((prop) => {
				if (hasOwnProp.call(json.body, prop)) {
					if (typeof json.body[prop] !== 'number' || !isFinite(json.body[prop])) {
						throw new Error(`Expected "${prop}" to be a number: ${JSON.stringify(json.body[prop])}`);
					}

					if (json.body[prop] < 0) {
						throw new Error(`Expected "${prop}" to be a positive number: ${JSON.stringify(json.body[prop])}`);
					}

					if (json.body[prop] % 1 !== 0) {
						throw new Error(`Expected "${prop}" to be a whole number: ${JSON.stringify(json.body[prop])}`);
					}

					result[prop] = json.body[prop];
				}
			});

			if (hasOwnProp.call(json.body, 'errorMessages')) {
				if (!Array.isArray(json.body.errorMessages)) {
					throw new Error(`Expected "errorMessages" to be an array`);
				}

				json.body.errorMessages.forEach((message) => {
					if (typeof message !== 'string') {
						throw new Error(`Expected "errorMessages" to only have strings`);
					}
				});

				result.errorMessages = json.body.errorMessages;
			}

			return result;
		});
};
