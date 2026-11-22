/**
 * RapidTagsAI content guide (source: docs/content-guide.md), encoded for the agent.
 * Edit this file to change categories, CTAs, the weekly calendar, formats or rules.
 */

export interface Category {
  id: string;
  name: string;
  goal: string;
  audience: string;
  ideas: string[];
  cta: string;
  rules?: string[];
  /** Needs fresh, verifiable information (web research) before writing. */
  research?: boolean;
  /** Landing page for this category's link (defaults to the site home). */
  url?: string;
  /** Search keyword clusters (from Google Trends exports); one cluster per post, rotated. */
  keywordClusters?: string[][];
}

/** RapidTagsAI SEO Checker / Website Traffic Checker (verified on the live page, Nov 2026). */
export const SEO_CHECKER_URL = 'https://rapidtagsai.com/wp-blog/traffic-checker/';
const SEO_CHECKER_FACTS = `RapidTagsAI's free SEO Checker / Website Traffic Checker (${SEO_CHECKER_URL}), verified features:
- 100% free, no account or signup; enter any public website URL; an audit takes about 10-20 seconds; powered by Google Gemini AI.
- Overall SEO Score out of 100 (70-100 good, 40-69 needs improvement, below 40 serious issues).
- On-page analysis: title tag, meta description, H1/H2 structure, canonical URL, robots meta.
- Page speed & performance: mobile-friendliness, Core Web Vitals (LCP, CLS, FID), load speed, image optimisation.
- Domain: estimated Domain Rating, domain age, HTTPS status, spam score, estimated domain value.
- Backlinks: estimated backlink count, referring domains, link quality, anchor text diversity.
- Traffic: estimated monthly organic traffic, traffic trend, top 5 countries.
- Keywords: estimated top-ranking keywords with positions and search volumes.
- Issues (critical + warnings) and Recommendations ranked High/Medium/Low impact.
Honesty rules for this tool: every metric is an AI ESTIMATE from public signals, not live crawl data, so always say "estimated"/"estimate" for traffic, DR, backlinks and rankings. Never present it as exact, official or as a replacement for Google Search Console / PageSpeed Insights (it suggests pairing with them). It does NOT check grammar, plagiarism, indexing, keyword difficulty or live SERP positions for a keyword you type: never claim those.`;

/** Rising Google searches (Worldwide, Nov 2025-Nov 2026, data/keywords/seo-checker-rising-2026-11.csv), only those the tool truly answers. */
const SEO_CHECKER_KEYWORDS: string[][] = [
  ['free website seo checker', 'website seo checker free', 'free online seo checker', 'best free seo checker'],
  ['online seo checker', 'seo checker online free', 'on page seo checker free'],
  ['website traffic checker', 'free website traffic checker', 'check website traffic'],
  ['free backlinks checker', 'backlinks checker', 'free domain authority checker', 'domain authority checker'],
  ['seo rank checker free', 'free seo rank checker', 'seo keyword checker', 'website seo rank checker'],
];


