'use client';

import { useState } from 'react';
import Image from 'next/image';

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
    metadata: { tmdb_rating?: number; tmdb_vote_count?: number } | null;
  };
}

interface RecommendationCardProps {
  recommendation: RecommendationItem;
  onAction: (id: string, status: string, score?: number) => Promise<void>;
}

export function RecommendationCard({
  recommendation,
  onAction,
}: RecommendationCardProps) {
  const [acting, setActing] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const { item, reason, confidence } = recommendation;

  async function handleAction(status: string, score?: number) {
    setActing(true);
    try {
      await onAction(recommendation.id, status, score);
      if (status === 'dismissed' || status === 'not_interested' || status === 'rated') {
        setDismissed(true);
      }
    } finally {
      setActing(false);
      setShowRating(false);
    }
  }

  if (dismissed) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col sm:flex-row">
        {item.image_url ? (
          <div className="relative aspect-[2/3] w-full shrink-0 sm:w-36">
            <Image
              src={item.image_url}
              alt={item.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 144px"
            />
          </div>
        ) : (
          <div className="flex aspect-[2/3] w-full shrink-0 items-center justify-center bg-zinc-100 sm:w-36 dark:bg-zinc-800">
            <span className="text-3xl text-zinc-300">?</span>
          </div>
        )}

        <div className="flex flex-1 flex-col p-4">
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">
                {item.title}
                {item.year && (
                  <span className="ml-1.5 text-sm font-normal text-zinc-500">
                    ({item.year})
                  </span>
                )}
              </h3>
              {confidence && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    confidence === 'high'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : confidence === 'medium'
                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {confidence}
                </span>
              )}
            </div>

            {item.creator && (
              <p className="mt-0.5 text-sm text-zinc-500">{item.creator}</p>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.metadata?.tmdb_rating != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  ★ {item.metadata.tmdb_rating.toFixed(1)}
                </span>
              )}
              {item.genres.slice(0, 3).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                >
                  {genre}
                </span>
              ))}
            </div>

            {reason && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {reason}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {showRating ? (
              <div className="space-y-2">
                <p className="text-xs text-zinc-500">Rate it:</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => handleAction('rated', star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      disabled={acting}
                      className="p-1 text-xl transition-transform hover:scale-110"
                    >
                      <span className={star <= hoveredStar ? 'opacity-100' : 'opacity-30'}>
                        ★
                      </span>
                    </button>
                  ))}
                  <button
                    onClick={() => setShowRating(false)}
                    className="ml-2 text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowRating(true)}
                  disabled={acting}
                  className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  Rate
                </button>
                <button
                  onClick={() => handleAction('saved')}
                  disabled={acting}
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Save for later
                </button>
                <button
                  onClick={() => handleAction('dismissed')}
                  disabled={acting}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => handleAction('not_interested')}
                  disabled={acting}
                  className="rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
                >
                  Not interested
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
