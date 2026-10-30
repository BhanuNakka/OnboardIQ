import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Activity, BadgeCheck, ChevronDown, CircleHelp, ClipboardCheck, FilePlus2, Files, LayoutDashboard, LogOut, Menu, Shield, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Button } from './UI.jsx';

const navigation = {
  CUSTOMER: [{ to: '/dashboard', label: 'Overview', icon: LayoutDashboard }, { to: '/applications/new', label: 'New application', icon: FilePlus2 }],
  MAKER: [{ to: '/maker/reviews', label: 'Review queue', icon: ClipboardCheck }, { to: '/applications', label: 'All applications', icon: Files }],
  CHECKER: [{ to: '/checker/pending', label: 'Pending decisions', icon: BadgeCheck }, { to: '/applications', label: 'All applications', icon: Files }],
  COMPLIANCE: [{ to: '/compliance', label: 'Compliance overview', icon: Activity }, { to: '/applications', label: 'Applications', icon: Files }],
  ADMIN: [{ to: '/admin', label: 'Administration', icon: Shield }, { to: '/applications', label: 'Applications', icon: Files }]
};
const roleNames = { CUSTOMER: 'Customer', MAKER: 'KYC maker', CHECKER: 'Checker', COMPLIANCE: 'Compliance officer', ADMIN: 'Administrator' };
function initials(name = '') { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'U'; }

export default function AppLayout() {
  const { user, logout } = useAuth(); const [open, setOpen] = useState(false); const location = useLocation();
  const current = useMemo(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1].replaceAll('-', ' ') : 'overview';
  }, [location.pathname]);
  const links = navigation[user?.role] || [];
  return <div className="app-shell">
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><ShieldCheck size={21} strokeWidth={2.2} /></div><div><strong>OnboardIQ</strong><span>Client operations</span></div><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X /></button></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Main navigation">{links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end onClick={() => setOpen(false)} className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-spacer" />
      <div className="sidebar-help"><div className="help-symbol"><CircleHelp size={17} /></div><div><strong>Need a hand?</strong><span>Contact your operations team</span></div></div>
      <div className="sidebar-footer"><span className="secure-dot" />Secure workspace <span className="footer-version">v1.0</span></div>
    </aside>
    {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <div className="app-main">
      <header className="topbar"><button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}><Menu /></button><div className="crumbs"><span>Workspace</span><i>/</i><strong>{current}</strong></div><div className="topbar-right"><span className="environment-pill"><span />Development</span><div className="top-divider" /><div className="user-menu"><div className="avatar">{initials(user?.name)}</div><div className="user-copy"><strong>{user?.name}</strong><span>{roleNames[user?.role] || user?.role}</span></div><ChevronDown size={15} className="user-chevron" /></div><Button variant="ghost" size="sm" className="logout-button" onClick={logout}><LogOut size={16} /><span>Sign out</span></Button></div></header>
      <main className="page-content"><Outlet /></main>
      <footer className="main-footer"><span>OnboardIQ</span><span>Secure onboarding workspace · Synthetic demo environment</span></footer>
    </div>
  </div>;
}
