import { config, required } from './config.js';

const graph = (path: string) => `https://graph.facebook.com/${config.fbGraphVersion}/${path}`;

async function parse(res: Response, what: string): Promise<any> {
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 500) }; }
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(`Facebook ${what} ${res.status}: ${e.message ?? JSON.stringify(json)} (code ${e.code}, subcode ${e.error_subcode})`);
  }
  return json;
}

/**
 * Publishes a photo post to a Facebook Page.
 * Needs a Page access token with pages_manage_posts + pages_read_engagement.
 */
export async function postPhoto(png: Buffer, message: string): Promise<string> {
  const form = new FormData();
  form.append('source', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'post.png');
  form.append('message', message);
  form.append('published', 'true');
  form.append('access_token', required('FB_PAGE_ACCESS_TOKEN'));

  const json = await parse(await fetch(graph(`${required('FB_PAGE_ID')}/photos`), { method: 'POST', body: form }), 'photo');
  return json.post_id ?? json.id;
}

/**
 * Publishes a Reel via the Page Reels API: start → upload binary → finish, then waits for processing.
 * Same token permissions as photos (pages_manage_posts, pages_read_engagement, pages_show_list).
 */
export async function postReel(mp4: Buffer, description: string): Promise<string> {
  const pageId = required('FB_PAGE_ID');
  const token = required('FB_PAGE_ACCESS_TOKEN');
  const endpoint = graph(`${pageId}/video_reels`);

  // 1. Start upload session
  const start = await parse(await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({ upload_phase: 'start', access_token: token }),
  }), 'reel start');
  const videoId: string = start.video_id;
  const uploadUrl: string = start.upload_url ?? `https://rupload.facebook.com/video-upload/${config.fbGraphVersion}/${videoId}`;

  // 2. Upload the file
  await parse(await fetch(uploadUrl, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String(mp4.length) },
    body: new Uint8Array(mp4),
  }), 'reel upload');

  // 3. Publish
  await parse(await fetch(endpoint, {
    method: 'POST',
    body: new URLSearchParams({
      upload_phase: 'finish', video_id: videoId, video_state: 'PUBLISHED', description, access_token: token,
    }),
  }), 'reel finish');

  // 4. Wait for processing/publishing so failures show up in the run instead of silently
  const deadline = Date.now() + 4 * 60_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10_000));
    const s = (await parse(await fetch(`${graph(videoId)}?fields=status&access_token=${encodeURIComponent(token)}`), 'reel status')).status ?? {};
    const phases = [s.uploading_phase, s.processing_phase, s.publishing_phase];
    const failed = phases.find((ph: any) => ph?.status === 'error');
    if (failed || s.video_status === 'error') {
      throw new Error(`Reel processing failed: ${JSON.stringify(failed?.errors ?? s)}`);
    }
    console.log(`Reel status: ${s.video_status} / processing=${s.processing_phase?.status} / publishing=${s.publishing_phase?.status}`);
    if (s.publishing_phase?.status === 'complete') return videoId;
  }
  console.warn(`Reel ${videoId} still processing after 4 min; Facebook will publish it when ready.`);
  return videoId;
}
