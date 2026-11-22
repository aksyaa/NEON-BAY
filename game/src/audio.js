// Sound and music, synthesized live with the Web Audio API — no audio
// files, no network. A low engine hum follows the car, a siren wails
// while the wanted level is up, gunshots and explosions are filtered
// noise, and three radio stations run a tiny step sequencer whose song
// titles the HUD prints. Nothing sounds until a user gesture creates
// the context (browsers require it).
import { RADIO } from './config.js';

const MASTER_LEVEL = 0.5;

// Bass and lead patterns for the synthwave stations (frequencies in Hz).
const BASS_LINE = [55, 55, 65.4, 49, 55, 55, 82.4, 73.4];
const LEAD_LINE = [220, 261.6, 329.6, 392, 329.6, 261.6, 220, 196];

export function createAudio() {
  let ctx = null;
  let master = null;
  let enginePair = null;
  let sirenVoice = null;
  let sequencer = null;
  let station = 0;
  let songIndex = 0;
  let songStartedAt = 0;
  let muted = false;
  let onSong = null;

  function makeOsc(type, freq) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    return osc;
  }

  function makeGain(level) {
    const gain = ctx.createGain();
    gain.gain.value = level;
    return gain;
  }

  // Build the always-on voices: engine hum (two detuned saws through a
  // lowpass) and the police siren (triangle wobbled by a slow LFO).
  function buildGraph() {
    master = makeGain(MASTER_LEVEL);
    master.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const engineGain = makeGain(0);
    const oscA = makeOsc('sawtooth', 55);
    const oscB = makeOsc('sawtooth', 57);
    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    oscA.start();
    oscB.start();
    enginePair = { oscA, oscB, gain: engineGain };

    const siren = makeOsc('triangle', 700);
    const lfo = makeOsc('square', 0.6);
    const lfoGain = makeGain(220);
    lfo.connect(lfoGain);
    lfoGain.connect(siren.frequency);
    const sirenGain = makeGain(0);
    siren.connect(sirenGain);
    sirenGain.connect(master);
    siren.start();
    lfo.start();
    sirenVoice = { gain: sirenGain };
  }

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return false;
    }
    buildGraph();
    sequencer = { step: 0, nextAt: 0 };
    songStartedAt = ctx.currentTime;
    return true;
  }

  // A burst of shaped noise (shots, crashes, explosions, hi-hats).
  function noiseBurst(duration, cutoff, level) {
    if (!ctx) return;
    const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = makeGain(level);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // A short pitched blip with an exponential decay.
  function blip(freq, duration, type, level) {
    if (!ctx) return;
    const osc = makeOsc(type || 'sine', freq);
    const gain = makeGain(level || 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  // Radio: one step of the sequencer. Synthwave stations get bass +
  // lead + hats; the talk station gets a soft blip once a bar.
  function radioStep() {
    if (!ctx || muted || !sequencer) return;
    const now = ctx.currentTime;
    if (now < sequencer.nextAt) return;
    const stepLen = station === 1 ? 0.32 : 0.21;
    sequencer.nextAt = now + stepLen;
    const i = sequencer.step % 8;
    if (station !== 1) {
      blip(BASS_LINE[i], stepLen * 0.9, 'triangle', 0.16);
      if (sequencer.step % 16 >= 8) blip(LEAD_LINE[i] * 2, stepLen * 0.5, 'square', 0.05);
      if (sequencer.step % 2 === 0) noiseBurst(0.03, 6000, 0.05);
    } else if (sequencer.step % 8 === 0) {
      blip(330, 0.12, 'sine', 0.08);
    }
    sequencer.step += 1;
    // A song lasts about 24 seconds, then the next title rolls in.
    if (now - songStartedAt > 24) {
      songStartedAt = now;
      songIndex = (songIndex + 1) % RADIO[station].songs.length;
      if (onSong) onSong(RADIO[station].station, RADIO[station].songs[songIndex]);
    }
  }

  function currentStation() {
    return RADIO[station];
  }

  return {
    ensure,
    setSongCallback(fn) {
      onSong = fn;
    },
    get stationName() {
      return currentStation().station;
    },
    get songName() {
      return currentStation().songs[songIndex];
    },
    nextStation() {
      station = (station + 1) % RADIO.length;
      songIndex = 0;
      songStartedAt = ctx ? ctx.currentTime : 0;
      if (onSong) onSong(currentStation().station, currentStation().songs[songIndex]);
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : MASTER_LEVEL;
      return muted;
    },
    engine(speed, inCar) {
      if (!ctx || !enginePair) return;
      const target = inCar ? 0.05 + Math.min(0.12, Math.abs(speed) * 0.003) : 0;
      enginePair.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      const freq = 55 + Math.abs(speed) * 3.2;
      enginePair.oscA.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
      enginePair.oscB.frequency.setTargetAtTime(freq * 1.01, ctx.currentTime, 0.1);
    },
    siren(wanted) {
      if (!ctx || !sirenVoice) return;
      sirenVoice.gain.gain.setTargetAtTime(wanted > 0 ? 0.05 : 0, ctx.currentTime, 0.2);
    },
    shot() {
      noiseBurst(0.12, 1800, 0.5);
    },
    explosion() {
      noiseBurst(0.7, 500, 0.7);
      blip(60, 0.5, 'sine', 0.5);
    },
    crash() {
      noiseBurst(0.25, 900, 0.4);
    },
    horn() {
      blip(370, 0.25, 'square', 0.12);
      blip(466, 0.25, 'square', 0.12);
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.25);
      setTimeout(() => blip(1318, 0.18, 'sine', 0.25), 90);
    },
    mission() {
      [523, 659, 784].forEach((freq, i) => {
        setTimeout(() => blip(freq, 0.25, 'triangle', 0.25), i * 120);
      });
    },
    update() {
      radioStep();
    },
  };
}
