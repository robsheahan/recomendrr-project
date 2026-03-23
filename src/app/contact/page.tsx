import Link from 'next/link';

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="text-lg font-black tracking-tighter">
          RECOMMNDER
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <h1 className="text-2xl font-bold">Contact</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-zinc-400">
          <p>
            Have a question, feedback, or just want to say hello? We&apos;d love to hear from you.
          </p>
          <p>
            Email us at{' '}
            <a
              href="mailto:hello@recommnder.com"
              className="text-white underline"
            >
              hello@recommnder.com
            </a>
          </p>
        </div>
      </main>

      <footer className="border-t border-zinc-800 px-6 py-6 text-center">
        <p className="text-xs text-zinc-700">RECOMMNDER</p>
      </footer>
    </div>
  );
}
