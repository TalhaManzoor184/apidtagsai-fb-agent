import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { config, required } from './config.js';
import type { Post } from './content.js';

const require = createRequire(import.meta.url);
const font = (w: number) => readFile(require.resolve(`@fontsource/inter/files/inter-latin-${w}-normal.woff`));

const W = 1080;
const H = 1080;
export const C = {
  bg1: '#0B1026', bg2: '#1E1B4B', accent: '#22D3EE', accent2: '#A78BFA',
  text: '#FFFFFF', muted: '#C7D2FE', card: 'rgba(255,255,255,0.07)',
};

export type Node = { type: string; props: Record<string, any> };
export const h = (type: string, style: Record<string, any>, children?: any, extra: Record<string, any> = {}): Node =>
  ({ type, props: { style, children, ...extra } });

function layout(post: Post, bgDataUri?: string, W = 1080, H = 1080): Node {
  const tall = H > W * 1.2;
  const domain = new URL(config.siteUrl).hostname;
  const bullets = post.bullets.map((b, i) =>
    h('div', { display: 'flex', alignItems: 'center', gap: 22, padding: '20px 26px', background: C.card,
      borderRadius: 20, border: '1px solid rgba(255,255,255,0.10)' }, [
      h('div', { display: 'flex', width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center',
        background: i % 2 ? C.accent2 : C.accent, color: C.bg1, fontSize: 24, fontWeight: 800, flexShrink: 0 }, String(i + 1)),
      h('div', { display: 'flex', flex: 1, fontSize: 31, fontWeight: 600, color: C.text, lineHeight: 1.25 }, b),
    ]));

  const background: Node[] = bgDataUri
    ? [
        h('img', { position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' }, undefined, { src: bgDataUri, width: W, height: H }),
        h('div', { position: 'absolute', top: 0, left: 0, width: W, height: H, display: 'flex',
          backgroundImage: 'linear-gradient(180deg, rgba(11,16,38,0.55) 0%, rgba(11,16,38,0.92) 55%, rgba(11,16,38,0.97) 100%)' }),
      ]
    : [
        h('div', { position: 'absolute', top: -120, right: -60, display: 'flex', fontSize: 560, fontWeight: 800,
          color: 'rgba(167,139,250,0.07)', lineHeight: 1 }, '#'),
        h('div', { position: 'absolute', bottom: -260, left: -200, width: 640, height: 640, borderRadius: 320, display: 'flex',
          backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.22) 0%, rgba(34,211,238,0) 70%)' }),
      ];

  return h('div', {
    width: W, height: H, display: 'flex', flexDirection: 'column', position: 'relative',
    backgroundImage: `linear-gradient(145deg, ${C.bg1} 0%, ${C.bg2} 100%)`, fontFamily: 'Inter', color: C.text,
  }, [
    ...background,
    h('div', { display: 'flex', flexDirection: 'column', flexGrow: 1, width: W, height: H, boxSizing: 'border-box', padding: '72px 76px', position: 'relative' }, [
      // Brand pill
      h('div', { display: 'flex' }, [
        h('div', { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', borderRadius: 999,
          background: 'rgba(34,211,238,0.14)', border: `2px solid ${C.accent}`, fontSize: 26, fontWeight: 800, color: C.accent },
          [h('div', { display: 'flex' }, '#'), h('div', { display: 'flex' }, config.brandName)]),
      ]),
      // Headline + subline
      h('div', { display: 'flex', flexDirection: 'column', marginTop: bgDataUri ? 'auto' : tall ? 140 : 64, gap: 22 }, [
        h('div', { display: 'flex', fontSize: (post.headline.length > 34 ? 72 : 86) * (tall ? 1.1 : 1), fontWeight: 800, lineHeight: 1.05,
          letterSpacing: -2 }, post.headline),
        h('div', { display: 'flex', fontSize: 33, fontWeight: 400, color: C.muted, lineHeight: 1.35 }, post.subline),
      ]),
      // Bullets
      h('div', { display: 'flex', flexDirection: 'column', gap: tall ? 22 : 16, marginTop: tall ? 70 : 44 }, bullets),
      // Footer
      h('div', { display: 'flex', marginTop: 'auto', paddingTop: 36, justifyContent: 'space-between', alignItems: 'center' }, [
        h('div', { display: 'flex', fontSize: 26, color: C.muted }, 'Free AI tools for creators'),
        h('div', { display: 'flex', padding: '14px 28px', borderRadius: 14, fontSize: 28, fontWeight: 800, color: C.bg1,
          backgroundImage: `linear-gradient(90deg, ${C.accent} 0%, ${C.accent2} 100%)` }, domain),
      ]),
    ]),
  ]);
}

async function geminiBackground(prompt: string): Promise<string | undefined> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiImageModel}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': required('GEMINI_API_KEY'), 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text:
          `${prompt}. Square 1:1 composition, subject in the upper half, darker lower half. ` +
          'Absolutely no text, letters, numbers, logos, watermarks or real brand marks.' }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });
    const json: any = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(json.error ?? json));
    const img = json.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (!img) throw new Error('no image in response');
    return `data:${img.mimeType};base64,${img.data}`;
  } catch (e) {
    console.warn(`AI background failed, using template only: ${(e as Error).message}`);
    return undefined;
  }
}

let fontsCache: any[] | undefined;
export async function loadFonts(): Promise<any[]> {
  return (fontsCache ??= [
    { name: 'Inter', data: await font(400), weight: 400, style: 'normal' },
    { name: 'Inter', data: await font(600), weight: 600, style: 'normal' },
    { name: 'Inter', data: await font(800), weight: 800, style: 'normal' },
  ]);
}

export async function renderImage(post: Post, w = W, h = H): Promise<Buffer> {
  const bg = config.imageMode === 'gemini' && !config.mockLlm ? await geminiBackground(post.imagePrompt) : undefined;
  const svg = await satori(layout(post, bg, w, h) as any, { width: w, height: h, fonts: await loadFonts() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng();
}

/** Pinterest-friendly 2:3 version of the image card. */
export const renderPinImage = (post: Post) => renderImage(post, 1000, 1500);
