/**  */
'use strict';

class LazyWeakMap extends WeakMap {
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
}

module.exports = LazyWeakMap;