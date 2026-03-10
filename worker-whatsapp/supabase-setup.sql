create table if not exists whatsapp_transactions (
  id uuid default gen_random_uuid() primary key,
  family_id text,
  phone text not null,
  message text not null,
  amount numeric default 0,
  type text default 'debit',
  category text default '',
  description text default '',
  parsed boolean default false,
  status text default 'pending',
  created_at timestamptz default now()
);

-- Enable RLS
alter table whatsapp_transactions enable row level security;

-- Policy: users can read/update their family's transactions
create policy "Users can manage their family WhatsApp transactions"
  on whatsapp_transactions
  for all
  using (family_id = current_setting('request.jwt.claims', true)::json->>'family_id')
  with check (family_id = current_setting('request.jwt.claims', true)::json->>'family_id');

-- Index for quick lookups
create index idx_wa_txn_family_status on whatsapp_transactions(family_id, status);
create index idx_wa_txn_phone on whatsapp_transactions(phone);
