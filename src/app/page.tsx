import Link from 'next/link';

const CATEGORIES = [
  { icon: '🎥', label: 'Movies' },
  { icon: '📺', label: 'TV Shows' },
  { icon: '🎬', label: 'Documentaries' },
  { icon: '📚', label: 'Books' },
  { icon: '🎙️', label: 'Podcasts' },
  { icon: '🎵', label: 'Music' },
];

const FEATURES = [
  {
    title: 'Your taste, decoded',
    description:
      'We analyse your ratings to build a deep taste profile — not just what you like, but why you like it.',
  },
  {
    title: 'Tell us your mood',
    description:
      'In the mood for a mind-bending thriller? Something gentle and feel-good? Just tell us and we\'ll find it.',
  },
  {
    title: 'Hidden gems, not obvious picks',
    description:
      'Every recommendation set includes something you\'d never find on your own — foreign films, indie releases, overlooked classics.',
  },
  {
    title: 'Explanations that teach',
    description:
      'We don\'t just say "because you liked X." We explain the connection at the level of themes, tone, and pacing.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Hero */}
      <div className="flex min-h-[85vh] flex-col items-center justify-center px-6 text-center">
        <div className="space-y-6">
          <h1 className="text-5xl font-black tracking-tighter sm:text-7xl">
            RECOMMENDR
          </h1>
          <p className="mx-auto max-w-xs text-base leading-relaxed text-zinc-400 sm:max-w-sm sm:text-lg">
            Discover movies, shows, books and music you&apos;ll love — tailored
            to your taste by AI that actually gets you.
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
              key={cat.label}
              className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-xs text-zinc-400"
            >
              {cat.icon} {cat.label}
            </span>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="border-t border-zinc-800 px-6 py-16">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
          How it works
        </h2>
        <div className="mx-auto mt-8 max-w-sm space-y-6">
          {[
            { step: '1', text: 'Rate 15 movies, shows or books you know' },
            { step: '2', text: 'We build your unique taste fingerprint' },
            { step: '3', text: 'Get personalised recommendations you\'ll actually love' },
          ].map((item) => (
            <div key={item.step} className="flex items-start gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-bold text-zinc-300">
                {item.step}
              </span>
              <p className="pt-1 text-sm leading-relaxed text-zinc-300">
                {item.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="border-t border-zinc-800 px-6 py-16">
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Why Recommendr
        </h2>
        <div className="mx-auto mt-8 max-w-sm space-y-8">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h3 className="text-sm font-semibold text-zinc-100">
                {feature.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Not Netflix */}
      <div className="border-t border-zinc-800 px-6 py-16">
        <div className="mx-auto max-w-sm rounded-2xl bg-zinc-900 p-6">
          <h3 className="text-sm font-semibold text-zinc-100">
            This isn&apos;t Netflix recommendations
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            Netflix recommends what keeps you watching. We recommend what
            genuinely moves you. No catalog to sell, no engagement metrics —
            just an AI concierge that understands your taste across every type
            of media.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-zinc-800 px-6 py-16 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Ready to discover something new?
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          Free to start. No credit card required.
        </p>
        <Link
          href="/auth/signup"
          className="mt-6 inline-block rounded-full bg-white px-8 py-3 text-sm font-semibold text-zinc-900 transition-transform active:scale-95"
        >
          Create your profile
        </Link>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 px-6 py-8 text-center">
        <p className="text-xs text-zinc-600">
          RECOMMENDR
        </p>
      </div>
    </div>
  );
}
