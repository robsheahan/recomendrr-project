import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { MediaCategory } from '@/types/database';

const VALID_CATEGORIES: MediaCategory[] = [
  'fiction_books', 'nonfiction_books', 'documentaries',
  'tv_shows', 'movies', 'podcasts', 'music_artists',
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { categories } = await request.json();

  if (!Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json({ error: 'Select at least one category' }, { status: 400 });
  }

  const validCategories = categories.filter((c: string) =>
    VALID_CATEGORIES.includes(c as MediaCategory)
  );

  if (validCategories.length === 0) {
    return NextResponse.json({ error: 'No valid categories selected' }, { status: 400 });
  }

  // Delete existing categories and insert new ones
  await supabase
    .from('user_categories')
    .delete()
    .eq('user_id', user.id);

  const { error } = await supabase
    .from('user_categories')
    .insert(
      validCategories.map((category: string) => ({
        user_id: user.id,
        category,
      }))
    );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
