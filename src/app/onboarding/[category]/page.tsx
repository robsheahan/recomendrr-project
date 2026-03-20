'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CATEGORY_LABELS, ONBOARDING_RATINGS_REQUIRED } from '@/lib/constants';
import { MediaCategory } from '@/types/database';
import Image from 'next/image';

interface OnboardingItem {
  external_id: string;
  external_source: string;
  category: string;
  title: string;
  creator: string | null;
  description: string;
  genres: string[];
  year: number | null;
  image_url: string | null;
}

export default function CategoryOnboardingPage() {
  const params = useParams();
  const router = useRouter();
  const category = params.category as MediaCategory;

  const [items, setItems] = useState<OnboardingItem[]>([]);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [ratingItem, setRatingItem] = useState<OnboardingItem | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [ratedIds, setRatedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OnboardingItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchDebounce = useRef<NodeJS.Timeout>(undefined);

  const categoryLabel = CATEGORY_LABELS[category] || category;

  const fetchItems = useCallback(async (pageNum: number) => {
    try {
      const res = await fetch(
        `/api/onboarding/items?category=${category}&page=${pageNum}`
      );
      const data = await res.json();
      if (data.items) {
        setItems((prev) => {
          const existingIds = new Set(prev.map((i) => i.external_id));
          const newItems = data.items.filter(
            (i: OnboardingItem) => !existingIds.has(i.external_id)
          );
          return [...prev, ...newItems];
        });
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    fetch('/api/onboarding/progress')
      .then((res) => res.json())
      .then((data) => {
        const cat = data.categories?.find(
          (c: { category: string }) => c.category === category
        );
        if (cat) {
          setRatingsCount(cat.ratingsCount);
          if (cat.onboarding_complete) {
            if (data.nextCategory) {
              router.replace(`/onboarding/${data.nextCategory}`);
            } else {
              router.replace('/dashboard');
            }
            return;
          }
        }
      });

    fetchItems(1);
  }, [category, fetchItems, router]);

  async function handleRate(item: OnboardingItem, score: number) {
    if (submitting) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/onboarding/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item, score }),
      });

      const data = await res.json();

      if (data.success) {
        setRatingsCount(data.ratingsCount);
        setRatedIds((prev) => new Set(prev).add(item.external_id));
        setRatingItem(null);
        setHoveredStar(0);

        if (data.categoryComplete) {
          const progressRes = await fetch('/api/onboarding/progress');
          const progress = await progressRes.json();

          if (progress.allComplete) {
            router.push('/dashboard');
          } else if (progress.nextCategory) {
            router.push(`/onboarding/${progress.nextCategory}`);
          }
        }
      }
    } catch (err) {
      console.error('Failed to rate:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // Search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search/${category}?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        const results = (data.results || []).filter(
          (r: OnboardingItem) => !ratedIds.has(r.external_id)
        );
        setSearchResults(results.slice(0, 8));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [searchQuery, category, ratedIds]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems(nextPage);
  }

  // Filter out already-rated items
  const visibleItems = items.filter((i) => !ratedIds.has(i.external_id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">
            {categoryLabel}
          </span>
          <span className="text-zinc-500">
            {ratingsCount} / {ONBOARDING_RATINGS_REQUIRED} rated
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-50"
            style={{
              width: `${Math.min((ratingsCount / ONBOARDING_RATINGS_REQUIRED) * 100, 100)}%`,
            }}
          />
        </div>
        <p className="mt-2 text-xs text-zinc-500">
          Tap anything you know to rate it
        </p>
      </div>

      {/* Search / Add your own */}
      <div>
        {showSearch ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search for a ${categoryLabel.toLowerCase().replace(/s$/, '')}...`}
                  autoFocus
                  className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 pr-8 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setSearchResults([]);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="rounded-lg px-3 py-2 text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Cancel
              </button>
            </div>

            {searching && (
              <p className="text-center text-xs text-zinc-500">Searching...</p>
            )}

            {searchResults.length > 0 && (
              <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
                {searchResults.map((item) => (
                  <button
                    key={item.external_id}
                    onClick={() => {
                      setRatingItem(item);
                      setHoveredStar(0);
                      setSelectedStar(0);
                    }}
                    className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-50 active:bg-zinc-100 dark:hover:bg-zinc-800 dark:active:bg-zinc-800/80"
                  >
                    {item.image_url ? (
                      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded">
                        <Image
                          src={item.image_url}
                          alt={item.title}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                    ) : (
                      <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
                        <span className="text-xs text-zinc-400">?</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {item.title}
                        {item.year && (
                          <span className="ml-1 font-normal text-zinc-500">
                            ({item.year})
                          </span>
                        )}
                      </p>
                      {item.creator && (
                        <p className="truncate text-xs text-zinc-500">
                          {item.creator}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-center text-xs text-zinc-500">
                No results found
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-600 dark:hover:text-zinc-300"
          >
            + Add your own
          </button>
        )}
      </div>

      {/* Rating overlay */}
      {ratingItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 dark:bg-zinc-900 sm:rounded-2xl">
            <div className="flex gap-4">
              {ratingItem.image_url && (
                <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    src={ratingItem.image_url}
                    alt={ratingItem.title}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {ratingItem.title}
                </h3>
                {ratingItem.year && (
                  <p className="text-sm text-zinc-500">{ratingItem.year}</p>
                )}
                {ratingItem.creator && (
                  <p className="text-sm text-zinc-500">{ratingItem.creator}</p>
                )}
                {ratingItem.genres.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {ratingItem.genres.slice(0, 3).map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
                How would you rate it?
              </p>
              <div className="flex justify-center gap-3">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = star <= (selectedStar || hoveredStar);
                  return (
                    <button
                      key={star}
                      onClick={() => setSelectedStar(star)}
                      onMouseEnter={() => !selectedStar && setHoveredStar(star)}
                      onMouseLeave={() => !selectedStar && setHoveredStar(0)}
                      disabled={submitting}
                      className="p-1 text-3xl transition-transform hover:scale-110 active:scale-95 disabled:opacity-50"
                    >
                      <span className={filled ? 'text-amber-500 opacity-100' : 'opacity-30'}>
                        ★
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  setRatingItem(null);
                  setHoveredStar(0);
                  setSelectedStar(0);
                }}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm text-zinc-500 dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (selectedStar > 0) {
                    handleRate(ratingItem, selectedStar);
                  }
                }}
                disabled={selectedStar === 0 || submitting}
                className="flex-1 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white disabled:opacity-30 dark:bg-zinc-50 dark:text-zinc-900"
              >
                {submitting ? 'Saving...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item grid */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {visibleItems.map((item) => (
          <button
            key={item.external_id}
            onClick={() => {
              setRatingItem(item);
              setHoveredStar(0);
              setSelectedStar(0);
            }}
            className="group relative overflow-hidden rounded-lg border border-zinc-200 bg-white transition-transform active:scale-95 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {item.image_url ? (
              <div className="relative aspect-[2/3]">
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, 25vw"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8">
                  <p className="line-clamp-2 text-xs font-medium leading-tight text-white">
                    {item.title}
                  </p>
                  {item.year && (
                    <p className="text-[10px] text-zinc-300">{item.year}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex aspect-[2/3] flex-col items-center justify-center bg-zinc-100 p-2 dark:bg-zinc-800">
                <p className="line-clamp-3 text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {item.title}
                </p>
                {item.year && (
                  <p className="mt-1 text-[10px] text-zinc-500">{item.year}</p>
                )}
                {item.creator && (
                  <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-400">
                    {item.creator}
                  </p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Load more */}
      {visibleItems.length > 0 && (
        <button
          onClick={handleLoadMore}
          className="w-full rounded-lg border border-zinc-200 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
        >
          Load more
        </button>
      )}

      {visibleItems.length === 0 && !loading && (
        <div className="py-8 text-center">
          <p className="text-sm text-zinc-500">
            No more items to show.
          </p>
          <button
            onClick={handleLoadMore}
            className="mt-3 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-zinc-900"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
