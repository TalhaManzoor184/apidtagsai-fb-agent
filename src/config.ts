import 'dotenv/config';

const env = (name: string, fallback?: string) => process.env[name]?.trim() || fallback;

export function required(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  dryRun: env('DRY_RUN') === 'true',
  mockLlm: env('MOCK_LLM') === 'true',

  // Text generation
  // Auto-picks Gemini when only GEMINI_API_KEY is set; override with LLM_PROVIDER
  llmProvider: (env('LLM_PROVIDER') ?? (env('ANTHROPIC_API_KEY') ? 'anthropic' : env('GEMINI_API_KEY') ? 'gemini' : 'anthropic')) as 'anthropic' | 'gemini',
  anthropicModel: env('ANTHROPIC_MODEL', 'claude-sonnet-5-5')!,
  geminiTextModel: env('GEMINI_TEXT_MODEL', 'gemini-2.5-flash')!,

  // Image: "template" = branded card (free, consistent), "gemini" = AI background + branded overlay
  imageMode: (env('IMAGE_MODE', 'template') as 'template' | 'gemini'),
  geminiImageModel: env('GEMINI_IMAGE_MODEL', 'gemini-2.5-flash-image')!,

  // Facebook
  fbGraphVersion: env('FB_GRAPH_VERSION', 'v26.0')!,

  // Brand / content
  siteUrl: env('SITE_URL', 'https://rapidtagsai.com')!,
  brandName: env('BRAND_NAME', 'RapidTagsAI')!,
  language: env('POST_LANGUAGE', 'English')!, // e.g. "English" or "Roman Urdu mixed with English"

  historyFile: 'data/history.json',
  outDir: 'out',
};
