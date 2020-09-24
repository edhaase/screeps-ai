/**
 * @module
 */

/**
 * @class
 */
export default class LazyWeakMap extends WeakMap {
	constructor(factory, itr) {
		super(itr);
		this.factory = factory;
	}

	get(key) {
		if (!super.has(key)) {
			super.set(key, this.factory(key));
		}
		return super.get(key);
	}

	setFactory(fn) {
		this.factory = fn;
	}
}