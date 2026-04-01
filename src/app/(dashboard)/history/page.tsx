'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS } from '@/lib/constants';
import { MediaCategory } from '@/types/database';
import Image from 'next/image';

interface HistoryItem {
  id: string;
  status: string;
  reason: string | null;
  model_used: string | null;
  created_at: string;
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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  saved: { label: 'Saved', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  dismissed: { label: 'Dismissed', color: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  not_interested: { label: 'Not interested', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  rated: { label: 'Rated', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/recommendations/history')
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setLoading(false);
      });
  }, []);

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
          Recommendation History
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          All recommendations you&apos;ve received
        </p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            No recommendations yet. Head to the dashboard to generate some.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {items.map((item) => {
            const statusInfo = STATUS_LABELS[item.status] || STATUS_LABELS.pending;

            return (
              <div key={item.id} className="flex items-start gap-4 p-4">
                {item.item.image_url ? (
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded">
                    <Image
                      src={item.item.image_url}
                      alt={item.item.title}
                      fill
                      className="object-cover"
                      sizes="56px"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
                    <span className="text-xs text-zinc-400">?</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {item.item.title}
                      {item.item.year && (
                        <span className="ml-1 font-normal text-zinc-500">
                          ({item.item.year})
                        </span>
                      )}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                    >
                      {statusInfo.label}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    {CATEGORY_LABELS[item.item.category as MediaCategory]}
                  </p>
                  {item.reason && (
                    <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                      {item.reason}
                    </p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-zinc-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </p>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams({
                          seedTitle: item.item.title,
                          seedCategory: item.item.category,
                          targetCategory: item.item.category,
                        });
                        router.push(`/dashboard?${params.toString()}`);
                      }}
                      className="rounded-lg px-2 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                    >
                      More like this
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
