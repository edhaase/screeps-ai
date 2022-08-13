/**
 * @module
 */
import { ENV } from '/os/core/macros';
import LazyLru from '/ds/LazyLru';
import CostMatrix from '/ds/CostMatrix';

const DEFAULT_COST_MATRIX_EXPIRATION = ENV('cm.cache_expire', 5);
const DEFAULT_COST_MATRIX_CACHE_SIZE = ENV('cm.cache_size', 200);

/**
 * @class
 */
export default class CostMatrixCache extends LazyLru {
	constructor(factory, name, ttl = DEFAULT_COST_MATRIX_EXPIRATION, max = DEFAULT_COST_MATRIX_CACHE_SIZE) {
		super(factory, { name, ttl, max });
		this.freeze = true;
	}

	/**
	 * Set a cost matrix for a given room name
	 * 
	 * @param {*} roomName 
	 * @param {*} costMatrix
	 */
	set(k, v) {
		if (v && v instanceof CostMatrix && this.freeze) {
			v.freeze();
		}
		return super.set(k, v);
	}

	/**
	 * Fetch and clone a cost matrix for a room
	 * 
	 * @param {string} roomName
	 */
	copy(k) {
		const v = this.get(k);
		if (!v)
			return null;
		return v.clone();
	}
}