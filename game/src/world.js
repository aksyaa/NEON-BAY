// Neon Bay itself v2: a procedural sunset city built only from code.
// No textures or models are loaded from anywhere: the ground and the
// building facades are canvas textures painted at boot, and every
// building, palm, lamp, container and neon sign is an instanced box,
// cylinder or cone. Colliders are plain AABBs the car and the on-foot
// movement resolve against.
//
// Layout rule the screenshot staging relies on: blocks sit on a 60
// unit grid and buildings fill the block centres, so the painted road
// lines (x = k*60) run into a facade. The clear corridors between
// blocks are centred on x = 30 + 60k (and z = 30 + 60k) — 21 units
// wide, no buildings, no lamps, no containers in Downtown.
import * as THREE from 'three';
import { CITY, DISTRICTS, PALETTE } from './config.js';
import { chance, pick, range } from './random.js';

const NEON_COLORS = [0xff4fd8, 0x29e6ff, 0xff9f1c, 0xa06bff, 0xffe14d];
const CONTAINER_COLORS = [0xd95f2b, 0x2b7dd9, 0x3fae5a, 0xd9b62b, 0x9b59b6];
const WINDOW_COLORS = ['#ffd166', '#ff9f1c', '#29e6ff', '#ff4fd8'];
const UMBRELLA_COLORS = ['#ff4fd8', '#29e6ff', '#ff9f1c', '#f4f1ff'];

