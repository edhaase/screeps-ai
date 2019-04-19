/** algo.map.enclosure */
'use strict';
/**
 * Check if a room is reachable from the world.
 * 
 * Algo.isRoomEnclosed('W7N2', {ignore: r => Game.rooms[r] && Game.rooms[r].my})
 * _.filter(Game.rooms, r => r.my && !Algo.isRoomEnclosed(r.name));
 * [room W7N3],[room W7N4],[room W8N4]
 */

exports.isRoomEnclosed = function isRoomEnclosed(start, opts = {}) {
	_.defaults(opts, {
		ignore: r => Game.rooms[r] && Game.rooms[r].my,
		avoid: (r, EW, NS) => Game.rooms[r] && Game.rooms[r].owned && !Game.rooms[r].my
	});
	var exit, roomName, rooms = [start];
	for (var i = 0; i < rooms.length; i++) {
		roomName = rooms[i];
		// console.log('Checking ' + roomName);
		var [, EW, NS] = /[EW](\d+)[NS](\d+)/.exec(roomName);
		// Center or highway
		if ((EW % 10 === 0 || NS % 10 === 0) || (EW % 10 === 5 && NS % 10 === 5)
			|| (opts.avoid && opts.avoid(roomName, EW, NS)))
			return false;
		var neighbors = _.values(Game.map.describeExits(roomName));
		while ((exit = neighbors.shift())) {
			if (rooms.includes(exit) || (opts.ignore && opts.ignore(exit)))
				continue;
			rooms.push(exit);
		}
	}
	return true;
};