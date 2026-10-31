import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/guards";
import { createSalesService } from "@/lib/sales/service";
import { getSalesDb } from "@/lib/sales/db";
import { importColumns, validId } from "@/lib/sales/domain";
import { resolveSalesScope } from "@/lib/sales/workspace-scope";
import { createPlatformService } from "@/lib/sales/platform-service";
import { assertSales } from "@/lib/sales/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const access = await requirePortalAccess();
  const { projectId } = await params;
  try {
    if (!validId(projectId)) throw new Error("Invalid project.");
    const kind = request.nextUrl.searchParams.get("kind") ?? "inventory";
    assertSales(
      access,
      projectId,
      kind === "template" ? "inventory.edit" : "inventory.view",
    );
    const scopeKey = await resolveSalesScope(
      getSalesDb(),
      access,
      projectId,
      request.nextUrl.searchParams.get("mode") === "demo",
    );
    const csv =
      kind === "template"
        ? importColumns.join(",") + "\r\n"
        : await (["inventory", "prices", "leads"].includes(kind)
            ? createSalesService(getSalesDb(), scopeKey).exportCsv(
                access,
                projectId,
                kind,
              )
            : createPlatformService(getSalesDb(), scopeKey).exportReport(
                access,
                projectId,
                kind,
                Object.fromEntries(["from","to","stage","agent"].map(k=>[k,request.nextUrl.searchParams.get(k)??""])),
              ));
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${scopeKey === "real" ? "REAL" : "DEMO"}-sales-${kind.replace(/[^a-z]/g, "")}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Export unavailable or not authorised." },
      { status: 403 },
    );
  }
}
