/** os-commands.js - Global console commands */
'use strict';

const Cmd = require('os.core.commands');
const Process = require('os.core.process');

/* global kernel, ENV, ROOM_LINK */

function proc(sortBy = ENV('commands.proc.default_sort', 'pid'), order = ['asc']) {
	const sorted = _.sortByOrder([...kernel.process.values()], sortBy, order);
	if (!sorted || !sorted.length)
		return "No processes";
	const head = `<th>pid/name</th><th>ppid/name</th><th>#threads</th><th>totalCpu</th><th>minCpu</th><th>avgUsrCpu</th><th>avgSysCpu</th><th>maxCpu</th><th>age</th><th>title</th>`;
	const rows = _.map(sorted, r => `<td>${r.pid}/${r.name}</td><td>${(r.parent && r.parent.pid) || '-'}/${(r.parent && r.parent.name) || '-'}</td><td>${r.threads.size}</td><td>${_.round(r.totalCpu, 5)}</td><td>${_.round(r.minCpu, 5)}</td><td>${_.round(r.avgUsrCpu, 5)}</td><td>${_.round(r.avgSysCpu, 5)}</td><td>${_.round(r.maxCpu, 5)}</td><td>${Game.time - r.born}</td><td>${r.title || '-'}</td>`);
	const body = _.map(rows, r => `<tr>${r}</tr>`);
	return `<table style='width: 50vw'><thead><tr>${head}</tr></thead><tbody>${body.join('')}</tbody></table`;
}

function threadReport(pid, sortBy = ENV('commands.threads.default_sort', 'pid'), order = ['asc']) {
	// @todo show threads for process
	// [...kernel.threads.values()]
	const allThreads = [...kernel.threads.values()];
	const threads = (pid !== undefined) ? _.filter(allThreads, 'pid', pid.toString()) : allThreads;
	const sorted = _.sortByOrder(threads, sortBy, order);
	if (!sorted || !sorted.length)
		return "No processes";
	const head = `<th>pid/name</th><th>tid</th><th>state</th><th>priority</th><th>cpuLastTick</th><th>minCpu</th><th>avgUsrCpu</th><th>avgSysCpu</th><th>maxCpu</th><th>age</th><th>desc</th>`;
	const rows = _.map(sorted, t => {
		const p = kernel.process.get(t.pid) || {};
		const asleep = (t.sleep && Game.time < t.sleep) || (p.sleep && Game.time < p.sleep);
		const state = (asleep) ? 'SLEEP' : t.state;
		return `<td>${t.pid}/${p.name}</td><td>${t.tid}</td><td>${state}</td><td>${t.priority}</td><td>${_.round(t.lastTickSysCpu, 5)} (${_.round(t.lastTickUsrCpu, 5)})</td><td>${_.round(t.minTickCpu, 5)}</td><td>${_.round(t.avgUsrTickCpu, 5)}</td><td>${_.round(t.avgSysTickCpu, 5)}</td><td>${_.round(t.maxTickCpu, 5)}</td><td>${Game.time - t.born}</td><td>${t.desc || '-'}</td>`;
	});
	const body = _.map(rows, r => `<tr>${r}</tr>`);
	return `<table style='width: 60vw'><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table`;
}

