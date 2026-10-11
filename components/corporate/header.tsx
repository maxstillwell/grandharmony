import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-white/20 bg-[#121316] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-10">
        <Link href="/" className="text-sm font-semibold tracking-[0.18em]" aria-label="Grand Harmony home">GRAND HARMONY</Link>
        <nav className="hidden items-center gap-7 text-xs text-white/75 md:flex" aria-label="Main navigation">
          <a href="#about">About</a><a href="#expertise">Expertise</a><a href="#projects">Projects</a><a href="#contact">Contact</a>
          <Link href="/portal" className="border-l border-white/25 pl-7 text-white">Portal access</Link>
        </nav>
        <Link href="/portal" className="text-xs text-white/80 md:hidden">Portal</Link>
      </div>
    </header>
  );
}
