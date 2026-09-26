import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Bell, ChartColumn, Coins, Cpu, Leaf, ShieldCheck, Wifi } from 'lucide-react';
import { HouseIllustration, Logo } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  { icon: Activity, title: 'Tempo real', text: 'Potência de cada cômodo atualizada automaticamente, sem recarregar a página.' },
  { icon: Coins, title: 'Custo em R$', text: 'Informe a tarifa da sua concessionária e acompanhe o gasto estimado do dia e do mês.' },
  { icon: ChartColumn, title: 'Gráficos e histórico', text: 'Compare cômodos, veja o consumo ao longo do dia e a evolução mês a mês.' },
  { icon: Bell, title: 'Alertas', text: 'Aviso quando a potência passa do limite ou um cômodo consome acima da média.' },
  { icon: Cpu, title: 'ESP32 + Wi-Fi', text: 'Sensores em cada circuito enviam os dados pela internet de forma autenticada.' },
  { icon: ShieldCheck, title: 'Seus dados, só seus', text: 'Conta verificada por e-mail e isolamento total entre usuários no banco de dados.' },
];

const STEPS = ['Crie sua conta', 'Cadastre os cômodos', 'Informe a tarifa', 'Conecte o ESP32', 'Acompanhe o consumo'];

export default function Landing() {
  const { session } = useAuth();
  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-950 bg-grid text-ink-100">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          {session ? (
            <Link to="/app" className="rounded-lg bg-volt-500 px-4 py-2 text-sm font-semibold text-ink-950 hover:bg-volt-400">
              Abrir painel
            </Link>
          ) : (
            <>
              <Link to="/entrar" className="rounded-lg px-4 py-2 text-sm font-semibold text-ink-200 hover:text-ink-100">
                Entrar
              </Link>
              <Link to="/cadastro" className="hidden rounded-lg border border-ink-600 px-4 py-2 text-sm font-semibold text-ink-100 hover:bg-ink-800 sm:inline-block">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:pt-16">
        <div className="animate-fadeUp">
          <span className="inline-flex items-center gap-2 rounded-full border border-volt-500/30 bg-volt-500/10 px-3 py-1 text-xs font-semibold text-volt-300">
            <Leaf className="h-3.5 w-3.5" /> Eficiência energética por cômodo
          </span>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Monitore sua energia de forma <span className="text-volt-400">inteligente.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-ink-300">
            Descubra quanto cada cômodo da sua residência consome e acompanhe seus gastos de energia em tempo real.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to={session ? '/app' : '/cadastro'}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-volt-500 px-6 font-semibold text-ink-950 shadow-glow transition hover:bg-volt-400"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/entrar" className="inline-flex h-12 items-center rounded-xl border border-ink-600 px-6 font-semibold text-ink-100 transition hover:bg-ink-800">
              Entrar
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-ink-400">
            <span className="flex items-center gap-2"><Wifi className="h-4 w-4 text-leaf-400" /> ESP32 via Wi-Fi</span>
            <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-leaf-400" /> W · kWh · R$</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[2rem] bg-volt-500/5 blur-2xl" />
          <div className="relative rounded-3xl border border-ink-700 bg-ink-900/70 p-4 sm:p-6">
            <HouseIllustration className="h-auto w-full" />
          </div>
        </div>
      </section>

      <section className="border-y border-ink-800 bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">Tudo o que você precisa para economizar</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-ink-700 bg-ink-850/70 p-5">
                <Icon className="h-6 w-6 text-volt-400" />
                <h3 className="mt-3 font-display font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-ink-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Como funciona</h2>
        <ol className="mt-8 grid gap-3 sm:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-4 sm:flex-col sm:items-start">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-volt-500/15 font-display font-bold text-volt-300">{i + 1}</span>
              <span className="text-sm font-medium text-ink-200">{s}</span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-ink-800 px-4 py-8 text-center text-xs text-ink-500">
        Projeto acadêmico — Sistema inteligente de monitoramento de consumo de energia por cômodo (ESP32 + Wi-Fi + plataforma web).
      </footer>
    </div>
  );
}
