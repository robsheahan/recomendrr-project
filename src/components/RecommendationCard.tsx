'use client';

import { useState } from 'react';
import Image from 'next/image';

interface RecommendationItem {
  id: string;
  status: string;
  reason: string | null;
  confidence?: string;
  feedback?: string | null;
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

interface RecommendationCardProps {
  recommendation: RecommendationItem;
  onAction: (id: string, status: string, score?: number) => Promise<void>;
}

export function RecommendationCard({
  recommendation,
  onAction,
}: RecommendationCardProps) {
  const [acting, setActing] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [selectedStar, setSelectedStar] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  const { item, reason, confidence } = recommendation;

  async function handleAction(status: string, score?: number) {
    setActing(true);
    setActionTaken(status === 'saved' ? 'Saving...' : status === 'rated' ? 'Saving...' : null);
    try {
      await onAction(recommendation.id, status, score);
      if (status === 'saved' || status === 'rated') {
        const label = score ? `Rated ${score}/5` : 'Saved';
        setActionTaken(label);
        setTimeout(() => setDismissed(true), 1000);
      } else {
        setDismissed(true);
      }
    } finally {
      setActing(false);
    }
  }

  if (dismissed) {
    return null;
  }

  if (actionTaken) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="text-center">
          <span className="text-2xl">
            {actionTaken.startsWith('Rated') ? '★' : '✓'}
          </span>
          <p className="mt-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {actionTaken}
          </p>
        </div>
      </div>
    );
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
              {/* IMDB rating */}
              {item.metadata?.imdb_rating != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  IMDB {Number(item.metadata.imdb_rating).toFixed(1)}
                </span>
              )}
              {/* Rotten Tomatoes */}
              {item.metadata?.rotten_tomatoes != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  RT {item.metadata.rotten_tomatoes as number}%
                </span>
              )}
              {/* Google Books rating */}
              {item.metadata?.google_rating != null && Number(item.metadata.google_rating) > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  ★ {Number(item.metadata.google_rating).toFixed(1)}
                </span>
              )}
              {/* Spotify popularity */}
              {item.metadata?.spotify_popularity != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Popularity {item.metadata.spotify_popularity as number}
                </span>
              )}
              {/* Fallback: TMDB rating */}
              {!item.metadata?.imdb_rating && !item.metadata?.google_rating && !item.metadata?.spotify_popularity && item.metadata?.tmdb_rating != null && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  ★ {Number(item.metadata.tmdb_rating).toFixed(1)}
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
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {reason}
              </p>
            )}

            {/* Streaming availability */}
            {(() => {
              const wp = item.metadata?.watch_providers as {
                streaming?: { name: string; logo_url: string | null; provider_id: number }[];
                rent?: { name: string; logo_url: string | null; provider_id: number }[];
                link?: string | null;
              } | null;
              if (!wp) return null;

              const streaming = wp.streaming || [];
              const rent = wp.rent || [];
              const hasProviders = streaming.length > 0 || rent.length > 0;
              if (!hasProviders) return null;

              return (
                <div className="mt-3">
                  {streaming.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Stream on
                      </span>
                      {streaming.slice(0, 5).map((p) => (
                        <span
                          key={p.provider_id}
                          className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                        >
                          {p.logo_url && (
                            <Image
                              src={p.logo_url}
                              alt={p.name}
                              width={14}
                              height={14}
                              className="rounded-sm"
                            />
                          )}
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {streaming.length === 0 && rent.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                        Rent on
                      </span>
                      {rent.slice(0, 4).map((p) => (
                        <span
                          key={p.provider_id}
                          className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {p.logo_url && (
                            <Image
                              src={p.logo_url}
                              alt={p.name}
                              width={14}
                              height={14}
                              className="rounded-sm"
                            />
                          )}
                          {p.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {wp.link && (
                    <a
                      href={wp.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-[10px] text-zinc-400 underline decoration-zinc-300 hover:text-zinc-600 dark:decoration-zinc-600 dark:hover:text-zinc-300"
                    >
                      View all options — JustWatch
                    </a>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Actions */}
          <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {/* Star rating */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => {
                const filled = star <= (selectedStar || hoveredStar);
                return (
                  <button
                    key={star}
                    onClick={() => setSelectedStar(selectedStar === star ? 0 : star)}
                    onMouseEnter={() => !selectedStar && setHoveredStar(star)}
                    onMouseLeave={() => !selectedStar && setHoveredStar(0)}
                    disabled={acting}
                    className="p-0.5 text-lg transition-transform hover:scale-110"
                  >
                    <span className={filled ? 'text-amber-500 opacity-100' : 'opacity-30'}>
                      ★
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

            {/* Actions */}
            <div className="flex flex-wrap gap-1.5">
              {selectedStar > 0 ? (
                <button
                  onClick={() => handleAction('rated', selectedStar)}
                  disabled={acting}
                  className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {acting ? 'Saving...' : `Rate ${selectedStar}/5`}
                </button>
              ) : (
                <button
                  onClick={() => handleAction('saved')}
                  disabled={acting}
                  className="rounded-lg bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {acting ? 'Saving...' : 'Save for later'}
                </button>
              )}
              <button
                onClick={() => handleAction('dismissed')}
                disabled={acting}
                className="rounded-lg px-3 py-1 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                Dismiss
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
