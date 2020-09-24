import * as Cmd from '/os/core/commands';
import { Log } from '/os/core/Log';
import { table } from '/lib/html';
import { ENV } from '/os/core/macros';

const CMD_CATEGORY = 'Service';
import SERVICES from '/services/index';

/**
 * Establish service memory
 */
if (!Memory.services)
	Memory.services = {};

/**
 * Start a service or return an existing, running service
 * 
 * @return Process
 * @param {*} name 
 */
export function startService(name) {
	if (!SERVICES[name])
		throw new Error(`No such service ${name}`);
	const pid = Memory.services[name];
	const running = global.kernel.getProcessByPid(pid);
	if (running) {
		Log.debug(`Service "${name}" already running`, 'Service');
		return running;
	}
	Log.info(`Starting service "${name}"`, 'Service');
	const process = global.kernel.startProcess(name);
	Memory.services[name] = process.pid;
	return process;
}

/**
 * 
 * @param {*} name 
 */
export function stopService(name) {
	if (!SERVICES[name])
		throw new Error(`No such service ${name}`);
	const pid = Memory.services[name];
	const running = global.kernel.getProcessByPid(pid);
	delete Memory.services[name];
	if (!running)
		return Log.info(`Service "${name}" already stopped`, 'Service');	
	Log.info(`Stopping service "${name}"`, 'Service');
	const timeout = ENV('service.shutdown_grace_period');
	global.kernel.stopProcess(pid, timeout);
}

/**
 * 
 */
export function showServices() {
	const headers = [
		'Service',
		'Status',
		'PID/Name',
		'Title'
	];
	const rows = [];
	for (const serviceName of Object.keys(SERVICES)) {
		const pid = Memory.services[serviceName];
		const r = global.kernel.getProcessByPid(pid);
		rows.push([
			serviceName,
			r ? '<font color="green">ACTIVE</font>' : '<font color="red">STOPPED</font>',
			r ? `${r.pid}/${r.name}` : `-/-`,
			r ? `${r.title || '-'}` : '-'
		]);
	}
	return table(headers, rows, {
		tableStyle: 'width: 50vw',
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	});
}

/**
 * 
 */
Cmd.register('startService', startService, 'Launch a service', [], CMD_CATEGORY);
Cmd.register('stopService', stopService, 'Stop a service', [], CMD_CATEGORY);
Cmd.register('showServices', showServices, 'List service states', ['services'], CMD_CATEGORY);