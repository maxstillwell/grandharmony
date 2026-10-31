import { NextResponse } from "next/server";
import { createSalesService } from "@/lib/sales/service";
import { getSalesDb } from "@/lib/sales/db";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    const data = await createSalesService(getSalesDb()).publicInventory(key);
    data.enquiry.enabled =
      data.enquiry.enabled &&
      (process.env.GOLFVIEW_ENQUIRY_TOKEN?.length ?? 0) >= 32;
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    // Safe empty contract, with a failure status so clients can distinguish an
    // unavailable backend from a genuine approved empty publication.
    return NextResponse.json(
      {
        contractVersion: 1,
        projectKey: key,
        revision: 0,
        units: [],
        enquiry: { enabled: false, privacyVersion: null, privacyNotice: null },
        unavailable: true,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
