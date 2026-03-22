'use client';

import { useState, useEffect } from 'react';
import { CATEGORY_LABELS } from '@/lib/constants';
import { MediaCategory } from '@/types/database';
import { SearchAndRate } from '@/components/SearchAndRate';
import Image from 'next/image';

interface RatingItem {
  id: string;
  score: number;
  source: string;
  updated_at: string;
  item: {
    id: string;
    title: string;
    creator: string | null;
    genres: string[];
    year: number | null;
    image_url: string | null;
    category: string;
  };
}

const FILTER_CATEGORIES: (MediaCategory | 'all')[] = [
  'all',
  'movies',
  'tv_shows',
  'documentaries',
  'fiction_books',
  'nonfiction_books',
  'podcasts',
  'music_artists',
];

export default function RatingsPage() {
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [filter, setFilter] = useState<MediaCategory | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Fetch counts for all categories on mount
  useEffect(() => {
    fetch('/api/ratings')
      .then((res) => res.json())
      .then((data) => {
        const counts: Record<string, number> = {};
        let total = 0;
        for (const r of data.ratings || []) {
          if (r.item?.category) {
            counts[r.item.category] = (counts[r.item.category] || 0) + 1;
            total++;
          }
        }
        counts['all'] = total;
        setCategoryCounts(counts);
      });
  }, []);

  useEffect(() => {
    const params = filter !== 'all' ? `?category=${filter}` : '';
    setLoading(true);
    fetch(`/api/ratings${params}`)
      .then((res) => res.json())
      .then((data) => {
        setRatings(data.ratings || []);
        setLoading(false);
      });
  }, [filter]);

  function renderStars(score: number) {
    return Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < score ? 'opacity-100' : 'opacity-20'}>
        ★
      </span>
    ));
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your Ratings
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Rate more items to improve your recommendations
        </p>
      </div>

      {/* Search and rate */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h3 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Add a rating
        </h3>
        <SearchAndRate />
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {FILTER_CATEGORIES.map((cat) => {
          const count = categoryCounts[cat] || 0;
          if (cat !== 'all' && count === 0) return null;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === cat
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'border border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat]}
              {count > 0 && (
                <span className={`ml-1.5 ${filter === cat ? 'opacity-70' : 'opacity-50'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Ratings list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      ) : ratings.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">No ratings yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {ratings.map((rating) => (
            <div key={rating.id} className="flex items-center gap-4 p-4">
              {rating.item.image_url ? (
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded">
                  <Image
                    src={rating.item.image_url}
                    alt={rating.item.title}
                    fill
                    className="object-cover"
                    sizes="44px"
                  />
                </div>
              ) : (
                <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
                  <span className="text-xs text-zinc-400">?</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {rating.item.title}
                  {rating.item.year && (
                    <span className="ml-1 font-normal text-zinc-500">
                      ({rating.item.year})
                    </span>
                  )}
                </p>
                <p className="text-xs text-zinc-500">
                  {CATEGORY_LABELS[rating.item.category as MediaCategory]}
                </p>
              </div>
              <div className="shrink-0 text-lg text-amber-500">
                {renderStars(rating.score)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
