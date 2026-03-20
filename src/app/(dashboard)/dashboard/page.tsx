import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { RecommendationGenerator } from '@/components/RecommendationGenerator';

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

  // Check if user has completed onboarding (unless they explicitly skipped)
  if (!skipOnboarding) {
    const { data: profile } = await supabase
      .from('users')
      .select('onboarding_complete')
      .eq('id', user.id)
      .single();

    if (!profile?.onboarding_complete) {
      const { data: categories } = await supabase
        .from('user_categories')
        .select('category, onboarding_complete')
        .eq('user_id', user.id);

      if (!categories || categories.length === 0) {
        redirect('/onboarding');
      }

      const nextIncomplete = categories.find((c) => !c.onboarding_complete);
      if (nextIncomplete) {
        redirect(`/onboarding/${nextIncomplete.category}`);
      }
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Welcome back, {user.user_metadata?.display_name || user.email}
        </p>
      </div>

      <RecommendationGenerator />
    </div>
  );
}
