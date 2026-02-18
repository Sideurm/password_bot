create table if not exists users (
  id bigserial primary key,
  email text not null unique,
  password_hash text not null,
  nickname text,
  nickname_norm text,
  created_at timestamptz not null default now()
);

alter table users add column if not exists nickname text;
alter table users add column if not exists nickname_norm text;

create unique index if not exists idx_users_nickname_norm_unique
  on users(nickname_norm)
  where nickname_norm is not null;

create table if not exists user_progress (
  user_id bigint primary key references users(id) on delete cascade,
  progress_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_progress_updated_at on user_progress(updated_at desc);

create table if not exists auth_codes (
  id bigserial primary key,
  email text not null,
  purpose text not null,
  code_hash text not null,
  password_hash text,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_auth_codes_lookup
  on auth_codes(email, purpose, created_at desc);

create table if not exists game_rooms (
  id bigserial primary key,
  room_code text not null unique,
  leader_user_id bigint not null references users(id) on delete cascade,
  target_score integer not null default 20,
  snake_speed integer not null default 320,
  max_players smallint not null default 2,
  is_public boolean not null default false,
  status text not null default 'waiting',
  challenge_id bigint not null default 0,
  winner_user_id bigint references users(id) on delete set null,
  winner_score integer,
  last_death_user_id bigint references users(id) on delete set null,
  last_death_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_rooms_status_check check (status in ('waiting', 'active', 'finished')),
  constraint game_rooms_target_score_check check (target_score >= 5 and target_score <= 300),
  constraint game_rooms_snake_speed_check check (snake_speed >= 140 and snake_speed <= 700),
  constraint game_rooms_max_players_check check (max_players >= 2 and max_players <= 8)
);

alter table game_rooms add column if not exists snake_speed integer not null default 320;
alter table game_rooms add column if not exists max_players smallint not null default 2;
alter table game_rooms add column if not exists is_public boolean not null default false;
alter table game_rooms add column if not exists last_death_user_id bigint references users(id) on delete set null;
alter table game_rooms add column if not exists last_death_at timestamptz;

create table if not exists room_players (
  room_id bigint not null references game_rooms(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  slot smallint not null,
  current_score integer not null default 0,
  run_finished boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, slot)
);

alter table room_players drop constraint if exists room_players_slot_check;
alter table room_players add constraint room_players_slot_check check (slot >= 1 and slot <= 16);

create index if not exists idx_game_rooms_room_code on game_rooms(room_code);
create index if not exists idx_room_players_room_id on room_players(room_id);
