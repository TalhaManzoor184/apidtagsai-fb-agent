/**
 * Tiny procedural music generator → 48 kHz stereo 16-bit WAV.
 * Original, royalty-free by construction (no samples), so no copyright claims on Facebook.
 * A seed picks key, tempo, chord progression and arp pattern, so each reel sounds a bit different.
 */

const SR = 48_000;
const TAU = Math.PI * 2;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const MAJ = [0, 4, 7];
const MIN = [0, 3, 7];
// [semitones from key root, minor?]
const PROGRESSIONS: [number, boolean][][] = [
  [[0, false], [7, false], [9, true], [5, false]],  // I V vi IV
  [[9, true], [5, false], [0, false], [7, false]],  // vi IV I V
  [[0, false], [9, true], [5, false], [7, false]],  // I vi IV V
  [[5, false], [0, false], [7, false], [9, true]],  // IV I V vi
];
const ARPS = [
  [0, 1, 2, 3, 2, 1, 2, 3],
  [0, 2, 1, 3, 0, 2, 1, 3],
  [0, 1, 2, 1, 3, 2, 1, 2],
];

type Wave = (p: number) => number;
const sine: Wave = p => Math.sin(TAU * p);
const tri: Wave = p => 1 - 4 * Math.abs(((p + 0.25) % 1) - 0.5);
const softSaw: Wave = p => {
  let v = 0;
  for (let k = 1; k <= 6; k++) v += (Math.sin(TAU * k * p) / k) * Math.pow(0.75, k - 1);
  return v * 0.6;
};

interface Bus { L: Float32Array; R: Float32Array }
const bus = (n: number): Bus => ({ L: new Float32Array(n), R: new Float32Array(n) });

function tone(b: Bus, start: number, dur: number, hz: number, amp: number, wave: Wave,
  env: { a: number; decay?: number; r: number }, pan = 0) {
  const s0 = Math.max(0, Math.floor(start * SR));
  const n = Math.floor((dur + env.r) * SR);
  const gl = amp * Math.sqrt((1 - pan) / 2) * Math.SQRT2;
  const gr = amp * Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  for (let i = 0; i < n && s0 + i < b.L.length; i++) {
    const t = i / SR;
    let e = Math.min(1, t / env.a);
    if (env.decay) e *= Math.exp(-t / env.decay);
    if (t > dur) e *= Math.max(0, 1 - (t - dur) / env.r);
    const v = wave((hz * t) % 1) * e;
    b.L[s0 + i] += v * gl;
    b.R[s0 + i] += v * gr;
  }
}

function kick(b: Bus, start: number, amp: number) {
  const s0 = Math.floor(start * SR);
  let phase = 0;
  for (let i = 0; i < 0.35 * SR && s0 + i < b.L.length; i++) {
    const t = i / SR;
    phase += (45 + 95 * Math.exp(-t / 0.03)) / SR;
    const v = Math.sin(TAU * phase) * Math.exp(-t / 0.16) * amp;
    b.L[s0 + i] += v; b.R[s0 + i] += v;
  }
}

function noiseHit(b: Bus, start: number, amp: number, decay: number, cutoffHz: number, pan: number, rand: () => number) {
  const s0 = Math.floor(start * SR);
  const rc = 1 / (TAU * cutoffHz), dt = 1 / SR, a = rc / (rc + dt);
  let y = 0, xPrev = 0;
  const gl = Math.sqrt((1 - pan) / 2) * Math.SQRT2, gr = Math.sqrt((1 + pan) / 2) * Math.SQRT2;
  for (let i = 0; i < decay * 6 * SR && s0 + i < b.L.length; i++) {
    const x = rand() * 2 - 1;
    y = a * (y + x - xPrev); xPrev = x; // one-pole high-pass
    const v = y * Math.exp(-(i / SR) / decay) * amp;
    b.L[s0 + i] += v * gl; b.R[s0 + i] += v * gr;
  }
}

export interface TrackInfo { bpm: number; key: string; wav: Buffer }

