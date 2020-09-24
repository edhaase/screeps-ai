/**
 * @module
 */

import BaseArray from './BaseArray';

/**
 * @class
 */
export default class Path {
	constructor(path, ops, cost, incomplete) {
		this.path = path;
		this.ops = ops;
		this.cost = cost;
		this.incomplete = incomplete;
	}

	/** Path creation */
	static search(src, dst, opts) {
		if (!(src instanceof RoomPosition))
			throw new TypeError(`Expected parameter 0 of type RoomPosition`);
		if (!dst)
			throw new TypeError(`Expected parameter 1 of not-null`);
		const { path, ops, cost, incomplete } = PathFinder.search(src, dst, opts);
		if (!path || !path.length)
			return new Path();
		return new Path(path, ops, cost, incomplete);
	}

	/** Serialization */
	static deserialize() {

	}

	serialize() {

	}

	/** Helpers */
	all(fn) {
		return _.all(this, fn);
	}

	any(fn) {
		return _.any(this, fn);
	}

	/**
	 * Check if any portion of the path has road
	 */
	hasRoad() {
		return _.any(this, rp => rp.hasStructure(STRUCTURE_ROAD));
	}

	// Return path array without roads
	withoutRoad() {
		return this.filter(rp => rp.hasRoad() === false);
	}

	withoutConstructionSites() {
		return this.filter(rp => _.findWhere(Game.constructionSites, { pos: rp }) == null);
	}

	toString() {
		return `[Path ${this.path.length} steps ${this.cost} cost ${this.ops} ops ${this.incomplete ? 'incomplete' : 'complete'}]`;
	}
}