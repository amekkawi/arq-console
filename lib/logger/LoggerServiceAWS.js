'use strict';

const CWLogsWritable = require('cwlogs-writable');
const LoggerService = require('./LoggerService');
const loggingUtils = require('../util/logging');

const RETRY_META = Symbol('RETRY_META');

/**
 * TODO
 *
 * @property {Services} services
 */
class LoggerServiceAWS extends LoggerService {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	initLogger(sourceId) {
		this._logStream = new CWLogsWritable({
			logGroupName: this.services.config.AWS_RESOURCE_ATTR['aws_cloudwatch_log_group.AppLogGroup.id'],
			logStreamName: `${new Date().toISOString().substr(0, 10).replace(/-/g, '/')}/${sourceId}`,
			cloudWatchLogsOptions: {
				region: this.services.config.AWS_REGION,
			},
			onError,
		});

		this._logStream[RETRY_META] = {
			retryDelay: 500,
			retryMax: 20,
			retryCount: 0,
		};

		this._logStream.on('error', onErrorEvent);
	}

	writeLog(level, rec) {
		super.writeLog(level, rec);

		// Also log to application log group, if initialized.
		if (this._logStream && level >= loggingUtils.LEVELS.INFO) {
			this._logStream.write(rec);
		}
	}
}

function onErrorEvent(err) {
	const queuedLogs = this.clearQueue();

	// eslint-disable-next-line no-console
	console.error(`LoggerServiceAWS error queueCount:${queuedLogs.length}`);

	// eslint-disable-next-line no-console
	console.error(err.stack); // TODO: Remove .stack
}

function onError(err, logEvents, next) {
	// Fail immediately if non PutLogEvents error
	if (!logEvents) {
		next(err);
		return;
	}

	const queueCount = this.getQueueSize();
	const batchCount = logEvents.length;
	const retryMeta = this[RETRY_META];

	// On the first retry, add a success listener to clear the number of retries.
	if (retryMeta.retryCount === 0) {
		this.once('putLogEvents', () => {
			retryMeta.retryCount = 0;
		});
	}

	retryMeta.retryCount++;

	// Fail if we're over the retry limit.
	if (retryMeta.retryCount >= retryMeta.retryMax) {
		// eslint-disable-next-line no-console
		console.error(`LoggerServiceAWS error for PutLogEvents, too many retries -- batchCount:${batchCount}`);
		next(err);
	}

	// Fail if the queue is too large.
	else if (queueCount >= 100) {
		// eslint-disable-next-line no-console
		console.error(`LoggerServiceAWS error for PutLogEvents, queue too large -- batchCount:${batchCount}`);
		next(err);
	}

	// Otherwise, requeue the log events after a delay.
	else {
		if (retryMeta.retryCount % 2 === 0) {
			// eslint-disable-next-line no-console
			console.warn(`LoggerServiceAWS error for PutLogEvents, will retry -- queueCount:${queueCount} batchCount:${batchCount} -- ${err.message}`);
		}

		setTimeout(() => {
			// Pass the logEvents to the "next" callback
			// so they are added back to the head of the queue.
			next(logEvents);
		}, retryMeta.retryDelay);
	}
}

LoggerServiceAWS._onErrorEvent = onErrorEvent;
LoggerServiceAWS._onError = onError;

module.exports = LoggerServiceAWS;
