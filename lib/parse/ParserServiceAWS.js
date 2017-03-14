'use strict';

const ParserService = require('./ParserService');

class ParserServiceAWS extends ParserService {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}
}

module.exports = ParserServiceAWS;
