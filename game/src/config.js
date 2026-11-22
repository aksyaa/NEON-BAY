// Neon Bay v2 — one home for every tuning number in the game.
// The city is a 600 x 600 grid: roads every 60 units, blocks 46 wide,
// and the fixed loop steps at 1/60 s. Change a feel here, not in code.
export const STEP = 1 / 60;

export const CITY = {
  half: 300,
  roadEvery: 60,
  roadWidth: 14,
  blockSize: 46,
};

// Four districts. The minimap tints each one with its colour, and the
// HUD calls the name out when Mara crosses the border.
export const DISTRICTS = [
  { name: 'Marina Beach', rect: { x0: -300, z0: -300, x1: -180, z1: 300 }, color: '#e8b06a' },
  { name: 'Downtown Neon', rect: { x0: -180, z0: -120, x1: 180, z1: 120 }, color: '#ff4fd8' },
  { name: 'Portside', rect: { x0: -180, z0: 120, x1: 300, z1: 300 }, color: '#4fc3f7' },
  { name: 'Old Town', rect: { x0: -180, z0: -300, x1: 300, z1: -120 }, color: '#f2c94c' },
];

// Sunset palette: purple sky, orange horizon, neon signs, dark streets.
export const PALETTE = {
  skyTop: '#2a1b4e',
  skyHorizon: '#ff7a3d',
  sun: '#ffd166',
  sea: '#0e4d6e',
  sand: '#e8c88f',
  asphalt: '#23232e',
  sidewalk: '#3a3a48',
  grass: '#2e5d43',
  building: '#2c2f45',
  neonPink: '#ff4fd8',
  neonCyan: '#29e6ff',
  neonOrange: '#ff9f1c',
  neonPurple: '#a06bff',
  text: '#f4f1ff',
  muted: '#9b93b8',
};

// Mara on foot: walking, sprinting, health, armour, collision size.
export const PLAYER = {
  walkSpeed: 7,
  runSpeed: 12,
  health: 100,
  armor: 50,
  radius: 0.9,
  turnSpeed: 9,
};

// Cars: acceleration, braking, top speed, steering and drift grip.
// maxSpeed is units per second; the HUD shows it as km/h (x3.6).
export const CAR = {
  accel: 22,
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 42,
  maxReverse: 10,
  steerMax: 0.55,
  grip: 8,
  driftGrip: 2.2,
  radius: 2.1,
};

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 22;
export const MAX_POLICE_CARS = 5;

// Wanted: one star fades after this many quiet seconds.
export const WANTED_DECAY_SECONDS = 18;
export const MONEY_START = 250;

// Side job (v2): five neon packages stashed around the city. Each one
// pays $100 on pickup; collecting all five pays a $500 bonus on top.
export const HUNT_COUNT = 5;
export const HUNT_EACH = 100;
export const HUNT_BONUS = 500;

// Three synth stations. The HUD prints the station and the current
// song title; audio.js plays a little step sequencer per station.
export const RADIO = [
  { station: 'NEON 98.5 FM', songs: ['Sunset Drive — The Palms', 'Vice Lights — Coral Club', 'Midnight Pier — Luna Ray'] },
  { station: 'BAY TALK 101', songs: ['The Marina Report — Live', 'Dockside Stories — Old Sal'] },
  { station: 'WAVE 88.2', songs: ['Tide Runner — Surf Static', 'Boardwalk Nights — The Gulls'] },
];

export const FONT = 'system-ui, "Segoe UI", sans-serif';
// v2 save key on purpose: v1 saves had no hunt progress to restore.
export const SAVE_KEY = 'neon-bay.save.v2';
export const BEST_KEY = 'neon-bay.best';
