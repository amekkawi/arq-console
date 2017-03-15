'use strict';

const QueueService = require('./QueueService');
const _sqs = Symbol('_sqs');

/**
 * TODO
 */
class QueueServiceAWS extends QueueService {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);

		this[_sqs] = new services.engine.SQS({
			apiVersion: '2012-11-05',
		});
	}

	getAvailableReceivedBackupResults() {
		const params = {
			QueueUrl: this.services.config.AWS_RESOURCE_ATTR['aws_sqs_queue.ReceiveQueue.id'],
			AttributeNames: ['ApproximateNumberOfMessages'],
		};

		return this.services.logger.logApiCall(
			'getAvailableReceivedBackupResults S3 getQueueAttributes',
			{ params },
			() => this[_sqs].getQueueAttributes(params).promise()
		)
			.then((result) => {
				return parseInt(result.Attributes.ApproximateNumberOfMessages || 0, 10);
			});
	}

	queueReceivedBackupResults(identifier, backupId) {
		const params = {
			QueueUrl: this.services.config.AWS_RESOURCE_ATTR['aws_sqs_queue.ReceiveQueue.id'],
			MessageBody: JSON.stringify({
				type: 'BackupResult',
				backupId,
				identifier,
			}),
		};

		return this.services.logger.logApiCall(
			'queueReceivedBackupResults S3 sendMessage',
			{ params },
			() => this[_sqs].sendMessage(params).promise()
		);
	}

	dequeueReceivedBackupResults(maxDequeue) {
		const params = {
			QueueUrl: this.services.config.AWS_RESOURCE_ATTR['aws_sqs_queue.ReceiveQueue.id'],
			MaxNumberOfMessages: maxDequeue,
			AttributeNames: ['All'],
		};

		return this.services.logger.logApiCall(
			'dequeueReceivedBackupResults S3 receiveMessage',
			{ params },
			() => this[_sqs].receiveMessage(params).promise()
		)
			.then((result) => {
				return result.Messages;
			});
	}

	resolveReceivedBackupResult(queueMessage) {
		const params = {
			QueueUrl: this.services.config.AWS_RESOURCE_ATTR['aws_sqs_queue.ReceiveQueue.id'],
			ReceiptHandle: queueMessage.ReceiptHandle,
		};

		return this.services.logger.logApiCall(
			'resolveReceivedBackupResult S3 deleteMessage',
			{ params },
			() => this[_sqs].deleteMessage(params).promise()
		);
	}
}

module.exports = QueueServiceAWS;
