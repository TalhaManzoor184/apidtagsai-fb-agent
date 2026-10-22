import { config, required } from './config.js';

/**
 * Publishes a photo post to a Facebook Page.
 * Needs a Page access token with pages_manage_posts + pages_read_engagement.
 */
export async function postPhoto(png: Buffer, message: string): Promise<string> {
  const pageId = required('FB_PAGE_ID');
  const form = new FormData();
  form.append('source', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'post.png');
  form.append('message', message);
  form.append('published', 'true');
  form.append('access_token', required('FB_PAGE_ACCESS_TOKEN'));

  const res = await fetch(`https://graph.facebook.com/${config.fbGraphVersion}/${pageId}/photos`, {
    method: 'POST',
    body: form,
  });
  const json: any = await res.json();
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new Error(`Facebook ${res.status}: ${e.message ?? JSON.stringify(json)} (code ${e.code}, subcode ${e.error_subcode})`);
  }
  return json.post_id ?? json.id;
}
