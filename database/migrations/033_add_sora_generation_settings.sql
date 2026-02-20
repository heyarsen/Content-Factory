create table if not exists public.sora_generation_settings (
  id boolean primary key default true,
  enabled boolean not null default false,
  manual_provider text not null default 'kie' check (manual_provider in ('kie', 'poyo')),
  manual_model text not null default 'sora-2-stable' check (manual_model in ('sora-2', 'sora-2-private', 'sora-2-stable')),
  automation_provider text not null default 'kie' check (automation_provider in ('kie', 'poyo')),
  automation_model text not null default 'sora-2-stable' check (automation_model in ('sora-2', 'sora-2-private', 'sora-2-stable')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (id = true)
);

insert into public.sora_generation_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.videos
  add column if not exists sora_provider text check (sora_provider in ('kie', 'poyo')),
  add column if not exists sora_model text check (sora_model in ('sora-2', 'sora-2-private', 'sora-2-stable'));
