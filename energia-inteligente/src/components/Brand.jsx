import { Link } from 'react-router-dom';

export function Logo({ to = '/', compact = false }) {
  return (
    <Link to={to} className="flex items-center gap-2.5" aria-label="Energia Inteligente — início">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink-800 ring-1 ring-volt-500/30">
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <path d="M13.5 2 5 13.5h5.5L9 22l9.5-12.5H13L13.5 2z" fill="#a3e635" />
        </svg>
      </span>
      {!compact && (
        <span className="font-display text-[15px] font-bold leading-tight tracking-tight text-ink-100">
          Energia<span className="text-volt-400"> Inteligente</span>
        </span>
      )}
    </Link>
  );
}

/**
 * Ilustração da landing: uma casa em corte com 4 cômodos; cada cômodo tem um
 * sensor ligado ao ESP32, que envia os dados via Wi-Fi para o painel.
 */
export function HouseIllustration({ className }) {
  const rooms = [
    { x: 40, y: 150, w: 130, h: 90, label: 'Sala', w_: '350 W' },
    { x: 170, y: 150, w: 130, h: 90, label: 'Cozinha', w_: '820 W' },
    { x: 40, y: 240, w: 130, h: 90, label: 'Quarto', w_: '120 W' },
    { x: 170, y: 240, w: 130, h: 90, label: 'Banheiro', w_: '80 W' },
  ];
  return (
    <svg viewBox="0 0 560 380" className={className} role="img" aria-label="Casa com sensores em cada cômodo enviando dados via Wi-Fi para o painel">
      <defs>
        <linearGradient id="roof" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#a3e635" stopOpacity=".35" />
          <stop offset="1" stopColor="#a3e635" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="glow" cx=".5" cy=".5" r=".5">
          <stop offset="0" stopColor="#a3e635" stopOpacity=".35" />
          <stop offset="1" stopColor="#a3e635" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Casa */}
      <path d="M20 150 170 50l150 100" fill="url(#roof)" stroke="#a3e635" strokeWidth="2.5" strokeLinejoin="round" />
      <rect x="40" y="150" width="260" height="180" fill="#0f1713" stroke="#2a3b32" strokeWidth="2" />
      {rooms.map((r, i) => (
        <g key={r.label}>
          <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="none" stroke="#2a3b32" strokeWidth="2" />
          <circle cx={r.x + 20} cy={r.y + 20} r="7" fill="#a3e635" opacity=".9">
            <animate attributeName="opacity" values=".9;.35;.9" dur={`${1.4 + i * 0.3}s`} repeatCount="indefinite" />
          </circle>
          <text x={r.x + 34} y={r.y + 24} fill="#a9b9b0" fontSize="12" fontFamily="Inter">{r.label}</text>
          <text x={r.x + 16} y={r.y + 62} fill="#eef3f0" fontSize="20" fontWeight="700" fontFamily="Space Grotesk">{r.w_}</text>
        </g>
      ))}
      <line x1="20" y1="330" x2="320" y2="330" stroke="#2a3b32" strokeWidth="2" />

      {/* Fios dos sensores até o ESP32 */}
      {[195, 285].map((y) => (
        <path key={y} d={`M300 ${y} H360 V300`} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="6 6" className="animate-flow" />
      ))}

      {/* ESP32 */}
      <g transform="translate(335 300)">
        <rect width="70" height="44" rx="6" fill="#131d18" stroke="#34d399" strokeWidth="2" />
        {[8, 18, 28, 38, 48, 58].map((x) => (
          <g key={x}>
            <rect x={x} y="-5" width="3" height="5" fill="#34d399" />
            <rect x={x} y="44" width="3" height="5" fill="#34d399" />
          </g>
        ))}
        <text x="35" y="27" textAnchor="middle" fill="#6ee7b7" fontSize="12" fontWeight="700" fontFamily="JetBrains Mono">ESP32</text>
      </g>

      {/* Wi-Fi */}
      <g transform="translate(370 250)" fill="none" stroke="#a3e635" strokeWidth="3" strokeLinecap="round">
        {[14, 26, 38].map((r, i) => (
          <path key={r} d={`M${-r * 0.7} ${-r * 0.2} A${r} ${r} 0 0 1 ${r * 0.7} ${-r * 0.2}`} opacity={0.9 - i * 0.2}>
            <animate attributeName="opacity" values={`${0.9 - i * 0.2};.15;${0.9 - i * 0.2}`} dur="1.8s" begin={`${i * 0.25}s`} repeatCount="indefinite" />
          </path>
        ))}
      </g>

      {/* Painel */}
      <circle cx="470" cy="130" r="90" fill="url(#glow)" />
      <path d="M405 215 C 420 180, 430 190, 440 175" fill="none" stroke="#a3e635" strokeWidth="2" strokeDasharray="6 6" className="animate-flow" />
      <g transform="translate(400 60)">
        <rect width="140" height="110" rx="12" fill="#0f1713" stroke="#a3e635" strokeOpacity=".5" strokeWidth="2" />
        <text x="14" y="26" fill="#a9b9b0" fontSize="11" fontFamily="Inter">Consumo atual</text>
        <text x="14" y="52" fill="#d9f99d" fontSize="24" fontWeight="700" fontFamily="Space Grotesk">1,37 kW</text>
        {[
          [14, 14],
          [34, 26],
          [54, 10],
          [74, 20],
          [94, 8],
          [114, 16],
        ].map(([x, h]) => (
          <rect key={x} x={x} y={98 - h} width="12" height={h} rx="2" fill="#a3e635" opacity=".75" />
        ))}
      </g>
    </svg>
  );
}
