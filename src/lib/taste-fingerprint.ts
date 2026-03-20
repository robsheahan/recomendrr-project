import { Item, Rating } from '@/types/database';

export interface TasteFingerprint {
  narrative_complexity: 'low' | 'medium' | 'high';
  preferred_pacing: 'fast' | 'medium' | 'slow_to_medium' | 'slow';
  moral_ambiguity_tolerance: 'low' | 'medium' | 'high';
  visual_importance: 'low' | 'medium' | 'high';
  humor_styles: string[];
  emotional_register: string[];
  theme_affinities: string[];
  dealbreakers: string[];
  openness_to_foreign_language: 'low' | 'medium' | 'high';
  era_preference: string;
  preference_orientation: 'discovery' | 'reliability' | 'balanced';
  summary: string;
}

const FINGERPRINT_PROMPT = `You are a taste analyst. Given a user's media ratings, extract their taste fingerprint — the underlying preferences, sensibilities, and patterns that explain WHY they rate things the way they do.

Analyse the ratings and return a JSON object with this exact structure:
{
  "narrative_complexity": "low" | "medium" | "high",
  "preferred_pacing": "fast" | "medium" | "slow_to_medium" | "slow",
  "moral_ambiguity_tolerance": "low" | "medium" | "high",
  "visual_importance": "low" | "medium" | "high",
  "humor_styles": ["dry", "dark", "slapstick", "witty", "absurd", "satirical"],
  "emotional_register": ["joy", "melancholy", "tension", "wonder", "dread", "warmth", "nostalgia"],
  "theme_affinities": ["identity", "power", "isolation", "family", "justice", "technology", "nature", "love", "survival", "class", "redemption"],
  "dealbreakers": ["things this user clearly dislikes based on low ratings"],
  "openness_to_foreign_language": "low" | "medium" | "high",
  "era_preference": "classic" | "modern" | "contemporary" | "no_strong_preference",
  "preference_orientation": "discovery" | "reliability" | "balanced",
  "summary": "2-3 sentence natural language summary of this person's taste"
}

Rules:
- Base your analysis on the PATTERNS across ratings, not individual items
- Pay special attention to what they rated LOW — dealbreakers are as important as preferences
- The summary should read like a knowledgeable friend describing this person's taste
- Only include humor_styles, emotional_register, and theme_affinities that are clearly supported by the ratings
- Return valid JSON only, no markdown`;

export async function generateTasteFingerprint(
  ratings: (Rating & { item: Item })[],
): Promise<TasteFingerprint> {
  const ratingLines: string[] = [];

  // Group by category for context
  const byCategory = new Map<string, (Rating & { item: Item })[]>();
  for (const r of ratings) {
    const cat = r.item.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(r);
  }

  for (const [category, catRatings] of byCategory) {
    ratingLines.push(`\n[${category}]`);
    const sorted = [...catRatings].sort((a, b) => b.score - a.score);
    for (const r of sorted) {
      const genres = r.item.genres.length > 0 ? ` (${r.item.genres.join(', ')})` : '';
      const year = r.item.year ? `, ${r.item.year}` : '';
      ratingLines.push(`${r.score}/5 — ${r.item.title}${year}${genres}`);
    }
  }

  const userMessage = `Here are this user's ratings across all categories:\n${ratingLines.join('\n')}\n\nAnalyse these ratings and extract their taste fingerprint.`;

  // Use whichever LLM is available
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('No LLM API key available for fingerprint generation');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FINGERPRINT_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fingerprint generation failed: ${res.status} - ${err}`);
  }

  const data = await res.json();
  return JSON.parse(data.choices[0].message.content);
}