export function generateTrack(seconds: number, seed: number): TrackInfo {
  const rand = rng(Math.imul(seed ^ 0x9e3779b9, 2654435761));
  for (let i = 0; i < 4; i++) rand(); // decorrelate nearby seeds
  const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const bpm = pick([112, 116, 118, 120, 124]);
  const keyRoot = pick([57, 58, 60, 62, 55, 53]); // A3 A#3 C4 D4 G3 F3
  const prog = pick(PROGRESSIONS);
  const arp = pick(ARPS);
  const beat = 60 / bpm, bar = beat * 4, eighth = beat / 2;
  const n = Math.ceil(seconds * SR);

  const music = bus(n), drums = bus(n);
  const kicks: number[] = [];
  const bars = Math.ceil(seconds / bar);

  for (let b = 0; b < bars; b++) {
    const t0 = b * bar;
    const [deg, minor] = prog[b % prog.length];
    const triad = (minor ? MIN : MAJ).map(x => keyRoot + deg + x);
    // keep chords in a comfortable range
    const chord = triad.map(m => (m > 69 ? m - 12 : m));

    // Pad: two slightly detuned voices per note, spread left/right
    for (const m of chord) {
      tone(music, t0, bar, midiHz(m) * 1.0023, 0.06, softSaw, { a: 0.25, r: 0.35 }, -0.5);
      tone(music, t0, bar, midiHz(m) * 0.9977, 0.06, softSaw, { a: 0.25, r: 0.35 }, 0.5);
    }

    // Pluck arpeggio, an octave up
    const arpNotes = [...chord.map(m => m + 12), chord[0] + 24];
    for (let s = 0; s < 8; s++) {
      const m = arpNotes[arp[s]];
      const pluck: Wave = p => tri(p) * 0.8 + sine((p * 2) % 1) * 0.2;
      tone(music, t0 + s * eighth, eighth, midiHz(m), 0.16, pluck, { a: 0.004, decay: 0.14, r: 0.08 }, s % 2 ? 0.3 : -0.3);
    }

    if (b === 0) {
      // intro bar: riser hats in the second half only
      for (let s = 4; s < 8; s++) noiseHit(drums, t0 + s * eighth, 0.05 + 0.02 * s, 0.03, 7000, 0.2, rand);
      continue;
    }

    // Bass: off-beat eighths on the chord root
    const bassHz = midiHz(keyRoot + deg - 24 + (keyRoot + deg - 24 < 33 ? 12 : 0));
    const bassWave: Wave = p => sine(p) + 0.3 * sine((p * 2) % 1);
    for (let s = 0; s < 8; s++) {
      tone(music, t0 + s * eighth, eighth * 0.9, bassHz, s % 2 ? 0.17 : 0.09, bassWave, { a: 0.006, decay: 0.2, r: 0.04 });
    }

    // Drums
    for (let q = 0; q < 4; q++) {
      const t = t0 + q * beat;
      kick(drums, t, 0.55); kicks.push(t);
      if (q === 1 || q === 3) noiseHit(drums, t, 0.32, 0.09, 1500, 0, rand); // clap
      noiseHit(drums, t + eighth, 0.13, 0.035, 7000, 0.25, rand);             // off-beat hat
    }
  }

  // Sidechain "pump": duck the music bus after each kick
  const out = bus(n);
  let k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    while (k + 1 < kicks.length && kicks[k + 1] <= t) k++;
    const since = kicks.length && t >= kicks[k] ? t - kicks[k] : 99;
    const duck = 1 - 0.35 * Math.exp(-since / 0.11);
    out.L[i] = music.L[i] * duck + drums.L[i];
    out.R[i] = music.R[i] * duck + drums.R[i];
  }

  // Master: fade in/out, gentle saturation, normalise
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fade = Math.min(1, t / 0.08) * Math.min(1, Math.max(0, (seconds - t) / 0.7));
    out.L[i] = Math.tanh(out.L[i] * 1.3) * fade;
    out.R[i] = Math.tanh(out.R[i] * 1.3) * fade;
    peak = Math.max(peak, Math.abs(out.L[i]), Math.abs(out.R[i]));
  }
  const gain = peak > 0 ? 0.71 / peak : 1; // ≈ −3 dBFS peak, ~−14 LUFS like typical social audio

  const wav = Buffer.alloc(44 + n * 4);
  wav.write('RIFF', 0); wav.writeUInt32LE(36 + n * 4, 4); wav.write('WAVE', 8);
  wav.write('fmt ', 12); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(SR, 24); wav.writeUInt32LE(SR * 4, 28); wav.writeUInt16LE(4, 32); wav.writeUInt16LE(16, 34);
  wav.write('data', 36); wav.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i++) {
    wav.writeInt16LE(Math.round(out.L[i] * gain * 32767), 44 + i * 4);
    wav.writeInt16LE(Math.round(out.R[i] * gain * 32767), 46 + i * 4);
  }
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return { bpm, key: names[keyRoot % 12] + ' major', wav };
}
