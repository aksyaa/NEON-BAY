// Neon Bay v2 — boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none
// in a fast one), and the renderer paints what is there. The game moves
// between five screens: title, play, paused, game over and story
// complete.
//
// ?seed=N fixes the world. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it
// three times and sets window.__shotReady for a screenshot.
import * as THREE from 'three';
import { CAR, MONEY_START, PLAYER, STEP } from './config.js';
import { createRandom, clamp, distSq } from './random.js';
import { createWorld, districtAt } from './world.js';
import { createVehicles } from './vehicles.js';
import { createPedestrians } from './pedestrians.js';
import { createPolice } from './police.js';
import { createCombat } from './combat.js';
import { createHunt, createMissions, MISSIONS } from './missions.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';
import {
  createInput,
  ACTION_CONFIRM,
  ACTION_ENTER,
  ACTION_HORN,
  ACTION_PAUSE,
  ACTION_RADIO,
  ACTION_SAVE,
  ACTION_SHOOT,
} from './input.js';
import {
  createRender,
  SCREEN_TITLE,
  SCREEN_PLAY,
  SCREEN_PAUSED,
  SCREEN_OVER,
  SCREEN_COMPLETE,
} from './render.js';
import { loadGame, saveGame, readBest, saveBest } from './save.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('scene');
const status = document.getElementById('status');
const render = createRender(canvas);
const scene = render.scene;
const rng = createRandom(seed);
const world = createWorld(scene, rng);
const vehicles = createVehicles(scene, world, rng);
const pedestrians = createPedestrians(scene, world, rng);
const police = createPolice(scene, world, vehicles, rng);
const combat = createCombat(scene, rng);
const missions = createMissions(scene);
const hunt = createHunt(scene, rng);
const hud = createHud();
const audio = createAudio();
audio.setSongCallback((station, song) => hud.setRadio(station, song));

function freshState() {
  return {
    money: MONEY_START,
    health: PLAYER.health,
    armor: PLAYER.armor,
    score: 0,
    elapsed: 0,
    district: 'Marina Beach',
    inCar: false,
    car: null,
    carSpeed: 0,
    carHealth: 100,
    damageFlash: 0,
    busted: false,
    storyComplete: false,
    noRoadblock: false,
    player: { x: world.playerStart.x, z: world.playerStart.z, angle: world.playerStart.angle },
    vehicles,
    police,
    missions,
    hunt,
    audio,
    combat,
    hud,
  };
}

const state = freshState();

let screen = SCREEN_TITLE;
let best = readBest();
let needCarToastAt = -10;
let fpsFrames = 0;
let fpsTime = 0;
let fpsValue = 0;

// Health packs scattered around the city (green crosses).
const healthPacks = [];
(function placeHealthPacks() {
  const spots = [[-210, 80], [60, -60], [-60, 180], [180, -180], [0, 240], [-120, -60]];
  const geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x2bff88 });
  spots.forEach(([x, z]) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.8, z);
    scene.add(mesh);
    healthPacks.push({ x, z, mesh, taken: false });
  });
})();

function announce(message) {
  status.textContent = message;
}

const SCREEN_ELEMENTS = {
  [SCREEN_TITLE]: 'title-screen',
  [SCREEN_PAUSED]: 'pause-screen',
  [SCREEN_OVER]: 'over-screen',
  [SCREEN_COMPLETE]: 'complete-screen',
};

function showScreen(name) {
  screen = name;
  Object.values(SCREEN_ELEMENTS).forEach((id) => {
    document.getElementById(id).style.display = 'none';
  });
  if (SCREEN_ELEMENTS[name]) {
    document.getElementById(SCREEN_ELEMENTS[name]).style.display = 'flex';
  }
  document.getElementById('hud').style.display = name === SCREEN_PLAY ? 'block' : 'none';
  // The edge arrow is managed by hud.update every frame while playing;
  // only force it off on the other screens.
  if (name !== SCREEN_PLAY) document.getElementById('edge-arrow').style.opacity = '0';
}

