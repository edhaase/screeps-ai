/**
 * 
 * Examples:
 *  /cache/cm
 *  /cache/route
 *  /cache/path
 *  /facade
 *  /pager
 */
'use strict';

const devices = new Map();

/**
 * 
 * @param {*} name - Namespace name, i.e. /cache/cm/logistics
 * @param {*} device 
 */
export function register_device(name, device) {
	devices.set(name, device);
}

export function unregister_device(name) {
	devices.delete(name);
}

export function fetch_device(name) {
	return devices.get(name);
}

export function list_devices() {
	return devices.keys();
}