/**
 * @module
 */
import DelegatingMap from './DelegatingMap';

/**
 * @class
 */
export default class DelegatingLazyMap extends DelegatingMap {
	constructor(factory, backing = new Map) {
		super(backing);
		this.factory = factory;
	}

	get(key) {
		if (!super.has(key)) {
			this.set(key, this.factory(key));
		}
		return super.get(key);
	}

	setFactory(fn) {
		this.factory = fn;
	}
}