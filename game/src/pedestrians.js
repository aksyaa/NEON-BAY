// Pedestrians v2: people who walk the sidewalks, turn at
// intersections, and run away when shots are fired or the wanted level
// rises. Each one is a box body, a sphere head and a coloured shirt;
// about a third of them walk in pairs, a step apart, like they are
// out together. Bobbing while they walk sells the movement.
import * as THREE from 'three';
import { PED_COUNT } from './config.js';
import { chance, clamp, distSq, pick, range } from './random.js';

const SHIRTS = [0xff8a5c, 0x5cc8ff, 0x9dff6e, 0xff5c8a, 0xffe14d, 0xc9b8ff, 0xffffff];
const SKIN = 0xe8b88a;
const PANTS = 0x2b2b33;

export function createPedestrians(scene, world, rng) {
  const people = [];
  const bodyGeo = new THREE.BoxGeometry(0.7, 1.3, 0.45);
  const headGeo = new THREE.SphereGeometry(0.28, 8, 6);
  const legGeo = new THREE.BoxGeometry(0.55, 0.7, 0.4);

  function spawnPerson(x, z) {
    const group = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(rng, SHIRTS) });
    const body = new THREE.Mesh(bodyGeo, shirt);
    body.position.y = 1.15;
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: SKIN }));
    head.position.y = 2.05;
    const legs = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: PANTS }));
    legs.position.y = 0.35;
    group.add(body);
    group.add(head);
    group.add(legs);
    group.position.set(x, 0, z);
    scene.add(group);
    return {
      x,
      z,
      angle: pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]),
      speed: range(rng, 1.2, 2.2),
      mesh: group,
      fleeing: 0,
      bob: rng() * 6,
    };
  }

  // Stand just off a road, on a sidewalk. Pairs share a heading and
  // walk one behind the other.
  function sidewalkSpot() {
    const horizontal = rng() < 0.5;
    const line = Math.round(range(rng, -4, 4)) * 60 + 9;
    const along = range(rng, -270, 270);
    return horizontal ? { x: along, z: line } : { x: line, z: along };
  }

  let placed = 0;
  while (placed < PED_COUNT) {
    const spot = sidewalkSpot();
    const first = spawnPerson(spot.x, spot.z);
    people.push(first);
    placed += 1;
    if (placed < PED_COUNT && chance(rng, 0.35)) {
      const second = spawnPerson(
        spot.x - Math.sin(first.angle) * 1.4,
        spot.z - Math.cos(first.angle) * 1.4,
      );
      second.angle = first.angle;
      second.speed = first.speed;
      people.push(second);
      placed += 1;
    }
  }

  function step(dt, player, shooting, wanted) {
    people.forEach((p) => {
      const near = distSq(p.x, p.z, player.x, player.z) < 900;
      if ((shooting || wanted > 0) && near) p.fleeing = 2.5;
      let speed = p.speed;
      if (p.fleeing > 0) {
        p.fleeing -= dt;
        speed = 6;
        p.angle = Math.atan2(p.x - player.x, p.z - player.z);
      } else {
        // At an intersection, sometimes turn onto the crossing street.
        const nearX = Math.round(p.x / 60) * 60;
        const nearZ = Math.round(p.z / 60) * 60;
        const onCorner = Math.abs(p.x - nearX) < 1 && Math.abs(p.z - nearZ) < 1;
        if (onCorner && chance(rng, 0.01)) {
          p.angle += pick(rng, [-Math.PI / 2, Math.PI / 2, Math.PI]);
          p.x = nearX + Math.sin(p.angle) * 9;
          p.z = nearZ + Math.cos(p.angle) * 9;
        }
      }
      p.x += Math.sin(p.angle) * speed * dt;
      p.z += Math.cos(p.angle) * speed * dt;
      p.x = clamp(p.x, -295, 295);
      p.z = clamp(p.z, -295, 295);
      world.collideCircle(p, 0.6);
      p.bob += dt * speed * 2;
      p.mesh.position.set(p.x, Math.abs(Math.sin(p.bob)) * 0.08, p.z);
      p.mesh.rotation.y = p.angle;
    });
  }

  return { people, step };
}
