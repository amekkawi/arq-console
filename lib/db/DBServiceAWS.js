'use strict';

const DBService = require('./DBService');
const promiseUtil = require('../util/promise');
const dateUtil = require('../util/date');
const _dynamoDB = Symbol('_dynamoDB');
const _docClient = Symbol('_docClient');

/**
 * TODO
 *
 * @property {Services} services
 */
class DBServiceAWS extends DBService {

	/**
	 * TODO
	 *
	 * @param {Services} services
	 */
	constructor(services) {
		super(services);

		this[_dynamoDB] = new services.engine.DynamoDB({
			region: services.config.AWS_REGION,
		});

		this[_docClient] = new services.engine.DynamoDB.DocumentClient({
			service: this[_dynamoDB],
		});
	}

	getClient(clientId, options) {
		options = options || {};

		const params = {
			TableName: this.services.config.AWS_RESOURCE_ATTR['aws_dynamodb_table.Client.name'],
			Key: { clientId },
		};

		if (options.attributes) {
			params.AttributesToGet = options.attributes;
		}

		return this.services.logger.logApiCall(
			'getClient DynamoDB get',
			{ params },
			() => this[_docClient].get(params).promise()
		)
			.then((result) => result.Item || null);
	}

	addBackupResult(backupResultMeta, backupResultMetrics) {
		const params = {
			TableName: this.services.config.AWS_RESOURCE_ATTR['aws_dynamodb_table.Backup.name'],
			Item: {
				clientId: backupResultMeta.clientId,
				backupId: backupResultMeta.backupId,

				createdDate: new Date().toISOString(),

				backupType: backupResultMeta.backupType,
				deliveryType: backupResultMeta.deliveryType,

				backupDate: backupResultMetrics.backupDate,
				duration: backupResultMetrics.duration,
				totalItems: backupResultMetrics.totalItems,
				totalBytes: backupResultMetrics.totalBytes,
				errorCount: backupResultMetrics.errorCount,
			},
			ConditionExpression: 'attribute_not_exists(backupId)',
			ReturnValues: 'NONE',
		};

		if (backupResultMetrics.errorMessages) {
			params.Item.errorMessages = backupResultMetrics.errorMessages;
		}

		return this.services.logger.logApiCall(
			'addBackupResult DynamoDB put',
			{ params },
			() => this[_docClient].put(params).promise()
		);
	}

	// Note: In AWS this is handled by DynamoDB streams.
	incrementBackupResultMetrics(clientId, backupResultMetricsBatch) {
		let clientTotalBytes = 0;
		let clientTotalItems = 0;
		let clientErrorCount = 0;
		const byYearWeek = {};
		const byYearMonth = {};

		return promiseUtil.PromiseTry(() => {
			backupResultMetricsBatch.forEach((backupResultMetrics) => {
				// Increment client-level totals
				clientTotalBytes += backupResultMetrics.totalBytes;
				clientTotalItems += backupResultMetrics.totalItems;
				clientErrorCount += backupResultMetrics.errorCount;

				const backupDate = new Date(Date.parse(backupResultMetrics.backupDate));

				// Increment monthly totals
				const year = backupDate.getUTCFullYear();
				const month = backupDate.getUTCMonth() + 1;
				const byMonth = (byYearMonth[year] || (byYearMonth[year] = {}));
				const monthMetrics = (byMonth[month] || (byMonth[month] = {
					count: 0,
					bytes: 0,
					items: 0,
					errors: 0,
				}));
				monthMetrics.count++;
				monthMetrics.bytes += backupResultMetrics.totalBytes;
				monthMetrics.items += backupResultMetrics.totalItems;
				monthMetrics.errors += backupResultMetrics.errorCount;

				// Increment ISO weekly totals
				const week = dateUtil.getISOWeekUTC(backupDate);
				const weekYear = dateUtil.getISOWeekYearUTC(backupDate);
				const byWeek = (byYearWeek[weekYear] || (byYearWeek[weekYear] = {}));
				const weekMetrics = (byWeek[week] || (byWeek[week] = {
					count: 0,
					bytes: 0,
					items: 0,
					errors: 0,
				}));
				weekMetrics.count++;
				weekMetrics.bytes += backupResultMetrics.totalBytes;
				weekMetrics.items += backupResultMetrics.totalItems;
				weekMetrics.errors += backupResultMetrics.errorCount;
			});

			// Update client-level metrics
			const params = {
				TableName: this.services.config.AWS_RESOURCE_ATTR['aws_dynamodb_table.Client.name'],
				Key: {
					clientId,
				},
				ConditionExpression: 'attribute_exists(clientId)',
				UpdateExpression: 'ADD backupCount :bc, totalBytes :tb, totalItems :ti, errorCount :ec',
				ExpressionAttributeValues: {
					':bc': backupResultMetricsBatch.length,
					':tb': clientTotalBytes,
					':ti': clientTotalItems,
					':ec': clientErrorCount,
				},
				ReturnValues: 'NONE',
			};

			return this.services.logger.logApiCall(
				'Updating client metric totals',
				{ params },
				() => this[_docClient].update(params).promise()
			);
		})
			.then(() => {
				return this._incrementBackupResultMonthlyMetrics(clientId, byYearMonth);
			})
			.then(() => {
				return this._incrementBackupResultWeeklyMetrics(clientId, byYearWeek);
			});
	}

