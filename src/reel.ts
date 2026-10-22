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
export const REEL_SECONDS = 10;

// Timeline (seconds)
const T = { pill: 0.0, headline: 0.3, subline: 1.0, bullet0: 2.2, bulletGap: 1.1, cta: 6.4 };
const DUR = 0.55;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const easeBack = (x: number) => { const c = 1.6; const t = clamp01(x) - 1; return 1 + (c + 1) * t * t * t + c * t * t; };
/** 0 → 1 progress of an element that starts at `start` seconds */
const p = (t: number, start: number, dur = DUR) => easeOut((t - start) / dur);

function frame(post: Post, t: number): Node {
  const domain = new URL(config.siteUrl).hostname;
  const enter = (k: number, dy = 40) => ({ opacity: k, transform: `translateY(${(1 - k) * dy}px)` });

  const bullets = post.bullets.map((b, i) => {
    const k = p(t, T.bullet0 + i * T.bulletGap);
    return h('div', {
      display: 'flex', alignItems: 'center', gap: 28, padding: '26px 34px', background: C.card, borderRadius: 26,
      border: '1px solid rgba(255,255,255,0.12)', opacity: k, transform: `translateX(${(1 - k) * -80}px)`,
    }, [
      h('div', { display: 'flex', width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
        background: i % 2 ? C.accent2 : C.accent, color: C.bg1, fontSize: 32, fontWeight: 800, flexShrink: 0 }, String(i + 1)),
      h('div', { display: 'flex', flex: 1, fontSize: 42, fontWeight: 600, lineHeight: 1.25 }, b),
    ]);
  });

  const ctaK = (t - T.cta) / 0.6;
  const ctaScale = ctaK <= 0 ? 0.85 : 0.85 + 0.15 * easeBack(ctaK);
  const pulse = t > T.cta + 0.8 ? 1 + 0.025 * Math.sin((t - T.cta) * 6) : 1;

  return h('div', {
    width: W, height: H, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
    backgroundImage: `linear-gradient(160deg, ${C.bg1} 0%, ${C.bg2} 100%)`, fontFamily: 'Inter', color: C.text,
  }, [
    // Slowly drifting background shapes
    h('div', { position: 'absolute', top: 120 + Math.sin(t * 0.6) * 30, right: -140, display: 'flex', fontSize: 820, fontWeight: 800,
      lineHeight: 1, color: 'rgba(167,139,250,0.07)', transform: `rotate(${-8 + t * 1.6}deg)` }, '#'),
    h('div', { position: 'absolute', bottom: -300 + Math.cos(t * 0.5) * 40, left: -260 + t * 12, width: 900, height: 900,
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
      padding: '140px 120px 380px 90px', position: 'relative' }, [
      h('div', { display: 'flex', ...enter(p(t, T.pill)) }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 14, padding: '16px 32px', borderRadius: 999,
          background: 'rgba(34,211,238,0.14)', border: `3px solid ${C.accent}`, fontSize: 36, fontWeight: 800, color: C.accent },
          [h('div', { display: 'flex' }, '#'), h('div', { display: 'flex' }, config.brandName)]),
      ]),
      h('div', { display: 'flex', marginTop: 50, fontSize: post.headline.length > 44 ? 76 : post.headline.length > 34 ? 86 : post.headline.length > 26 ? 98 : 112, fontWeight: 800,
        lineHeight: 1.04, letterSpacing: -3, ...enter(p(t, T.headline), 60) }, post.headline),
      h('div', { display: 'flex', marginTop: 34, fontSize: 44, color: C.muted, lineHeight: 1.35,
        ...enter(p(t, T.subline)) }, post.subline),
      h('div', { display: 'flex', flexDirection: 'column', gap: 20, marginTop: 50 }, bullets),

      // CTA
      h('div', { display: 'flex', marginTop: 70, justifyContent: 'center',
        opacity: clamp01(ctaK * 2), transform: `scale(${ctaScale * pulse})` }, [
        h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '32px 56px', borderRadius: 28,
          backgroundImage: `linear-gradient(90deg, ${C.accent} 0%, ${C.accent2} 100%)`, color: C.bg1 }, [
          h('div', { display: 'flex', fontSize: 34, fontWeight: 600 }, 'Generate tags & hashtags free'),
          h('div', { display: 'flex', fontSize: 58, fontWeight: 800, letterSpacing: -1 }, domain),
        ]),
      ]),
    ]),
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
export async function renderReelStill(post: Post, t = REEL_SECONDS - 0.5): Promise<Buffer> {
  const svg = await satori(frame(post, t) as any, { width: W, height: H, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
}
