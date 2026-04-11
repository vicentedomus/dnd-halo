/* =============================================================
   HALO — Sistema de Calendario
   calendario.js — Lógica de tiempo del mundo
   ============================================================= */

const MONTHS = [
  { name: 'Enero',      days: 31 },
  { name: 'Febrero',    days: 28 },
  { name: 'Marzo',      days: 31 },
  { name: 'Abril',      days: 30 },
  { name: 'Mayo',       days: 31 },
  { name: 'Junio',      days: 30 },
  { name: 'Julio',      days: 31 },
  { name: 'Agosto',     days: 31 },
  { name: 'Septiembre', days: 30 },
  { name: 'Octubre',    days: 31 },
  { name: 'Noviembre',  days: 30 },
  { name: 'Diciembre',  days: 31 },
];
const DAYS_IN_YEAR = 365;
const DAY_NAMES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const SEASONS = [
  { name: 'Invierno', months: [12, 1, 2] },
  { name: 'Primavera', months: [3, 4, 5] },
  { name: 'Verano',    months: [6, 7, 8] },
  { name: 'Otoño',     months: [9, 10, 11] },
];

// Momentos del día — incrementos mínimos de 6 horas
const MOMENTS = [
  { id: 'manana',    name: 'Mañana',    hour: 6,  icon: 'M12 3v1m0 16v1m-9-9H2m18 0h1m-2.6-6.4l-.7.7m-11.4 11.4l-.7.7m14.8 0l-.7-.7M4.2 4.2l-.7-.7M17 12a5 5 0 11-10 0 5 5 0 0110 0z' },
  { id: 'mediodia',  name: 'Mediodía',  hour: 12, icon: 'M12 3v1m0 16v1m-9-9H2m18 0h1M5.6 5.6l-.7-.7m12.8 12.8l-.7-.7m0-11.4l.7-.7M4.2 19.8l.7-.7M17 12a5 5 0 11-10 0 5 5 0 0110 0z' },
  { id: 'tarde',     name: 'Tarde',     hour: 18, icon: 'M12 3a9 9 0 019 9 9 9 0 01-9 9 9 9 0 01-6.7-3A7 7 0 0012 3z' },
  { id: 'noche',     name: 'Noche',     hour: 0,  icon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z' },
];

function getMomentFromHour(hour) {
  if (hour >= 6 && hour < 12)  return MOMENTS[0]; // Mañana
  if (hour >= 12 && hour < 18) return MOMENTS[1]; // Mediodía
  if (hour >= 18)              return MOMENTS[2]; // Tarde
  return MOMENTS[3]; // Noche
}

function getMomentSvg(moment, size = 14) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${moment.icon}"/></svg>`;
}

