import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { ONBOARDING_RATINGS_REQUIRED } from '@/lib/constants';

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

  // Upsert the item into the items table
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
      return NextResponse.json(
        { error: 'Failed to save item' },
        { status: 500 }
      );
    }
    itemId = newItem.id;
  }

  // Insert the rating
  const { error: ratingError } = await supabase
    .from('ratings')
    .upsert(
      {
        user_id: user.id,
        item_id: itemId,
        score,
        source: 'onboarding',
      },
      { onConflict: 'user_id,item_id' }
    );

  if (ratingError) {
    return NextResponse.json(
      { error: 'Failed to save rating' },
      { status: 500 }
    );
  }

  // Count ratings for this category
  const { count } = await supabase
    .from('ratings')
    .select('id, items!inner(category)', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('source', 'onboarding')
    .eq('items.category', item.category);

  const ratingsCount = count || 0;
  const categoryComplete = ratingsCount >= ONBOARDING_RATINGS_REQUIRED;

  // If this category is complete, mark it
  if (categoryComplete) {
    await supabase
      .from('user_categories')
      .update({ onboarding_complete: true })
      .eq('user_id', user.id)
      .eq('category', item.category);

    // Check if all selected categories are complete
    const { data: userCategories } = await supabase
      .from('user_categories')
      .select('onboarding_complete')
      .eq('user_id', user.id);

    const allComplete = userCategories?.every((c) => c.onboarding_complete);

    if (allComplete) {
      await supabase
        .from('users')
        .update({ onboarding_complete: true })
        .eq('id', user.id);
    }
  }

  return NextResponse.json({
    success: true,
    ratingsCount,
    categoryComplete,
  });
}