function thr(pid, sortBy = ENV('commands.threads.default_sort', 'pid'), order = ['asc']) {
	const allThreads = [...kernel.threads.values()];
	const threads = (pid !== undefined) ? _.filter(allThreads, 'pid', pid) : allThreads;
	const sorted = _.sortByOrder(threads, sortBy, order);
	if (!sorted || !sorted.length)
		return "No processes";
	const head = `<th>tid</th><th>state</th><th>priority</th><th>cpuLastTick</th><th>minCpu</th><th>avgUsrCpu</th><th>avgSysCpu</th><th>maxCpu</th><th>age</th><th>desc</th>`;
	const grouped = _.groupBy(sorted, 'pid');
	var results = '';
	for (const group of Object.keys(grouped)) {
		const process = kernel.process.get(group);
		const th = grouped[group];
		const rows = _.map(th, t => {
			const p = kernel.process.get(t.pid) || {};
			const asleep = (t.sleep && Game.time < t.sleep) || (p.sleep && Game.time < p.sleep);
			const state = (asleep) ? 'SLEEP' : t.state;
			return `<tr><td>${t.tid}</td><td>${state}</td><td>${t.priority}</td><td>${_.round(t.lastTickSysCpu, 5)} (${_.round(t.lastTickUsrCpu, 5)})</td><td>${_.round(t.minTickCpu, 5)}</td><td>${_.round(t.avgUsrTickCpu, 5)}</td><td>${_.round(t.avgSysTickCpu, 5)}</td><td>${_.round(t.maxTickCpu, 5)}</td><td>${Game.time - t.born}</td><td>${t.desc || '-'}</td></tr>`;
		});
		const tbl = `<table style='width: 60vw; margin-bottom: 5px'><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
		results += `<details><summary>${group}/${process.friendlyName}&#9; (${th.length})</summary>${tbl}</details>`;
	}
	// return `<ul>${results}</ul>`;
	return results;
}

function playerReport() {
	const intel = gpbn('intel')[0].intel.threats;
	const sorted = _.sortByOrder(Object.entries(intel), ([v, k]) => k, ['asc']);
	const head = `<th>Name</th><th>Score</th>`;
	const body = _.map(sorted, ([name, score]) => `<tr><td>${name}</td><td>${JSON.stringify(score)}</td></tr>`);
	return `<table style='width: 50vw'><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table`;
}

function pagerReport() {
	const head = `<th>Page Hit / Miss</th><th>IOW</th><th>IOR</th> <th>PW</th> <th>PR</th> <th>Active</th><th>Cached</th>`;
	const total = PAGE_HIT + PAGE_MISS;
	const hitpct = _.round(PAGE_HIT / total, 1);
	const rows = `<tr><td>${PAGE_HIT} - ${PAGE_MISS} (${hitpct}%)</td><td>${PAGE_IO_WRITE}</td><td>${PAGE_IO_READ}</td> <td>${PAGE_WRITES.size}</td>  <td>${PAGE_REQUESTS.size}</td> <td>${_.size(RawMemory.segments)}<td>${PAGE_CACHE.size}</td></tr>`;
	return `<table style='width: 20vw'><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table`;
}

function events(sortBy = 'event', order = ['asc']) {
	const allEvents = _(Game.rooms).map(r => r.events).flatten().value();
	const lookup = _(global).pick((v, k) => k.startsWith('EVENT_') && !k.startsWith('EVENT_ATTACK_') && !k.startsWith('EVENT_HEAL_')).invert().value();
	const sorted = _.sortByOrder(allEvents, sortBy, order);
	for (const event of sorted) {
		event.eventName = lookup[event.event];
		event.object = Game.getObjectById(event.objectId);
		if (!event.data)
			continue;
		if (event.data.targetId) {
			event.target = Game.getObjectById(event.data.targetId);
			delete event.data.targetId;
		}

	}
	const head = `<th>Event</th><th>Object</th><th>Pos</t><th>Target</th><th>Data</th>`;
	const rows = _.map(sorted, r => `<tr><td>${r.eventName || r.event || '-'}</td><td>${r.object || '-'}</td><td>${(r.object && r.object.pos) || '-'}</td><td>${r.target || '-'}</td><td>${JSON.stringify(r.data)}</td></tr>`);
	return `<table style='width: 60vw'><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table`;
}

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

