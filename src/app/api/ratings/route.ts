import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get('category');

  let query = supabase
    .from('ratings')
    .select('*, item:items(*)')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (category) {
    query = query.eq('item.category', category);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ratings: data });
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

  return NextResponse.json({ success: true, itemId });
}
