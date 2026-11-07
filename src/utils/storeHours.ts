import { SupermarketDetails } from '../types';

export interface StoreStatusInfo {
  isOpen: boolean;
  statusText: string;
  badgeColor: 'emerald' | 'amber' | 'red';
  todaySchedule: string;
  fullSchedule: string;
  segSex: string;
  sab: string;
  dom: string;
  obs?: string;
}

/**
 * Extracts hours and minutes from strings like "07:00", "7:30", "07h", "21:00", etc.
 */
function parseTimeString(timeStr: string): number | null {
  if (!timeStr) return null;
  const clean = timeStr.trim().toLowerCase().replace('h', ':');
  const parts = clean.split(':');
  if (parts.length > 0) {
    const hours = parseInt(parts[0], 10);
    const minutes = parts.length > 1 ? parseInt(parts[1], 10) : 0;
    if (!isNaN(hours) && !isNaN(minutes)) {
      return hours * 60 + minutes;
    }
  }
  return null;
}

/**
 * Parses time range like "07:00 às 21:30", "07:00 - 22:00", "08:00 as 20:00"
 */
function parseTimeRange(rangeStr: string): { startMinutes: number; endMinutes: number } | null {
  if (!rangeStr) return null;
  const clean = rangeStr.toLowerCase().replace(/às|as|ate|até|-/g, ' - ');
  const parts = clean.split(' - ').map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const start = parseTimeString(parts[0]);
    const end = parseTimeString(parts[1]);
    if (start !== null && end !== null) {
      return { startMinutes: start, endMinutes: end };
    }
  }
  return null;
}

/**
 * Gets formatted operating hours and real-time open/closed status for a supermarket
 */
export function getStoreOperatingStatus(store?: Partial<SupermarketDetails> | null): StoreStatusInfo {
  const segSex = store?.horarioSegSex?.trim() || '07:00 às 21:30';
  const sab = store?.horarioSab?.trim() || '07:00 às 21:00';
  const dom = store?.horarioDom?.trim() || '08:00 às 14:00';

  const fullSchedule = store?.horarioFuncionamento?.trim() || 
    `Seg a Sex: ${segSex} • Sáb: ${sab} • Dom: ${dom}`;

  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday, 1..5 = Mon..Fri, 6 = Saturday
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let todayRangeStr = segSex;
  let dayName = 'Segunda a Sexta';

  if (dayOfWeek === 0) {
    todayRangeStr = dom;
    dayName = 'Domingo e Feriados';
  } else if (dayOfWeek === 6) {
    todayRangeStr = sab;
    dayName = 'Sábado';
  }

  const obs = store?.horarioObservacoes?.trim();

  const isMarkedClosed = todayRangeStr.toLowerCase().includes('fechado');

  if (isMarkedClosed) {
    return {
      isOpen: false,
      statusText: 'Fechado Hoje',
      badgeColor: 'red',
      todaySchedule: `${dayName}: Fechado`,
      fullSchedule,
      segSex,
      sab,
      dom,
      obs
    };
  }

  const range = parseTimeRange(todayRangeStr);
  if (range) {
    if (currentMinutes >= range.startMinutes && currentMinutes < range.endMinutes) {
      return {
        isOpen: true,
        statusText: 'Aberto Agora',
        badgeColor: 'emerald',
        todaySchedule: `Hoje (${dayName}): ${todayRangeStr}`,
        fullSchedule,
        segSex,
        sab,
        dom,
        obs
      };
    } else if (currentMinutes < range.startMinutes) {
      return {
        isOpen: false,
        statusText: 'Fechado no Momento',
        badgeColor: 'amber',
        todaySchedule: `Abre hoje às ${todayRangeStr.split(/às|as|ate|até|-/i)[0]?.trim() || ''}`,
        fullSchedule,
        segSex,
        sab,
        dom,
        obs
      };
    } else {
      return {
        isOpen: false,
        statusText: 'Fechado no Momento',
        badgeColor: 'amber',
        todaySchedule: `Fechou hoje às ${todayRangeStr.split(/às|as|ate|até|-/i)[1]?.trim() || ''}`,
        fullSchedule,
        segSex,
        sab,
        dom,
        obs
      };
    }
  }

  // Fallback if parsing fails
  return {
    isOpen: true,
    statusText: 'Aberto Hoje',
    badgeColor: 'emerald',
    todaySchedule: `Hoje: ${todayRangeStr}`,
    fullSchedule,
    segSex,
    sab,
    dom,
    obs
  };
}
