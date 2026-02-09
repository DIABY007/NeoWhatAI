import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans">
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-32 px-16">
        <h1 className="text-4xl font-bold text-black mb-4">
          WhatsApp AI Automation SaaS
        </h1>
        <p className="text-lg text-zinc-600 mb-8">
          Plateforme SaaS pour chatbots WhatsApp intelligents basés sur RAG
        </p>
        <div className="flex gap-4">
          <Link
            href="/admin/clients"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Dashboard Admin
          </Link>
        </div>
      </main>
    </div>
  );
}
