"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen, LayoutDashboard, FolderKanban, Library, Shield, Globe2, Maximize, Minimize } from "lucide-react";

const WorkspaceContext = createContext({ focused: false, toggleFocus: () => {} });
export const useWorkspace = () => useContext(WorkspaceContext);

export function Workspace({ children, projects, admin }: { children: React.ReactNode; projects: Array<{ id: string; name: string }>; admin: boolean }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => { try { setCollapsed(localStorage.getItem("gh.sidebar.collapsed") === "true"); } catch {} }, []);
  function toggle() { setCollapsed((current) => { try { localStorage.setItem("gh.sidebar.collapsed", String(!current)); } catch {} return !current; }); }
  const items = [{ href: "/portal", name: "Project Overview", icon: LayoutDashboard }, { href: "/portal/models", name: "Model Library", icon: Library }, ...projects.map((project) => ({ href: `/portal/projects/${project.id}`, name: project.name, icon: FolderKanban })), ...(admin ? [{ href: "/portal/website", name: "Website Management", icon: Globe2 }, { href: "/admin", name: "Administration", icon: Shield }] : [])];
  return <WorkspaceContext.Provider value={{ focused, toggleFocus: () => setFocused((current) => !current) }}><div className={`portal-workspace ${focused ? "workspace-focus" : ""}`} style={{ gridTemplateColumns: focused ? "minmax(0, 1fr)" : `${collapsed ? "72px" : "240px"} minmax(0, 1fr)` }}>
    {!focused && <aside className="workspace-sidebar no-print sticky top-0 h-screen overflow-y-auto bg-[#121316] p-3 text-white"><Link href="/portal" title="Grand Harmony" className="block overflow-hidden whitespace-nowrap px-2 py-4 text-sm tracking-widest">{collapsed ? "GH" : "GRAND HARMONY"}</Link><button onClick={toggle} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} className="mb-6 flex w-full items-center gap-3 rounded border border-white/20 p-2">{collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}{!collapsed && <span className="text-xs">Collapse sidebar</span>}</button><nav aria-label="Portal navigation" className="space-y-2">{items.map(({ href, name, icon: Icon }) => <Link key={href} href={href} title={name} aria-label={name} aria-current={pathname === href ? "page" : undefined} className={`flex items-center gap-3 rounded px-3 py-3 text-xs ${pathname === href ? "bg-white/15" : "text-white/70 hover:bg-white/10"}`}><Icon size={18} className="shrink-0" />{!collapsed && <span>{name}</span>}</Link>)}</nav></aside>}
    <div className="workspace-content min-w-0">{!focused ? <div className="no-print flex items-center justify-between border-b border-[#E2E0D9] bg-white px-5 py-3 text-xs"><span>Portal / {pathname.includes("models") ? "Model Library" : "Project Workspace"}</span><FocusToggle /></div> : <div className="no-print flex justify-end bg-white px-3 py-1"><FocusToggle /></div>}{children}</div>
  </div></WorkspaceContext.Provider>;
}

export function FocusToggle() {
  const { focused, toggleFocus } = useWorkspace();
  return <button onClick={toggleFocus} className="no-print inline-flex items-center gap-2 border border-[#D7D4CC] px-3 py-2 text-xs" aria-pressed={focused}>{focused ? <Minimize size={14} /> : <Maximize size={14} />}{focused ? "Exit Focus Mode" : "Focus Mode"}</button>;
}
