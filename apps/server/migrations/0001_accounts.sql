create table users (
    id            uuid primary key default gen_random_uuid(),
    email         text unique not null,
    password_hash text not null,
    gold          integer not null default 0,
    last_claim_at timestamptz not null default now(),
    loot_filter   jsonb not null default '[]'::jsonb,
    created_at    timestamptz not null default now()
);

-- Deleting a user deletes their sessions: the database enforces it, so no application code can
-- forget to.
create table sessions (
    token_hash text primary key,
    user_id    uuid not null references users(id) on delete cascade,
    expires_at timestamptz not null
);

create index sessions_user_id_idx on sessions (user_id);
