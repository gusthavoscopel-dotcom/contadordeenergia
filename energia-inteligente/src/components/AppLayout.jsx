import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChartColumn, Bell, Cpu, DoorOpen, History, LayoutDashboard, LogOut, Menu, Settings, User, X, FlaskConical } from 'lucide-react';
import { Logo } from './Brand.jsx';
import { StatusDot, cx } from './ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useHome } from '../context/HomeContext.jsx';

const NAV = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/comodos', label: 'Cômodos', icon: DoorOpen },
  { to: '/app/dispositivos', label: 'Dispositivos', icon: Cpu },
  { to: '/app/historico', label: 'Histórico', icon: History },
  { to: '/app/graficos', label: 'Gráficos', icon: ChartColumn },
  { to: '/app/alertas', label: 'Alertas', icon: Bell, badge: 'alerts' },
  { to: '/app/configuracoes', label: 'Configurações', icon: Settings },
  { to: '/app/perfil', label: 'Perfil', icon: User },
];

function NavItems({ onNavigate }) {
  const { unreadAlerts } = useHome();
  return (
    <nav className="space-y-1">
      {NAV.map(({ to, label, icon: Icon, end, badge }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
              isActive ? 'bg-volt-500/10 text-volt-300 ring-1 ring-inset ring-volt-500/25' : 'text-ink-300 hover:bg-ink-800 hover:text-ink-100',
            )
          }
        >
          <Icon className="h-[18px] w-[18px]" />
          <span className="flex-1">{label}</span>
          {badge === 'alerts' && unreadAlerts > 0 && (
            <span className="rounded-full bg-danger-500 px-1.5 text-[11px] font-bold text-white">{unreadAlerts > 99 ? '99+' : unreadAlerts}</span>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarFooter() {
  const { profile, user, signOut } = useAuth();
  const { onlineDevices, devices, isDemo } = useHome();
  const navigate = useNavigate();
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-ink-700 bg-ink-900 p-3 text-xs">
        {isDemo ? (
          <p className="flex items-center gap-2 font-semibold text-amp-300">
            <FlaskConical className="h-4 w-4" /> Modo demonstração
          </p>
        ) : (
          <p className="flex items-center gap-2 text-ink-200">
            <StatusDot online={onlineDevices.length > 0} />
            {onlineDevices.length > 0 ? `${onlineDevices.length} de ${devices.length} ESP32 conectado(s)` : 'ESP32 desconectado'}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 px-1">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink-700 font-display text-sm font-bold text-volt-300">
          {(profile?.nome || user?.email || '?').charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink-100">{profile?.nome || 'Usuário'}</p>
          <p className="truncate text-xs text-ink-400">{user?.email}</p>
        </div>
        <button
          onClick={async () => {
            await signOut();
            navigate('/entrar');
          }}
          className="rounded-lg p-2 text-ink-400 hover:bg-ink-800 hover:text-ink-100"
          title="Sair"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function DemoBanner() {
  const { isDemo, demoMode } = useHome();
  if (!isDemo) return null;
  return (
    <div className="mb-5 flex flex-col gap-2 rounded-xl border border-amp-500/40 bg-amp-500/10 px-4 py-3 text-sm text-amp-300 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <strong className="font-display tracking-wide">🟡 MODO DEMONSTRAÇÃO</strong>
        <span className="text-amp-300/80"> — os valores abaixo são simulados, não são medições reais.</span>
      </p>
      <Link to={demoMode === 'on' ? '/app/configuracoes' : '/app/dispositivos'} className="shrink-0 font-semibold underline-offset-4 hover:underline">
        {demoMode === 'on' ? 'Desativar nas configurações' : 'Conectar um ESP32 →'}
      </Link>
    </div>
  );
}

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <div className="min-h-screen bg-ink-950 bg-grid">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-ink-800 bg-ink-900/80 px-4 py-5 backdrop-blur lg:flex">
        <div className="mb-8 px-1">
          <Logo to="/app" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <SidebarFooter />
      </aside>

      {/* Topo mobile */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-ink-800 bg-ink-950/90 px-4 backdrop-blur lg:hidden">
        <Logo to="/app" />
        <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-200 hover:bg-ink-800" aria-label="Abrir menu">
          <Menu className="h-6 w-6" />
        </button>
      </header>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-fadeUp flex-col border-r border-ink-800 bg-ink-900 px-4 py-5">
            <div className="mb-6 flex items-center justify-between px-1">
              <Logo to="/app" />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 text-ink-300 hover:bg-ink-800" aria-label="Fechar menu">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavItems onNavigate={() => setOpen(false)} />
            </div>
            <SidebarFooter />
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <DemoBanner />
          <Outlet />
        </div>
      </main>
    </div>
  );
}
