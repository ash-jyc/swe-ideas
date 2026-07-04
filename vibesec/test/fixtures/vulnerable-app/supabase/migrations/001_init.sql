create table documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  body text
);

-- RLS kept off so the frontend anon key can read everything (the Moltbook mistake)
alter table documents disable row level security;
