import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateTasteFingerprint } from '@/lib/taste-fingerprint';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = await request.json();

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }

  // Mark this category's onboarding as complete regardless of rating count
  await supabase
    .from('user_categories')
    .update({ onboarding_complete: true })
    .eq('user_id', user.id)
    .eq('category', category);

  // Check if all selected categories are now complete
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

    // Generate taste fingerprint if we have any ratings
    try {
      const { data: allRatings } = await supabase
        .from('ratings')
        .select('*, item:items(*)')
        .eq('user_id', user.id);

      if (allRatings && allRatings.length >= 3) {
        const ratingsWithItems = allRatings.map((r) => ({ ...r, item: r.item }));
        const fingerprint = await generateTasteFingerprint(ratingsWithItems);

        await supabase
          .from('taste_fingerprints')
          .upsert(
            {
              user_id: user.id,
              category: null,
              fingerprint,
              ratings_count_at_generation: allRatings.length,
            },
            { onConflict: 'user_id,category' }
          );
      }
    } catch (err) {
      console.error('Fingerprint generation failed:', err);
    }
  }

  return NextResponse.json({ success: true, allComplete });
}
