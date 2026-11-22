// Saving and loading: the whole campaign (money, health, mission,
// position, wanted level, neon-package hunt, score) in a single
// localStorage key, plus the best score in another. Every access is
// guarded — private windows or disabled storage just mean the save
// does not stick, never a crash.
import { BEST_KEY, SAVE_KEY } from './config.js';

function pack(state) {
  return {
    money: state.money,
    health: state.health,
    armor: state.armor,
    missionIndex: state.missions ? state.missions.index : 0,
    hunt: state.hunt ? state.hunt.collected : 0,
    x: state.player.x,
    z: state.player.z,
    angle: state.player.angle,
    wanted: state.police ? state.police.wanted : 0,
    score: state.score,
    storyComplete: !!state.storyComplete,
    savedAt: Date.now(),
  };
}

function unpack(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data.money !== 'number' || typeof data.x !== 'number') return null;
  if (typeof data.z !== 'number' || typeof data.angle !== 'number') return null;
  return data;
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(pack(state)));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return unpack(raw);
  } catch {
    return null;
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}
