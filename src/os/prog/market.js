/** os.prog.market.js - Market management */
'use strict';

/* global ENVC, Market, SEGMENT_MARKET, Log */

const Co = require('os.core.co');
const Process = require('os.core.process');
const PagedProcess = require('os.core.process.paged');

const DEFAULT_MARKET_ORDER_CLEANUP_FREQ = 100;
const MARKET_HISTORY_FREQUENCY = 16;
const EMPIRE_MARKET_RESYNC_FREQUENCY = 4095;

const Intel = require('Intel');

class MarketProc extends PagedProcess {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.pageIds = [SEGMENT_MARKET];
	}

	onPageCorrupted(pageId) {
		return {
			empire: { credits: 0 },
			history: { lastTickInc: Game.time - MARKET_HISTORY_FREQUENCY, lastTickOut: Game.time - MARKET_HISTORY_FREQUENCY },
		};
	}

	onReload() {
		super.onReload();
		this.startThread(this.removeOldOrders, null, undefined, 'Old order cleanup');
		global.RESOURCE_THIS_TICK = RESOURCES_ALL[Game.time % RESOURCES_ALL.length];
	}

	*run() {
		const [market] = yield* this.read(); // stored in this.pages
		this.market = market;
		this.startThread(this.updateMarketHistory, null, undefined, 'Market transaction tracking');
		while (!(yield)) {
			global.RESOURCE_THIS_TICK = RESOURCES_ALL[Game.time % RESOURCES_ALL.length];
			if (Game.time & EMPIRE_MARKET_RESYNC_FREQUENCY)
				continue;
			this.resyncEmpireCredits();
			this.write();
		}
	}

	*updateMarketHistory() {
		while (!(yield this.sleepThread(MARKET_HISTORY_FREQUENCY))) {
			//Market.updateMarket(MARKET_HISTORY_FREQUENCY);
			this.updateIncomingMarket();
			this.updateOutgoingMarket();
			this.write();
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

	resyncEmpireCredits() {
		const creditsInUse = _.sum(Memory.structures, 'c');
		const creditsWeThinkWeHave = this.market.empire.credits;
		const creditsWeActuallyHave = Game.market.credits - creditsInUse;
		const diff = Math.abs(creditsWeThinkWeHave - creditsWeActuallyHave);
		if (diff <= 0)
			Log.notify(`Empire market adjustment reports that we are accurate!`);
		else
			Log.notify(`Empire market adjustment ${diff} credits skew (creditsWeThinkWeHave: ${creditsWeThinkWeHave}, creditsWeActuallyHave: ${creditsWeActuallyHave})`); // Did we lose a building?
		this.market.empire.credits = creditsWeActuallyHave;
	}

	/** Outgoing notifications */
	updateOutgoingMarket() {
		const limit = this.market.history.lastTickOut;
		this.market.history.lastTickOut = Game.time;
		var outgoing = Game.market.outgoingTransactions;
		var transaction, j, len, total, distance;
		const tax = ENVC('market.empire_tax', TERMINAL_TAX, 0.0, 1.0);
		for (j = 0, len = outgoing.length; j < len; j++) {
			transaction = outgoing[j];
			if (transaction.time < limit)
				break;
			// if (transaction.to && _.get(Game.rooms, transaction.to + '.controller.my', false) === true)
			if (transaction.to && Game.rooms[transaction.to] && Game.rooms[transaction.to].my === true)
				continue;
			var { from, to, resourceType, amount, order, recipient, time } = transaction;
			if (recipient && recipient.username && recipient.username === WHOAMI)
				continue;
			distance = Game.map.getRoomLinearDistance(from, to, true);
			if (order && order.price) {
				total = amount * order.price;
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${total} total (age: ${Game.time - time})`, 'Market');
				Game.rooms[from].terminal.credits += (total * (1.0 - tax));
				this.market.empire.credits += (total * tax);
			} else {
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType}`, 'Market');
			}
			if (recipient && recipient.username)
				this.updateRecipient(recipient.username, to, transaction);
		}
	}

	/**
	 * Incoming notifications
	 */
	updateIncomingMarket() {
		const limit = this.market.history.lastTickInc;
		this.market.history.lastTickInc = Game.time;
		var incoming = Game.market.incomingTransactions;
		var transaction, i, len, total, distance, desc;
		for (i = 0, len = incoming.length; i < len; i++) {
			transaction = incoming[i];
			if (transaction.time < limit)
				break;
			var { from, to, resourceType, amount, order, sender, time } = transaction;
			// if (transaction.from && _.get(Game.rooms, transaction.from + '.controller.my', false) === true)
			if (transaction.from && Game.rooms[transaction.from] && Game.rooms[transaction.from].my === true)
				continue;
			if (sender && sender.username && sender.username === WHOAMI)
				continue;
			distance = Game.map.getRoomLinearDistance(transaction.from, transaction.to, true);
			// var price = (order.price) ? order.price : 'NA';
			desc = _.escape(transaction.description);
			if (order && order.price) {
				total = amount * order.price;
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${total} total (${desc}) (age: ${Game.time - time})`, 'Market');
				Game.rooms[to].terminal.credits -= total;
			} else {
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} (${desc})`, 'Market');
			}
			if (sender && sender.username)
				this.updateSender(sender.username, from, transaction);
			// Game.notify("Transaction received: " + JSON.stringify(transaction,null,2));						
		}
	}

	updateSender(name, roomName, transaction) {
		Log.info(`Sender info: ${name} in ${roomName}`);
		Intel.setRoomOwner(roomName, name);
	}

	updateRecipient(name, roomName, transaction) {
		Log.info(`Recipient info: ${name} in ${roomName}`);
		Intel.setRoomOwner(roomName, name);
	}
}

module.exports = MarketProc;