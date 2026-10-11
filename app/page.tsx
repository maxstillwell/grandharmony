import Link from "next/link";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { Header } from "@/components/corporate/header";
import { ProjectCard } from "@/components/corporate/project-card";
import { publicProjects } from "@/lib/data/projects";

const expertise = [
  ["01", "Property Investment", "A measured approach to opportunities with long-term potential."],
  ["02", "Land Acquisition & Planning", "Strategic site selection informed by place and feasibility."],
  ["03", "Residential Development", "Thoughtful residential outcomes shaped with care and clarity."],
  ["04", "Asset Management", "Long-term stewardship across the life of an asset."],
];

function ArchitecturalStudy() {
  return <div className="relative mt-14 overflow-hidden border border-[#E2E0D9] bg-[#EFECE6]">
    <div className="architectural-grid absolute inset-0 opacity-70" />
    <div className="relative flex min-h-[390px] items-center justify-center bg-gradient-to-t from-[#F7F6F3] via-transparent to-transparent p-7 sm:min-h-[500px] sm:p-12">
      <svg viewBox="0 0 800 400" className="h-full w-full max-w-4xl fill-none stroke-[#1A1B1E]/80" aria-label="Conceptual architectural elevation" role="img">
        <line x1="50" y1="350" x2="750" y2="350" strokeWidth="1.5" />
        <line x1="50" y1="50" x2="50" y2="350" strokeWidth="0.5" strokeDasharray="4 4" />
        <line x1="750" y1="50" x2="750" y2="350" strokeWidth="0.5" strokeDasharray="4 4" />
        <polygon points="100,350 100,180 220,140 220,350" strokeWidth="1.2" />
        <polygon points="220,350 220,140 340,110 340,350" strokeWidth="1.2" />
        <polygon points="340,350 340,110 460,130 460,350" strokeWidth="1.2" />
        <polygon points="460,350 460,130 580,160 580,350" strokeWidth="1.2" />
        <polygon points="580,350 580,160 700,190 700,350" strokeWidth="1.2" />
        {[120, 160, 200].map((y) => <line key={y} x1="120" y1={y + 40} x2="200" y2={y + 40} strokeWidth="0.7" />)}
        {[160, 200].map((y) => <line key={y} x1="240" y1={y} x2="320" y2={y} strokeWidth="0.7" />)}
        {[150, 190].map((y) => <line key={y} x1="360" y1={y} x2="440" y2={y} strokeWidth="0.7" />)}
        <text x="60" y="375" fill="#5A6258" stroke="none" className="mono text-[10px]">CONCEPTUAL ELEVATION / NOT FOR CONSTRUCTION</text>
        <text x="590" y="375" fill="#5A6258" stroke="none" className="mono text-[10px]">SCALE 1:200</text>
      </svg>
      <div className="absolute bottom-5 left-5 right-5 flex flex-col gap-4 border border-[#E2E0D9] bg-[#F7F6F3]/95 p-5 backdrop-blur sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div><p className="eyebrow">Featured development</p><h2 className="mt-1 text-xl font-normal">700 Project — Vermont South, Victoria</h2><p className="mt-1 text-xs text-[#7A7C80]">Public project overview · planning and development stage</p></div>
        <span className="mono border border-[#E2E0D9] px-3 py-2 text-[10px] tracking-[.08em]">47 PROPOSED TOWNHOUSES</span>
      </div>
    </div>
  </div>;
}

export default function Home() {
  return <main><Header />
    <section className="mx-auto max-w-7xl px-6 pb-20 pt-16 sm:pt-24 lg:px-10">
      <div className="grid items-end gap-12 lg:grid-cols-12"><div className="lg:col-span-8"><div className="flex items-center gap-3"><span className="h-2 w-2 bg-[#5A6258]" /><p className="eyebrow">Property investment & land development · Melbourne</p></div><h1 className="display mt-7 text-5xl leading-[1.04] sm:text-6xl lg:text-7xl">Thoughtful Investment.<br /><em className="font-normal">Enduring Value.</em></h1></div><div className="space-y-5 text-sm font-light leading-7 text-[#7A7C80] lg:col-span-4"><p className="font-normal text-[#1A1B1E]">Grand Harmony is a Melbourne-based property investment and development company focused on strategic land acquisition, residential development and long-term asset creation.</p><p>Our approach brings considered analysis, clarity and care to every opportunity.</p><a href="#projects" className="mono inline-flex items-center gap-2 border-b border-[#1A1B1E] pb-1 text-[10px] tracking-[.12em] text-[#1A1B1E] transition-colors hover:border-[#5A6258] hover:text-[#5A6258]">EXPLORE SELECTED PROJECTS <ArrowDown size={13} /></a></div></div>
      <ArchitecturalStudy />
      <div className="mono mt-8 grid gap-6 text-[10px] tracking-[.06em] text-[#7A7C80] sm:grid-cols-3">{[["01 / STRATEGIC LAND", "MELBOURNE"], ["02 / RESIDENTIAL DEVELOPMENT", "LONG-TERM VIEW"], ["03 / ASSET STEWARDSHIP", "CONSIDERED APPROACH"]].map(([label, value]) => <div className="flex justify-between border-t border-[#E2E0D9] pt-4" key={label}><span>{label}</span><span className="text-[#1A1B1E]">{value}</span></div>)}</div>
    </section>
    <section id="about" className="border-y border-[#E2E0D9] bg-white px-6 py-20 lg:px-10"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12"><div className="lg:col-span-4"><p className="eyebrow">Company overview</p><h2 className="display mt-3 text-3xl leading-tight">Disciplined stewardship & value creation.</h2></div><div className="space-y-8 text-sm font-light leading-7 text-[#7A7C80] lg:col-span-7 lg:col-start-6"><p className="text-base font-normal text-[#1A1B1E]">We identify enduring potential, then bring clarity and care to its realisation.</p><div className="grid gap-8 border-t border-[#E2E0D9] pt-7 sm:grid-cols-2"><div><p className="eyebrow text-[#1A1B1E]">01. Investment discipline</p><p className="mt-3">A long-term perspective guides each opportunity from early assessment through delivery.</p></div><div><p className="eyebrow text-[#1A1B1E]">02. Spatial integrity</p><p className="mt-3">We respect place, context and the lasting contribution of considered development.</p></div></div></div></div></section>
    <section id="expertise" className="bg-[#F7F6F3] px-6 py-20 lg:px-10"><div className="mx-auto max-w-7xl"><div className="flex flex-col gap-5 border-b border-[#E2E0D9] pb-6 sm:flex-row sm:items-end sm:justify-between"><div><p className="eyebrow">Core capabilities</p><h2 className="display mt-2 text-3xl">Specialised property capabilities.</h2></div><p className="mono text-[10px] tracking-[.12em] text-[#7A7C80]">ESTABLISHED WORKFLOWS</p></div><div className="mt-10 grid gap-px border border-[#E2E0D9] bg-[#E2E0D9] md:grid-cols-4">{expertise.map(([number, title, description]) => <article className="bg-white p-7 transition-colors hover:bg-[#EFECE6]" key={title}><p className="mono text-[11px] text-[#5A6258]">{number}</p><h3 className="mt-12 text-lg font-medium tracking-[-.025em]">{title}</h3><p className="mt-4 text-xs leading-5 text-[#7A7C80]">{description}</p></article>)}</div></div></section>
    <section id="projects" className="mx-auto max-w-7xl px-6 py-20 lg:px-10"><div className="flex items-end justify-between border-b border-[#E2E0D9] pb-6"><div><p className="eyebrow">Portfolio</p><h2 className="display mt-2 text-3xl">Selected developments.</h2></div><Link href="/projects/700-project" className="mono hidden items-center gap-2 text-[10px] tracking-[.1em] sm:flex">VIEW PROJECT <ArrowUpRight size={14} /></Link></div><div className="mt-12 grid gap-12 md:grid-cols-2">{publicProjects.map((project) => <ProjectCard key={project.slug} project={project} />)}</div></section>
    <section id="contact" className="border-t border-[#E2E0D9] bg-white px-6 py-20 lg:px-10"><div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-12"><div className="lg:col-span-5"><p className="eyebrow">Correspondence</p><h2 className="display mt-3 text-3xl">Begin a considered conversation.</h2></div><div className="lg:col-span-6 lg:col-start-7"><p className="max-w-lg text-sm leading-7 text-[#7A7C80]">Contact details will be published once confirmed. Enquiries are not collected through this website at this stage.</p><a href="mailto:contact@example.com" className="mono mt-8 inline-flex border-b border-[#1A1B1E] pb-2 text-[10px] tracking-[.1em]">CONTACT DETAILS COMING SOON <ArrowUpRight className="ml-2" size={14} /></a></div></div></section>
    <footer className="border-t border-[#E2E0D9] bg-[#F7F6F3] px-6 py-8 lg:px-10"><div className="mono mx-auto flex max-w-7xl flex-col gap-4 text-[10px] text-[#7A7C80] sm:flex-row sm:items-center sm:justify-between"><p><span className="font-sans text-sm font-medium text-[#1A1B1E]">GRAND HARMONY</span><span className="ml-3">Melbourne, Australia</span></p><div className="flex gap-6"><Link href="/portal" className="text-[#1A1B1E] underline underline-offset-4">Portal access</Link><span>© {new Date().getFullYear()}</span></div></div></footer>
  </main>;
}
