'use strict';

// eslint-disable-next-line no-console
console.log(`Loaded ${__filename} at ${new Date().toISOString()}`);

const minimumMilliseconds = 4000;
const servicesStart = Date.now();
const errors = require('../util/errors');
const PromiseIterate = require('../util/promise').PromiseIterate;
const VerifyEmailRecipientsResult = require('../structs/VerifyEmailRecipientsResult');
const VerifyIdentifierResult = require('../structs/VerifyIdentifierResult');

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

	const backupId = `email/${event.Records[0].ses.mail.messageId}`;
	const recipients = event.Records[0].ses.receipt.recipients;

	services.logger.debug({
		backupId,
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
					services.logger.debug({
						backupId,
						clientId: result.matching[0].clientId,
					}, 'Client verified');

					services.logger.info({
						deliveryType: 'httppost',
						backupId,
						clientId: result.matching[0].clientId,
						backupType: result.matching[0].backupType,
					}, 'Backup result received');
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
	// eslint-disable-next-line no-console
	console.log(`receivingHTTPPost at ${new Date().toISOString()}`);

	// Initialize the logger service.
	services.logger.initLogger(
		`${context.functionName}/[${context.functionVersion}]${context.awsRequestId}`
	);

	const backupId = `httppost/${context.awsRequestId}`;

	const sendResponse = (statusCode, message) => {
		callback(null, {
			statusCode,
			body: JSON.stringify({ message }),
			headers: {
				'Content-Type': 'application/json',
				'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
				'Access-Control-Allow-Methods': event.httpMethod,
				'Access-Control-Allow-Origin': '*',
			},
		});
	};

	// Verify the API Gateway resource path.
	const expectedResource = services.config.AWS_RESOURCE_ATTR['aws_api_gateway_resource.APIReceivingProxy.path'];
	if (event.resource !== expectedResource) {
		services.logger.warn({
			eventResource: event.resource,
			expectedResource,
		}, 'Unexpected API gateway resource');

		sendResponse(500, 'Encountered a server-side configuration issue (Unexpected API gateway resource)');
		return;
	}

	if (!event.pathParameters || !event.pathParameters.proxy) {
		services.logger.warn({
			eventPathParameters: event.pathParameters || null,
		}, 'Missing API gateway "proxy" path parameter');

		sendResponse(500, 'Encountered a server-side configuration issue (Missing API gateway "proxy" path parameter)');
		return;
	}

	services.logger.debug({
		identifierString: event.pathParameters.proxy,
	}, 'Verifying HTTP Post client');

	services.receiving.verifyBackupResultIdentifier(event.pathParameters.proxy)
		.then((result) => {
			switch (result.status) {

				case VerifyIdentifierResult.INVALID_IDENTIFIER:
					services.logger.warn(`Invalid client backup result identifier: ${JSON.stringify(event.pathParameters.proxy)}`);
					sendResponse(400, `Invalid client backup result identifier: ${JSON.stringify(event.pathParameters.proxy)}`);
					break;

				case VerifyIdentifierResult.CLIENT_NOT_FOUND:
					services.logger.warn(`Client not found: ${result.identifier.clientId}`);
					sendResponse(404, `Client not found: ${JSON.stringify(result.identifier.clientId)}`);
					break;

				case VerifyIdentifierResult.CLIENT_KEY_MISMATCH:
					services.logger.warn(`Client key mismatch: ${result.identifier.clientId}`);
					sendResponse(404, `Client not found: ${JSON.stringify(result.identifier.clientId)}`);
					break;

				case VerifyIdentifierResult.CLIENT_KEY_MATCHED:
					services.logger.debug({
						backupId,
						clientId: result.identifier.clientId,
					}, 'Client verified');

					return services.receiving.receiveBackupResult(
						result.identifier,
						backupId,
						event.isBase64Encoded
							? new Buffer(event.body, 'base64')
							: event.body
					)
						.then(() => {
							services.logger.info({
								deliveryType: 'email',
								backupId,
								clientId: result.identifier.clientId,
								backupType: result.identifier.backupType,
							}, 'Backup result received');

							callback(null, {
								statusCode: 200,
								body: JSON.stringify({ message: 'Success' }),
								headers: {
									'Content-Type': 'application/json',
									'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
									'Access-Control-Allow-Methods': event.httpMethod,
									'Access-Control-Allow-Origin': '*',
								},
							});
						}, (err) => {
							services.logger.error({ err }, 'Failed to put backup result into storage');
							sendResponse(500, 'Encountered a server-side error');
						});

				default:
					throw new Error(`Invalid VerifyIdentifierResult status: ${result.status}`);
			}
		}, (err) => {
			services.logger.error({ err }, 'Failed to verify HTTP Post identifier for backup results delivery');
			sendResponse(500, 'Encountered a server-side error');
		})
		.catch((err) => {
			services.logger.error({ err }, 'Error during receivingHTTPPost');
			sendResponse(500, 'Encountered a server-side error');
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
	// eslint-disable-next-line no-console
	console.log(`ingestMetricsStreamHandler at ${new Date().toISOString()}`);

	// Initialize the logger service.
	services.logger.initLogger(
		`${context.functionName}/[${context.functionVersion}]${context.awsRequestId}`
	);

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
