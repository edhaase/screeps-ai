/**  */
'use strict';

const DelegatingMap = require('os.ds.dele.map');

class DelegatingLazyMap extends DelegatingMap {
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

}

module.exports = DelegatingLazyMap;