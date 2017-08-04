/**
 *
 */
'use strict';
 
class Command
{
	static getLimit() {
		return Game.cpu.limit;
		// return Game.cpu.tickLimit;
	}
	
	/** */	
	static tick() {
		if(Game.cpu.getUsed() > this.getLimit()) //or tickLimit - threshold if you want to run more per turn.
			return;
		
		if(!Memory.command)
			return;		
		
		var cmd, r;
		while( (Game.cpu.getUsed() + 2 < this.getLimit()) && Memory.command.length ) {
			cmd = Memory.command.shift();			
			r = eval(cmd);
			if(r !== undefined)
				Log.warn('Result: ' + r, 'Command');
		}
		
		if(Memory.command.length === 0)
			Memory.command = undefined;
	}
	
	// _(Game.flags).filter({color: COLOR_BLUE}).map('name').each(name => Command.push("Game.flags['" + name + "'].remove()"))
	static push(cmd) {
		if(!Memory.command)
			Memory.command = [];
		Memory.command.push(cmd);
	}
	
	static clear() {		
		Memory.command = undefined;
	}
}

module.exports = Object.freeze(Command);