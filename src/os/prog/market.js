/** os.prog.market.js - Market management */
'use strict';

/* global ENVC, Market */

const Co = require('os.core.co');
const Process = require('os.core.process');

const DEFAULT_MARKET_ORDER_CLEANUP_FREQ = 100;
const MARKET_HISTORY_FREQUENCY = 16;
const EMPIRE_MARKET_RESYNC_FREQUENCY = 4095;

class MarketProc extends Process {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
	}

	*run() {
		this.startThread(this.removeOldOrders, null, undefined, 'Old order cleanup');
		this.startThread(this.updateMarketHistory, null, undefined, 'Market transaction tracking');
		while (true) {
			global.RESOURCE_THIS_TICK = RESOURCES_ALL[Game.time % RESOURCES_ALL.length];
			if (!(Game.time & EMPIRE_MARKET_RESYNC_FREQUENCY))
				Market.resyncEmpireCredits();
			yield;
		}
	}

	*updateMarketHistory() {
		while (!(yield)) {
			if (Game.time % MARKET_HISTORY_FREQUENCY) // Currently must poll on modulo
				continue;
			Market.updateMarket(MARKET_HISTORY_FREQUENCY);
		}
	}

	*removeOldOrders() {
		while (true) {
			const delay = ENVC('market.order_cleanup_freq', DEFAULT_MARKET_ORDER_CLEANUP_FREQ, 1);
			yield this.sleepThread(delay);
			this.debug(`Removing old orders`);
			if (_.isEmpty(Game.market.orders))
				continue;
			_(Game.market.orders).filter(o => o.remainingAmount <= 1).each(o => Game.market.cancelOrder(o.id)).commit();
		}
	}
}

module.exports = MarketProc;