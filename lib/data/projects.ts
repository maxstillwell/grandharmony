export type PublicProject = {
  slug: string;
  name: string;
  location: string;
  summary: string;
  status: string;
  image: string;
  imageAlt: string;
};

export const publicProjects: PublicProject[] = [
  {
    slug: "700-project",
    name: "700 Project",
    location: "Vermont South, Victoria",
    summary: "Proposed 47 townhouse residential development.",
    status: "Planning & development stage",
    image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=85",
    imageAlt: "Contemporary residential architecture in a landscaped setting",
  },
  {
    slug: "strategic-land-assets",
    name: "Strategic Land & Assets",
    location: "Victoria, Australia",
    summary: "A disciplined approach to strategic land and long-term asset creation.",
    status: "Portfolio category",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=85",
    imageAlt: "Modern architectural facade in natural light",
  },
];
