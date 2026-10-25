import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { config } from './config.js';
import { buildMessage, generatePost, planContent, trackedUrl, type PostType } from './content.js';
import { renderImage, renderPinImage } from './image.js';
import { authorizeUrl, exchangeAuthCode, hasAppCredentials, pinterestConfigured, pinterestEnv, publishPin, redirectUri, type PinResult } from './pinterest.js';
import { renderReel, renderReelStill } from './reel.js';
import { postPhoto, postReel } from './facebook.js';
import { loadHistory, saveHistory, type HistoryEntry } from './history.js';

/** POST_TYPE=photo|reel forces a type; otherwise alternate with the previous successful post. */
function resolvePostType(history: HistoryEntry[]): PostType {
  const forced = process.env.POST_TYPE?.trim().toLowerCase();
  if (forced === 'photo' || forced === 'reel') return forced;
  const last = history.at(-1)?.type ?? 'photo';
  return last === 'reel' ? 'photo' : 'reel';
}

/** GitHub Actions annotation (shows on the run summary page). */
function annotate(level: 'notice' | 'warning' | 'error', title: string, msg: string) {
  if (!process.env.GITHUB_ACTIONS) return;
  const esc = msg.slice(0, 3500).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  console.log(`::${level} title=${title}::${esc}`);
}

async function pinterestSetup(code: string) {
  // Accept either the bare code or the whole redirected URL
  const c = code.includes('code=') ? new URL(code.startsWith('http') ? code : `https://x/?${code.split('?').pop()}`).searchParams.get('code') ?? code : code;
  const r = await exchangeAuthCode(c);
  const msg = `Connected Pinterest (${pinterestEnv()}) as ${r.username}.\nBoard: ${r.board.name} (${r.board.id})\nToken saved encrypted in data/pinterest-token.enc.`;
  console.log(msg);
  annotate('notice', 'Pinterest connected', msg);
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const authCode = process.env.PINTEREST_AUTH_CODE?.trim();
  if (authCode) return pinterestSetup(authCode);
  // PLATFORMS=all (default) | facebook | pinterest  (pinterest-only runs are for testing and don't touch history)
  const platforms = (process.env.PLATFORMS || 'all').trim().toLowerCase();
  const toFacebook = platforms !== 'pinterest';
  const toPinterest = platforms !== 'facebook' && pinterestConfigured();
  if (platforms !== 'facebook' && !toPinterest) {
    console.log('Pinterest not configured; skipping.');
    if (hasAppCredentials()) {
      annotate('notice', 'Pinterest: connect your account',
        `Open this link, log in and click Allow:\n${authorizeUrl()}\n\nYou will land on ${redirectUri()}?code=... — run the workflow again with that code in "pinterest_code".`);
    }
  }
  const history = await loadHistory();

  const type = resolvePostType(history);
  const plan = planContent(history);
  console.log(`Type: ${type} | Category: ${plan.category.id} | Format: ${plan.format.id}`);

  const post = await generatePost(plan, type, history, date);
  console.log(`Topic: ${post.topic}`);

  const message = buildMessage(post, date, type);
  await mkdir(config.outDir, { recursive: true });
  await writeFile(`${config.outDir}/post.txt`, message);
  await writeFile(`${config.outDir}/post.json`, JSON.stringify({ type, ...post }, null, 2));

  let media: Buffer;
  if (type === 'reel') {
    const path = `${config.outDir}/reel.mp4`;
    await renderReel(post, path);
    await writeFile(`${config.outDir}/reel-preview.png`, await renderReelStill(post));
    media = await readFile(path);
  } else {
    media = await renderImage(post);
    await writeFile(`${config.outDir}/post.png`, media);
  }

  // Pinterest assets: 2:3 image (or the reel + a cover frame from the hook scene)
  let pinImage: Buffer | undefined, pinCover: Buffer | undefined;
  const pinLink = trackedUrl(post, date, type, 'pinterest');
  if (toPinterest || config.dryRun) {
    pinImage = await renderPinImage(post);
    await writeFile(`${config.outDir}/pin.png`, pinImage);
    if (type === 'reel') pinCover = await renderReelStill(post, 2.5);
  }

  const summary = `${type} | ${plan.category.name} | ${plan.format.name}\n` +
    `HEADLINE: ${post.headline}\nSUBLINE: ${post.subline}\nPOINTS: ${post.bullets.join(' / ')}\n\n${message}` +
    (post.sources?.length ? `\n\nSOURCES:\n${post.sources.map(s => `- ${s.title} ${s.url}`).join('\n')}` : '') +
    `\n\nPINTEREST (${pinterestEnv()}): ${post.pinTitle}\n${post.pinDescription}\n${pinLink}`;

  if (config.dryRun) {
    console.log(`\nDRY RUN — nothing posted. Preview files are in ${config.outDir}/\n`);
    console.log(summary);
    annotate('notice', 'Dry run preview', summary);
    return;
  }

  let postId: string | undefined, url: string | undefined;
  if (toFacebook) {
    postId = type === 'reel' ? await postReel(media, message) : await postPhoto(media, message);
    url = type === 'reel' ? `https://www.facebook.com/reel/${postId}` : `https://www.facebook.com/${postId}`;
    console.log(`Posted ${type} to Facebook: ${url}`);
    annotate('notice', 'Published to Facebook', `${url}\n\n${summary}`);
  }

  // Pinterest never fails the run: Facebook is already live at this point
  let pin: PinResult | undefined, pinError: string | undefined;
  if (toPinterest) {
    try {
      pin = await publishPin({
        title: post.pinTitle, description: post.pinDescription, link: pinLink,
        altText: `${post.headline}. ${post.subline}`,
        image: pinImage, video: type === 'reel' ? media : undefined, cover: pinCover,
      });
      console.log(`Pinned (${pin.kind}, ${pin.env}): ${pin.url}`);
      annotate(pin.note ? 'warning' : 'notice', `Published to Pinterest (${pin.env})`, `${pin.url}${pin.note ? `\n${pin.note}` : ''}`);
    } catch (e) {
      pinError = (e as Error).message;
      console.error(`Pinterest failed: ${pinError}`);
      annotate('warning', 'Pinterest failed (Facebook post is unaffected)', pinError);
    }
  }

  if (!toFacebook) return; // test runs don't change rotation/history
  history.push({
    date, type, platform: 'facebook', pillar: plan.category.id, format: plan.format.id,
    topic: post.topic, headline: post.headline, postId, url,
    ...(post.sources?.length ? { sources: post.sources.map(s => s.url).slice(0, 3) } : {}),
    ...(pin ? { pinterest: { id: pin.id, url: pin.url, kind: pin.kind, env: pin.env } } : {}),
    ...(pinError ? { pinterestError: pinError.slice(0, 300) } : {}),
  });
  await saveHistory(history);
}

main().catch(err => {
  console.error(err);
  annotate('error', 'Agent failed — nothing was published', String((err as Error)?.message ?? err));
  process.exit(1);
});
