'use strict';

const errors = require('../util/errors');
const PromiseTry = require('../util/promise').PromiseTry;
const Service = require('../Service');

/**
 * TODO
 *
 * @property {Services} services
 */
class IngestService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	/**
	 * TODO
	 *
	 * @returns {Promise}
	 */
	runQueueConsumer() {
		return PromiseTry(() => {
			this.services.logger.trace('runQueueConsumer');

			return this.services.queue.getAvailableReceivedBackupResults()
				.then((availableResults) => {
					// Skip if the queue is empty
					if (!availableResults) {
						this.services.logger.debug(`No available backup results`);
						return;
					}

					const maxWorkers = this.services.config.INGEST_WORKER_MAX;
					const maxTime = this.services.config.INGEST_WORKER_MAX_TIME;

					// Pessimistic guess at how many queue items could be processed by a worker
					// assuming 4 seconds for overhead and each item takes 4 seconds to process.
					const maxPerWorker = (maxTime - 4) / 4;

					// Required a minimum number of workers (up to 3) for every 10 queue items available.
					const minWorkers = Math.min(3, Math.ceil(availableResults / 10));

					// Number of workers to invoke.
					const workerCount = Math.max(
						minWorkers,
						Math.min(
							maxWorkers,
							Math.ceil(availableResults / maxPerWorker)
						)
					);

					this.services.logger.debug({
						workerCount,
						availableResults,
					}, `Invoking workers`);

					const invokePromises = [];
					for (let i = 0; i < workerCount; i++) {
						invokePromises.push(
							this.invokeQueueWorker()
								.catch((err) => {
									this.services.logger.error({
										err,
									}, 'Invoke error');
								})
						);
					}

					return Promise.all(invokePromises);
				});
		});
	}

	/**
	 * Invoke a worker process that will ingest backup results.
	 *
	 * @abstract
	 * @returns {Promise}
	 */
	invokeQueueWorker() { // eslint-disable-line no-unused-vars
		return Promise.reject(new Error('IngestService#invokeQueueWorker not implemented'));
	}

	/**
	 * TODO
	 *
	 * @param {string} ingestId
	 * @param {string|object} queueMessage
	 * @returns {Promise}
	 */
	ingestQueuedBackupResult(ingestId, queueMessage) {
		return Promise.resolve()
			.then(() => {
				this.services.logger.debug('Extract queue message payload');
				return this.extractQueueMessagePayload(ingestId, queueMessage);
			})
			.then((queuePayload) => {
				this.services.logger.debug('Extract backup result meta');
				return this.extractBackupResultMeta(ingestId, queuePayload);
			})
			.then((backupResultMeta) => {
				return this.ingestBackupResult(ingestId, backupResultMeta)
					.then(() => backupResultMeta);
			});
	}

	/**
	 * TODO
	 *
	 * @param {string} ingestId
	 * @param {BackupResultMeta} backupResultMeta
	 * @returns {Promise}
	 */
	ingestBackupResult(ingestId, backupResultMeta) {
		const logger = this.services.logger;

		logger.debug({
			ingestId,
			backupResultMeta,
		}, 'Ingesting backup result');

		return Promise.resolve()
			.then(() => {
				const clientId = backupResultMeta.clientId;
				const clientKey = backupResultMeta.clientKey;

				logger.debug({
					clientId,
					clientKey,
				}, 'Verify client');

				return this.services.db.getClient(clientId, {
					attributes: [
						'clientId',
						'clientKey',
					],
				})
					.then((clientDoc) => {
						if (!clientDoc) {
							throw new errors.InvalidBackupPayloadError(
								`Client not found: ${clientId}`,
								'CLIENT_NOT_FOUND',
								ingestId,
								backupResultMeta.backupId,
								{ clientId }
							);
						}

						if (clientDoc.clientKey !== clientKey) {
							throw new errors.InvalidBackupPayloadError(
								`Client key mismatch for ${clientId} with ${clientKey}`,
								'CLIENT_KEY_MISMATCH',
								ingestId,
								backupResultMeta.backupId,
								{ clientId }
							);
						}

						return backupResultMeta;
					});
			})
			.then((backupResultMeta) => {
				return this.services.storage.getBackupResultContent(
					backupResultMeta.backupId
				)
					.then((contentBuffer) => {
						if (backupResultMeta.deliveryType === 'email') {
							logger.debug(`Extract metrics from e-mail delivery`);
							return this.services.parse.extractEmailMetrics(
								backupResultMeta.backupType,
								contentBuffer
							)
								.catch((err) => {
									throw new errors.InvalidBackupPayloadError(
										`Extract metrics failed`,
										'EXTRACT_METRICS',
										ingestId,
										backupResultMeta.backupId,
										{ extractMetricsError: err }
									);
								});
						}
						else if (backupResultMeta.deliveryType === 'httppost') {
							logger.debug(`Extract metrics from HTTP Post delivery`);
							return this.services.parse.extractHTTPPostMetrics(
								backupResultMeta.backupType,
								contentBuffer
							);
						}
						else {
							throw new Error(`Unexpected delivery type: ${backupResultMeta.deliveryType}`);
						}
					})
					.then((backupResultMetrics) => {
						logger.debug({ backupResultMetrics }, 'Add backup result to DB');
						return this.services.db.addBackupResult(backupResultMeta, backupResultMetrics);
					})
					.then(() => {
						logger.debug('Archive backup result content');
						return this.services.storage.archiveBackupResultContent(
							backupResultMeta.backupId,
							ingestId
						);
					});
			});
	}

	/**
	 * Extract the payload data from the dequeued message.
	 *
	 * This is necessary for queues that wrap the original queued payload.
	 *
	 * For example, if the original queued payload was `"...ORIGINAL_QUEUED_PAYLOAD..."` the
	 * following would be the full queue message from AWS SQS:
	 *
	 * ```json
	 * {
	 *   "MessageId": "0d78c84f-1b42-c0d7-f7a9-26019c0d78c8",
	 *   "ReceiptHandle": "7091b426019c0d78c84fecaf7a97f1a9",
	 *   "MD5OfBody": "6ccd99d9952314c66989f4652c6348a6",
	 *   "Body": "...ORIGINAL_QUEUED_PAYLOAD...",
	 *   "Attributes": {
	 *     "SenderId": "4d3d22fd87e7a68ab6d342bde692ad01",
	 *     "ApproximateFirstReceiveTimestamp": "1488238813744",
	 *     "ApproximateReceiveCount": "1",
	 *     "SentTimestamp": "1488238577233"
	 *   }
	 * }
	 * ```
	 *
	 * @abstract
	 * @protected
	 * @param {string} ingestId
	 * @param {string|object} queueMessage
	 * @returns {string|object}
	 */
	extractQueueMessagePayload(ingestId, queueMessage) { // eslint-disable-line no-unused-vars
		throw new Error('IngestService#extractQueueMessagePayload not implemented');
	}

	/**
	 * TODO
	 *
	 * @protected
	 * @param {string} ingestId
	 * @param {string|object} queuePayload
	 * @returns {BackupResultMeta}
	 * @throws InvalidBackupPayloadError
	 */
	extractBackupResultMeta(ingestId, queuePayload) {
		const extractErrors = {};

		try {
			return this.extractBackupResultMetaEmail(queuePayload);
		}
		catch (err) {
			extractErrors.email = err instanceof errors.PayloadExtractError
				? err.message
				: err.stack;
		}

		try {
			return this.extractBackupResultMetaHTTPPost(queuePayload);
		}
		catch (err) {
			extractErrors.httppost = err instanceof errors.PayloadExtractError
				? err.message
				: err.stack;
		}

		throw new errors.InvalidBackupPayloadError(
			`Invalid queue JSON (failed to extract payload)`,
			'INVALID_QUEUE_JSON',
			ingestId,
			null,
			{
				rawJson: queuePayload,
				extractErrors,
			}
		);
	}

	/**
	 * Attempt to extract the metadata for an e-mail delivered backup result.
	 *
	 * Throw a PayloadExtractError if the queue payload is not for this delivery method.
	 *
	 * @abstract
	 * @protected
	 * @param {string|object} queuePayload
	 * @returns {BackupResultMeta}
	 * @throws PayloadExtractError
	 */
	extractBackupResultMetaEmail(queuePayload) { // eslint-disable-line no-unused-vars
		throw new errors.PayloadExtractError('IngestService#extractBackupResultMetaEmail not implemented');
	}

	/**
	 * Attempt to extract the metadata for an HTTP POST delivered backup result.
	 *
	 * Throw a PayloadExtractError if the queue payload is not for this delivery method.
	 *
	 * @abstract
	 * @protected
	 * @param {*} queuePayload
	 * @returns {BackupResultMeta}
	 * @throws PayloadExtractError
	 */
	extractBackupResultMetaHTTPPost(queuePayload) { // eslint-disable-line no-unused-vars
		throw new errors.PayloadExtractError('IngestService#extractBackupResultMetaHTTPPost not implemented');
	}
}

module.exports = IngestService;
