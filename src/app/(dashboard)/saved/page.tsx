'use client';

import { useState, useEffect } from 'react';
import { RecommendationCard } from '@/components/RecommendationCard';

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
    metadata: { tmdb_rating?: number; tmdb_vote_count?: number } | null;
  };
}

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Saved for later
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Items you&apos;ve saved from your recommendations
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
        <div className="space-y-4">
          {items.map((item) => (
            <RecommendationCard
              key={item.id}
              recommendation={item}
              onAction={handleAction}
              onFeedback={async (id, feedback) => {
                await fetch('/api/recommendations/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ recommendationId: id, feedback }),
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
