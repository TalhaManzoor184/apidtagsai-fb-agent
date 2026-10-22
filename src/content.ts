import { config } from './config.js';
import { complete } from './llm.js';
import type { HistoryEntry } from './history.js';

export interface Pillar { id: string; brief: string }

/** Content pillars rotate so the page doesn't post the same kind of thing twice in a row. */
export const PILLARS: Pillar[] = [
  { id: 'youtube-tags', brief: 'YouTube SEO: tags, titles, descriptions, keyword research, search ranking tips' },
  { id: 'tiktok-hashtags', brief: 'TikTok hashtag strategy: niche vs broad hashtags, FYP myths, how many to use' },
  { id: 'instagram-hashtags', brief: 'Instagram hashtag strategy for Reels and posts: placement, count, banned/overused tags' },
  { id: 'myth-vs-fact', brief: 'A common hashtag or video-SEO myth, busted with the fact' },
  { id: 'mistakes', brief: 'Mistakes creators make with tags/hashtags/SEO and how to fix them' },
  { id: 'niche-hashtag-pack', brief: 'A ready-to-use hashtag set for one specific niche (e.g. cooking, gaming, fitness, tech, travel)' },
  { id: 'tool-spotlight', brief: `How to use ${'{brand}'} to generate tags/hashtags in seconds, framed as a quick tutorial` },
  { id: 'algorithm-insight', brief: 'How discovery works on YouTube/TikTok/Instagram and where tags/keywords fit in (honest, not hype)' },
];

export interface Post {
  pillar: string;
  topic: string;
  headline: string;      // big text on image
  subline: string;       // smaller text on image
  bullets: string[];     // 3 short points on image
  caption: string;       // FB post body (no URL, no hashtags)
  hashtags: string[];    // without '#'
  imagePrompt: string;   // used only in IMAGE_MODE=gemini
}

export function pickPillar(history: HistoryEntry[]): Pillar {
  const lastUsed = new Map<string, number>();
  history.forEach((h, i) => lastUsed.set(h.pillar, i));
  // Least recently used pillar; never-used pillars first; random tie-break
  return [...PILLARS]
    .map(p => ({ p, score: lastUsed.get(p.id) ?? -1, r: Math.random() }))
    .sort((a, b) => a.score - b.score || a.r - b.r)[0].p;
}

const SYSTEM = `You are the social media manager for ${config.brandName} (${config.siteUrl}), a free AI tool that generates tags and hashtags for YouTube, TikTok and Instagram.
You write Facebook Page posts for small creators that teach one genuinely useful, accurate SEO or hashtag idea per post.
Rules:
- Be accurate. Do not invent statistics, studies or platform policies. No guarantees of going viral.
- Value first; mention ${config.brandName} naturally at most once in the caption.
- Do NOT put any URL or hashtags inside "caption" (they are appended automatically).
- Write the caption in: ${config.language}.
- Output ONLY a JSON object, no markdown fences.`;

function userPrompt(pillar: Pillar, history: HistoryEntry[]): string {
  const recent = history.slice(-40).map(h => `- ${h.topic}`).join('\n') || '(none yet)';
  return `Content pillar for today: ${pillar.brief.replace('{brand}', config.brandName)}

Topics already posted (do NOT repeat or closely rephrase):
${recent}

Return JSON with exactly these keys:
{
  "topic": "one-line internal summary of today's specific angle",
  "headline": "image headline, max 50 characters, punchy",
  "subline": "image sub-headline, max 90 characters",
  "bullets": ["3 items, each max 48 characters, shown on the image"],
  "caption": "Facebook caption, 80-160 words: hook line, short explanation/steps (line breaks + a few emojis ok), end with a question or call to action to try ${config.brandName}",
  "hashtags": ["6-10 relevant hashtags without the # symbol, mix broad and niche, always include RapidTagsAI"],
  "imagePrompt": "description of a clean, modern background illustration for this topic, NO text, NO logos, NO real brand marks"
}`;
}

function extractJson(text: string): any {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('No JSON object in model output');
  return JSON.parse(text.slice(start, end + 1));
}

const clamp = (s: unknown, n: number) => {
  const t = String(s ?? '').trim();
  return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + '…';
};

function validate(raw: any, pillar: Pillar): Post {
  const bullets = Array.isArray(raw.bullets) ? raw.bullets.slice(0, 3).map((b: unknown) => clamp(b, 52)) : [];
  const hashtags: string[] = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .map((h: unknown) => String(h).replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean);
  if (!hashtags.some(h => h.toLowerCase() === 'rapidtagsai')) hashtags.unshift('RapidTagsAI');

  const post: Post = {
    pillar: pillar.id,
    topic: clamp(raw.topic, 140),
    headline: clamp(raw.headline, 56),
    subline: clamp(raw.subline, 100),
    bullets,
    caption: String(raw.caption ?? '').replace(/https?:\/\/\S+/g, '').replace(/#\w+/g, '').trim(),
    hashtags: [...new Set(hashtags)].slice(0, 10),
    imagePrompt: String(raw.imagePrompt ?? ''),
  };
  if (!post.headline || !post.caption || post.bullets.length < 2) throw new Error('Model output missing required fields');
  return post;
}

export async function generatePost(pillar: Pillar, history: HistoryEntry[]): Promise<Post> {
  if (config.mockLlm) return validate(MOCK, pillar);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return validate(extractJson(await complete(SYSTEM, userPrompt(pillar, history))), pillar);
    } catch (e) {
      lastErr = e;
      console.warn(`Generation attempt ${attempt} failed: ${(e as Error).message}`);
    }
  }
  throw lastErr;
}

/** Final Facebook message: caption + tracked link + hashtags. */
export function buildMessage(post: Post, date: string): string {
  const url = new URL(config.siteUrl);
  url.searchParams.set('utm_source', 'facebook');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', `autopost_${post.pillar}`);
  url.searchParams.set('utm_content', date);
  return `${post.caption}\n\n👉 Free tag & hashtag generator: ${url.toString()}\n\n${post.hashtags.map(h => '#' + h).join(' ')}`;
}

const MOCK = {
  topic: 'Why 3-5 niche hashtags beat 30 generic ones on Instagram Reels',
  headline: 'Stop Using 30 Hashtags',
  subline: 'Fewer, more specific hashtags help Instagram understand who your Reel is for.',
  bullets: ['Pick 3-5 tags that describe the Reel', 'Mix one broad tag with niche ones', 'Skip spammy tags like #followforfollow'],
  caption: "Still pasting 30 hashtags under every Reel? 🤔\n\nInstagram now uses hashtags mainly to understand what your content is about, not to blast it to everyone. A short list of specific, relevant tags gives a clearer signal than a wall of generic ones.\n\n✅ Describe the topic, not your mood\n✅ Combine 1 broad tag with 2-4 niche tags\n✅ Rotate sets per post instead of copy-pasting\n\nNot sure which tags fit? RapidTagsAI suggests relevant hashtags from your topic in seconds.\n\nHow many hashtags do you use right now?",
  hashtags: ['InstagramTips', 'ReelsTips', 'HashtagStrategy', 'ContentCreator', 'SocialMediaTips', 'InstagramGrowth'],
  imagePrompt: 'Minimal 3D illustration of a smartphone with floating hashtag symbols, purple and blue gradient, soft lighting',
};
