import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6 text-center">
      <div className="font-serif text-5xl sm:text-6xl font-medium text-amber-300">CertFlow</div>
      <div className="mt-3 text-[13px] tracking-[0.2em] uppercase text-slate-400">Certification Records</div>
      <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <Link href="/login" className="px-6 py-3 rounded-md bg-amber-600 text-slate-900 font-semibold text-sm hover:bg-amber-500">
          Certifier sign in
        </Link>
        <Link href="/client-login" className="px-6 py-3 rounded-md border border-slate-600 text-slate-200 font-semibold text-sm hover:bg-slate-800">
          Client portal sign in
        </Link>
      </div>
    </div>
  );
}
