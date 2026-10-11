import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#E2E0D9] bg-[#F8F8F6]/95 text-[#1A1B1E] backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="text-lg font-medium tracking-[-.04em] sm:text-xl" aria-label="Grand Harmony home">GRAND HARMONY</Link>
        <nav className="hidden items-center gap-8 text-[10px] font-medium uppercase tracking-[.14em] md:flex" aria-label="Main navigation">
          <a href="#about" className="link-underline">About</a><a href="#expertise" className="link-underline">Expertise</a><a href="#projects" className="link-underline">Projects</a><a href="#contact" className="link-underline">Contact</a>
          <Link href="/portal" className="mono border border-[#1A1B1E] px-3 py-2 text-[10px] tracking-[.1em] transition-colors hover:bg-[#1A1B1E] hover:text-[#F8F8F6]">Portal access →</Link>
        </nav>
        <Link href="/portal" className="mono border border-[#1A1B1E] px-3 py-2 text-[10px] md:hidden">Portal →</Link>
      </div>
    </header>
  );
}
