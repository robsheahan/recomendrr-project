import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/"><img src="/recommnderwhite.svg" alt="RECOMMNDER" className="h-6" /></Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-bold">Terms & Conditions</h1>
        <div className="mt-6 space-y-6 text-sm leading-relaxed text-zinc-400">
          <p>Last updated: March 2026</p>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">1. Acceptance of Terms</h2>
            <p>By accessing and using Recommnder, you agree to be bound by these terms and conditions. If you do not agree, please do not use the service.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">2. Description of Service</h2>
            <p>Recommnder is a personalised media recommendation platform that uses artificial intelligence to suggest movies, TV shows, books, music, and podcasts based on your taste profile and ratings.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">3. User Accounts</h2>
            <p>You are responsible for maintaining the security of your account and password. You must provide accurate information when creating your account.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">4. User Data</h2>
            <p>Your ratings, preferences, and feedback are used to improve your personalised recommendations. We may use aggregated, anonymised data to improve the service for all users.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">5. Third-Party Services</h2>
            <p>Recommnder uses third-party APIs (TMDB, Spotify, Google Books, OMDB) for media metadata. We are not responsible for the accuracy or availability of third-party data.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">6. Limitation of Liability</h2>
            <p>Recommnder is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the service.</p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-semibold text-zinc-200">7. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. Continued use of the service constitutes acceptance of updated terms.</p>
          </section>
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-6 text-center">
        <img src="/recommnderwhite.svg" alt="RECOMMNDER" className="h-4 opacity-30" />
      </footer>
    </div>
  );
}
