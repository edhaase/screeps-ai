/**
 * 
 * @auth eduter
 * https://github.com/eduter/render-intel-map
 */
'use strict';

const MY_USERNAME = WHOAMI;

const roomNameRegExp = /^([WE])(\d+)([NS])(\d+)$/;

const RESOURCE_COLORS = {
  [RESOURCE_ENERGY]: '#FFE56D',
  [RESOURCE_HYDROGEN]: '#4C4C4C',
  [RESOURCE_OXYGEN]: '#4C4C4C',
  [RESOURCE_UTRIUM]: '#006181',
  [RESOURCE_KEANIUM]: '#371383',
  [RESOURCE_LEMERGIUM]: '#236144',
  [RESOURCE_ZYNTHIUM]: '#5D4C2E',
  [RESOURCE_CATALYST]: '#592121',
  '?': '#000'
};

const NO_INFO = {};

/**
 * Draws a map with all the intel info provided.
 *
 * @param {string} targetRoom - the name of the room where the map will be rendered
 * @param {Object.<string, RoomInfo>} roomsInfo - dictionary with info about all rooms to be rendered, indexed by their names
 * @param {RenderOptions} [options] - see {@link RenderOptions}
 */
function renderIntelMap(targetRoom, roomsInfo, options = {}) {
  const {
      lastVisitThreshold = 2 * CREEP_LIFE_TIME,
      roomSize = 3,
      opacity = 0.4,
      maxRange = 7,
      displayExits = true,
      renderBehind = () => {},
      renderInFront = () => {}
  } = options;

  if (!roomsInfo || typeof roomsInfo !== 'object') {
    console.log('Error: roomsInfo is missing or invalid');
    return;
  }

  const [centerX, centerY] = roomNameToCoords(targetRoom);
  const roomsCoords = Object.keys(roomsInfo).map(roomNameToCoords);
  const minX = Math.max(Math.min(...roomsCoords.map(c => c[0])), centerX - maxRange);
  const maxX = Math.min(Math.max(...roomsCoords.map(c => c[0])), centerX + maxRange);
  const minY = Math.max(Math.min(...roomsCoords.map(c => c[1])), centerY - maxRange);
  const maxY = Math.min(Math.max(...roomsCoords.map(c => c[1])), centerY + maxRange);
  const rows = Math.abs(maxY - minY) + 1;
  const cols = Math.abs(maxX - minX) + 1;

  const x0 = -0.5;
  const y0 = -0.5;
  const borderWidth = 0.07 * roomSize;

  const rv = new RoomVisual(targetRoom);

  // Draws map's background
  rv.rect(x0, y0, cols * roomSize, rows * roomSize, { fill: 'gray', opacity });

  // Draws the rooms
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const roomName = coordsToRoomName([minX + col, minY + row]);
      const roomCenterX = x0 + (0.5 + col) * roomSize;
      const roomCenterY = y0 + (rows - row - 0.5) * roomSize;
      const innerSize = roomSize - borderWidth;
      const boundRenderBehind = () => renderBehind(roomName, rv, roomCenterX, roomCenterY, innerSize);

      drawRoom(roomsInfo[roomName], lastVisitThreshold, rv, roomCenterX, roomCenterY, innerSize, opacity, boundRenderBehind);
      if (displayExits) {
        drawExits(roomName, rv, roomCenterX, roomCenterY, roomSize, borderWidth, row === rows - 1, col === 0);
      }
      renderInFront(roomName, rv, roomCenterX, roomCenterY, innerSize);
    }
  }
}

/**
 * Draws barriers between rooms if there are no exits connecting them.
 *
 * @param {string} roomName - the name of the room
 * @param {RoomVisual} rv - the RoomVisual object to be used to render stuff
 * @param {number} x - the x coordinate of the center of the room in the rendered map
 * @param {number} y - the y coordinate of the center of the room in the rendered map
 * @param {number} size - the size of room in the rendered map
 * @param {number} borderWidth - width of the border between rows and columns in the map
 * @param {boolean} isFirstRow - whether the room is in the first row of the map
 * @param {boolean} isFirstCol - whether the room is in the first column of the map
 */
function drawExits(roomName, rv, x, y, size, borderWidth, isFirstRow, isFirstCol) {
  const exits = Game.map.describeExits(roomName);

  if (exits) {
    const directions = [RIGHT, BOTTOM, LEFT, TOP];
    const blockedExits = directions.filter(d => !exits[d]);
    const style = { color: 'black', width: borderWidth, opacity: 1, lineStyle: 'dashed' };
    const half = size / 2;

    if (blockedExits.includes(RIGHT)) {
      rv.line(x + half, y - half, x + half, y + half, style);
    }
    if (blockedExits.includes(BOTTOM)) {
      rv.line(x - half, y + half, x + half, y + half, style)
    }
    if (isFirstCol && blockedExits.includes(LEFT)) {
      rv.line(x - half, y - half, x - half, y + half, style);
    }
    if (isFirstRow && blockedExits.includes(TOP)) {
      rv.line(x - half, y - half, x + half, y - half, style)
    }
  }
}

