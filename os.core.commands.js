/** os-commands.js - Global console commands */
'use strict';

/* global kernel */

global.ex = (x) => JSON.stringify(x, null, 2);

global.proc = function (sortBy = 'pid', order = ['asc']) {
	/* for (const [pid, process] of kernel.process) {
		console.log(`${process}`);
		// @todo display more
	} */
	const sorted = _.sortByOrder([...kernel.process.values()], sortBy, order);
	if (!sorted || !sorted.length)
		return "No processes";
	/* const keys  = Object.keys(sorted[0]);
	const head  = _.map(keys, k => `<th>${k}</th>`);
	const rows = _.map(sorted, r => _.map(keys, k => `<td>${r[k]}</td>`).join());
	const body = _.map(rows, r => `<tr>${r}</tr>`); */
	const head = `<th>pid/name</th><th>ppid/name</th><th>#threads</th><th>totalCpu</th><th>minCpu</th><th>avgUsrCpu</th><th>avgSysCpu</th><th>maxCpu</th><th>age</th><th>title</th>`;
	const rows = _.map(sorted, r => `<td>${r.pid}/${r.name}</td><td>${(r.parent && r.parent.pid) || '-'}/${(r.parent && r.parent.name) || '-'}</td><td>${r.threads.size}</td><td>${_.round(r.totalCpu, 5)}</td><td>${_.round(r.minCpu, 5)}</td><td>${_.round(r.avgUsrCpu, 5)}</td><td>${_.round(r.avgSysCpu, 5)}</td><td>${_.round(r.maxCpu, 5)}</td><td>${Game.time - r.born}</td><td>${r.title || '-'}</td>`);
	const body = _.map(rows, r => `<tr>${r}</tr>`);
	return `<table width='1200px'><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table`;
};

global.threads = function (pid, sortBy = 'pid', order = ['asc']) {
	// @todo show threads for process
	// [...kernel.threads.values()]
	const allThreads = [...kernel.threads.values()];
	const threads = (pid !== undefined) ? _.filter(allThreads, 'pid', pid) : allThreads;
	const sorted = _.sortByOrder(threads, sortBy, order);
	if (!sorted || !sorted.length)
		return "No processes";
	const head = `<th>pid/name</th><th>tid</th><th>state</th><th>priority</th><th>cpuLastTick</th><th>minCpu</th><th>avgUsrCpu</th><th>avgSysCpu</th><th>maxCpu</th><th>age</th><th>desc</th>`;
	const rows = _.map(sorted, t => {
		const p = kernel.process.get(t.pid) || {};
		return `<td>${t.pid}/${p.name}</td><td>${t.tid}</td><td>${t.state}</td><td>${t.priority}</td><td>${_.round(t.lastRunCpu, 5)}</td><td>${_.round(t.minCpu, 5)}</td><td>${_.round(t.avgUsrCpu, 5)}</td><td>${_.round(t.avgSysCpu, 5)}</td><td>${_.round(t.maxCpu, 5)}</td><td>${Game.time - t.born}</td><td>${t.desc || '-'}</td>`;
	});
	const body = _.map(rows, r => `<tr>${r}</tr>`);
	return `<table width='1200px'><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table`;
};

global.startProcess = function (name, opts) {
	// @todo call start process
	kernel.startProcess(name, opts);
};

global.reinitAll = function () {
	global.killAll();
	global.startProcess('cron');
	global.startProcess('intershard');
	global.startProcess('legacy', { title: 'Creep runner', collection: 'creeps', identifier: 'name' });
	global.startProcess('legacy', { title: 'Powercreep runner', collection: 'powerCreeps', identifier: 'name' });
	global.startProcess('legacy', { title: 'Structure runner', collection: 'structures', identifier: 'id' });
	global.startProcess('legacy', { title: 'Flag runner', collection: 'flags', identifier: 'name' });
	global.startProcess('legacy-rooms', { title: 'Room runner' });
	global.startProcess('stats');
	global.startProcess('market');
	global.startProcess('intel');
};

global.reinitCron = function () {
	const [cron] = global.kernel.getProcessByName('cron');
	cron.init();
};

global.kill = function (pid) {
	// @todo kill a process
	kernel.killProcess(pid);
};

global.killAll = function () {
	for (const [pid,] of kernel.process) {
		if (pid === 0)
			continue;
		kernel.killProcess(pid);
	}
};

global.killThread = function (tid) {
	kernel.killThread(tid);
};

global.gpbn = function(name) {
	return kernel.getProcessByName(name);
};

class Tag {
	constructor(name, content) {
		this.name = name;
		this.content = content;
	}

	toString() { return `<${this.name}>${this.content}</${this.name}>`; }

	static tr(content) { return new this('tr', content); }
	static td(content) { return new this('tr', content); }
	static table(keys, rows) { return new this('table', `<thead>${keys}</thread><tbody>${rows}</tbody>`); }
}
global.Tag = Tag;

/**
 * Convert any iterable into an easy-to-read table
 * @todo map rows _then_ sort
 */
global.tbl = function (itr, map, opts = {}) {
	const cols = Object.keys(map);
	const head = _.map(cols, k => `<th>${k}</th>`);
	const rows = [];
	for (const item of itr) {
		const row = [];
		if (opts.skip && opts.skip(item))
			continue;
		rows.push(row);
	}
	// const rows = _.map(sorted, r => _.map(keys, k => `<td>${r[k]}</td>`).join());
	// const body = _.map(rows, r => `<tr>${r}</tr>`); * /

	const style = `width='800px'`;
	const content = `<thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
	return `<table ${style}>${content}</table>`;
};