function startGame(fresh) {
  if (fresh) {
    const clean = freshState();
    Object.assign(state, clean);
    state.player.x = world.playerStart.x;
    state.player.z = world.playerStart.z;
    state.player.angle = world.playerStart.angle;
    missions.index = 0;
    police.wanted = 0;
  }
  const mission = missions.start(state);
  if (mission) hud.showDialog(mission.intro);
  hud.setRadio(audio.stationName, audio.songName);
  showScreen(SCREEN_PLAY);
  announce('Neon Bay. Mara Reyes. Press F near a car to drive.');
}

function endGame(reason) {
  if (state.score > best) {
    best = state.score;
    saveBest(best);
  }
  document.getElementById('over-title').textContent = reason === 'busted' ? 'BUSTED' : 'WASTED';
  document.getElementById('over-text').textContent = reason === 'busted'
    ? 'The Bay PD caught Mara. The debt is still waiting.'
    : 'Mara is down. Neon Bay keeps its secrets — for now.';
  document.getElementById('over-score').textContent = 'Score ' + state.score + '  •  Best ' + best;
  showScreen(SCREEN_OVER);
  announce('Game over. ' + document.getElementById('over-title').textContent);
}

function enterOrExitCar() {
  if (state.inCar) {
    const car = state.car;
    state.inCar = false;
    state.car = null;
    state.player.x = car.x + Math.cos(car.angle) * 3;
    state.player.z = car.z - Math.sin(car.angle) * 3;
    state.player.angle = car.angle;
    hud.showToast('On foot — press F near a car to drive');
    return;
  }
  const car = vehicles.nearestStealable(state.player.x, state.player.z, 6);
  if (!car) {
    hud.showToast('No car close enough — walk to a parked car');
    return;
  }
  // A stolen traffic car leaves the traffic flow, or the traffic step
  // would keep driving it while the player drives it too.
  const trafficIndex = vehicles.traffic.indexOf(car);
  if (trafficIndex >= 0) vehicles.traffic.splice(trafficIndex, 1);
  state.inCar = true;
  state.car = car;
  car.parked = false;
  car.stolen = true;
  if (car !== vehicles.playerCar) {
    police.addWanted(1);
    hud.showToast('Car stolen! The Bay PD has been called.');
    audio.mission();
  } else {
    hud.showToast('Driving your car — WASD to drive, Space to drift');
  }
  state.player.x = car.x;
  state.player.z = car.z;
  state.player.angle = car.angle;
  // Stealing the yellow sports car finishes mission 2.
  const mission = missions.current();
  if (mission && mission.id === 2 && car.sport) {
    const next = missions.complete(state);
    hud.showDialog(mission.done);
    audio.mission();
    if (next) hud.showDialog(next.intro);
    if (state.storyComplete) showScreen(SCREEN_COMPLETE);
  }
}

function stepPlayerOnFoot(dt, input) {
  const p = state.player;
  p.angle += input.steer() * PLAYER.turnSpeed * 0.35 * dt;
  const speed = input.run() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  const moving = input.forward() || input.back();
  if (moving) {
    const dir = input.forward() ? 1 : -0.6;
    p.x += Math.sin(p.angle) * speed * dir * dt;
    p.z += Math.cos(p.angle) * speed * dir * dt;
  }
  p.x = clamp(p.x, -298, 298);
  p.z = clamp(p.z, -298, 298);
  world.collideCircle(p, PLAYER.radius);
  // Bumping into cars hurts a little and pushes the player out.
  [...vehicles.traffic, ...vehicles.parked, vehicles.playerCar].forEach((car) => {
    const d2 = distSq(p.x, p.z, car.x, car.z);
    if (d2 < 5.8 && d2 > 0.01) {
      const d = Math.sqrt(d2);
      p.x = car.x + ((p.x - car.x) / d) * 2.4;
      p.z = car.z + ((p.z - car.z) / d) * 2.4;
    }
  });
  // Health packs.
  healthPacks.forEach((pack) => {
    if (pack.taken) return;
    if (distSq(p.x, p.z, pack.x, pack.z) < 4) {
      pack.taken = true;
      pack.mesh.visible = false;
      state.health = Math.min(100, state.health + 30);
      audio.pickup();
      hud.showToast('+30 health');
    }
  });
  render.syncPlayer(p.x, p.z, p.angle, moving, state.elapsed);
  render.setPlayerVisible(true);
  return moving;
}

