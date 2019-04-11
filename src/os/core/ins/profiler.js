/** os.core.profiler.js - Dynamic prototype wiring (Instrumentation) */
'use strict';

const { InvalidUsage, PropertyNotConfigurable } = require('os.core.ins.errors');

/**
 * Inpsect, show stuff on console
 * List of profiled actions
 * Show list of hooks
 * Automatically walk and patch entire chain
 */

const PROTOTYPES = {}; // Stores original prototype to unwire
const CALL_STACK = [];

const BLACKLIST = ['toString', 'constructor', 'toJSON'];


//  ex(Object.getOwnPropertyDescriptors(Object.getOwnPropertyDescriptor(Creep.prototype, 'threat')))

class Intercept {
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
} // Replace values with getters?

exports.FunctionIntercept = class FunctionIntercept extends Intercept {
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

exports.PropertyIntercept = class PropertyIntercept extends Intercept {
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
		this.patch = { get: patch, enumberable: false };
	}
};

exports.HookAll = function (proto) {
	if (!proto.hooks) {
		proto.hooks = new Map();
		const { functions } = this.getPropertiesByGroups(proto);
		for (const f of functions) {
			if (BLACKLIST.includes(f))
				continue;
			proto.hooks.set(f, new exports.FunctionIntercept(proto, f));
		}

	}
	return proto.hooks;
};