'use strict';

const ReceivingService = require('./ReceivingService');

/**
 * TODO
 *
 * @property {Services} services
 */
class ReceivingServiceAWS extends ReceivingService {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);
	}
}

module.exports = ReceivingServiceAWS;
