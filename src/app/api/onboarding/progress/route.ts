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

  // Map legacy categories to new ones and merge counts
  const categoryMap: Record<string, string> = {
    fiction_books: 'books',
    nonfiction_books: 'books',
    documentaries: 'movies',
  };

  // Merge legacy rating counts into new categories
  for (const [legacy, mapped] of Object.entries(categoryMap)) {
    if (ratingsByCategory[legacy]) {
      ratingsByCategory[mapped] = (ratingsByCategory[mapped] || 0) + ratingsByCategory[legacy];
    }
  }

  // Deduplicate and map categories
  const seen = new Set<string>();
  const mappedCategories = [];
  for (const uc of userCategories) {
    const mapped = categoryMap[uc.category] || uc.category;
    if (seen.has(mapped)) continue;
    seen.add(mapped);
    mappedCategories.push({
      category: mapped,
      onboarding_complete: uc.onboarding_complete,
      ratingsCount: ratingsByCategory[mapped] || ratingsByCategory[uc.category] || 0,
      ratingsRequired: ONBOARDING_RATINGS_REQUIRED,
    });
  }

  const categories = mappedCategories;

  const nextCategory = categories.find((c) => !c.onboarding_complete);
  const allComplete = categories.every((c) => c.onboarding_complete);

  return NextResponse.json({
    categories,
    nextCategory: nextCategory?.category || null,
    allComplete,
  });
}
