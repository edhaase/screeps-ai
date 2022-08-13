/** os.prog.market.js - Market management */
'use strict';

/* global ENVC, Market, SEGMENT_MARKET, Log */

import { DATETIME_FORMATTER } from '/lib/time';
import { ENVC } from '/os/core/macros';
import { in_lowest_increment_of, in_highest_increment_of, NUMBER_FORMATTER, to_fixed } from '/lib/util';
import { Log, LOG_LEVEL } from '/os/core/Log';
import { TERMINAL_TAX } from '/prototypes/structure/terminal';
import * as Co from '/os/core/co';
import * as Intel from '/Intel';
import Future from '/os/core/future';
import PagedProcess from '/os/core/process/paged';
import Process from '/os/core/process';

export const DEFAULT_MARKET_ORDER_CLEANUP_FREQ = 100;
export const MARKET_HISTORY_FREQUENCY = 16;
export const EMPIRE_MARKET_RESYNC_FREQUENCY = 4095;
export const DEFAULT_TERMINAL_CREDIT_RESERVE = 20000;
export const MARKET_MINIMUM_ACCOUNT_AUTOSELL = 100;


export default class MarketProc extends PagedProcess {
	constructor(opts) {
		super(opts);
		this.priority = Process.PRIORITY_LOWEST;
		this.default_thread_prio = Process.PRIORITY_LOWEST;
		this.pageIds = [SEGMENT_MARKET];
		this.deals = [];
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
		this.startThread(this.executeOrders, null, undefined, 'Market order queue executor');
		this.startThread(this.updateMarketHistory, null, undefined, 'Market transaction tracking');
		this.startThread(this.manageAccountResources, null, undefined, 'Account resource management');
		while (!(yield)) {
			global.RESOURCE_THIS_TICK = RESOURCES_ALL[Game.time % RESOURCES_ALL.length];
			if (Game.time & EMPIRE_MARKET_RESYNC_FREQUENCY)
				continue;
			this.resyncEmpireCredits();
			this.write();
		}
	}

	/**
	 * Buy and sell account resources
	 */
	*manageAccountResources() {
		const DEFAULT_PIXEL_LIMIT = 1000;
		while (!(yield this.sleepThread(MARKET_HISTORY_FREQUENCY))) {
			try {
				const PIXEL_LIMIT = ENVC('market.pixel_limit', DEFAULT_PIXEL_LIMIT, 0);
				const have = Game.resources['pixel'];
				const available = have - PIXEL_LIMIT;
				if (available < MARKET_MINIMUM_ACCOUNT_AUTOSELL)
					continue;
				/**
				 * Attempt to sell
				 */
				const orders = Game.market.getAllOrders({ type: ORDER_BUY, resourceType: 'pixel' });
				const filtered = _.filter(orders, o => o.price >= 100 && o.remainingAmount > 1 && o.amount > 1);
				if (!filtered || !filtered.length)
					continue;
				const best = _.max(filtered, o => o.price);
				const amount = Math.min(available, best.amount, best.remainingAmount);
				const status = Game.market.deal(best.id, amount);
				this.info(`Selling ${amount} pixel(s) at ${best.price} each on tick ${Game.time}, order id ${best.id}, status ${status}`);
				/**
				 * Since account resources aren't in market transaction history, 
				 * we'll force pause until next tick and inspect state ourselves
				 */
				yield false;
				const difference = have - Game.resources['pixel'];
				if (difference < amount - 1) { // Leave room for error
					this.warn(`Sell failure on ${amount} pixel(s)`);
					continue;
				}
				/**
				 * If we completed the sale, distribute the credits to terminals in need
				 */
				const total = difference * best.price;
				const tax = ENVC('market.empire_tax', TERMINAL_TAX, 0.0, 1.0);
				this.info(`Outbound transaction ${amount} pixel at ${best.price} for ${total} total`);
				this.market.empire.credits += (total * tax);

				const desired = ENVC('market.terminal_credit_reserve', DEFAULT_TERMINAL_CREDIT_RESERVE, 0)
				const terminals = _.filter(Game.structures, s => s.structureType === STRUCTURE_TERMINAL && s.credits < desired) || [];
				if (!terminals || !terminals.length) {
					this.info(`No terminals in need of credit boost`);
					continue;
				}
				const net = (total * (1.0 - tax));
				const distribution = Math.floor(net / terminals.length);
				this.info(`Distributing ${net} credit(s) across ${terminals.length} terminals for ${distribution} each`);
				for (const terminal of terminals)
					terminal.credits += distribution;
			} catch (err) {
				this.error(err);
				this.error(err.stack);
			}
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
			const ended = new Date();
			for (const o of Object.values(Game.market.orders)) {
				if (o.remainingAmount > 1)
					continue;
				const created = new Date(o.createdTimestamp);
				const status = Game.market.cancelOrder(o.id);
				if (o.roomName)
					this.info(`Removing completed order for ${o.resourceType} at ${o.price}/ea created on ${DATETIME_FORMATTER.format(created)} at ${DATETIME_FORMATTER.format(ended)} in room ${o.roomName} status ${status}`);
				else
					this.info(`Removing completed order for ${o.resourceType} at ${o.price}/ea created on ${DATETIME_FORMATTER.format(created)} at ${DATETIME_FORMATTER.format(ended)} status ${status}`);
			}
		}
	}