export const CATEGORIES: Category[] = [
  {
    id: 'instagram-tags',
    name: 'AI Instagram Tags Generator',
    goal: "Promote RapidTagsAI's AI Instagram tag generation.",
    audience: 'Instagram creators, small businesses and influencers',
    ideas: [
      'Best Instagram hashtags for a specific niche',
      'How to find relevant Instagram hashtags using AI',
      'Instagram hashtag mistakes that reduce reach',
      'Hashtag strategies for creators, businesses and influencers',
      'How to generate niche-specific hashtags in seconds',
    ],
    cta: 'Try the free tools at RapidTagsAI.com.',
  },
  {
    id: 'tiktok-tags',
    name: 'AI TikTok Tags Generator',
    goal: 'Educational, engaging content about TikTok hashtags and discoverability.',
    audience: 'TikTok creators',
    ideas: [
      'Best TikTok hashtags for a specific niche',
      'How to discover relevant hashtags for TikTok videos',
      'Common TikTok hashtag mistakes',
      'AI-powered hashtag research for creators',
      'How to choose hashtags based on video content',
    ],
    cta: 'Discover smarter hashtag ideas with RapidTagsAI.com.',
  },
  {
    id: 'youtube-tags',
    name: 'AI YouTube Tags Generator',
    goal: 'Help YouTubers improve video metadata and discoverability.',
    audience: 'YouTubers, especially beginners and small channels',
    ideas: [
      'How to generate relevant YouTube tags with AI',
      'YouTube tag research for beginners',
      'Common YouTube SEO mistakes',
      'Niche-specific tags for gaming, tech, education or entertainment',
      'How to optimize video metadata',
    ],
    cta: 'Generate YouTube tag ideas with RapidTagsAI.com.',
    rules: ['Never claim that tags alone guarantee rankings or viral views; tags are a minor signal next to title, thumbnail and watch time.'],
  },
  {
    id: 'video-ideas',
    name: 'Free AI Video Ideas',
    goal: 'Help creators overcome creative block and discover new video concepts.',
    audience: 'Beginner and small creators, faceless channels, business/educational channels',
    ideas: [
      '5 video ideas for beginners',
      '10 YouTube video ideas for tech creators',
      'Faceless YouTube channel ideas',
      'AI-generated content ideas for small creators',
      'Video ideas for Instagram Reels, TikTok and YouTube Shorts',
      'Video ideas for educational and business channels',
    ],
    cta: 'Find your next content idea with RapidTagsAI.com.',
  },
  {
    id: 'youtube-descriptions',
    name: 'AI YouTube Descriptions',
    goal: 'Educate creators about writing better YouTube descriptions.',
    audience: 'YouTubers',
    ideas: [
      'How to write an SEO-friendly YouTube description',
      'AI-generated vs manually written descriptions',
      'YouTube description templates for a specific niche',
      'Description mistakes creators should avoid',
      'How to include relevant keywords naturally',
    ],
    cta: 'Create better YouTube descriptions with RapidTagsAI.com.',
  },
  {
    id: 'seo-titles',
    name: 'Free AI SEO Titles',
    goal: 'Content about compelling, search-friendly titles.',
    audience: 'YouTubers and bloggers',
    ideas: [
      'AI-generated YouTube title ideas',
      'How to write clickable video titles',
      'SEO title formulas for a specific niche',
      'Before-and-after title improvements',
      'Common title mistakes',
      'Balancing search intent, clarity and curiosity',
    ],
    cta: 'Generate SEO title ideas with RapidTagsAI.com.',
    rules: ['Clickable but never misleading clickbait.'],
  },
  {
    id: 'trending-ideas',
    name: 'Trending Video Ideas',
    goal: 'Help creators identify relevant trends and turn them into content opportunities.',
    audience: 'Creators on YouTube Shorts, TikTok and Reels',
    ideas: [
      'Trending video formats',
      'Emerging topics in technology, AI, gaming, education or entertainment',
      'Trending YouTube Shorts and TikTok content formats',
      'Seasonal content opportunities',
      'Ways to turn current news into original video ideas',
    ],
    cta: 'Turn your next idea into content with RapidTagsAI.com.',
    research: true,
    rules: [
      'Only describe something as trending if it appears in the RESEARCH NOTES; mention the timeframe (e.g. "as of October 2026").',
      'Never invent trends, statistics, search volumes or viral results.',
      'If research notes are missing, write an evergreen idea and clearly do NOT call it trending.',
    ],
  },
  {
    id: 'seo-checker',
    name: 'Free SEO Checker & Website Traffic Checker',
    goal: 'Promote the free RapidTagsAI SEO Checker by teaching one useful website-audit idea that the tool helps with.',
    audience: 'Website owners, bloggers, small businesses and digital marketers',
    ideas: [
      'What your SEO score out of 100 means and what to fix first',
      'A 5-minute website SEO audit checklist (title, meta description, H1, canonical, robots)',
      'Core Web Vitals (LCP, CLS) explained simply and how to spot problems',
      'How to read an estimated traffic trend and top countries for your site',
      'Backlinks and domain rating basics: quality over quantity',
      'Spam score, HTTPS and other domain health signals',
      'Finding the keywords your site already ranks for (estimated) and building on them',
      'Common on-page SEO issues the audit flags, with the fix',
      'Free SEO checker vs paid tools: when a free audit is enough and when to go deeper',
      'Tool demo: audit a site in 20 seconds and act on the top 3 recommendations',
    ],
    cta: 'Run a free SEO audit at RapidTagsAI.com — no signup.',
    url: SEO_CHECKER_URL,
    keywordClusters: SEO_CHECKER_KEYWORDS,
    rules: [SEO_CHECKER_FACTS],
  },
  {
    id: 'seo-blogs',
    name: 'High-Quality SEO Blogs',
    goal: 'Attract bloggers, affiliate marketers, website owners and SEO professionals.',
    audience: 'Bloggers, affiliate marketers, website owners, SEO professionals',
    ideas: [
      'How to write SEO-friendly blog posts',
      'Blog topic research with AI',
      'Search intent and keyword placement',
      'Blog title and meta description optimization',
      'Content structure and internal linking',
      'Helpful content and topical authority',
      'Ways to improve existing articles',
      'Common blogging mistakes',
      'AI writing workflows that keep originality and accuracy',
      'A short, useful SEO tip that invites readers to explore more resources',
    ],
    cta: 'Check your blog\'s SEO free with the RapidTagsAI SEO Checker.',
    url: SEO_CHECKER_URL,
    keywordClusters: SEO_CHECKER_KEYWORDS,
    rules: ['Teach the blogging tip first; mention the free SEO Checker only as the natural next step (audit the post\'s title, meta description and headings).', SEO_CHECKER_FACTS],
  },
];

