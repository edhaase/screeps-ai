/** /os/core/profiler.js - Dynamic prototype wiring (Instrumentation) */
'use strict';

import * as Inspector from '/os/core/ins/inspector';

/**
 * 
 * 
 * @todo Filter by `this` arg
 * @todo Blacklist property names
 * @todo Set default prototypes
 * @todo Property access logging
 * @todo Profiling
 * 
 */

// Features
// Can unpatch prototypes
// Can watch property getters

const PROTOTYPES = {}; // Stores original prototype to unwire
const CALL_STACK = [];

const BLACKLIST = ['toString', 'constructor', 'toJSON'];

// Inpsect, show stuff on console
// Wire
// Unwire
// Show list of hooks
class PropertyNotConfigurable extends Error { }
class InvalidUsage extends Error { }

//  ex(Object.getOwnPropertyDescriptors(Object.getOwnPropertyDescriptor(Creep.prototype, 'threat')))

export class Intercept {
	constructor(proto, prop) {
		this.proto = proto;
		this.prop = prop;
		this.patch = null;
		this.prev = null;
		this.isPatched = false;
	}

	get descriptor() {
		return Reflect.getOwnPropertyDescriptor(this.proto, this.prop);
	}

	get canPatch() {
		return !!this.descriptor.configurable;
	}

	hook() {
		if (this.isPatched)
			throw new InvalidUsage();
		if (!this.canPatch)
			throw new PropertyNotConfigurable();
		this.orig = this.descriptor;
		this.patch.configurable = true; // In case we forget, a patch must always be configurable so we can remove it
		this.isPatched = true;
		console.log(`Patching ${this.prop}`);
		return Reflect.defineProperty(this.proto, this.prop, this.patch);
	}

	unhook() {
		if (!this.isPatched)
			throw new InvalidUsage();
		if (!this.canPatch)
			throw new PropertyNotConfigurable();
		this.isPatched = false;
		return Reflect.defineProperty(this.proto, this.prop, this.orig);
	}
}

export class FunctionIntercept extends Intercept {
	constructor(proto, prop) {
		super(proto, prop);
		const orig = this.descriptor.value;
		const patch = function () {
			CALL_STACK.push([prop]);
			if (CALL_STACK.length > 3)
				console.log(`${this} stack: ${CALL_STACK}`);
			try {
				return orig.apply(this, arguments);
			} finally {
				// @todo log time spent, hidden errors eaten
				CALL_STACK.pop();
			}
		};
		this.patch = { writable: false, value: patch };
	}
};

export class PropertyIntercept extends Intercept {
	constructor(proto, prop) {
		super(proto, prop);
		const orig = this.descriptor.get;
		const patch = function () {
			CALL_STACK.push([prop]);
			try {
				console.log(`${prop} hook called with ${this}`);
				return orig.apply(this, arguments);
			} finally {
				// @todo log time spent, hidden errors eaten
				CALL_STACK.pop();
			}
		};
		this.patch = { get: patch, enumerable: false };
	}
};

export function HookAll(proto) {
	if (!proto.hooks) {
		proto.hooks = new Map();
		const { functions } = Inspector.getPropertiesByGroups(proto);
		for (const f of functions) {
			if (BLACKLIST.includes(f))
				continue;
			proto.hooks.set(f, new exports.FunctionIntercept(proto, f));
		}

	}
	return proto.hooks;
};