/** os.ds.roomshardpos.js */
'use strict';

class RoomShardPos extends RoomPosition {
	constructor(x, y, roomName, shardName = Game.shard.name) {
		super(x, y, roomName);
		this.shardName = shardName;
	}

	findClosestByPath() {
		if (Game.shard.name !== this.shard)
			return ERR_NOT_FOUND;
		return super.findClosestByPath.apply(this, arguments);
	}

	findClosestByRange() {
		if (Game.shard.name !== this.shard)
			return ERR_NOT_FOUND;
		return super.findClosestByRange.apply(this, arguments);
	}

	findInRange() {
		if (Game.shard.name !== this.shard)
			return ERR_NOT_FOUND;
		return super.findInRange.apply(this, arguments);
	}

	// @todo find portal?
	findPathTo(target) {
		if (Game.shard.name !== this.shard || target.shard && target.shard !== Game.shard.name)
			return ERR_NOT_FOUND;
		return super.findPathTo.apply(this, arguments);
	}

	getDirectionTo(target) {
		if (Game.shard.name !== this.shard || target.shard && target.shard !== Game.shard.name)
			return ERR_NOT_FOUND;
		return super.getDirectionTo.apply(this, arguments);
	}

	getRangeTo(roomShardPos) {
		if (this.shard !== roomShardPos.shard)
			return Infinity;
		return super.getRangeTo(roomShardPos);
	}
}

module.exports = RoomShardPos;