/**
 * Draws one room in the intel map.
 *
 * @param {RoomInfo} info - all the info about the room
 * @param {int} lastVisitThreshold - number of ticks after which a room's info is considered old (gets dark in the map)
 * @param {RoomVisual} rv - the RoomVisual object to be used to render stuff
 * @param {number} x - the x coordinate of the center of the room in the rendered map
 * @param {number} y - the y coordinate of the center of the room in the rendered map
 * @param {number} size - the size of room in the rendered map
 * @param {number} opacity - opacity of the map's background
 * @param {Function} renderBehind - parameterless callback to render stuff directly on top of the background
 */
function drawRoom(info = NO_INFO, lastVisitThreshold, rv, x, y, size, opacity, renderBehind) {
  const intelFreshness = typeof info.lastVisit === 'number' ? getIntelFreshness(info.lastVisit, lastVisitThreshold) : 1;
  const hslValue = Math.max(intelFreshness, 0.15);
  const textColor = hslValue < 0.5 || info === NO_INFO ? '#FFF' : '#000';
  let color;

  if (info === NO_INFO) {
    color = '#181818';
  } else if (info.username === MY_USERNAME) {
    color = hsv2rgb(120, 1, hslValue);
  } else if (info.defended) {
    color = hsv2rgb(0, 1, hslValue);
  } else if (info.inhabited) {
    color = hsv2rgb(60, 1, hslValue);
  } else {
    color = hsv2rgb(240, 1, hslValue);
  }

  // Draws room's background
  rv.rect(x - size / 2, y - size / 2, size, size, { fill: color, opacity });

  // Calls renderBehind callback behind everything but the background
  renderBehind();

  // Draws the room's resources
  if (info.sources || info.mineral) {
    renderResources(info, rv, x, y, size);
  }

  // Draws the room's controller (or SK) info
  const safeModeOn = info.safeMode && info.lastVisit && info.lastVisit + info.safeMode > Game.time;
  const safeModeCooldownOn = info.safeModeCooldown && info.lastVisit && info.lastVisit + info.safeModeCooldown > Game.time;
  if (safeModeOn || safeModeCooldownOn) {
    const rectSize = 0.5 * size;
    const lineStyle = safeModeOn ? 'solid' : 'dotted';
    rv.rect(x - 0.5 * rectSize, y - 0.45 * rectSize, rectSize, rectSize, { fill: 'transparent', stroke: textColor, lineStyle });
  }
  if (info.reserved) {
    rv.text('R', x, y + 0.25 * size, { font: 0.6 * size, color: textColor });
  } else if (typeof info.rcl === 'number') {
    rv.text(info.rcl, x, y + 0.25 * size, { font: 0.6 * size, color: textColor });
  } else if (info.keeperLairs) {
    const radius = size / 6;
    rv.circle(x, y, {
      stroke: '#780207',
      strokeWidth: 0.9 * radius,
      fill: '#000',
      opacity: 1,
      radius: radius
    });
  } else if (info === NO_INFO) {
    rv.text('?', x, y + size / 3, { font: size, color: textColor });
  }

  // Prints the username
  if (typeof info.username === 'string') {
    rv.text(info.username.slice(0, 6), x, y + 0.45 * size, { font: size / 4, color: textColor });
  }
}

/**
 * Renders info about energy sources and minerals.
 *
 * @param {RoomInfo} info - all the info about the room
 * @param {RoomVisual} rv - the RoomVisual object to be used to render stuff
 * @param {number} x - the x coordinate of the center of the room in the rendered map
 * @param {number} y - the y coordinate of the center of the room in the rendered map
 * @param {number} size - the size of room in the rendered map
 */
function renderResources(info, rv, x, y, size) {
  const validMineral = info.mineral && RESOURCE_COLORS[info.mineral] && info.mineral !== RESOURCE_ENERGY;
  const mineral = validMineral ? info.mineral : '?';
  const resources = (info.mineral ? [mineral] : []).concat(info.sources ? new Array(info.sources).fill(RESOURCE_ENERGY): []);
  const width = size / 4;

  resources.forEach((resource, i) => {
    const style = {
      stroke: '#000',
      strokeWidth: 0.07 * width,
      fill: RESOURCE_COLORS[resource],
      opacity: 1,
      radius: 0.45 * width
    };
    const centerX = x + (2 * i - 3) * width / 2;
    const centerY = y - 3 * width / 2;
    rv.circle(centerX, centerY, style);
    if (resource !== RESOURCE_ENERGY) {
      rv.text(resource, centerX, centerY + 0.25 * width, { font: width * 0.75, color: '#FFF', opacity: 0.7 });
    }
  });
}

