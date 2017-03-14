'use strict';

// eslint-disable-next-line no-console
console.log(`Loaded ${__filename} at ${new Date().toISOString()}`);

const minimumMilliseconds = 4000;
const servicesStart = Date.now();
const errors = require('../util/errors');
const PromiseIterate = require('../util/promise').PromiseIterate;

const Services = require('../Services');
const services = new Services(
	'aws',
	(() => {
		if (typeof process.env.CONFIG !== 'string') {
			throw new Error('Missing CONFIG environmental variable');
		}

		try {
			return JSON.parse(process.env.CONFIG);
		}
		catch (err) {
			err.message = `Invalid CONFIG environmental variable JSON -- ${err.message}`;
			throw err;
		}
	})(),
	{
		arq: require('../parse/parser-arq'),
		json: require('../parse/parser-json'),
	}
);

const servicesTime = Date.now() - servicesStart;
if (servicesTime > 350) {
	// eslint-disable-next-line no-console
	console.log(`Loading Services took ${servicesTime}ms`);
}

// Pre-load engine
services.engine;

exports.receivingVerifyEmailRecipients = function(event, context, callback) {
	// Initialize the logger service.
	services.logger.initLogger(
		`${context.functionName}/[${context.functionVersion}]${context.awsRequestId}`
	);

	const VerifyEmailRecipientsResult = require('../receiving/ReceivingService').VerifyEmailRecipientsResult;
	const recipients = event.Records[0].ses.receipt.recipients;

	services.logger.debug({
		messageId: event.Records[0].ses.mail.messageId,
		recipients: event.Records[0].ses.receipt.recipients,
	}, 'Verifying e-mail recipients');

	services.receiving.verifyEmailRecipients(recipients)
		.then((result) => {
			if (result.matching.length > 1) {
				services.logger.warn({
					matchingRecipients: result.matching,
				}, `More than one (${result.matching.length}) recipient found, using first`);
			}

			switch (result.status) {
				case VerifyEmailRecipientsResult.NO_MATCHES:
					services.logger.warn(`No valid recipients found: ${JSON.stringify(recipients)}`);
					callback(null, { disposition: 'STOP_RULE' });
					break;
				case VerifyEmailRecipientsResult.CLIENT_NOT_FOUND:
					services.logger.warn(`Client not found: ${result.matching[0].clientId}`);
					callback(null, { disposition: 'STOP_RULE' });
					break;
				case VerifyEmailRecipientsResult.CLIENT_KEY_MISMATCH:
					services.logger.warn(`Client key mismatch: ${result.matching[0].clientId}`);
					callback(null, { disposition: 'STOP_RULE' });
					break;
				case VerifyEmailRecipientsResult.CLIENT_KEY_MATCHED:
					services.logger.info({
						messageId: event.Records[0].ses.mail.messageId,
						clientId: result.matching[0].clientId,
					}, 'Client verified');
					callback(null, { disposition: 'CONTINUE' });
					break;
				default:
					throw new Error(`Invalid VerifyEmailRecipientsResult status: ${result.status}`);
			}
		})
		.catch((err) => {
			services.logger.error({ err }, 'Verify e-mail recipients for backup results delivery');
			callback(null, { disposition: 'STOP_RULE' });
		});
};

exports.receivingHTTPPost = function(event, context, callback) {
	callback(null, {
		statusCode: '200',
		body: JSON.stringify({ okay: true }),
		headers: {
			'Content-Type': 'application/json',
		},
	});
};

exports.ingestConsumerHandler = function(event, context, callback) {
	// eslint-disable-next-line no-console
	console.log(`ingestConsumerHandler at ${new Date().toISOString()}`);

	// Initialize the logger service.
	services.logger.initLogger(
		`${context.functionName}/[${context.functionVersion}]${context.awsRequestId}`
	);

	services.ingest.runQueueConsumer()
		.then(() => {
			callback();
		}, (err) => {
			services.logger.error({ err }, 'Ingest consumer > Deuque backup payloads');
			callback(err);
		})
		.catch((err) => {
			services.logger.error({ err }, 'Ingest consumer');
			callback(err);
		});
};

exports.ingestWorkerHandler = function(event, context, callback) {
	// eslint-disable-next-line no-console
	console.log(`ingestWorkerHandler at ${new Date().toISOString()}`);

	// Initialize the logger service.
	services.logger.initLogger(
		`${context.functionName}/[${context.functionVersion}]${context.awsRequestId}`
	);

	ingestNext()
		.then(() => {
			callback();
		})
		.catch((err) => {
			callback(err);
		});

	function ingestNext() {
		const remainingTime = context.getRemainingTimeInMillis();
		if (remainingTime < minimumMilliseconds) {
			services.logger.debug(`Not enough remaining time (${remainingTime}ms < ${minimumMilliseconds}) to ingest more`);
			return Promise.resolve();
		}

		const startTime = Date.now();
		services.logger.debug('Dequeuing message');
		return services.queue.dequeueReceivedBackupResults(1)
			.then((queueMessages) => {
				if (queueMessages && queueMessages.length) {
					const queueMessage = queueMessages[0];
					const ingestId = queueMessage.MessageId;
					const queuedDate = new Date(parseInt(queueMessage.Attributes.SentTimestamp, 10)).toISOString();
					const receiveCount = queueMessage.Attributes.ApproximateReceiveCount;

					services.logger.debug({
						ingestId,
						queuedDate,
						receiveCount,
					}, 'Dequeued message');

					return services.ingest.ingestQueuedBackupResult(
						ingestId,
						queueMessage
					)
						.then((backupResultMeta) => {
							services.logger.info({
								ingestId,
								ingestDuration: Date.now() - startTime,
								backupResultMeta,
							}, 'Ingested message');
						}, (err) => {
							// Invalid backup payload errors should not be re-queued.
							if (err instanceof errors.InvalidBackupPayloadError) {
								services.logger.error({
									err,
									ingestId,
								}, 'Dequeued message has invalid backup results payload');
							}
							else if (receiveCount >= 5) {
								services.logger.error({
									err,
									ingestId,
									queuedDate,
									receiveCount,
								}, 'Dequeued message failed too many times');
							}
							else {
								throw err;
							}
						})
						.then(() => {
							return services.queue.resolveReceivedBackupResult(
								queueMessage
							);
						})
						.catch((err) => {
							services.logger.error({ err, ingestId });
						})
						.then(ingestNext);
				}
				else {
					services.logger.debug(`Nothing returned from queue`);
				}
			})
			.catch((err) => {
				services.logger.error({ err }, 'Ingest worker');
			});
	}
};

