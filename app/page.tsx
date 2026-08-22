import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-heading flex flex-col items-center justify-center px-6 text-center">
      <div className="font-serif text-5xl sm:text-6xl font-medium text-warning">CertFlow</div>
      <div className="mt-3 text-[13px] tracking-[0.2em] uppercase text-placeholder">Certification Records</div>
      <div className="mt-10 flex flex-col sm:flex-row gap-4">
        <Link href="/login" className="px-6 py-3 rounded-md bg-warning text-heading font-semibold text-sm hover:bg-warning">
          Certifier sign in
        </Link>
        <Link href="/client-login" className="px-6 py-3 rounded-md border border-muted text-white font-semibold text-sm hover:bg-heading">
          Client portal sign in
        </Link>
      </div>
    </div>
  );
}
