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

const SYSTEM_PROMPT = `You are an elite media recommendation concierge. You deeply understand each user's taste and recommend things they will genuinely enjoy.

RECOMMENDATION STRATEGY:
- Recommend well-known, widely loved items that match the user's taste profile. These should be titles most people have heard of — popular, acclaimed, mainstream hits
- All recommendations should be things the user is likely to enjoy. Prioritise quality and relevance over obscurity
- STRONGLY prioritise highly rated items — 7.5+/10 on IMDB and 80%+ on Rotten Tomatoes. Higher rated items should be recommended before lower rated ones. A film with IMDB 8.5 is a much stronger candidate than one with 6.5
- Never recommend items below 6.0/10 on IMDB unless the user specifically asks for niche content
- If the user specifies a genre, ALL recommendations must fit that genre. Non-negotiable
- If the user provides a current intent or mood, prioritise that over general taste matching
- Only push toward obscure or hidden gem picks if the user EXPLICITLY asks to be surprised or to discover something new
- CRITICAL: Never recommend items listed under "PREVIOUSLY RECOMMENDED (exclude)" — choose DIFFERENT items every time
- Pay close attention to CREATOR AFFINITIES — if the user loves a director/author, prioritise their other work. If they dislike a creator, avoid them entirely
- If COLLABORATIVE SIGNALS are provided, seriously consider those items — they are loved by users with verified similar taste

CATEGORY-SPECIFIC RULES:
- PODCASTS: Lean HEAVILY toward well-known, popular podcasts with large audiences. For "Safe pick", ONLY recommend podcasts that are household names or chart-toppers (Joe Rogan, Serial, This American Life, Radiolab, Freakonomics, etc). Most people have not heard of niche podcasts — err strongly toward mainstream popularity
- MUSIC: Prioritise well-known artists. For "Safe pick", recommend artists most people would recognise
- BOOKS: Prioritise bestsellers and award winners. For "Safe pick", recommend books that have been widely read and discussed

EXPLANATION QUALITY:
- Your explanations are the product. They must be specific and insightful
- Reference specific items from the user's profile and explain the CONNECTION at the level of themes, tone, pacing, or emotional register — not just genre
- Each explanation should be 2-3 sentences that teach the user something about their own taste
- Never say "because you liked X" without explaining WHY the connection exists

LEARNING FROM FEEDBACK:
- If the user has MISS PATTERNS listed, analyse what went wrong and avoid repeating the same patterns
- Bad recommendation feedback means the system fundamentally misread the user's intent — adjust accordingly

Return valid JSON only, no markdown formatting.`;

const ANALYSIS_PROMPT = `You are a taste analyst. Given a user's detailed ratings and taste profile, write a focused recommendation strategy.

Analyse the ratings deeply — look for:
- What SPECIFIC qualities connect their highest-rated items (not just genre — tone, pacing, themes, character types, narrative structure)
- What SPECIFIC qualities connect their lowest-rated items
- Any creator patterns (directors/authors they consistently love or hate)
- The gap between what they "like" (3-4 stars) and what they "love" (5 stars)
- What would make them say "this is EXACTLY what I was looking for"

Write a 3-4 sentence strategy that a recommendation engine should follow for this specific person. Be concrete, not abstract. Instead of "likes complex narratives" say "loves unreliable narrators and time-jumping storylines, but only when the emotional payoff justifies the complexity."

Return as JSON: {"strategy": "your strategy here"}`;

export async function generateRecommendations(
  profile: TasteProfile,
  tier: 'free' | 'paid',
  conversationHistory: ConversationMessage[] = []
): Promise<LLMResponse> {
  const userMessage = formatTasteProfileForLLM(profile);

  if (tier === 'paid' && process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(userMessage, conversationHistory);
  }

  // Two-step generation: analyse first, then recommend
  return generateWithOpenAITwoStep(userMessage, conversationHistory);
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

Based on this feedback, provide 12 new recommendations that address their request. Keep the same JSON format.`;

  const messages: ConversationMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  if (tier === 'paid' && process.env.ANTHROPIC_API_KEY) {
    return generateWithClaude(userMessage, messages);
  }
  return generateWithOpenAI(userMessage, messages);
}

// Two-step: first analyse taste deeply, then recommend based on analysis
async function generateWithOpenAITwoStep(
  userMessage: string,
  conversationHistory: ConversationMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  // Step 1: Deep analysis with gpt-4o
  const analysisRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: ANALYSIS_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  });

  let strategy = '';
  if (analysisRes.ok) {
    const analysisData = await analysisRes.json();
    const parsed = JSON.parse(analysisData.choices[0].message.content);
    strategy = parsed.strategy || '';
  }

  // Step 2: Generate recommendations using analysis + full profile
  const enhancedMessage = strategy
    ? `RECOMMENDATION STRATEGY FOR THIS USER:\n${strategy}\n\n${userMessage}`
    : userMessage;

  return generateWithOpenAI(enhancedMessage, conversationHistory);
}

async function generateWithOpenAI(
  userMessage: string,
  conversationHistory: ConversationMessage[] = []
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

  const model = 'gpt-4o';

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
      max_tokens: 2000,
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
