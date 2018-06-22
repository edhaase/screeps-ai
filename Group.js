/** Group.js - Unit Groups */
'use strict';

/**
 * Unit Group Logic
 */
RoomObject.prototype.setGroup = function(groupId) {
	// If no group, create group
};

RoomObject.prototype.getGroupMembers = function(groupId) {

};


/**
 * Unit groups - Assign groups and shared memory space
 */
Object.defineProperty(RoomObject.prototype, 'group', {
	set: function (value) {
		this.memory.gid = value;
	},
	get: function () {
		if (this === RoomObject.prototype)
			return null;
		return this.memory.gid;
	},
	configurable: true,
	enumerable: false
});

Object.defineProperty(RoomObject.prototype, 'gmem', {
	get: function () {
		var id = this.group;
		if (this === RoomObject.prototype || id == null)
			return null;
		if (!Memory.groups)
			Memory.groups = {};
		if (!Memory.groups[id])
			Memory.groups[id] = {};
		return Memory.groups[id];
	},
	configurable: true
});