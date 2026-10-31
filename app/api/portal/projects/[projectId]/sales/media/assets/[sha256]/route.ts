import { requirePortalAccess } from "@/lib/auth/guards";
import { getSalesDb } from "@/lib/sales/db";
import { privateMediaResponse } from "@/lib/sales/private-media-response";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sha256: string }> },
) {
  const access = await requirePortalAccess();
  const { projectId, sha256 } = await params;
  return privateMediaResponse(
    getSalesDb(),
    access,
    projectId,
    sha256,
    new URL(request.url).searchParams.get("demo") === "1",
  );
}