function step(dt, input) {
  state.elapsed += dt;
  const actions = input.takeActions();
  if (actions & ACTION_PAUSE) {
    if (screen === SCREEN_PLAY) {
      showScreen(SCREEN_PAUSED);
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED) {
      showScreen(SCREEN_PLAY);
    }
    return;
  }
  if (screen !== SCREEN_PLAY) return;
  if (actions & ACTION_ENTER) enterOrExitCar();
  if (actions & ACTION_RADIO) {
    audio.nextStation();
    hud.setRadio(audio.stationName, audio.songName);
  }
  if (actions & ACTION_SAVE) {
    if (saveGame(state)) hud.showToast('Game saved');
    else hud.showToast('Save failed — storage unavailable');
  }
  if (actions & ACTION_HORN) audio.horn();
  if (actions & ACTION_SHOOT) {
    const aim = state.inCar && state.car ? state.car.angle : state.player.angle;
    const targets = [...police.cars, ...vehicles.traffic];
    const fired = combat.fire(state.player, aim, targets, state);
    // Firing a weapon in public draws heat, but only up to two stars:
    // the big jumps come from stealing cars and wrecking patrol cars.
    if (fired && police.wanted < 2) police.addWanted(1);
  }

  let moving = false;
  let speed = 0;
  if (state.inCar && state.car) {
    const res = vehicles.stepPlayerCar(dt, input, state, state.car);
    speed = res.speed;
    state.carSpeed = speed;
    state.player.x = state.car.x;
    state.player.z = state.car.z;
    state.player.angle = state.car.angle;
    render.setPlayerVisible(false);
    moving = Math.abs(speed) > 1;
  } else {
    moving = stepPlayerOnFoot(dt, input);
  }

  vehicles.stepTraffic(dt);
  pedestrians.step(dt, state.player, combat.flash > 0, police.wanted);
  const bust = police.step(dt, state.player, state.inCar, state);
  combat.step(dt, state.player, state);
  hunt.step(dt, state.player, state);

  // Remove destroyed cars from the world.
  for (let i = police.cars.length - 1; i >= 0; i -= 1) {
    if (police.cars[i].dead) {
      scene.remove(police.cars[i].mesh);
      police.cars.splice(i, 1);
    }
  }
  for (let i = vehicles.traffic.length - 1; i >= 0; i -= 1) {
    if (vehicles.traffic[i].dead) {
      scene.remove(vehicles.traffic[i].mesh);
      vehicles.traffic.splice(i, 1);
    }
  }

  // Missions.
  const prevIndex = missions.index;
  const missionResult = missions.step(dt, state.player, state.inCar, state);
  if (missionResult === 'needCar' && state.elapsed - needCarToastAt > 4) {
    needCarToastAt = state.elapsed;
    hud.showToast('This job needs a car — press F near one');
  } else if (missions.index > prevIndex) {
    const done = MISSIONS[prevIndex];
    hud.showDialog(done.done);
    audio.mission();
    const next = missions.current();
    if (next) setTimeout(() => hud.showDialog(next.intro), 3500);
    if (state.storyComplete) {
      document.getElementById('complete-score').textContent =
        'Score ' + state.score + '  •  Best ' + Math.max(best, state.score);
      showScreen(SCREEN_COMPLETE);
    }
  }

  state.district = districtAt(state.player.x, state.player.z).name;
  world.update(dt);
  audio.engine(speed, state.inCar);
  audio.siren(police.wanted);
  audio.update();
  hud.update(state, dt);

  // Camera follows the player or the car.
  const drag = input.takeDrag();
  const focus = { x: state.player.x, z: state.player.z };
  const heading = state.player.angle;
  render.updateCamera(dt, focus, heading, state.inCar ? speed : (moving ? 6 : 0), drag);
  if (state.damageFlash > 0) {
    state.damageFlash -= dt;
    render.addShake(0.35);
  }
  if (state.health <= 0) {
    endGame('wasted');
    return;
  }
  if (state.busted) {
    endGame('busted');
    return;
  }
  // Autosave every 20 seconds.
  if (Math.floor(state.elapsed) % 20 === 0 && Math.floor(state.elapsed - dt) % 20 !== 0) {
    saveGame(state);
  }
}

