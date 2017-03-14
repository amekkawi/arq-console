'use strict';

const _services = Symbol('_services');

class Service {

	/**
	 * @param {Services} services
	 */
	constructor(services) {
		this[_services] = services;
	}

	/**
	 * @returns {Services}
	 */
	get services() {
		return this[_services];
	}
}

module.exports = Service;
