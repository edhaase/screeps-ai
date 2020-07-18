/**
 * Defines a map region containing rooms
 */
export default class Region {
	/**
	 * 
	 * @param {Array(2)} topLeft 
	 * @param {Array(2)} bottomRight 
	 */
	constructor(topLeftCoords, bottomRightCoords) {
		this.topLeftCoords = topLeftCoords; // Region.roomNameToCoord(topLeftName);
		this.bottomRightCoords = bottomRightCoords; // Region.roomNameToCoord(bottomRightName);
		this.topLeftName = Region.coordToRoomName(...topLeftCoords);
		this.bottomRightName = Region.coordToRoomName(...bottomRightCoords);
	}

	*getRoomsInRange(filter) {
		const [left, top] = this.topLeftCoords;
		const [right, bottom] = this.bottomRightCoords;
		var x, y;
		for (y = top; y <= bottom; y++) {
			for (x = left; x <= right; x++) {
				const roomName = Region.coordToRoomName(x, y);
				const roomStatus = Game.map.getRoomStatus(roomName);
				if (!roomStatus || roomStatus.status === 'closed')
					continue;
				if (filter && !filter(roomName, roomStatus))
					continue;
				yield roomName;
			}
		}
	}

	[Symbol.iterator]() {
		return this.getRoomsInRange();
	}

	contains(roomName) {
		const [wx, wy] = Region.roomNameToCoord(roomName);
		const [left, top] = this.topLeftCoords;
		const [right, bottom] = this.bottomRightCoords;
		return (wx >= left && wx <= right) && (wy >= top && wy <= bottom);
	}

	static coordToRoomName(wx, wy) {
		var result = "";
		result += (wx < 0 ? "W" + String(~wx) : "E" + String(wx));
		result += (wy < 0 ? "N" + String(~wy) : "S" + String(wy));
		return result;
	}

	static roomNameToCoord(roomName) {
		var [, h, wx, v, wy] = roomName.match(/^([WE])([0-9]+)([NS])([0-9]+)$/);
		wx = parseInt(wx);
		wy = parseInt(wy);
		if (h === 'W') wx = ~wx;
		if (v === 'N') wy = ~wy;
		return [wx, wy];
	}

	static fromCenter(center, range) {
		const [rx, ry] = Array.isArray(center) ? center : Region.roomNameToCoord(center);
		const topLeft = [rx - range, ry - range];
		const bottomRight = [rx + range, ry + range];
		return new this(topLeft, bottomRight);
	}

	toString() {
		return `[Region ${this.topLeftName} ${this.bottomRightName}]`;
	}
}