/** Weekly calendar (0 = Sunday). Days with two categories rotate between them. */
export const WEEKDAY_CATEGORIES: Record<number, string[]> = {
  1: ['instagram-tags'],
  2: ['tiktok-tags'],
  3: ['youtube-tags'],
  4: ['video-ideas'],
  5: ['youtube-descriptions', 'seo-titles'],
  6: ['trending-ideas', 'seo-blogs'],
  0: ['seo-checker'],                 // SEO Checker promotion every Sunday
};

export interface Format { id: string; name: string; how: string }

export const FORMATS: Format[] = [
  { id: 'educational-tip', name: 'Educational tip', how: 'One clear, practical tip with why it works and how to apply it.' },
  { id: 'step-by-step', name: 'Step-by-step tutorial', how: '3 short ordered steps the reader can follow today.' },
  { id: 'before-after', name: 'Before-and-after example', how: 'Show a weak example and an improved version, and explain the difference.' },
  { id: 'myth-vs-fact', name: 'Myth vs fact', how: 'State a common myth, then the accurate fact and what to do instead.' },
  { id: 'mistakes', name: 'Mistakes to avoid', how: '3 common mistakes, each with the fix.' },
  { id: 'checklist', name: 'Checklist / quick guide', how: 'A short checklist the reader can save and reuse.' },
  { id: 'tool-demo', name: 'Tool demonstration', how: 'Walk through using the matching RapidTagsAI tool for a concrete example (generic steps, no invented UI details or results).' },
  { id: 'question-challenge', name: 'Creator challenge / question', how: 'A useful mini-challenge or question that invites comments, with one helpful tip.' },
  { id: 'soft-promo', name: 'Soft promotional post', how: 'Lead with a genuine tip, then naturally introduce the matching RapidTagsAI tool.' },
];

export const BRAND_RULES = `Brand voice: helpful and practical; modern and AI-focused; friendly and professional; clear for beginners yet credible to experienced creators and marketers. Educate first, promote second.
Hard rules:
- Clear, natural English for an international audience.
- Every post has one clear purpose and delivers value before mentioning the website.
- Never promise guaranteed viral growth, rankings, traffic or views.
- No invented statistics, studies, search volumes, platform policies or results. No misleading clickbait. No generic AI filler.
- Do not describe website features that are not listed for the category.
- Avoid unrelated trending hashtags and keyword stuffing.
- Don't repeat a topic, hook, angle or visual concept used in the last 30 days.`;

export const pickById = (id: string) => CATEGORIES.find(c => c.id === id)!;
