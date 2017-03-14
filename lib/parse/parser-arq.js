'use strict';

const byteMultiplier = {
	byte: 1,
	bytes: 1,
	kb: 1024,
	mb: 1024 * 1024,
	gb: 1024 * 1024 * 1024,
	tb: 1024 * 1024 * 1024 * 1024,
};

const textMatchers = [
	(services, result, path, text) => {
		if (path === 'html.body') {
			const match = text.match(/Uploaded ([0-9,.]+) (bytes?|[KMGT]B)/i);
			if (match) {
				const bytes = Math.round(parseFloat(match[1].replace(/,/g, '')) * byteMultiplier[match[2].toLowerCase()]);
				result.totalBytes += bytes;
				result.foundUploadedBytes = true;

				services.logger.debug(
					`Uploaded ${match[1]} ${match[2]} (${bytes})`
				);

				return true;
			}
		}
	},
	(services, result, path, text) => {
		if (path === 'html.body') {
			// Arq Agent version X.X.X started backup session for XXXXXX on March 3, 2017 at 4:30:04 PM EST
			const startMatch = text.match(/^Arq Agent version [\d.]+ started backup session for .+ on ((\w+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2}:\d{2} (?:AM|PM) [^ ]+))$/);
			if (startMatch) {
				result.startDate = new Date(Date.parse(`${startMatch[2]} ${startMatch[3]}`));

				services.logger.debug({
					timeOrig: startMatch[1],
					timeParsed: result.startDate.toISOString(),
				}, 'Start time');

				return true;
			}
		}
	},
	(services, result, path, text) => {
		if (path === 'html.body') {
			// Backup session for XXXXXX ended on March 3, 2017 at 10:30:52 AM EST
			// Backup session for XXXXXX ended on March 3, 2017 at 3:30:35 PM EST (1 error)
			const match = text.match(/^Backup session for .+ ended on ((\w+ \d{1,2}, \d{4}) at (\d{1,2}:\d{2}:\d{2} (?:AM|PM) [^ ]+))(?:\(([\d,]+) errors?\))?$/);
			if (match) {
				result.endDate = new Date(Date.parse(`${match[2]} ${match[3]}`));

				services.logger.debug({
					timeOrig: match[1],
					timeParsed: result.endDate.toISOString(),
				}, 'End time');

				if (match[4]) {
					result.errorCount = parseFloat(match[4].replace(/,/g, ''));

					services.logger.debug({
						errorCount: result.errorCount,
					}, 'Error count from end time line');
				}

				return true;
			}
		}
	},
	(services, result, path, text) => {
		if (path === 'html.body') {
			// Arq Agent version 5.5.0 started backup to XXXXXX on 3/2/2017 7:00:04 AM
			const match = text.match(/^Arq Agent version [\d.]+ started backup to .+ on ((\d+)\/(\d+)\/(\d{4}) (\d+):(\d+):(\d+) (AM|PM))$/);
			if (match) {
				result.startDate = new Date(Date.UTC(
					parseInt(match[4]),
					parseInt(match[2]),
					parseInt(match[3]),
					parseInt(match[5]) + (match[8] === 'PM' ? 12 : 0),
					parseInt(match[6]),
					parseInt(match[7])
				));

				services.logger.debug({
					timeOrig: match[1],
					timeParsed: result.startDate.toISOString(),
				}, 'Start time');

				return true;
			}
		}
	},
	(services, result, path, text) => {
		if (path === 'html.body') {
			// Ended backup to XXXXXX on 2/28/2017 8:00:12 PM
			const match = text.match(/^Ended backup to .+ on ((\d+)\/(\d+)\/(\d{4}) (\d+):(\d+):(\d+) (AM|PM))$/);
			if (match) {
				result.endDate = new Date(Date.UTC(
					parseInt(match[4]),
					parseInt(match[2]),
					parseInt(match[3]),
					parseInt(match[5]) + (match[8] === 'PM' ? 12 : 0),
					parseInt(match[6]),
					parseInt(match[7])
				));

				services.logger.debug({
					timeOrig: match[1],
					timeParsed: result.endDate.toISOString(),
				}, 'End time');

				return true;
			}
		}
	},
	(services, result, path, text) => {
		if (path === 'html.body' && text.indexOf('Error: ') === 0) {
			result.errorMessages.push(text.substr('Error: '.length));

			return true;
		}
	},
];

