/** os.core.lock.rw.js - Locking mechanisms */
'use strict';

const X = {};
const S = {};

module.exports = class {
	static *exclu(name, co, timeout = Infinity) {
		while (X[name])
			yield;
		X[name] = 1;
		try {
			while (S[name] > 0)
				yield;
			// do stuff
		} finally {
			delete X[name];
		}
	}

	static *shared(name, co, timeout = Infinity) {
		while (X[name]) // exclusive locks take precendence
			yield;
		S[name] = (S[name] || 0) + 1;
		try {
			// do stuff
		} finally {
			S[name] = S[name] - 1;
		}
	}
};