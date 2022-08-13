import * as Cmd from '/os/core/commands';
import { DATETIME_FORMATTER, estimate } from '/lib/time';
import { ENV, ROOM_LINK } from '/os/core/macros';
import { NUMBER_FORMATTER, to_precision, to_fixed } from '/lib/util';
import { table, html_hsl_span, html_truefalse_span } from '/lib/html';
import { Log, LOG_LEVEL } from '/os/core/Log';

import report_audit from './reports/audit';
import { events } from './reports/events';
import { proc } from './reports/proc';
import { market, orders } from './reports/market';

const CMD_CATEGORY = 'Reporting';

function nukers() {
	const nks = _.filter(Game.structures, s => s.structureType === STRUCTURE_NUKER);
	const head = `<th>Room</th><th>Armed</th><th>Ready</th><th>Cooldown</th><th>Energy</th><th>Ghodium</th>`;
	const rows = _.map(nks, n => `<tr><td>${n.pos.roomName}</td><td>${n.armed}</td><td><font color="${n.ready ? '#00FF00' : '#FF0000'}">${n.ready}</font></td><td>${n.cooldown || '-'}</td><td><span style='color:hsl(${~~(100 * n.energy / n.energyCapacity)},100%,50%)'>${~~(100 * n.energy / n.energyCapacity)}%</span></td><td>${n.ghodium} / ${n.ghodiumCapacity}</td></tr>`).join('');
	const tbl = `<table style='width: 20vw'><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table`;
	return tbl.replace(/([WE])(\d+)([NS])(\d+)/gi, r => ROOM_LINK(r));
}

function pagerReport() {
	const head = `<th>Page Hit / Miss</th><th>IOW</th><th>IOR</th> <th>PW</th> <th>PR</th> <th>Active</th><th>Cached</th>`;
	const total = PAGE_HIT + PAGE_MISS;
	const hitpct = _.round(PAGE_HIT / total, 1);
	const rows = `<tr><td>${PAGE_HIT} - ${PAGE_MISS} (${hitpct}%)</td><td>${PAGE_IO_WRITE}</td><td>${PAGE_IO_READ}</td> <td>${PAGE_WRITES.size}</td>  <td>${PAGE_REQUESTS.size}</td> <td>${_.size(RawMemory.segments)} [${Object.keys(RawMemory.segments)}]<td>${PAGE_CACHE.size}</td></tr>`;
	return `<table style='width: 20vw'><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table`;
}

