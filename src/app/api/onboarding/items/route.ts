import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getPopularByCategory } from '@/lib/tmdb';

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const category = request.nextUrl.searchParams.get('category');
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1');

  if (!category) {
    return NextResponse.json({ error: 'Category is required' }, { status: 400 });
  }

  try {
    // Fetch popular items from TMDB
    const items = await getPopularByCategory(category, page);

    // Get items the user has already rated in this category
    const { data: existingRatings } = await supabase
      .from('ratings')
      .select('item_id, items!inner(external_id, category)')
      .eq('user_id', user.id);

    const ratedExternalIds = new Set(
      (existingRatings || [])
        .filter((r: Record<string, unknown>) => {
          const item = r.items as Record<string, unknown>;
          return item.category === category;
        })
        .map((r: Record<string, unknown>) => {
          const item = r.items as Record<string, unknown>;
          return item.external_id as string;
        })
    );

    // Filter out already-rated items
    const unratedItems = items.filter(
      (item) => !ratedExternalIds.has(item.external_id)
    );

    return NextResponse.json({ items: unratedItems });
  } catch (err) {
    console.error('Error fetching onboarding items:', err);
    return NextResponse.json(
      { error: 'Failed to fetch items' },
      { status: 500 }
    );
  }
}
