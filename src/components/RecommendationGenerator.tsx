'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
    external_id?: string;
    external_source?: string;
    metadata: Record<string, unknown> | null;
  };
}

interface SeedItem {
  title: string;
  category: string;
  creator?: string;
  genres?: string[];
  year?: number;
  description?: string;
}

interface DrilldownEntry {
  seedItem: SeedItem | null;
  targetCategory: string;
  recommendations: RecommendationItem[];
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
  books: [
    { label: 'Surprise me', value: 'Surprise me with a book I wouldn\'t normally pick up but would love based on my taste' },
    { label: 'Safe pick', value: 'A widely loved, bestselling book I\'m very likely to enjoy' },
    { label: 'Classic', value: 'A classic, essential book that has stood the test of time — fiction or non-fiction' },
    { label: 'New', value: 'A great book published in the last 1-2 years' },
  ],
  podcasts: [
    { label: 'Surprise me', value: 'Surprise me with a podcast I wouldn\'t normally discover but would love based on my interests. It should still be reasonably well-known.' },
    { label: 'Safe pick', value: 'ONLY recommend massively popular, mainstream, chart-topping podcasts that most people have heard of. Think Joe Rogan, Serial, This American Life, Radiolab, Freakonomics, Crime Junkie, Huberman Lab, SmartLess, Conan O\'Brien, Armchair Expert level of fame. Do NOT recommend anything niche or obscure.' },
    { label: 'Classic', value: 'A podcast that is widely considered one of the best and most iconic of all time — something almost everyone has heard of' },
    { label: 'New', value: 'A popular, well-known podcast that has launched or had a standout season in the last 1-2 years' },
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
  const searchParams = useSearchParams();
  const router = useRouter();
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
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [hasFingerprint, setHasFingerprint] = useState(false);
  const [generatingFingerprint, setGeneratingFingerprint] = useState(false);
  const [seedItem, setSeedItem] = useState<SeedItem | null>(null);
  const [drilldownStack, setDrilldownStack] = useState<DrilldownEntry[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

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
          const lastCategory = localStorage.getItem('recommnder_last_category');
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

    // Pending recommendations removed — only show when user explicitly requests
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

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setGeneratingFingerprint(false);
  }

  async function handleGenerate() {
    if (!selectedCategory) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setRecommendations([]);
    setSessionId(null);
    setDismissedIds(new Set());

    // Remember last used category
    localStorage.setItem('recommnder_last_category', selectedCategory);

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
        signal: controller.signal,
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefine() {
    if (!refinementText.trim() || !sessionId || !selectedCategory) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        signal: controller.signal,
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
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

    if (res.ok) {
      // All actions eventually dismiss the card
      setDismissedIds((prev) => new Set(prev).add(id));
    }
  }

  const generateSimilar = useCallback(async (seed: SeedItem, targetCategory: string) => {
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);
    setRecommendations([]);
    setDismissedIds(new Set());
    setSessionId(null);

    await ensureFingerprint();

    try {
      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: targetCategory,
          seedItem: seed,
        }),
        signal: controller.signal,
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
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFingerprint]);

  function handleFindSimilar(item: RecommendationItem['item'], targetCategory?: string) {
    // Push current state to drilldown stack
    if (recommendations.length > 0) {
      setDrilldownStack((prev) => [
        ...prev.slice(-9), // cap at 10 levels
        {
          seedItem,
          targetCategory: selectedCategory || '',
          recommendations,
        },
      ]);
    }

    const seed: SeedItem = {
      title: item.title,
      category: item.category,
      creator: item.creator || undefined,
      genres: item.genres,
      year: item.year || undefined,
      description: item.description || undefined,
    };
    const target = (targetCategory || item.category) as MediaCategory;

    setSeedItem(seed);
    setSelectedCategory(target);
    generateSimilar(seed, target);
  }

  function handleDrilldownBack(index: number) {
    const entry = drilldownStack[index];
    setSeedItem(entry.seedItem);
    setSelectedCategory(entry.targetCategory as MediaCategory);
    setRecommendations(entry.recommendations);
    setDismissedIds(new Set());
    setDrilldownStack((prev) => prev.slice(0, index));
  }

  function clearSeedMode() {
    setSeedItem(null);
    setDrilldownStack([]);
    setRecommendations([]);
    setDismissedIds(new Set());
  }

  // Handle incoming URL params (from ratings/saved/history pages)
  useEffect(() => {
    const seedTitle = searchParams.get('seedTitle');
    const seedCategory = searchParams.get('seedCategory');
    const targetCategory = searchParams.get('targetCategory');

    if (seedTitle && seedCategory) {
      const seed: SeedItem = {
        title: seedTitle,
        category: seedCategory,
        creator: searchParams.get('seedCreator') || undefined,
        genres: searchParams.get('seedGenres')?.split(',').filter(Boolean) || undefined,
        year: searchParams.get('seedYear') ? Number(searchParams.get('seedYear')) : undefined,
      };
      const target = (targetCategory || seedCategory) as MediaCategory;

      setSeedItem(seed);
      setSelectedCategory(target);

      // Clear URL params
      router.replace('/dashboard');

      // Wait for categories to load before generating
      const timer = setTimeout(() => {
        generateSimilar(seed, target);
      }, 500);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {!seedItem && (
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
      )}

      {/* Seed mode banner + breadcrumbs */}
      {seedItem && (
        <div className="space-y-2">
          {drilldownStack.length > 0 && (
            <div className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
              <button
                onClick={clearSeedMode}
                className="hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Dashboard
              </button>
              {drilldownStack.map((entry, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-zinc-300 dark:text-zinc-600">/</span>
                  <button
                    onClick={() => handleDrilldownBack(i)}
                    className="hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    {entry.seedItem ? `Similar to "${entry.seedItem.title}"` : 'Recommendations'}
                  </button>
                </span>
              ))}
              <span className="text-zinc-300 dark:text-zinc-600">/</span>
              <span className="text-zinc-700 dark:text-zinc-300">
                Similar to &ldquo;{seedItem.title}&rdquo;
              </span>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 dark:border-indigo-900 dark:bg-indigo-950/50">
            <p className="text-sm text-indigo-700 dark:text-indigo-400">
              Showing {CATEGORY_LABELS[selectedCategory as MediaCategory] || selectedCategory} similar to <span className="font-medium">&ldquo;{seedItem.title}&rdquo;</span>
              {seedItem.category !== selectedCategory && (
                <span className="text-indigo-500"> ({CATEGORY_LABELS[seedItem.category as MediaCategory] || seedItem.category})</span>
              )}
            </p>
            <button
              onClick={clearSeedMode}
              className="ml-3 rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100 dark:text-indigo-400 dark:hover:bg-indigo-900/50"
            >
              Clear
            </button>
          </div>
        </div>
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
              {seedItem
                ? `Finding items similar to "${seedItem.title}"...`
                : 'Finding the perfect recommendations...'}
            </p>
            <button
              onClick={handleCancel}
              className="mt-3 rounded-lg px-4 py-1.5 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (() => {
        const allDismissed = recommendations.every((r) => dismissedIds.has(r.id));
        return (
        <div className="space-y-4">
          {!seedItem && (
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Recommended for you
            </h3>
          )}
          {recommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onAction={handleAction}
              onFindSimilar={handleFindSimilar}
            />
          ))}

          {/* Refine — only show when cards are still visible */}
          {!allDismissed && (
            <div className="space-y-3">
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
          )}
        </div>
        );
      })()}
    </div>
  );
}
