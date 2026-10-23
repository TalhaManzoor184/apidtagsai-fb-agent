import { config } from './config.js';
import { complete, research, type Source } from './llm.js';
import type { HistoryEntry } from './history.js';
import { BRAND_RULES, CATEGORIES, FORMATS, WEEKDAY_CATEGORIES, pickById, type Category, type Format } from './guide.js';

export type PostType = 'photo' | 'reel';

export interface Plan { category: Category; format: Format }

export interface Post {
  pillar: string;        // category id (kept as "pillar" for history compatibility)
  format: string;
  idea: string;
  topic: string;
  headline: string;      // big text on image / reel hook
  subline: string;
  bullets: string[];     // 3 short points on image
  caption: string;       // FB post body (no URL, no hashtags)
  hashtags: string[];    // without '#'
  imagePrompt: string;   // used only in IMAGE_MODE=gemini
  sources?: Source[];    // research sources (trending category)
}

const TZ = process.env.CONTENT_TZ || 'Asia/Karachi';
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function localDay(now = new Date()): number {
  return DAYS.indexOf(new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(now));
}

function lastUsedIndex(history: HistoryEntry[], key: (h: HistoryEntry) => string | undefined) {
  const m = new Map<string, number>();
  history.forEach((h, i) => { const k = key(h); if (k) m.set(k, i); });
  return m;
}

const leastRecent = <T extends { id: string }>(items: T[], used: Map<string, number>) =>
  [...items]
    .map(x => ({ x, score: used.get(x.id) ?? -1, r: Math.random() }))
    .sort((a, b) => a.score - b.score || a.r - b.r)[0].x;

/** Category from the weekly calendar (CATEGORY env overrides), format = least recently used. */
export function planContent(history: HistoryEntry[], now = new Date()): Plan {
  const forced = process.env.CATEGORY?.trim();
  const ids = forced && CATEGORIES.some(c => c.id === forced) ? [forced] : WEEKDAY_CATEGORIES[localDay(now)];
  const category = leastRecent(ids.map(pickById), lastUsedIndex(history, h => h.pillar));
  const lastFormat = history.at(-1)?.format;
  const format = leastRecent(FORMATS.filter(f => f.id !== lastFormat), lastUsedIndex(history, h => h.format));
  return { category, format };
}

const SYSTEM = `You are the social media content lead for ${config.brandName} (${config.siteUrl}), a site with free AI tools for creators: Instagram, TikTok and YouTube tag generators, AI video ideas, AI YouTube descriptions, AI SEO titles, trending video ideas, plus SEO resources and blog content.
You write Facebook Page content.
${BRAND_RULES}
Output ONLY a JSON object, no markdown fences.`;

