import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import Link from 'next/link';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950 backdrop-blur-lg">
        <div className="mx-auto max-w-5xl px-4">
          <div className="flex h-16 items-end justify-between pb-3">
            <Link href="/dashboard">
              <img src="/recommnderwhite.svg" alt="RECOMMNDER" className="-ml-2 h-10" />
            </Link>
            <form action="/api/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              >
                Sign out
              </button>
            </form>
          </div>
          <DashboardNav />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
