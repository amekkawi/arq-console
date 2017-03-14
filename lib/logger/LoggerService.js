'use strict';

const loggingUtil = require('../util/logging');
const Service = require('../Service');
let nextReqId = 1;

/**
 * TODO
 *
 * @property {Services} services
 */
class LoggerService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	/**
	 * Initialize the current logging session.
	 *
	 * @param {string} sourceId - Unique ID that identifies the logging source
	 */
	initLogger(sourceId) { // eslint-disable-line no-unused-vars

	}

	/**
	 * TODO
	 */
	trace() {
		this.writeLog(
			loggingUtil.LEVELS.TRACE,
			this.makeLogRecord(loggingUtil.LEVELS.TRACE, Array.prototype.slice.call(arguments, 0))
		);
	}

	/**
	 * TODO
	 */
	debug() {
		this.writeLog(
			loggingUtil.LEVELS.DEBUG,
			this.makeLogRecord(loggingUtil.LEVELS.DEBUG, Array.prototype.slice.call(arguments, 0))
		);
	}

	/**
	 * TODO
	 */
	info() {
		this.writeLog(
			loggingUtil.LEVELS.INFO,
			this.makeLogRecord(loggingUtil.LEVELS.INFO, Array.prototype.slice.call(arguments, 0))
		);
	}

	/**
	 * TODO
	 */
	warn() {
		this.writeLog(
			loggingUtil.LEVELS.WARN,
			this.makeLogRecord(loggingUtil.LEVELS.WARN, Array.prototype.slice.call(arguments, 0))
		);
	}

	/**
	 * TODO
	 */
	error() {
		this.writeLog(
			loggingUtil.LEVELS.ERROR,
			this.makeLogRecord(loggingUtil.LEVELS.ERROR, Array.prototype.slice.call(arguments, 0))
		);
	}

	/**
	 * TODO
	 */
	fatal() {
		this.writeLog(
			loggingUtil.LEVELS.FATAL,
			this.makeLogRecord(loggingUtil.LEVELS.FATAL, Array.prototype.slice.call(arguments, 0))
		);
	}

	/**
	 * TODO
	 *
	 * @protected
	 * @param {number} level
	 * @param {*} args
	 * @returns {object}
	 */
	makeLogRecord(level, args) {
		return loggingUtil.makeLogRecord(level, args, {
			includeSrc: true,
			callerDepth: 3,
		});
	}

	/**
	 * TODO
	 *
	 * @protected
	 * @param {number|string} level
	 * @param {object} rec
	 */
	writeLog(level, rec) {
		if (level >= loggingUtil.LEVELS[this.services.config.LOGGER_LEVEL]) {
			try {
				// eslint-disable-next-line no-console
				console.log(loggingUtil.formatLogRecord(rec, ['time', 'src.func']));
			}
			catch (err) {
				// eslint-disable-next-line no-console
				console.error(`formatLogRecord error -- ${err.stack}`);

				// eslint-disable-next-line no-console
				console.log(JSON.stringify(rec));
			}
		}
	}

	logApiCall(logPrefix, logFields, requestFn) {
		const startTime = Date.now();
		const reqId = nextReqId++;

		this.trace(logFields, `${logPrefix} [${reqId}]`);

		const promise = requestFn();
		const requestTime = Date.now();

		return promise.then((result) => {
			const endTime = Date.now();
			const totalDuration = endTime - startTime;
			const requestDuration = endTime - requestTime;

			if (totalDuration > 350) {
				this.debug(
					`${logPrefix} [${reqId}] ${totalDuration}ms (${requestDuration}ms for request)`
				);
			}

			return result;
		}, (err) => {
			const endTime = Date.now();
			const totalDuration = endTime - startTime;
			const requestDuration = endTime - requestTime;

			if (totalDuration > 350) {
				this.debug(
					`${logPrefix} [${reqId}] ${totalDuration}ms (${requestDuration}ms for request)`
				);
			}

			throw err;
		});
	}
}

module.exports = LoggerService;
