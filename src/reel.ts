import { spawn } from 'node:child_process';
import { readdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { config } from './config.js';
import type { Post } from './content.js';
import { C, h, loadFonts, type Node } from './image.js';
import { generateTrack, hashSeed } from './music.js';

const require = createRequire(import.meta.url);
const FFMPEG: string = process.env.FFMPEG_PATH || require('ffmpeg-static');

// Facebook Reels spec: 9:16, ≥540x960 (1080x1920 recommended), 3–90s, H.264 + AAC, 24–60 fps
const W = 1080;
const H = 1920;
const FPS = 30;
export const REEL_SECONDS = 20;

// Scene timeline (seconds): hook → 3 tips → CTA
const SCENES = [
  { id: 'hook', start: 0, end: 4 },
  { id: 'tip0', start: 4, end: 8 },
  { id: 'tip1', start: 8, end: 12 },
  { id: 'tip2', start: 12, end: 16 },
  { id: 'cta', start: 16, end: REEL_SECONDS },
] as const;
const IN = 0.5;   // scene enter duration
const OUT = 0.35; // scene exit duration

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIn = (x: number) => Math.pow(clamp01(x), 3);
const easeBack = (x: number) => { const c = 1.6; const t = clamp01(x) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };

const STEP_LABEL: Record<string, string> = {
  'step-by-step': 'Step', 'tool-demo': 'Step', mistakes: 'Mistake', checklist: 'Check', 'myth-vs-fact': 'Point', 'before-after': 'Point',
};

function headlineSize(text: string, base: number) {
  return text.length > 44 ? base * 0.68 : text.length > 34 ? base * 0.77 : text.length > 26 ? base * 0.88 : base;
}

/** Enter/exit animation for an element inside a scene; `delay` staggers elements. */
function anim(t: number, scene: { start: number; end: number }, delay = 0, last = false) {
  const kIn = easeOut((t - scene.start - delay) / IN);
  const kOut = last ? 0 : easeIn((t - (scene.end - OUT)) / OUT);
  return { opacity: kIn * (1 - kOut), transform: `translateY(${(1 - kIn) * 60 - kOut * 50}px)` };
}

function brandPill(size = 36) {
  return h('div', { display: 'flex', alignItems: 'center', gap: 14, padding: `${size * 0.44}px ${size * 0.9}px`, borderRadius: 999,
    background: 'rgba(34,211,238,0.14)', border: `3px solid ${C.accent}`, fontSize: size, fontWeight: 800, color: C.accent },
    [h('div', { display: 'flex' }, '#'), h('div', { display: 'flex' }, config.brandName)]);
}

function hookScene(post: Post, t: number, sc: typeof SCENES[number]): Node[] {
  return [
    h('div', { display: 'flex', ...anim(t, sc, 0) }, [brandPill()]),
    h('div', { display: 'flex', marginTop: 60, fontSize: headlineSize(post.headline, 124), fontWeight: 800, lineHeight: 1.03,
      letterSpacing: -3, ...anim(t, sc, 0.25) }, post.headline),
    h('div', { display: 'flex', marginTop: 40, fontSize: 48, color: C.muted, lineHeight: 1.35, ...anim(t, sc, 0.8) }, post.subline),
  ];
}

function tipScene(post: Post, t: number, sc: typeof SCENES[number], i: number): Node[] {
  const label = STEP_LABEL[post.format] ?? 'Tip';
  const color = i % 2 ? C.accent2 : C.accent;
  const pop = easeBack((t - sc.start) / 0.6);
  const dots = [0, 1, 2].map(d => h('div', { display: 'flex', width: d === i ? 44 : 14, height: 14, borderRadius: 7,
    background: d === i ? color : 'rgba(255,255,255,0.25)' }));
  return [
    h('div', { display: 'flex', fontSize: 34, fontWeight: 600, color: C.muted, lineHeight: 1.3, ...anim(t, sc, 0) }, post.headline),
    h('div', { display: 'flex', alignItems: 'center', gap: 28, marginTop: 70, ...anim(t, sc, 0.05) }, [
      h('div', { display: 'flex', width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center',
        backgroundImage: `linear-gradient(135deg, ${C.accent} 0%, ${C.accent2} 100%)`, color: C.bg1, fontSize: 84, fontWeight: 800,
        transform: `scale(${0.6 + 0.4 * pop})` }, String(i + 1)),
      h('div', { display: 'flex', fontSize: 40, fontWeight: 800, color, letterSpacing: 2 }, `${label.toUpperCase()} ${i + 1}/3`),
    ]),
    h('div', { display: 'flex', marginTop: 50, fontSize: 80, fontWeight: 800, lineHeight: 1.1, letterSpacing: -2, ...anim(t, sc, 0.2) },
      post.bullets[i] ?? ''),
    ...(post.details?.[i]
      ? [h('div', { display: 'flex', marginTop: 34, fontSize: 46, color: C.muted, lineHeight: 1.35, ...anim(t, sc, 0.55) }, post.details[i])]
      : []),
    h('div', { display: 'flex', gap: 12, marginTop: 60, ...anim(t, sc, 0.3) }, dots),
  ];
}

function ctaScene(post: Post, t: number, sc: typeof SCENES[number]): Node[] {
  const domain = new URL(config.siteUrl).hostname;
  const k = (t - sc.start - 0.3) / 0.6;
  const scale = k <= 0 ? 0.85 : 0.85 + 0.15 * easeBack(k);
  const pulse = t > sc.start + 1.2 ? 1 + 0.025 * Math.sin((t - sc.start) * 5) : 1;
  return [
    h('div', { display: 'flex', ...anim(t, sc, 0, true) }, [brandPill(32)]),
    h('div', { display: 'flex', marginTop: 50, fontSize: 70, fontWeight: 800, lineHeight: 1.12, letterSpacing: -2, ...anim(t, sc, 0.1, true) },
      post.cta || 'Try the free tools'),
    h('div', { display: 'flex', marginTop: 70, justifyContent: 'center', opacity: clamp01(k * 2), transform: `scale(${scale * pulse})` }, [
      h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '38px 64px', borderRadius: 30,
        backgroundImage: `linear-gradient(90deg, ${C.accent} 0%, ${C.accent2} 100%)`, color: C.bg1 }, [
        h('div', { display: 'flex', fontSize: 36, fontWeight: 600 }, 'Free AI tools for creators'),
        h('div', { display: 'flex', fontSize: 64, fontWeight: 800, letterSpacing: -1 }, domain),
      ]),
    ]),
  ];
}

