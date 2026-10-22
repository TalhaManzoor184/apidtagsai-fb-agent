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

async function gemini(system: string, user: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiTextModel}:generateContent`;
  const res = await fetch(url, {
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
