import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { status, score } = await request.json();

  const validStatuses = ['saved', 'dismissed', 'not_interested', 'rated'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  // Verify the recommendation belongs to this user
  const { data: recommendation } = await supabase
    .from('recommendations')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!recommendation) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  // Update recommendation status
  const { error: updateError } = await supabase
    .from('recommendations')
    .update({
      status,
      status_changed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  // If rating, also create/update a rating record
  if (status === 'rated' && score >= 1 && score <= 5) {
    await supabase
      .from('ratings')
      .upsert(
        {
          user_id: user.id,
          item_id: recommendation.item_id,
          score,
          source: 'recommendation',
        },
        { onConflict: 'user_id,item_id' }
      );
  }

  // Create cooldown when user acts on a recommendation
  // This prevents the same item from being recommended again soon
  if (['saved', 'rated', 'dismissed', 'not_interested'].includes(status)) {
    const { data: existingCooldown } = await supabase
      .from('recommendation_cooldowns')
      .select('id, times_recommended')
      .eq('user_id', user.id)
      .eq('item_id', recommendation.item_id)
      .single();

    if (existingCooldown) {
      await supabase
        .from('recommendation_cooldowns')
        .update({
          last_recommended_at: new Date().toISOString(),
          times_recommended: existingCooldown.times_recommended + 1,
        })
        .eq('id', existingCooldown.id);
    } else {
      await supabase
        .from('recommendation_cooldowns')
        .insert({ user_id: user.id, item_id: recommendation.item_id });
    }
  }

  return NextResponse.json({ success: true });
}
