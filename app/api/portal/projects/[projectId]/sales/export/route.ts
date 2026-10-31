import { NextRequest, NextResponse } from "next/server";
import { requirePortalAccess } from "@/lib/auth/guards";
import { createSalesService } from "@/lib/sales/service";
import { getSalesDb } from "@/lib/sales/db";
import { importColumns, validId } from "@/lib/sales/domain";
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
    const csv =
      kind === "template"
        ? importColumns.join(",") + "\r\n"
        : await createSalesService(getSalesDb()).exportCsv(
            access,
            projectId,
            kind,
          );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="sales-${kind.replace(/[^a-z]/g, "")}.csv"`,
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
