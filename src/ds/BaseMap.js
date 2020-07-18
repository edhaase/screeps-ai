/** /ds/BaseMap.js - Map extensions */
'use strict';

export default class BaseMap extends Map {
	sort(fn, order = ['desc']) {
		const en = [...this.entries()];
		return _.sortByOrder(en, fn, order);
	}

	sortKeys(fn, order) {
		return _.sortByOrder([...this.keys()], fn, order);
	}

	sortValues(fn, order) {
		return _.sortByOrder([...this.values()], fn, order);
	}

	sum(fn) {
		var total = 0;
		for (const [, v] of this)
			total += (v[fn] || fn(v));
		return total;
	}

	incr(key) {
		return this.set(key, this.get(key) + 1);
	}

	decr(key) {
		return this.set(key, this.get(key) - 1);
	}

	invoke(method, ...args) {
		for (const item of this.values())
			item[method](...args);
	}
}