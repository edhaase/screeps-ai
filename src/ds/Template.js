/**
 * @module
 */

/**
 * @classdesc Structure layout template
 */
export default class Template {
	constructor(template) {
		Object.assign(this, JSON.parse(JSON.stringify(template)));
	}

	getArea() {
		return this.width * this.height;
	}

	forEachPos(fn, filter) {
		const { buildings } = this;
		for (const type in buildings) {
			for (const pos of buildings[type].pos) {
				if (filter && !filter(pos, type))
					continue;
				fn(pos, type);
			}
		}
		return this;
	}

	transform(dx, dy, filter) {
		this.forEachPos(function (pos) {
			pos.x += dx;
			pos.y += dy;
		});
		return this;
	}

	normalize() {
		var mx = Infinity, my = Infinity;
		this.forEachPos(function (pos) {
			if (pos.x < mx) mx = pos.x;
			if (pos.y < my) my = pos.y;
		});
		return this.transform(-mx, -my);
	}

	merge(template) {
		template.forEachPos((pos, type) => {
			this.buildings[type].push(pos);
		})
		return this;
	}

	flipHorizontal(axis) {

	}

	flipVertical(axis) {

	}

	stamp(roomName, offset, destroy = false) {
		const room = Game.rooms[roomName];
		if (!room)
			throw new Error(`Missing visibility`);
		const [dx, dy] = offset;
		if (destroy)
			this.bulldoze(roomName, offset);
		this.forEachPos((pos, structureType) => {
			const x = pos.x + dx;
			const y = pos.y + dy;
			room.addToBuildQueue({ x, y }, structureType, DEFAULT_BUILD_JOB_EXPIRE, STRUCTURE_BUILD_PRIORITY[structureType]);
		});
	}

	bulldoze(roomName, offset) {
		const room = Game.rooms[roomName];
		if (!room)
			throw new Error(`Missing visibility`);
		const [dx, dy] = offset;
		this.forEachPos((pos, structureType) => {
			const x = pos.x + dx;
			const y = pos.y + dy;
			const rpos = new RoomPosition(x, y, roomName);
			const obstacles = rpos.lookFor(LOOK_STRUCTURES);
			_.invoke(obstacles, 'destroy');
		});
	}

	toString() {
		return `[Template ${this.name}]`;
	}
}