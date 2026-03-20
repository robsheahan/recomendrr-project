import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { searchByCategory } from '@/lib/tmdb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { category } = await params;
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({ error: 'Query too short' }, { status: 400 });
  }

  try {
    const results = await searchByCategory(category, query);
    return NextResponse.json({ results: results.slice(0, 10) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Search error:', category, query, message);
    return NextResponse.json({ error: `Search failed: ${message}` }, { status: 500 });
  }
}
