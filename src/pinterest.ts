import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Pinterest API v5 publishing.
 * - PINTEREST_ENV=sandbox (Trial access: Pins visible only to you) | production (Standard access: public)
 * - Refresh tokens rotate on every refresh (continuous refresh, ~60 days), so the newest one is stored
 *   AES-256-GCM encrypted in data/pinterest-token.enc (key = PINTEREST_TOKEN_KEY) and committed by the workflow.
 */

const env = (k: string) => process.env[k]?.trim() || undefined;
const TOKEN_FILE = 'data/pinterest-token.enc';

export const pinterestEnv = () => (env('PINTEREST_ENV') === 'production' ? 'production' : 'sandbox');
export const apiBase = (e = pinterestEnv()) =>
  env('PINTEREST_API_BASE') ?? (e === 'production' ? 'https://api.pinterest.com/v5' : 'https://api-sandbox.pinterest.com/v5');

export function pinterestConfigured(): boolean {
  return Boolean(env('PINTEREST_APP_ID') && env('PINTEREST_APP_SECRET') && env('PINTEREST_BOARD_ID') && env('PINTEREST_TOKEN_KEY')
    && (env('PINTEREST_REFRESH_TOKEN')));
}

// ---------- encrypted token store ----------
const keyOf = () => createHash('sha256').update(env('PINTEREST_TOKEN_KEY') ?? '').digest();

async function loadStoredRefresh(): Promise<{ token: string; env: string } | undefined> {
  try {
    const box = JSON.parse(await readFile(TOKEN_FILE, 'utf8'));
    const d = createDecipheriv('aes-256-gcm', keyOf(), Buffer.from(box.iv, 'base64'));
    d.setAuthTag(Buffer.from(box.tag, 'base64'));
    const data = JSON.parse(Buffer.concat([d.update(Buffer.from(box.data, 'base64')), d.final()]).toString('utf8'));
    return data.env === pinterestEnv() ? data : undefined;
  } catch {
    return undefined;
  }
}

async function storeRefresh(token: string): Promise<void> {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(), iv);
  const data = Buffer.concat([c.update(JSON.stringify({ token, env: pinterestEnv(), saved: new Date().toISOString() }), 'utf8'), c.final()]);
  await mkdir(dirname(TOKEN_FILE), { recursive: true });
  await writeFile(TOKEN_FILE, JSON.stringify({ iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }) + '\n');
}

// ---------- HTTP helpers ----------
async function parse(res: Response, what: string): Promise<any> {
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text.slice(0, 400) }; }
  if (!res.ok) throw new Error(`Pinterest ${what} ${res.status}: ${json.message ?? JSON.stringify(json)}${json.code ? ` (code ${json.code})` : ''}`);
  return json;
}

const basicAuth = () => 'Basic ' + Buffer.from(`${env('PINTEREST_APP_ID')}:${env('PINTEREST_APP_SECRET')}`).toString('base64');

/** Exchanges the stored (or initial) refresh token for an access token and saves the rotated refresh token. */
async function accessToken(): Promise<string> {
  const stored = await loadStoredRefresh();
  const candidates = [...new Set([stored?.token, env('PINTEREST_REFRESH_TOKEN')].filter(Boolean) as string[])];
  let lastErr: unknown;
  for (const refresh of candidates) {
    try {
      const json = await parse(await fetch(`${apiBase()}/oauth/token`, {
        method: 'POST',
        headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
      }), 'token refresh');
      await storeRefresh(json.refresh_token ?? refresh);
      return json.access_token;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error('No Pinterest refresh token');
}

export interface PinInput {
  title: string;
  description: string;
  link: string;
  altText: string;
  image?: Buffer;      // PNG for an image Pin
  video?: Buffer;      // MP4 for a video Pin
  cover?: Buffer;      // PNG cover for the video Pin
}

export interface PinResult { id: string; url: string; kind: 'image' | 'video'; env: string; note?: string }

async function createPin(token: string, mediaSource: Record<string, unknown>, p: PinInput): Promise<string> {
  const json = await parse(await fetch(`${apiBase()}/pins`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board_id: env('PINTEREST_BOARD_ID'),
      title: p.title.slice(0, 100),
      description: p.description.slice(0, 800),
      link: p.link,
      alt_text: p.altText.slice(0, 500),
      media_source: mediaSource,
    }),
  }), 'create pin');
  return json.id;
}

async function uploadVideo(token: string, mp4: Buffer): Promise<string> {
  const reg = await parse(await fetch(`${apiBase()}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ media_type: 'video' }),
  }), 'register media');

  const form = new FormData();
  for (const [k, v] of Object.entries(reg.upload_parameters ?? {})) form.append(k, String(v));
  form.append('file', new Blob([new Uint8Array(mp4)], { type: 'video/mp4' }), 'reel.mp4');
  const up = await fetch(reg.upload_url, { method: 'POST', body: form });
  if (!up.ok) throw new Error(`Pinterest video upload ${up.status}: ${(await up.text()).slice(0, 300)}`);

  for (let i = 0; i < 18; i++) {
    await new Promise(r => setTimeout(r, Number(env('PINTEREST_POLL_MS') ?? 10_000)));
    const st = await parse(await fetch(`${apiBase()}/media/${reg.media_id}`, { headers: { Authorization: `Bearer ${token}` } }), 'media status');
    if (st.status === 'succeeded') return reg.media_id;
    if (st.status === 'failed') throw new Error(`Pinterest video processing failed: ${JSON.stringify(st)}`);
  }
  throw new Error('Pinterest video still processing after 3 minutes');
}

/** Publishes a video Pin when a video is given (falls back to an image Pin), otherwise an image Pin. */
export async function publishPin(p: PinInput): Promise<PinResult> {
  const token = await accessToken();
  const e = pinterestEnv();
  const pinUrl = (id: string) => `https://www.pinterest.com/pin/${id}/`;

  if (p.video) {
    try {
      const mediaId = await uploadVideo(token, p.video);
      const source: Record<string, unknown> = { source_type: 'video_id', media_id: mediaId };
      if (p.cover) Object.assign(source, { cover_image_content_type: 'image/png', cover_image_data: p.cover.toString('base64') });
      else source.cover_image_key_frame_time = 2;
      const id = await createPin(token, source, p);
      return { id, url: pinUrl(id), kind: 'video', env: e };
    } catch (err) {
      const fallback = p.image ?? p.cover;
      if (!fallback) throw err;
      const note = `video Pin failed, posted image instead: ${(err as Error).message}`;
      console.warn(note);
      const id = await createPin(token, { source_type: 'image_base64', content_type: 'image/png', data: fallback.toString('base64') }, p);
      return { id, url: pinUrl(id), kind: 'image', env: e, note };
    }
  }

  if (!p.image) throw new Error('publishPin needs an image or a video');
  const id = await createPin(token, { source_type: 'image_base64', content_type: 'image/png', data: p.image.toString('base64') }, p);
  return { id, url: pinUrl(id), kind: 'image', env: e };
}
