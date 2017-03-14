'use strict';

const LOG_VERSION = 0;
const util = require('util');
const path = require('path');
const libBase = path.join(__dirname, '../');
const hasOwnProp = Object.prototype.hasOwnProperty;

const sourceMapSupport = (function() {
	try {
		return require('source-map-support' + '');
	}
	catch (_) {
		return null;
	}
})();

exports.LEVELS = {
	TRACE: 10,
	trace: 10,
	DEBUG: 20,
	debug: 20,
	INFO: 30,
	info: 30,
	WARN: 40,
	warn: 40,
	ERROR: 50,
	error: 50,
	FATAL: 60,
	fatal: 60,
};

exports.LEVEL_TO_NAME = {
	10: 'TRACE',
	20: 'DEBUG',
	30: 'INFO',
	40: 'WARN',
	50: 'ERROR',
	60: 'FATAL',
};

exports.safeObjClone = function(val) {
	return _safeObjClone(new Set(), val);
};

function formatMsg(args) {
	try {
		switch (args.length) {
			case 0:
				return util.format('');
			case 1:
				return util.format(args[0]);
			case 2:
				return util.format(args[0], args[1]);
			case 3:
				return util.format(args[0], args[1], args[2]);
			case 4:
				return util.format(args[0], args[1], args[2], args[3]);
			default:
				return util.format.apply(null, args);
		}
	}
	catch (err) {
		return throwsMessage(err);
	}
}

/*
 * Gather some caller info 3 stack levels up.
 * See <http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi>.
 */
exports.getCaller3Info = function getCaller3Info(callerDepth) {
	if (this === undefined) {
		// Cannot access caller info in 'strict' mode.
		return;
	}
	const obj = {};
	const saveLimit = Error.stackTraceLimit;
	const savePrepare = Error.prepareStackTrace;
	Error.stackTraceLimit = callerDepth > 0 ? callerDepth + 1 : 2;

	Error.prepareStackTrace = function(_, stack) {
		let caller = stack[callerDepth > 0 ? callerDepth : 1];
		if (sourceMapSupport) {
			caller = sourceMapSupport.wrapCallSite(caller);
		}
		obj.file = caller.getFileName();
		obj.line = caller.getLineNumber();
		const func = caller.getFunctionName();
		if (func) {
			obj.func = func;
		}
	};
	Error.captureStackTrace(this, getCaller3Info);
	this.stack;

	Error.stackTraceLimit = saveLimit;
	Error.prepareStackTrace = savePrepare;
	return obj;
};

exports.makeLogRecord = function(level, args, options) {
	const includeSrc = options && options.includeSrc;
	const callerDepth = options && options.callerDepth;

	let fields;

	if (args[0] instanceof Error) {
		fields = { err: args[0] };
		args = args.length > 1 ? args.slice(1) : null;
	}
	else if (args[0] !== null && typeof args[0] === 'object') {
		fields = args[0];
		args = args.slice(1);
	}

	if (fields && fields.err && (!args || args.length === 0)) {
		args = [fields.err.message];
	}

	const rec = {
		time: new Date().toISOString(),
		level,
		msg: args ? formatMsg(args) : '',
	};

	if (fields) {
		Object.keys(fields).forEach(function(prop) {
			try {
				rec[prop] = fields[prop];
			}
			catch (err) {
				rec[prop] = throwsMessage(err);
			}
		});
	}

	if (includeSrc && !rec.src) {
		rec.src = exports.getCaller3Info(callerDepth);
	}

	rec.v = LOG_VERSION;

	return exports.safeObjClone(rec);
};

exports.formatLogRecord = function(rec, exclude) {
	exclude = new Set(['v', 'msg'].concat(exclude || []));
	const message = [];
	const details = [];
	const extras = [];
	let clonedRec = false;

	if (!exclude.has('time')) {
		exclude.add('time');
		message.push(`${rec.time}`);
	}

	if (!exclude.has('level')) {
		exclude.add('level');
		message.push(`[${exports.LEVEL_TO_NAME[rec.level] || `LVL${rec.level}`}]`);
	}

	if (rec.msg.indexOf('\n') !== -1) {
		details.push(indent(rec.msg));
	}
	else {
		message.push(rec.msg);
	}

	if (!exclude.has('src') && rec.src) {
		exclude.add('src');
		const s = rec.src;
		if (s.func && !exclude.has('src.func')) {
			message.push(util.format('(%s:%d in %s)', path.relative(libBase, s.file), s.line, s.func));
		}
		else {
			message.push(util.format('(%s:%d)', path.relative(libBase, s.file), s.line));
		}
	}

	if (rec.err && rec.err.stack && !exclude.has('err')) {
		exclude.add('err');

		const err = rec.err;

		details.push(indent(
			typeof err.stack !== 'string' ? err.stack.toString() : err.stack
		));

		// E.g. for extra 'foo' field on 'err', add 'err.foo' at
		// top-level. This *does* have the potential to stomp on a
		// literal 'err.foo' key.
		Object.keys(err).forEach(function(k) {
			if (k !== 'message' && k !== 'name' && k !== 'stack') {
				if (!clonedRec) {
					rec = _safeShallowObjClone(rec);
					clonedRec = true;
				}

				try {
					rec['err.' + k] = err[k];
				}
				catch (err) {
					rec['err.' + k] = throwsMessage(err);
				}
			}
		});
	}

	Object.keys(rec).forEach(function(key) {
		if (!exclude.has(key)) {
			let value = rec[key];
			let stringified = false;

			if (value == null) {
				value = String(value);
				stringified = true;
			}
			else if (typeof value !== 'string') {
				value = JSON.stringify(value, null, 2);
				stringified = true;
			}

			if (value.indexOf('\n') !== -1 || value.length > 50) {
				details.push(indent(key + ': ' + value));
			}
			else if (!stringified && (value.indexOf(' ') !== -1 || value.length === 0)) {
				extras.push(key + '=' + JSON.stringify(value));
			}
			else {
				extras.push(key + '=' + value);
			}
		}
	});

	return message.join(' ')
		+ (extras.length ? ' (' + extras.join(', ') + ')' : '')
		+ (details.length ? '\n' + details.join('\n    --\n') : '');
};

function throwsMessage(err) {
	return '[Throws: ' + (err ? err.stack || err.message : '?') + ']';
}

function _safeShallowObjClone(obj) {
	return Object.keys(obj).reduce(function(result, prop) {
		try {
			result[prop] = obj[prop];
		}
		catch (err) {
			result[prop] = throwsMessage(err);
		}
		return result;
	}, {});
}

function _safeObjClone(lookup, obj) {
	if (obj === null || typeof obj !== 'object') {
		return obj;
	}

	if (lookup.has(obj)) {
		return '[Circular]';
	}

	lookup.add(obj);

	if (typeof obj.toJSON === 'function') {
		try {
			return _safeObjClone(lookup, obj.toJSON());
		}
		catch (err) {
			return throwsMessage(err);
		}
	}

	if (Array.isArray(obj)) {
		return obj.map(function(v) {
			return _safeObjClone(lookup, v);
		});
	}

	const keys = obj instanceof Error
		? ['name', 'message', 'stack', 'code', 'signal'].concat(Object.keys(obj))
		: Object.keys(obj);

	return keys.reduce(function(result, prop) {
		try {
			if (hasOwnProp.call(obj, prop)) {
				result[prop] = _safeObjClone(lookup, obj[prop]);
			}
		}
		catch (err) {
			result[prop] = throwsMessage(err);
		}
		return result;
	}, {});
}

function indent(s) {
	return '    ' + s.split(/\r?\n/).join('\n    ');
}
