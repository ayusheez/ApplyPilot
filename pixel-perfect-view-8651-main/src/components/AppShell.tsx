import { AccountMenu } from "./AuthGate";
import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowUpRight, BarChart3, Inbox, ListChecks, Navigation } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Applications", icon: ListChecks },
  { to: "/overview", label: "Overview", icon: BarChart3 },
  { to: "/import", label: "Import email", icon: Inbox },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Link to="/" className="app-brand"><span className="brand-mark"><Navigation size={20} /></span>ApplyPilot<span className="brand-dot">.</span></Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main" className="app-navigation">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" || pathname.startsWith("/applications/") : pathname === to;
            return <Link key={to} to={to} className={`app-nav-link ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined}><Icon size={18} aria-hidden />{label}{active && <span className="nav-indicator" />}</Link>;
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-import"><Inbox size={22} /><h2>From inbox to organised.</h2><p>Turn a sample email into an application you can track.</p><Link to="/import">Try email import <ArrowUpRight size={15} /></Link></div>
          <div className="demo-note"><span />Local workspace</div>
          <p className="demo-caption">Applications are saved to your local database.</p>
        </div>
      </aside>
      <main className="app-main">
        <div className="workspace-topbar"><span>Workspace <span className="breadcrumb-slash">/</span> Job search</span><AccountMenu /></div>
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1>{meta && <p>{meta}</p>}</div>{actions && <div className="flex flex-wrap gap-2">{actions}</div>}</div>;
}
