import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/auth";
import { requirePortalAccess } from "@/lib/auth/guards";

export default async function PortalHome() {
  const access = await requirePortalAccess();
  if (!access.projects.length) return <main className="grid min-h-screen place-items-center bg-[#F8F8F6] px-6"><section className="max-w-lg border border-[#EBE8E1] bg-white p-8"><p className="eyebrow">Portal</p><h1 className="display mt-3 text-4xl">No project access assigned.</h1><p className="mt-5 text-sm leading-6 text-[#5C5E64]">Your account is authenticated, but a Super Admin has not assigned a project workspace yet.</p><form className="mt-8" action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button className="border border-[#121316] px-4 py-2 text-xs">Sign out</button></form></section></main>;
  if (access.projects.length === 1) redirect(`/portal/projects/${access.projects[0].id}`);
  return <main className="min-h-screen bg-[#F8F8F6] px-6 py-10 text-[#121316]"><div className="mx-auto max-w-5xl"><header className="flex items-center justify-between border-b border-[#EBE8E1] pb-6"><div><p className="eyebrow">Portal</p><h1 className="display mt-2 text-4xl">Choose a project.</h1></div><form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}><button className="text-xs underline">Sign out</button></form></header><p className="mt-5 text-sm text-[#5C5E64]">Signed in as {access.name ?? access.email} · {access.role.replaceAll("_", " ")}</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{access.projects.map((project) => <Link className="border border-[#EBE8E1] bg-white p-6 transition hover:border-[#121316]" href={`/portal/projects/${project.id}`} key={project.id}><p className="eyebrow">{project.membershipRole.replaceAll("_", " ")}</p><h2 className="mt-3 text-xl">{project.name}</h2><p className="mt-2 text-sm text-[#5C5E64]">Open workspace →</p></Link>)}</div></div></main>;
}
