import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePortalAccess } from "@/lib/auth/guards";
import { assertSales } from "@/lib/sales/permissions";
import { resolveSalesScope } from "@/lib/sales/workspace-scope";
import { getSalesDb } from "@/lib/sales/db";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; file: string }> },
) {
  const access = await requirePortalAccess(),
    { projectId, file } = await params;
  try {
    assertSales(access, projectId, "inventory.edit");
    if (
      new URL(request.url).searchParams.get("demo") !== "1" ||
      !["a.svg", "b.svg"].includes(file)
    )
      throw Error("Test fixture unavailable");
    await resolveSalesScope(getSalesDb(), access, projectId, true);
    return new Response(
      await readFile(path.join(process.cwd(), "assets/sales-media-test", file)),
      {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "private, no-store",
          "X-Robots-Tag": "noindex, nofollow",
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      },
    );
  } catch {
    return new Response("Not authorised", { status: 403 });
  }
}
