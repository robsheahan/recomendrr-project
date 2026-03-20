import { TasteProfile, formatTasteProfileForLLM } from './taste-profile';

interface LLMRecommendation {
  title: string;
  year: number;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface LLMResponse {
  recommendations: LLMRecommendation[];
  model: string;
}

const SYSTEM_PROMPT = `You are a media recommendation engine. You analyse a user's taste profile and recommend items they are likely to enjoy. You must return exactly 3 recommendations with reasoning.

Rules:
- Only recommend items that actually exist and are real, verifiable titles
- Only recommend well-regarded items — they should be critically acclaimed or highly rated by audiences (e.g. 6+/10 on IMDB, 60%+ on Rotten Tomatoes). Never recommend items widely considered to be bad
- If the user specifies a genre preference, ALL 3 recommendations must fit that genre. This is non-negotiable
- Never recommend items from the "previously recommended" or "not interested" lists
- Tie your reasoning to specific items in the user's profile
- Vary your recommendations — mix well-known and lesser-known titles, different eras and sub-genres
- Return valid JSON only, no markdown formatting`;

export async function generateRecommendations(
  profile: TasteProfile,
  tier: 'free' | 'paid'
): Promise<LLMResponse> {
  const userMessage = formatTasteProfileForLLM(profile);

  if (tier === 'paid' && process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(userMessage);
  }

  return generateWithOpenAI(userMessage, tier);
}

async function generateWithOpenAI(
  userMessage: string,
  tier: 'free' | 'paid'
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const model = tier === 'paid' ? 'gpt-4o' : 'gpt-4o-mini';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.8,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  const parsed = JSON.parse(content);

  return {
    recommendations: parsed.recommendations,
    model,
  };
}

async function generateWithClaude(userMessage: string): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const model = 'claude-sonnet-4-20250514';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text;

  // Extract JSON from response (Claude may wrap in markdown)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse Claude response as JSON');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    recommendations: parsed.recommendations,
    model,
  };
}
