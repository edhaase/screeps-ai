import * as Cmd from '/os/core/commands';
import { RLD } from '/lib/util';

const CMD_CATEGORY = 'GUI';

function clearWatches() {
	return `<script>var memory = angular.element($('.memory-watch')).scope().MemoryMain; memory.watches.filter(w => w.path !== "").forEach(w => memory.removeWatch(w.path));</script>`;
}

function showRoom(roomName, shard = Game.shard.name) {
	return `<script>window.location.href = '#!/room/${shard}/${roomName}'</script>`;
}

function hl(x, radius = 5) {
	x.room.visual.circle(x.pos, { fill: 'red', radius, lineStyle: 'dashed' });
}


/** Set height of console, author Spedwards */
function setConsoleLines(lines) {
	console.log(`<script>document.querySelector('.editor-panel').style.height = "${Math.ceil(lines * 22.5714) + 30}px";</script>`);
}

Cmd.register('clearWatches', clearWatches, 'Clear the memory watch', ['cw'], CMD_CATEGORY);
Cmd.register('highlight', hl, 'Highlight a given object in the current room', ['hl'], CMD_CATEGORY);
Cmd.register('setConsoleLines', setConsoleLines, 'Set console window height', ['scl'], CMD_CATEGORY);
Cmd.register('showRoom', showRoom, 'Switch the GUI to a room', [], 'GUI', CMD_CATEGORY);
Cmd.register('RLD', RLD, 'Run length decode an array', [], CMD_CATEGORY);