'use strict';

class Config {
	constructor(config) {
		this.RECEIVING_EMAIL_PREFIX = config.RECEIVING_EMAIL_PREFIX;
		this.RECEIVING_EMAIL_DOMAIN = config.RECEIVING_EMAIL_DOMAIN;
		this.INGEST_WORKER_MAX = parseInt(config.INGEST_WORKER_MAX, 10) || 10;
		this.INGEST_WORKER_MAX_TIME = parseInt(config.INGEST_WORKER_MAX_TIME, 10) || 60;
		this.LOGGER_LEVEL = config.LOGGER_LEVEL || 'DEBUG';
	}
}

class ConfigAWS extends Config {
	constructor(config) {
		super(config);

		this.AWS_REGION = config.AWS_REGION;
		this.AWS_ACCOUNT_ID = config.AWS_ACCOUNT_ID;
		this.AWS_RESOURCE_PREFIX = config.AWS_RESOURCE_PREFIX;
		this.AWS_RESOURCE_ATTR = config.AWS_RESOURCE_ATTR;
	}
}

module.exports = ConfigAWS;
