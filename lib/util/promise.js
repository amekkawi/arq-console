'use strict';

exports.PromiseTry = function(fn) {
	return new Promise((resolve) => {
		resolve(fn());
	});
};

exports.PromiseIterate = function(arr, fn) {
	arr = arr.slice(0);
	let i = 0;
	return exports.PromiseTry(next);

	function next() {
		if (i < arr.length) {
			const item = arr[i++];
			return fn(item, i, arr);
		}
	}
};
