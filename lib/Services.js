'use strict';

const _engineType = Symbol('_engineType');
const _backupResultParsers = Symbol('_backupResultParsers');
const _serviceCreate = Symbol('_servicesCreate');
const _config = Symbol('_config');

class Services {
	/**
	 * @param {string} engineType
	 * @param {object} config
	 * @param {object.<string,object>} backupResultParsers
	 */
	constructor(engineType, config, backupResultParsers) {
		if (!engineType.match(/^(aws)$/)) {
			throw new Error(`Invalid service engineType: ${engineType}`);
		}

		this[_config] = config;
		this[_engineType] = engineType;
		this[_backupResultParsers] = {};

		Object.keys(backupResultParsers).forEach((backupType) => {
			this.addBackupResultParser(backupType, backupResultParsers[backupType]);
		});
	}

	/**
	 * @returns {string}
	 */
	get engineType() {
		return this[_engineType];
	}

	/**
	 * @param {string} backupType
	 * @returns {object.<string,object>}
	 */
	getBackupResultParser(backupType) {
		return this[_backupResultParsers][backupType];
	}

	/**
	 * TODO
	 *
	 * @param {string} backupType
	 * @param {object} parser
	 * @returns {Services}
	 */
	addBackupResultParser(backupType, parser) {
		this[_backupResultParsers][backupType] = parser;
		return this;
	}

	/**
	 * Get the core library for the engine.
	 *
	 * @returns {*}
	 */
	get engine() {
		return this[_serviceCreate]('engine', (require) => {
			if (this.engineType === 'aws') {
				return require('aws-sdk');
			}
		}, serviceLog);
	}

	/**
	 * @returns {Config|ConfigAWS}
	 */
	get config() {
		return this[_serviceCreate]('config', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./config/ConfigAWS');
			}

			return new Service(this[_config]);
		}, serviceLog);
	}

	/**
	 * @returns {LoggerService}
	 */
	get logger() {
		return this[_serviceCreate]('logger', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./logger/LoggerServiceAWS');
			}

			return new Service(this);
		}, serviceLog);
	}

	/**
	 * @returns {QueueService}
	 */
	get queue() {
		return this[_serviceCreate]('queue', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./queue/QueueServiceAWS');
			}

			return new Service(this);
		}, serviceLog);
	}

	/**
	 * @returns {DBService}
	 */
	get db() {
		return this[_serviceCreate]('db', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./db/DBServiceAWS');
			}

			return new Service(this);
		}, serviceLog);
	}

	/**
	 * @returns {ReceivingService}
	 */
	get receiving() {
		return this[_serviceCreate]('receiving', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./receiving/ReceivingServiceAWS');
			}

			return new Service(this);
		}, serviceLog);
	}

	/**
	 * @returns {IngestService}
	 */
	get ingest() {
		return this[_serviceCreate]('ingest', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./ingest/IngestServiceAWS');
			}

			return new Service(this);
		}, serviceLog);
	}

	/**
	 * @returns {StorageService}
	 */
	get storage() {
		return this[_serviceCreate]('storage', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./storage/StorageServiceAWS');
			}

			return new Service(this);
		}, serviceLog);
	}

	/**
	 * @returns {ParserService}
	 */
	get parse() {
		return this[_serviceCreate]('parse', (require) => {
			let Service;
			if (this.engineType === 'aws') {
				Service = require('./parse/ParserServiceAWS');
			}
			return new Service(this);
		}, serviceLog);
	}
}

Services.prototype[_serviceCreate] = function(prop, fn, cb) {
	const start = Date.now();

	const value = fn(require);
	Object.defineProperty(this, prop, { value });

	const diff = Date.now() - start;
	cb && cb(prop, diff);

	return value;
};

module.exports = Services;

function serviceLog(prop, time) {
	if (time > 200) {
		// eslint-disable-next-line no-console
		console.log(`Service ${prop} took ${time}ms to load`);
	}
}
