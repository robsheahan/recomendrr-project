import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { generateTasteFingerprint } from '@/lib/taste-fingerprint';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get all ratings
  const { data: ratings } = await supabase
    .from('ratings')
    .select('*, item:items(*)')
    .eq('user_id', user.id);

  if (!ratings || ratings.length < 5) {
    return NextResponse.json(
      { error: 'Need at least 5 ratings to generate a taste fingerprint' },
      { status: 400 }
    );
  }

  const ratingsWithItems = ratings.map((r) => ({ ...r, item: r.item }));

  try {
    const fingerprint = await generateTasteFingerprint(ratingsWithItems);

    // Upsert the fingerprint
    const { data: existing } = await supabase
      .from('taste_fingerprints')
      .select('id')
      .eq('user_id', user.id)
      .is('category', null)
      .single();

    if (existing) {
      await supabase
        .from('taste_fingerprints')
        .update({
          fingerprint,
          generated_at: new Date().toISOString(),
          ratings_count_at_generation: ratings.length,
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('taste_fingerprints')
        .insert({
          user_id: user.id,
          category: null,
          fingerprint,
          ratings_count_at_generation: ratings.length,
        });
    }

    return NextResponse.json({ fingerprint });
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

  const { data } = await supabase
    .from('taste_fingerprints')
    .select('fingerprint, generated_at, ratings_count_at_generation')
    .eq('user_id', user.id)
    .is('category', null)
    .single();

  return NextResponse.json({
    fingerprint: data?.fingerprint || null,
    generatedAt: data?.generated_at || null,
    ratingsCount: data?.ratings_count_at_generation || 0,
  });
}
