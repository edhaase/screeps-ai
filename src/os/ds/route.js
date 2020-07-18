/** os.ds.route.js */
'use strict';

class Route extends Array {

	static findRoute(fromRoom, toRoom, opts) {
		const route = Game.map.findRoute(fromRoom, toRoom, opts);
		if (route === ERR_NO_PATH)
			return route;
		return Object.setPrototypeOf(route, this.prototype);
	}

	isAvailable() {
		// return _.all(this, rn => Game.map.isRoomAvailable(rn));
	}
}

module.exports = Route;