	/**
	 * Update per-month metrics for the client.
	 *
	 * @private
	 * @param {string} clientId
	 * @param {object} byYearMonth
	 * @returns {Promise}
	 */
	_incrementBackupResultMonthlyMetrics(clientId, byYearMonth) {
		return promiseUtil.PromiseIterate(Object.keys(byYearMonth), (year) => {
			const updateProps = {};

			const byMonth = byYearMonth[year];
			Object.keys(byMonth).forEach((month) => {
				Object.keys(byMonth[month]).forEach((prop) => {
					// Only include metrics that need to be incremented.
					if (byMonth[month][prop] > 0) {
						updateProps[`${month}-${prop}`] = byMonth[month][prop];
					}
				});
			});

			// Filter out metrics that do not need to be incremented.
			const propKeys = Object.keys(updateProps);

			// Skip if nothing to increment.
			if (!propKeys.length) {
				return;
			}

			const params = {
				TableName: this.services.config.AWS_RESOURCE_ATTR['aws_dynamodb_table.ClientMetric.name'],
				Key: {
					clientId,
					metricId: `monthly-${year}`,
				},
				UpdateExpression: `ADD ${propKeys.map((prop, i) => `#n${i} :v${i}`).join(', ')}`,
				ExpressionAttributeNames: propKeys.reduce((ret, prop, i) => {
					ret[`#n${i}`] = prop;
					return ret;
				}, {}),
				ExpressionAttributeValues: propKeys.reduce((ret, prop, i) => {
					ret[`:v${i}`] = updateProps[prop];
					return ret;
				}, {}),
				ReturnValues: 'NONE',
			};

			return this.services.logger.logApiCall(
				'Updating client monthly metric totals',
				{ params },
				() => this[_docClient].update(params).promise()
			);
		});
	}

	/**
	 * Update per-week metrics for the client.
	 *
	 * @private
	 * @param {string} clientId
	 * @param {object} byYearWeek
	 * @returns {Promise}
	 */
	_incrementBackupResultWeeklyMetrics(clientId, byYearWeek) {
		return promiseUtil.PromiseIterate(Object.keys(byYearWeek), (year) => {
			const updateProps = {};

			const byWeek = byYearWeek[year];
			Object.keys(byWeek).forEach((week) => {
				Object.keys(byWeek[week]).forEach((prop) => {
					// Only include metrics that need to be incremented.
					if (byWeek[week][prop] > 0) {
						updateProps[`${week}-${prop}`] = byWeek[week][prop];
					}
				});
			});

			// Filter out metrics that do not need to be incremented.
			const propKeys = Object.keys(updateProps);

			// Skip if nothing to increment.
			if (!propKeys.length) {
				return;
			}

			const params = {
				TableName: this.services.config.AWS_RESOURCE_ATTR['aws_dynamodb_table.ClientMetric.name'],
				Key: {
					clientId,
					metricId: `weekly-${year}`,
				},
				UpdateExpression: `ADD ${propKeys.map((prop, i) => `#n${i} :v${i}`).join(', ')}`,
				ExpressionAttributeNames: propKeys.reduce((ret, prop, i) => {
					ret[`#n${i}`] = prop;
					return ret;
				}, {}),
				ExpressionAttributeValues: propKeys.reduce((ret, prop, i) => {
					ret[`:v${i}`] = updateProps[prop];
					return ret;
				}, {}),
				ReturnValues: 'NONE',
			};

			return this.services.logger.logApiCall(
				'Updating client weekly metric totals',
				{ params },
				() => this[_docClient].update(params).promise()
			);
		});
	}
}

module.exports = DBServiceAWS;
