import { CorporateSite } from "@/components/corporate/corporate-site";
import { getPublishedWebsiteContent } from "@/lib/website/data";

export default async function Home() { return <CorporateSite content={await getPublishedWebsiteContent()} />; }
