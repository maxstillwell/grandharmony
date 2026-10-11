import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Header } from "@/components/corporate/header";
import { publicProjects } from "@/lib/data/projects";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const project = publicProjects.find((item) => item.slug === slug); if (!project) notFound();
  return <main><Header /><article className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-20"><Link href="/#projects" className="inline-flex items-center gap-2 text-xs text-[#5C5E64]"><ArrowLeft size={15} /> Selected projects</Link><div className="mt-14 grid gap-10 lg:grid-cols-12"><div className="lg:col-span-7"><p className="eyebrow">{project.status}</p><h1 className="display mt-5 text-5xl sm:text-7xl">{project.name}</h1><p className="mt-6 text-lg text-[#5C5E64]">{project.location}</p><p className="mt-12 max-w-xl text-base leading-7 text-[#5C5E64]">{project.summary} This page is driven by approved public-content data only and is designed to be extended as information is confirmed for publication.</p></div><div className="relative aspect-[4/3] overflow-hidden bg-[#E8E7E2] lg:col-span-5"><Image src={project.image} alt={project.imageAlt} fill sizes="(max-width: 1024px) 100vw, 42vw" className="object-cover" /></div></div></article></main>;
}
