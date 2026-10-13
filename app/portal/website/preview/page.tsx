import { CorporateSite } from "@/components/corporate/corporate-site";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getWebsiteWorkspace } from "@/lib/website/data";
import { defaultWebsiteContent } from "@/lib/website/types";

export default async function WebsitePreviewPage() { await requireSuperAdmin(); const workspace = await getWebsiteWorkspace(); return <CorporateSite content={workspace.draft?.content ?? workspace.published?.content ?? defaultWebsiteContent} preview />; }
