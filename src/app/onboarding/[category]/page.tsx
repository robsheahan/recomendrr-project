'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [currentIndex, setCurrentIndex] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(false);
  const [page, setPage] = useState(1);
  const [hoveredStar, setHoveredStar] = useState(0);

  const categoryLabel = CATEGORY_LABELS[category] || category;

  const fetchItems = useCallback(async (pageNum: number) => {
    try {
      const res = await fetch(
        `/api/onboarding/items?category=${category}&page=${pageNum}`
      );
      const data = await res.json();
      if (data.items) {
        setItems((prev) => [...prev, ...data.items]);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    // Get current progress
    fetch('/api/onboarding/progress')
      .then((res) => res.json())
      .then((data) => {
        const cat = data.categories?.find(
          (c: { category: string }) => c.category === category
        );
        if (cat) {
          setRatingsCount(cat.ratingsCount);
          if (cat.onboarding_complete) {
            // This category is done, go to next or dashboard
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

  const currentItem = items[currentIndex];

  async function handleRate(score: number) {
    if (!currentItem || rating) return;
    setRating(true);

    try {
      const res = await fetch('/api/onboarding/rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: currentItem, score }),
      });

      const data = await res.json();

      if (data.success) {
        setRatingsCount(data.ratingsCount);

        if (data.categoryComplete) {
          // Check if there's a next category
          const progressRes = await fetch('/api/onboarding/progress');
          const progress = await progressRes.json();

          if (progress.allComplete) {
            router.push('/dashboard');
          } else if (progress.nextCategory) {
            router.push(`/onboarding/${progress.nextCategory}`);
          }
          return;
        }

        moveToNext();
      }
    } catch (err) {
      console.error('Failed to rate:', err);
    } finally {
      setRating(false);
    }
  }

  function handleSkip() {
    moveToNext();
  }

  function moveToNext() {
    const nextIndex = currentIndex + 1;

    // If we're running low on items, fetch more
    if (nextIndex >= items.length - 3) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchItems(nextPage);
    }

    setCurrentIndex(nextIndex);
    setHoveredStar(0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-zinc-500">
          No more items available. Try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
      </div>

      {/* Item card */}
      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col sm:flex-row">
          {currentItem.image_url ? (
            <div className="relative aspect-[2/3] w-full shrink-0 sm:w-48">
              <Image
                src={currentItem.image_url}
                alt={currentItem.title}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 192px"
              />
            </div>
          ) : (
            <div className="flex aspect-[2/3] w-full shrink-0 items-center justify-center bg-zinc-100 sm:w-48 dark:bg-zinc-800">
              <span className="text-4xl text-zinc-300">?</span>
            </div>
          )}

          <div className="flex flex-1 flex-col justify-between p-5">
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {currentItem.title}
                {currentItem.year && (
                  <span className="ml-2 text-sm font-normal text-zinc-500">
                    ({currentItem.year})
                  </span>
                )}
              </h3>
              {currentItem.creator && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {currentItem.creator}
                </p>
              )}
              {currentItem.genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {currentItem.genres.slice(0, 4).map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
              {currentItem.description && (
                <p className="mt-3 line-clamp-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {currentItem.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating controls */}
      <div className="space-y-4">
        <div>
          <p className="mb-3 text-center text-sm font-medium text-zinc-700 dark:text-zinc-300">
            How would you rate it?
          </p>
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => handleRate(star)}
                onMouseEnter={() => setHoveredStar(star)}
                onMouseLeave={() => setHoveredStar(0)}
                disabled={rating}
                className="rounded-lg p-2 text-3xl transition-transform hover:scale-110 disabled:opacity-50"
                aria-label={`Rate ${star} star${star !== 1 ? 's' : ''}`}
              >
                <span
                  className={
                    star <= hoveredStar
                      ? 'opacity-100'
                      : 'opacity-30'
                  }
                >
                  ★
                </span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSkip}
          disabled={rating}
          className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
        >
          Don&apos;t know it — skip
        </button>
      </div>
    </div>
  );
}