exports.extractEmailMetrics = function(services, contentBuffer) {
	return services.parse.parseEmailContent(contentBuffer)
		.then((mail) => {
			if (typeof mail.html !== 'string') {
				throw new Error('Expected e-mail to contain HTML body');
			}

			const result = {
				backupDate: null,
				foundUploadedBytes: false,
				duration: 0,
				totalBytes: 0,
				startDate: null,
				endDate: null,
				errorCount: 0,
				errorMessages: [],
			};

			if (typeof mail.subject === 'string') {
				const subjectMatch = mail.subject.match(/ \(([\d,]+) errors?\)$/);
				if (subjectMatch) {
					result.errorCount = parseFloat(subjectMatch[1].replace(/,/g, ''));
					services.logger.debug(`Error count in subject: ${result.errorCount}`);
				}
			}

			if (typeof mail.receivedDate === 'string') {
				result.backupDate = new Date(Date.parse(mail.receivedDate)).toISOString();
				services.logger.debug(`E-mail received date: ${result.backupDate}`);
			}
			else if (typeof mail.date === 'string') {
				result.backupDate = new Date(Date.parse(mail.date)).toISOString();
				services.logger.debug(`E-mail date: ${result.backupDate}`);
			}

			let path = '';
			const pathParts = [];

			function doMatchers(text) {
				for (const matcher of textMatchers) {
					if (matcher(services, result, path, text)) {
						return;
					}
				}
			}

			const HtmlParser = require('htmlparser2').Parser;
			const htmlParser = new HtmlParser({
				onopentag(name) {
					pathParts.push(name);
					path = pathParts.join('.');
				},
				ontext(text) {
					doMatchers(text);
				},
				onclosetag(name) {
					if (pathParts.length) {
						const pop = pathParts.pop();
						path = pathParts.join('.');
						if (pop !== name) {
							services.logger.debug(`Popped ${name} tag but expected ${pop}`);
						}
					}
					else {
						services.logger.debug(`Found ${name} close tag but path is empty`);
					}
				},
			}, { decodeEntities: true });

			htmlParser.write(mail.html);
			htmlParser.end();

			if (!result.foundUploadedBytes) {
				throw new Error('Missing log entries for uploaded bytes');
			}

			if ((!result.startDate || Number.isNaN((result.startDate.getTime()))) && (!result.endDate || Number.isNaN(result.endDate.getTime()))) {
				throw new Error('Invalid or no matching start and end time');
			}
			else if (!result.startDate || Number.isNaN((result.startDate.getTime()))) {
				throw new Error('Invalid or no matching start time');
			}
			else if (!result.endDate || Number.isNaN(result.endDate.getTime())) {
				throw new Error('Invalid or no matching end time');
			}
			else {
				result.duration = result.endDate.getTime() - result.startDate.getTime();

				if (result.duration < 0) {
					services.logger.warn({
						startDate: result.endDate.toISOString(),
						endDate: result.endDate.toISOString(),
					}, 'Negative duration');
				}
			}

			if (result.endDate && !Number.isNaN(result.endDate.getTime())) {
				if (result.backupDate) {
					const diff = Math.abs(Date.parse(result.backupDate).getTime() - result.endDate.getTime());

					// Show a warning if the difference is more than 5 minutes
					if (diff > 300) {
						services.logger.warn({
							receivedDate: result.backupDate,
							endDate: result.endDate.toISOString(),
						}, 'E-mail received over 5 minutes after backup completed');
					}
				}

				result.backupDate = result.endDate.toISOString();
			}

			return result;
		});
};
