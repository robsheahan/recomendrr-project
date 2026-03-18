import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { ONBOARDING_RATINGS_REQUIRED } from '@/lib/constants';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get user's selected categories
  const { data: userCategories } = await supabase
    .from('user_categories')
    .select('category, onboarding_complete')
    .eq('user_id', user.id);

  if (!userCategories || userCategories.length === 0) {
    return NextResponse.json({
      categories: [],
      nextCategory: null,
      allComplete: false,
    });
  }

  // Get rating counts per category
  const { data: ratings } = await supabase
    .from('ratings')
    .select('id, items!inner(category)')
    .eq('user_id', user.id)
    .eq('source', 'onboarding');

  const ratingsByCategory: Record<string, number> = {};
  for (const rating of ratings || []) {
    const category = (rating.items as unknown as Record<string, unknown>).category as string;
    ratingsByCategory[category] = (ratingsByCategory[category] || 0) + 1;
  }

  const categories = userCategories.map((uc) => ({
    category: uc.category,
    onboarding_complete: uc.onboarding_complete,
    ratingsCount: ratingsByCategory[uc.category] || 0,
    ratingsRequired: ONBOARDING_RATINGS_REQUIRED,
  }));

  const nextCategory = categories.find((c) => !c.onboarding_complete);
  const allComplete = categories.every((c) => c.onboarding_complete);

  return NextResponse.json({
    categories,
    nextCategory: nextCategory?.category || null,
    allComplete,
  });
}
