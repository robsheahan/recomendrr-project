'use client';

import { useState, useEffect } from 'react';
import { RecommendationCard } from '@/components/RecommendationCard';
import { CATEGORY_LABELS } from '@/lib/constants';
import { CategoryIcon } from '@/components/CategoryIcon';

interface SavedItem {
  id: string;
  status: string;
  reason: string | null;
  item: {
    id: string;
    title: string;
    creator: string | null;
    description: string | null;
    genres: string[];
    year: number | null;
    image_url: string | null;
    category: string;
    metadata: Record<string, unknown> | null;
  };
}

const CATEGORY_MAP: Record<string, string> = {
  fiction_books: 'books',
  nonfiction_books: 'books',
  documentaries: 'movies',
};

const CATEGORY_ORDER = ['movies', 'tv_shows', 'books', 'podcasts', 'music_artists'];

export default function SavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/recommendations/saved')
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      });
  }, []);

  async function handleAction(id: string, status: string, score?: number) {
    const res = await fetch(`/api/recommendations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, score }),
    });

    if (res.ok) {
      if (status !== 'saved') {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  // Group items by mapped category
  const grouped: Record<string, SavedItem[]> = {};
  for (const item of items) {
    const cat = CATEGORY_MAP[item.item.category] || item.item.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  const categoriesWithItems = CATEGORY_ORDER.filter((cat) => grouped[cat]?.length > 0);

  // Auto-select first category if none selected
  const activeCat = selectedCategory && grouped[selectedCategory]
    ? selectedCategory
    : categoriesWithItems[0] || null;

  const activeItems = activeCat ? grouped[activeCat] || [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Saved for later
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {items.length} item{items.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            No saved items yet. Save recommendations from your dashboard to see
            them here.
          </p>
        </div>
      ) : (
        <>
          {/* Category cards */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {categoriesWithItems.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-3 transition-all ${
                  activeCat === cat
                    ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900'
                    : 'border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500'
                }`}
              >
                <CategoryIcon
                  category={cat}
                  className={`h-5 w-5 ${activeCat === cat ? '' : 'text-zinc-500 dark:text-zinc-400'}`}
                />
                <span className={`text-xs font-medium ${activeCat === cat ? '' : 'text-zinc-700 dark:text-zinc-300'}`}>
                  {CATEGORY_LABELS[cat] || cat}
                </span>
                <span className={`text-xs ${activeCat === cat ? 'opacity-70' : 'text-zinc-400'}`}>
                  {grouped[cat].length}
                </span>
              </button>
            ))}
          </div>

          {/* Active category items */}
          {activeCat && activeItems.length > 0 && (
            <div className="space-y-3">
              {activeItems.map((item) => (
                <RecommendationCard
                  key={item.id}
                  recommendation={item}
                  onAction={handleAction}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
