'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
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

// Map legacy DB categories to display categories
const CATEGORY_MERGE: Record<string, string> = {
  fiction_books: 'books',
  nonfiction_books: 'books',
  documentaries: 'movies',
};

const FILTER_CATEGORIES: (MediaCategory | 'all')[] = [
  'all',
  'books',
  'movies',
  'music_artists',
  'podcasts',
  'tv_shows',
];

export default function RatingsPage() {
  const router = useRouter();
  const [allRatings, setAllRatings] = useState<RatingItem[]>([]);
  const [filter, setFilter] = useState<MediaCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/ratings')
      .then((res) => res.json())
      .then((data) => {
        setAllRatings(data.ratings || []);
        setLoading(false);
      });
  }, []);

  // Compute category counts with merged categories
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const r of allRatings) {
      if (r.item?.category) {
        const merged = CATEGORY_MERGE[r.item.category] || r.item.category;
        counts[merged] = (counts[merged] || 0) + 1;
        total++;
      }
    }
    counts['all'] = total;
    return counts;
  }, [allRatings]);

  // Filter and search ratings
  const filteredRatings = useMemo(() => {
    let results = allRatings;

    // Category filter
    if (filter !== 'all') {
      results = results.filter((r) => {
        const merged = CATEGORY_MERGE[r.item.category] || r.item.category;
        return merged === filter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(
        (r) =>
          r.item.title.toLowerCase().includes(q) ||
          (r.item.creator && r.item.creator.toLowerCase().includes(q))
      );
    }

    return results;
  }, [allRatings, filter, searchQuery]);

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

      {/* Search ratings */}
      {allRatings.length > 0 && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search your ratings..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      )}

      {/* Ratings list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      ) : filteredRatings.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            {searchQuery ? 'No ratings match your search.' : 'No ratings yet.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {filteredRatings.map((rating) => (
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
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-lg text-amber-500">
                  {renderStars(rating.score)}
                </div>
                <button
                  onClick={() => {
                    const merged = CATEGORY_MERGE[rating.item.category] || rating.item.category;
                    const params = new URLSearchParams({
                      seedTitle: rating.item.title,
                      seedCategory: rating.item.category,
                      targetCategory: merged,
                    });
                    router.push(`/dashboard?${params.toString()}`);
                  }}
                  className="rounded-lg px-2.5 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  More like this
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
