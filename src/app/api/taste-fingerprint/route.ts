import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  generateTasteFingerprint,
  computeRatingDistribution,
} from '@/lib/taste-fingerprint';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: ratings } = await supabase
    .from('ratings')
    .select('*, item:items(*)')
    .eq('user_id', user.id);

  if (!ratings || ratings.length < 3) {
    return NextResponse.json(
      { error: 'Need at least 3 ratings to generate a taste fingerprint' },
      { status: 400 }
    );
  }

  const ratingsWithItems = ratings.map((r) => ({ ...r, item: r.item }));

  // Get existing fingerprint for evolution comparison
  const { data: existing } = await supabase
    .from('taste_fingerprints')
    .select('*')
    .eq('user_id', user.id)
    .is('category', null)
    .single();

  try {
    const result = await generateTasteFingerprint(
      ratingsWithItems,
      existing?.fingerprint || null
    );

    const distribution = computeRatingDistribution(ratingsWithItems);
    const newVersion = (existing?.fingerprint_version || 0) + 1;

    const previousFingerprints = existing?.previous_fingerprints || [];
    if (existing?.fingerprint) {
      previousFingerprints.push({
        fingerprint: existing.fingerprint,
        generated_at: existing.generated_at,
        ratings_count: existing.ratings_count_at_generation,
      });
      if (previousFingerprints.length > 5) previousFingerprints.shift();
    }

    const upsertData = {
      user_id: user.id,
      category: null,
      fingerprint: result.fingerprint,
      generated_at: new Date().toISOString(),
      ratings_count_at_generation: ratings.length,
      fingerprint_version: newVersion,
      evolution_notes: result.evolutionNotes,
      taste_thesis: result.tasteThesis,
      cross_category_patterns: result.crossCategoryPatterns,
      rating_distribution: distribution,
      previous_fingerprints: previousFingerprints,
    };

    if (existing) {
      await supabase
        .from('taste_fingerprints')
        .update(upsertData)
        .eq('id', existing.id);
    } else {
      await supabase
        .from('taste_fingerprints')
        .insert(upsertData);
    }

    return NextResponse.json({
      fingerprint: result.fingerprint,
      tasteThesis: result.tasteThesis,
      evolutionNotes: result.evolutionNotes,
      version: newVersion,
    });
  } catch (err) {
    console.error('Fingerprint generation error:', err);
    return NextResponse.json(
      { error: 'Failed to generate taste fingerprint' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get cross-category fingerprint
  const { data } = await supabase
    .from('taste_fingerprints')
    .select('fingerprint, generated_at, ratings_count_at_generation, fingerprint_version, evolution_notes, taste_thesis, cross_category_patterns, rating_distribution')
    .eq('user_id', user.id)
    .is('category', null)
    .single();

  // Get per-category fingerprints
  const { data: categoryFingerprints } = await supabase
    .from('taste_fingerprints')
    .select('category, fingerprint, generated_at, ratings_count_at_generation')
    .eq('user_id', user.id)
    .not('category', 'is', null);

  return NextResponse.json({
    fingerprint: data?.fingerprint || null,
    generatedAt: data?.generated_at || null,
    ratingsCount: data?.ratings_count_at_generation || 0,
    version: data?.fingerprint_version || 0,
    evolutionNotes: data?.evolution_notes || null,
    tasteThesis: data?.taste_thesis || null,
    crossCategoryPatterns: data?.cross_category_patterns || null,
    ratingDistribution: data?.rating_distribution || null,
    categoryFingerprints: (categoryFingerprints || []).map((cf) => ({
      category: cf.category,
      fingerprint: cf.fingerprint,
      generatedAt: cf.generated_at,
      ratingsCount: cf.ratings_count_at_generation,
    })),
  });
}
