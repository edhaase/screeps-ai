/** /os/core/inspector.js - Prototype inspection */
'use strict';

// @todo usage of code tags in display

/**
 * Categorize and group object properties
 */
export function getPropertiesByGroups(proto) {
	const descriptors = Object.getOwnPropertyDescriptors(proto);
	const entries = Object.entries(descriptors);
	const groups = {
		'constants': [],
		'hidden': [],
		'functions': [],
		'getters': [],
		'setters': [],
		'other': [],
	};
	for (const [key, descriptor] of entries) {
		const hasValue = !!descriptor.value;
		const hasGetter = !!descriptor.get; //  Can stringify
		const hasSetter = !!descriptor.set;
		if (hasGetter)
			groups['getters'].push(key);
		if (hasSetter)
			groups['setters'].push(key);
		if (!hasValue)
			continue;
		const { configurable, value, enumerable, writable } = descriptor;
		if (value instanceof Function)
			groups['functions'].push(key);
		else if (configurable === false || writable === false)
			groups['constants'].push(key);
		if (enumerable === false)
			groups['hidden'].push(key);
	}
	return groups;
};

export function findProperty(start, prop) {
	for (var proto = start; proto != null; proto = proto.__proto__) { // Not quite working
		if (Object.getOwnPropertyDescriptor(proto, prop) !== undefined)
			return proto.constructor;
	}
	return undefined;
};

/**
 * Dump a very rough view of an object or prototype
 */
export function inspect(proto) {
	return JSON.stringify(getPropertiesByGroups(proto), null, 2);
};

/**
 * Extract the parameter string from a function
 */
const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
// const ARGUMENT_NAMES = /([^\s,]+)/g;
export function getParamStr(func) {
	const fnStr = func.toString().replace(STRIP_COMMENTS, '');
	const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')); // .match(ARGUMENT_NAMES);
	return (result || []);
};