function userPrompt(plan: Plan, type: PostType, history: HistoryEntry[], date: string, notes?: string): string {
  const { category: c, format: f } = plan;
  const cutoff = new Date(Date.parse(date) - 30 * 86400_000).toISOString().slice(0, 10);
  const recent = history.filter(h => h.date >= cutoff)
    .map(h => `- [${h.pillar}${h.format ? '/' + h.format : ''}] ${h.headline} — ${h.topic}`).join('\n') || '(none)';

  const typeGuide = type === 'reel'
    ? `This is a short vertical REEL (on-screen text animation, no voice-over). "headline" is the scroll-stopping HOOK shown first: name the viewer's problem or promise one specific payoff. Each bullet is one self-contained on-screen point. Keep the whole reel focused on ONE useful idea. Caption is shorter: 50-110 words.`
    : `This is an IMAGE post (one branded card). Caption: 70-150 words.`;

  return `Today: ${date}. Platform: Facebook Page.
${typeGuide}

CATEGORY: ${c.name}
Goal: ${c.goal}
Audience: ${c.audience}
Content ideas to choose from (pick one, or a specific angle of one; make it concrete, e.g. name the niche):
${c.ideas.map(i => `- ${i}`).join('\n')}
${c.rules?.length ? `Category rules:\n${c.rules.map(r => `- ${r}`).join('\n')}\n` : ''}
FORMAT: ${f.name}: ${f.how}
${notes ? `\nRESEARCH NOTES (from web search today; the only allowed source for anything called "trending"):\n${notes}\n` : c.research ? '\nNo research available today: write an evergreen idea and do not call anything trending.\n' : ''}
Already published in the last 30 days (do NOT reuse these topics, hooks or angles):
${recent}

Caption rules: first sentence is an attention-grabbing hook; explain the value; practical and specific; a few line breaks and at most 3 emojis; mention ${config.brandName} at most once; end with this CTA (wording may be lightly adapted): "${c.cta}". No URLs or hashtags inside the caption.

Return JSON with exactly these keys:
{
  "idea": "which content idea you chose",
  "topic": "one-line internal summary of the specific angle",
  "headline": "max 48 characters",
  "subline": "max 90 characters, supports the headline",
  "bullets": ["exactly 3 items, each max 48 characters"],
  "caption": "the Facebook caption",
  "hashtags": ["3-7 highly relevant hashtags without #, no unrelated trending tags"],
  "imagePrompt": "clean modern background illustration for this topic, NO text, NO logos"
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

const BANNED = /\b(guarantee[ds]?|go(?:es)? viral (?:overnight|instantly)|100% (?:rank|growth))\b/i;

function validate(raw: any, plan: Plan, sources?: Source[]): Post {
  const bullets = Array.isArray(raw.bullets) ? raw.bullets.slice(0, 3).map((b: unknown) => clamp(b, 52)) : [];
  const hashtags: string[] = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .map((h: unknown) => String(h).replace(/^#/, '').replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean)
    .filter((h: string) => h.toLowerCase() !== 'rapidtagsai');

  const post: Post = {
    pillar: plan.category.id,
    format: plan.format.id,
    idea: clamp(raw.idea, 140),
    topic: clamp(raw.topic, 160),
    headline: clamp(raw.headline, 56),
    subline: clamp(raw.subline, 100),
    bullets,
    caption: String(raw.caption ?? '').replace(/https?:\/\/\S+/g, '').replace(/(^|\s)#[\p{L}\p{N}_]+/gu, '$1').trim(),
    hashtags: ['RapidTagsAI', ...new Set(hashtags)].slice(0, 8),
    imagePrompt: String(raw.imagePrompt ?? ''),
    ...(sources?.length ? { sources: sources.slice(0, 5) } : {}),
  };
  if (!post.headline || !post.caption || post.bullets.length < 3) throw new Error('Model output missing required fields');
  if (BANNED.test(post.caption) && !/no(t| one can)? guarantee/i.test(post.caption)) {
    throw new Error('Caption makes a guarantee claim; regenerating');
  }
  return post;
}

export async function generatePost(plan: Plan, type: PostType, history: HistoryEntry[], date: string): Promise<Post> {
  if (config.mockLlm) return validate(MOCK, plan);

  let notes: string | undefined;
  let sources: Source[] | undefined;
  if (plan.category.research) {
    const month = new Date(date).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const r = await research(
      `Today is ${date}. Find 3-5 video formats or topics that are currently trending (within roughly the last 30 days, ${month}) ` +
      `on YouTube Shorts, TikTok or Instagram Reels, preferably in technology, AI, gaming, education or entertainment, ` +
      `or upcoming seasonal content opportunities. For each give: name, one-line description, the date/timeframe it was reported, and the source. ` +
      `Only include items supported by the search results. Clearly separate verified trends from evergreen ideas.`);
    if (r) { notes = r.notes.slice(0, 4000); sources = r.sources; console.log(`Research: ${sources.length} sources`); }
    else console.warn('No research available; writing evergreen content');
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (attempt > 1) await new Promise(r => setTimeout(r, Math.min(60, 10 * 2 ** (attempt - 2)) * 1000)); // 10s, 20s, 40s, 60s
    try {
      return validate(extractJson(await complete(SYSTEM, userPrompt(plan, type, history, date, notes))), plan, sources);
    } catch (e) {
      lastErr = e;
      console.warn(`Generation attempt ${attempt} failed: ${(e as Error).message}`);
    }
  }
  throw lastErr;
}

/** Final Facebook message: caption + tracked link + hashtags. */
export function buildMessage(post: Post, date: string, type: PostType = 'photo'): string {
  const url = new URL(config.siteUrl);
  url.searchParams.set('utm_source', 'facebook');
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', `autopost_${post.pillar}`);
  url.searchParams.set('utm_content', `${type}_${post.format}_${date}`);
  return `${post.caption}\n\n🔗 ${url.toString()}\n\n${post.hashtags.map(h => '#' + h).join(' ')}`;
}

const MOCK = {
  idea: 'Instagram hashtag mistakes that reduce reach',
  topic: 'Why 3-5 niche hashtags beat 30 generic ones on Instagram Reels',
  headline: 'Stop Using 30 Hashtags',
  subline: 'Fewer, more specific hashtags help Instagram understand who your Reel is for.',
  bullets: ['Pick 3-5 tags that describe the Reel', 'Mix one broad tag with niche ones', 'Skip spammy tags like #followforfollow'],
  caption: "Still pasting 30 hashtags under every Reel? 🤔\n\nInstagram uses hashtags mainly to understand what your content is about. A short list of specific, relevant tags gives a clearer signal than a wall of generic ones.\n\n✅ Describe the topic, not your mood\n✅ Combine 1 broad tag with 2-4 niche tags\n✅ Rotate sets per post instead of copy-pasting\n\nHow many hashtags do you use right now?\n\nTry the free tools at RapidTagsAI.com.",
  hashtags: ['InstagramTips', 'ReelsTips', 'HashtagStrategy', 'ContentCreator'],
  imagePrompt: 'Minimal 3D illustration of a smartphone with floating hashtag symbols, purple and blue gradient, soft lighting',
};
