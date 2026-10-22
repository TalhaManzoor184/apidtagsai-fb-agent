import { config, required } from './config.js';

/** Sends a prompt to the configured LLM and returns raw text (expected to be JSON). */
export async function complete(system: string, user: string): Promise<string> {
  return config.llmProvider === 'gemini' ? gemini(system, user) : anthropic(system, user);
}

async function anthropic(system: string, user: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': required('ANTHROPIC_API_KEY'),
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: config.anthropicModel,
      max_tokens: 2000,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json.content?.find((c: any) => c.type === 'text')?.text ?? '';
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
let geminiCandidates: string[] | undefined;
let geminiIndex = 0;

/** Configured model first, then other text "flash" models this key can use (newest first). */
async function loadGeminiCandidates(): Promise<string[]> {
  const list = [config.geminiTextModel];
  try {
    const res = await fetch(`${GEMINI_BASE}/models?pageSize=200`, {
      headers: { 'x-goog-api-key': required('GEMINI_API_KEY') },
    });
    const json: any = await res.json();
    const names: string[] = (json.models ?? [])
      .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: any) => String(m.name).replace(/^models\//, ''))
      .filter((n: string) => /^gemini-[\d.]+-flash/.test(n) && !/(image|tts|audio|live|embedding|preview|exp)/.test(n))
      .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
    for (const n of names) if (!list.includes(n)) list.push(n);
  } catch (e) {
    console.warn(`Could not list Gemini models: ${(e as Error).message}`);
  }
  console.log(`Gemini models to try: ${list.slice(0, 6).join(', ')}`);
  return list;
}

async function gemini(system: string, user: string): Promise<string> {
  geminiCandidates ??= await loadGeminiCandidates();
  const model = geminiCandidates[geminiIndex % geminiCandidates.length];
  try {
    return await geminiCall(model, system, user);
  } catch (e) {
    // Busy / unavailable / rate-limited / retired model → next attempt uses the next model
    if (/Gemini (404|429|500|503)/.test((e as Error).message)) geminiIndex++;
    throw e;
  }
}

async function geminiCall(model: string, system: string, user: string): Promise<string> {
  console.log(`Gemini model: ${model}`);
  const res = await fetch(`${GEMINI_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': required('GEMINI_API_KEY'), 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.9 },
    }),
  });
  const json: any = await res.json();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json.error ?? json)}`);
  return json.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('') ?? '';
}
