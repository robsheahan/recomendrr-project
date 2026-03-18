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
  item: {
    id: string;
    title: string;
    creator: string | null;
    description: string | null;
    genres: string[];
    year: number | null;
    image_url: string | null;
    category: string;
  };
}

export function RecommendationGenerator() {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MediaCategory | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestsUsed, setRequestsUsed] = useState<number | null>(null);
  const [requestsLimit, setRequestsLimit] = useState<number | null>(null);

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
  }, []);

  async function handleGenerate() {
    if (!selectedCategory) return;
    setLoading(true);
    setError(null);
    setRecommendations([]);

    try {
      const res = await fetch('/api/recommendations/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate recommendations');
      }

      setRecommendations(data.recommendations);
      setRequestsUsed(data.requestsUsed);
      setRequestsLimit(data.requestsLimit);
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

    if (!res.ok) {
      console.error('Failed to update recommendation');
    }

    if (status === 'saved') {
      setRecommendations((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: 'saved' } : r))
      );
    }
  }

  return (
    <div className="space-y-6">
      {/* Category selector + generate button */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
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

        <button
          onClick={handleGenerate}
          disabled={loading || !selectedCategory}
          className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? 'Generating...' : 'Get Recommendations'}
        </button>
      </div>

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
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-50" />
            <p className="text-sm text-zinc-500">
              Analysing your taste profile...
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
