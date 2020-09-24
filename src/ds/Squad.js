/**
 * @module
 */
import BaseArray from "./BaseArray";
import { createShardLocalUUID } from '/os/core/uuid';
import { Log, LOG_LEVEL } from '/os/core/Log';

if (!Memory.groups) {
	Log.warn(`Initializing group memory`, 'Memory');
	Memory.groups = {
		squads: {}, memory: {}
	};
}

/**
 * @classdesc Represents a group of creeps
 */
export default class Squad {
	constructor(members = [], id = createShardLocalUUID()) {
		this.members = members;
		this.id = id;
		if (!Memory.groups.memory[this.id])
			Memory.groups.memory[this.id] = {};
	}

	[Symbol.iterator]() {
		return [];
	}

	get memory() {
		return Memory.groups.memory[this.id];
	}

	setRole(role) {
		this.invoke('setRole', 'recycle');
	}

	toString() {
		return `[Squad ${this.id}]`;
	}

	serialize() {

	}

	static deserialize() {

	}
}