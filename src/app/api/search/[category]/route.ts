import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { searchByCategory } from '@/lib/tmdb';
import { searchLocalItems } from '@/lib/local-search';

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
    // Step 1: Search local database first (fast)
    const localResults = await searchLocalItems(supabase, query, category, 10);

    // Step 2: If we have enough local results, return them
    if (localResults.length >= 5) {
      return NextResponse.json({ results: localResults.slice(0, 10) });
    }

    // Step 3: Supplement with external API results
    const apiResults = await searchByCategory(category, query);

    // Deduplicate: prefer local results (they have richer metadata)
    const localTitles = new Set(localResults.map((r) => r.title.toLowerCase()));
    const localExternalIds = new Set(localResults.map((r) => r.external_id));

    const newApiResults = apiResults.filter(
      (r) =>
        !localTitles.has(r.title.toLowerCase()) &&
        !localExternalIds.has(r.external_id)
    );

    const combined = [...localResults, ...newApiResults];

    // Sort by relevance: exact match > starts with > contains
    const queryLower = query.toLowerCase();
    combined.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aExact = aTitle === queryLower ? 0 : aTitle.startsWith(queryLower) ? 1 : 2;
      const bExact = bTitle === queryLower ? 0 : bTitle.startsWith(queryLower) ? 1 : 2;
      return aExact - bExact;
    });

    return NextResponse.json({ results: combined.slice(0, 10) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Search error:', category, query, message);
    return NextResponse.json({ error: `Search failed: ${message}` }, { status: 500 });
  }
}
