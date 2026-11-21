-- LEGACY · Discord vérifié — partie 2 : obligation
-- À lancer JUSTE APRÈS la mise en ligne du nouveau site (partie 1 et fonction « discord-auth » déjà en place).

-- 1) Plus aucune inscription sans Discord vérifié, même en passant par l'API
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare ps text := btrim(coalesce(new.raw_user_meta_data->>'pseudo', ''));
        tk text := btrim(coalesce(new.raw_user_meta_data->>'discord_ticket', ''));
        t public.discord_tickets%rowtype;
begin
  if not _valid_pseudo(ps) then raise exception 'pseudo invalide'; end if;
  if tk !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'vérifie ton Discord avant de t''inscrire'; end if;
  delete from discord_tickets where ticket = tk::uuid and created_at > now() - interval '30 minutes' returning * into t;
  if t.ticket is null then raise exception 'ticket Discord expiré'; end if;
  if new.email is distinct from ('d' || left(encode(extensions.digest('legacy|id:' || t.discord_id, 'sha256'), 'hex'), 40) || '@legacy-beta.app') then
    raise exception 'e-mail de connexion invalide';
  end if;
  insert into profiles(id, pseudo, discord, discord_id, discord_verified_at, discord_joined, twitter)
    values (new.id, ps, t.username, t.discord_id, now(), t.in_guild, left(coalesce(new.raw_user_meta_data->>'twitter', ''), 32));
  insert into transactions(player, delta, kind, note) values (new.id, 10, 'bonus', 'Bonus d''inscription');
  return new;
end $function$;

-- 2) Les 35 actions du jeu (casino, matchs, paris, duels, cadeaux, messages…) exigent un Discord lié
create or replace function public._need_active(p uuid) returns void
language plpgsql security definer set search_path to 'public' as $function$
declare s text; u timestamptz; v timestamptz;
begin
  if p is not null then
    update profiles set last_seen = now() where id = p;
  end if;
  select status, restricted_until, discord_verified_at into s, u, v from profiles where id = p;
  if s = 'banned' then raise exception 'Ton compte est banni.'; end if;
  if s = 'restricted' and (u is null or u > now()) then
    raise exception 'Ton compte est restreint jusqu''à % : tu ne peux pas faire ça pour le moment.', to_char(u at time zone 'Europe/Paris', 'HH24:MI "le" DD/MM');
  end if;
  if p is not null and s is not null and v is null then
    if p = auth.uid() then raise exception 'Lie ton compte Discord pour jouer (bouton « Lier mon Discord »).';
    else raise exception 'Ce joueur doit d''abord lier son compte Discord.'; end if;
  end if;
end $function$;

-- 3) « J'ai rejoint le serveur » ne suffit plus : c'est le bot qui vérifie (fonction discord-auth)
create or replace function public.confirm_discord_join() returns void
language plpgsql security definer set search_path to 'public' as $function$
begin
  raise exception 'Recharge la page : le bot vérifie maintenant que tu es bien sur le serveur Discord.';
end $function$;
