import * as Cmd from '/os/core/commands';
import Process from '/os/core/process';
import { startService } from './service';

const CMD_CATEGORY = 'Process';

function startProcess(name, opts) {
	// @todo call start process
	kernel.startProcess(name, opts);
}

function stopProcess(pid, timeout = undefined) {
	kernel.stopProcess(pid, timeout);	// graceful shutdown
}

function reinitAll() {
	global.killAll();
	startService('cron');
	startService('empire');
	startService('intel');
	startService('intershard');
	startService('market');
	global.startProcess('legacy', { title: 'Creep runner', collection: 'creeps', identifier: 'name' });
	global.startProcess('legacy', { title: 'Powercreep runner', collection: 'powerCreeps', identifier: 'name' });
	global.startProcess('legacy', { title: 'Structure runner', collection: 'structures', identifier: 'id', frequency: 5 });
	global.startProcess('legacy', { title: 'Flag runner', collection: 'flags', identifier: 'name' });
	global.startProcess('legacy.rooms', { title: 'Room runner' });
	global.startProcess('stats');
	global.startProcess('recon');
}

function reinitCron() {
	const [cron] = global.kernel.getProcessByName('cron');
	cron.init();
}

function kill(pid) {
	kernel.killProcess(pid);
}

function killAll() {
	for (const [pid,] of kernel.process) {
		if (pid === kernel.pid)
			continue;
		kernel.killProcess(pid);
	}
	kernel.proc = [];
}

function killThread(tid) {
	kernel.killThread(tid);
}

function gpbn(name) {
	return kernel.getProcessByName(name);
}

function spark(co) {
	if (typeof co === 'function')
		throw new TypeError(`Expected generator`);
	const tkbegin = Game.time;
	const tsbegin = Date.now();
	const thread = new kernel.threadClass(co, kernel.pid, 'Worker');
	kernel.attachThread(thread, Process.PRIORITY_IDLE, 0);
	thread.complete((result, err) => {
		const delta = thread.totalCpu;
		const tsdelta = Date.now() - tsbegin;
		const tkdelta = Game.time - tkbegin;
		console.log(`<details><summary>Thread result (~used ${delta} cpu, ${tsdelta / 1000} second(s), ${tkdelta} tick(s))</summary>${ex(result || err)}</details>`);
	});
	return thread;
}


Cmd.register('getProcessByName', gpbn, 'Find all processes with name', ['gpbn', 'pidof'], CMD_CATEGORY);
Cmd.register('kill', kill, 'Kill a process by pid', [], CMD_CATEGORY);
Cmd.register('killAll', killAll, 'Terminate all running processes', [], CMD_CATEGORY);
Cmd.register('killThread', killThread, 'Terminate a running thread by id', [], CMD_CATEGORY);
Cmd.register('reinitAll', reinitAll, 'Reinitialize process table', ['init'], CMD_CATEGORY);
Cmd.register('reinitCron', reinitCron, '', [], CMD_CATEGORY);
Cmd.register('spark', spark, 'Create thread for coroutine', [], CMD_CATEGORY);
Cmd.register('startProcess', startProcess, 'Launch a process', ['start'], CMD_CATEGORY);
Cmd.register('stopProcess', stopProcess, 'Attempt to gracefully stop a process', ['stop'], CMD_CATEGORY);