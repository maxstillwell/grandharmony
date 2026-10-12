"use client";

export function ModelShell({ title, project, version, children }: { title: string; project: string | null; version: string | null; children: React.ReactNode }) {
  return <div className="portal-native-model"><div className="model-context no-print"><div><p className="portal-kicker">Portal / {project ?? "General tools"} / Model workspace</p><h1>{title}</h1><p>Considered assumptions. Clearer decisions.</p></div><div className="model-context-meta"><span className="portal-badge">PORTAL NATIVE</span><span>VERSION {version ?? "—"}</span></div><svg className="portal-line-motif" width="210" height="70" viewBox="0 0 210 70" aria-hidden="true"><path d="M5 53h82c24 0 25-34 50-34h63M35 63h61c27 0 31-34 54-34h50M95 10c27 0 21 35 44 35h61" fill="none" stroke="currentColor" strokeWidth=".7" /></svg></div>{children}</div>;
}
