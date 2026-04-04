-- =============================================================
-- Tabla campaign_members — mapea usuarios Auth a campañas con rol
-- Un mismo usuario puede ser DM en una campaña y player en otra.
-- =============================================================

create table if not exists public.campaign_members (
  user_id    uuid references auth.users(id) on delete cascade,
  campaign   text not null,
  role       text not null default 'player',
  username   text not null,
  created_at timestamptz default now(),
  primary key (user_id, campaign)
);

alter table campaign_members enable row level security;

-- Usuarios autenticados pueden leer su propia membresía
create policy "members_select" on campaign_members
  for select using (auth.uid() = user_id);

-- Service role (Edge Functions) tiene acceso completo via service_role key
