/**
 * Path.js
 *
 * ES6 class for path management
 */
'use strict';

/**
 * Extends PathFinder.search array
 */
class Path extends Array
{	
	/**
	 * Find a path
	 */
	static search(src, dst, opts) {
		let result = PathFinder.search(src, dst, opts);
		if(result.path)
			Object.setPrototypeOf(result.path, Path.prototype);
		return result;
	}

	/**
	 * Check if any portion of the path has road
	 */
	hasRoad() {
		return _.any(this, rp => rp.hasRoad());
	}
	
	// Return path array without roads
	withoutRoad() {
		return this.filter(rp => rp.hasRoad() == false);
	}
	
	withoutConstructionSites() {
		return this.filter(rp => _.findWhere(Game.constructionSites, {pos: rp}) == undefined);
	}
	
	without(fn) {
		return this.filter(fn);
	}
	
	/**
	 * @param String str - serialized form?
	 */
	/* constructor(src,dest,range=1, opts={}) {
		if( !(src instanceof RoomPosition) )
			throw new TypeError("Parameter 1 of Path expects RoomPosition");
		if( !(dest instanceof RoomPosition) )
			throw new TypeError("Parameter 2 of Path expects RoomPosition");
		if( !_.isNumber(range) )
			throw new TypeError("Parameter 3 of Path expects Number");
		
		
		let search = PathFinder.search(src, {pos: dest, range: range}, opts);
		if(!search || !search.path || search.path.length <= 0)
			throw new Error("No path");				
		search.path.unshift(fromPos);
		this.path = Route.compact(search.path);
	} */
	

	/**
	 * @param {RoomPosition} from
	 * @param {RoomPosition} to
	 */
	static findPath(from,to) {
		
	}
	
	static deserialize() {
		
	}
	
	serialize() {
		
	}
	
	toJSON() {
		
	}
}

module.exports = Path;