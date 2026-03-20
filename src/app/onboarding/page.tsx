'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS, CATEGORY_ICONS } from '@/lib/constants';
import { MediaCategory } from '@/types/database';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as MediaCategory[];

const AVAILABLE_CATEGORIES: MediaCategory[] = [
  'movies',
  'tv_shows',
  'documentaries',
  'fiction_books',
  'nonfiction_books',
  'podcasts',
  'music_artists',
];

export default function OnboardingCategoriesPage() {
  const [selected, setSelected] = useState<Set<MediaCategory>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function toggle(category: MediaCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  async function handleContinue() {
    if (selected.size === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/categories/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: Array.from(selected) }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save categories');
      }

      // Navigate to first selected category's onboarding
      const firstCategory = AVAILABLE_CATEGORIES.find((c) => selected.has(c));
      if (firstCategory) {
        router.push(`/onboarding/${firstCategory}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          What do you want recommendations for?
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Select at least one category. You can always add more later.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ALL_CATEGORIES.map((category) => {
          const isAvailable = AVAILABLE_CATEGORIES.includes(category);
          const isSelected = selected.has(category);

          return (
            <button
              key={category}
              onClick={() => isAvailable && toggle(category)}
              disabled={!isAvailable}
              className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                  : isAvailable
                    ? 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500'
                    : 'cursor-not-allowed border-zinc-100 bg-zinc-50 opacity-50 dark:border-zinc-800 dark:bg-zinc-900/50'
              }`}
            >
              <span className="text-2xl">{CATEGORY_ICONS[category]}</span>
              <p
                className={`mt-2 text-sm font-medium ${
                  isSelected
                    ? ''
                    : 'text-zinc-900 dark:text-zinc-50'
                }`}
              >
                {CATEGORY_LABELS[category]}
              </p>
              {!isAvailable && (
                <span className="mt-1 block text-xs text-zinc-400">
                  Coming soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <button
        onClick={handleContinue}
        disabled={selected.size === 0 || loading}
        className="w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {loading ? 'Saving...' : `Continue with ${selected.size} categor${selected.size === 1 ? 'y' : 'ies'}`}
      </button>
    </div>
  );
}
