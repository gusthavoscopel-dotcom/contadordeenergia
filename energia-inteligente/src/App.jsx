import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { HomeProvider, useHome } from './context/HomeContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { Spinner } from './components/ui.jsx';
import { isSupabaseConfigured } from './lib/supabase.js';
import AppLayout from './components/AppLayout.jsx';
import Landing from './pages/Landing.jsx';
import Signup from './pages/auth/Signup.jsx';
import Verify from './pages/auth/Verify.jsx';
import Login from './pages/auth/Login.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';

const Onboarding = lazy(() => import('./pages/app/Onboarding.jsx'));
const Dashboard = lazy(() => import('./pages/app/Dashboard.jsx'));
const Rooms = lazy(() => import('./pages/app/Rooms.jsx'));
const Devices = lazy(() => import('./pages/app/Devices.jsx'));
const HistoryPage = lazy(() => import('./pages/app/History.jsx'));
const Charts = lazy(() => import('./pages/app/Charts.jsx'));
const Alerts = lazy(() => import('./pages/app/Alerts.jsx'));
const Settings = lazy(() => import('./pages/app/Settings.jsx'));
const Profile = lazy(() => import('./pages/app/Profile.jsx'));

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/** Exige login */
function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  return (
    <HomeProvider>
      <Outlet />
    </HomeProvider>
  );
}

/** Exige residência configurada (senão abre o assistente) */
function RequireResidence() {
  const { loading, residence } = useHome();
  if (loading) return <FullScreenLoader />;
  if (!residence) return <Navigate to="/app/configurar" replace />;
  return <AppLayout />;
}

function ConfigMissing() {
  return (
    <div className="grid min-h-screen place-items-center bg-ink-950 p-6 text-center text-ink-200">
      <div className="max-w-md space-y-2">
        <h1 className="font-display text-xl font-bold text-ink-100">Supabase não configurado</h1>
        <p className="text-sm">
          Crie o arquivo <code className="text-volt-300">.env</code> a partir de <code className="text-volt-300">.env.example</code> com
          <code className="text-volt-300"> VITE_SUPABASE_URL</code> e <code className="text-volt-300">VITE_SUPABASE_ANON_KEY</code> (ou configure-as na Vercel) e reinicie.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured) return <ConfigMissing />;
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Suspense fallback={<FullScreenLoader />}>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/cadastro" element={<Signup />} />
              <Route path="/verificar" element={<Verify />} />
              <Route path="/entrar" element={<Login />} />
              <Route path="/recuperar-senha" element={<ForgotPassword />} />
              <Route path="/app" element={<RequireAuth />}>
                <Route path="configurar" element={<Onboarding />} />
                <Route element={<RequireResidence />}>
                  <Route index element={<Dashboard />} />
                  <Route path="comodos" element={<Rooms />} />
                  <Route path="dispositivos" element={<Devices />} />
                  <Route path="historico" element={<HistoryPage />} />
                  <Route path="graficos" element={<Charts />} />
                  <Route path="alertas" element={<Alerts />} />
                  <Route path="configuracoes" element={<Settings />} />
                  <Route path="perfil" element={<Profile />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
