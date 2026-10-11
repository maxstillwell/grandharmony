import Image from "next/image";
import Link from "next/link";
import type { PublicProject } from "@/lib/data/projects";

export function ProjectCard({ project }: { project: PublicProject }) {
  return <article className="group border-t border-[#EBE8E1] pt-4">
    <Link href={`/projects/${project.slug}`} className="block">
      <div className="relative aspect-[16/10] overflow-hidden bg-[#E8E7E2]">
        <Image src={project.image} alt={project.imageAlt} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover transition duration-700 group-hover:scale-[1.03]" />
      </div>
      <div className="mt-5 flex gap-4"><p className="eyebrow w-20 shrink-0">{project.status}</p><div><h3 className="text-xl tracking-[-0.03em]">{project.name}</h3><p className="mt-1 text-sm text-[#5C5E64]">{project.location}</p><p className="mt-4 max-w-md text-sm leading-6 text-[#5C5E64]">{project.summary}</p></div></div>
    </Link>
  </article>;
}
