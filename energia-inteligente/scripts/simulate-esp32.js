// Simulador de ESP32 — envia leituras FALSAS para a API, exatamente no mesmo
// formato do firmware real. Serve para testar a ponta a ponta (API → banco →
// realtime → dashboard) antes do hardware estar pronto.
//
// ⚠️ Os dados gravados por este script são simulados. Não use em apresentação
// como se fossem medições reais — para isso existe o Modo Demonstração, que
// deixa claro na tela que os dados são simulados.
//
// Uso:
//   DEVICE_ID=ESP32-001 DEVICE_KEY=xxxx API_URL=http://localhost:5173 npm run simulate
// Variáveis opcionais: SENSORS=4  INTERVAL=5  (segundos)  COUNT=0 (0 = infinito)

const API_URL = (process.env.API_URL || 'http://localhost:5173').replace(/\/+$/, '');
const DEVICE_ID = process.env.DEVICE_ID;
const DEVICE_KEY = process.env.DEVICE_KEY;
const SENSORS = Math.min(Number(process.env.SENSORS || 4), 32);
const INTERVAL = Math.max(Number(process.env.INTERVAL || 5), 1);
const COUNT = Number(process.env.COUNT || 0);

if (!DEVICE_ID || !DEVICE_KEY) {
  console.error('Defina DEVICE_ID e DEVICE_KEY (a chave aparece ao cadastrar o dispositivo no site).');
  process.exit(1);
}

// Perfis de consumo típicos por canal (W): base + variação
const PROFILES = [
  { base: 350, spread: 60 },  // Sensor 1 → ex.: Sala (TV, iluminação)
  { base: 800, spread: 250 }, // Sensor 2 → ex.: Cozinha (geladeira, micro-ondas)
  { base: 120, spread: 40 },  // Sensor 3 → ex.: Quarto
  { base: 80, spread: 30 },   // Sensor 4 → ex.: Banheiro
  { base: 60, spread: 20 },   // Sensor 5 → ex.: Garagem
];

function reading(channel) {
  const p = PROFILES[(channel - 1) % PROFILES.length];
  const power = Math.max(0, p.base + (Math.random() * 2 - 1) * p.spread);
  const voltage = 127 + (Math.random() * 2 - 1) * 2;
  return {
    sensor: channel,
    power: Number(power.toFixed(1)),
    voltage: Number(voltage.toFixed(1)),
    current: Number((power / voltage).toFixed(3)),
  };
}

let sent = 0;
async function tick() {
  const body = {
    deviceId: DEVICE_ID,
    firmware: 'simulador-node',
    timestamp: new Date().toISOString(),
    readings: Array.from({ length: SENSORS }, (_, i) => reading(i + 1)),
  };
  try {
    const res = await fetch(`${API_URL}/api/energy/readings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Key': DEVICE_KEY },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    const total = body.readings.reduce((s, r) => s + r.power, 0);
    console.log(
      `${new Date().toLocaleTimeString('pt-BR')}  HTTP ${res.status}  total=${total.toFixed(0)} W`,
      res.ok ? `(gravadas: ${json.inserted}${json.unmappedSensors?.length ? `, sem cômodo: ${json.unmappedSensors}` : ''})` : json,
    );
  } catch (err) {
    console.error('Falha ao enviar:', err.message);
  }
  sent++;
  if (COUNT && sent >= COUNT) process.exit(0);
}

console.log(`Simulando ${DEVICE_ID} → ${API_URL}/api/energy/readings a cada ${INTERVAL}s com ${SENSORS} sensores. Ctrl+C para parar.`);
tick();
setInterval(tick, INTERVAL * 1000);
