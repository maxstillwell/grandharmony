import Link from "next/link";
import { auth } from "@/auth";
import { isBootstrapIdentity } from "@/lib/auth/access";
import { initializeSuperAdmin } from "@/lib/admin/bootstrap";

export default async function InitializeAdminPage() {
  const session = await auth();
  if (!await isBootstrapIdentity(session?.user?.email)) return <main className="grid min-h-screen place-items-center bg-[#F8F8F6] px-6"><section className="max-w-lg border border-[#EBE8E1] bg-white p-8"><h1 className="display text-3xl">Administrator setup is unavailable.</h1><p className="mt-4 text-sm text-[#5C5E64]">This route is available only to the configured bootstrap identity after Google sign-in.</p><Link className="mt-6 inline-block text-xs underline" href="/login">Return to sign in</Link></section></main>;
  return <main className="grid min-h-screen place-items-center bg-[#121316] px-6 text-white"><section className="w-full max-w-md border border-white/15 bg-white/[.03] p-8"><p className="eyebrow text-[#B8B3A8]">Protected bootstrap</p><h1 className="display mt-3 text-4xl">Initialize Super Admin.</h1><p className="mt-5 text-sm leading-6 text-white/65">This one-time action assigns the configured bootstrap identity as the first Super Admin. It cannot be used to create an unapproved account.</p><form className="mt-8 space-y-4" action={initializeSuperAdmin}><label className="block text-xs">Bootstrap token<input name="token" type="password" required className="mt-2 w-full border border-white/20 bg-transparent px-3 py-2 text-white" autoComplete="one-time-code" /></label><button className="w-full bg-white px-4 py-3 text-sm font-medium text-[#121316]">Initialize Super Admin</button></form></section></main>;
}
