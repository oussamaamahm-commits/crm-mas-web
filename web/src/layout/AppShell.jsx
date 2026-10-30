import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Sidebar, MobileDrawer } from './Sidebar.jsx';
import { Topbar } from './Topbar.jsx';
import { CommandPalette } from './CommandPalette.jsx';
import { QuickActionsProvider } from './QuickActions.jsx';
import { MOBILE_NAV, NAV } from './nav.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useApi, useInterval, usePersistentState } from '../lib/hooks.js';
import { cx } from '../components/ui.jsx';
import { ErrorBoundary } from '../components/ErrorBoundary.jsx';
import { finish, settle, skipMotion } from '../lib/motion.js';

function MobileNav() {
  const { can } = useAuth();
  const items = NAV.filter((n) => MOBILE_NAV.includes(n.to) && (!n.perm || can(n.perm)));
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 lg:hidden" aria-label="Navegación compacta">
      <div className="glass-strong flex items-center justify-around rounded-[22px] px-1 py-1.5 shadow-float">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cx('flex min-w-[56px] flex-col items-center gap-0.5 rounded-[14px] px-2 py-1.5 text-[10.5px] font-medium', isActive ? 'text-brand' : 'text-ink-soft')}>
            <item.icon className="h-5 w-5" strokeWidth={1.9} />
            {item.label === 'Infraestructura' ? 'Infra' : item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = usePersistentState('sidebar-collapsed', false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const location = useLocation();
  const main = useRef(null);
  const { data: badges, reload } = useApi('/badges');
  useInterval(reload, 60_000);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Transición de página discreta; gsap.context se revierte automáticamente al cambiar de ruta.
  useGSAP(
    () => {
      if (skipMotion()) return undefined;
      gsap.fromTo(main.current, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'opacity,transform' });
      return settle(() => finish(main.current), 500);
    },
    { dependencies: [location.pathname], scope: main },
  );

  return (
    <QuickActionsProvider>
      <div className="app-backdrop" aria-hidden />
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} counts={badges} />
      <MobileDrawer open={drawer} onClose={() => setDrawer(false)} counts={badges} />
      <div className={cx('min-h-screen transition-[padding] duration-300 ease-out', collapsed ? 'lg:pl-[92px]' : 'lg:pl-[272px]')}>
        <Topbar onMenu={() => setDrawer(true)} onSearch={() => setPalette(true)} />
        <main ref={main} className="mx-auto w-full max-w-[1480px] px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-12">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <MobileNav />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
    </QuickActionsProvider>
  );
}
