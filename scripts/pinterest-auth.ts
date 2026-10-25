/**
 * One-time Pinterest login (OAuth 2.0) → prints the secrets the agent needs.
 *
 *   npm run pinterest:auth                 # uses PINTEREST_ENV from .env (default: sandbox)
 *   npm run pinterest:auth -- --board "My board name"   # pick/create a board by name
 *
 * Needs in .env: PINTEREST_APP_ID, PINTEREST_APP_SECRET
 * The redirect URI (default http://localhost:8085/) must be added to your app on developers.pinterest.com.
 * A screen recording of this script is what Pinterest asks for when you request Standard access.
 */
import 'dotenv/config';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { apiBase, pinterestEnv } from '../src/pinterest.js';

const APP_ID = process.env.PINTEREST_APP_ID?.trim();
const APP_SECRET = process.env.PINTEREST_APP_SECRET?.trim();
const REDIRECT = process.env.PINTEREST_REDIRECT_URI?.trim() || 'http://localhost:8085/';
const SCOPES = 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
const boardArg = (() => { const i = process.argv.indexOf('--board'); return i > 0 ? process.argv[i + 1] : undefined; })();

if (!APP_ID || !APP_SECRET) {
  console.error('Set PINTEREST_APP_ID and PINTEREST_APP_SECRET in .env first.');
  process.exit(1);
}

const ENV = pinterestEnv();
const BASE = apiBase(ENV);
const state = randomBytes(16).toString('hex');
const authUrl = `https://www.pinterest.com/oauth/?${new URLSearchParams({
  client_id: APP_ID, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPES, state,
})}`;

async function api(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${json.message ?? JSON.stringify(json)}`);
  return json;
}

async function finish(code: string) {
  console.log(`\nExchanging code for tokens (${ENV}: ${BASE}) ...`);
  const res = await fetch(`${BASE}/oauth/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${APP_ID}:${APP_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT, continuous_refresh: 'true' }),
  });
  const tok: any = await res.json();
  if (!res.ok) throw new Error(`Token exchange ${res.status}: ${tok.message ?? JSON.stringify(tok)}`);

  const me = await api('/user_account', tok.access_token);
  console.log(`Logged in as: ${me.username} (${me.account_type ?? 'account'})`);

  const boards: any[] = (await api('/boards?page_size=100', tok.access_token)).items ?? [];
  console.log(`\nBoards in ${ENV}:`);
  boards.forEach(b => console.log(`  ${b.id}  ${b.name}`));

  const wanted = boardArg ?? 'Creator SEO Tips by RapidTagsAI';
  let board = boards.find(b => b.name.toLowerCase() === wanted.toLowerCase()) ?? (boardArg ? undefined : boards[0]);
  if (!board) {
    board = await api('/boards', tok.access_token, {
      method: 'POST',
      body: JSON.stringify({ name: wanted, description: 'Free tips on YouTube, TikTok and Instagram tags, titles, descriptions and SEO.', privacy: 'PUBLIC' }),
    });
    console.log(`Created board: ${board.id}  ${board.name}`);
  }

  console.log(`
========================================================================
Add these in GitHub → Settings → Secrets and variables → Actions

Secrets:
  PINTEREST_APP_ID        = ${APP_ID}
  PINTEREST_APP_SECRET    = (your app secret)
  PINTEREST_REFRESH_TOKEN = ${tok.refresh_token}
  PINTEREST_TOKEN_KEY     = ${randomBytes(24).toString('base64url')}   (any random string; keep it)

Variables:
  PINTEREST_ENV           = ${ENV}
  PINTEREST_BOARD_ID      = ${board.id}     (${board.name})
========================================================================
Refresh token valid for ~${Math.round((tok.refresh_token_expires_in ?? 0) / 86400)} days; the agent renews it on every run.
`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', REDIRECT);
  const code = url.searchParams.get('code');
  if (!code) { res.writeHead(404).end(); return; }
  if (url.searchParams.get('state') !== state) { res.writeHead(400).end('State mismatch'); return; }
  res.writeHead(200, { 'Content-Type': 'text/html' }).end('<h2>Pinterest connected. You can close this tab and return to the terminal.</h2>');
  try { await finish(code); } catch (e) { console.error((e as Error).message); process.exitCode = 1; }
  server.close();
});

server.listen(Number(new URL(REDIRECT).port || 80), () => {
  console.log(`Pinterest environment: ${ENV}\nOpen this URL to log in and approve access:\n\n${authUrl}\n`);
  const opener = process.platform === 'win32' ? `start "" "${authUrl}"` : process.platform === 'darwin' ? `open "${authUrl}"` : `xdg-open "${authUrl}"`;
  exec(opener, () => {});
});
