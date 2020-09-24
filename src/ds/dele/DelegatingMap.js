/**
 * @module
 */
import BaseMap from '../BaseMap';

/**
 * @class
 */
export default class DelegatingMap extends BaseMap {
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
	forEach(cbFn, thisArg) { return this.store.forEach(cbFn, thisArg); }
	get(k) { return this.store.get(k); }
	has(k) { return this.store.has(k); }
	keys() { return this.store.keys(); }
	set(k, v) { return this.store.set(k, v); }
	values() { return this.store.values(); }
	*[Symbol.iterator]() { yield* this.store; }

	get size() { return this.store.size; }
}