function progress() {
	const [statsProc] = kernel.getProcessByName('stats');
	if (!stats)
		return "Stats not available at this time";
	const ticksTilGCL = (Game.gcl.progressTotal - Game.gcl.progress) / statsProc.stats.gclAverageTick;
	var str = `Time till GCL ${(Game.gcl.level + 1)}: ${Time.estimate(ticksTilGCL)} ${Log.progress(Game.gcl.progress, Game.gcl.progressTotal)} \n`;
	_(Game.rooms)
		.map('controller')
		.filter('my')
		.filter(c => c.level < 8)
		// .each(c => console.log("Room: " + c.room.name + ", RCL: " + (c.level+1) + ", " + c.estimate()))
		.each(c => str += `Room: ${ROOM_LINK(c.room.name)}, RCL: ${(c.level + 1)}, ${c.estimate()} ${Log.progress(c.room.controller.progress, c.room.controller.progressTotal)}, ${_.round(c.memory.rclAvgTick, 2)} e/t \n`)
		.commit();
	return str;
}

function stats() {
	console.log(`Bucket: ${Game.cpu.bucket}`);
	console.log(`Rooms: ${_.size(Game.rooms)}`);
	console.log(`Creeps: ${_.size(Game.creeps)}`);
	console.log(`Structures: ${_.size(Game.structures)}`);
	console.log(`Flags: ${_.size(Game.flags)}`);
	console.log(`Construction sites: ${_.size(Game.constructionSites)}`);

	const cbr = _.groupBy(Game.creeps, 'memory.role');
	for (const [role, creeps] of Object.entries(cbr)) {
		const sorted = _.sortByOrder(creeps, 'pos.roomName', ['asc']);
		const rows = _.map(sorted, c => `<li>${c} ${ROOM_LINK(c.pos.roomName, undefined, c.pos)}</li>`);
		console.log(`<details><summary>${role} (${creeps.length})</summary><ul>${rows.join('')}</ul></details>`);
	}
	// console.log(ex(_.countBy(Game.creeps, 'memory.role')));
}

function hl(x, radius = 5) {
	x.room.visual.circle(x.pos, { fill: 'red', radius, lineStyle: 'dashed' });
}

function terminals() {
	var output = '<table>';
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	const rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my', false) && r.terminal != null));
	const te = _.map(rooms, 'terminal');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	// const headers = ['res'].concat(_.map(rooms, r => ROOM_LINK(r.name)));
	const headers = ['res'].concat(_.map(rooms, r => r.name));
	let rows = _.map(RESOURCES_ALL, function (res) {
		const stored = _.map(te, t => _.get(t, ['store', res], 0));
		return [`<font color=${RES_COLORS[res]}>${res}</font>`].concat(stored);
	});
	rows = _.filter(rows, r => _.any(r, v => v > 0));
	const totals = _.map(te, 'total');
	const credits = _.map(te, t => Math.floor(t.credits));
	rows.unshift(['total'].concat(totals));
	rows.unshift(['credits'].concat(credits));
	output += '</table>';
	console.log(Log.table(headers, rows));
}

function storage() {
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	const rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my', false) && r.storage != null));
	const sts = _.map(rooms, 'storage');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	const headers = ['res'].concat(_.map(rooms, 'name'));
	let rows = _.map(RESOURCES_ALL, function (res) {
		const stored = _.map(sts, t => _.get(t, `store.${res}`, 0));
		return [res].concat(stored);
	});
	rows = _.filter(rows, r => _.any(r, v => v > 0));
	const totals = _.map(sts, 'total');
	rows.unshift(['total'].concat(totals));
	console.log(Log.table(headers, rows));
}

