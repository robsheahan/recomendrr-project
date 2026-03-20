'use client';

import { useState, useRef, useEffect } from 'react';
import { CATEGORY_LABELS } from '@/lib/constants';
import { MediaCategory } from '@/types/database';
import Image from 'next/image';

interface SearchResult {
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

const SEARCHABLE_CATEGORIES: MediaCategory[] = [
  'movies', 'tv_shows', 'documentaries',
  'fiction_books', 'nonfiction_books', 'podcasts', 'music_artists',
];

export function SearchAndRate() {
  const [category, setCategory] = useState<MediaCategory>('movies');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [rating, setRating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/search/${category}?q=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        setResults(data.results || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, category]);

  async function handleRate(score: number) {
    if (!selectedItem || rating) return;
    setRating(true);

    try {
      const res = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: selectedItem, score }),
      });

      if (res.ok) {
        setSuccess(`Rated "${selectedItem.title}" ${score}/5`);
        setSelectedItem(null);
        setQuery('');
        setResults([]);
        setTimeout(() => setSuccess(null), 3000);
      }
    } finally {
      setRating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as MediaCategory);
            setResults([]);
            setSelectedItem(null);
          }}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {SEARCHABLE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title..."
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        />
      </div>

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-400">
          {success}
        </div>
      )}

      {/* Selected item for rating */}
      {selectedItem && (
        <div className="rounded-xl border-2 border-zinc-900 bg-white p-4 dark:border-zinc-50 dark:bg-zinc-900">
          <div className="flex gap-4">
            {selectedItem.image_url && (
              <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded">
                <Image
                  src={selectedItem.image_url}
                  alt={selectedItem.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </div>
            )}
            <div className="flex-1">
              <h4 className="font-medium text-zinc-900 dark:text-zinc-50">
                {selectedItem.title}
                {selectedItem.year && (
                  <span className="ml-1.5 text-sm font-normal text-zinc-500">
                    ({selectedItem.year})
                  </span>
                )}
              </h4>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Rate it:
              </p>
              <div className="mt-1 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => handleRate(star)}
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(0)}
                    disabled={rating}
                    className="p-1 text-2xl transition-transform hover:scale-110"
                  >
                    <span
                      className={star <= hoveredStar ? 'opacity-100' : 'opacity-30'}
                    >
                      ★
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => setSelectedItem(null)}
              className="self-start text-sm text-zinc-400 hover:text-zinc-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Search results */}
      {results.length > 0 && !selectedItem && (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {results.map((item) => (
            <button
              key={item.external_id}
              onClick={() => {
                setSelectedItem(item);
                setHoveredStar(0);
              }}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              {item.image_url ? (
                <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded">
                  <Image
                    src={item.image_url}
                    alt={item.title}
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
                  {item.title}
                  {item.year && (
                    <span className="ml-1 text-zinc-500">({item.year})</span>
                  )}
                </p>
                {item.genres.length > 0 && (
                  <p className="truncate text-xs text-zinc-500">
                    {item.genres.slice(0, 3).join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="text-center text-sm text-zinc-500">Searching...</p>
      )}
    </div>
  );
}