/**
 * Converts a room name in to a numeric representation (e.g. (W2N2) => [-3, 2])
 *
 * @param {string} roomName
 * @returns {int[]}
 */
function roomNameToCoords(roomName) {
  const [, we, lon, ns, lat] = roomNameRegExp.exec(roomName);
  return [
    we === 'W' ? -lon - 1 : +lon,
    ns === 'S' ? -lat - 1 : +lat
  ];
}

/**
 * Inverse operation of {@link roomNameToCoords}.
 *
 * @param {int[]} coords
 * @returns {string}
 */
function coordsToRoomName(coords) {
  const [x, y] = coords;
  const [absX, absY] = coords.map(n => Math.abs(n));
  return (x < 0 ? 'W' + (absX - 1) : 'E' + absX)
      + (y < 0 ? 'S' + (absY - 1) : 'N' + absY)
}

/**
 * Calculates the relative freshness of the intel about a room, compared to the threshold.
 *
 * @param {number} lastVisit - last time (tick) the room's info was updated
 * @param {number} lastVisitThreshold - number of ticks after which a room's info is considered old
 * @returns {number} - a number between 0.0 and 1.0 (1.0 being the freshest and 0.0 the oldest)
 */
function getIntelFreshness(lastVisit, lastVisitThreshold) {
  return 1 - Math.min((Game.time - lastVisit) / lastVisitThreshold, 1);
}

/**
 * Converts a color from HSV to RGB.
 *
 * @param {number} h - the hue (from 0 to 359)
 * @param {number} s - saturation (from 0.0 to 1.0)
 * @param {number} v - value (from 0.0 to 1.0)
 * @returns {string} - a color in the format '#RRGGBB'
 */
function hsv2rgb(h, s, v) {
  let rgb, i, data = [];
  if (s === 0) {
    rgb = [v, v, v];
  } else {
    h = h / 60;
    i = Math.floor(h);
    data = [v * (1 - s), v * (1 - s * (h - i)), v * (1 - s * (1 - (h - i)))];
    switch (i) {
      case 0:
        rgb = [v, data[2], data[0]];
        break;
      case 1:
        rgb = [data[1], v, data[0]];
        break;
      case 2:
        rgb = [data[0], v, data[2]];
        break;
      case 3:
        rgb = [data[0], data[1], v];
        break;
      case 4:
        rgb = [data[2], data[0], v];
        break;
      default:
        rgb = [v, data[0], data[1]];
        break;
    }
  }
  return '#' + rgb.map(x => ('0' + Math.round(x * 255).toString(16)).slice(-2)).join('');
}

/**
 * Information about a room, collected using scout creeps or observers.
 *
 * @typedef {Object} RoomInfo
 * @property {int} [lastVisit] - last time (tick) this info was updated
 * @property {int} [sources] - number of energy sources in the room
 * @property {string} [mineral] - mineral type available in the room
 * @property {boolean} [keeperLairs] - whether there are keeper lairs in the room
 * @property {int} [rcl] - the Room Control Level of the room last time it was seen
 * @property {boolean} [reserved] - whether the room is reserved
 * @property {string} [username] - the name of the user who owns/reserved/inhabits the room
 * @property {int} [safeMode] - number of remaining ticks of safe mode at lastVisit
 * @property {int} [safeModeCooldown] - number of remaining ticks of safe mode cooldown at lastVisit
 * @property {boolean} [inhabited] - whether the room is inhabited by another player
 * @property {boolean} [defended] - whether, besides being inhabited, the room has some defensive capabilities
 */

/**
 * Options for rendering the map.
 *
 * @typedef {Object} RenderOptions
 * @property {int} [lastVisitThreshold] - number of ticks after which a room's info is considered old (gets dark in the map)
 * @property {number} [roomSize] - size of each room in the map (in game tiles)
 * @property {number} [opacity] - opacity of the map's background
 * @property {number} [maxRange] - max number of rooms to be displayed on each side of the target room
 * @property {boolean} [displayExits] - whether it should display which exits are blocked
 * @property {RenderRoomCallback} [renderBehind] - callback to render any extra info you want behind each room's info
 * @property {RenderRoomCallback} [renderInFront] - callback to render any extra info you want in front of each room's info
 */

/**
 * Callback to render some info about one room.
 *
 * @callback RenderRoomCallback
 * @param {string} roomName - the name of the room
 * @param {RoomVisual} roomVisual - the RoomVisual object to be used to render stuff
 * @param {number} x - the x coordinate of the center of the room in the rendered map
 * @param {number} y - the y coordinate of the center of the room in the rendered map
 * @param {number} size - the size of room in the rendered map
 */

module.exports = renderIntelMap;