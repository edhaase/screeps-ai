/** os.ds.path.js - PathFinder.search wrapper */
'use strict';

const BaseArray = require('os.ds.array');

class Path extends BaseArray {
	/** Path creation */
	static search(src, dst, opts) {
		const { path, ops, cost, incomplete } = PathFinder.search(src, dst, opts);
		if (!path || !path.length)
			return new Path();

		Object.setPrototypeOf(path, this.prototype);
		path.ops = ops;
		path.cost = cost;
		path.incomplete = incomplete;
		return path;
	}

	/** Serialization */
	static deserialize() {

	}

	serialize() {

	}

	toString() {
		return `[Path ${this.cost} ${this.ops} ${this.incomplete}]`;
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
		return _.any(this, rp => rp.hasRoad());
	}

	// Return path array without roads
	withoutRoad() {
		return this.filter(rp => rp.hasRoad() === false);
	}

	withoutConstructionSites() {
		return this.filter(rp => _.findWhere(Game.constructionSites, { pos: rp }) == null);
	}

}

module.exports = Path;