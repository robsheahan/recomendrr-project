'use client';

import { useState, useEffect } from 'react';
import { CATEGORY_LABELS } from '@/lib/constants';
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

const CATEGORY_INTENTS: Record<string, { label: string; value: string }[]> = {
  movies: [
    { label: 'Surprise me', value: 'Surprise me with something unexpected — a film I wouldn\'t normally come across but would love based on my taste' },
    { label: 'Safe pick', value: 'A well-known, crowd-pleasing film I\'m very likely to enjoy — popular and broadly loved' },
    { label: 'Classic', value: 'A classic, iconic film that has stood the test of time — a must-watch from any era' },
    { label: 'New', value: 'Something recently released — a great film from the last 1-2 years' },
  ],
  tv_shows: [
    { label: 'Surprise me', value: 'Surprise me with a show I wouldn\'t normally come across but would love based on my taste' },
    { label: 'Safe pick', value: 'A well-known, binge-worthy show I\'m very likely to enjoy — popular and broadly loved' },
    { label: 'Classic', value: 'A classic, iconic TV show that is widely considered one of the best ever made' },
    { label: 'New', value: 'Something recently released — a great show from the last 1-2 years' },
  ],
  documentaries: [
    { label: 'Surprise me', value: 'Surprise me with a documentary on a topic I wouldn\'t normally explore but would find fascinating' },
    { label: 'Safe pick', value: 'A well-known, highly rated documentary I\'m very likely to enjoy' },
    { label: 'Classic', value: 'A landmark documentary that is widely considered essential viewing' },
    { label: 'New', value: 'A great documentary released in the last 1-2 years' },
  ],
  fiction_books: [
    { label: 'Surprise me', value: 'Surprise me with a novel I wouldn\'t normally pick up but would love based on my taste' },
    { label: 'Safe pick', value: 'A widely loved, bestselling novel I\'m very likely to enjoy' },
    { label: 'Classic', value: 'A classic, essential work of fiction that has stood the test of time' },
    { label: 'New', value: 'A great novel published in the last 1-2 years' },
  ],
  nonfiction_books: [
    { label: 'Surprise me', value: 'Surprise me with a non-fiction book on a topic I wouldn\'t normally explore but would find fascinating' },
    { label: 'Safe pick', value: 'A widely loved, bestselling non-fiction book I\'m very likely to enjoy' },
    { label: 'Classic', value: 'A classic, essential non-fiction book that is widely considered a must-read' },
    { label: 'New', value: 'A great non-fiction book published in the last 1-2 years' },
  ],
  podcasts: [
    { label: 'Surprise me', value: 'Surprise me with a podcast I wouldn\'t normally discover but would love based on my interests' },
    { label: 'Safe pick', value: 'A hugely popular, well-known podcast I\'m very likely to enjoy' },
    { label: 'Classic', value: 'A podcast that is widely considered one of the best and most iconic of all time' },
    { label: 'New', value: 'A great podcast that has launched or had a standout season in the last 1-2 years' },
  ],
  music_artists: [
    { label: 'Surprise me', value: 'Surprise me with an artist I wouldn\'t normally listen to but would love based on my taste' },
    { label: 'Safe pick', value: 'A hugely popular, well-known artist I\'m very likely to enjoy' },
    { label: 'Classic', value: 'A legendary, iconic artist who is widely considered one of the greatest of all time' },
    { label: 'New', value: 'An exciting artist who has emerged or had a breakthrough in the last 1-2 years' },
  ],
};

const DEFAULT_INTENTS = [
  { label: 'Surprise me', value: 'Surprise me with something unexpected I wouldn\'t normally come across' },
  { label: 'Safe pick', value: 'Something well-known and broadly loved I\'m very likely to enjoy' },
  { label: 'Classic', value: 'A classic that has stood the test of time — widely considered essential' },
  { label: 'New', value: 'Something great from the last 1-2 years' },
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
        const availableCategories = (data.categories || []).filter(
          (c: UserCategory & { ratingsCount: number }) =>
            c.onboarding_complete || c.ratingsCount > 0
        );
        setCategories(availableCategories);
        if (availableCategories.length > 0) {
          // Restore last used category from localStorage
          const lastCategory = localStorage.getItem('recommendr_last_category');
          const match = availableCategories.find(
            (c: UserCategory) => c.category === lastCategory
          );
          setSelectedCategory(match ? match.category : availableCategories[0].category);
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
    setSelectedIntent('');
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

    // Remember last used category
    localStorage.setItem('recommendr_last_category', selectedCategory);

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
            className="w-full appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%239ca3af%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.22%208.22a.75.75%200%200%201%201.06%200L10%2011.94l3.72-3.72a.75.75%200%201%201%201.06%201.06l-4.25%204.25a.75.75%200%200%201-1.06%200L5.22%209.28a.75.75%200%200%201%200-1.06Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat px-3 py-2.5 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {categories.map((c) => (
              <option key={c.category} value={c.category}>
                {CATEGORY_LABELS[c.category]}
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
            className="w-full appearance-none rounded-lg border border-zinc-300 bg-white bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%239ca3af%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.22%208.22a.75.75%200%200%201%201.06%200L10%2011.94l3.72-3.72a.75.75%200%201%201%201.06%201.06l-4.25%204.25a.75.75%200%200%201-1.06%200L5.22%209.28a.75.75%200%200%201%200-1.06Z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:20px] bg-[right_8px_center] bg-no-repeat px-3 py-2.5 pr-10 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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
        <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          What are you in the mood for?
        </label>

        <div className="flex flex-wrap gap-2">
          {(selectedCategory
            ? CATEGORY_INTENTS[selectedCategory] || DEFAULT_INTENTS
            : DEFAULT_INTENTS
          ).map((qi) => (
            <button
              key={qi.label}
              onClick={() => {
                setIntentMode('quick');
                setSelectedIntent(selectedIntent === qi.value ? '' : qi.value);
              }}
              className={`rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
                intentMode === 'quick' && selectedIntent === qi.value
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}
            >
              {qi.label}
            </button>
          ))}
          <button
            onClick={() => {
              setIntentMode('custom');
              setSelectedIntent('');
            }}
            className={`rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
              intentMode === 'custom'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            Custom
          </button>
        </div>

        {intentMode === 'custom' && (
          <textarea
            value={customIntent}
            onChange={(e) => setCustomIntent(e.target.value)}
            placeholder="Describe what you're looking for..."
            rows={2}
            autoFocus
            className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
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

          {/* Get more + Refine */}
          <div className="space-y-3">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Get more recommendations
            </button>

            <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Want something different?
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refinementText}
                  onChange={(e) => setRefinementText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                  placeholder='e.g. "Something more mainstream" or "Less serious, more fun"'
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                <button
                  onClick={handleRefine}
                  disabled={loading || !refinementText.trim()}
                  className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Go
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