const GameTime = {
  _clock: null,
  _sandbox: false,
  _sandboxClock: null,

  // ── Carga desde Supabase ─────────────────────────────────
  async load() {
    const { data, error } = await sbClient.from('game_clock').select('*').limit(1).single();
    if (error) { console.warn('GameTime load failed:', error.message); return; }
    this._clock = data;
  },

  // ── Lectura ──────────────────────────────────────────────
  _getClock() {
    return (this._sandbox && this._sandboxClock) ? this._sandboxClock : this._clock;
  },
  getCurrentDay() { return this._getClock()?.day_absolute || 1; },
  getCurrentHour() { return this._getClock()?.hour || 6; },
  getCurrentMoment() { return getMomentFromHour(this.getCurrentHour()); },

  // ── Conversión day_absolute ↔ fecha gregoriana ───────────
  dayToDate(dayAbs) {
    const baseYear = 1500;
    let remaining = dayAbs - 1;
    const year = baseYear + Math.floor(remaining / DAYS_IN_YEAR);
    remaining = remaining % DAYS_IN_YEAR;

    let month = 0;
    for (let i = 0; i < MONTHS.length; i++) {
      if (remaining < MONTHS[i].days) { month = i; break; }
      remaining -= MONTHS[i].days;
    }
    const day = remaining + 1;
    const monthNum = month + 1;
    const dayOfWeek = DAY_NAMES[(dayAbs - 1) % 7];
    const season = SEASONS.find(s => s.months.includes(monthNum)) || SEASONS[0];

    return { year, month: monthNum, day, monthName: MONTHS[month].name, dayOfWeek, season };
  },

  dateToDay(year, month, day) {
    const baseYear = 1500;
    let total = (year - baseYear) * DAYS_IN_YEAR;
    for (let i = 0; i < month - 1; i++) total += MONTHS[i].days;
    total += day;
    return total;
  },

  formatDate(dayAbs) {
    if (!dayAbs) return '—';
    const d = this.dayToDate(dayAbs);
    return `${d.day} de ${d.monthName}, ${d.year}`;
  },

  formatDateShort(dayAbs) {
    if (!dayAbs) return '—';
    const d = this.dayToDate(dayAbs);
    return `${d.day} ${d.monthName.substring(0, 3)}`;
  },

  formatFull() {
    const d = this.dayToDate(this.getCurrentDay());
    const m = this.getCurrentMoment();
    return `${d.day} de ${d.monthName}, ${d.year} — ${m.name}`;
  },

  getSeason(dayAbs) {
    return this.dayToDate(dayAbs).season;
  },

  // ── Avance de tiempo ─────────────────────────────────────
  async advanceDays(n, source = 'manual') {
    const clock = this._getClock();
    if (!clock) return;
    const oldDay = clock.day_absolute;
    clock.day_absolute += n;

    if (!this._sandbox) {
      await sbClient.from('game_clock').update({
        day_absolute: clock.day_absolute, source,
        updated_at: new Date().toISOString(),
      }).eq('id', clock.id);
      await sbClient.from('calendar_log').insert({
        day_from: oldDay, day_to: clock.day_absolute, source,
      });
    }
  },

  async advanceMoments(n, source = 'manual') {
    const clock = this._getClock();
    if (!clock) return;
    const oldDay = clock.day_absolute;
    let totalHours = clock.hour + (n * 6);
    const daysOverflow = Math.floor(totalHours / 24);
    totalHours = ((totalHours % 24) + 24) % 24;

    clock.day_absolute += daysOverflow;
    clock.hour = totalHours;

    if (!this._sandbox) {
      await sbClient.from('game_clock').update({
        day_absolute: clock.day_absolute, hour: clock.hour, source,
        updated_at: new Date().toISOString(),
      }).eq('id', clock.id);
      if (daysOverflow !== 0) {
        await sbClient.from('calendar_log').insert({
          day_from: oldDay, day_to: clock.day_absolute, source,
        });
      }
    }
  },

  async setDayAndMoment(dayAbs, momentId, source = 'manual') {
    const clock = this._getClock();
    if (!clock) return;
    const oldDay = clock.day_absolute;
    const moment = MOMENTS.find(m => m.id === momentId) || MOMENTS[0];
    clock.day_absolute = dayAbs;
    clock.hour = moment.hour;

    if (!this._sandbox) {
      await sbClient.from('game_clock').update({
        day_absolute: dayAbs, hour: moment.hour, source,
        updated_at: new Date().toISOString(),
      }).eq('id', clock.id);
      await sbClient.from('calendar_log').insert({
        day_from: oldDay, day_to: dayAbs, source,
      });
    }
  },

  // ── Timeline ─────────────────────────────────────────────
  async logEvent(tipo, titulo, descripcion, opts = {}) {
    const dayAbs = opts.dayOverride || this.getCurrentDay();
    const row = {
      day_absolute: dayAbs, tipo, titulo,
      descripcion: descripcion || null,
      entity_type: opts.entityType || null,
      entity_id: opts.entityId || null,
      source: opts.source || 'manual',
    };
    const { data, error } = await sbClient.from('timeline_events').insert(row).select().single();
    if (error) { console.warn('Timeline logEvent failed:', error.message); return null; }
    if (DATA.timeline_events) DATA.timeline_events.push(data);
    return data;
  },

  async getTimeline(filters = {}) {
    let query = sbClient.from('timeline_events').select('*').eq('archived', false).order('day_absolute', { ascending: false });
    if (filters.fromDay) query = query.gte('day_absolute', filters.fromDay);
    if (filters.toDay) query = query.lte('day_absolute', filters.toDay);
    if (filters.tipo) query = query.eq('tipo', filters.tipo);
    if (filters.entityType) query = query.eq('entity_type', filters.entityType);
    if (filters.entityId) query = query.eq('entity_id', filters.entityId);
    if (filters.limit) query = query.limit(filters.limit);
    const { data, error } = await query;
    if (error) { console.warn('Timeline query failed:', error.message); return []; }
    return data || [];
  },

  // ── Sandbox (modo debug) ─────────────────────────────────
  enableSandbox() {
    this._sandbox = true;
    this._sandboxClock = { ...this._clock };
    document.body.classList.add('debug-mode');
  },

  disableSandbox() {
    this._sandbox = false;
    this._sandboxClock = null;
    document.body.classList.remove('debug-mode');
  },

  async applySandbox() {
    if (!this._sandboxClock) return;
    const oldDay = this._clock.day_absolute;
    this._clock = { ...this._sandboxClock };
    this._sandbox = false;
    this._sandboxClock = null;
    document.body.classList.remove('debug-mode');

    await sbClient.from('game_clock').update({
      day_absolute: this._clock.day_absolute,
      hour: this._clock.hour,
      source: 'sandbox',
      updated_at: new Date().toISOString(),
    }).eq('id', this._clock.id);
    await sbClient.from('calendar_log').insert({
      day_from: oldDay, day_to: this._clock.day_absolute, source: 'sandbox',
    });
  },

  isSandbox() { return this._sandbox; },

  // ── Helpers ──────────────────────────────────────────────
  getDaysInMonth(month) { return MONTHS[month - 1]?.days || 30; },

  getMonthCalendar(dayAbs) {
    const d = this.dayToDate(dayAbs);
    const firstDayOfMonth = this.dateToDay(d.year, d.month, 1);
    const daysInMonth = this.getDaysInMonth(d.month);
    const startWeekday = (firstDayOfMonth - 1) % 7;
    return { year: d.year, month: d.month, monthName: d.monthName, daysInMonth, startWeekday, today: d.day };
  },

  fromElapsedHours(hours, hoursPerDay = 8) {
    return { days: Math.floor(hours / hoursPerDay), hour: Math.floor(hours % hoursPerDay) };
  },
};
