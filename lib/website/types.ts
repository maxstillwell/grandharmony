export type WebsiteSectionKey = "about" | "experience" | "construction" | "expertise" | "team" | "developments" | "contact";
export type WebsiteSection = { heading: string; subtitle?: string; body: string; visible: boolean };
export type WebsiteContent = {
  hero: { mode: "image" | "video"; mediaUrl: string; posterUrl: string; headline: string; subtitle: string; alignment: "left" | "center"; overlay: "light" | "medium" | "strong" };
  sections: Record<WebsiteSectionKey, WebsiteSection>;
  expertise: Array<{ title: string; body: string }>;
  projects: Array<{ id: string; title: string; location: string; category: string; description: string; imageUrl: string; imageAlt: string; published: boolean; order: number }>;
  team: Array<{ id: string; name: string; role: string; biography: string; experience: string; imageUrl: string; imageAlt: string; published: boolean; order: number }>;
};

// These are the only existing, approved static assets that may be selected
// while uploads are unavailable. Keeping the list in code prevents a content
// editor from turning the public site into an arbitrary external image proxy.
export const approvedStaticImageOptions = [
  { value: "", label: "No image" },
  { value: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85", label: "Contemporary residence" },
  { value: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=85", label: "Architectural facade" },
] as const;

export const approvedStaticImageUrls = new Set<string>(approvedStaticImageOptions.map((option) => option.value));

export const defaultWebsiteContent: WebsiteContent = {
  hero: { mode: "image", mediaUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85", posterUrl: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=85", headline: "Built on Experience. Driven by Vision.", subtitle: "Property Development & Investment", alignment: "left", overlay: "medium" },
  sections: {
    about: { heading: "A Considered Approach to Property Development", body: "Grand Harmony is a Melbourne-based property development and investment company bringing together experienced professionals across real estate, construction, planning and development management.\n\nOur approach combines extensive local market knowledge, practical building expertise and strategic thinking to create quality residential developments and lasting value.", visible: true },
    experience: { heading: "Experience That Shapes Every Decision", body: "Our senior leadership brings over 20 years of experience in Melbourne's residential property market, spanning off-the-plan sales, established homes, townhouses and apartments.\n\nThis understanding of market dynamics, buyer expectations and product positioning informs how we approach each development opportunity.", visible: true },
    construction: { heading: "From Design to Delivery", body: "Our leadership team also brings extensive residential construction experience, including luxury homes, high-end residential properties and multi-townhouse developments.\n\nThis hands-on industry knowledge supports informed decision-making throughout design, construction coordination and project delivery.", visible: true },
    expertise: { heading: "Our Expertise", body: "", visible: true },
    team: { heading: "Expertise Across Every Stage of Development", body: "Grand Harmony draws on multidisciplinary expertise across real estate, residential construction, planning and property development.\n\nThrough experienced leadership and collaboration with specialist industry professionals, we bring together the knowledge required to assess opportunities, manage complexity and deliver considered outcomes.", visible: true },
    developments: { heading: "Selected Developments", body: "A curated selection of our development and investment activities.", visible: true },
    contact: { heading: "Begin a considered conversation", body: "For business enquiries, development opportunities, professional partnerships and general enquiries, please contact Grand Harmony using verified channels. Contact details will be published once confirmed.", visible: true },
  },
  expertise: [
    { title: "Property Development", body: "Strategic planning, development coordination and project delivery." },
    { title: "Residential Construction", body: "Luxury homes, townhouses and quality residential developments." },
    { title: "Real Estate & Sales", body: "Extensive Melbourne sales experience across established and off-the-plan properties." },
    { title: "Investment & Asset Management", body: "Property assessment, investment strategy and long-term value creation." },
  ],
  projects: [], team: [],
};