function nukers() {
	const nks = _.filter(Game.structures, s => s.structureType === STRUCTURE_NUKER);
	const head = `<th>Room</th><th>Armed</th><th>Ready</th><th>Cooldown</th><th>Energy</th><th>Ghodium</th>`;	
	const rows = _.map(nks, n => `<tr><td>${n.pos.roomName}</td><td>${n.armed}</td><td><font color="${n.ready?'#00FF00':'#FF0000'}">${n.ready}</font></td><td>${n.cooldown||'-'}</td><td>${~~(100*n.energy/n.energyCapacity)}%</td><td>${n.ghodium} / ${n.ghodiumCapacity}</td></tr>`).join('');
	const tbl = `<table style='width: 20vw'><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table`;
	return tbl.replace(/([WE])(\d+)([NS])(\d+)/gi, r => ROOM_LINK(r));
}

function launchNuke(roomPos)  {
	if (!roomPos)
		return `Invalid target`;
	const nuker = _.find(Game.structures, s => s.structureType === STRUCTURE_NUKER && s.ready && Game.map.getRoomLinearDistance(s.pos.roomName, roomPos.roomName)  && s.isActive());
	if (!nuker)
		return `No available nuker`;
	return nuker.launchNuke(roomPos);
}

function clearWatches() {
	return `<script>var memory = angular.element($('.memory-watch')).scope().MemoryMain; memory.watches.filter(w => w.path !== "").forEach(w => memory.removeWatch(w.path));</script>`;
}

function showRoom(roomName, shard = Game.shard.name) {
	return `<script>window.location.href = '#!/room/${shard}/${roomName}'</script>`;
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

Cmd.register('getProcessByName', gpbn, 'Find all processes with name', ['gpbn', 'pidof']);
Cmd.register('highlight', hl, 'Highlight a given object in the current room', ['hl']);
Cmd.register('kill', kill, 'Kill a process by pid');
Cmd.register('killAll', killAll, 'Terminate all running processes');
Cmd.register('killThread', killThread, 'Terminate a running thread by id');
Cmd.register('reinitAll', reinitAll, 'Reinitialize process table', ['init']);
Cmd.register('reinitCron', reinitCron);
Cmd.register('spark', spark, 'Create thread for coroutine');
Cmd.register('startProcess', start, 'Launch a process', ['start']);
Cmd.register('stop', stop, 'Attempt to gracefully stop a process');

Cmd.register('launchNuke', launchNuke, 'Launch a nuke at a target room');

Cmd.register('events', events, 'Show recent event log for all rooms', [], 'Reporting');
Cmd.register('pager', pagerReport, 'Show paging report', [], 'Reporting');
Cmd.register('proc', proc, 'Show process table', ['ps'], 'Reporting');
Cmd.register('progress', progress, 'Show room and GCL progress', [], 'Reporting');
Cmd.register('stats', stats, 'Show empire stats for this shard', [], 'Reporting');
Cmd.register('storage', storage, 'Show storage report', [], 'Reporting');
Cmd.register('terminals', terminals, 'Show terminal report', [], 'Reporting');
Cmd.register('nukers', nukers, 'Show armament report', [], 'Reporting');
Cmd.register('thbyps', thr, 'List threads grouped by process', [], 'Reporting');
Cmd.register('threads', threadReport, 'Show threads', [], 'Reporting');

Cmd.register('clearWatches', clearWatches, 'Clear the memory watch', ['cw'], 'GUI');
Cmd.register('showRoom', showRoom, 'Switch the GUI to a room', [], 'GUI');

const Inspector = require('os.core.ins.inspector');
Cmd.register('explain', (x) => JSON.stringify(x, null, 2), 'Explain (Pretty print an object)', ['ex'], 'Inspector');
Cmd.register('getParamStr', Inspector.getParamStr, 'Show the parameter names for a function', ['params'], 'Inspector');
Cmd.register('inspect', Inspector.inspect, 'Inspect an object or prototype', ['ins'], 'Inspector');
Cmd.register('prop_find', Inspector.findProperty, 'Find a property in a prototype chain', ['propf'], 'Inspector');

Cmd.register('players', playerReport, 'Show players and their threat scores', [], 'Threat Management');
// Cmd.register('influence', influenceReport, 'Reports on influence', [],  'Threat Management');