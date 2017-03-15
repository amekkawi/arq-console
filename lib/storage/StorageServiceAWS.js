'use strict';

const Readable = require('stream').Readable;
const StorageService = require('./StorageService');
const _s3 = Symbol('_s3');

/**
 * TODO
 *
 * @property {Services} services
 */
class StorageServiceAWS extends StorageService {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);

		this[_s3] = new services.engine.S3({
			apiVersion: '2006-03-01',
			region: this.services.config.AWS_REGION,
		});
	}

	putBackupResultContent(backupId, content) {
		const params = {
			Bucket: this.services.config.AWS_RESOURCE_ATTR['aws_s3_bucket.ReceivingStorageBucket.id'],
			Key: backupId,
			Body: content,
			ContentEncoding: 'application/octet-stream',
		};

		return this.services.logger.logApiCall(
			'putBackupResultContent S3 putObject',
			{ params },
			() => this[_s3].putObject(params).promise()
		);
	}

	getBackupResultContent(backupId) {
		const params = {
			Bucket: this.services.config.AWS_RESOURCE_ATTR['aws_s3_bucket.ReceivingStorageBucket.id'],
			Key: backupId,
		};

		return this.services.logger.logApiCall(
			'getBackupResultContent S3 getObject',
			{ params },
			() => this[_s3].getObject(params).promise()
		)
			.then((response) => {
				return responseBodyAsBuffer(response.Body);
			});
	}

	archiveBackupResultContent(backupId, ingestId) {
		// Tag object so we know it has been processed
		const params = {
			Bucket: this.services.config.AWS_RESOURCE_ATTR['aws_s3_bucket.ReceivingStorageBucket.id'],
			Key: backupId,
			Tagging: {
				TagSet: [
					{
						Key: `ingest-id`,
						Value: ingestId,
					},
					{
						Key: `ingest-date`,
						Value: new Date().toISOString(),
					},
				],
			},
		};

		return this.services.logger.logApiCall(
			'archiveBackupResultContent S3 putObjectTagging',
			{ params },
			() => this[_s3].putObjectTagging(params).promise()
		);
	}

	// TODO
	//findOrphanedBackupResultContent() {}
}

function responseBodyAsBuffer(responseBody) {
	return new Promise((resolve, reject) => {
		if (Buffer.isBuffer(responseBody)) {
			resolve(responseBody);
		}
		else if (responseBody instanceof Readable) {
			const chunks = [];

			responseBody.on('data', function(chunk) {
				chunks.push(chunk);
			});

			responseBody.on('error', function(err) {
				reject(err);
			});

			responseBody.on('end', function() {
				try {
					resolve(Buffer.concat(chunks));
				}
				catch (err) {
					reject(err);
				}
			});
		}
		else if (responseBody == null) {
			resolve(null);
		}
		else {
			resolve(Buffer.from(responseBody, 'utf8'));
		}
	});
}

function responseBodyToString(responseBody) {
	return new Promise((resolve, reject) => {
		if (Buffer.isBuffer(responseBody)) {
			resolve(responseBody.toString('utf8'));
		}
		else if (responseBody instanceof Readable) {
			const chunks = [];

			responseBody.on('data', function(chunk) {
				chunks.push(chunk);
			});

			responseBody.on('error', function(err) {
				reject(err);
			});

			responseBody.on('end', function() {
				try {
					resolve(Buffer.concat(chunks).toString('utf8'));
				}
				catch (err) {
					reject(err);
				}
			});
		}
		else if (responseBody == null) {
			resolve(null);
		}
		else {
			resolve(String(responseBody));
		}
	});
}

StorageServiceAWS.responseBodyAsBuffer = responseBodyAsBuffer;
StorageServiceAWS.responseBodyToString = responseBodyToString;

module.exports = StorageServiceAWS;