function runShot(name) {
  const game = { state, world, vehicles, police, pedestrians, missions, hunt, render, hud };
  const staged = stageShot(name, game);
  state.district = districtAt(state.player.x, state.player.z).name;
  hud.setRadio(audio.stationName, audio.songName);
  showScreen(staged.screen === 'title' ? SCREEN_TITLE : SCREEN_PLAY);
  if (staged.screen === 'title') {
    document.getElementById('title-screen').style.display = 'flex';
  }
  // hud.update runs after showScreen: it paints the edge arrow (which
  // showScreen leaves alone on the play screen) and starts the district
  // toast, which is hidden right after for a clean frame.
  hud.update(state, 0.016);
  document.getElementById('district').style.opacity = '0';
  let painted = 0;
  if (staged.camera !== 'title') {
    render.snapCamera({ x: state.player.x, z: state.player.z }, state.player.angle);
  }
  function paint() {
    if (staged.camera === 'title') render.titleCamera(0.016, 42);
    else {
      render.updateCamera(
        0.016,
        { x: state.player.x, z: state.player.z },
        state.player.angle,
        12,
        { x: 0, y: 0 },
      );
    }
    render.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  // Resume a save if one exists: offer it on the title screen.
  const save = loadGame();
  if (save) {
    document.getElementById('continue-btn').style.display = 'inline-block';
    document.getElementById('continue-btn').addEventListener('click', () => {
      audio.ensure();
      state.money = save.money;
      state.health = save.health;
      state.armor = save.armor;
      state.score = save.score;
      state.storyComplete = save.storyComplete;
      state.player.x = save.x;
      state.player.z = save.z;
      state.player.angle = save.angle;
      missions.index = save.missionIndex || 0;
      police.wanted = save.wanted || 0;
      if (save.hunt) hunt.restore(save.hunt);
      startGame(false);
    });
  }
  document.getElementById('start-btn').addEventListener('click', () => {
    audio.ensure();
    startGame(true);
  });
  document.getElementById('resume-btn').addEventListener('click', () => showScreen(SCREEN_PLAY));
  document.getElementById('restart-btn').addEventListener('click', () => startGame(true));
  document.getElementById('again-btn').addEventListener('click', () => startGame(true));
  document.getElementById('title-screen').addEventListener('pointerdown', () => audio.ensure(), { once: true });

  function frame(now) {
    requestAnimationFrame(frame);
    const frameDt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    fpsFrames += 1;
    fpsTime += frameDt;
    if (fpsTime >= 1) {
      fpsValue = Math.round(fpsFrames / fpsTime);
      fpsFrames = 0;
      fpsTime = 0;
      window.__fps = fpsValue;
    }
    accumulator += frameDt;
    if (screen === SCREEN_TITLE) {
      render.titleCamera(frameDt, state.elapsed);
      state.elapsed += frameDt;
      world.update(frameDt);
      vehicles.stepTraffic(frameDt);
      render.render();
      const actions = input.takeActions();
      if (actions & ACTION_CONFIRM) {
        audio.ensure();
        startGame(true);
      }
      return;
    }
    while (accumulator >= STEP && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED)) {
      step(STEP, input);
      accumulator -= STEP;
    }
    if (screen === SCREEN_OVER || screen === SCREEN_COMPLETE) {
      input.takeActions();
      input.takeDrag();
    }
    render.render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) showScreen(SCREEN_PAUSED);
  });

  showScreen(SCREEN_TITLE);
  announce('Neon Bay. Press Enter or click Start to play.');
  requestAnimationFrame(frame);
}

window.__game = {
  state,
  get screen() {
    return screen;
  },
  get fps() {
    return fpsValue;
  },
};
window.__shotReady = false;
if (shot) runShot(shot);
else runGame();
