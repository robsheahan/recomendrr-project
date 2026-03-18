import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="space-y-8 px-4 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Recommendation Engine
          </h1>
          <p className="mx-auto max-w-md text-lg text-zinc-600 dark:text-zinc-400">
            Discover movies, books, music and more — tailored to your taste
            with AI-powered recommendations.
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
          <Link
            href="/auth/signup"
            className="rounded-lg bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Get started
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
