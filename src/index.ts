import { mkdir, writeFile } from 'node:fs/promises';
import { config } from './config.js';
import { buildMessage, generatePost, pickPillar } from './content.js';
import { renderImage } from './image.js';
import { postPhoto } from './facebook.js';
import { loadHistory, saveHistory } from './history.js';

async function main() {
  const date = new Date().toISOString().slice(0, 10);
  const history = await loadHistory();

  const pillar = pickPillar(history);
  console.log(`Pillar: ${pillar.id}`);

  const post = await generatePost(pillar, history);
  console.log(`Topic: ${post.topic}`);

  const png = await renderImage(post);
  const message = buildMessage(post, date);

  await mkdir(config.outDir, { recursive: true });
  await writeFile(`${config.outDir}/post.png`, png);
  await writeFile(`${config.outDir}/post.txt`, message);
  await writeFile(`${config.outDir}/post.json`, JSON.stringify(post, null, 2));

  if (config.dryRun) {
    console.log('\nDRY RUN — nothing posted. Preview in out/post.png and out/post.txt\n');
    console.log(message);
    return;
  }

  const postId = await postPhoto(png, message);
  console.log(`Posted to Facebook: ${postId}`);

  history.push({ date, pillar: pillar.id, topic: post.topic, headline: post.headline, postId });
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
