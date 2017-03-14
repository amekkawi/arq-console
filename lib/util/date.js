/**
 * UTC verison of http://techblog.procurios.nl/k/news/view/33796/14863/calculate-iso-8601-week-and-year-in-javascript.html
 *
 * @param {Date} date
 * @returns {number}
 */
exports.getISOWeekUTC = function(date) {
	// Create a copy of this date object
	const target = new Date(date.valueOf());

	// ISO week date weeks start on monday
	// so correct the day number
	const dayNr = (date.getUTCDay() + 6) % 7;

	// ISO 8601 states that week 1 is the week
	// with the first thursday of that year.
	// Set the target date to the thursday in the target week
	target.setUTCDate(target.getUTCDate() - dayNr + 3);

	// Store the millisecond value of the target date
	const firstThursday = target.valueOf();

	// Set the target to the first thursday of the year
	// First set the target to january first
	target.setUTCMonth(0, 1);

	// Not a thursday? Correct the date to the next thursday
	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
	}

	// The weeknumber is the number of weeks between the
	// first thursday of the year and the thursday in the target week
	return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000
};

/**
 * UTC "year" verison of http://techblog.procurios.nl/k/news/view/33796/14863/calculate-iso-8601-week-and-year-in-javascript.html
 *
 * @param {Date} date
 * @returns {number}
 */
exports.getISOWeekYearUTC = function(date) {
	// Create a copy of this date object
	const target = new Date(date.valueOf());

	// ISO week date weeks start on monday
	// so correct the day number
	const dayNr = (date.getUTCDay() + 6) % 7;

	// ISO 8601 states that week 1 is the week
	// with the first thursday of that year.
	// Set the target date to the thursday in the target week
	target.setUTCDate(target.getUTCDate() - dayNr + 3);

	// Set the target to the first thursday of the year
	// First set the target to january first
	target.setUTCMonth(0, 1);

	// Not a thursday? Correct the date to the next thursday
	if (target.getUTCDay() !== 4) {
		target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
	}

	// The weeknumber is the number of weeks between the
	// first thursday of the year and the thursday in the target week
	return target.getUTCFullYear();
};
