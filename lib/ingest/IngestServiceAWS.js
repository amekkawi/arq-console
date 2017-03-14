'use strict';

const errors = require('../util/errors');
const emailUtil = require('../util/email');
const IngestService = require('./IngestService');
const BackupResultMeta = require('../structs/BackupResultMeta');
const _lambda = Symbol('_lambda');

/**
 * TODO
 *
 * @property {Services} services
 */
class IngestServiceAWS extends IngestService {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);

		this[_lambda] = new services.engine.Lambda({
			apiVersion: '2015-03-31',
			region: services.config.AWS_REGION,
		});
	}

	invokeQueueWorker(payload) {
		const params = {
			FunctionName: this.services.config.AWS_RESOURCE_ATTR['aws_lambda_function.IngestWorkerLambda.function_name'],
			InvocationType: 'Event',
			Payload: JSON.stringify(payload),
		};

		return this.services.logger.logApiCall(
			'invokeQueueWorker lambda invoke',
			{ params },
			() => this[_lambda].invoke(params).promise()
		);
	}

	extractQueueMessagePayload(ingestId, queueMessage) {
		// Parse the SQS message body as JSON
		let queuePayload;
		try {
			queuePayload = JSON.parse(queueMessage.Body);
		}
		catch (err) {
			throw new errors.InvalidBackupPayloadError(
				`Invalid queue JSON (parse payload JSON: ${err.message})`,
				'INVALID_QUEUE_JSON',
				ingestId,
				null,
				{ rawJson: queueMessage.Body }
			);
		}

		if (!queuePayload || typeof queuePayload !== 'object') {
			throw new errors.InvalidBackupPayloadError(
				`Invalid queue JSON (non-object)`,
				'INVALID_QUEUE_JSON',
				ingestId,
				null,
				{ rawJson: queuePayload }
			);
		}

		return queuePayload;
	}

	extractBackupResultMetaEmail(queuePayload) {
		if (queuePayload.Type !== 'Notification') {
			throw new errors.PayloadExtractError(
				`Expected SNS "Type" ${safeStringify(queuePayload.Type)} === "Notification"`
			);
		}

		const snsTopic = this.services.config.AWS_RESOURCE_ATTR['aws_sns_topic.EmailReceiveTopic.arn'];

		if (queuePayload.TopicArn !== snsTopic) {
			throw new errors.PayloadExtractError(
				`Expected SNS "TopicArn" ${safeStringify(queuePayload.TopicArn)} === ${safeStringify(snsTopic)}`
			);
		}

		let sesJSON;
		try {
			sesJSON = JSON.parse(queuePayload.Message);
		}
		catch (err) {
			throw new errors.PayloadExtractError(
				`Parse SNS "Message" JSON: ${err.message})`
			);
		}

		if (!sesJSON || typeof sesJSON !== 'object') {
			throw new errors.PayloadExtractError(
				`Expected SES JSON to be an object`
			);
		}

		if (sesJSON.notificationType !== 'Received') {
			throw new errors.PayloadExtractError(
				`Expected SES "notificationType" ${safeStringify(sesJSON.notificationType)} === "Received"`
			);
		}

		if (!sesJSON.mail || typeof sesJSON.mail !== 'object') {
			throw new errors.PayloadExtractError(
				`Expected SES "mail" to be an object: ${safeStringify(sesJSON.notificationType)}`
			);
		}

		if (typeof sesJSON.mail.messageId !== 'string') {
			throw new errors.PayloadExtractError(
				`Expected SES "mail.messageId" to be a string: ${safeStringify(sesJSON.notificationType)}`
			);
		}

		const validRecipients = emailUtil.parseEmailRecipients(sesJSON.receipt.recipients, {
			prefix: this.services.config.RECEIVING_EMAIL_PREFIX,
			domain: this.services.config.RECEIVING_EMAIL_DOMAIN,
		});

		if (validRecipients.length === 0) {
			throw new errors.PayloadExtractError(
				'No valid recipients'
			);
		}

		return new BackupResultMeta(
			'email',
			validRecipients[0].clientId,
			validRecipients[0].clientKey,
			validRecipients[0].backupType,
			`email/${sesJSON.mail.messageId}`
		);
	}

	// TODO
	//extractBackupResultMetaHTTPPost(queuePayload) {}
}

// TODO: Move to util
function safeStringify(val) {
	return val == null ? String(val) : JSON.stringify(val);
}

module.exports = IngestServiceAWS;
