import { WebsiteManager } from "@/components/website/website-manager";
import { requireSuperAdmin } from "@/lib/auth/guards";
import { getWebsiteWorkspace } from "@/lib/website/data";

export default async function WebsiteManagementPage() {
  await requireSuperAdmin();
  try { const workspace = await getWebsiteWorkspace(); return <WebsiteManager initialDraft={workspace.draft} published={workspace.published} releases={workspace.releases} blobReady={Boolean(process.env.BLOB_READ_WRITE_TOKEN)} />; }
  catch { return <main className="portal-page"><div className="portal-page-inner"><p className="portal-kicker">Website Management</p><h1 className="portal-page-title">Database migration required</h1><p className="portal-helper">The Website Management tables have not been applied yet. The public website remains safely on its current published fallback content until the migration is run.</p></div></main>; }
}
