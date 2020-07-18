
/**
 * Attempt to obstacle exits. Requires origin point.
 */
export function exitPlanner(roomName, opts = {}) {
	const {
		origin = Game.rooms[roomName].getOrigin().pos,
		visualize = true, visualizePath = true, visualizeOrder = true,
		param = FIND_EXIT,
		commit = false,
		sort = true,
		ignorePlan = false } = opts;
	const cm = new PathFinder.CostMatrix;
	const room = Game.rooms[roomName];
	const visual = (room && room.visual) || new RoomVisual(roomName);
	const exits = room.find(param).map(e => ({ pos: e, range: 0 }));
	if (!exits || !exits.length)
		return ERR_NOT_FOUND;
	if (!ignorePlan) {
		room.find(FIND_STRUCTURES).forEach(({ pos, structureType }) => {
			if (structureType === STRUCTURE_ROAD)
				cm.set(pos.x, pos.y, 1); // Required to consider tunnels
			if (structureType === STRUCTURE_RAMPART || OBSTACLE_OBJECT_TYPES.includes(structureType))
				cm.set(pos.x, pos.y, 255);
		});
	}
	/* eslint no-constant-condition: 0 */
	const params = { roomCallback: () => cm, maxRooms: 1 };
	let order = [];
	while (true) {
		const { path, incomplete } = PathFinder.search(origin, exits, params);
		if (incomplete)
			break;
		const pos = path[path.length - 3];
		cm.set(pos.x, pos.y, 255);
		const wallOrRampart = (pos.x + pos.y) % 3;
		const type = wallOrRampart ? STRUCTURE_WALL : STRUCTURE_RAMPART;
		if (!pos.hasStructure(type))
			order.push({ pos, type });
		if (visualize) {
			if (visualizePath)
				visual.poly(path);
			visual.circle(pos, { fill: (wallOrRampart ? 'black' : 'green'), opacity: 0.75 });
		}
	}
	if (sort)
		order = _.sortBy(order, ({ pos }) => pos.y << 16 | pos.x);
	var i = 0;
	for (const { pos, type } of order) {
		if (visualizeOrder)
			visual.text(i++, pos);
		if (commit)
			room.addToBuildQueue(pos, type);
	}
};
