import { type NextRequest } from "next/server";
import { auth } from "@/auth";
import { getPortalAccess } from "@/lib/auth/access";
import { getAccessibleModel } from "@/lib/models/data";
import { feasibilityDocument } from "@/lib/models/html-adapter";

export async function GET(request: NextRequest, { params }: { params: Promise<{ modelId: string }> }) {
  const session = await auth();
  if (!session?.user?.email) return new Response("Sign in required", { status: 401 });
  const access = await getPortalAccess(session.user.email);
  if (!access) return new Response("Forbidden", { status: 403 });
  const { modelId } = await params;
  const instance = request.nextUrl.searchParams.get("instance");
  if (!/^[0-9a-f-]{36}$/i.test(modelId) || !instance || !/^[0-9a-f-]{36}$/i.test(instance)) return new Response("Invalid model request", { status: 400 });
  const model = await getAccessibleModel(access, modelId);
  if (!model || model.adapterKey !== "700-feasibility-v1") return new Response("Not found", { status: 404 });
  return new Response(feasibilityDocument(model.id, instance, request.nextUrl.origin), { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox allow-scripts allow-modals; default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'" } });
}
