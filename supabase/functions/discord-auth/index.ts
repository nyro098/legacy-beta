// LEGACY · vérification Discord (OAuth2) — Edge Function Supabase « discord-auth »
// À déployer avec « Verify JWT » DÉSACTIVÉ : l'action verify arrive avant la connexion.
// Appli Discord « Legacy Litiges » en « Client public » : l'échange du code se fait avec PKCE
// (code_verifier créé par le navigateur), sans clé secrète. DISCORD_CLIENT_SECRET reste facultatif.
// Secrets utilisés : DISCORD_BOT_TOKEN et DISCORD_GUILD_ID (déjà là pour la fonction « discord »).
// Actions (POST JSON) :
//   { action: 'verify', code, code_verifier, redirect_uri } -> avant l'inscription : lit le vrai compte
//                                               Discord et renvoie un ticket à usage unique (30 min)
//   { action: 'link', code, code_verifier, redirect_uri }   -> compte connecté : lie son vrai Discord
//   { action: 'check_guild' }                -> compte connecté : le bot vérifie qu'il est sur le serveur
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const env = (k: string) => Deno.env.get(k) ?? '';
const API = 'https://discord.com/api/v10';
// identifiant public de l'appli Discord du bot (aussi dans config.js du site)
const CLIENT_ID = env('DISCORD_CLIENT_ID') || '1569298417505800222';
// adresses de retour acceptées (doivent aussi être déclarées dans l'appli Discord)
const REDIRECTS = ['https://nyro098.github.io/legacy-beta/', 'http://localhost:5510/'];
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });
const fail = (msg: string, s = 400, extra: Record<string, unknown> = {}) => json({ error: msg, ...extra }, s);
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

type DUser = { id: string; username: string; global_name?: string | null; discriminator?: string };

// nom affiché/identifiant : le nom d'utilisateur Discord (avec #0000 pour les très vieux comptes)
const handle = (u: DUser) => (u.discriminator && u.discriminator !== '0' ? `${u.username}#${u.discriminator}` : u.username);

async function form(path: string, body: Record<string, string>) {
  return await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  });
}

// Échange le code OAuth2 contre le compte Discord. Le jeton n'est jamais gardé.
async function discordUser(code: string, redirect: string, verifier: string): Promise<DUser> {
  const app: Record<string, string> = { client_id: CLIENT_ID };
  if (env('DISCORD_CLIENT_SECRET')) app.client_secret = env('DISCORD_CLIENT_SECRET');
  const ex: Record<string, string> = { ...app, grant_type: 'authorization_code', code, redirect_uri: redirect };
  if (verifier) ex.code_verifier = verifier;
  const r = await form('/oauth2/token', ex);
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.access_token) throw new Error('Discord a refusé la vérification (code expiré ?). Réessaie.');
  const u = await fetch(API + '/users/@me', { headers: { Authorization: 'Bearer ' + tok.access_token } });
  const me = await u.json().catch(() => ({}));
  await form('/oauth2/token/revoke', { ...app, token: tok.access_token, token_type_hint: 'access_token' }).catch(() => null);
  if (!u.ok || !me.id || !me.username) throw new Error('Impossible de lire ton compte Discord. Réessaie.');
  return me as DUser;
}

// Le bot regarde si ce compte Discord est sur le serveur
async function inGuild(id: string): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`${API}/guilds/${env('DISCORD_GUILD_ID')}/members/${id}`, {
      headers: { Authorization: 'Bot ' + env('DISCORD_BOT_TOKEN').trim().replace(/^Bot\s+/i, '') },
    });
    if (r.status === 429) {
      const j = await r.json().catch(() => ({}));
      await new Promise((s) => setTimeout(s, 1000 * (j.retry_after || 1)));
      continue;
    }
    if (r.ok) return true;
    if (r.status === 404) return false;
    throw new Error('Le bot Discord ne répond pas (' + r.status + '). Réessaie dans un instant.');
  }
  throw new Error('Discord est surchargé, réessaie dans un instant.');
}

async function caller(req: Request) {
  const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await db.auth.getUser(jwt);
  return data?.user ?? null;
}

// échappe % et _ pour une recherche ILIKE exacte
const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return fail('Méthode non autorisée.', 405);
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    if (action === 'verify' || action === 'link') {
      const code = String(body.code || ''), redirect = String(body.redirect_uri || ''), verifier = String(body.code_verifier || '');
      if (!code || !REDIRECTS.includes(redirect)) return fail('Demande invalide.');
      if (verifier && !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return fail('Demande invalide.');
      if (!verifier && !env('DISCORD_CLIENT_SECRET')) return fail('La vérification Discord n\'est pas encore configurée.', 503);
      const user = action === 'link' ? await caller(req) : null;
      if (action === 'link' && !user) return fail('Connecte-toi d\'abord.', 401);

      const du = await discordUser(code, redirect, verifier);
      const name = handle(du);
      const { data: owner } = await db.from('profiles').select('id').eq('discord_id', du.id).maybeSingle();

      if (action === 'verify') {
        if (owner) return fail('Ce Discord a déjà un compte Legacy. Connecte-toi avec ton mot de passe.', 409, { taken: true, username: name });
        // un ancien compte (pas encore vérifié) a été créé avec ce nom Discord : c'est sûrement le sien
        const { data: old } = await db.from('profiles').select('id').is('discord_verified_at', null).ilike('discord', likeExact(name)).limit(1);
        if (old && old.length) {
          return fail('Un ancien compte Legacy utilise déjà ce Discord. Si c\'est le tien, connecte-toi avec ton mot de passe : le site te demandera de lier ton Discord. Sinon, ouvre un ticket sur le serveur.', 409, { taken: true, username: name });
        }
        const member = await inGuild(du.id);
        await db.from('discord_tickets').delete().lt('created_at', new Date(Date.now() - 86400000).toISOString());
        const { data: t, error } = await db.from('discord_tickets')
          .insert({ discord_id: du.id, username: name, in_guild: member }).select('ticket').single();
        if (error || !t) throw new Error('Impossible d\'enregistrer la vérification. Réessaie.');
        return json({ ticket: t.ticket, discord_id: du.id, username: name, global_name: du.global_name || '', in_guild: member });
      }

      // link : compte existant
      if (owner && owner.id !== user!.id) return fail('Ce Discord est déjà lié à un autre compte Legacy.', 409);
      const member = await inGuild(du.id);
      const { error } = await db.from('profiles').update({
        discord_id: du.id,
        discord: name,
        discord_verified_at: new Date().toISOString(),
        discord_joined: member, // le bot a vérifié : présent ou pas sur le serveur
      }).eq('id', user!.id);
      if (error) {
        if (String(error.code) === '23505') return fail('Ce Discord est déjà lié à un autre compte Legacy.', 409);
        throw new Error('Impossible d\'enregistrer la liaison. Réessaie.');
      }
      return json({ username: name, in_guild: member });
    }

    if (action === 'check_guild') {
      const user = await caller(req);
      if (!user) return fail('Connecte-toi d\'abord.', 401);
      const { data: p } = await db.from('profiles').select('discord_id').eq('id', user.id).single();
      if (!p?.discord_id) return fail('Lie d\'abord ton compte Discord.');
      const member = await inGuild(p.discord_id);
      if (member) await db.from('profiles').update({ discord_joined: true }).eq('id', user.id);
      return json({ in_guild: member });
    }

    return fail('Action inconnue.');
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Erreur inattendue. Réessaie.', 500);
  }
});
