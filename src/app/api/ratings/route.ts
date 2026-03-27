import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  generateCategoryFingerprint,
  shouldRegenerateCategoryFingerprint,
  CATEGORY_FINGERPRINT_MIN_RATINGS,
} from '@/lib/category-fingerprints';
import { computeAllSimilarities, computeCollaborativeSignals } from '@/lib/collaborative';
import { CATEGORY_DB_MAP } from '@/lib/constants';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get('category');

  let query = supabase
    .from('ratings')
    .select('*, item:items!inner(*)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (category) {
    if (category === 'books') {
      query = query.in('item.category', ['books', 'fiction_books', 'nonfiction_books']);
    } else if (category === 'movies') {
      query = query.in('item.category', ['movies', 'documentaries']);
    } else {
      query = query.eq('item.category', category);
    }
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter out any ratings with null items
  const validRatings = (data || []).filter((r) => r.item != null);

  return NextResponse.json({ ratings: validRatings });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { item, score } = await request.json();

  if (!item || !score || score < 1 || score > 5) {
    return NextResponse.json({ error: 'Invalid rating data' }, { status: 400 });
  }

  // Upsert item
  const { data: existingItem } = await supabase
    .from('items')
    .select('id')
    .eq('external_id', item.external_id)
    .eq('external_source', item.external_source)
    .eq('category', item.category)
    .single();

  let itemId: string;

  if (existingItem) {
    itemId = existingItem.id;
  } else {
    const { data: newItem, error: insertError } = await supabase
      .from('items')
      .insert({
        category: item.category,
        external_id: item.external_id,
        external_source: item.external_source,
        title: item.title,
        creator: item.creator,
        description: item.description,
        genres: item.genres || [],
        year: item.year,
        image_url: item.image_url,
        metadata: item.metadata || null,
      })
      .select('id')
      .single();

    if (insertError || !newItem) {
      return NextResponse.json({ error: 'Failed to save item' }, { status: 500 });
    }
    itemId = newItem.id;
  }

  // Upsert rating
  const { error: ratingError } = await supabase
    .from('ratings')
    .upsert(
      {
        user_id: user.id,
        item_id: itemId,
        score,
        source: 'manual',
      },
      { onConflict: 'user_id,item_id' }
    );

  if (ratingError) {
    return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
  }

  // Post-consumption loop: if this item was previously recommended, record the rating
  const { data: existingRec } = await supabase
    .from('recommendations')
    .select('id')
    .eq('user_id', user.id)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingRec) {
    await supabase
      .from('recommendations')
      .update({
        post_rating: score,
        status: 'rated',
        status_changed_at: new Date().toISOString(),
      })
      .eq('id', existingRec.id);
  }

  // Recompute collaborative similarities + signals in the background (non-blocking)
  (async () => {
    try {
      await computeAllSimilarities(supabase, user.id);
      // Recompute signals for the item's category
      const categoryMap: Record<string, string> = {
        fiction_books: 'books', nonfiction_books: 'books', documentaries: 'movies',
      };
      const activeCatForSignals = categoryMap[item.category] || item.category;
      await computeCollaborativeSignals(supabase, user.id, activeCatForSignals, 20);
    } catch (err) {
      console.error('Collaborative recomputation after rating:', err);
    }
  })();

  // Check if category fingerprint needs updating (non-blocking)
  (async () => {
    try {
      // Map the item's category to the active category
      const categoryMap: Record<string, string> = {
        fiction_books: 'books', nonfiction_books: 'books', documentaries: 'movies',
      };
      const activeCat = categoryMap[item.category] || item.category;
      const dbCats = CATEGORY_DB_MAP[activeCat] || [activeCat];

      // Count ratings in this category
      const { data: catRatings } = await supabase
        .from('ratings')
        .select('*, item:items!inner(*)')
        .eq('user_id', user.id)
        .in('items.category', dbCats);

      if (!catRatings || catRatings.length < CATEGORY_FINGERPRINT_MIN_RATINGS) return;

      // Check if fingerprint needs regen
      const { data: fpRecord } = await supabase
        .from('taste_fingerprints')
        .select('fingerprint, ratings_count_at_generation, fingerprint_version, taste_thesis')
        .eq('user_id', user.id)
        .eq('category', activeCat)
        .single();

      const ratingsAtGen = fpRecord?.ratings_count_at_generation || 0;

      if (!shouldRegenerateCategoryFingerprint(catRatings.length, ratingsAtGen)) return;

      const ratingsWithItems = catRatings.map((r) => ({ ...r, item: r.item }));

      // Get cross-category thesis for context
      const { data: crossFp } = await supabase
        .from('taste_fingerprints')
        .select('taste_thesis')
        .eq('user_id', user.id)
        .is('category', null)
        .single();

      const result = await generateCategoryFingerprint(
        ratingsWithItems,
        activeCat,
        crossFp?.taste_thesis || null,
        fpRecord?.fingerprint || null,
        ratingsAtGen
      );

      if (result) {
        const upsertData = {
          user_id: user.id,
          category: activeCat,
          fingerprint: result.fingerprint,
          generated_at: new Date().toISOString(),
          ratings_count_at_generation: catRatings.length,
          fingerprint_version: (fpRecord?.fingerprint_version || 0) + 1,
          evolution_notes: result.evolutionNotes,
        };

        if (fpRecord) {
          await supabase.from('taste_fingerprints').update(upsertData)
            .eq('user_id', user.id).eq('category', activeCat);
        } else {
          await supabase.from('taste_fingerprints').insert(upsertData);
        }

        // Also update cross-category fingerprint
        const { generateTasteFingerprint } = await import('@/lib/taste-fingerprint');
        const { data: allRatings } = await supabase
          .from('ratings')
          .select('*, item:items(*)')
          .eq('user_id', user.id);

        if (allRatings && allRatings.length >= 5) {
          const allWithItems = allRatings.map((r) => ({ ...r, item: r.item }));
          const crossResult = await generateTasteFingerprint(allWithItems, crossFp ? undefined : null);

          const crossUpsert = {
            user_id: user.id,
            category: null,
            fingerprint: crossResult.fingerprint,
            generated_at: new Date().toISOString(),
            ratings_count_at_generation: allRatings.length,
            taste_thesis: crossResult.tasteThesis,
            evolution_notes: crossResult.evolutionNotes,
            cross_category_patterns: crossResult.crossCategoryPatterns,
          };

          const { data: existingCross } = await supabase
            .from('taste_fingerprints')
            .select('id')
            .eq('user_id', user.id)
            .is('category', null)
            .single();

          if (existingCross) {
            await supabase.from('taste_fingerprints').update(crossUpsert).eq('id', existingCross.id);
          } else {
            await supabase.from('taste_fingerprints').insert(crossUpsert);
          }
        }
      }
    } catch (err) {
      console.error('Fingerprint update after rating:', err);
    }
  })();

  return NextResponse.json({ success: true, itemId });
}
