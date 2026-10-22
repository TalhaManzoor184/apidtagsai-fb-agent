import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { config } from './config.js';
import { buildMessage, generatePost, pickPillar } from './content.js';
import { renderImage } from './image.js';
import { renderReel, renderReelStill } from './reel.js';
import { postPhoto, postReel } from './facebook.js';
import { loadHistory, saveHistory, type HistoryEntry } from './history.js';

type PostType = 'photo' | 'reel';

/** POST_TYPE=photo|reel forces a type; otherwise alternate with the previous successful post. */
function resolvePostType(history: HistoryEntry[]): PostType {
  const forced = process.env.POST_TYPE?.trim().toLowerCase();
  if (forced === 'photo' || forced === 'reel') return forced;
  const last = history.at(-1)?.type ?? 'photo';
  return last === 'reel' ? 'photo' : 'reel';
}

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const history = await loadHistory();

  const type = resolvePostType(history);
  const pillar = pickPillar(history);
  console.log(`Type: ${type} | Pillar: ${pillar.id}`);

  const post = await generatePost(pillar, history);
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

  if (config.dryRun) {
    console.log(`\nDRY RUN — nothing posted. Preview files are in ${config.outDir}/\n`);
    console.log(message);
    return;
  }

  const postId = type === 'reel' ? await postReel(media, message) : await postPhoto(media, message);
  console.log(`Posted ${type} to Facebook: ${postId}`);

  history.push({ date, type, pillar: pillar.id, topic: post.topic, headline: post.headline, postId });
  await saveHistory(history);
}

main().catch(err => {
  console.error(err);
  if (process.env.GITHUB_ACTIONS) {
    const msg = String((err as Error)?.message ?? err).replace(/\r?\n/g, ' ').slice(0, 900);
    console.log(`::error title=Agent failed::${msg}`);
  }
  process.exit(1);
});
