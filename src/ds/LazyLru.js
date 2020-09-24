/**
 * @module
 */
import DelegatingLazyMap from './dele/DelegatingLazyMap';
import Lru from './Lru';

/**
 * @class
 */
export default class LazyLru extends DelegatingLazyMap {
	constructor(factory, opts) { // backing = new Map) {
		const backing = new Lru(opts);
		super(factory, backing);
	}
}
