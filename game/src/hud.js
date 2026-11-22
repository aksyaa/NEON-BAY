// The GTA-style HUD v2: wanted stars, money, health and armour bars,
// the district toast, the mission objective, the radio line, and a live
// minimap radar (roads, beach, player arrow, traffic, police, beacons).
// New in v2: a screen-edge arrow that always points at the current
// objective, and the neon-package hunt counter on the minimap and in
// the objective line. The DOM lives in index.html; this module fills
// it in and paints the radar canvas.
import { DISTRICTS, HUNT_COUNT } from './config.js';

const MAP_SPAN = 620; // city units shown across the minimap

export function createHud() {
  const el = (id) => document.getElementById(id);
  const starsEl = el('wanted');
  const moneyEl = el('money');
  const healthEl = el('health-fill');
  const armorEl = el('armor-fill');
  const districtEl = el('district');
  const objectiveEl = el('objective');
  const radioEl = el('radio');
  const dialogEl = el('dialog');
  const toastEl = el('toast');
  const speedEl = el('speed');
  const clockEl = el('clock');
  const edgeEl = el('edge-arrow');
  const map = el('minimap');
  const mapCtx = map.getContext('2d');
  let districtTimer = 0;
  let dialogTimer = 0;
  let toastTimer = 0;
  let lastDistrict = '';

  function starRow(n) {
    let out = '';
    for (let i = 0; i < 5; i += 1) out += i < n ? '★' : '☆';
    return out;
  }

  function paintRadar(state) {
    const W = map.width;
    const H = map.height;
    const scale = W / MAP_SPAN;
    const toX = (x) => W / 2 + x * scale;
    const toY = (z) => H / 2 + z * scale;
    mapCtx.fillStyle = '#101018';
    mapCtx.fillRect(0, 0, W, H);
    // Sea and sand on the west edge.
    mapCtx.fillStyle = '#0e4d6e';
    mapCtx.fillRect(0, 0, toX(-260), H);
    mapCtx.fillStyle = '#e8c88f';
    mapCtx.fillRect(toX(-260), 0, toX(-210) - toX(-260), H);
    // District tints.
    DISTRICTS.forEach((d) => {
      mapCtx.fillStyle = d.color + '22';
      mapCtx.fillRect(toX(d.rect.x0), toY(d.rect.z0), (d.rect.x1 - d.rect.x0) * scale, (d.rect.z1 - d.rect.z0) * scale);
    });
    // Road grid.
    mapCtx.strokeStyle = '#5a5a6e';
    mapCtx.lineWidth = 2;
    for (let k = -5; k <= 5; k += 1) {
      mapCtx.beginPath();
      mapCtx.moveTo(toX(k * 60), 0);
      mapCtx.lineTo(toX(k * 60), H);
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(0, toY(k * 60));
      mapCtx.lineTo(W, toY(k * 60));
      mapCtx.stroke();
    }
    // Story beacon: a pulsing gold ring.
    const target = state.missions ? state.missions.target : null;
    if (target) {
      mapCtx.fillStyle = '#ffe14d';
      mapCtx.beginPath();
      mapCtx.arc(toX(target.x), toY(target.z), 5, 0, Math.PI * 2);
      mapCtx.fill();
      mapCtx.strokeStyle = '#ffe14d';
      mapCtx.beginPath();
      mapCtx.arc(toX(target.x), toY(target.z), 9, 0, Math.PI * 2);
      mapCtx.stroke();
    }
    // Neon packages: cyan diamonds.
    if (state.hunt) {
      mapCtx.fillStyle = '#29e6ff';
      state.hunt.packages.forEach((p) => {
        if (p.taken) return;
        const px = toX(p.x);
        const py = toY(p.z);
        mapCtx.beginPath();
        mapCtx.moveTo(px, py - 4);
        mapCtx.lineTo(px + 4, py);
        mapCtx.lineTo(px, py + 4);
        mapCtx.lineTo(px - 4, py);
        mapCtx.closePath();
        mapCtx.fill();
      });
    }
    // Traffic as white dots, police as red dots, player as an arrow.
    state.vehicles.traffic.forEach((c) => {
      mapCtx.fillStyle = '#e8e8f0';
      mapCtx.fillRect(toX(c.x) - 1.5, toY(c.z) - 1.5, 3, 3);
    });
    state.police.cars.forEach((c) => {
      mapCtx.fillStyle = '#ff2a2a';
      mapCtx.beginPath();
      mapCtx.arc(toX(c.x), toY(c.z), 3.5, 0, Math.PI * 2);
      mapCtx.fill();
    });
    const px = toX(state.player.x);
    const py = toY(state.player.z);
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(-state.player.angle + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -7);
    mapCtx.lineTo(5, 6);
    mapCtx.lineTo(-5, 6);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
    // North marker.
    mapCtx.fillStyle = '#9b93b8';
    mapCtx.font = 'bold 11px system-ui, sans-serif';
    mapCtx.fillText('N', W - 14, 14);
  }

  // The edge arrow: a "◆" that rides the screen border in the direction
  // of the objective, with the distance in metres. It hides when the
  // objective is already on screen (close) or when there is none.
  function pointEdgeArrow(state) {
    const target = state.missions ? state.missions.target : null;
    if (!target) {
      edgeEl.style.opacity = '0';
      return;
    }
    const dx = target.x - state.player.x;
    const dz = target.z - state.player.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 25) {
      edgeEl.style.opacity = '0';
      return;
    }
    // Screen bearing: ahead is -z on screen when the camera looks along
    // the player heading, so rotate the world vector by the heading.
    const sin = Math.sin(-state.player.angle);
    const cos = Math.cos(-state.player.angle);
    const sx = dx * cos - dz * sin;
    const sy = -(dx * sin + dz * cos);
    const len = Math.sqrt(sx * sx + sy * sy) || 1;
    const nx = sx / len;
    const ny = sy / len;
    const margin = 60;
    const cx = window.innerWidth / 2 + nx * (window.innerWidth / 2 - margin);
    const cy = window.innerHeight / 2 + ny * (window.innerHeight / 2 - margin);
    edgeEl.style.left = cx + 'px';
    edgeEl.style.top = cy + 'px';
    edgeEl.style.transform = `translate(-50%, -50%) rotate(${Math.atan2(ny, nx) + Math.PI / 2}rad)`;
    edgeEl.textContent = `◆ ${Math.round(dist)}m`;
    edgeEl.style.opacity = '1';
  }

  function update(state, dt) {
    const wanted = state.police ? state.police.wanted : 0;
    starsEl.textContent = starRow(wanted);
    starsEl.style.color = wanted > 0 ? '#ffd166' : '#5a5470';
    moneyEl.textContent = '$' + Math.floor(state.money).toLocaleString('en-US');
    healthEl.style.width = Math.max(0, state.health) + '%';
    armorEl.style.width = Math.max(0, state.armor) + '%';
    const speed = state.inCar ? Math.abs(state.carSpeed || 0) * 3.6 : 0;
    speedEl.textContent = state.inCar ? Math.round(speed) + ' km/h' : '';
    const hours = 18 + (Math.floor(state.elapsed / 60) % 6);
    const mins = Math.floor(state.elapsed) % 60;
    clockEl.textContent = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0');

    const district = state.district || '';
    if (district && district !== lastDistrict) {
      lastDistrict = district;
      districtEl.textContent = district;
      districtEl.style.opacity = '1';
      districtTimer = 3;
    }
    if (districtTimer > 0) {
      districtTimer -= dt;
      if (districtTimer <= 0) districtEl.style.opacity = '0';
    }

    const mission = state.missions ? state.missions.current() : null;
    let objective = '';
    if (mission) {
      objective = mission.target.label + '  •  $' + mission.reward;
    } else if (state.storyComplete) {
      objective = 'Story complete — free roam. Enjoy Neon Bay.';
    }
    if (state.hunt && state.hunt.collected < HUNT_COUNT) {
      objective += (objective ? '   |   ' : '') + `Neon packages ${state.hunt.collected}/${HUNT_COUNT}`;
    }
    objectiveEl.textContent = objective;

    if (dialogTimer > 0) {
      dialogTimer -= dt;
      if (dialogTimer <= 0) dialogEl.style.opacity = '0';
    }
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0) toastEl.style.opacity = '0';
    }
    pointEdgeArrow(state);
    paintRadar(state);
  }

  return {
    update,
    showDialog(text) {
      dialogEl.textContent = text;
      dialogEl.style.opacity = '1';
      dialogTimer = 6;
    },
    showToast(text) {
      toastEl.textContent = text;
      toastEl.style.opacity = '1';
      toastTimer = 3;
    },
    setRadio(station, song) {
      radioEl.textContent = station + '  •  ' + song;
    },
  };
}
