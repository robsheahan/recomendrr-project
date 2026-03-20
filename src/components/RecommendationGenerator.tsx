'use client';

import { useState, useEffect } from 'react';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/lib/constants';
import { MediaCategory } from '@/types/database';
import { RecommendationCard } from './RecommendationCard';

interface UserCategory {
  category: MediaCategory;
  onboarding_complete: boolean;
}

interface RecommendationItem {
  id: string;
  status: string;
  reason: string | null;
  confidence?: string;
  feedback?: string | null;
  item: {
    id: string;
    title: string;
    creator: string | null;
    description: string | null;
    genres: string[];
    year: number | null;
    image_url: string | null;
    category: string;
    metadata: { tmdb_rating?: number; tmdb_vote_count?: number } | null;
  };
}

const QUICK_INTENTS = [
  { label: 'Surprise me', value: 'Surprise me with something I would never find on my own — obscure, hidden gem, non-obvious pick' },
  { label: 'Safe pick', value: 'Something safe and reliable I will almost certainly enjoy — well-known and broadly loved' },
  { label: 'Feel-good', value: 'Something uplifting, warm, and feel-good — I want to feel happy after watching' },
  { label: 'Mind-bending', value: 'Something cerebral and mind-bending that will make me think — complex plot or philosophical themes' },
  { label: 'Edge of my seat', value: 'Something tense and gripping — I want to be on the edge of my seat the whole time' },
  { label: 'Emotional gut-punch', value: 'Something deeply emotional that will genuinely move me — I want to feel something profound' },
];

export function RecommendationGenerator() {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<string>('');
  const [intentMode, setIntentMode] = useState<'quick' | 'custom'>('quick');
  const [selectedIntent, setSelectedIntent] = useState<string>('');
  const [customIntent, setCustomIntent] = useState<string>('');
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsUsed, setRequestsUsed] = useState<number | null>(null);
  const [requestsLimit, setRequestsLimit] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [refinementText, setRefinementText] = useState('');
  const [hasFingerprint, setHasFingerprint] = useState(false);
  const [generatingFingerprint, setGeneratingFingerprint] = useState(false);

  useEffect(() => {
    fetch('/api/onboarding/progress')
      .then((res) => res.json())
      .then((data) => {
        const completedCategories = (data.categories || []).filter(
          (c: UserCategory & { ratingsCount: number }) => c.onboarding_complete
        );
        setCategories(completedCategories);
        if (completedCategories.length > 0) {
          setSelectedCategory(completedCategories[0].category);
        }
      });

    // Check if fingerprint exists
    fetch('/api/taste-fingerprint')
      .then((res) => res.json())
      .then((data) => {
        setHasFingerprint(!!data.fingerprint);
      });
  }, []);

  // Fetch genres when category changes
  useEffect(() => {
    if (!selectedCategory) return;
    setSelectedGenre('');
    fetch(`/api/genres?category=${selectedCategory}`)
      .then((res) => res.json())
      .then((data) => setGenres(data.genres || []))
      .catch(() => setGenres([]));
  }, [selectedCategory]);

  async function ensureFingerprint() {
    if (hasFingerprint) return;
    setGeneratingFingerprint(true);
    try {
      const res = await fetch('/api/taste-fingerprint', { method: 'POST' });
      if (res.ok) {
        setHasFingerprint(true);
      }
    } catch {
      // Continue without fingerprint
    } finally {
      setGeneratingFingerprint(false);
    }
  }

  async function handleGenerate() {
    if (!selectedCategory) return;
    setLoading(true);
    setError(null);
    setRecommendations([]);
    setSessionId(null);

    // Generate fingerprint on first use
    await ensureFingerprint();

    const intent =
      intentMode === 'custom'
        ? customIntent
        : selectedIntent;

    try {
      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          genre: selectedGenre || null,
          intent: intent || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      setRecommendations(data.recommendations);
      setRequestsUsed(data.requestsUsed);
      setRequestsLimit(data.requestsLimit);
      setSessionId(data.sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!refinementText.trim() || !sessionId || !selectedCategory) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: selectedCategory,
          genre: selectedGenre || null,
          refinement: refinementText,
          sessionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to refine recommendations');
      }

      setRecommendations(data.recommendations);
      setRequestsUsed(data.requestsUsed);
      setRequestsLimit(data.requestsLimit);
      setRefinementText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(id: string, status: string, score?: number) {
    const res = await fetch(`/api/recommendations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, score }),
    });

    if (res.ok && status === 'saved') {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'saved' } : r))
      );
    }
  }

  async function handleFeedback(id: string, feedback: 'good' | 'bad') {
    await fetch('/api/recommendations/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recommendationId: id, feedback }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Category + Genre */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Category
          </label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value as MediaCategory)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {CATEGORY_ICONS[c.category]} {CATEGORY_LABELS[c.category]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Genre
            <span className="ml-1 font-normal text-zinc-400">(optional)</span>
          </label>
          <select
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Any genre</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Intent / Mood */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            What are you in the mood for?
          </label>
          <button
            onClick={() => setIntentMode(intentMode === 'quick' ? 'custom' : 'quick')}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            {intentMode === 'quick' ? 'Or describe it yourself' : 'Quick select'}
          </button>
        </div>

        {intentMode === 'quick' ? (
          <div className="flex flex-wrap gap-2">
            {QUICK_INTENTS.map((qi) => (
              <button
                key={qi.label}
                onClick={() =>
                  setSelectedIntent(selectedIntent === qi.value ? '' : qi.value)
                }
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedIntent === qi.value
                    ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                }`}
              >
                {qi.label}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            value={customIntent}
            onChange={(e) => setCustomIntent(e.target.value)}
            placeholder="e.g. &quot;I just finished an intense thriller and want something gentle and beautiful to reset&quot; or &quot;Something to watch with my partner who hates horror but loves suspense&quot;"
            rows={2}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        )}
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={loading || !selectedCategory}
        className="w-full rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading
          ? generatingFingerprint
            ? 'Analysing your taste profile...'
            : 'Finding recommendations...'
          : 'Get Recommendations'}
      </button>

      {/* Quota display */}
      {requestsUsed !== null && requestsLimit !== null && (
        <p className="text-xs text-zinc-500">
          {requestsUsed} / {requestsLimit} requests used this month
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && !generatingFingerprint && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
            <p className="text-sm text-zinc-500">
              Finding the perfect recommendations...
            </p>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
            Recommended for you
          </h3>
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onAction={handleAction}
              onFeedback={handleFeedback}
            />
          ))}

          {/* Conversational refinement */}
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Want to refine?
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={refinementText}
                onChange={(e) => setRefinementText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                placeholder='e.g. "More like #2 but darker" or "Something less mainstream"'
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
              />
              <button
                onClick={handleRefine}
                disabled={loading || !refinementText.trim()}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Refine
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
