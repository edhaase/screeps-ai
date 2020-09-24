/**
 * @module
 */
import { Log, LOG_LEVEL } from '/os/core/Log';

export default class Census {
	constructor(roomName) {
		
	}

	/**
	 * 
	 */
	resetIncome() {
		/** Sources in room */
		this.base = 0;

		/** Income from remote sources */
		this.remote = 0;

		/** Reactor is available at low RCLs */
		this.reactor = 0;
	}

	/**
	 * 
	 */
	resetExpenses() {

	}

	report() {
		var report = "";
		report += `\nBase ${_.round(base, 3)} Remote ${_.round(remote, 3)} Reactor ${_.round(reactor, 3)} Over ${_.round(overstock, 3)} Decay: ${enDecay}`;
		report += `\nUpkeep: ${_.round(upkeep, 3)}, Creep: ${_.round(upkeepCreeps, 3)}, Structure: ${_.round(upkeepStructures, 3)}`;
		report += `\nIncome: ${_.round(income, 3)}, Overstock: ${_.round(overstock, 3)}, Expense: ${_.round(expense, 3)}, Upkeep: ${_.round(upkeep, 3)}, Net: ${_.round(net, 3)}, Avail ${_.round(avail, 3)}, Banked: ${storedEnergy}, Adjusted ${_.round(adjusted, 3)}`;
		report += `\nAllotments: ${_.round(allotedUpgrade, 3)} upgrade, ${_.round(allotedRepair, 3)} repair, ${_.round(allotedBuild, 3)} build, ${_.round(remainder, 3)} leftover`;
		Log.info(`<details><summary>Income/Expense Report (${this.pos.roomName})</summary>${report}</details>`);
	}
}