exports.ingestMetricsStreamHandler = function(event, context, callback) {
	const BackupResultMetrics = require('../structs/BackupResultMetrics');
	const backupTableArn = services.config.AWS_RESOURCE_ATTR['aws_dynamodb_table.Backup.arn'];
	const expectedStreamSourceARN = `${backupTableArn}/stream/`;

	let validRecords = 0;

	services.logger.debug(`Received ${event.Records.length} record(s) to process`);

	// Parse the records into a map of clientId => BackupResultMetrics[]
	const metricsMap = event.Records.reduce((ret, streamRecord) => {
		try {
			if (streamRecord.eventSource !== 'aws:dynamodb') {
				services.logger.warn({
					streamRecord,
				}, 'Invalid metrics stream record (Expected eventSource to be "aws:dynamodb")');
			}
			else if (streamRecord.eventName !== 'INSERT') {
				services.logger.debug({
					streamRecord,
				}, `Skipping metrics stream record (eventName not "INSERT")`);
			}
			else if (String(streamRecord.eventSourceARN).indexOf(expectedStreamSourceARN) !== 0) {
				services.logger.warn({
					streamRecord,
					expectedStreamSourceARN,
				}, `Invalid metrics stream record (Expected eventSourceARN to be from backup table)`);
			}
			else if (!streamRecord.dynamodb.Keys.clientId || !streamRecord.dynamodb.Keys.clientId.S) {
				services.logger.error({
					streamRecord,
				}, 'Invalid metrics stream record (Missing or non-string "clientId")');
			}
			else if (!streamRecord.dynamodb.NewImage) {
				services.logger.error({
					streamRecord,
				}, 'Invalid metrics stream record (Missing "NewImage")');
			}
			else if (!streamRecord.dynamodb.NewImage.backupDate || !streamRecord.dynamodb.NewImage.backupDate.S) {
				services.logger.error({
					streamRecord,
				}, 'Invalid metrics stream record (Missing or invalid "backupDate")');
			}
			else if (!streamRecord.dynamodb.NewImage.totalBytes || !streamRecord.dynamodb.NewImage.totalBytes.N) {
				services.logger.error({
					streamRecord,
				}, 'Invalid metrics stream record (Missing or invalid "totalBytes")');
			}
			else if (!streamRecord.dynamodb.NewImage.totalItems || !streamRecord.dynamodb.NewImage.totalItems.N) {
				services.logger.error({
					streamRecord,
				}, 'Invalid metrics stream record (Missing or invalid "totalItems")');
			}
			else if (!streamRecord.dynamodb.NewImage.errorCount || !streamRecord.dynamodb.NewImage.errorCount.N) {
				services.logger.error({
					streamRecord,
				}, 'Invalid metrics stream record (Missing or invalid "errorCount")');
			}
			else {
				const clientId = streamRecord.dynamodb.Keys.clientId.S;
				const backupDate = streamRecord.dynamodb.NewImage.backupDate.S;
				const totalBytes = parseFloat(streamRecord.dynamodb.NewImage.totalBytes.N);
				const totalItems = parseFloat(streamRecord.dynamodb.NewImage.totalItems.N);
				const errorCount = parseFloat(streamRecord.dynamodb.NewImage.errorCount.N);

				validRecords++;

				if (!ret[clientId]) {
					ret[clientId] = [];
				}

				ret[clientId].push(new BackupResultMetrics({
					backupDate,
					totalItems,
					totalBytes,
					errorCount,
				}));
			}
		}
		catch (err) {
			services.logger.error({
				err,
				streamRecord,
			}, `Failed to parse metrics stream record`);
		}

		return ret;
	}, {});

	const clientIds = Object.keys(metricsMap);

	if (!clientIds.length) {
		services.logger.debug(`Processed ${validRecords} of ${event.Records.length} records`);
		callback(null, null);
		return;
	}

	// Increment metrics for each client.
	PromiseIterate(clientIds, (clientId) => {
		services.logger.debug({
			clientId,
			clientMetrics: metricsMap[clientId],
		}, `Incrementing backup result metrics for client`);

		return services.db.incrementBackupResultMetrics(clientId, metricsMap[clientId])
			.catch((err) => {
				// Log error but do not re-throw to avoid failing ingest
				// since the backup result has been created.
				services.logger.error({
					err,
					clientId,
					clientMetrics: metricsMap[clientId],
				}, 'Error incrementing client metrics');
			});
	})
		.then(() => {
			services.logger.debug(`Processed ${validRecords} of ${event.Records.length} records`);
			callback(null, null);
		})
		.catch(callback);
};
