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

export default function SavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  const categoryOrder = ['movies', 'tv_shows', 'books', 'podcasts', 'music_artists'];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b)
  );

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
        <div className="space-y-8">
          {sortedCategories.map((cat) => (
            <div key={cat}>
              <div className="mb-3 flex items-center gap-2">
                <CategoryIcon category={cat} className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {CATEGORY_LABELS[cat] || cat}
                </h3>
                <span className="text-xs text-zinc-400">
                  {grouped[cat].length}
                </span>
              </div>
              <div className="space-y-3">
                {grouped[cat].map((item) => (
                  <RecommendationCard
                    key={item.id}
                    recommendation={item}
                    onAction={handleAction}
                    onFeedback={async (id, feedback, reason) => {
                      await fetch('/api/recommendations/feedback', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ recommendationId: id, feedback, reason }),
                      });
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
