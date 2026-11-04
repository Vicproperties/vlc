import { siteConfig } from "@/config/site";

/** Centered layout for sign-in, code verification and password pages. */
export default function AdminAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="px-6 py-8 sm:px-10">
        <p className="font-serif text-h4 text-ink">{siteConfig.name}</p>
        <p className="text-caption tracking-[0.14em] text-stone uppercase">Administration</p>
      </header>
      <main id="main" className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-[26rem] border border-line bg-paper px-6 py-8 sm:px-10 sm:py-10">{children}</div>
      </main>
    </div>
  );
}
