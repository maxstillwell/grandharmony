import Image from "next/image";
import Link from "next/link";
import type { PublicProject } from "@/lib/data/projects";

export function ProjectCard({ project }: { project: PublicProject }) {
  return <article className="group">
    <Link href={`/projects/${project.slug}`} className="block">
      <div className="border border-[#E2E0D9] bg-white p-2 transition-colors duration-300 group-hover:border-[#1A1B1E]"><div className="relative aspect-[16/10] overflow-hidden bg-[#EFECE6]">
        <Image src={project.image} alt={project.imageAlt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.025]" />
        <p className="mono absolute left-3 top-3 border border-[#E2E0D9] bg-[#F8F8F6]/90 px-2 py-1 text-[9px] uppercase tracking-[.12em] text-[#5A6258]">{project.status}</p>
      </div>
      </div>
      <div className="mt-5 flex items-start justify-between gap-5"><div><p className="eyebrow">{project.location}</p><h3 className="mt-2 text-xl font-normal tracking-[-.03em]">{project.name}</h3><p className="mt-3 max-w-md text-sm leading-6 text-[#7A7C80]">{project.summary}</p></div><span className="mono shrink-0 border border-[#E2E0D9] px-2 py-1 text-[10px] text-[#1A1B1E] transition-colors group-hover:bg-[#1A1B1E] group-hover:text-white">OPEN ↗</span></div>
    </Link>
  </article>;
}
