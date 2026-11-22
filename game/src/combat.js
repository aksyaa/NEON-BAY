// Combat v2: the player's hitscan shots, police-car health,
// explosions and the cash that destroyed cars drop. A shot is a cone
// test from the player along the aim direction — fast, deterministic
// and easy to read. A stretched tracer box and a short muzzle flash
// sell every shot; a destroyed police car drops cash and raises heat.
import * as THREE from 'three';
import { clamp, distSq } from './random.js';

const SHOT_RANGE_SQ = 1600; // 40 units, squared
const SHOT_CONE = 0.92; // cosine of the half-angle
const SHOT_DAMAGE = 34;
const FIRE_COOLDOWN = 0.28;

export function createCombat(scene, rng) {
  const tracers = [];
  const cashDrops = [];
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  const tracerGeo = new THREE.BoxGeometry(0.08, 0.08, 40);
  const cashGeo = new THREE.BoxGeometry(0.9, 0.3, 0.6);
  const cashMat = new THREE.MeshBasicMaterial({ color: 0x2bff88 });
  let cooldown = 0;
  let flash = 0;

  function dropCash(x, z, value) {
    const mesh = new THREE.Mesh(cashGeo, cashMat);
    mesh.position.set(x, 0.4, z);
    scene.add(mesh);
    cashDrops.push({ x, z, value, mesh, bob: rng() * 6, taken: false });
  }

  // The target closest to the aim line, inside the cone and in range.
  function nearestInCone(origin, aimAngle, targets) {
    const dx = Math.sin(aimAngle);
    const dz = Math.cos(aimAngle);
    let best = null;
    let bestD2 = SHOT_RANGE_SQ;
    targets.forEach((t) => {
      const d2 = distSq(t.x, t.z, origin.x, origin.z);
      if (d2 > SHOT_RANGE_SQ || d2 < 0.01 || d2 >= bestD2) return;
      const d = Math.sqrt(d2);
      const dot = ((t.x - origin.x) * dx + (t.z - origin.z) * dz) / d;
      if (dot > SHOT_CONE) {
        bestD2 = d2;
        best = t;
      }
    });
    return best;
  }

  function fire(origin, aimAngle, targets, state) {
    if (cooldown > 0) return false;
    cooldown = FIRE_COOLDOWN;
    flash = 0.08;
    if (state.audio) state.audio.shot();

    const dx = Math.sin(aimAngle);
    const dz = Math.cos(aimAngle);
    const tracer = new THREE.Mesh(tracerGeo, tracerMat);
    tracer.position.set(origin.x + dx * 20, 1.4, origin.z + dz * 20);
    tracer.rotation.y = aimAngle;
    scene.add(tracer);
    tracers.push({ mesh: tracer, life: 0.09 });

    const hit = nearestInCone(origin, aimAngle, targets);
    if (!hit) return false;
    hit.health -= SHOT_DAMAGE;
    if (hit.health > 0) return true;
    hit.dead = true;
    if (hit.isPolice) {
      // A wrecked patrol car pays out and draws more heat.
      dropCash(hit.x, hit.z, 150);
      state.money += 150;
      if (state.police) state.police.addWanted(1);
      if (state.audio) state.audio.explosion();
    } else {
      dropCash(hit.x, hit.z, 50);
      state.money += 50;
    }
    return true;
  }

  function step(dt, player, state) {
    cooldown = Math.max(0, cooldown - dt);
    flash = Math.max(0, flash - dt);
    for (let i = tracers.length - 1; i >= 0; i -= 1) {
      tracers[i].life -= dt;
      if (tracers[i].life <= 0) {
        scene.remove(tracers[i].mesh);
        tracers.splice(i, 1);
      }
    }
    for (let i = cashDrops.length - 1; i >= 0; i -= 1) {
      const drop = cashDrops[i];
      drop.bob += dt * 3;
      drop.mesh.position.y = 0.4 + Math.abs(Math.sin(drop.bob)) * 0.25;
      drop.mesh.rotation.y += dt * 2;
      if (distSq(drop.x, drop.z, player.x, player.z) < 4) {
        state.money += drop.value;
        if (state.audio) state.audio.pickup();
        scene.remove(drop.mesh);
        cashDrops.splice(i, 1);
      }
    }
  }

  return {
    fire,
    step,
    spawnPickup: dropCash,
    pickups: cashDrops,
    get flash() {
      return flash;
    },
    get cooldown() {
      return cooldown;
    },
  };
}
