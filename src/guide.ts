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
}

/**
 * Set the repo Variable SEO_CHECKER_LIVE=true once the SEO website/traffic checker is live on the site.
 * Until then posts in that category stay educational and never claim the site has a checker.
 */
const SEO_CHECKER_LIVE = process.env.SEO_CHECKER_LIVE === 'true';

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
    name: 'SEO Website Checker & SEO Traffic Checker',
    goal: 'Educational content for website owners, bloggers and digital marketers.',
    audience: 'Website owners, bloggers, digital marketers',
    ideas: [
      'Website SEO audit checklist',
      'Common on-page SEO issues',
      'How to understand website traffic',
      'Organic traffic growth strategies',
      'Keyword research basics',
      'Technical SEO mistakes',
      'How to evaluate website performance',
      'How AI can assist with SEO research',
    ],
    cta: 'Explore SEO tools and resources at RapidTagsAI.com.',
    rules: SEO_CHECKER_LIVE
      ? ['RapidTagsAI.com has an SEO website checker and SEO traffic checker; describe them only in general terms (no specific metrics or data sources).']
      : ['Do NOT claim that RapidTagsAI.com has an SEO checker, traffic checker or audit tool. Keep it purely educational; the CTA points to tools and resources in general.'],
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
    cta: 'Explore more SEO resources at RapidTagsAI.com.',
  },
];

/** Weekly calendar (0 = Sunday). Days with two categories rotate between them. */
export const WEEKDAY_CATEGORIES: Record<number, string[]> = {
  1: ['instagram-tags'],
  2: ['tiktok-tags'],
  3: ['youtube-tags'],
  4: ['video-ideas'],
  5: ['youtube-descriptions', 'seo-titles'],
  6: ['trending-ideas'],
  0: ['seo-checker', 'seo-blogs'],
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
