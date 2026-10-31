import { createResidenceMediaService } from "@/lib/sales/media-service";
import { getSalesDb } from "@/lib/sales/db";
export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const { key } = await params;
  try {
    return Response.json(
      await createResidenceMediaService(getSalesDb()).publicManifest(
        key,
        new URL(request.url).searchParams.get("residenceId"),
      ),
      {
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch {
    return Response.json(
      { contractVersion: 1, assets: [], unavailable: true },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
