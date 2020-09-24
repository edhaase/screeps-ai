/**
 * Flood fill code
 * https://en.wikipedia.org/wiki/Breadth-first_search
 *
 * @param {RoomPosition} pos - starting position
 *
 * ex: floodFill(controller.pos)
 * ex: floodFill(new RoomPosition(46,19,'E58S41'), {limit: 128, validator: (pos) => Game.map.getTerrainAt(pos) !== 'wall' && !pos.hasObstacle()})
 */
'use strict';

import { getColorBasedOnPercentage } from '/lib/util';

export function floodFill(pos, {
	validator = (pos) => !pos.isOnRoomBorder() && !pos.hasObstacle(true),
	stop = () => false,		// stop condition
	limit = 150,
	oddeven = false,
	visualize = true,
} = {}) {
	var start = Game.cpu.getUsed();
	var s = new PathFinder.CostMatrix;
	var q = [pos];
	var rtn = [];
	var room = Game.rooms[pos.roomName];
	var count = 0;
	var visual = (room) ? room.visual : (new RoomVisual(pos.roomName));
	while (q.length) {
		var point = q.shift();
		if (count++ > limit)
			break;
		// This isn't firing, so we're only here if this a good point.
		// visual.circle(point, {fill: 'yellow'});
		//	continue;			
		rtn.push(point);

		// if(goalMet?)
		// return;
		var adj = point.getAdjacentPoints();
		_.each(adj, function (n) {
			if (s.get(n.x, n.y))
				return;
			s.set(n.x, n.y, 1);
			if (!validator(n)) {
				if (visualize)
					visual.circle(n, { fill: 'red', opacity: 1.0 });
			} else {
				var color = getColorBasedOnPercentage(100 * (count / limit));
				// var color = HSV_COLORS[Math.floor(100*(count / limit))];
				if (oddeven && (n.x + n.y) % 2 === 0)
					color = 'blue';
				if (visualize)
					visual.circle(n, { fill: color, opacity: 1.0 });
				// room.visual.circle(n, {fill: 'green'});
				q.push(n);
			}
		});
	}

	var used = Game.cpu.getUsed() - start;
	console.log(`Used: ${used}, Count: ${count}`);
	return rtn;
};