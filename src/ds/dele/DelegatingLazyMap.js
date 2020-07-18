/**  */
'use strict';

import DelegatingMap from './DelegatingMap';

export default class DelegatingLazyMap extends DelegatingMap {
	constructor(factory, backing = new Map) {
		super(backing);
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