import { notFound } from "next/navigation";
import { SharedSpecificationRunner } from "@/components/models/shared-specification-runner";
import { getSharedSpecification } from "@/lib/models/share-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Shared Specification" };

export default async function SharedSpecificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let shared = null;
  try { shared = await getSharedSpecification(token); } catch { /* collaboration migration is not yet installed */ }
  if (!shared) notFound();
  return <SharedSpecificationRunner token={token} shared={shared} />;
}
