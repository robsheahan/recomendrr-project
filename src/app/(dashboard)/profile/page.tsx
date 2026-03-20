'use client';

import { useState, useEffect } from 'react';
import { TasteFingerprint } from '@/lib/taste-fingerprint';

const DIMENSION_LABELS: Record<string, string> = {
  narrative_complexity: 'Narrative Complexity',
  preferred_pacing: 'Pacing Preference',
  moral_ambiguity_tolerance: 'Moral Ambiguity',
  visual_importance: 'Visual Importance',
  openness_to_foreign_language: 'Foreign Language Openness',
  era_preference: 'Era Preference',
  preference_orientation: 'Discovery vs Reliability',
};

const LEVEL_COLORS: Record<string, string> = {
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  fast: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  slow: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  slow_to_medium: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  discovery: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  reliability: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  balanced: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function formatValue(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ProfilePage() {
  const [fingerprint, setFingerprint] = useState<TasteFingerprint | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    fetch('/api/taste-fingerprint')
      .then((res) => res.json())
      .then((data) => {
        setFingerprint(data.fingerprint || null);
        setGeneratedAt(data.generatedAt || null);
        setRatingsCount(data.ratingsCount || 0);
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
        setGeneratedAt(new Date().toISOString());
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Your Taste Profile
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          This is how we understand your preferences. It gets smarter as you rate more items.
        </p>
      </div>

      {!fingerprint ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            No taste profile yet. Generate recommendations first and we&apos;ll build one.
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
          {/* Summary */}
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
              &ldquo;{fingerprint.summary}&rdquo;
            </p>
            <p className="mt-3 text-xs text-zinc-400">
              Based on {ratingsCount} ratings
              {generatedAt && ` · Updated ${new Date(generatedAt).toLocaleDateString()}`}
            </p>
          </div>

          {/* Dimensions */}
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => {
              const value = fingerprint[key as keyof TasteFingerprint];
              if (typeof value !== 'string') return null;
              const colorClass =
                LEVEL_COLORS[value] || 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300';

              return (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-lg border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-sm text-zinc-600 dark:text-zinc-400">
                    {label}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
                  >
                    {formatValue(value)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Lists */}
          <div className="grid gap-6 sm:grid-cols-2">
            {fingerprint.theme_affinities.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Themes You Love
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {fingerprint.theme_affinities.map((theme) => (
                    <span
                      key={theme}
                      className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {fingerprint.emotional_register.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Emotional Register
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {fingerprint.emotional_register.map((emotion) => (
                    <span
                      key={emotion}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      {emotion}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {fingerprint.humor_styles.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Humor Styles
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {fingerprint.humor_styles.map((style) => (
                    <span
                      key={style}
                      className="rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
                    >
                      {style}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {fingerprint.dealbreakers.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Dealbreakers
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {fingerprint.dealbreakers.map((db) => (
                    <span
                      key={db}
                      className="rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-400"
                    >
                      {db}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Regenerate */}
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
