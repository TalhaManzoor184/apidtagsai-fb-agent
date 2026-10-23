import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { config } from './config.js';
import { buildMessage, generatePost, planContent, type PostType } from './content.js';
import { renderImage } from './image.js';
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
function annotate(level: 'notice' | 'error', title: string, msg: string) {
  if (!process.env.GITHUB_ACTIONS) return;
  const esc = msg.slice(0, 3500).replace(/%/g, '%25').replace(/\r/g, '').replace(/\n/g, '%0A');
  console.log(`::${level} title=${title}::${esc}`);
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
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

  const summary = `${type} | ${plan.category.name} | ${plan.format.name}\n` +
    `HEADLINE: ${post.headline}\nSUBLINE: ${post.subline}\nPOINTS: ${post.bullets.join(' / ')}\n\n${message}` +
    (post.sources?.length ? `\n\nSOURCES:\n${post.sources.map(s => `- ${s.title} ${s.url}`).join('\n')}` : '');

  if (config.dryRun) {
    console.log(`\nDRY RUN — nothing posted. Preview files are in ${config.outDir}/\n`);
    console.log(summary);
    annotate('notice', 'Dry run preview', summary);
    return;
  }

  const postId = type === 'reel' ? await postReel(media, message) : await postPhoto(media, message);
  const url = type === 'reel' ? `https://www.facebook.com/reel/${postId}` : `https://www.facebook.com/${postId}`;
  console.log(`Posted ${type} to Facebook: ${url}`);
  annotate('notice', 'Published', `${url}\n\n${summary}`);

  history.push({
    date, type, platform: 'facebook', pillar: plan.category.id, format: plan.format.id,
    topic: post.topic, headline: post.headline, postId, url,
    ...(post.sources?.length ? { sources: post.sources.map(s => s.url).slice(0, 3) } : {}),
  });
  await saveHistory(history);
}

main().catch(err => {
  console.error(err);
  annotate('error', 'Agent failed — nothing was published', String((err as Error)?.message ?? err));
  process.exit(1);
});
