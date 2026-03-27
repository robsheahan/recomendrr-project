import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RecommendationGenerator } from '@/components/RecommendationGenerator';
import Link from 'next/link';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ skip_onboarding?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const params = await searchParams;
  const skipOnboarding = params.skip_onboarding === '1';

  // Check if user has any categories at all
  const { data: categories } = await supabase
    .from('user_categories')
    .select('category, onboarding_complete')
    .eq('user_id', user.id);

  // Map legacy categories to new ones for display
  const categoryMap: Record<string, string> = {
    fiction_books: 'books',
    nonfiction_books: 'books',
    documentaries: 'movies',
  };
  const uniqueCategories = new Set(
    (categories || []).map((c) => categoryMap[c.category] || c.category)
  );
  const categoryCount = uniqueCategories.size;
  const hasCategories = categoryCount > 0;

  // If no categories and not skipping, go to onboarding
  if (!skipOnboarding && !hasCategories) {
    redirect('/onboarding');
  }

  // Get rating count for the welcome stat
  const { count: totalRatings } = await supabase
    .from('ratings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: totalRecs } = await supabase
    .from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-900 to-zinc-800 p-6 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
        <h2 className="text-lg font-semibold text-white">
          Hey {displayName}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Ready to discover something new?
        </p>

        <div className="mt-4 flex gap-6">
          <div>
            <p className="text-2xl font-bold text-white">{totalRatings || 0}</p>
            <p className="text-xs text-zinc-500">Ratings</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{categoryCount}</p>
            <p className="text-xs text-zinc-500">Categories</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{totalRecs || 0}</p>
            <p className="text-xs text-zinc-500">Recommendations</p>
          </div>
        </div>

        {categoryCount < 5 && (
          <Link
            href="/onboarding"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/25"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M10.75 4.75a.75.75 0 0 0-1.5 0v4.5h-4.5a.75.75 0 0 0 0 1.5h4.5v4.5a.75.75 0 0 0 1.5 0v-4.5h4.5a.75.75 0 0 0 0-1.5h-4.5v-4.5Z" />
            </svg>
            Add more categories for recommendations
          </Link>
        )}
      </div>

      {/* Recommendation generator */}
      {hasCategories ? (
        <RecommendationGenerator />
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">
            Set up your categories and rate some items to start getting recommendations.
          </p>
          <Link
            href="/onboarding"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
        </div>
      )}
    </div>
  );
}
