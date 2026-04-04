// Sprite and animation constants
export const SPRITE_SIZE = 100;         // Actual frame size in the sprite sheet (fixed)
export const SPRITE_DISPLAY_SIZE = 145; // Rendered size on canvas (45% larger than source)
export const ANIMATION_FRAMES = 4;
export const FRAME_DURATION = 200;

// WebSocket constants - using NEXT_PUBLIC_SOCKET_URL for socket.io
export const WEBSOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

// Map constants — NYC Trading Floor (2444×1620 px)
export const MAP_WIDTH = 2444;
export const MAP_HEIGHT = 1620;
export const DEBUG_WALKABLE_AREAS = false;  // Set false after tuning
export const DEBUG_CHARACTER_SELECT_BOXES = false;

// AABB walkable zones (map coordinates)
export const WALKABLE_AREAS = [
    { name: 'Harper', x: 25,   y: 360,  width: 1600, height: 555  },
    { name: 'Yasmin', x: 140,  y: 650,  width: 1860, height: 1010 },
    { name: 'Rishi',  x: 0,    y: 1190, width: 1550, height: 442  },
    { name: 'Eric',   x: 1370, y: 580,  width: 1060, height: 1053 },
];

// Precise polygon walkable zones (map coordinates, traced from office_dark_c2.png image map)
export const WALKABLE_POLYGONS = {
    yasmin: [
        { x: 89,   y: 683 }, { x: 81,   y: 903 }, { x: 1023, y: 907 },
        { x: 1962, y: 881 }, { x: 1923, y: 599 }, { x: 1730, y: 605 },
        { x: 1589, y: 819 }, { x: 829,  y: 829 }, { x: 826,  y: 676 },
        { x: 604,  y: 674 }, { x: 594,  y: 765 }, { x: 214,  y: 780 },
        { x: 169,  y: 726 }
    ],
    harper: [
        { x: 1393, y: 1159 }, { x: 1535, y: 1151 }, { x: 1535, y: 890  },
        { x: 1873, y: 879  }, { x: 1873, y: 1123 }, { x: 2371, y: 1116 },
        { x: 2296, y: 892  }, { x: 1985, y: 888  }, { x: 1977, y: 724  },
        { x: 1938, y: 715  }, { x: 1929, y: 605  }, { x: 1729, y: 608  },
        { x: 1595, y: 827  }, { x: 1388, y: 825  }
    ],
    eric: [
        { x: 1387, y: 890  }, { x: 1529, y: 886  }, { x: 1535, y: 1270 },
        { x: 1861, y: 1239 }, { x: 1871, y: 996  }, { x: 2331, y: 996  },
        { x: 2343, y: 1179 }, { x: 1992, y: 1181 }, { x: 1986, y: 1509 },
        { x: 2165, y: 1515 }, { x: 2182, y: 1614 }, { x: 1818, y: 1621 },
        { x: 1818, y: 1470 }, { x: 1397, y: 1403 }
    ],
    rishi: [
        { x: 544,  y: 1176 }, { x: 544,  y: 1284 }, { x: 1393, y: 1228 },
        { x: 1386, y: 1497 }, { x: 557,  y: 1471 }, { x: 557,  y: 1616 },
        { x: 1455, y: 1614 }, { x: 1438, y: 1469 }, { x: 1529, y: 1458 },
        { x: 1544, y: 814  }, { x: 1397, y: 805  }, { x: 1386, y: 1131 },
        { x: 1238, y: 1200 }, { x: 1080, y: 1146 }, { x: 932,  y: 1198 },
        { x: 787,  y: 1142 }, { x: 639,  y: 1200 }
    ]
};

// Maps character index (0=Eric, 1=Harper, 2=Rishi, 3=Yasmin) to their polygon zone key
export const AGENT_ZONE_KEYS: (keyof typeof WALKABLE_POLYGONS)[] = ['eric', 'harper', 'rishi', 'yasmin'];

// Character spawn positions (map coordinates, sprite top-left, with bottom-center foot anchor inside zone)
export const CHARACTER_SPAWN_POSITIONS = [
    { name: 'Eric',   x: 1863, y: 1372 },
    { name: 'Harper', x: 1796, y: 783 },
    { name: 'Rishi',  x: 1455, y: 1246 },
    { name: 'Yasmin', x: 710,  y: 755 },
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
