// Sprite and animation constants
export const SPRITE_SIZE = 100; // Keep original sprite size
export const ANIMATION_FRAMES = 4;
export const FRAME_DURATION = 200;

// WebSocket constants - using NEXT_PUBLIC_SOCKET_URL for socket.io
export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

// Map constants — NYC Trading Floor (2444×1620 px)
export const MAP_WIDTH = 2444;
export const MAP_HEIGHT = 1620;
export const DEBUG_WALKABLE_AREAS = true;  // Set false after tuning
export const DEBUG_CHARACTER_SELECT_BOXES = false;

// AABB walkable zones (map coordinates)
export const WALKABLE_AREAS = [
    { name: 'Harper', x: 25,   y: 360,  width: 1600, height: 555  },
    { name: 'Yasmin', x: 140,  y: 650,  width: 1860, height: 1010 },
    { name: 'Rishi',  x: 0,    y: 1190, width: 1550, height: 442  },
    { name: 'Eric',   x: 1370, y: 580,  width: 1060, height: 1053 },
];

// Precise polygon walkable zones (map coordinates, extracted from office map)
export const WALKABLE_POLYGONS = {
    rishi: [
        { x: -1, y: 1366 }, { x: 4, y: 1455 }, { x: 444, y: 1453 },
        { x: 465, y: 1449 }, { x: 465, y: 1490 }, { x: 545, y: 1486 },
        { x: 547, y: 1628 }, { x: 1446, y: 1632 }, { x: 1431, y: 1501 },
        { x: 1289, y: 1499 }, { x: 1284, y: 1548 }, { x: 1187, y: 1552 },
        { x: 1168, y: 1505 }, { x: 989, y: 1496 }, { x: 978, y: 1550 },
        { x: 877, y: 1554 }, { x: 864, y: 1511 }, { x: 763, y: 1503 },
        { x: 765, y: 1261 }, { x: 696, y: 1257 }, { x: 700, y: 1488 },
        { x: 577, y: 1488 }, { x: 575, y: 1412 }, { x: 547, y: 1331 },
        { x: 649, y: 1249 }, { x: 843, y: 1245 }, { x: 893, y: 1217 },
        { x: 1076, y: 1196 }, { x: 1173, y: 1211 }, { x: 1356, y: 1196 },
        { x: 1389, y: 1245 }, { x: 1384, y: 1495 }, { x: 1533, y: 1452 },
        { x: 1527, y: 892 }, { x: 1382, y: 898 }, { x: 1384, y: 1131 },
        { x: 986, y: 1140 }, { x: 686, y: 1131 }, { x: 535, y: 1159 },
        { x: 533, y: 1308 }, { x: 462, y: 1364 }
    ],
    eric: [
        { x: 1865, y: 1124 }, { x: 1859, y: 1256 }, { x: 1727, y: 1254 },
        { x: 1727, y: 1135 }, { x: 1647, y: 1135 }, { x: 1654, y: 1189 },
        { x: 1583, y: 1189 }, { x: 1572, y: 1258 }, { x: 1389, y: 1271 },
        { x: 1376, y: 1448 }, { x: 1580, y: 1430 }, { x: 1578, y: 1465 },
        { x: 1667, y: 1435 }, { x: 1807, y: 1465 }, { x: 1813, y: 1620 },
        { x: 2430, y: 1633 }, { x: 2430, y: 1428 }, { x: 2208, y: 1411 },
        { x: 2180, y: 1517 }, { x: 1988, y: 1512 }, { x: 1990, y: 1191 },
        { x: 1999, y: 1120 }, { x: 2078, y: 1094 }, { x: 2139, y: 1172 },
        { x: 2195, y: 1183 }, { x: 2369, y: 1174 }, { x: 2378, y: 935 },
        { x: 2283, y: 910 }, { x: 1981, y: 880 }, { x: 1932, y: 587 },
        { x: 1729, y: 591 }, { x: 1589, y: 798 }, { x: 1378, y: 891 },
        { x: 1865, y: 863 }, { x: 1863, y: 930 }
    ],
    harper: [
        { x: 854, y: 470 }, { x: 736, y: 480 }, { x: 141, y: 476 },
        { x: 122, y: 672 }, { x: 145, y: 719 }, { x: 225, y: 741 },
        { x: 283, y: 719 }, { x: 313, y: 719 }, { x: 352, y: 687 },
        { x: 432, y: 694 }, { x: 849, y: 677 }, { x: 854, y: 813 },
        { x: 1617, y: 813 }, { x: 1617, y: 892 }, { x: 859, y: 909 },
        { x: 779, y: 875 }, { x: 550, y: 870 }, { x: 533, y: 907 },
        { x: 106, y: 911 }, { x: 104, y: 810 }, { x: 29, y: 810 },
        { x: 29, y: 396 }, { x: 824, y: 364 }, { x: 854, y: 379 },
        { x: 865, y: 423 }
    ],
    yasmin: [
        { x: 158, y: 701 }, { x: 143, y: 908 }, { x: 1384, y: 891 },
        { x: 1387, y: 1126 }, { x: 833, y: 1139 }, { x: 835, y: 1236 },
        { x: 1384, y: 1246 }, { x: 1391, y: 1464 }, { x: 1805, y: 1451 },
        { x: 1815, y: 1602 }, { x: 1992, y: 1626 }, { x: 1971, y: 1251 },
        { x: 1535, y: 1261 }, { x: 1522, y: 886 }, { x: 1960, y: 889 },
        { x: 1947, y: 654 }, { x: 1684, y: 673 }, { x: 1611, y: 794 },
        { x: 854, y: 807 }, { x: 846, y: 680 }
    ]
};

// Character spawn positions (map coordinates, inside each agent's walkable zone)
export const CHARACTER_SPAWN_POSITIONS = [
    { name: 'Eric',   x: 2000, y: 1000 },
    { name: 'Harper', x: 700,  y: 600  },
    { name: 'Rishi',  x: 700,  y: 1300 },
    { name: 'Yasmin', x: 1000, y: 900  },
];

// Canvas dimensions match the map for 1:1 coordinate mapping
export const CANVAS_WIDTH = 2444;
export const CANVAS_HEIGHT = 1620;
export const SCALE_FACTOR = typeof window !== 'undefined' ? Math.min(
    window.innerWidth * 0.6 / CANVAS_WIDTH,
    (window.innerHeight - 200) / CANVAS_HEIGHT
) : 1;

// Additional scaling factor just for characters
export const CHARACTER_SCALE = 5.4;

export const SCALED_MAP_WIDTH = MAP_WIDTH * SCALE_FACTOR;
export const SCALED_MAP_HEIGHT = MAP_HEIGHT * SCALE_FACTOR;
export const MAP_OFFSET_X = (CANVAS_WIDTH - SCALED_MAP_WIDTH) / 2;
export const MAP_OFFSET_Y = (CANVAS_HEIGHT - SCALED_MAP_HEIGHT) / 2;

// Movement speeds adjusted for larger characters
export const PLAYER_MOVE_SPEED = 14;
export const AI_MOVE_SPEED = 4.4;

// AI action durations in milliseconds
export const AI_MOVE_DURATION_MIN = 2000;
export const AI_MOVE_DURATION_MAX = 6000;
export const AI_PAUSE_DURATION_MIN = 3000;
export const AI_PAUSE_DURATION_MAX = 8000;

// List of possible directions
export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;

// Direction order for sprite sheet
export const DIRECTION_ORDER = ['down', 'left', 'up', 'right'] as const;
