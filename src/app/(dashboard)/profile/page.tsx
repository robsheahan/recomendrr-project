'use client';

import { useState, useEffect } from 'react';
import { CATEGORY_LABELS } from '@/lib/constants';
import { CategoryIcon } from '@/components/CategoryIcon';

interface CategoryFP {
  category: string;
  fingerprint: Record<string, unknown>;
  generatedAt: string;
  ratingsCount: number;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

const DIMENSION_COLORS: Record<string, string> = {
  // Positive/high values
  enthusiast: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  enthusiastic: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  high_energy: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  loves_experimental: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  prose_connoisseur: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  // Moderate
  moderate: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  balanced: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  selective: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  // Low/avoids
  avoids: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  avoids_entirely: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

function getColor(value: string): string {
  const key = value.toLowerCase().replace(/ /g, '_');
  return DIMENSION_COLORS[key] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';
}

export default function ProfilePage() {
  const [fingerprint, setFingerprint] = useState<Record<string, unknown> | null>(null);
  const [tasteThesis, setTasteThesis] = useState<string | null>(null);
  const [categoryFingerprints, setCategoryFingerprints] = useState<CategoryFP[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch('/api/taste-fingerprint')
      .then((res) => res.json())
      .then((data) => {
        setFingerprint(data.fingerprint || null);
        setTasteThesis(data.tasteThesis || null);
        setCategoryFingerprints(data.categoryFingerprints || []);
        setLoading(false);
      });
  }, []);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      const res = await fetch('/api/taste-fingerprint', { method: 'POST' });
      const data = await res.json();
      if (data.fingerprint) {
        setFingerprint(data.fingerprint);
        setTasteThesis(data.tasteThesis || null);
      }
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  const hasAnyData = fingerprint || categoryFingerprints.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your Taste Profile
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          How we understand your preferences across categories
        </p>
      </div>

      {!hasAnyData ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            No taste profile yet. Rate some items and generate recommendations to build one.
          </p>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {regenerating ? 'Generating...' : 'Generate Taste Profile'}
          </button>
        </div>
      ) : (
        <>
          {/* Taste thesis */}
          {tasteThesis && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                Overall Taste
              </h3>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                &ldquo;{tasteThesis}&rdquo;
              </p>
            </div>
          )}

          {/* Per-category fingerprints */}
          {categoryFingerprints.length > 0 && (
            <div className="space-y-4">
              {categoryFingerprints.map((cfp) => {
                const fp = cfp.fingerprint;
                const summaryKey = Object.keys(fp).find((k) => k.endsWith('_summary'));
                const summary = summaryKey ? String(fp[summaryKey]) : null;
                const signaturePrefs = fp.signature_preferences as string[] | undefined;
                const dealbreakers = fp.category_dealbreakers as string[] | undefined;

                // Get scalar dimensions (exclude arrays, summary, signatures, dealbreakers)
                const dimensions = Object.entries(fp).filter(([key, value]) => {
                  if (key.endsWith('_summary')) return false;
                  if (key === 'signature_preferences' || key === 'category_dealbreakers') return false;
                  if (Array.isArray(value)) return false;
                  return true;
                });

                return (
                  <div
                    key={cfp.category}
                    className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <CategoryIcon category={cfp.category} className="h-5 w-5 text-zinc-500" />
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {CATEGORY_LABELS[cfp.category] || cfp.category}
                      </h3>
                      <span className="text-xs text-zinc-400">
                        {cfp.ratingsCount} ratings
                      </span>
                    </div>

                    {summary && (
                      <p className="mb-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                        {summary}
                      </p>
                    )}

                    <div className="grid gap-2 sm:grid-cols-2">
                      {dimensions.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                        >
                          <span className="text-xs text-zinc-500">
                            {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${getColor(String(value))}`}
                          >
                            {formatValue(value)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {((signaturePrefs && signaturePrefs.length > 0) ||
                      (dealbreakers && dealbreakers.length > 0)) && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {signaturePrefs && signaturePrefs.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium text-zinc-500">Loves</p>
                            <div className="flex flex-wrap gap-1">
                              {signaturePrefs.map((p) => (
                                <span
                                  key={p}
                                  className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                                >
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        {dealbreakers && dealbreakers.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs font-medium text-zinc-500">Dealbreakers</p>
                            <div className="flex flex-wrap gap-1">
                              {dealbreakers.map((d) => (
                                <span
                                  key={d}
                                  className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400"
                                >
                                  {d}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Cross-category fingerprint */}
          {fingerprint && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
              <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Cross-Category Patterns
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(fingerprint)
                  .filter(([key, value]) => {
                    if (key === 'summary') return false;
                    if (Array.isArray(value)) return false;
                    return typeof value === 'string';
                  })
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                    >
                      <span className="text-xs text-zinc-500">
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${getColor(String(value))}`}
                      >
                        {formatValue(value)}
                      </span>
                    </div>
                  ))}
              </div>

              {/* Theme affinities and dealbreakers */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {Array.isArray(fingerprint.theme_affinities) && fingerprint.theme_affinities.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-500">Theme Affinities</p>
                    <div className="flex flex-wrap gap-1">
                      {(fingerprint.theme_affinities as string[]).map((t: string) => (
                        <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">{t}</span>
                      ))}
                    </div>
                  </div>
                )}
                {Array.isArray(fingerprint.dealbreakers) && fingerprint.dealbreakers.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-zinc-500">Dealbreakers</p>
                    <div className="flex flex-wrap gap-1">
                      {(fingerprint.dealbreakers as string[]).map((d: string) => (
                        <span key={d} className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400">{d}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            {regenerating ? 'Regenerating...' : 'Regenerate profile'}
          </button>
        </>
      )}
    </div>
  );
}