function progress() {
	const [statsProc] = kernel.getProcessByName('stats');
	if (!statsProc)
		return "Stats not available at this time";
	const ticksTilGCL = (Game.gcl.progressTotal - Game.gcl.progress) / statsProc.stats.gclAverageTick;
	var str = `Time till GCL ${(Game.gcl.level + 1)}: ${DATETIME_FORMATTER.format(estimate(ticksTilGCL))} ${Log.progress(Game.gcl.progress, Game.gcl.progressTotal)} \n`;
	_(Game.rooms)
		.map('controller')
		.filter('my')
		.filter(c => c.level < 8)
		// .each(c => console.log("Room: " + c.room.name + ", RCL: " + (c.level+1) + ", " + c.estimate()))
		.each(c => str += `Room: ${ROOM_LINK(c.room.name)}, RCL: ${(c.level + 1)}, ${DATETIME_FORMATTER.format(c.estimate())} ${Log.progress(c.room.controller.progress, c.room.controller.progressTotal)}, ${_.round(c.memory.rclAvgTick, 2)} e/t \n`)
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

function storage() {
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	const rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my', false) && r.storage != null));
	const storages = _.map(rooms, 'storage');
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	const headers = ['res'].concat(_.map(rooms, r => `<span>${r.name}</span>`));
	var rows = [];
	for (const res of RESOURCES_ALL) {
		const row = [`<font color=${RES_COLORS[res]}>${res}</font>`];
		var total = 0;
		for (const t of storages) {
			const used = t.store.getUsedCapacity(res);
			total += used;
			if (res !== RESOURCE_ENERGY) {
				row.push(`<span>${used}</span>`);
			} else {
				const pct = 120 * Math.min(1.0, t.stock);
				row.push(`<span style='color:hsl(${pct},100%,50%)'>${used}</span>`);
			}
		}
		if (total > 0)
			rows.push(row);
	}
	// rows = _.filter(rows, r => _.any(r, v => v > 0));
	const totals = _.map(storages, t => `<span>${t.total}</span>`);
	rows.unshift(['total'].concat(totals));
	return table(headers, rows, {
		tableStyle: 'width: 90vw',
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	});
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

function terminals() {
	var output = '<table>';
	// border under headers, alternate color
	// Game.getObjectById('579faa680700be0674d30ef3').progressTotal - Game.getObjectById('579faa680700be0674d30ef3').progress
	const rooms = _.filter(Game.rooms, r => (_.get(r, 'controller.my', false) && r.terminal != null));
	const te = _.compact(_.map(rooms, 'terminal'));
	// let terminals = _.map(rooms, r => Game.rooms[r].terminal);
	// const headers = ['res'].concat(_.map(rooms, r => ROOM_LINK(r.name)));
	const headers = ['res'].concat(_.map(rooms, r => ['text-align: right', r.name]));
	let rows = _.map(RESOURCES_ALL, function (res) {
		const stored = _.map(te, t => ["style='text-align: right'", t.store[res]]);
		return [`<font color=${RES_COLORS[res]}>${res}</font>`].concat(stored);
	});
	rows = _.filter(rows, r => _.any(r, ([s, v]) => v > 0));
	const totals = _.map(te, t => ["style='text-align: right; padding-left: 5px'", NUMBER_FORMATTER.format(t.total)]);
	// const credits = _.map(te, t => ["style='text-align: right; padding-left: 3px'", Math.floor(t.credits)]);
	const credits = _.map(te, t => ["style='text-align: right; padding-left: 5px'", NUMBER_FORMATTER.format(Math.floor(t.credits))]);
	rows.unshift(['total'].concat(totals));
	rows.unshift(['credits'].concat(credits));
	output += '</table>';
	return table(headers, rows, {
		tableStyle: 'width: 90vw',
		trStyle: "tr:nth-child(even) { background-color: #333; }"
	});
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

function nukersInRange(destRoomName) {
	const in_range = _.filter(Game.structures, s => s.structureType === STRUCTURE_NUKER && s.isInRange(destRoomName));
	const available = _.filter(in_range, s => s.armed && s.ready);
	const in_range_rooms = in_range.map(s => s.pos.roomName).join(', ');
	const available_rooms = available.map(s => s.pos.roomName).join(', ');
	return `In range: ${in_range_rooms}<br><br>Available: ${available_rooms}`;
}

// @todo reformat
global.memLargestKey = function () {
	return _.max(Object.keys(Memory), k => JSON.stringify(Memory[k]).length);
};

global.largestKey = function (a) {
	return _.max(Object.keys(a), k => JSON.stringify(a[k]).length);
};

global.memStats = function () {
	// return ex(_.transform(Memory, (r,n,k) => r[k] = JSON.stringify(Memory[k]).length, {} ));
	return ex(_.mapValues(Memory, (v) => JSON.stringify(v).length));
};

Cmd.register('audit', report_audit, 'Show audit report for all rooms', [], CMD_CATEGORY);
// Cmd.register('census', report_census, 'Show census report for all rooms', [], CMD_CATEGORY);
Cmd.register('events', events, 'Show recent event log for all rooms', [], CMD_CATEGORY);
Cmd.register('market', market, 'Show market report', [], CMD_CATEGORY);
Cmd.register('nukers', nukers, 'Show armament report', [], CMD_CATEGORY);
Cmd.register('nukersInRange', nukersInRange, 'Show ready nukers in range of room', [], CMD_CATEGORY);
Cmd.register('orders', orders, 'Show current market orders', [], CMD_CATEGORY);
Cmd.register('pager', pagerReport, 'Show paging report', [], CMD_CATEGORY);
Cmd.register('proc', proc, 'Show process table', ['ps'], CMD_CATEGORY);
Cmd.register('progress', progress, 'Show room and GCL progress', [], CMD_CATEGORY);
Cmd.register('stats', stats, 'Show empire stats for this shard', [], CMD_CATEGORY);
Cmd.register('storage', storage, 'Show storage report', [], CMD_CATEGORY);
Cmd.register('terminals', terminals, 'Show terminal report', [], CMD_CATEGORY);
Cmd.register('thbyps', thr, 'List threads grouped by process', [], CMD_CATEGORY);
Cmd.register('threads', threadReport, 'Show threads', [], CMD_CATEGORY);