-- Migración: Sistema de Calendario
-- Fecha: 2026-04-01
-- Ya aplicada en Supabase via apply_migration

-- Reloj del mundo (1 fila)
CREATE TABLE game_clock (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_absolute  INTEGER NOT NULL DEFAULT 1,
  hour          INTEGER NOT NULL DEFAULT 6 CHECK (hour >= 0 AND hour < 24),
  minute        INTEGER NOT NULL DEFAULT 0 CHECK (minute >= 0 AND minute < 60),
  campaign_start_date TEXT NOT NULL DEFAULT '1500-01-01',
  source        TEXT DEFAULT 'manual',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO game_clock (day_absolute, hour, minute, campaign_start_date)
VALUES (20, 6, 0, '1500-01-01');

-- Log de eventos del mundo
CREATE TABLE timeline_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_absolute  INTEGER NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN (
    'descubrimiento', 'quest', 'combate', 'viaje',
    'descanso', 'evento', 'nota', 'custom'
  )),
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  entity_type   TEXT,
  entity_id     UUID,
  source        TEXT DEFAULT 'manual',
  archived      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_timeline_day ON timeline_events(day_absolute);

-- Log de cambios al reloj (auditoría)
CREATE TABLE calendar_log (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  day_from      INTEGER NOT NULL,
  day_to        INTEGER NOT NULL,
  source        TEXT NOT NULL,
  nota          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Campos de descubrimiento en tablas existentes
ALTER TABLE npcs ADD COLUMN fecha_descubrimiento_day INTEGER;
ALTER TABLE ciudades ADD COLUMN fecha_descubrimiento_day INTEGER;
ALTER TABLE establecimientos ADD COLUMN fecha_descubrimiento_day INTEGER;
ALTER TABLE lugares ADD COLUMN fecha_descubrimiento_day INTEGER;
ALTER TABLE items ADD COLUMN fecha_descubrimiento_day INTEGER;
ALTER TABLE quests ADD COLUMN fecha_inicio_day INTEGER;
ALTER TABLE quests ADD COLUMN fecha_completada_day INTEGER;
ALTER TABLE notas_dm ADD COLUMN game_day_start INTEGER;
ALTER TABLE notas_dm ADD COLUMN game_day_end INTEGER;
