import Link from 'next/link';

const CATEGORIES = [
  'Movies', 'TV Shows', 'Books', 'Podcasts', 'Music',
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="space-y-6">
          <img src="/recommnderwhite.svg" alt="RECOMMNDER" className="h-12 sm:h-16" />
          <p className="mx-auto max-w-xs text-base leading-relaxed text-zinc-400 sm:max-w-sm sm:text-lg">
            Discover movies, shows, books and music you&apos;ll love — tailored
            to your taste by AI.
          </p>

          <div className="flex flex-col gap-3 pt-2">
            <Link
              href="/auth/signup"
              className="rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition-transform active:scale-95"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full border border-zinc-700 px-8 py-3 text-sm font-medium text-zinc-300 transition-colors active:bg-zinc-900"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Category pills */}
        <div className="mt-12 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <span
              key={cat}
              className="rounded-full border border-zinc-800 px-3.5 py-1.5 text-xs text-zinc-400"
            >
              {cat}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-6">
        <div className="mx-auto flex max-w-sm flex-col items-center gap-4">
          <div className="flex gap-6">
            <Link
              href="/contact"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Contact
            </Link>
            <Link
              href="/terms"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Terms & Conditions
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Privacy Policy
            </Link>
          </div>
          <img src="/recommnderwhite.svg" alt="RECOMMNDER" className="h-4 opacity-30" />
        </div>
      </footer>
    </div>
  );
}
