import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Pinterest API v5 publishing.
 * - PINTEREST_ENV=sandbox (Trial access: Pins visible only to you) | production (Standard access: public)
 * - Refresh tokens rotate on every refresh (continuous refresh, ~60 days), so the newest one is stored
 *   AES-256-GCM encrypted in data/pinterest-token.enc (key = PINTEREST_TOKEN_KEY, or derived from the app secret)
 *   together with the board id, and committed by the workflow.
 */

const env = (k: string) => process.env[k]?.trim() || undefined;
const TOKEN_FILE = 'data/pinterest-token.enc';

export const pinterestEnv = () => (env('PINTEREST_ENV') === 'production' ? 'production' : 'sandbox');
export const apiBase = (e = pinterestEnv()) =>
  env('PINTEREST_API_BASE') ?? (e === 'production' ? 'https://api.pinterest.com/v5' : 'https://api-sandbox.pinterest.com/v5');

export const redirectUri = () => env('PINTEREST_REDIRECT_URI') ?? 'https://rapidtagsai.com/';
const SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
const DEFAULT_BOARD = 'Creator SEO Tips by RapidTagsAI';
const PRODUCTION_BOARD = 'SEO & Hashtag Tips for Creators | RapidTagsAI';
let currentRefresh: string | undefined;

export const hasAppCredentials = () => Boolean(env('PINTEREST_APP_ID') && env('PINTEREST_APP_SECRET'));

/** App credentials + a token (secret or stored file). Board comes from PINTEREST_BOARD_ID or the stored file. */
/** True when app credentials exist and a token for the CURRENT environment (sandbox/production) is available. */
export async function pinterestConfigured(): Promise<boolean> {
  if (!hasAppCredentials()) return false;
  if (env('PINTEREST_REFRESH_TOKEN')) return true;
  return existsSync(TOKEN_FILE) && Boolean(await loadStoredRefresh());
}

export function authorizeUrl(): string {
  return `https://www.pinterest.com/oauth/?${new URLSearchParams({
    client_id: env('PINTEREST_APP_ID') ?? '', redirect_uri: redirectUri(), response_type: 'code', scope: SCOPES, state: 'rapidtagsai',
  })}`;
}

// ---------- encrypted token store ----------
const keyOf = () => createHash('sha256').update(env('PINTEREST_TOKEN_KEY') ?? `pinterest-token:${env('PINTEREST_APP_SECRET') ?? ''}`).digest();

interface Stored { token: string; env: string; boardId?: string; boardName?: string }

async function loadStoredRefresh(): Promise<Stored | undefined> {
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

async function storeRefresh(token: string, board?: { id: string; name: string }): Promise<void> {
  const prev = await loadStoredRefresh();
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(), iv);
  const payload = { token, env: pinterestEnv(), boardId: board?.id ?? prev?.boardId, boardName: board?.name ?? prev?.boardName, saved: new Date().toISOString() };
  const data = Buffer.concat([c.update(JSON.stringify(payload), 'utf8'), c.final()]);
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
      currentRefresh = json.refresh_token ?? refresh;
      await storeRefresh(currentRefresh!);
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

async function boardId(): Promise<string> {
  const id = env('PINTEREST_BOARD_ID') ?? (await loadStoredRefresh())?.boardId;
  if (!id) throw new Error('No Pinterest board id (set PINTEREST_BOARD_ID or run the auth code exchange)');
  return id;
}

/** Finds (or creates) a board by name in the current environment and remembers it with the token. */
async function useBoardNamed(token: string, name: string): Promise<string> {
  const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const items: any[] = (await parse(await fetch(`${apiBase()}/boards?page_size=100`, { headers: auth }), 'list boards')).items ?? [];
  let b = items.find(x => String(x.name).toLowerCase() === name.toLowerCase());
  b ??= await parse(await fetch(`${apiBase()}/boards`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({ name, description: 'Free tips on YouTube, TikTok and Instagram tags, titles, descriptions and SEO.', privacy: 'PUBLIC' }),
  }), 'create board');
  if (currentRefresh) await storeRefresh(currentRefresh, { id: String(b.id), name: String(b.name) });
  console.log(`Using Pinterest board: ${b.name} (${b.id})`);
  return String(b.id);
}

async function createPin(token: string, mediaSource: Record<string, unknown>, p: PinInput): Promise<string> {
  try {
    return await createPinOn(token, await boardId(), mediaSource, p);
  } catch (e) {
    // A board created during Trial (sandbox) can't hold production Pins: switch to a production board once.
    if (!/sandbox boards|code 15\b/i.test((e as Error).message) || env('PINTEREST_BOARD_ID')) throw e;
    const id = await useBoardNamed(token, env('PINTEREST_BOARD_NAME') ?? PRODUCTION_BOARD);
    return createPinOn(token, id, mediaSource, p);
  }
}

async function createPinOn(token: string, board: string, mediaSource: Record<string, unknown>, p: PinInput): Promise<string> {
  const json = await parse(await fetch(`${apiBase()}/pins`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      board_id: board,
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

/**
 * One-time setup from GitHub: exchanges the ?code=... from the Pinterest consent redirect for tokens,
 * picks or creates the board, and stores both (encrypted) in data/pinterest-token.enc.
 */
export async function exchangeAuthCode(code: string): Promise<{ username: string; board: { id: string; name: string }; boards: string[] }> {
  const tok = await parse(await fetch(`${apiBase()}/oauth/token`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri(), continuous_refresh: 'true' }),
  }), 'code exchange');
  const auth = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };
  const me = await parse(await fetch(`${apiBase()}/user_account`, { headers: auth }), 'user account');
  const items: any[] = (await parse(await fetch(`${apiBase()}/boards?page_size=100`, { headers: auth }), 'list boards')).items ?? [];
  const wanted = env('PINTEREST_BOARD_NAME') ?? (pinterestEnv() === 'production' ? PRODUCTION_BOARD : DEFAULT_BOARD);
  let b = items.find(x => String(x.name).toLowerCase() === wanted.toLowerCase());
  if (!b) {
    b = await parse(await fetch(`${apiBase()}/boards`, {
      method: 'POST', headers: auth,
      body: JSON.stringify({ name: wanted, description: 'Free tips on YouTube, TikTok and Instagram tags, titles, descriptions and SEO.', privacy: 'PUBLIC' }),
    }), 'create board');
  }
  const board = { id: String(b.id), name: String(b.name) };
  await storeRefresh(tok.refresh_token, board);
  return { username: me.username, board, boards: items.map(x => `${x.id} ${x.name}`) };
}
