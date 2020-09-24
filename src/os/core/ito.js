/** /os/core/ito.js - Intertick proxy objects */
'use strict';

import { ActorHasCeasedError } from '/os/core/errors';

class ITOHandler {
	constructor(id, collectionName = null) {
		this.id = id;
		this.coll = collectionName;
	}

	getPrototypeOf() {
		return Object.getPrototypeOf(this.getCurrentGameObject());
	}

	getOwnPropertyDescriptor(t, prop) {
		return Object.getOwnPropertyDescriptor(this.getCurrentGameObject(), prop);
	}

	has(t, prop) {
		const obj = this.getCurrentGameObject();
		return prop in obj;
	}

	get(t, prop) {
		const obj = this.getCurrentGameObject();
		return obj[prop];
	}

	set(t, prop, v) {
		const obj = this.getCurrentGameObject();
		obj[prop] = v;
		return true;
	}

	deleteProperty(t, prop) {
		const obj = this.getCurrentGameObject();
		delete obj[prop];
	}

	ownKeys() {
		const obj = this.getCurrentGameObject();
		return Object.keys(obj);
	}

	apply(t, thisArg, args) {
		const obj = this.getCurrentGameObject();
		return obj.apply(thisArg, args);
	}

	getCurrentGameObject() {
		const actor = (this.coll) ? Game[this.coll][this.id] : Game.getObjectById(this.id);
		if (actor == null)
			throw new ActorHasCeasedError(this.id);
		return actor;
	}
}

export default {
	make: function (id, collection = null) {
		return new Proxy({}, new ITOHandler(id, collection));
	},
	flag: function (name) {
		return new Proxy({}, new ITOHandler(name, 'flags'));
	},
	room: function (name) {
		return this.make(name, 'rooms');
	}
};