function paintFacade(rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#23263d';
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? pick(rng, WINDOW_COLORS) : '#0d0f1e';
      g.globalAlpha = lit ? 0.95 : 1;
      g.fillRect(x, y, 10, 10);
    }
  }
  g.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function paintGround(rng) {
  const S = 1024;
  const WORLD = 700;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const toPx = (v) => ((v + WORLD / 2) / WORLD) * S;
  // Sea on the west, sand, then the city base.
  g.fillStyle = '#0e4d6e';
  g.fillRect(0, 0, S, S);
  g.fillStyle = '#e8c88f';
  g.fillRect(0, 0, toPx(-215), S);
  g.fillStyle = '#23232e';
  g.fillRect(toPx(-215), 0, S - toPx(-215), S);
  // Sidewalk blocks.
  g.fillStyle = '#3a3a48';
  for (let i = -4; i <= 4; i += 1) {
    for (let j = -4; j <= 4; j += 1) {
      const cx = i * 60;
      const cz = j * 60;
      if (cx < -180) continue;
      g.fillRect(toPx(cx - 23), toPx(cz - 23), toPx(46) - toPx(0), toPx(46) - toPx(0));
    }
  }
  // Roads: bright asphalt with yellow centre dashes (v2 polish: the
  // streets read clearly even in a small thumbnail).
  g.fillStyle = '#55555f';
  for (let k = -5; k <= 5; k += 1) {
    const p = k * 60;
    g.fillRect(toPx(p - 7), 0, toPx(14) - toPx(0), S);
    g.fillRect(0, toPx(p - 7), S, toPx(14) - toPx(0));
  }
  g.fillStyle = '#ffe14d';
  for (let k = -5; k <= 5; k += 1) {
    const p = k * 60;
    for (let d = -330; d < 330; d += 24) {
      g.fillRect(toPx(p) - 1.5, toPx(d), 3, 12);
      g.fillRect(toPx(d), toPx(p) - 1.5, 12, 3);
    }
  }
  // Beach umbrella dots, for colour from above.
  for (let i = 0; i < 40; i += 1) {
    g.fillStyle = pick(rng, UMBRELLA_COLORS);
    g.beginPath();
    g.arc(toPx(range(rng, -290, -225)), toPx(range(rng, -280, 280)), 4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function districtAt(x, z) {
  if (x < -180) return DISTRICTS[0];
  if (z > 120) return DISTRICTS[2];
  if (z < -120) return DISTRICTS[3];
  return DISTRICTS[1];
}

export function createWorld(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);
  const m4 = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const col = new THREE.Color();

  function addCollider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }

  // Ground plane: sea, sand and city painted into one texture.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ map: paintGround(rng) }),
  );
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);

  // Sea shimmer plane further west, animated in update().
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 700),
    new THREE.MeshLambertMaterial({ color: 0x0e5a7e, transparent: true, opacity: 0.85 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(-360, 0.05, 0);
  group.add(sea);

  // Buildings: one instanced mesh, lit-window facade texture.
  const facade = paintFacade(rng);
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  buildingGeo.translate(0, 0.5, 0);
  const buildingMat = new THREE.MeshLambertMaterial({
    map: facade,
    emissive: 0xffffff,
    emissiveMap: facade,
    emissiveIntensity: 0.35,
  });
  const placements = [];
  for (let i = -4; i <= 4; i += 1) {
    for (let j = -4; j <= 4; j += 1) {
      const cx = i * 60;
      const cz = j * 60;
      if (cx < -180) continue; // Marina Beach stays open: sand, palms, pier.
      const district = districtAt(cx, cz);
      if (district.name === 'Portside') {
        placements.push({ x: cx, z: cz, w: 34, d: 26, h: range(rng, 9, 15), c: 0x5a6b7d });
      } else if (district.name === 'Downtown Neon') {
        placements.push({ x: cx - 6, z: cz - 4, w: 26, d: 24, h: range(rng, 34, 88), c: 0x2c2f45 });
        if (chance(rng, 0.6)) {
          placements.push({ x: cx + 12, z: cz + 10, w: 16, d: 14, h: range(rng, 14, 30), c: 0x3a3f5e });
        }
      } else {
        placements.push({ x: cx - 8, z: cz - 6, w: 20, d: 16, h: range(rng, 8, 16), c: 0x8a6f5a });
        placements.push({ x: cx + 10, z: cz + 8, w: 16, d: 14, h: range(rng, 6, 13), c: 0x6a7a5a });
      }
    }
  }
  const buildings = new THREE.InstancedMesh(buildingGeo, buildingMat, placements.length);
  placements.forEach((p, idx) => {
    m4.compose(new THREE.Vector3(p.x, 0, p.z), quat, new THREE.Vector3(p.w, p.h, p.d));
    buildings.setMatrixAt(idx, m4);
    buildings.setColorAt(idx, col.setHex(p.c));
    addCollider(p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2);
  });
  buildings.instanceMatrix.needsUpdate = true;
  group.add(buildings);

  // Neon signs: thin emissive boxes on downtown rooftops and facades.
  const neonGeo = new THREE.BoxGeometry(1, 1, 1);
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const neonSpots = [];
  placements.forEach((p) => {
    if (p.h > 30 && chance(rng, 0.8)) {
      neonSpots.push({
        x: p.x, y: p.h + 1.2, z: p.z,
        w: Math.min(18, p.w * 0.8), h: 2.2, d: 1, color: pick(rng, NEON_COLORS),
      });
      neonSpots.push({
        x: p.x + p.w / 2 + 0.4, y: p.h * 0.6, z: p.z,
        w: 1, h: range(rng, 8, 18), d: 3, color: pick(rng, NEON_COLORS),
      });
    }
  });
  const neons = new THREE.InstancedMesh(neonGeo, neonMat, Math.max(1, neonSpots.length));
  neonSpots.forEach((n, idx) => {
    m4.compose(new THREE.Vector3(n.x, n.y, n.z), quat, new THREE.Vector3(n.w, n.h, n.d));
    neons.setMatrixAt(idx, m4);
    neons.setColorAt(idx, col.setHex(n.color));
  });
  neons.instanceMatrix.needsUpdate = true;
  group.add(neons);

  // Portside containers, stacked in rows off the roads.
  const contGeo = new THREE.BoxGeometry(10, 3, 3);
  const contMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const contSpots = [];
  for (let i = 0; i < 42; i += 1) {
    const x = range(rng, -120, 260);
    const z = range(rng, 150, 280);
    if (Math.abs(x % 60) < 12 || Math.abs(z % 60) < 12) continue;
    contSpots.push({ x, z, y: chance(rng, 0.3) ? 4.5 : 1.5, color: pick(rng, CONTAINER_COLORS) });
  }
  const containers = new THREE.InstancedMesh(contGeo, contMat, Math.max(1, contSpots.length));
  contSpots.forEach((s, idx) => {
    m4.compose(new THREE.Vector3(s.x, s.y, s.z), quat, new THREE.Vector3(1, 1, 1));
    containers.setMatrixAt(idx, m4);
    containers.setColorAt(idx, col.setHex(s.color));
    addCollider(s.x - 5, s.x + 5, s.z - 1.6, s.z + 1.6);
  });
  containers.instanceMatrix.needsUpdate = true;
  group.add(containers);

  // Palms along the beach promenade.
  const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const crownGeo = new THREE.ConeGeometry(3.2, 4, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e7d4a });
  const palmSpots = [];
  for (let z = -280; z <= 280; z += 28) {
    palmSpots.push({ x: -222 + range(rng, -4, 4), z: z + range(rng, -6, 6) });
    if (chance(rng, 0.5)) palmSpots.push({ x: -196 + range(rng, -4, 4), z: z + range(rng, -8, 8) });
  }
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpots.length);
  palmSpots.forEach((p, idx) => {
    m4.compose(new THREE.Vector3(p.x, 3.5, p.z), quat, new THREE.Vector3(1, 1, 1));
    trunks.setMatrixAt(idx, m4);
    m4.compose(new THREE.Vector3(p.x, 8.4, p.z), quat, new THREE.Vector3(1, 1, 1));
    crowns.setMatrixAt(idx, m4);
    addCollider(p.x - 0.5, p.x + 0.5, p.z - 0.5, p.z + 0.5);
  });
  trunks.instanceMatrix.needsUpdate = true;
  crowns.instanceMatrix.needsUpdate = true;
  group.add(trunks);
  group.add(crowns);

  // Street lamps along every road, warm glow spheres on top.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const glowGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
  const lampSpots = [];
  for (let k = -5; k <= 5; k += 1) {
    for (let d = -240; d <= 240; d += 60) {
      if (k * 60 < -180) continue;
      lampSpots.push({ x: k * 60 + 8, z: d });
      lampSpots.push({ x: d, z: k * 60 + 8 });
    }
  }
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
  const glows = new THREE.InstancedMesh(glowGeo, glowMat, lampSpots.length);
  lampSpots.forEach((p, idx) => {
    m4.compose(new THREE.Vector3(p.x, 3, p.z), quat, new THREE.Vector3(1, 1, 1));
    poles.setMatrixAt(idx, m4);
    m4.compose(new THREE.Vector3(p.x, 6.2, p.z), quat, new THREE.Vector3(1, 1, 1));
    glows.setMatrixAt(idx, m4);
  });
  poles.instanceMatrix.needsUpdate = true;
  glows.instanceMatrix.needsUpdate = true;
  group.add(poles);
  group.add(glows);

  // Marina pier reaching into the sea, and a lifeguard tower.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(60, 1, 8), pierMat);
  pier.position.set(-290, 0.5, 40);
  group.add(pier);
  const tower = new THREE.Mesh(
    new THREE.BoxGeometry(4, 7, 4),
    new THREE.MeshLambertMaterial({ color: 0xf4f1ff }),
  );
  tower.position.set(-232, 3.5, -60);
  group.add(tower);
  addCollider(-234, -230, -62, -58);

  // The sun: a big glowing disc low on the horizon, west over the sea.
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd166, fog: false }),
  );
  sun.position.set(-420, 42, -80);
  sun.lookAt(0, 42, -80);
  group.add(sun);

  let time = 0;
  return {
    colliders,
    group,
    sea,
    districtAt,
    playerStart: { x: -205, z: 20, angle: Math.PI / 2 },
    // Snap a point to the nearest road centre line.
    roadPoint(x, z) {
      const snap = (v) => Math.round(v / 60) * 60;
      return Math.abs(x - snap(x)) < Math.abs(z - snap(z))
        ? { x: snap(x), z }
        : { x, z: snap(z) };
    },
    // Circle vs building AABBs: push the circle out, return true on hit.
    collideCircle(pos, radius) {
      let hit = false;
      for (let i = 0; i < colliders.length; i += 1) {
        const c = colliders[i];
        const nx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const nz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - nx;
        const dz = pos.z - nz;
        const d2 = dx * dx + dz * dz;
        if (d2 < radius * radius) {
          hit = true;
          if (d2 > 0.0001) {
            const d = Math.sqrt(d2);
            pos.x = nx + (dx / d) * radius;
            pos.z = nz + (dz / d) * radius;
          } else {
            pos.x = c.maxX + radius;
          }
        }
      }
      return hit;
    },
    update(dt) {
      time += dt;
      sea.position.y = 0.05 + Math.sin(time * 0.7) * 0.06;
      sea.material.opacity = 0.82 + Math.sin(time * 0.5) * 0.05;
    },
  };
}
