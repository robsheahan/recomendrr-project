import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/"><img src="/recommnderwhite.svg" alt="RECOMMNDER" className="h-6" /></Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-bold">Privacy Policy</h1>
        <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-400">
          <p>Last updated: March 2026</p>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">Information We Collect</h2>
            <p>We collect the following information when you use Recommnder:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Email address and display name (account creation)</li>
              <li>Media ratings and preferences you provide</li>
              <li>Recommendation feedback (thumbs up/down)</li>
              <li>Usage data (categories selected, recommendations generated)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">How We Use Your Information</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>To generate personalised recommendations based on your taste profile</li>
              <li>To improve recommendation quality through your feedback</li>
              <li>To provide collaborative filtering signals (anonymised taste matching with other users)</li>
              <li>To communicate with you about your account</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">Data Sharing</h2>
            <p>We do not sell your personal data. Aggregated, anonymised taste data may be used to improve recommendations for all users. We use the following third-party services:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Supabase (authentication and database hosting)</li>
              <li>OpenAI (recommendation generation)</li>
              <li>Vercel (application hosting)</li>
              <li>TMDB, Spotify, Google Books, OMDB (media metadata)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">Data Security</h2>
            <p>Your data is stored securely using Supabase with row-level security policies. Passwords are hashed and never stored in plain text.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">Your Rights</h2>
            <p>You can request deletion of your account and all associated data at any time by contacting us at{' '}
              <a href="mailto:hello@recommnder.com" className="text-white underline">hello@recommnder.com</a>.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use tracking or advertising cookies.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">Changes to This Policy</h2>
            <p>We may update this privacy policy from time to time. We will notify you of any material changes via email or a notice on the service.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-6 text-center">
        <img src="/recommnderwhite.svg" alt="RECOMMNDER" className="h-4 opacity-30" />
      </footer>
    </div>
  );
}
