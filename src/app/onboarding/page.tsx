'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS } from '@/lib/constants';
import { MediaCategory } from '@/types/database';
import { CategoryIcon } from '@/components/CategoryIcon';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as MediaCategory[];

interface CategoryProgress {
  category: MediaCategory;
  onboarding_complete: boolean;
  ratingsCount: number;
}

export default function OnboardingPage() {
  const [userCategories, setUserCategories] = useState<CategoryProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedNew, setSelectedNew] = useState<Set<MediaCategory>>(new Set());
  const router = useRouter();

  useEffect(() => {
    fetch('/api/onboarding/progress')
      .then((res) => res.json())
      .then((data) => {
        setUserCategories(data.categories || []);
        setLoading(false);
      });
  }, []);

  const hasCategories = userCategories.length > 0;
  const activeCategories = new Set(userCategories.map((c) => c.category));
  const availableToAdd = ALL_CATEGORIES.filter((c) => !activeCategories.has(c));

  function toggleNew(category: MediaCategory) {
    setSelectedNew((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  async function handleAddCategories() {
    if (selectedNew.size === 0) return;
    setSaving(true);

    const allCategories = [
      ...Array.from(activeCategories),
      ...Array.from(selectedNew),
    ];

    try {
      const res = await fetch('/api/categories/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: allCategories }),
      });

      if (res.ok) {
        // Refresh progress
        const progressRes = await fetch('/api/onboarding/progress');
        const data = await progressRes.json();
        setUserCategories(data.categories || []);
        setSelectedNew(new Set());
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {hasCategories ? 'Your categories' : 'What do you want recommendations for?'}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {hasCategories
            ? 'Tap a category to rate items and build your taste profile'
            : 'Choose at least one category to get started'}
        </p>
      </div>

      {/* Existing categories with progress */}
      {hasCategories && (
        <div className="space-y-3">
          {userCategories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => router.push(`/onboarding/${cat.category}`)}
              className="flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition-colors active:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:active:bg-zinc-800"
            >
              <CategoryIcon category={cat.category} className="h-7 w-7 text-zinc-500 dark:text-zinc-400" />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900 dark:text-zinc-50">
                  {CATEGORY_LABELS[cat.category]}
                </p>
                <p className="text-xs text-zinc-500">
                  {cat.ratingsCount === 0
                    ? 'Not started'
                    : `${cat.ratingsCount} rated`}
                </p>
              </div>
              {cat.ratingsCount > 0 && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  ✓
                </span>
              )}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5 text-zinc-400"
              >
                <path
                  fillRule="evenodd"
                  d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          ))}
        </div>
      )}

      {/* Add more categories */}
      {availableToAdd.length > 0 && (
        <div>
          {hasCategories && (
            <h3 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Add more categories
            </h3>
          )}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {availableToAdd.map((category) => {
              const isSelected = hasCategories
                ? selectedNew.has(category)
                : selectedNew.has(category);

              return (
                <button
                  key={category}
                  onClick={() => {
                    if (hasCategories) {
                      toggleNew(category);
                    } else {
                      toggleNew(category);
                    }
                  }}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    isSelected
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500'
                  }`}
                >
                  <CategoryIcon category={category} className={`h-5 w-5 ${isSelected ? '' : 'text-zinc-500 dark:text-zinc-400'}`} />
                  <p
                    className={`mt-1 text-xs font-medium ${
                      isSelected ? '' : 'text-zinc-900 dark:text-zinc-50'
                    }`}
                  >
                    {CATEGORY_LABELS[category]}
                  </p>
                </button>
              );
            })}
          </div>

          {selectedNew.size > 0 && (
            <button
              onClick={handleAddCategories}
              disabled={saving}
              className="mt-4 w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {saving
                ? 'Adding...'
                : `Add ${selectedNew.size} categor${selectedNew.size === 1 ? 'y' : 'ies'}`}
            </button>
          )}

          {!hasCategories && selectedNew.size === 0 && (
            <p className="mt-3 text-center text-xs text-zinc-500">
              Select at least one to continue
            </p>
          )}
        </div>
      )}

      {/* Go to dashboard */}
      {hasCategories && (
        <button
          onClick={() => router.push('/dashboard?skip_onboarding=1')}
          className="w-full rounded-lg border border-zinc-200 py-2.5 text-sm text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
        >
          Go to dashboard
        </button>
      )}
    </div>
  );
}
