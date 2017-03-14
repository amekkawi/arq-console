'use strict';

const Service = require('../Service');
const PromiseTry = require('../util/promise').PromiseTry;
const BackupResultMetrics = require('../structs/BackupResultMetrics');

class ParserService extends Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}

	extractEmailMetrics(backupType, contentBuffer) {
		return PromiseTry(() => {
			const parser = this.services.getBackupResultParser(backupType);
			if (!parser) {
				throw new Error(`Parser not available for ${JSON.stringify(backupType)}`);
			}

			if (!parser.extractEmailMetrics) {
				throw new Error(`Parser ${JSON.stringify(backupType)} does not support metrics delivered using e-mail`);
			}

			return parser.extractEmailMetrics(this.services, contentBuffer)
				.then((metrics) => new BackupResultMetrics(metrics));
		});
	}

	extractHTTPPostMetrics(backupType, contentBuffer) {
		return PromiseTry(() => {
			const parser = this.services.getBackupResultParser(backupType);
			if (!parser) {
				throw new Error(`Parser not available for ${JSON.stringify(backupType)}`);
			}

			if (!parser.extractHTTPPostMetrics) {
				throw new Error(`Parser ${JSON.stringify(backupType)} does not support metrics delivered using HTTP post`);
			}

			return parser.extractHTTPPostMetrics(this.services, contentBuffer)
				.then((metrics) => new BackupResultMetrics(metrics));
		});
	}

	/**
	 * TODO
	 *
	 * @param {Buffer} contentBuffer
	 * @returns {Promise}
	 */
	parseEmailContent(contentBuffer) {
		return new Promise((resolve, reject) => {
			const MailParser = require('mailparser').MailParser;
			const mailparser = new MailParser();
			mailparser.on('error', reject);
			mailparser.on('end', resolve);
			mailparser.write(contentBuffer);
			mailparser.end();
		});
	}

	/**
	 * TODO
	 *
	 * @param {Buffer} contentBuffer
	 * @returns {Promise}
	 */
	parseJSONContent(contentBuffer) {
		return PromiseTry(() => JSON.parse(contentBuffer.toString('utf8')));
	}
}

module.exports = ParserService;
