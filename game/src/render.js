// Rendering v2: the Three.js scene, the sunset lighting and the
// camera. The sky is a gradient dome painted on a canvas, the sun a
// low disc over the sea, and the light is one warm directional sun
// plus a purple hemisphere fill — cheap enough for a steady 60 fps.
// The camera chases behind the player or the car, smoothed, and a
// mouse drag orbits it freely until the player moves again.
import * as THREE from 'three';
import { PALETTE } from './config.js';
import { angleToward, clamp, lerp } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

function paintSkyGradient() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, '#7a3d7e');
  grad.addColorStop(0.8, PALETTE.skyHorizon);
  grad.addColorStop(1, '#ffb35c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildPlayerFigure() {
  // Mara on foot: pink jacket, dark hair, dark jeans.
  const group = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 1.1, 0.45),
    new THREE.MeshLambertMaterial({ color: 0xff4fd8 }),
  );
  jacket.position.y = 1.15;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.95;
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a1a22 }),
  );
  hair.position.y = 2.05;
  hair.scale.set(1, 0.7, 1);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.8, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x2b2b33 }),
  );
  legs.position.y = 0.4;
  group.add(jacket);
  group.add(head);
  group.add(hair);
  group.add(legs);
  return group;
}

export function createRender(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x2a1b4e);
  scene.fog = new THREE.Fog(0x53355e, 240, 620);

  // Sky dome: a huge sphere with the gradient on its inside face.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(800, 24, 16),
    new THREE.MeshBasicMaterial({ map: paintSkyGradient(), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  const sunLight = new THREE.DirectionalLight(0xffb35c, 3.6);
  sunLight.position.set(-300, 90, -60);
  scene.add(sunLight);
  const hemi = new THREE.HemisphereLight(0x8a5cff, 0x2a1b30, 1.9);
  scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x29e6ff, 0.5);
  fill.position.set(200, 120, 200);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 30, 60);

  const playerGroup = buildPlayerFigure();
  scene.add(playerGroup);

  // Camera rig state: the smoothed yaw/pitch/distance plus the free
  // orbit the mouse drag sets, and a shake amount for impacts.
  const rig = {
    yaw: 0,
    pitch: 0.32,
    dist: 13,
    orbitYaw: null,
    orbitPitch: 0.32,
    shake: 0,
  };

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  function placeCamera(focusX, focusZ) {
    const cx = focusX + Math.sin(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
    const cz = focusZ + Math.cos(rig.yaw) * Math.cos(rig.pitch) * rig.dist;
    const cy = 2 + Math.sin(rig.pitch) * rig.dist;
    const shx = rig.shake > 0 ? (Math.random() - 0.5) * rig.shake : 0;
    const shy = rig.shake > 0 ? (Math.random() - 0.5) * rig.shake : 0;
    camera.position.set(cx + shx, cy + shy, cz);
    camera.lookAt(focusX, 2.2, focusZ);
  }

  // Chase camera: behind the heading, smoothed; a mouse drag orbits
  // freely until the player moves, then it eases back behind.
  function updateCamera(dt, focus, heading, speed, drag) {
    if (drag.x !== 0 || drag.y !== 0) {
      if (rig.orbitYaw === null) rig.orbitYaw = rig.yaw;
      rig.orbitYaw -= drag.x * 0.005;
      rig.orbitPitch = clamp(rig.orbitPitch + drag.y * 0.004, 0.08, 1.1);
    } else if (Math.abs(speed) > 1) {
      rig.orbitYaw = null;
      rig.orbitPitch = 0.32;
    }
    const targetYaw = rig.orbitYaw === null ? heading + Math.PI : rig.orbitYaw;
    rig.yaw = angleToward(rig.yaw, targetYaw, Math.min(1, dt * (rig.orbitYaw === null ? 3.2 : 8)));
    rig.pitch = lerp(rig.pitch, rig.orbitPitch, Math.min(1, dt * 6));
    const targetDist = rig.orbitYaw === null ? 13 + Math.min(6, Math.abs(speed) * 0.12) : 13;
    rig.dist = lerp(rig.dist, targetDist, Math.min(1, dt * 3));
    rig.shake = Math.max(0, rig.shake - dt * 2);
    placeCamera(focus.x, focus.z);
  }

  // Slow orbit over the city for the title screen.
  function titleCamera(dt, t) {
    const a = t * 0.05;
    camera.position.set(Math.sin(a) * 260, 90 + Math.sin(t * 0.1) * 12, Math.cos(a) * 260);
    camera.lookAt(-40, 18, 0);
  }

  // Snap the chase camera behind a heading at once — the screenshot
  // scenes paint only a few frames, so the smoothed lerp in
  // updateCamera would never get there on its own.
  function snapCamera(focus, heading) {
    rig.orbitYaw = null;
    rig.orbitPitch = 0.32;
    rig.yaw = heading + Math.PI;
    rig.pitch = 0.32;
    rig.dist = 13;
    placeCamera(focus.x, focus.z);
  }

  return {
    renderer,
    scene,
    camera,
    playerGroup,
    updateCamera,
    titleCamera,
    snapCamera,
    addShake(amount) {
      rig.shake = Math.max(rig.shake, amount);
    },
    render() {
      renderer.render(scene, camera);
    },
    setPlayerVisible(v) {
      playerGroup.visible = v;
    },
    syncPlayer(x, z, angle, moving, t) {
      playerGroup.position.set(x, moving ? Math.abs(Math.sin(t * 9)) * 0.12 : 0, z);
      playerGroup.rotation.y = angle;
    },
  };
}
