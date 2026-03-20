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

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SYSTEM_PROMPT = `You are an elite media recommendation concierge. You don't just suggest popular items — you deeply understand each user's taste fingerprint and find things they would never discover on their own.

RECOMMENDATION STRATEGY:
- One recommendation should be a high-confidence pick the user will almost certainly enjoy
- One should be an interesting stretch — something adjacent to their taste that broadens their horizons
- One should be a hidden gem — something with fewer than 50,000 TMDB votes, a foreign-language work, an older classic, or an indie release they likely haven't encountered
- NEVER recommend items from the current IMDB Top 250 or mainstream streaming "Top 10" lists unless they are genuinely the best match for this specific user's taste fingerprint
- Only recommend well-regarded items — 6+/10 on IMDB or equivalent quality
- If the user specifies a genre, ALL 3 recommendations must fit that genre. Non-negotiable
- If the user provides a current intent or mood, prioritise that over general taste matching

EXPLANATION QUALITY:
- Your explanations are the product. They must be specific and insightful
- Reference specific items from the user's profile and explain the CONNECTION at the level of themes, tone, pacing, or emotional register — not just genre
- Explain what makes this recommendation non-obvious — why the user might not find it on their own
- Each explanation should be 2-3 sentences that teach the user something about their own taste
- Never say "because you liked X" without explaining WHY the connection exists

LEARNING FROM FEEDBACK:
- If the user has PREVIOUS MISSES listed, analyse what went wrong and avoid repeating the same patterns
- Bad recommendation feedback means the system fundamentally misread the user's intent — adjust accordingly

Return valid JSON only, no markdown formatting.`;

export async function generateRecommendations(
  profile: TasteProfile,
  tier: 'free' | 'paid',
  conversationHistory: ConversationMessage[] = []
): Promise<LLMResponse> {
  const userMessage = formatTasteProfileForLLM(profile);

  if (tier === 'paid' && process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(userMessage, conversationHistory);
  }

  return generateWithOpenAI(userMessage, tier, conversationHistory);
}

export async function generateRefinement(
  refinementText: string,
  previousRecommendations: string,
  conversationHistory: ConversationMessage[],
  tier: 'free' | 'paid'
): Promise<LLMResponse> {
  const userMessage = `The user has seen your previous recommendations and wants to refine:

PREVIOUS RECOMMENDATIONS:
${previousRecommendations}

USER'S REFINEMENT REQUEST: "${refinementText}"

Based on this feedback, provide 3 new recommendations that address their request. Keep the same JSON format.`;

  const messages: ConversationMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  if (tier === 'paid' && process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(userMessage, messages);
  }
  return generateWithOpenAI(userMessage, tier, messages);
}

async function generateWithOpenAI(
  userMessage: string,
  tier: 'free' | 'paid',
  conversationHistory: ConversationMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const model = tier === 'paid' ? 'gpt-4o' : 'gpt-4o-mini';

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
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

async function generateWithClaude(
  userMessage: string,
  conversationHistory: ConversationMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

  const model = 'claude-sonnet-4-20250514';

  const messages = [
    ...conversationHistory.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const text = data.content[0].text;

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
