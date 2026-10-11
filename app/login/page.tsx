import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, googleConfigured, signIn } from "@/auth";
import { isDatabaseConfigured } from "@/lib/db";

const message = { signin_required: "Sign in is required to access the internal portal.", unauthorized: "Your account has not been approved for Portal access." } as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: keyof typeof message }> }) {
  const session = await auth();
  if (session?.user?.email) redirect("/portal");
  const { reason } = await searchParams;
  const ready = googleConfigured && isDatabaseConfigured();
  return <main className="grid min-h-screen place-items-center bg-[#121316] px-6 text-white"><section className="w-full max-w-md border border-white/15 bg-white/[.03] p-8"><Link href="/" className="text-xs font-semibold tracking-[.18em]">GRAND HARMONY</Link><p className="mono mt-16 text-[10px] uppercase tracking-[.15em] text-[#B8B3A8]">Internal portal</p><h1 className="display mt-4 text-4xl">Secure access.</h1><p className="mt-5 text-sm leading-6 text-white/65">Only accounts approved by a Grand Harmony Super Admin can enter the Portal.</p>{reason && <p role="alert" className="mt-5 border border-[#9A6A27]/60 bg-[#9A6A27]/15 p-3 text-xs text-[#F6D6A4]">{message[reason]}</p>}{ready ? <form className="mt-8" action={async () => { "use server"; await signIn("google", { redirectTo: "/portal" }); }}><button className="w-full border border-white bg-white px-4 py-3 text-sm font-medium text-[#121316] transition hover:bg-[#F1F0EC] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">Continue with Google</button></form> : <p className="mono mt-8 border border-white/15 p-3 text-[10px] leading-5 text-white/50">AUTHENTICATION SETUP PENDING · DATABASE AND GOOGLE OAUTH MUST BE CONFIGURED BY AN ADMINISTRATOR.</p>}<Link href="/" className="mt-8 inline-block text-xs text-white/50 underline-offset-4 hover:underline">Return to website</Link></section></main>;
}
