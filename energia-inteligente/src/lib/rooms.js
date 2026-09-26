// Ícones, cores e sugestões de cômodos
import { Bath, Bed, Briefcase, Car, CookingPot, Home, Lamp, Shirt, Sofa, Tv, WashingMachine } from 'lucide-react';

export const ROOM_PRESETS = ['Sala', 'Quarto 1', 'Quarto 2', 'Cozinha', 'Banheiro', 'Garagem', 'Escritório', 'Lavanderia'];

const RULES = [
  { match: /sala|estar|tv/i, icon: Sofa },
  { match: /cozinha|copa/i, icon: CookingPot },
  { match: /quarto|su[ií]te|dormit/i, icon: Bed },
  { match: /banh|lavabo|wc/i, icon: Bath },
  { match: /garag/i, icon: Car },
  { match: /escrit|office|estudo/i, icon: Briefcase },
  { match: /lavand|[áa]rea de servi/i, icon: WashingMachine },
  { match: /closet|vesti/i, icon: Shirt },
  { match: /jogos|cinema/i, icon: Tv },
  { match: /varanda|jardim|externa|quintal/i, icon: Lamp },
];

export function roomIcon(name = '') {
  return RULES.find((r) => r.match.test(name))?.icon || Home;
}

// Paleta categórica fixa por posição (mesma cor do cômodo em todos os gráficos)
export const ROOM_COLORS = ['#a3e635', '#34d399', '#fbbf24', '#38bdf8', '#f472b6', '#a78bfa', '#fb923c', '#2dd4bf'];
export const roomColor = (index) => ROOM_COLORS[index % ROOM_COLORS.length];

/** Potência base (W) usada somente no MODO DEMONSTRAÇÃO */
export function demoBaseWatts(name = '') {
  if (/cozinha|copa/i.test(name)) return 820;
  if (/sala|estar/i.test(name)) return 350;
  if (/quarto|su[ií]te/i.test(name)) return 120;
  if (/banh|lavabo/i.test(name)) return 80;
  if (/garag/i.test(name)) return 60;
  if (/escrit|estudo/i.test(name)) return 210;
  if (/lavand/i.test(name)) return 280;
  return 150;
}
