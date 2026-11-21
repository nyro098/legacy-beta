-- LEGACY · Discord vérifié — partie 1 : ajouts (le site actuel continue de marcher)
-- À lancer AVANT de mettre en ligne le nouveau site.

-- 1) Le profil garde l'identifiant Discord vérifié (un Discord = un seul compte)
alter table public.profiles add column if not exists discord_id text;
alter table public.profiles add column if not exists discord_verified_at timestamptz;
create unique index if not exists profiles_discord_id_key on public.profiles (discord_id);

-- 2) Tickets de vérification : écrits uniquement par la fonction « discord-auth » (clé secrète),
--    jamais lisibles ni modifiables depuis le navigateur
create table if not exists public.discord_tickets (
  ticket uuid primary key default gen_random_uuid(),
  discord_id text not null,
  username text not null,
  in_guild boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.discord_tickets enable row level security;
revoke all on table public.discord_tickets from anon, authenticated;

-- 3) Connexion avec le vrai nom Discord (comptes vérifiés) : renvoie l'e-mail technique du compte
--    (toujours une fausse adresse @legacy-beta.app, jamais une vraie)
create or replace function public.login_email_for(p_discord text) returns text
language sql stable security definer set search_path to 'public' as $function$
  select u.email::text
  from profiles p join auth.users u on u.id = p.id
  where p.discord_verified_at is not null
    and lower(p.discord) = lower(btrim(coalesce(p_discord, '')))
    and u.email like '%@legacy-beta.app'
  order by p.discord_verified_at desc
  limit 1
$function$;
revoke all on function public.login_email_for(text) from public;
grant execute on function public.login_email_for(text) to anon, authenticated;

-- 4) Inscription : accepte le ticket Discord vérifié (nouveau site)
--    et, pendant la transition seulement, l'ancienne méthode (pseudo Discord tapé)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare ps text := btrim(coalesce(new.raw_user_meta_data->>'pseudo', ''));
        dc text := btrim(coalesce(new.raw_user_meta_data->>'discord', ''));
        tk text := btrim(coalesce(new.raw_user_meta_data->>'discord_ticket', ''));
        t public.discord_tickets%rowtype;
begin
  if not _valid_pseudo(ps) then raise exception 'pseudo invalide'; end if;
  if tk <> '' then
    if tk !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'ticket Discord invalide'; end if;
    delete from discord_tickets where ticket = tk::uuid and created_at > now() - interval '30 minutes' returning * into t;
    if t.ticket is null then raise exception 'ticket Discord expiré'; end if;
    if new.email is distinct from ('d' || left(encode(extensions.digest('legacy|id:' || t.discord_id, 'sha256'), 'hex'), 40) || '@legacy-beta.app') then
      raise exception 'e-mail de connexion invalide';
    end if;
    insert into profiles(id, pseudo, discord, discord_id, discord_verified_at, discord_joined, twitter)
      values (new.id, ps, t.username, t.discord_id, now(), t.in_guild, left(coalesce(new.raw_user_meta_data->>'twitter', ''), 32));
  else
    -- ancienne méthode : coupée par la partie 2
    if dc = '' or length(dc) > 64 then raise exception 'discord invalide'; end if;
    insert into profiles(id, pseudo, discord, twitter)
      values (new.id, ps, dc, left(coalesce(new.raw_user_meta_data->>'twitter', ''), 32));
  end if;
  insert into transactions(player, delta, kind, note) values (new.id, 10, 'bonus', 'Bonus d''inscription');
  return new;
end $function$;
