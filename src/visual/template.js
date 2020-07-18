/**
 * 
 */
export default class TemplateVisual {
	constructor(template, offset) {
		this.template = template;
		this.offset = offset || [];
	}

	draw(roomName) {
		const visual = new RoomVisual(roomName);
		const { buildings } = this.template;
		const [dx, dy] = this.offset;
		for (const type in buildings) {
			for (const pos of buildings[type].pos) {
				visual.structure(pos.x + dx, pos.y + dy, type);
			}
		}
		visual.connectRoads();
	}

	toString() {
		return `[TemplateVisual]`;
	}
}

