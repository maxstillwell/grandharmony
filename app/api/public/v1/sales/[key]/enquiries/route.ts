import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getSalesDb } from "@/lib/sales/db";
import { createSalesService } from "@/lib/sales/service";
import { salesProjects } from "@/lib/db/schema";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const token = process.env.GOLFVIEW_ENQUIRY_TOKEN;
  const supplied =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !token ||
    token.length < 32 ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(token) ||
    !timingSafeEqual(Buffer.from(token), Buffer.from(supplied))
  )
    return NextResponse.json(
      { error: "Submission channel unavailable." },
      { status: 403 },
    );
  if (Number(request.headers.get("content-length") ?? 0) > 12000)
    return NextResponse.json({ error: "Request too large." }, { status: 413 });
  try {
    const raw = await request.text();
    if (raw.length > 12000) throw new Error("Request too large.");
    const input = JSON.parse(raw);
    const { key } = await params;
    const db = getSalesDb();
    const [settings] = await db
      .select({ projectId: salesProjects.projectId })
      .from(salesProjects)
      .where(eq(salesProjects.publicKey, key));
    if (!settings) throw new Error("Unknown project.");
    await createSalesService(db).createLead(
      null,
      settings.projectId,
      input,
      request.headers.get("x-enquiry-client") ?? "",
    );
    return NextResponse.json(
      { ok: true },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const limited =
      error instanceof Error && error.message.startsWith("Too many enquiries");
    return NextResponse.json(
      {
        error: limited
          ? "Too many enquiries. Please try again later."
          : "Please check the form and privacy acknowledgement, or try again later.",
      },
      {
        status: limited ? 429 : 400,
        headers: {
          "Cache-Control": "no-store",
          ...(limited ? { "Retry-After": "900" } : {}),
        },
      },
    );
  }
}
