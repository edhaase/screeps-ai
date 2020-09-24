import Region from '/ds/Region';
import PriorityQueue from '/ds/PriorityQueue';

const kRouteGrid = 30;

/**
 * 
 * @param {*} fromRoom 
 * @param {*} toRooms 
 * @param {*} opts 
 * 
 * @todo implement portal support
 */
export function findRoute(fromRoom, toRooms, opts) {
	fromRoom = fromRoom.name || fromRoom;
	if (fromRoom == toRoom)
		return [];
	const [fromX, fromY] = Region.roomNameToCoord(fromRoom);
	const goals = toRooms.map(rN => Region.roomNameToCoord(rN));

	if (goals.some(([toX, toY]) => fromX === toX && fromY === toY))
		return [];

	originX = fromX + kRouteGrid;
	originY = fromY + kRouteGrid;

	const q = new PriorityQueue();
	// heap = new Heap(Math.pow(kRouteGrid * 2, 2), Float64Array);
	// openClosed = new OpenClosed(Math.pow(kRouteGrid * 2, 2));
	if (!parents) {
		parents = new Uint16Array(Math.pow(kRouteGrid * 2, 2));
	}
	// var fromIndex = xyToIndex(fromX, fromY);
	// heap.push(fromIndex, heuristic(fromX, fromY));
	const routeCallback = (opts && opts.routeCallback) || function () { return 1; };

	var item = null;
	while (item = q.shift()) {
		// Pull node off heap
		// let index = heap.min();
		// let fcost = heap.minPriority();

		// Close this node
		// heap.pop();
		// openClosed.close(index);

		// Calculate costs
		let [xx, yy] = indexToXY(index);
		let hcost = heuristic(xx, yy);
		let gcost = fcost - hcost;

		// Reached destination?
		if (hcost === 0) {
			let route = [];
			while (index !== fromIndex) {
				let [xx, yy] = indexToXY(index);
				index = parents[index];
				let [nx, ny] = indexToXY(index);
				let dir;
				if (nx < xx) {
					dir = C.FIND_EXIT_RIGHT;
				} else if (nx > xx) {
					dir = C.FIND_EXIT_LEFT;
				} else if (ny < yy) {
					dir = C.FIND_EXIT_BOTTOM;
				} else {
					dir = C.FIND_EXIT_TOP;
				}
				route.push({
					exit: dir,
					room: utils.getRoomNameFromXY(xx, yy),
				});
			}
			route.reverse();
			return route;
		}

		// Add neighbors
		const fromRoomName = utils.getRoomNameFromXY(xx, yy);
		const exits = describeExits(fromRoomName);
		for (const dir in exits) {

			// Calculate costs and check if this node was already visited
			const roomName = exits[dir];
			const graphKey = fromRoomName + ':' + roomName;
			const [xx, yy] = utils.roomNameToXY(roomName);
			const neighborIndex = xyToIndex(xx, yy);
			if (neighborIndex === undefined || openClosed.isClosed(neighborIndex)) {
				continue;
			}
			const cost = Number(routeCallback(roomName, fromRoomName)) || 1;
			if (cost === Infinity) {
				continue;
			}

			const fcost = gcost + heuristic(xx, yy) + cost;
			// Add to or update heap
			if (openClosed.isOpen(neighborIndex)) {
				if (heap.priority(neighborIndex) > fcost) {
					heap.update(neighborIndex, fcost);
					parents[neighborIndex] = index;
				}
			} else {
				heap.push(neighborIndex, fcost);
				openClosed.open(neighborIndex);
				parents[neighborIndex] = index;
			}
		}
	}

	return C.ERR_NO_PATH;
}