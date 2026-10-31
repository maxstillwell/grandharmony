import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePortalAccess } from "@/lib/auth/guards";
import { canReviewSalesMap } from "@/lib/sales/projects";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const access = await requirePortalAccess();
  const { projectId } = await params;
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  if (!canReviewSalesMap(access, projectId))
    return new Response("Not found", { status: 404, headers });
  try {
    const svg = await readFile(
      path.join(process.cwd(), "assets/sales/golfview-review/masterplan.svg"),
    );
    return new Response(new Uint8Array(svg), {
      headers: { ...headers, "Content-Type": "image/svg+xml" },
    });
  } catch {
    return new Response("Review drawing unavailable", { status: 503, headers });
  }
}
