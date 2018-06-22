/**
 * DataStructures.js
 */
'use strict';

/**
 * Delgating maps pass calls through to another map structure. 
 * Implemented to combine the lazy map with the 
 */
class DelegatingMap extends Map
{
	/**
	 * Allows an underlying map implementation choice. Great for use with the LRU map.
	 * @param {Map} backing - The real storage map
	 */
	constructor(backing) {
		super();
		this.store = backing || new Map;
	}

	clear() { return this.store.clear(); }
	delete(k) { return this.store.delete(k); }
	entries() { return this.store.entries(); }
	forEach(cbFn, thisArg) { return this.store.forEach(cbFn,thisArg); }
	get(k) { return this.store.get(k); }
	has(k) { return this.store.has(k); }
	keys() { return this.store.keys(); }
	set(k,v) { return this.store.set(k,v); }	
	values() { return this.store.values(); }
	*[Symbol.iterator]() { yield *this.store;  }

	get length() { return this.store.length; }
	get size() { return this.store.size; }
}

/**
 * Lazy map generates keys as requested
 */
class LazyMap extends DelegatingMap {
	/**
	 * @param {function} factory - Factory function for creating values we need
	 * @param {Map} backing - Storage map
	 */
	constructor(factory, backing=new Map()) {
		super(backing);
		this.factory = factory;
	}

	// get?
	get(k) {
		let v = super.get(k);
		if(!v) {
			v = this.factory(k);
			super.set(k,v);
		}
		return v;
	}
}

/**
 * Simplified priority queue. Comparable to heap.
 */
class PriorityQueue extends Array {
	constructor(scoreFn, scorer = _.sortedLastIndex) {
		super();
		this.scoreFn = scoreFn;
		this.scorer = scorer;
	}

	push(elem) {
		return this.splice(
			this.scorer(this, elem, x => -this.scoreFn(x))
			, 0, elem);
	}

	remove(elem) {
		this.splice(this.indexOf(elem), 1);
	}

	rescoreElement(elem) {
		this.remove(elem);
		this.push(elem);
	}

	size() { return this.length; }
}

module.exports = {
	DelegatingMap,
	LazyMap,
	PriorityQueue
};