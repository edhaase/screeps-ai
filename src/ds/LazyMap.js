/**
 * @module
 */

import BaseMap from './BaseMap';

/**
 * @class
 */
export default class LazyMap extends BaseMap {
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