function frame(post: Post, t: number): Node {
  const sc = SCENES.find(s => t >= s.start && t < s.end) ?? SCENES[SCENES.length - 1];
  const content = sc.id === 'hook' ? hookScene(post, t, sc)
    : sc.id === 'cta' ? ctaScene(post, t, sc)
    : tipScene(post, t, sc, Number(sc.id.slice(3)));

  return h('div', {
    width: W, height: H, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    backgroundImage: `linear-gradient(160deg, ${C.bg1} 0%, ${C.bg2} 100%)`, fontFamily: 'Inter', color: C.text,
  }, [
    // Slowly drifting background shapes
    h('div', { position: 'absolute', top: 120 + Math.sin(t * 0.4) * 40, right: -140, display: 'flex', fontSize: 820, fontWeight: 800,
      lineHeight: 1, color: 'rgba(167,139,250,0.07)', transform: `rotate(${-8 + t * 1.2}deg)` }, '#'),
    h('div', { position: 'absolute', bottom: -300 + Math.cos(t * 0.35) * 50, left: -300 + t * 9, width: 900, height: 900,
      borderRadius: 450, display: 'flex',
      backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.20) 0%, rgba(34,211,238,0) 70%)' }),

    // Story-style progress bar
    h('div', { position: 'absolute', top: 56, left: 90, width: W - 180, height: 8, borderRadius: 4, display: 'flex',
      background: 'rgba(255,255,255,0.15)' }, [
      h('div', { display: 'flex', width: (W - 180) * clamp01(t / REEL_SECONDS), height: 8, borderRadius: 4,
        backgroundImage: `linear-gradient(90deg, ${C.accent} 0%, ${C.accent2} 100%)` }),
    ]),

    // Content kept inside the safe area (FB overlays caption/buttons at the bottom and icons on the right)
    h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'center', width: W, height: H, boxSizing: 'border-box',
      padding: '140px 120px 380px 90px', position: 'relative' }, content),
  ]);
}

const MUSIC_DIR = 'assets/music';
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg)$/i;

/**
 * Audio input args for ffmpeg.
 * MUSIC=auto (default): a random file from assets/music/ if any exist, otherwise generated music.
 * MUSIC=synth: always generated. MUSIC=off: silent track.
 */
async function audioInput(post: Post, outPath: string): Promise<{ args: string[]; label: string }> {
  const mode = (process.env.MUSIC ?? 'auto').trim().toLowerCase();
  const seed = hashSeed(post.topic + post.headline);
  if (mode === 'off') {
    return { args: ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000'], label: 'silent' };
  }
  if (mode === 'auto') {
    const files = (await readdir(MUSIC_DIR).catch(() => [] as string[])).filter(f => AUDIO_EXT.test(f)).sort();
    if (files.length) {
      const file = files[seed % files.length];
      return { args: ['-stream_loop', '-1', '-i', join(MUSIC_DIR, file)], label: `file ${file}` };
    }
  }
  const track = generateTrack(REEL_SECONDS, seed);
  const wavPath = join(dirname(outPath), 'music.wav');
  await writeFile(wavPath, track.wav);
  return { args: ['-i', wavPath], label: `generated ${track.key}, ${track.bpm} bpm` };
}

/** Renders a 10s 1080x1920 MP4 (H.264 + AAC music) to outPath. */
export async function renderReel(post: Post, outPath: string): Promise<void> {
  const fonts = await loadFonts();
  const total = REEL_SECONDS * FPS;
  const started = Date.now();
  const audio = await audioInput(post, outPath);
  const fadeOut = (REEL_SECONDS - 0.7).toFixed(2);

  const ff = spawn(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', 'pipe:0',
    ...audio.args,
    '-map', '0:v', '-map', '1:a',
    '-af', `afade=t=in:d=0.1,afade=t=out:st=${fadeOut}:d=0.7,aformat=channel_layouts=stereo`,
    '-t', String(REEL_SECONDS), '-shortest',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', String(FPS * 2),
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
    '-movflags', '+faststart', outPath,
  ], { stdio: ['pipe', 'inherit', 'pipe'] });

  let stderr = '';
  ff.stderr.on('data', d => (stderr += d));
  const done = new Promise<void>((resolve, reject) => {
    ff.on('error', reject);
    ff.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${stderr.trim()}`))));
  });

  for (let i = 0; i < total; i++) {
    const svg = await satori(frame(post, i / FPS) as any, { width: W, height: H, fonts });
    const rgba = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().pixels;
    if (!ff.stdin.write(rgba)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  console.log(`Reel rendered: ${total} frames in ${((Date.now() - started) / 1000).toFixed(1)}s, music: ${audio.label} → ${outPath}`);
}

/** Single still of the finished reel layout (used for previews). */
export async function renderReelStill(post: Post, t = 0.6 * 4 + 1.5): Promise<Buffer> {
  const svg = await satori(frame(post, t) as any, { width: W, height: H, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