	resyncEmpireCredits() {
		const creditsInUse = _.sum(Memory.structures, 'c');
		const creditsWeThinkWeHave = this.market.empire.credits;
		const creditsWeActuallyHave = Game.market.credits - creditsInUse;
		const diff = Math.abs(creditsWeThinkWeHave - creditsWeActuallyHave);
		this.market.empire.creditSkew = diff;

		if (Math.round(diff) <= 0)
			this.market.empire.skewReport = `Empire market adjustment reports that we are accurate!`;
		else
			this.market.empire.skewReport = `Empire market adjustment ${to_fixed(diff, 3)} credits skew (creditsWeThinkWeHave: ${creditsWeThinkWeHave}, creditsWeActuallyHave: ${creditsWeActuallyHave})`; // Did we lose a building?
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
			var { from, to, resourceType, amount, order, recipient = {}, time } = transaction;
			if (transaction.to && Game.rooms[transaction.to] && Game.rooms[transaction.to].my === true)
				continue;
			if (recipient && recipient.username && recipient.username === WHOAMI)
				continue;
			distance = Game.map.getRoomLinearDistance(from, to, true);
			if (order && order.price) {
				total = amount * order.price;
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${NUMBER_FORMATTER.format(total)} total (age: ${Game.time - time}) to ${recipient.username} via ${order.type} order`, 'Market');
				Game.rooms[from].terminal.credits += (total * (1.0 - tax));
				this.market.empire.credits += (total * tax);
			} else {
				Log.info(`Outbound transaction from ${from} to ${to} (dist: ${distance}): ${amount} ${resourceType} to ${recipient.username}`, 'Market');
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
			var { from, to, resourceType, amount, order, sender = {}, time } = transaction;
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
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} at ${order.price} for ${NUMBER_FORMATTER.format(total)} total (${desc}) (age: ${Game.time - time}) from ${sender.username}`, 'Market');
				Game.rooms[to].terminal.credits -= total;
			} else {
				Log.info(`Inbound transaction to ${to} from ${from} (dist: ${distance}): ${amount} ${resourceType} (${desc}) from ${sender.username}`, 'Market');
			}
			if (sender && sender.username)
				this.updateSender(sender.username, from, transaction);
			// Game.notify("Transaction received: " + JSON.stringify(transaction,null,2));						
		}
	}

	updateSender(name, roomName, transaction) {
		// Log.info(`Sender info: ${name} in ${roomName}`);
		Intel.setRoomOwner(roomName, name);
	}

	updateRecipient(name, roomName, transaction) {
		// Log.info(`Recipient info: ${name} in ${roomName}`);
		Intel.setRoomOwner(roomName, name);
	}

	/**
	 * Schedule a deal to happen as soon as possible, but may pend if we hit the deal limit
	 * 
	 * @param {*} orderId 
	 * @param {*} amount 
	 * @param {*} roomName 
	 * 
	 * @returns Future - so we can await the result
	 */
	schedule(orderId, amount, roomName, price) {
		const future = new Future();
		this.deals.push([future, orderId, amount, roomName, price]);
		return future;
	}

	/**
	 * Execute the deal queue
	 */
	*executeOrders() {
		while (true) {
			yield false;
			while (this.deals && this.deals.length) {
				yield true;
				const [[future, orderId, amount, roomName, price]] = this.deals;
				const order = Game.market.getOrderById(orderId);
				if (!order) {
					Log.warn(`Order ${orderId} no longer valid`, 'Market');
					this.deals.shift();
					future.put(ERR_INVALID_ARGS);
				 } else if (price && order.price !== price) {
					Log.warn(`Price changed on order from schedule ${order.price} != ${price}, rejecting order`, 'Market');
					this.deals.shift();
					future.put(ERR_INVALID_ARGS);
				} else {
					const result = Game.market.deal(orderId, amount, roomName);
					if (result === ERR_FULL) { // We've hit deal limit, wait and try again
						break;
					}
					this.deals.shift();
					future.put(result);
				}
			}
		}
	}
}