// Missions and story v2: Mara Reyes, a former courier who owes the
// wrong people money, works the debt off in three jobs across Neon
// Bay. Every job has a glowing beacon the player can see from across
// the city, a short line of dialogue, and a cash reward. New in v2:
// a side job — five neon packages stashed around the city, each paying
// $100, with a $500 bonus for the full set.
import * as THREE from 'three';
import { HUNT_BONUS, HUNT_COUNT, HUNT_EACH } from './config.js';
import { distSq } from './random.js';

export const MISSIONS = [
  {
    id: 1,
    title: 'Package Run',
    intro: 'DARIO: Mara — one package, Marina Beach, end of the pier. No questions asked.',
    target: { x: -285, z: 40, label: 'Deliver the package — Marina Pier' },
    reward: 300,
    radius: 7,
    done: 'Package delivered. Dario is pleased. For now.',
  },
  {
    id: 2,
    title: 'Borrowed Wheels',
    intro: 'DARIO: That yellow sports car downtown is mine now. Bring it to the Portside garage.',
    target: { x: 8, z: 60, label: 'Steal the yellow sports car (F)' },
    reward: 500,
    radius: 6,
    stealOnly: true,
    carColor: 0xf2c94c,
    done: 'Car delivered to the Portside garage. Half the debt is gone.',
  },
  {
    id: 3,
    title: 'Heat Escape',
    intro: 'DARIO: The Bay PD is on you now. Lose them and reach the Old Town hideout.',
    target: { x: -60, z: -210, label: 'Reach the hideout — Old Town' },
    reward: 800,
    radius: 8,
    wantedOnStart: 3,
    done: 'You made it. The debt is paid. Neon Bay is yours now, Mara.',
  },
];

// Where the five neon packages hide: corridor crossings and the beach,
// spread across all four districts.
const HUNT_SPOTS = [
  { x: 30, z: 240 },
  { x: -150, z: -30 },
  { x: 150, z: 150 },
  { x: -210, z: -180 },
  { x: 270, z: -90 },
];

function makeBeacon() {
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffe14d,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 60, 16, 1, true), mat);
  beam.visible = false;
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.8 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.4, 8, 24), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.visible = false;
  return { beam, ring };
}

export function createMissions(scene) {
  const { beam, ring } = makeBeacon();
  scene.add(beam);
  scene.add(ring);

  let index = 0;
  let active = false;
  let time = 0;

  function current() {
    return index < MISSIONS.length ? MISSIONS[index] : null;
  }

  function start(state) {
    const m = current();
    if (!m) return null;
    active = true;
    beam.position.set(m.target.x, 30, m.target.z);
    beam.visible = true;
    ring.position.set(m.target.x, 0.3, m.target.z);
    ring.visible = true;
    if (m.wantedOnStart && state.police) state.police.wanted = m.wantedOnStart;
    return m;
  }

  function complete(state) {
    const m = current();
    if (!m) return null;
    state.money += m.reward;
    state.score += m.reward;
    index += 1;
    active = false;
    beam.visible = false;
    ring.visible = false;
    if (current()) return start(state);
    state.storyComplete = true;
    return null;
  }

  function step(dt, player, inCar, state) {
    time += dt;
    const m = current();
    if (!m || !active) return null;
    beam.material.opacity = 0.35 + Math.sin(time * 3) * 0.12;
    ring.scale.setScalar(1 + Math.sin(time * 3) * 0.08);
    // A steal-only job never completes by arriving: it completes when
    // the player actually steals the target car (main.js, enterOrExitCar).
    if (m.stealOnly) return null;
    const arrived = distSq(player.x, player.z, m.target.x, m.target.z) < m.radius * m.radius;
    if (!arrived) return null;
    if (m.needsCar && !inCar) return 'needCar';
    return complete(state);
  }

  return {
    current,
    start,
    step,
    complete,
    get index() {
      return index;
    },
    set index(v) {
      index = v;
    },
    get active() {
      return active;
    },
    get target() {
      const m = current();
      return m ? m.target : null;
    },
  };
}

// The neon-package hunt: five glowing cyan crates. Walk or drive into
// one to collect it. The hunt runs beside the story — it never blocks
// a mission, and it pays out on its own.
export function createHunt(scene, rng) {
  const packages = [];
  const boxGeo = new THREE.BoxGeometry(1.4, 1.4, 1.4);
  const boxMat = new THREE.MeshBasicMaterial({ color: 0x29e6ff });
  const edgeGeo = new THREE.BoxGeometry(1.6, 0.15, 1.6);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  let collected = 0;
  let spin = 0;

  HUNT_SPOTS.forEach((spot) => {
    const group = new THREE.Group();
    const box = new THREE.Mesh(boxGeo, boxMat);
    box.position.y = 1.2;
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = 1.2;
    group.add(box);
    group.add(edge);
    group.position.set(spot.x, 0, spot.z);
    scene.add(group);
    packages.push({ x: spot.x, z: spot.z, mesh: group, taken: false });
  });

  function step(dt, player, state) {
    spin += dt;
    packages.forEach((p) => {
      if (p.taken) return;
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = Math.abs(Math.sin(spin * 2 + p.x)) * 0.3;
      if (distSq(p.x, p.z, player.x, player.z) >= 16) return;
      p.taken = true;
      p.mesh.visible = false;
      collected += 1;
      state.money += HUNT_EACH;
      state.score += HUNT_EACH;
      if (state.audio) state.audio.pickup();
      if (collected >= HUNT_COUNT) {
        state.money += HUNT_BONUS;
        state.score += HUNT_BONUS;
        if (state.audio) state.audio.mission();
        if (state.hud) state.hud.showToast(`Neon hunt complete! +$${HUNT_BONUS} bonus`);
      } else if (state.hud) {
        state.hud.showToast(`Neon package ${collected}/${HUNT_COUNT}  •  +$${HUNT_EACH}`);
      }
    });
  }

  return {
    packages,
    step,
    get collected() {
      return collected;
    },
    // Restore progress from a save: hide the first n packages.
    restore(n) {
      for (let i = 0; i < Math.min(n, packages.length); i += 1) {
        packages[i].taken = true;
        packages[i].mesh.visible = false;
      }
      collected = Math.min(n, packages.length);
    },
  };
}
