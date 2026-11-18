-- Game state persistence for AI Interrogation.
create table if not exists public.games (
  id text primary key,
  version integer not null default 0,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Accessed only server-side with the service role key. Enable RLS with no
-- policies so the anon key cannot read or write games.
alter table public.games enable row level security;
