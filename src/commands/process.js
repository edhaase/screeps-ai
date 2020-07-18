import * as Cmd from '/os/core/commands';
import * as Process from '/os/core/process';

const CMD_CATEGORY = 'Process';

function start(name, opts) {
	// @todo call start process
	kernel.startProcess(name, opts);
}

function reinitAll() {
	global.killAll();
	global.startProcess('cron');
	global.startProcess('intershard');
	global.startProcess('empire');
	global.startProcess('legacy', { title: 'Creep runner', collection: 'creeps', identifier: 'name' });
	global.startProcess('legacy', { title: 'Powercreep runner', collection: 'powerCreeps', identifier: 'name' });
	global.startProcess('legacy', { title: 'Structure runner', collection: 'structures', identifier: 'id', frequency: 5 });
	global.startProcess('legacy', { title: 'Flag runner', collection: 'flags', identifier: 'name' });
	global.startProcess('legacy.rooms', { title: 'Room runner' });
	global.startProcess('stats');
	global.startProcess('market');
	global.startProcess('intel');
	global.startProcess('recon');
	global.startProcess('spawn');
}

function reinitCron() {
	const [cron] = global.kernel.getProcessByName('cron');
	cron.init();
}

function kill(pid) {
	kernel.killProcess(pid);
}

function stop(pid, timeout = undefined) {
	kernel.stopProcess(pid, timeout);	// graceful shutdown
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
	const wrap = function* () {
		const tsbegin = Date.now();
		const begin = Game.cpu.getUsed();
		const result = yield* co;
		const delta = _.round(Game.cpu.getUsed() - begin, 3);
		const tsdelta = Date.now() - tsbegin;
		console.log(`<details><summary>Thread result {~used ${delta} cpu, ${tsdelta / 1000} seconds)</summary>${ex(result)}</details>`);
		return result;
	};
	// const thread = new kernel.threadClass(wrap(), 0, 'Worker');
	// return kernel.attachThread(thread, Process.PRIORITY_IDLE, 0);
	return kernel.startThread(wrap, null, Process.PRIORITY_IDLE, 'Worker', kernel.pid);
}


Cmd.register('getProcessByName', gpbn, 'Find all processes with name', ['gpbn', 'pidof'], CMD_CATEGORY);
Cmd.register('kill', kill, 'Kill a process by pid', [], CMD_CATEGORY);
Cmd.register('killAll', killAll, 'Terminate all running processes', [], CMD_CATEGORY);
Cmd.register('killThread', killThread, 'Terminate a running thread by id', [], CMD_CATEGORY);
Cmd.register('reinitAll', reinitAll, 'Reinitialize process table', ['init'], CMD_CATEGORY);
Cmd.register('reinitCron', reinitCron, '', [], CMD_CATEGORY);
Cmd.register('spark', spark, 'Create thread for coroutine', [], CMD_CATEGORY);
Cmd.register('startProcess', start, 'Launch a process', ['start'], CMD_CATEGORY);
Cmd.register('stop', stop, 'Attempt to gracefully stop a process', [], CMD_CATEGORY);