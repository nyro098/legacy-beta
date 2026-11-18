(function(){
'use strict';

/* ---------- constantes ---------- */
var START = 10;
var MODES = ['Box fight','Build fight','Zone wars','Realistic 1v1','Pickaxe fight'];
var BOS = ['FT3','FT5','FT7'];
var BO_LABEL = {FT3: 'Premier à 3', FT5: 'Premier à 5', FT7: 'Premier à 7'};
function boLabel(m){ return esc(BO_LABEL[m.bo] || m.bo) + ' · Kill lead ' + (m.killLead != null ? m.killLead : 1) + (m.pingpong ? ' · ping-pong' : '') + (m.noBreak ? ' · casser interdit' : ''); }
var COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle class="c1" cx="10" cy="10" r="9"/><circle class="c2" cx="10" cy="10" r="6.5"/><path class="c3" d="M8.2 6.2v7.4h4"/></svg>';
var EMAIL_DOMAIN = 'legacy-beta.app';
var DISCORD_URL = 'https://discord.gg/EpNWaAscD';
var DC_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.8 19.8 0 0 0 6 3l1.3-2.1a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8 15.3c-1.2 0-2.1-1.1-2.1-2.4S6.8 10.5 8 10.5s2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm8 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z"/></svg>';
function dcBtn(label){ return '<a class="btn sm discord-btn dc-top" href="' + DISCORD_URL + '" target="_blank" rel="noopener noreferrer" title="Rejoindre le serveur Discord GRIND">' + DC_ICON + '<span>' + label + '</span></a>'; }

/* ---------- utilitaires ---------- */
function $(s){ return document.querySelector(s); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function fmt(n){ n = Math.round(Number(n || 0) * 100) / 100; return String(n).replace('.', ','); }
function num(v){ return parseFloat(String(v == null ? '' : v).replace(',', '.')); }
function cn(n){ return fmt(n) + ' coin' + (Math.abs(n) > 1 ? 's' : ''); }
var MAXC = 100;
var LOGO = '<img class="logo-mark" src="logo.svg" alt="" width="40" height="40">';
function hue(s){ var h = 0; s = String(s || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
function ini(s){ return esc(String(s).slice(0, 2)); }
var rtf = null; try { rtf = new Intl.RelativeTimeFormat('fr', {numeric: 'auto'}); } catch(e){}
function ago(t){
  if (!t || !rtf) return '';
  var m = (t - Date.now()) / 6e4, h = m / 60;
  if (Math.abs(m) < 60) return rtf.format(Math.round(m), 'minute');
  if (Math.abs(h) < 24) return rtf.format(Math.round(h), 'hour');
  return rtf.format(Math.round(h / 24), 'day');
}

/* ---------- Supabase ---------- */
var CFG = window.LEGACY_CONFIG || {};
var configured = /^https:\/\//.test(CFG.url || '') && CFG.key && CFG.key.indexOf('COLLE') < 0;
var sb = configured ? window.supabase.createClient(CFG.url, CFG.key) : null;

var S = {players: {}, matches: {}, bets: {}, me: null, lastMatch: null};
var txCache = {};
var loaded = false, loadErr = '';

function mapPlayer(p){ return {id: p.id, pseudo: p.pseudo, cc: Number(p.casino_coins) || 0, ccClaim: p.casino_claim_at ? Date.parse(p.casino_claim_at) : 0, lfm: p.lfm_until ? Date.parse(p.lfm_until) : 0, anon: !!p.anon_join, twitch: p.twitch || '', fortnite: p.fortnite || '', epic: !!p.epic_id, vip: !!p.vip && !!p.vip_until && Date.parse(p.vip_until) > Date.now(), vipUntil: p.vip_until ? Date.parse(p.vip_until) : 0, statsResetAt: p.stats_reset_at ? Date.parse(p.stats_reset_at) : 0, nameStyle: p.name_style || '', titleKey: p.title || '', title: (TITLES[p.title] || WHEEL_TITLES[p.title] || (CASINO_TITLES[p.title] ? CASINO_TITLES[p.title][0] : '')), owned: p.owned_items || [], eq: p.equipped || {}, vipSince: p.vip_since ? Date.parse(p.vip_since) : 0, discord: p.discord, twitter: p.twitter, bio: p.bio, balance: Number(p.balance), admin: p.is_admin, owner: p.is_owner, esport: !!p.is_esport, joined: p.discord_joined, avatar: p.avatar_url || '', rulesAt: p.rules_accepted_at ? Date.parse(p.rules_accepted_at) : 0, status: (p.status === 'restricted' && p.restricted_until && Date.parse(p.restricted_until) <= Date.now()) ? 'ok' : (p.status || 'ok'), statusReason: p.status_reason || '', restrictedUntil: p.restricted_until ? Date.parse(p.restricted_until) : 0, createdAt: Date.parse(p.created_at)}; }
function mapMatch(m){
  return {id: m.id, creator: m.creator, teamA: m.team_a || [], teamB: m.team_b || [], size: m.size, format: m.size + 'v' + m.size, mode: m.mode, bo: m.bo,
    stake: Number(m.stake), pingpong: !!m.pingpong, noBreak: !!m.no_break, killLead: m.kill_lead != null ? Number(m.kill_lead) : 1, rules: m.rules, target: m.target, status: m.status, declA: m.decl_a, declB: m.decl_b, winner: m.winner, adminWinner: m.admin_resolved,
    doubleA: !!m.double_a, doubleB: !!m.double_b, doubleMatchId: m.double_match_id || null,
    teamATeam: m.team_a_team || null,
    aSA: m.a_decl_sa, aSB: m.a_decl_sb, bSA: m.b_decl_sa, bSB: m.b_decl_sb,
    scoreA: m.score_a, scoreB: m.score_b, scoreOk: !!m.score_confirmed,
    firstDeclAt: m.first_decl_at ? Date.parse(m.first_decl_at) : 0, pinnedUntil: m.pinned_until ? Date.parse(m.pinned_until) : 0, afkClaim: !!m.afk_claim, autoValidated: !!m.auto_validated, createdAt: Date.parse(m.created_at), finishedAt: m.finished_at ? Date.parse(m.finished_at) : 0};
}
function refresh(){
  return Promise.all([
    sb.from('profiles').select('id,pseudo,' + (S.me ? 'discord,' : '') + 'twitter,bio,balance,is_admin,is_owner,is_esport,discord_joined,avatar_url,rules_accepted_at,status,status_reason,restricted_until,last_seen,lfm_until,casino_coins,casino_claim_at,vip,vip_since,name_style,title,owned_items,equipped,stats_reset_at,vip_until,anon_join,twitch,fortnite,epic_id,created_at'),
    sb.from('matches').select('*').order('created_at', {ascending: false}).limit(400),
    S.me ? sb.from('friendships').select('requester,addressee,status,created_at') : Promise.resolve({data: []}),
    S.me ? sb.from('teams').select('id,name,owner,size,created_at') : Promise.resolve({data: []}),
    S.me ? sb.from('team_members').select('team_id,player,status,invited_by') : Promise.resolve({data: []}),
    S.me ? sb.from('notifications').select('*').order('created_at', {ascending: false}).limit(40) : Promise.resolve({data: []}),
    sb.from('tournaments').select('*').order('created_at', {ascending: false}).limit(50),
    sb.from('tournament_players').select('*'),
    sb.from('tournament_matches').select('*'),
    S.me ? sb.from('wheel_spins').select('at').eq('player', S.me).order('at', {ascending: false}).limit(1) : Promise.resolve({data: []}),
    S.me ? sb.from('match_tickets').select('match_id,guild_id,channel_id,status,deadline_at') : Promise.resolve({data: []}),
    sb.from('wheel_spins').select('player,prize,amount,at').in('prize', ['c05', 'c1', 'c5', 'title', 'title_dup']).order('at', {ascending: false}).limit(8),
    sb.from('match_bets').select('*').order('created_at', {ascending: false}).limit(400),
    sb.from('customs').select('*').order('created_at', {ascending: false}).limit(60),
    sb.from('custom_entries').select('*').order('joined_at'),
    S.me ? sb.from('custom_codes').select('*') : Promise.resolve({data: []}),
    sb.from('tour_bans').select('*')
  ]).then(function(r){
    var CU = {}; ((r[13] && r[13].data) || []).forEach(function(x){ x.entries = []; x.code = null; CU[x.id] = x; });
    ((r[14] && r[14].data) || []).forEach(function(e){ if (CU[e.custom_id]) CU[e.custom_id].entries.push(e); });
    ((r[15] && r[15].data) || []).forEach(function(c){ if (CU[c.custom_id]) CU[c.custom_id].code = c; });
    S.customs = CU;
    S.tourBans = {}; ((r[16] && r[16].data) || []).forEach(function(b){ S.tourBans[b.player] = Date.parse(b.until); });
    S.lastSpin = r[9] && r[9].data && r[9].data[0] ? Date.parse(r[9].data[0].at) : 0;
    S.tickets = {}; ((r[10] && r[10].data) || []).forEach(function(t){ S.tickets[t.match_id] = t; });
    S.spinFeed = (r[11] && r[11].data) || [];
    var B = {};
    ((r[12] && r[12].data) || []).forEach(function(b){
      if (!B[b.match_id]) B[b.match_id] = [];
      B[b.match_id].push({id: b.id, matchId: b.match_id, player: b.player, side: b.side, amount: Number(b.amount), settled: !!b.settled, won: b.won, at: Date.parse(b.created_at)});
    });
    S.bets = B;
    if (r[0].error) throw r[0].error;
    if (r[1].error) throw r[1].error;
    var P = {}, M = {};
    r[0].data.forEach(function(p){ P[p.id] = mapPlayer(p); P[p.id].lastSeen = p.last_seen ? Date.parse(p.last_seen) : 0; });
    r[1].data.forEach(function(m){ M[m.id] = mapMatch(m); });
    S.players = P; S.matches = M; S.friends = r[2].data || []; var T = {}; (r[3].data || []).forEach(function(x){ x.members = []; T[x.id] = x; }); (r[4].data || []).forEach(function(x){ if (T[x.team_id]) T[x.team_id].members.push(x); }); S.teams = T; S.notifs = r[5].data || []; var TT = {}; (r[6].data || []).forEach(function(x){ x.players = []; x.matches = []; TT[x.id] = x; }); (r[7].data || []).forEach(function(x){ if (TT[x.tournament_id]) TT[x.tournament_id].players.push(x); }); (r[8].data || []).forEach(function(x){ if (TT[x.tournament_id]) TT[x.tournament_id].matches.push(x); }); S.tours = TT; loaded = true; loadErr = '';
    txCache = {};
    setTimeout(checkGiftReveal, 700);
  }).catch(function(e){ loadErr = (e && e.message) || 'Erreur réseau'; loaded = true; });
}
function loadTx(pid){
  if (txCache[pid]) return;
  txCache[pid] = 'loading';
  sb.from('transactions').select('*').eq('player', pid).order('at', {ascending: false}).limit(100).then(function(r){
    txCache[pid] = r.data || [];
    if (viewName() === 'profil') render();
  });
}
function cleanErr(m){
  m = String(m || 'Erreur inconnue');
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Connexion impossible. Vérifie ta connexion internet.';
  return m.replace(/^.*?ERROR:\s*/, '');
}
function rpc(fn, args){
  return sb.rpc(fn, args).then(function(r){
    if (r.error) return {ok: false, msg: cleanErr(r.error.message)};
    return refresh().then(function(){ return {ok: true, data: r.data}; });
  });
}

/* ---------- comptes : 1 Discord = 1 compte ---------- */
function normDiscord(v){ return String(v || '').trim().toLowerCase(); }
function emailFor(discord){
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode('legacy|' + normDiscord(discord))).then(function(b){
    var hex = Array.prototype.map.call(new Uint8Array(b), function(x){ return ('0' + x.toString(16)).slice(-2); }).join('');
    return 'd' + hex.slice(0, 40) + '@' + EMAIL_DOMAIN;
  });
}
function signup(d){
  var pseudo = String(d.pseudo || '').trim(), discord = String(d.discord || '').trim(), pw = String(d.password || '');
  if (!discord) return Promise.resolve({ok: false, msg: 'Entre ton Discord.'});
  if (discord.length > 64) return Promise.resolve({ok: false, msg: 'Discord trop long (64 caractères max).'});
  if (pseudo.length < 2 || pseudo.length > 24 || /[\u0000-\u001f\u007f]/.test(pseudo)) return Promise.resolve({ok: false, msg: 'Le pseudo fait 2 à 24 caractères (espaces et caractères spéciaux autorisés).'});
  if (pw.length < 8) return Promise.resolve({ok: false, msg: 'Le mot de passe fait au moins 8 caractères.'});
  if (/^(.)\1+$|^(12345678|123456789|azertyui|azertyuiop|password|motdepasse|fortnite)/i.test(pw)) return Promise.resolve({ok: false, msg: 'Mot de passe trop facile à deviner, choisis-en un autre.'});
  if (pw !== String(d.password2 || '')) return Promise.resolve({ok: false, msg: 'Les deux mots de passe ne sont pas identiques.'});
  return sb.rpc('signup_check', {p_pseudo: pseudo, p_discord: discord}).then(function(c){
    if (c.error) return {ok: false, msg: cleanErr(c.error.message)};
    if (c.data === 'discord') return {ok: false, msg: 'Ce Discord a déjà un compte. Connecte-toi avec ton mot de passe.'};
    if (c.data === 'pseudo') return {ok: false, msg: 'Ce pseudo est déjà pris.'};
    return emailFor(discord).then(function(email){
      return sb.auth.signUp({email: email, password: pw, options: {data: {pseudo: pseudo, discord: discord, twitter: String(d.twitter || '').trim().replace(/^@/, '')}}});
    }).then(function(r){
      if (r.error) return {ok: false, msg: /registered|exists/i.test(r.error.message) ? 'Ce Discord a déjà un compte.' : cleanErr(r.error.message)};
      if (!r.data.session) return {ok: false, msg: 'Compte créé mais la confirmation par e-mail est activée sur Supabase : désactive « Confirm email ».'};
      return {ok: true};
    });
  });
}
function login(d){
  var discord = String(d.discord || '').trim();
  if (!discord || !d.password) return Promise.resolve({ok: false, msg: 'Entre ton Discord et ton mot de passe.'});
  return emailFor(discord).then(function(email){ return sb.auth.signInWithPassword({email: email, password: String(d.password)}); }).then(function(r){
    if (r.error) return {ok: false, msg: /invalid/i.test(r.error.message) ? 'Discord ou mot de passe incorrect.' : cleanErr(r.error.message)};
    return {ok: true};
  });
}

/* ---------- logique d'affichage ---------- */
function P(id){ return S.players[id] || {id: id, pseudo: 'Joueur inconnu', discord: '', twitter: '', bio: '', balance: 0}; }
function me(){ return S.me ? S.players[S.me] : null; }
function isAdmin(){ var p = me(); return !!(p && p.admin); }
function isOwner(){ var p = me(); return !!(p && p.owner); }
function canTourney(){ var p = me(); return !!(p && (p.owner || p.esport)); }
var ESPORT_TITLE = 'ORIONG Esport';
function nm(p){ var fx = p.eq && p.eq.fx ? ' fx-' + p.eq.fx.split(':')[1] : '', em = p.eq && p.eq.emoji ? ' <span class="emo">' + (EMOJI[p.eq.emoji.split(':')[1]] || '') + '</span>' : ''; var cls = (p.nameStyle ? 'neon neon-' + p.nameStyle : '') + fx; return (cls ? '<span class="' + cls.trim() + '" data-t="' + esc(p.pseudo) + '">' + esc(p.pseudo) + '</span>' : esc(p.pseudo)) + em; }
function titleHTML(p){ return (p.esport ? '<span class="ptitle esport">⭐ ' + ESPORT_TITLE + '</span> ' : '') + (p.title ? '<span class="ptitle' + titleTier(p.titleKey) + '">' + esc(p.title) + '</span>' : ''); }
function badge(p){ return (p.vip ? ' <em class="beta vip">VIP</em>' : '') + ((p.owned || []).length >= 10 ? ' <em class="beta col" title="Collectionneur : 10 articles">🏅</em>' : '') + (p.owner ? ' <em class="beta owner">FONDATEUR</em>' : p.admin ? ' <em class="beta">ADMIN</em>' : '') + (isAdmin() && p.status === 'banned' ? ' <em class="beta ban">BANNI</em>' : isAdmin() && p.status === 'restricted' ? ' <em class="beta ban">RESTREINT</em>' : ''); }
function names(ids){ return ids.map(function(i){ return P(i).pseudo; }).join(', '); }
function capA(m){ return m.teamA[0] || null; }
function capB(m){ return m.teamB[0] || null; }
function teamOf(m, pid){ return m.teamA.indexOf(pid) >= 0 ? 'A' : (m.teamB.indexOf(pid) >= 0 ? 'B' : null); }
function stateOf(m){ return m.status; }
function winnerSide(m){ return m.winner || null; }
function active(m){ return m.status === 'open' || m.status === 'live' || m.status === 'dispute'; }
function avail(pid){ return P(pid).balance || 0; }
function locked(pid){ var t = 0; for (var k in S.matches) { var m = S.matches[k]; if (active(m) && teamOf(m, pid)) t += m.stake; } return t; }
function balance(pid){ return avail(pid) + locked(pid); }
// Bonus de stats offert par le fondateur (14/11/2026) : s'ajoute aux vraies stats du joueur, ne modifie aucun match ni aucun autre joueur.
// Pour le retirer : supprimer la ligne du joueur ci-dessous.
var STAT_BONUS = {'a11b45b3-556e-4875-9fad-327700c971a0': {w: 2, net: 2}};   // Shxwn0nly200 : +2 victoires, +2 coins gagnés
function stats(pid){
  var p = P(pid);
  var w = 0, l = 0, net = 0, list = [];
  for (var k in S.matches) {
    var m = S.matches[k], t = teamOf(m, pid);
    if (m.status !== 'done' || !t || m.finishedAt < (p.statsResetAt || 0)) continue;
    var win = t === m.winner; list.push({at: m.finishedAt, win: win});
    if (win) { w++; net += m.stake; } else { l++; net -= m.stake; }
  }
  list.sort(function(a, b){ return b.at - a.at; });
  var streak = 0; for (var i = 0; i < list.length; i++) { if (list[i].win) streak++; else break; }
  var bn = STAT_BONUS[pid]; if (bn) { w += bn.w; net += bn.net; if (!list.length || list[0].win) streak += bn.w; }
  return {w: w, l: l, net: net, streak: streak, ratio: (w + l) ? Math.round(100 * w / (w + l)) : null};
}
var RANKS = [
  {k: 'unranked', name: 'Non classé', min: 0, ico: '⚪'},
  {k: 'bronze', name: 'Bronze', min: 1, ico: '🥉'},
  {k: 'silver', name: 'Argent', min: 3, ico: '🥈'},
  {k: 'gold', name: 'Or', min: 6, ico: '🥇'},
  {k: 'plat', name: 'Platine', min: 10, ico: '💠'},
  {k: 'diamond', name: 'Diamant', min: 15, ico: '💎'},
  {k: 'elite', name: 'Élite', min: 22, ico: '🛡️'},
  {k: 'champ', name: 'Champion', min: 30, ico: '🔥'},
  {k: 'unreal', name: 'Unreal', min: 40, ico: '👑'}
];
function rankInfo(w){
  var idx = 0;
  for (var i = 0; i < RANKS.length; i++) if (w >= RANKS[i].min) idx = i;
  return {cur: RANKS[idx], next: RANKS[idx + 1] || null, idx: idx};
}
function rankBadge(pid, big){
  var p = P(pid); if (p.owner) return '';
  var s = stats(pid), r = rankInfo(s.w).cur;
  return '<span class="rk rk-' + r.k + (big ? ' lg' : '') + '" title="Rang Saison 1 : ' + r.name + ' (' + s.w + ' victoire' + (s.w > 1 ? 's' : '') + ')"><i>' + r.ico + '</i>' + r.name + '</span>';
}
function seasonDaysLeft(){
  var now = new Date(), end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.max(1, Math.ceil((end.getTime() - now.getTime()) / 864e5));
}
function rankCardHTML(pid){
  var p = P(pid); if (p.owner) return '';
  var s = stats(pid), info = rankInfo(s.w), cur = info.cur, nxt = info.next;
  var pct = nxt ? Math.min(100, Math.round(100 * (s.w - cur.min) / Math.max(1, nxt.min - cur.min))) : 100;
  var rem = nxt ? (nxt.min - s.w) : 0;
  var steps = RANKS.slice(1).map(function(rk){
    var done = s.w >= rk.min, active = cur.k === rk.k;
    return '<span class="rk-step' + (done ? ' done' : '') + (active ? ' cur' : '') + '"><i>' + rk.ico + '</i><b>' + rk.name + '</b><small>' + rk.min + 'V</small></span>';
  }).join('');
  return '<section class="rk-card rk-bg-' + cur.k + '">' +
    '<div class="rk-top">' +
      '<div class="rk-emblem rk-' + cur.k + '"><span>' + cur.ico + '</span></div>' +
      '<div class="rk-meta">' +
        '<p class="eyebrow">Saison 1 · fin dans ' + seasonDaysLeft() + ' j</p>' +
        '<h2>' + cur.name + '</h2>' +
        '<p class="rk-sub">' + (nxt ? 'Encore <b>' + rem + ' victoire' + (rem > 1 ? 's' : '') + '</b> pour atteindre le rang <b>' + nxt.name + ' ' + nxt.ico + '</b>' : '👑 Rang maximum atteint — tu es au sommet de l\'arène !') + '</p>' +
      '</div>' +
      '<div class="rk-score"><b>' + s.w + '</b><span>Victoire' + (s.w > 1 ? 's' : '') + '</span></div>' +
    '</div>' +
    '<div class="rk-bar"><i style="width:' + pct + '%"></i></div>' +
    '<div class="rk-ladder">' + steps + '</div>' +
  '</section>';
}
function seasonBannerHTML(){
  var steps = RANKS.slice(1).map(function(rk){ return '<span class="rk rk-' + rk.k + '"><i>' + rk.ico + '</i>' + rk.name + ' <small>· ' + rk.min + 'V</small></span>'; }).join('');
  return '<section class="season-ban"><div class="sb-head"><div><p class="eyebrow">Classé · Saison 1</p><h2 class="sec">Course au rang Unreal 👑</h2><p class="help">Gagne des matchs pour monter de Bronze jusqu\'à Unreal. Remise à zéro des rangs dans <b>' + seasonDaysLeft() + ' jours</b>.</p></div></div><div class="sb-ranks">' + steps + '</div></section>';
}
function coinsInPlay(){ var t = 0; for (var k in S.matches) { var m = S.matches[k]; if (active(m)) t += m.stake * (m.teamA.length + m.teamB.length); } return t; }
function myDecl(m){ return S.me === capA(m) ? m.declA : S.me === capB(m) ? m.declB : null; }

/* ---------- état de l'interface ---------- */
var authTab = 'login', tab = 'ouverts', viewPid = null, editing = false, dlg = null, lastFocus = null, toastT = null, busy = false;
var VIEWS = ['arene', 'roue', 'casino', 'tournois', 'classement', 'amis', 'boutique', 'profil', 'regles', 'signaler', 'match'];
function viewName(){
  var h = (location.hash || '').slice(1);
  if (h.indexOf('match-') === 0) { S.lastMatch = h.slice(6); return S.matches[S.lastMatch] ? 'match' : 'arene'; }
  return VIEWS.indexOf(h) >= 0 && h !== 'match' ? h : 'arene';
}
function toast(msg){ var t = $('#toast'); t.textContent = msg; clearTimeout(toastT); toastT = setTimeout(function(){ t.textContent = ''; }, 4500); }
function openMatch(id){ if (location.hash === '#match-' + id) { render(); } else location.hash = '#match-' + id; window.scrollTo(0, 0); }

/* ---------- gabarits ---------- */
var STATE_LABEL = {open: 'Ouvert', live: 'En cours', dispute: 'Litige', done: 'Terminé', cancelled: 'Annulé'};
function av(p, cls){ var fr = p.eq && p.eq.frame ? p.eq.frame.split(':')[1] : ''; var inner = av0(p, cls); return fr ? '<span class="avf avf-' + fr + ' ' + (cls || '') + '">' + inner + '</span>' : inner; }
function av0(p, cls){ return p.avatar ? '<span class="av has-img ' + (cls || '') + '"><img src="' + esc(p.avatar) + '" alt="" loading="lazy"></span>' : '<span class="av ' + (cls || '') + '" style="--h:' + hue(p.pseudo) + '">' + ini(p.pseudo) + '</span>'; }

var ANON = {id: '', pseudo: 'Joueur anonyme', anonMask: true, avatar: '', eq: {}, owned: [], nameStyle: '', title: ''};
function masked(m, pid){ return m.status === 'open' && pid && pid !== S.me && pid !== m.creator && !isAdmin() && P(pid).anon; }
function PM(m, pid){ return masked(m, pid) ? ANON : P(pid); }
function anonAv(cls){ return '<span class="av anon-av ' + (cls || '') + '">🕶️</span>'; }
function sideHTML(m, team, ws){
  var ids = team === 'A' ? m.teamA : m.teamB, cls = team === 'A' ? 'a' : 'b', st = stateOf(m);
  var c = cls + (st === 'done' && ws ? (ws === team ? ' win' : ' lose') : '');
  var lead = ids[0] && S.players[ids[0]]; if (lead && lead.eq && lead.eq.poster) c += ' pt-' + lead.eq.poster.split(':')[1];
  var tag = (st === 'done' && ws === team) ? '<span class="tagw">VAINQUEUR</span>' : '';
  if (m.size === 1) {
    var pid = ids[0];
    if (!pid) return '<div class="side ' + c + '"><span class="av lg empty-av">?</span><strong>En attente</strong><small>' + (m.target ? 'Défi pour ' + esc(P(m.target).pseudo) : 'Ouvert à tous') + '</small></div>';
    if (masked(m, pid)) return '<div class="side ' + cls + '">' + anonAv('lg') + '<strong>Joueur anonyme</strong><small>Révélé au début du match</small></div>';
    var p = P(pid), s = stats(pid);
    return '<div class="side ' + c + '">' + av(p, 'lg') + '<strong>' + nm(p) + '</strong>' + titleHTML(p) + rankBadge(pid, false) + '<small>' + s.w + 'V · ' + s.l + 'D</small>' + tag + '</div>';
  }
  var rows = '';
  for (var i = 0; i < m.size; i++) {
    var q = ids[i];
    rows += q ? '<li class="slot">' + (masked(m, q) ? anonAv('sm') + '<span class="nm">Joueur anonyme</span>' : av(P(q), 'sm') + '<span class="nm">' + nm(P(q)) + '</span>') + (i === 0 ? '<i>cap.</i>' : '') + '</li>'
              : '<li class="slot free"><span class="av sm empty-av">+</span><span class="nm">Place libre</span></li>';
  }
  return '<div class="side ' + c + '"><span class="tname">Équipe ' + team + '</span><ul class="roster">' + rows + '</ul>' + tag + '</div>';
}

function posterHTML(m, big){
  var st = stateOf(m), ws = winnerSide(m), tm = teamOf(m, S.me), id = esc(m.id);
  var ha = hue(P(m.teamA[0]).pseudo), hb = m.teamB.length ? hue(PM(m, m.teamB[0]).pseudo) : 0;
  var face = '<div class="p-face' + (m.size > 1 ? ' team' : '') + ((m.size === 1 && !m.teamB.length) ? ' vacant-b' : '') + '" style="--ha:' + ha + ';--hb:' + hb + '">' +
    sideHTML(m, 'A', ws) + sideHTML(m, 'B', ws) + (m.status === 'done' && m.scoreA != null ? '<div class="vs score" aria-label="Score ' + m.scoreA + ' à ' + m.scoreB + '">' + m.scoreA + '<i>–</i>' + m.scoreB + '</div>' : '<div class="vs" aria-hidden="true">VS</div>') + '</div>';
  var pot = '<div class="p-pot"><span>Mise de chaque joueur</span><b>' + COIN + fmt(m.stake) + '</b></div>';
  var liveTag = matchLive(m) ? '<span class="live-tag">🔴 LIVE</span>' : '';
  var bt = betTotals(m.id), mb = myBet(m.id);
  var betTag = bt.total > 0 ? '<span class="bo bet-tag" title="Paris enregistrés : gain x2">🎲 ' + fmt(bt.total) + ' (x2)</span>' : '';
  var top = '<div class="p-top">' + liveTag + betTag + '<span class="mode">' + esc(m.mode) + '</span><span class="fmt">' + esc(m.format) + '</span><span class="bo">' + esc(BO_LABEL[m.bo] || m.bo) + '</span><span class="bo">Kill lead ' + (m.killLead != null ? m.killLead : 1) + '</span>' + (m.pingpong ? '<span class="bo pp">Ping-pong</span>' : '') + (m.noBreak ? '<span class="bo pp">🚫 Casser interdit</span>' : '') + (st === 'open' && m.pinnedUntil > Date.now() ? '<span class="pin-tag">📌 Épinglé</span>' : '') + '<span class="chip ' + st + '">' + STATE_LABEL[st] + '</span></div>';
  if (big) return '<div class="poster big">' + top + face + pot + '</div>';
  var f = '', needs = m.size * 2 - m.teamA.length - m.teamB.length;
  if (st === 'open') {
    if (tm) f = '<small>Tu es dans l\'équipe ' + tm + ' · ' + needs + ' place' + (needs > 1 ? 's' : '') + ' libre' + (needs > 1 ? 's' : '') + '</small><button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button>';
    else if (m.target && m.target !== S.me) f = '<small>Réservé à ' + esc(P(m.target).pseudo) + '</small>' + (mb ? '<span class="chip" style="background:rgba(240,180,41,0.18);color:#f0b429">🎲 ' + cn(mb.amount) + '</span>' : '<button class="btn sm" data-act="bet-dialog" data-id="' + id + '">🎲 Parier · x2</button>');
    else if (m.size === 1) f = '<small>Lancé ' + ago(m.createdAt) + '</small><div class="actions"><button class="btn primary sm" data-act="join" data-id="' + id + '">Accepter</button>' + (mb ? '<span class="chip" style="background:rgba(240,180,41,0.18);color:#f0b429">🎲 ' + cn(mb.amount) + '</span>' : '<button class="btn sm" data-act="bet-dialog" data-id="' + id + '">🎲 Parier · x2</button>') + '</div>';
    else f = '<small>' + needs + ' place' + (needs > 1 ? 's' : '') + ' libre' + (needs > 1 ? 's' : '') + '</small><div class="actions">' +
        (m.teamA.length < m.size && canJoinA(m) ? '<button class="btn primary sm" data-act="join" data-id="' + id + '" data-team="A">Équipe A</button>' : '') +
        (m.teamB.length < m.size ? '<button class="btn primary sm" data-act="join" data-id="' + id + '" data-team="B">Équipe B</button>' : '') +
        (mb ? '<span class="chip" style="background:rgba(240,180,41,0.18);color:#f0b429">🎲 ' + cn(mb.amount) + '</span>' : '<button class="btn sm" data-act="bet-dialog" data-id="' + id + '">🎲 Parier · x2</button>') + '</div>';
  } else if (st === 'live' && tm) f = '<small>' + (myDecl(m) ? 'Résultat envoyé' : 'Résultat à déclarer') + '</small><button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button>';
  else if (st === 'live') {
    f = '<small>Match en cours</small><div class="actions">' + (mb ? '<span class="chip" style="background:rgba(240,180,41,0.18);color:#f0b429">🎲 ' + cn(mb.amount) + ' sur ' + mb.side + ' (x2)</span>' : '<button class="btn sm primary" data-act="bet-dialog" data-id="' + id + '">🎲 Parier · x2</button>') + '<button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button></div>';
  }
  else if (st === 'dispute') f = '<small>Déclarations contradictoires</small>' + (tm || isAdmin() ? '<button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button>' : '');
  else if (st === 'done') {
    var wl = ws === 'A' ? m.teamA : m.teamB, dbl = m.stake * 2;
    var myDbl = tm === 'A' ? m.doubleA : tm === 'B' ? m.doubleB : false;
    var oppDbl = tm === 'A' ? m.doubleB : tm === 'B' ? m.doubleA : false;
    var dblBtn = '';
    if (tm) {
      if (m.doubleMatchId) dblBtn = '<button class="btn primary sm" data-act="open-match" data-id="' + esc(m.doubleMatchId) + '">🔥 Voir le Double</button>';
      else if (myDbl && !oppDbl) dblBtn = '<button class="btn sm ghost" disabled>⏳ Double (1/2) · En attente</button>';
      else if (!myDbl && oppDbl) dblBtn = '<button class="btn win sm" data-act="double" data-id="' + id + '"' + (avail(S.me) < dbl ? ' disabled title="Il te faut ' + cn(dbl) + ' disponible(s)"' : '') + '>🔥 Accepter Double (2/2) · ' + cn(dbl) + '</button>';
      else dblBtn = '<button class="btn primary sm" data-act="double" data-id="' + id + '"' + (avail(S.me) < dbl ? ' disabled title="Il te faut ' + cn(dbl) + ' disponible(s)"' : ' title="Les 2 doivent accepter pour lancer le Double"') + '>🔥 Double (0/2) · ' + cn(dbl) + '</button>';
    }
    var betResult = mb ? (mb.won ? '<span class="chip win" style="margin-left:6px">🎲 +' + cn(mb.amount * 2) + '</span>' : '<span class="chip" style="margin-left:6px;opacity:0.7">🎲 −' + cn(mb.amount) + '</span>') : '';
    f = '<small>' + esc(names(wl)) + (wl.length > 1 ? ' empochent ' : ' empoche ') + cn(m.stake) + (wl.length > 1 ? ' chacun' : '') + '</small>' + betResult + dblBtn;
  }
  else f = '<small>Défi annulé' + (mb ? ' · pari remboursé' : '') + '</small>';
  var a = PM(m, m.teamA[0]);
  return '<article class="poster" data-open="' + id + '" tabindex="0" role="button" aria-label="' + esc(m.mode + ' ' + m.format + ' : équipe de ' + a.pseudo + ', mise ' + cn(m.stake)) + '">' + top + face + pot + '<div class="p-foot">' + f + '</div></article>';
}

function betaBar(){ return '<div class="betabar"><b>LEGACY BÊTA</b> · Version de test : les coins n\'ont aucune valeur réelle et les données peuvent être remises à zéro.</div>'; }

function headerHTML(v){
  var p = me(), bal = avail(p.id), lk = locked(p.id);
  function link(h, label){ return '<a href="#' + h + '"' + (v === h || (h === 'arene' && v === 'match') ? ' aria-current="page"' : '') + (h === 'profil' ? ' data-act="myprofile"' : '') + '>' + label + '</a>'; }
  return betaBar() + '<header class="top"><div class="wrap bar">' +
    '<a class="logo" href="#arene" aria-label="Legacy, accueil">' + LOGO + '<span>Legacy</span><em class="beta">BÊTA</em></a>' +
    '<nav class="nav" aria-label="Navigation">' + link('arene', 'Arène') + link('roue', '🎡 Roue' + (spinReady() ? ' <i class="count">1</i>' : '')) + link('casino', '🎰 Casino') + link('tournois', 'Tournois') + link('classement', 'Classement') + link('amis', 'Amis' + (pendingIn() + dmUnreadTotal() ? ' <i class="count">' + (pendingIn() + dmUnreadTotal()) + '</i>' : '')) + link('boutique', 'Boutique') + link('profil', 'Mon profil') + link('regles', 'Règles') + link('signaler', 'Signaler') + '</nav>' +
    '<div class="bar-right">' +
    '<a class="bal" href="#profil" data-act="myprofile" title="Ton solde disponible">' + COIN + '<span>' + fmt(bal) + '</span>' + (lk ? '<small>' + fmt(lk) + ' en jeu</small>' : '') + '</a>' +
    ((p.vip || p.cc > 0) ? '<a class="bal cc" href="#casino" title="Tes V-Coins (se jouent au casino)">' + CC_ICON + '<span>' + fmt(p.cc || 0) + '</span></a>' : '') +
    dcBtn('Discord') +
    '<button class="btn sm bell" data-act="search" title="Rechercher un joueur" aria-label="Rechercher un joueur">🔍</button>' +
    '<button class="btn sm bell" data-act="notifs" title="Notifications" aria-label="Notifications">🔔' + (unread() ? '<i class="count">' + unread() + '</i>' : '') + '</button>' +
    '<button class="btn sm" data-act="tip-dialog">Pourboire</button>' +
    (isAdmin() ? '<button class="btn sm admin" data-act="admin-dialog">Admin</button>' : '') +
    '<button class="btn sm ghost" data-act="logout">Déconnexion</button>' +
    '</div></div></header>';
}
function footerHTML(){ return '<footer class="foot"><div class="wrap"><span><a href="' + DISCORD_URL + '" target="_blank" rel="noopener noreferrer">Serveur Discord Legacy</a> · Legacy bêta · les coins n\'ont aucune valeur réelle, pas d\'achat ni de retrait.</span><span><a href="confidentialite.html">Confidentialité</a> · Non affilié à Epic Games.</span></div></footer>'; }

var ORIONG_DISCORD = 'https://discord.gg/5D4Yp7ns4', ORIONG_TIKTOK = 'https://www.tiktok.com/@ppysildur';
function collabFloatHTML(){
  return '<aside class="cfl s-a" aria-label="Collaboration avec ORIONG Esport"><i class="cfl-handle" aria-hidden="true"></i>' +
    '<div class="cfl-face cfl-a"><span class="cfl-logo"><img src="img/oriong-logo.webp" alt="" width="40" height="40" decoding="async"><video autoplay muted loop playsinline preload="metadata" poster="img/oriong-logo.webp" src="img/oriong-logo.mp4" aria-hidden="true" tabindex="-1"></video></span>' +
    '<span class="cfl-t"><small>En collab avec</small><b>ORIONG <em>Esport</em></b></span><i class="cfl-new">Nouvelle team</i></div>' +
    '<div class="cfl-face cfl-b"><span class="cfl-t"><small>Rejoins</small><b><span class="cfl-w">ORIONG <em>Esport</em></span></b></span>' +
    '<a href="' + ORIONG_DISCORD + '" target="_blank" rel="noopener noreferrer" title="Discord ORIONG Esport" aria-label="Discord ORIONG Esport">' + DC_ICON + '<span>Discord</span></a>' +
    '<a href="' + ORIONG_TIKTOK + '" target="_blank" rel="noopener noreferrer" title="TikTok ORIONG Esport" aria-label="TikTok ORIONG Esport"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg><span>TikTok</span></a></div>' +
    '</aside>';
}
// L'onglet est créé UNE fois, hors de #app : il n'est jamais redessiné quand le site se rafraîchit, l'animation ne se coupe donc jamais.
function collabInit(){
  if (document.querySelector('.cfl')) return;
  document.body.insertAdjacentHTML('beforeend', collabFloatHTML());
  var el = document.querySelector('.cfl'), timer = null, hold = false, TIMES = {a: 5200, b: 6800, h: 16000}, narrow = window.matchMedia('(max-width:1250px)');
  function show(st){ el.classList.remove('s-a', 's-b'); if (st === 'b') el.classList.add('s-b'); else if (st === 'a') el.classList.add('s-a'); }
  function next(st){ if (!narrow.matches) return st === 'a' ? 'b' : 'a'; return st === 'h' ? 'a' : st === 'a' ? 'b' : 'h'; }
  function rest(){ return narrow.matches ? 'h' : 'a'; }
  function cycle(st){ clearTimeout(timer); show(st); if (hold) return; timer = setTimeout(function(){ cycle(next(st)); }, TIMES[st] || TIMES.a); }
  function grab(){ if (hold && el.classList.contains('s-b')) return; hold = true; clearTimeout(timer); show('b'); }
  function release(){ if (!hold) return; hold = false; clearTimeout(timer); timer = setTimeout(function(){ cycle(rest()); }, 3500); }
  el.addEventListener('mouseenter', grab); el.addEventListener('mouseleave', release);
  el.addEventListener('focusin', grab); el.addEventListener('focusout', function(){ setTimeout(function(){ if (!el.contains(document.activeElement)) release(); }, 0); });
  el.addEventListener('click', function(e){ if (e.target.closest('a')) return; if (hold && el.classList.contains('s-b') && !el.matches(':hover')) release(); else grab(); });
  document.addEventListener('click', function(e){ if (hold && !el.contains(e.target)) release(); });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && !hold) cycle(el.classList.contains('s-b') ? 'b' : el.classList.contains('s-a') ? 'a' : rest()); });
  if (narrow.matches) cycle('h'); else setTimeout(function(){ cycle('a'); }, 1200);
  if (narrow.matches) setTimeout(function(){ if (!hold) cycle('a'); }, 3000);
  setTimeout(ogCheckGift, 2500); setInterval(ogCheckGift, 3000); setTimeout(resetNoticeCheck, 2200); setInterval(resetNoticeCheck, 3000);
}
function arenaHTML(){
  var all = Object.keys(S.matches).map(function(k){ return S.matches[k]; });
  var open = all.filter(function(m){ return m.status === 'open'; }).sort(function(a, b){ return (b.pinnedUntil > Date.now()) - (a.pinnedUntil > Date.now()) || b.createdAt - a.createdAt; });
  var disputes = isAdmin() ? all.filter(function(m){ return m.status === 'dispute'; }) : [];
  var mineM = all.filter(function(m){ return teamOf(m, S.me) && active(m); });
  var doneM = all.filter(function(m){ return m.status === 'done'; }).sort(function(a, b){ return b.finishedAt - a.finishedAt; }).slice(0, 12);
  var list = tab === 'mes' ? mineM : tab === 'termines' ? doneM : open;
  var played = all.filter(function(m){ return m.status === 'done'; }).length;
  var html = '<section class="hero"><div><p class="eyebrow">Fortnite · défis à mise</p><h1>Mets tes coins en jeu.</h1><p class="lead">Du 1v1 au 3v3 : lance un défi, mise des coins, et empoche la mise des perdants. Tout le monde démarre avec ' + cn(START) + '.</p></div>' +
    '<div class="hero-act"><button class="btn primary" data-act="new-match">Lancer un défi</button>' + lfmHTML() + '</div></section>';
  html += podiumHTML(true);
  html += '<section class="strip" aria-label="Chiffres de Legacy"><div><b>' + Object.keys(S.players).filter(function(k){ return !S.players[k].owner; }).length + '</b><span>Joueurs</span></div><div><b>' + played + '</b><span>Matchs joués</span></div><div><b>' + fmt(coinsInPlay()) + '</b><span>Coins en jeu</span></div></section>';
  if (!me().fortnite) html += '<div class="notice fn-notice"><p><b>🎮 Ajoute ton pseudo Fortnite</b> pour que tes adversaires puissent t’ajouter en jeu facilement.</p><button class="btn sm primary" data-act="fn-setup">Ajouter</button></div>';
  if (avail(S.me) <= 0) html += '<div class="notice"><p><b>Plus aucun coin disponible.</b> Tu peux regarder les défis et en recevoir. Donne ton pseudo à un autre joueur pour qu\'il t\'envoie un pourboire.</p><button class="btn sm" data-act="copy-pseudo">Copier mon pseudo</button></div>';
  function t(id, label, n){ return '<button role="tab" aria-selected="' + (tab === id) + '" data-act="tab" data-tab="' + id + '">' + label + '<i>' + n + '</i></button>'; }
  html += '<div><div class="tabs" role="tablist">' + t('ouverts', 'Défis ouverts', open.length) + t('mes', 'Mes matchs', mineM.length) + t('termines', 'Terminés', doneM.length) + '</div></div>';
  if (!list.length) {
    var msg = tab === 'mes' ? ['Aucun match en cours', 'Lance un défi ou accepte-en un depuis l\'onglet Défis ouverts.'] : tab === 'termines' ? ['Rien de joué pour l\'instant', 'Les matchs terminés apparaîtront ici.'] : tab === 'litiges' ? ['Aucun litige', 'Tout le monde est d\'accord, pour l\'instant.'] : ['Aucun défi ouvert', 'Lance le premier défi de l\'arène.'];
    html += '<div class="empty"><b>' + msg[0] + '</b>' + msg[1] + (tab === 'ouverts' ? '<div style="margin-top:14px"><button class="btn primary sm" data-act="new-match">Lancer un défi</button></div>' : '') + '</div>';
  } else html += '<div class="grid">' + list.map(function(m){ return posterHTML(m, false); }).join('') + '</div>';
  return html;
}
function communityStreamsHTML(){
  var list = Object.keys(S.players).map(function(k){ return S.players[k]; }).filter(function(p){ return p.twitch && p.status !== 'banned'; });
  if (!list.length) return '';
  list.forEach(function(p){ checkLive(p.twitch); });
  list.sort(function(a, b){ return isLive(b.twitch) - isLive(a.twitch) || a.pseudo.localeCompare(b.pseudo); });
  var nLive = list.filter(function(p){ return isLive(p.twitch); }).length;
  return '<section class="cstreams"><div class="cs-head"><h2 class="sec">📺 Streams de la communauté</h2><span class="help">' + (nLive ? '<b class="live-tag">🔴 ' + nLive + ' en live</b>' : 'Personne en live pour le moment') + '</span></div>' +
    '<p class="help" style="margin-bottom:12px">Relie ta chaîne Twitch dans « Modifier le profil » pour apparaître ici. Clique sur une carte pour regarder en grand.</p>' +
    '<div class="cs-grid">' + list.map(function(p){
      var live = isLive(p.twitch);
      var host = location.hostname || 'nyro098.github.io';
      return '<div class="cs-card' + (live ? ' live' : '') + '">' +
        '<span class="cs-thumb">' + (live ? '<iframe src="https://player.twitch.tv/?channel=' + encodeURIComponent(p.twitch) + '&parent=' + encodeURIComponent(host) + '&muted=true&autoplay=true&controls=false" allow="autoplay" title="Stream de ' + esc(p.pseudo) + '" tabindex="-1"></iframe><b class="live-tag">🔴 LIVE</b>' : '<span class="cs-off">' + av(p, 'lg') + '<small>Hors ligne</small></span>') + '</span>' +
        '<span class="cs-meta"><b>' + nm(p) + '</b><small>twitch.tv/' + esc(p.twitch) + '</small></span>' +
        '<button class="cs-hit" data-act="watch" data-ch="' + esc(p.twitch) + '" data-pid="' + esc(p.id) + '" aria-label="Regarder ' + esc(p.pseudo) + ' en grand"></button></div>';
    }).join('') + '</div></section>';
}
function watchDialog(ch, pid){
  var p = P(pid), live = isLive(ch), host = location.hostname || 'nyro098.github.io';
  return '<div class="overlay lightbox watch"><button class="x" data-act="close" aria-label="Fermer">×</button><div class="watch-box">' +
    '<div class="stream-frame">' + (live
      ? '<iframe src="https://player.twitch.tv/?channel=' + encodeURIComponent(ch) + '&parent=' + encodeURIComponent(host) + '&autoplay=true&muted=false" allowfullscreen allow="autoplay; fullscreen" title="Stream de ' + esc(p.pseudo) + '"></iframe>'
      : '<div class="watch-off">' + av(p, 'xl') + '<b>' + esc(p.pseudo) + ' est hors ligne</b><small>Reviens plus tard, ou suis sa chaîne pour être prévenu du prochain live.</small></div>') + '</div>' +
    '<div class="watch-meta">' + av(p, 'sm') + '<b>' + nm(p) + badge(p) + '</b>' + (live ? '<span class="live-tag">🔴 LIVE</span>' : '') + '<a class="btn sm" href="https://www.twitch.tv/' + encodeURIComponent(ch) + '" target="_blank" rel="noopener noreferrer">Ouvrir sur Twitch ↗</a><button class="btn sm ghost" data-act="goto-player" data-pid="' + esc(pid) + '">Voir son profil</button></div></div></div>';
}

function teamCard(m, team){
  var ids = team === 'A' ? m.teamA : m.teamB, mt = teamOf(m, S.me);
  var title = mt ? (mt === team ? 'Ton équipe' : 'Équipe adverse') : 'Équipe ' + team, lis = '';
  for (var i = 0; i < m.size; i++) {
    var q = ids[i];
    lis += q ? (masked(m, q) ? '<li><span class="anon-row">' + anonAv() + '<span class="nm">Joueur anonyme <small>· révélé au début du match</small></span></span>' : '<li><button data-act="goto-player" data-pid="' + esc(q) + '">' + av(P(q)) + '<span class="nm">' + nm(P(q)) + (q === S.me ? ' (toi)' : '') + (P(q).fortnite ? '<small class="fn-tag">🎮 ' + esc(P(q).fortnite) + (P(q).epic ? ' ✅' : '') + '</small>' : '') + '</span></button>' + (P(q).fortnite && q !== S.me ? '<button class="btn sm ghost fn-copy" data-act="copy-fn" data-pid="' + esc(q) + '" title="Copier son pseudo Fortnite pour l’ajouter en jeu">Copier</button>' : '')) + (i === 0 ? '<i>Capitaine</i>' : '') + '</li>'
             : '<li class="free"><span class="av empty-av">+</span>Place libre</li>';
  }
  return '<div class="tcard' + (mt === team ? ' mine' : '') + '"><h3>' + title + '<small>ÉQUIPE ' + team + '</small></h3><ul>' + lis + '</ul></div>';
}

function matchBets(mid){ return (S.bets && S.bets[mid]) || []; }
function myBet(mid){
  if (!S.me) return null;
  var list = matchBets(mid).filter(function(b){ return b.player === S.me; });
  return list.length ? list[0] : null;
}
function betTotals(mid){
  var list = matchBets(mid), totA = 0, totB = 0;
  list.forEach(function(b){
    if (b.side === 'A') totA += b.amount;
    else if (b.side === 'B') totB += b.amount;
  });
  return {totA: totA, totB: totB, total: totA + totB, count: list.length};
}

function betsBoxHTML(m){
  var st = stateOf(m), id = esc(m.id), mt = teamOf(m, S.me);
  var bList = matchBets(m.id), bt = betTotals(m.id), mb = myBet(m.id);
  var pA = PM(m, m.teamA[0]), pB = m.teamB.length ? PM(m, m.teamB[0]) : null;
  var nameA = m.size > 1 ? 'Équipe A' : esc(pA.pseudo);
  var nameB = m.size > 1 ? 'Équipe B' : (pB ? esc(pB.pseudo) : 'Équipe B');
  var pctA = bt.total > 0 ? Math.round((bt.totA / bt.total) * 100) : 50;
  var pctB = bt.total > 0 ? 100 - pctA : 50;

  var html = '<section class="panel bet-panel"><div class="bet-head"><div><p class="eyebrow">🎲 Paris en direct · Multiplicateur x2 fixe</p>' +
    '<h2>Paris sur ce match</h2></div>' +
    '<div class="bet-pot-pill"><b>' + cn(bt.total) + '</b><span>paris placés (x2)</span></div></div>' +
    '<p class="help">N\'importe qui peut parier sur le gagnant de ce match. Si ton équipe l\'emporte, <b>tu empoches le double de ta mise (x2 fixe)</b> !</p>';

  html += '<div class="bet-meter-wrap" style="margin:16px 0">' +
    '<div class="bet-meter-labels" style="display:flex;justify-content:space-between;font-weight:600;margin-bottom:6px;font-size:13.5px">' +
      '<span style="color:#00a3d9">🔵 ' + nameA + ' : ' + cn(bt.totA) + ' (' + pctA + '%)</span>' +
      '<span style="color:#ff7a7a">🔴 ' + nameB + ' : ' + cn(bt.totB) + ' (' + pctB + '%)</span>' +
    '</div>' +
    '<div class="bet-bar" style="display:flex;height:12px;border-radius:6px;overflow:hidden;background:#10161a;border:1px solid #26323a">' +
      '<div style="width:' + pctA + '%;background:#00a3d9;transition:width .3s"></div>' +
      '<div style="width:' + pctB + '%;background:#ff7a7a;transition:width .3s"></div>' +
    '</div></div>';

  if (mt) {
    html += '<div class="notice" style="margin:12px 0"><p>🔒 <b>Tu participes à ce match.</b> Pour garantir une compétition 100 % équitable, les joueurs d\'un match ne peuvent pas parier dessus.</p></div>';
  } else if (mb) {
    var winGain = mb.amount * 2;
    if (st === 'done') {
      var didWin = mb.won === true || (m.winner && mb.side === m.winner);
      html += '<div class="banner ' + (didWin ? 'pos' : 'neg') + '" style="margin:14px 0">' +
        (didWin ? '🎉 <b>Pari gagné !</b> +' + cn(winGain) + ' empochés (gain x2)' : '❌ <b>Pari perdu</b> : ton équipe ' + mb.side + ' n\'a pas gagné ce match.') +
        '<small>Mise : ' + cn(mb.amount) + ' sur ' + (mb.side === 'A' ? nameA : nameB) + '.</small></div>';
    } else {
      html += '<div class="banner pos" style="margin:14px 0">' +
        '✅ <b>Ton pari est actif !</b> Tu as misé <b>' + cn(mb.amount) + '</b> sur <b>' + (mb.side === 'A' ? nameA : nameB) + '</b>.' +
        '<small>Gain en cas de victoire : <b class="w" style="color:#ffc93c">+' + cn(winGain) + ' (x2)</b>. Règlement automatique dès la fin du match.</small></div>';
      if (st === 'open' || st === 'live') {
        html += '<div class="actions" style="margin-top:10px">' +
          '<button class="btn sm primary" data-act="bet-dialog" data-id="' + id + '" data-side="' + mb.side + '">+ Augmenter mon pari</button>' +
        '</div>';
      }
    }
  } else if (st === 'open' || st === 'live') {
    var canBet = avail(S.me) >= 0.5;
    html += '<div class="bet-cta-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">' +
      '<button class="btn primary lg" data-act="bet-dialog" data-id="' + id + '" data-side="A"' + (canBet ? '' : ' disabled') + '>🎲 Parier sur ' + nameA + '<br><small style="font-weight:normal;opacity:0.85">Gains : x2 fixe</small></button>' +
      '<button class="btn primary lg" data-act="bet-dialog" data-id="' + id + '" data-side="B"' + (canBet ? '' : ' disabled') + '>🎲 Parier sur ' + nameB + '<br><small style="font-weight:normal;opacity:0.85">Gains : x2 fixe</small></button>' +
    '</div>' + (!canBet ? '<p class="help" style="margin-top:8px">Il te faut au moins 0,5 coin disponible pour parier.</p>' : '');
  } else if (st === 'done') {
    html += '<p class="help">Ce match est terminé. Tous les paris ont été réglés automatiquement (gain x2).</p>';
  } else {
    html += '<p class="help">Ce défi a été annulé. Tous les paris ont été remboursés.</p>';
  }

  if (bList.length) {
    html += '<div class="bet-list-wrap" style="margin-top:18px"><h3 style="font-size:14px;color:var(--fg-2);margin-bottom:8px">Paris enregistrés (' + bList.length + ')</h3><ul class="fr-list">' +
      bList.slice(0, 8).map(function(b){
        var bp = P(b.player);
        var sName = b.side === 'A' ? nameA : nameB;
        var stTxt = b.settled ? (b.won ? '<b style="color:var(--win)">Gagné (+ ' + cn(b.amount * 2) + ')</b>' : '<span style="color:var(--loss)">Perdu</span>') : '<small>En cours (gain : ' + cn(b.amount * 2) + ')</small>';
        return '<li style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.06)">' +
          '<div style="display:flex;align-items:center;gap:10px">' + av(bp, 'sm') + '<div><b>' + nm(bp) + '</b><small style="display:block;color:var(--fg-2)">' + cn(b.amount) + ' sur ' + esc(sName) + '</small></div></div>' +
          '<div>' + stTxt + '</div></li>';
      }).join('') + '</ul></div>';
  }

  return html + '</section>';
}

function matchPageHTML(){
  var m = S.matches[S.lastMatch], st = stateOf(m), mt = teamOf(m, S.me), ws = winnerSide(m), id = esc(m.id);
  var ca = capA(m), cb = capB(m), isCap = S.me === ca || S.me === cb;
  var html = '<button class="btn sm ghost back" data-act="back">← Retour à l\'arène</button>';
  html += '<section class="mhead"><div><p class="eyebrow">Match · lancé ' + ago(m.createdAt) + '</p><h1>' + esc(m.mode) + ' ' + esc(m.format) + '</h1></div><button class="btn sm" data-act="share" data-id="' + id + '">Copier le lien du match</button></section>';
  html += posterHTML(m, true);
  html += '<section><h2 class="sec" style="margin-bottom:14px">' + (mt ? 'Contre qui tu joues' : 'Les équipes') + '</h2><div class="teams">' + teamCard(m, 'A') + teamCard(m, 'B') + '</div></section>';
  html += betsBoxHTML(m);
  var r = '<section class="panel"><h2>Résultat</h2>';
  if (st === 'open') {
    var needs = m.size * 2 - m.teamA.length - m.teamB.length;
    r += '<p>En attente de joueurs : ' + (m.size * 2 - needs) + ' sur ' + (m.size * 2) + ' places remplies. Le match démarre quand les deux équipes sont complètes.</p>';
    if (m.teamATeam) { var ta = S.teams && S.teams[m.teamATeam]; r += '<p class="help">Les places de l\'équipe A sont réservées à l\'équipe <b>' + esc(ta ? ta.name : 'du créateur') + '</b>.</p>'; }
    if (mt) r += '<div class="actions"><button class="btn" data-act="pick" data-purpose="match" data-id="' + id + '">+ Inviter un joueur</button></div>';
    if (!mt) {
      var blocked = m.target && m.target !== S.me, short = avail(S.me) < m.stake;
      r += '<div class="actions">';
      if (m.size === 1) r += '<button class="btn primary lg" data-act="join" data-id="' + id + '"' + (blocked || short ? ' disabled' : '') + '>Accepter · ' + cn(m.stake) + '</button>';
      else {
        if (m.teamA.length < m.size && canJoinA(m)) r += '<button class="btn primary lg" data-act="join" data-id="' + id + '" data-team="A"' + (short ? ' disabled' : '') + '>Rejoindre l\'équipe A</button>';
        if (m.teamB.length < m.size) r += '<button class="btn primary lg" data-act="join" data-id="' + id + '" data-team="B"' + (short ? ' disabled' : '') + '>Rejoindre l\'équipe B</button>';
      }
      if (m.target === S.me) r += '<button class="btn danger" data-act="cancel" data-id="' + id + '">Refuser</button>';
      r += '</div>' + (blocked ? '<p class="help">Ce défi est réservé à ' + esc(P(m.target).pseudo) + '.</p>' : short ? '<p class="help">Il te faut ' + cn(m.stake) + ' disponible(s). Tu en as ' + cn(Math.max(avail(S.me), 0)) + '.</p>' : '<p class="help">' + cn(m.stake) + ' sortent de ton solde et vont dans le pot. Si tu gagnes, tu récupères ta mise + celle d\'en face. Si tu perds, ils sont perdus.</p>');
    } else if (m.creator === S.me) r += '<div class="actions">' + (m.pinnedUntil > Date.now() ? '<span class="pin-tag">📌 Épinglé jusqu\'à ' + untilTxt(m.pinnedUntil) + '</span>' : '<button class="btn" data-act="pin" data-id="' + id + '">📌 Épingler 1 h · ' + cn(3) + '</button>') + (m.teamA.length === 1 && m.teamB.length === 0 ? '<button class="btn danger" data-act="cancel" data-id="' + id + '">Annuler le défi</button></div><p class="help">Tu peux annuler tant que personne n\'a rejoint ton défi. Ta mise t\'est alors rendue.</p>' : '</div><p class="help">🔒 Un joueur a rejoint ton défi : il ne peut plus être annulé.</p>');
    else r += '<div class="actions"><button class="btn danger" data-act="leave" data-id="' + id + '">Quitter le match</button></div><p class="help">Ta mise t\'est rendue si tu quittes avant le début du match.</p>';
  } else if (st === 'live' || st === 'dispute') {
    if (st === 'dispute' && (mt || isAdmin())) r += ticketBoxHTML(m);
    if (mt) {
      var mine = myDecl(m), myCap = mt === 'A' ? ca : cb, oppCap = mt === 'A' ? cb : ca;
      var myD = mt === 'A' ? m.declA : m.declB, od = mt === 'A' ? m.declB : m.declA;
      var myS = declScore(m, mt), oppS = declScore(m, mt === 'A' ? 'B' : 'A');
      if (isCap) {
        r += '<p>' + (st === 'dispute' ? 'Les déclarations ne concordent pas. Vérifie le score : corrige-le si tu t\'es trompé, sinon ajoute ta capture du score : c\'est elle qui fera gagner le litige.' : 'Une fois le match joué, entre le score final et ajoute la capture d\'écran du résultat. Les coins bougent quand les deux capitaines sont d\'accord.') + '</p>' +
          '<form data-form="result" data-id="' + id + '" class="result-form" novalidate>' +
          '<div class="score-entry"><label><span>' + (m.size > 1 ? 'Ton équipe' : 'Toi') + '</span><input name="my" type="number" inputmode="numeric" min="0" max="99" step="1" required value="' + (myS ? myS[0] : '') + '" placeholder="0"></label><b>–</b><label><span>' + (m.size > 1 ? 'Adversaires' : esc(P(oppCap).pseudo)) + '</span><input name="opp" type="number" inputmode="numeric" min="0" max="99" step="1" required value="' + (myS ? myS[1] : '') + '" placeholder="0"></label></div>' +
          '<label class="shot-pick"><input type="file" name="shot" accept="image/*"><span class="shot-ico">📷</span><span class="shot-txt">Ajouter la capture du résultat <small>(conseillé, obligatoire en cas de litige)</small></span></label>' +
          '<p class="err" role="alert"></p><div class="actions"><button class="btn primary lg" type="submit">' + (mine ? 'Modifier mon résultat' : 'Envoyer le résultat') + '</button>' + (!mine && !(mt === 'A' ? m.declB : m.declA) ? '<button class="btn ghost" type="button" data-act="afk-claim" data-id="' + id + '">Mon adversaire ne joue pas (AFK)</button>' : '') + '</div></form>';
      } else r += '<p>Le capitaine de ton équipe, <b>' + esc(P(myCap).pseudo) + '</b>, déclare le score pour toute l\'équipe. Tu peux quand même ajouter des captures plus bas.</p>';
      function dl(x, s){ return x ? (x === 'won' ? 'victoire' : 'défaite') + (s ? ' <b class="mono">' + s[0] + '–' + s[1] + '</b>' : '') : 'n\'a pas encore déclaré'; }
      r += timerHTML(m, mt, myD, od);
      r += '<div class="decl"><div><span>' + esc(P(myCap).pseudo) + ' (ton capitaine)</span><span>' + dl(myD, myS) + '</span></div><div><span>' + esc(P(oppCap).pseudo) + ' (capitaine adverse)</span><span>' + dl(od, oppS) + '</span></div></div>';
    } else r += '<p>Ce match est en cours. Les capitaines déclareront le résultat.</p>' + timerHTML(m, null, null, null);
  } else if (st === 'done') {
    var wl = ws === 'A' ? m.teamA : m.teamB;
    var wcap = S.players[wl[0]]; if (wcap && wcap.eq && wcap.eq.win) r += winFxHTML(wcap.eq.win.split(':')[1], m.id);
    if (mt) r += '<div class="banner ' + (mt === ws ? 'pos' : 'neg') + '">' + (mt === ws ? 'Victoire · +' + cn(m.stake * 2) + ' récupérés' : 'Défaite · −' + cn(m.stake)) + '<small>' + (mt === ws ? 'Ta mise te revient, plus celle de ' + esc(names(mt === 'A' ? m.teamB : m.teamA)) + '.' : esc(names(wl)) + (wl.length > 1 ? ' empochent ' : ' empoche ') + 'ta mise.') + (m.adminWinner ? ' Résultat tranché par un admin.' : '') + (m.autoValidated ? ' Validé automatiquement : pas de contestation en 10 minutes.' : '') + '</small></div>';
    else r += '<div class="banner">Équipe ' + ws + ' gagnante<small>' + esc(names(wl)) + (wl.length > 1 ? ' empochent ' : ' empoche ') + cn(m.stake) + (wl.length > 1 ? ' chacun' : '') + '.</small></div>';
    r += m.scoreA != null
      ? '<div class="final-score"><span>' + esc(m.size > 1 ? 'Équipe A' : P(ca).pseudo) + '</span><b class="' + (ws === 'A' ? 'w' : '') + '">' + m.scoreA + '</b><i>–</i><b class="' + (ws === 'B' ? 'w' : '') + '">' + m.scoreB + '</b><span>' + esc(m.size > 1 ? 'Équipe B' : P(cb).pseudo) + '</span><em class="fr-tag ' + (m.scoreOk ? 'ok' : '') + '">' + (m.scoreOk ? '✓ Score confirmé' : 'Score non confirmé') + '</em></div>'
      : '<p class="help">Aucun score n\'a été déclaré pour ce match.</p>';
    if (mt) {
      var dblStake = m.stake * 2, shortDbl = avail(S.me) < dblStake, oppCapId = mt === 'A' ? cb : ca;
      var myAgreed = mt === 'A' ? m.doubleA : m.doubleB;
      var oppAgreed = mt === 'A' ? m.doubleB : m.doubleA;
      var oppName = oppCapId ? esc(P(oppCapId).pseudo) : 'l\'adversaire';
      if (m.doubleMatchId) {
        r += '<div class="actions" style="margin-top:16px"><button class="btn primary lg" data-act="open-match" data-id="' + esc(m.doubleMatchId) + '">🔥 Ouvrir le match Double (' + cn(dblStake) + ')</button></div>' +
          '<p class="help">Les deux joueurs ont accepté le Double ! Le match revanche à <b>' + cn(dblStake) + '</b> est en cours.</p>';
      } else if (myAgreed && !oppAgreed) {
        r += '<div class="actions" style="margin-top:16px"><button class="btn lg ghost" disabled>⏳ Double demandé (1/2) · En attente de ' + oppName + '…</button></div>' +
          '<p class="help">Tu es d\'accord pour le Double à <b>' + cn(dblStake) + '</b>. Dès que <b>' + oppName + '</b> clique aussi sur Double, le match démarre automatiquement !</p>';
      } else if (!myAgreed && oppAgreed) {
        r += '<div class="actions" style="margin-top:16px"><button class="btn win lg" data-act="double" data-id="' + id + '"' + (shortDbl ? ' disabled' : '') + '>🔥 Accepter le Double (2/2) · Miser ' + cn(dblStake) + '</button></div>' +
          '<p class="help">' + (shortDbl ? '<b>' + oppName + '</b> veut faire un Double à ' + cn(dblStake) + ', mais il te manque des coins (tu en as ' + cn(Math.max(avail(S.me), 0)) + ').' : '🔥 <b>' + oppName + '</b> est chaud pour un Double ! Clique pour accepter : vous misez chacun <b>' + cn(dblStake) + '</b> et le match se lance direct.') + '</p>';
      } else {
        r += '<div class="actions" style="margin-top:16px"><button class="btn primary lg" data-act="double" data-id="' + id + '"' + (shortDbl ? ' disabled' : '') + '>🔥 Double (0/2) · Revanche à ' + cn(dblStake) + '</button></div>' +
          '<p class="help">' + (shortDbl ? 'Il te faut ' + cn(dblStake) + ' disponible(s) pour proposer un Double (tu en as ' + cn(Math.max(avail(S.me), 0)) + ').' : 'Propose une revanche avec <b>le double de la mise (' + cn(dblStake) + ')</b>. Les deux joueurs doivent cliquer sur Double pour que le match se lance.') + '</p>';
      }
    }
    if (isAdmin()) r += '<form data-form="admin-score" data-id="' + id + '" class="adminbox admin-score" novalidate><p class="help"><b>Admin</b> : corriger le score final.</p><div class="score-entry"><label><span>Équipe A</span><input name="a" type="number" min="0" max="99" value="' + (m.scoreA != null ? m.scoreA : '') + '"></label><b>–</b><label><span>Équipe B</span><input name="b" type="number" min="0" max="99" value="' + (m.scoreB != null ? m.scoreB : '') + '"></label><button class="btn sm" type="submit">Enregistrer</button></div><p class="err" role="alert"></p></form>';
  } else r += '<p>Ce défi a été annulé. Les mises ont été rendues.</p>';
  if (isAdmin() && active(m)) {
    r += '<div class="adminbox"><p class="help" style="margin-bottom:10px"><b>Admin</b> : trancher ou annuler ce match.' + (st === 'dispute' ? ' A dit « ' + (m.declA === 'won' ? 'gagné' : 'perdu') + ' », B dit « ' + (m.declB === 'won' ? 'gagné' : 'perdu') + ' ».' : '') + '</p><div class="actions">' +
      (st !== 'open' ? '<button class="btn sm" data-act="admin-win" data-id="' + id + '" data-side="A">Victoire équipe A</button><button class="btn sm" data-act="admin-win" data-id="' + id + '" data-side="B">Victoire équipe B</button>' : '') +
      '<button class="btn sm danger" data-act="admin-cancel" data-id="' + id + '">Annuler et rembourser</button></div></div>';
  }
  html += r + '</section>';
  if (st !== 'cancelled' && st !== 'done') html += streamsSectionHTML(m);
  if (st !== 'open' && st !== 'cancelled') html += proofsSectionHTML(m, !!mt || isAdmin());
  if (mt || isAdmin()) {
    if (!chatCache[m.id]) loadChat(m.id);
    html += '<section class="panel chat"><h2>Chat du match</h2><p class="help">Visible seulement par les joueurs du match' + (isAdmin() && !mt ? ' (et toi, en admin)' : '') + '. Donne ton pseudo Fortnite, le code de l\'île…</p>' +
      '<div id="chat-list" class="chat-list">' + chatListHTML(m.id) + '</div>' +
      '<form data-form="chat" data-id="' + id + '" class="chat-form" novalidate><input name="body" maxlength="300" autocomplete="off" placeholder="Écris un message… (ex. ajoute-moi : MonPseudo)" aria-label="Message"><button class="btn primary" type="submit">Envoyer</button></form></section>';
  }
  html += '<section><h2 class="sec" style="margin-bottom:14px">Détails</h2><dl class="facts"><dt>Lancé par</dt><dd>' + esc(P(m.creator).pseudo) + '</dd>' +
    '<dt>Format</dt><dd>' + esc(m.mode) + ' · ' + esc(m.format) + ' · ' + boLabel(m) + '</dd>' +
    '<dt>Kill lead</dt><dd>' + (m.killLead != null ? m.killLead : 1) + '</dd>' +
    (m.pingpong ? '<dt>Ping-pong</dt><dd>Oui : il faut gagner avec 2 points d\'écart (ex. 7-5, pas 7-6).</dd>' : '') +
    (m.noBreak ? '<dt>Casser</dt><dd>🚫 Interdit : on n\'a pas le droit de casser les constructions de l\'adversaire.</dd>' : '') +
    '<dt>Mise</dt><dd>' + cn(m.stake) + ' par joueur</dd><dt>Pot total</dt><dd>' + cn(m.stake * m.size * 2) + '</dd>' +
    (m.target ? '<dt>Réservé à</dt><dd>' + esc(P(m.target).pseudo) + '</dd>' : '') +
    (m.rules ? '<dt>Règles</dt><dd>' + esc(m.rules) + '</dd>' : '') + '</dl></section>';
  return html;
}

function boardHTML(){
  var rows = Object.keys(S.players).filter(function(k){ return S.players[k].status !== 'banned' && !S.players[k].owner; }).map(function(k){ return {p: S.players[k], bal: balance(k), s: stats(k)}; });
  rows.sort(function(a, b){ return b.bal - a.bal || b.s.w - a.s.w || a.p.pseudo.localeCompare(b.p.pseudo); });
  var html = seasonBannerHTML() + podiumHTML(false) + '<section><p class="eyebrow">Classement</p><h2 class="sec" style="margin-top:8px">Les plus riches de l\'arène</h2></section>';
  html += '<div class="tablewrap"><table><thead><tr><th scope="col">#</th><th scope="col">Joueur</th><th scope="col">Rang</th><th scope="col">Matchs</th><th scope="col">V–D</th><th scope="col">Victoires</th><th scope="col">Coins</th></tr></thead><tbody>';
  rows.forEach(function(r, i){
    html += '<tr class="' + (i === 0 ? 'top1' : '') + '"><td class="rank">' + (i + 1) + '</td><td><button class="who-cell" data-act="goto-player" data-pid="' + esc(r.p.id) + '">' + av(r.p) + '<span class="n">' + nm(r.p) + (r.p.id === S.me ? ' (toi)' : '') + badge(r.p) + (r.p.title ? '<br>' + titleHTML(r.p) : '') + '</span></button></td>' +
      '<td>' + rankBadge(r.p.id, false) + '</td><td>' + (r.s.w + r.s.l) + '</td><td>' + r.s.w + '–' + r.s.l + '</td><td>' + (r.s.ratio == null ? '–' : r.s.ratio + '%') + '</td><td class="bal-c">' + fmt(r.bal) + '</td></tr>';
  });
  return html + '</tbody></table></div>';
}

var TX_LABEL = {wheel: 'Roue quotidienne', shop: 'Achat boutique', bonus: 'Bonus d\'inscription', stake: 'Mise placée dans un match', refund: 'Mise rendue', win: 'Victoire : mise récupérée + gain', bet: 'Pari sur match (gain x2 potentiel)', bet_win: 'Pari gagné (gain x2)', tip_in: 'Pourboire reçu de ', tip_out: 'Pourboire envoyé à ', gift_out: 'Cadeau offert à ', gift_in: 'Cadeau reçu de ', casino_bet: 'Roulette : mise', casino_win: 'Roulette : gain', casino_exchange: 'Échange de V-Coins', admin: 'Ajustement admin'};
function profileHTML(){
  var pid = S.players[viewPid] ? viewPid : S.me, p = P(pid), own = pid === S.me, s = stats(pid), bal = avail(pid), lk = locked(pid);
  var html = '';
  if (own && editing) {
    html += '<section class="card" style="max-width:560px"><h2 class="sec">Modifier mon profil</h2><form data-form="edit" novalidate>' +
      '<label for="e-pseudo">Pseudo</label><input id="e-pseudo" name="pseudo" required maxlength="24" autocomplete="off" value="' + esc(p.pseudo) + '">' +
      '<label>Discord (identifiant de connexion)</label><input value="' + esc(p.discord) + '" disabled>' +
      '<label for="e-twitch">Ta chaîne Twitch (facultatif)</label><input id="e-twitch" name="twitch" maxlength="60" autocomplete="off" value="' + esc(p.twitch) + '" placeholder="Ton pseudo Twitch ou le lien de ta chaîne"><p class="hint">Si tu es en live pendant un match, ton stream s’affichera automatiquement sur la page du match.</p>' +
      '<label for="e-fortnite">Ton pseudo Fortnite</label><input id="e-fortnite" name="fortnite" maxlength="32" autocomplete="off" value="' + esc(p.fortnite) + '" placeholder="Ton nom dans Fortnite"' + (p.epic ? ' disabled' : '') + '><p class="hint">' + (p.epic ? '✅ Synchronisé avec ton compte Epic Games : il se met à jour tout seul.' : 'Tes adversaires s’en servent pour t’ajouter en jeu. Pense à le changer ici si tu changes de pseudo dans Fortnite.') + '</p>' +
      '<label for="e-twitter">X / Twitter (facultatif)</label><input id="e-twitter" name="twitter" maxlength="33" autocomplete="off" value="' + esc(p.twitter) + '" placeholder="@pseudo">' +
      '<label for="e-bio">Bio (facultatif)</label><textarea id="e-bio" name="bio" maxlength="140" placeholder="Ton style de jeu, tes règles préférées…">' + esc(p.bio) + '</textarea>' +
      '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" data-act="edit-off">Annuler</button></div></form></section>';
  } else {
    html += '<section class="phead' + (p.eq && p.eq.banner ? ' bn bn-' + p.eq.banner.split(':')[1] + (SCENES.indexOf(p.eq.banner.split(':')[1]) >= 0 ? ' scene' : '') : '') + '">' + (p.eq && p.eq.banner ? sigHTML(p.eq.banner.split(':')[1], p.pseudo) : '') + av(p, 'xl') + '<div style="min-width:0"><p class="eyebrow">' + (own ? 'Ton profil' : 'Profil joueur') + (p.owner ? ' · fondateur' : p.admin ? ' · admin' : '') + ' · Saison 1</p><h1>' + nm(p) + ' ' + rankBadge(pid, true) + '</h1>' + (p.esport ? '<p class="ptitle big esport">⭐ ' + ESPORT_TITLE + '</p>' : '') + (p.title ? '<p class="ptitle big' + titleTier(p.titleKey) + '">' + esc(p.title) + '</p>' : '') + '<div class="links">' +
      (p.fortnite ? '<span class="fn-link">🎮 Fortnite : <b>' + esc(p.fortnite) + '</b>' + (p.epic ? ' <i class="fn-ok" title="Vérifié avec Epic Games">✅</i>' : '') + ' <button class="btn sm ghost" data-act="copy-fn" data-pid="' + esc(pid) + '" title="Copier le pseudo Fortnite">Copier</button></span>' : (own ? '<span><button class="btn sm" data-act="edit-on">🎮 Ajouter mon pseudo Fortnite</button></span>' : '')) +
      (own && EPIC_ID && (p.epic || EPIC_PUBLIC || isOwner()) ? (p.epic ? '<span class="fn-link">✅ Compte Epic lié <button class="btn sm ghost" data-act="epic-unlink">Délier</button></span>' : '<span><button class="btn sm epic-btn" data-act="epic-link">Lier mon compte Epic Games</button></span>') : '') +
      (p.discord ? '<span>Discord : ' + esc(p.discord) + '</span>' : '') +
      (p.twitch ? '<a href="https://www.twitch.tv/' + encodeURIComponent(p.twitch) + '" target="_blank" rel="noopener noreferrer">Twitch : ' + esc(p.twitch) + (isLive(p.twitch) ? ' <b class="live-dot">🔴 LIVE</b>' : '') + '</a>' : '') + (p.twitter ? '<a href="https://x.com/' + encodeURIComponent(p.twitter) + '" target="_blank" rel="noopener noreferrer">X : @' + esc(p.twitter) + '</a>' : '') +
      '<span>Inscrit ' + ago(p.createdAt) + '</span></div>' + (p.bio ? '<p style="margin-top:10px;max-width:56ch;color:var(--fg-2)">' + esc(p.bio) + '</p>' : '') + '</div>' +
      '<div class="actions">' + (own && isOwner() ? '<button class="btn danger" data-act="admin-dialog" data-mode="remove" data-pid="' + esc(pid) + '">Me retirer des coins</button>' : '') + (own ? '<button class="btn anon-toggle' + (p.anon ? ' on' : '') + '" data-act="toggle-anon" title="Ton pseudo est caché quand tu rejoins un défi, jusqu’au début du match">🕶️ Mode anonyme : ' + (p.anon ? 'activé' : 'désactivé') + '</button>' : '') + (own ? '<button class="btn ghost" data-act="reset-stats"' + (avail(S.me) < 5 ? ' disabled title="Il te faut 5 coins"' : '') + '>🔄 Remettre mes stats à zéro · ' + cn(5) + '</button>' : '') + (own ? '<label class="btn primary" style="margin:0;cursor:pointer;color:#fff;letter-spacing:.08em">' + (p.avatar ? 'Changer la photo' : 'Ajouter une photo') + '<input type="file" id="avatar-file" accept="image/*" hidden></label>' + (p.avatar ? '<button class="btn ghost" data-act="avatar-remove">Retirer la photo</button>' : '') + '<button class="btn" data-act="edit-on">Modifier le profil</button>' : friendBtn(pid) + '<button class="btn" data-act="tip-dialog" data-pid="' + esc(pid) + '">Donner des coins</button>' + (isAdmin() && (isOwner() || !p.owner) ? '<button class="btn admin" data-act="admin-dialog" data-pid="' + esc(pid) + '">Admin : donner des coins</button>' : '') + (isOwner() && pid !== S.me ? '<button class="btn danger" data-act="admin-dialog" data-mode="remove" data-pid="' + esc(pid) + '">Retirer des coins</button>' : '')) + '</div></section>';
  }
  html += '<section class="pstats" aria-label="Statistiques"><div><b style="color:var(--gold)">' + fmt(bal) + '</b><span>Solde dispo</span></div><div><b>' + fmt(lk) + '</b><span>En jeu</span></div><div><b style="color:#b79cff">' + fmt(p.cc || 0) + '</b><span>V-Coins</span></div><div><b>' + s.w + '</b><span>Victoires</span></div><div><b' + (s.l >= 100 ? ' class="neg"' : '') + '>' + s.l + '</b><span>Défaites</span></div><div><b' + (s.ratio != null && s.ratio < 0 ? ' class="neg"' : '') + '>' + (s.ratio == null ? '–' : s.ratio + '%') + '</b><span>Taux de victoire</span></div><div><b class="' + (s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : '') + '">' + (s.net > 0 ? '+' : '') + fmt(s.net) + '</b><span>Bilan net</span></div><div><b' + (s.streak < 0 ? ' class="neg"' : '') + '>' + s.streak + '</b><span>Série en cours</span></div></section>';
  html += rankCardHTML(pid);
  var cur = Object.keys(S.matches).map(function(k){ return S.matches[k]; }).filter(function(m){ return teamOf(m, pid) && active(m); });
  if (cur.length) html += '<section><h2 class="sec" style="margin-bottom:14px">Matchs en cours</h2><div class="grid">' + cur.map(function(m){ return posterHTML(m, false); }).join('') + '</div></section>';
  if (own && !editing) html += teamsSectionHTML();
  if (own && canTourney()) html += tourRestrictPanelHTML();
  if (isAdmin() && !own && !p.owner && (isOwner() || !p.admin)) {
    html += '<section class="panel sanction"><h2>Modération</h2><p>Statut actuel : <b>' + (p.status === 'banned' ? 'Banni' : p.status === 'restricted' ? 'Restreint jusqu\'à ' + untilTxt(p.restrictedUntil) : 'Normal') + '</b>' + (p.statusReason ? ' · raison : « ' + esc(p.statusReason) + ' »' : '') + '</p><div class="actions">' +
      (p.status !== 'restricted' ? '<button class="btn" data-act="sanction" data-mode="restricted" data-pid="' + esc(pid) + '">Restreindre</button>' : '') +
      (p.status !== 'banned' ? '<button class="btn danger" data-act="sanction" data-mode="banned" data-pid="' + esc(pid) + '">Bannir</button>' : '') +
      (p.status !== 'ok' ? '<button class="btn win" data-act="sanction" data-mode="ok" data-pid="' + esc(pid) + '">Lever la sanction</button>' : '') +
      (p.title ? '<button class="btn ghost" data-act="clear-title" data-pid="' + esc(pid) + '">Effacer son titre</button>' : '') +
      '</div><p class="help">Restreint : peut regarder le site mais ne peut plus jouer, écrire dans les chats ni envoyer de coins. Banni : ne voit plus qu\'un écran « compte banni ».</p></section>';
  }
  if (isOwner()) html += ownerPanelHTML(pid);
  if (!own && !isOwner()) return html;
  html += '<section><h2 class="sec" style="margin-bottom:14px">Historique des coins</h2>' + (own ? '<p class="help" style="margin:-6px 0 12px">Privé : toi seul vois ton historique.</p>' : '');
  var tx = txCache[pid];
  if (!tx) { loadTx(pid); tx = 'loading'; }
  if (tx === 'loading') html += '<div class="empty">Chargement…</div>';
  else if (!tx.length) html += '<div class="empty"><b>Rien pour l\'instant</b></div>';
  else {
    html += '<ul class="hist">';
    tx.forEach(function(e){
      var d = Number(e.delta), cls = d > 0 ? 'pos' : d < 0 ? 'neg' : 'gift-cls', m = e.match_id ? S.matches[e.match_id] : null;
      var title = esc(TX_LABEL[e.kind] || e.kind) + (e.kind === 'tip_in' || e.kind === 'tip_out' || e.kind === 'gift_in' || e.kind === 'gift_out' ? esc(P(e.other).pseudo) : '');
      var sub = (m ? esc(m.mode) + ' · ' + esc(m.format) + (m.status === 'done' && m.scoreA != null && (e.kind === 'win' || e.kind === 'stake') ? ' · ' + (teamOf(m, pid) === 'B' ? m.scoreB + '–' + m.scoreA : m.scoreA + '–' + m.scoreB) : '') + ' · ' : '') + (e.note ? '« ' + esc(e.note) + ' » · ' : '') + ago(Date.parse(e.at));
      var inner = '<b>' + title + '</b><small>' + sub + '</small>';
      var amtTxt = d === 0 ? '🎁 Cadeau' : (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + ' ' + COIN;
      html += '<li>' + (m ? '<button class="t" data-act="open-match" data-id="' + esc(m.id) + '">' + inner + '</button>' : '<div class="t">' + inner + '</div>') + '<span class="amt ' + cls + '">' + amtTxt + '</span></li>';
    });
    html += '</ul>';
  }
  return html + '</section>';
}


/* ---------- photo de profil ---------- */
function squareJpeg(file){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var s = Math.min(img.naturalWidth, img.naturalHeight), size = 320, c = document.createElement('canvas');
      c.width = size; c.height = size;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ b ? resolve(b) : reject(new Error('conversion')); }, 'image/jpeg', 0.85);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('format')); };
    img.src = url;
  });
}
function uploadAvatar(file){
  if (busy) return;
  if (!/^image\//.test(file.type || 'image/')) { toast('Choisis une image.'); return; }
  if (file.size > 15 * 1024 * 1024) { toast('Image trop lourde (15 Mo max).'); return; }
  busy = true; toast('Envoi de la photo…');
  var old = (me().avatar || '').split('/avatars/')[1];
  var isGif = file.type === 'image/gif';
  if (isGif && !hasItem('gif')) { busy = false; toast('Les photos animées (GIF) se débloquent dans la Boutique (3 coins).'); return; }
  if (isGif && file.size > 4 * 1024 * 1024) { busy = false; toast('GIF trop lourd (4 Mo max).'); return; }
  (isGif ? Promise.resolve(file) : squareJpeg(file)).then(function(blob){
    var path = S.me + '/' + Date.now() + (isGif ? '.gif' : '.jpg');
    return sb.storage.from('avatars').upload(path, blob, {contentType: isGif ? 'image/gif' : 'image/jpeg', upsert: false}).then(function(r){
      if (r.error) throw r.error;
      var url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl;
      return rpc('set_avatar', {p_url: url});
    });
  }).then(function(r){
    busy = false;
    if (!r.ok) { toast(r.msg); return; }
    if (old) sb.storage.from('avatars').remove([decodeURIComponent(old)]);
    toast('Photo de profil mise à jour !'); render();
  }).catch(function(e){
    busy = false;
    toast(e && e.message === 'format' ? 'Ce format d\'image n\'est pas reconnu. Essaie une photo JPG ou PNG.' : 'Envoi impossible : ' + cleanErr(e && e.message));
  });
}
/* ---------- tickets de litige (bot Discord) ---------- */
function ticketBoxHTML(m){
  var t = S.tickets && S.tickets[m.id];
  if (t) return '<div class="ticket-box"><p><b>🎫 Ticket ouvert sur Discord.</b> Le bot gère le litige : capture du score à envoyer ici avant <b>' + untilTxt(Date.parse(t.deadline_at)) + '</b>, sinon l\'autre équipe gagne.</p><a class="btn primary" href="https://discord.com/channels/' + esc(t.guild_id) + '/' + esc(t.channel_id) + '" target="_blank" rel="noopener noreferrer">Aller au ticket ↗</a></div>';
  return '<div class="ticket-box"><p><b>⚖️ Litige :</b> ouvre un ticket, le bot Discord s\'en occupe tout seul (rappels, délai de 24 h, décision).</p><button class="btn primary" data-act="ticket-open" data-id="' + esc(m.id) + '">🎫 Ouvrir un ticket sur Discord</button></div>';
}
function openTicket(mid){
  if (busy) return; busy = true;
  var w = window.open('about:blank', '_blank');
  toast('Le bot crée ton ticket…');
  sb.functions.invoke('discord', {body: {action: 'open', match_id: mid}}).then(function(r){
    if (!r.error) return r.data || {};
    var ctx = r.error.context;
    return (ctx && ctx.json ? ctx.json().catch(function(){ return {}; }) : Promise.resolve({})).then(function(j){ throw new Error((j && j.error) || 'Impossible de créer le ticket.'); });
  }).then(function(d){
    busy = false;
    if (d.url) { if (w) w.location.href = d.url; else location.href = d.url; toast('Ticket ouvert sur Discord !'); }
    return refresh().then(render);
  }, function(e){ busy = false; if (w) w.close(); toast(e.message); });
}

/* ---------- roue quotidienne ---------- */
var WHEEL_TITLES = {chanceux: '🍀 Chanceux'};
// 24 cases, la case 0 est en haut (sous le pointeur) ; les gros lots sont entourés de petites cases
var WHEEL = ['c5', 'c001', 'c005', 'c002', 'c01', 'c001', 'c05', 'c002', 'c005', 'c001', 'c02', 'c002', 'title', 'c001', 'c005', 'c01', 'c002', 'c001', 'c1', 'c002', 'c005', 'c01', 'c02', 'c001'];
var WHEEL_LBL = {c001: '0,01', c002: '0,02', c005: '0,05', c01: '0,1', c02: '0,2', c05: '0,5', c1: '1', c5: '5', title: '🍀'};
var WHEEL_COL = {c001: ['#1b2350', '#202a5e'], c002: ['#272f6e', '#2c3579'], c005: ['#3a2f8f', '#40349a'], c01: ['#4a37b8', '#4a37b8'], c02: ['#0f7d8c', '#0f7d8c'], c05: ['#8b2bff', '#8b2bff'], c1: ['#00a3d9', '#00a3d9'], c5: ['#ffc93c', '#ffc93c'], title: ['#1f9d55', '#1f9d55']};
var WHEEL_ODDS = [
  ['0,01 coin', '55 %', '1 %', 'Le plus courant'],
  ['0,02 coin', '22 %', '4 %', 'Courant'],
  ['0,05 coin', '12 %', '8 %', 'Peu courant'],
  ['0,1 coin', '6,5 %', '15 %', 'Peu courant'],
  ['0,2 coin', '2,25 %', '25 %', 'Rare'],
  ['0,5 coin', '1,5 %', '25 %', 'Très rare (x16 en VIP)'],
  ['1 coin', '0,5 %', '15 %', 'Exceptionnel (x30 en VIP)'],
  ['🍀 Titre « Chanceux »', '0,2 %', '5 %', 'Légendaire (x25 en VIP)'],
  ['5 coins', '0,05 %', '2 %', 'JACKPOT (x40 en VIP !)']
];
var WHEEL_TIER = {c001: 0, c002: 0, c005: 1, c01: 1, c02: 2, c05: 3, c1: 4, title: 5, title_dup: 4, c5: 6};
var NSEG = WHEEL.length, SEG = 360 / NSEG;
var wheelRot = 0, spinLock = false, renderPending = false, wheelResult = null, wheelHit = -1;
var wheelSound = true; try { wheelSound = localStorage.getItem('legacy-wheel-sound') !== '0'; } catch (e) {}
function spinReady(){ return !!S.me && Date.now() - (S.lastSpin || 0) >= 864e5; }
function pad2(n){ return (n < 10 ? '0' : '') + n; }
function waitTxt(ms){ var s = Math.max(0, Math.ceil(ms / 1000)); return pad2(Math.floor(s / 3600)) + ' h ' + pad2(Math.floor(s / 60) % 60) + ' min ' + pad2(s % 60) + ' s'; }
function prizeTxt(pr, amt, vipBoost){ var t = pr === 'title' ? 'le titre exclusif 🍀 Chanceux' : pr === 'title_dup' ? '1 coin (tu avais déjà le titre Chanceux)' : cn(amt); return t + (vipBoost ? ' (Boost VIP 👑)' : ''); }

// ----- sons (générés, aucun fichier à charger)
var actx = null;
function audio(){ if (!wheelSound) return null; try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume(); return actx; } catch (e) { return null; } }
function beep(freq, at, dur, type, vol){
  var a = audio(); if (!a) return;
  var t = a.currentTime + (at || 0), o = a.createOscillator(), g = a.createGain();
  o.type = type || 'triangle'; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
function tickSound(){ beep(1900 + Math.random() * 300, 0, 0.035, 'square', 0.05); }
function winSound(tier){
  var seqs = [[523, 659], [523, 659, 784], [523, 659, 784, 1047], [523, 659, 784, 1047, 1319], [392, 523, 659, 784, 1047, 1319], [392, 523, 659, 784, 1047, 1319, 1568], [392, 523, 659, 784, 659, 784, 1047, 1319, 1568, 2093]];
  var s = seqs[tier] || seqs[0];
  s.forEach(function(f, i){ beep(f, i * 0.09, tier >= 5 ? 0.35 : 0.22, 'triangle', 0.13); });
  if (tier >= 5) s.forEach(function(f, i){ beep(f / 2, i * 0.09, 0.3, 'sawtooth', 0.03); });
}

function wheelSVG(){
  var s = '', bulbs = '';
  for (var i = 0; i < NSEG; i++) {
    var a0 = (i * SEG - SEG / 2 - 90) * Math.PI / 180, a1 = ((i + 1) * SEG - SEG / 2 - 90) * Math.PI / 180, k = WHEEL[i], fill = WHEEL_COL[k][i % 2];
    s += '<path id="ws-' + i + '" class="ws' + (i === wheelHit ? ' hit' : '') + '" d="M0 0L' + (88 * Math.cos(a0)).toFixed(2) + ' ' + (88 * Math.sin(a0)).toFixed(2) + 'A88 88 0 0 1 ' + (88 * Math.cos(a1)).toFixed(2) + ' ' + (88 * Math.sin(a1)).toFixed(2) + 'Z" fill="' + fill + '"/>';
    s += '<text transform="rotate(' + (i * SEG) + ') translate(0 -62) rotate(-90)" text-anchor="middle" dominant-baseline="middle" class="wl wl-' + k + '">' + WHEEL_LBL[k] + '</text>';
    var b = (i * SEG - SEG / 2 - 90) * Math.PI / 180;
    bulbs += '<circle class="bulb b' + (i % 2) + '" cx="' + (94 * Math.cos(b)).toFixed(2) + '" cy="' + (94 * Math.sin(b)).toFixed(2) + '" r="2.6"/>';
  }
  return '<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs><radialGradient id="wg-rim" r="1"><stop offset=".86" stop-color="#2a1a00"/><stop offset=".93" stop-color="#ffc93c"/><stop offset="1" stop-color="#8a5d00"/></radialGradient><radialGradient id="wg-shine"><stop offset="0" stop-color="#fff" stop-opacity=".18"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<circle r="99" fill="url(#wg-rim)"/><g id="wheel-g" style="transform:rotate(' + wheelRot + 'deg)">' + s + '</g>' +
    '<circle r="88" fill="url(#wg-shine)" pointer-events="none"/><g class="bulbs">' + bulbs + '</g>' +
    '<circle r="20" fill="#0b0f12" stroke="#ffc93c" stroke-width="3"/><text class="wl-hub" text-anchor="middle" dominant-baseline="central">L</text></svg>';
}
function wheelHTML(){
  var ready = spinReady(), left = (S.lastSpin || 0) + 864e5 - Date.now();
  var html = '<section class="hero"><div><p class="eyebrow">Roue quotidienne · gratuite</p><h1>Tente ta chance.</h1><p class="lead">Un tour offert toutes les 24 heures, comme une loterie… sans rien payer. Le plus souvent tu repars avec quelques centimes de coin, mais les plus chanceux décrochent le jackpot ou le titre légendaire.</p></div></section>';
  html += '<div class="wheel-wrap"><div class="wheel-box" id="wheel-box"><div class="wheel-pin" id="wheel-pin" aria-hidden="true"></div><div class="wheel">' + wheelSVG() + '</div></div><div class="wheel-side">';
  html += ready
    ? '<button class="btn primary lg wheel-btn" data-act="spin" id="spin-btn">🎡 Tourner la roue</button><p class="help">Gratuit · 1 tour toutes les 24 h</p>'
    : '<div class="wheel-cd-box"><small>Prochain tour gratuit dans</small><b id="wheel-cd">' + waitTxt(left) + '</b></div>';
  html += '<button class="btn sm ghost wheel-snd" data-act="wheel-sound">' + (wheelSound ? '🔊 Son activé' : '🔇 Son coupé') + '</button>';
  if (wheelResult) {
    var tier = WHEEL_TIER[wheelResult.prize] || 0;
    html += '<div class="wheel-res tier-' + tier + '"><small>' + (tier >= 6 ? '💰 JACKPOT 💰' : tier === 5 ? 'LÉGENDAIRE' : tier >= 3 ? 'Très rare !' : 'Ton gain du jour') + (wheelResult.vip_boost ? ' · Boost VIP 👑' : '') + '</small><b>' + (tier >= 3 ? '🎉 ' : '🪙 ') + prizeTxt(wheelResult.prize, wheelResult.amount, wheelResult.vip_boost) + '</b>' + (wheelResult.prize === 'title' ? '<small>Équipe-le dans Boutique → Titres.</small>' : '') + '</div>';
  }
  var isV = me() && me().vip;
  if (isV) {
    html += '<div class="notice vip-wheel-box" style="margin-top:14px;background:rgba(255,201,60,0.12);border:1px solid rgba(255,201,60,0.35);padding:10px 14px;border-radius:12px"><p style="margin:0"><b style="color:#ffc93c">👑 Boost VIP Actif !</b> Tes chances sur les gros lots sont décuplées : <b>jusqu\'à x40</b> ! (47 % de chance d\'avoir 0,5 coin ou mieux)</p></div>';
  } else {
    html += '<div class="notice" style="margin-top:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);padding:10px 14px;border-radius:12px"><p style="margin:0"><b>👑 Envie de plus de gros lots ?</b> Le <b>Pass VIP</b> booste tes chances jusqu\'à <b>x40</b> sur la roue ! <button class="btn sm" data-act="shop-vip" style="margin-left:8px">Voir le VIP</button></p></div>';
  }
  html += '<table class="odds" style="margin-top:14px"><caption>Probabilités de gain</caption><thead><tr><th style="text-align:left">Gain</th><th>Standard</th><th class="' + (isV ? 'vip-active-col' : '') + '">👑 VIP</th><th style="text-align:left">Rareté</th></tr></thead><tbody>' +
    WHEEL_ODDS.map(function(o, i){
      var isRare = i >= 5;
      return '<tr class="' + (isRare ? 'rare ' : '') + (isV ? 'is-vip ' : '') + '"><td style="text-align:left">' + o[0] + '</td><td><b>' + o[1] + '</b></td><td class="odds-vip"><b>' + o[2] + '</b></td><td style="text-align:left"><small>' + o[3] + '</small></td></tr>';
    }).join('') + '</tbody></table>';
  var feed = (S.spinFeed || []).filter(function(x){ return S.players[x.player]; }).slice(0, 6);
  html += '<div class="wheel-feed"><h3>Derniers gros gains</h3>' + (feed.length ? '<ul>' + feed.map(function(x){ return '<li>' + av(P(x.player), 'sm') + '<span class="wf-n">' + nm(P(x.player)) + '</span><b>' + (x.prize === 'title' ? '🍀 Titre Chanceux' : '+' + cn(x.amount)) + '</b></li>'; }).join('') + '</ul>' : '<p class="help">Personne n\'a encore décroché de gros lot. Ce sera peut-être toi !</p>') + '</div>';
  return html + '</div></div>';
}
function spinWheel(){
  if (spinLock || busy || !spinReady()) return;
  audio(); // débloque le son pendant le clic
  busy = true; var btn = document.getElementById('spin-btn'); if (btn) { btn.disabled = true; btn.textContent = 'La roue tourne…'; }
  sb.rpc('spin_wheel').then(function(r){
    busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render); return; }
    var res = r.data, tier = WHEEL_TIER[res.prize] || 0, key = res.prize === 'title_dup' ? 'title' : res.prize;
    var idx = []; WHEEL.forEach(function(k, i){ if (k === key) idx.push(i); });
    var i = idx.length ? idx[Math.floor(Math.random() * idx.length)] : 1;
    var start = wheelRot, cur = ((start % 360) + 360) % 360, target = (360 - i * SEG) % 360;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, end = start + 360 * (reduce ? 5 : 9) + ((target - cur + 360) % 360) + (Math.random() * 0.7 - 0.35) * SEG;
    var D = reduce ? 4500 : 8500;
    var g = document.getElementById('wheel-g'), pin = document.getElementById('wheel-pin'), box = document.getElementById('wheel-box');
    var t0 = performance.now(), lastSeg = null, lastTick = 0;
    spinLock = true; wheelHit = -1; if (box) box.classList.add('spinning');
    function ease(t){ return 1 - Math.pow(1 - t, 4); }
    function frame(now){
      var t = Math.min(1, (now - t0) / D), rot = start + (end - start) * ease(t);
      if (g) g.style.transform = 'rotate(' + rot + 'deg)';
      var seg = Math.floor((((-rot % 360) + 360) % 360 + SEG / 2) / SEG) % NSEG;
      if (seg !== lastSeg) {
        lastSeg = seg;
        if (now - lastTick > 30) { lastTick = now; tickSound(); if (pin) { pin.classList.remove('kick'); void pin.offsetWidth; pin.classList.add('kick'); } }
      }
      if (t < 1) { requestAnimationFrame(frame); return; }
      wheelRot = end; wheelHit = i;
      if (box) box.classList.remove('spinning');
      var hit = document.getElementById('ws-' + i); if (hit) hit.classList.add('hit');
      winSound(tier);
      setTimeout(function(){
        wheelResult = res; S.lastSpin = Date.now(); spinLock = false;
        toast('Tu as gagné ' + prizeTxt(res.prize, res.amount) + ' !');
        refresh().then(function(){
          render();
          var b2 = document.getElementById('wheel-box'); if (b2 && tier >= 3) b2.classList.add('big-win');
          if (tier >= 3) { document.body.insertAdjacentHTML('beforeend', winFxHTML('confetti', 'wheel' + Date.now())); var fx = document.body.lastElementChild; setTimeout(function(){ if (fx) fx.remove(); }, 5000); }
        });
      }, 700);
    }
    requestAnimationFrame(frame);
  });
}
setInterval(function(){ var el = document.getElementById('wheel-cd'); if (el) { var left = (S.lastSpin || 0) + 864e5 - Date.now(); if (left <= 0) render(); else el.textContent = waitTxt(left); } }, 1000);

/* ---------- casino VIP : roulette européenne (100 % virtuel) ---------- */
var CC_ICON = '<svg class="coin cc-coin" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="#6d3df5"/><circle cx="10" cy="10" r="6.5" fill="#a78bfa"/><path d="M6.2 6.6l3.8 7.2 3.8-7.2" fill="none" stroke="#2a1470" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function ccn(n){ return fmt(n) + ' VC'; }
function ccBal(){ var p = me(); return p ? Number(p.cc) || 0 : 0; }
function casinoWalletHTML(vip){
  var left = ((me() || {}).ccClaim || 0) + 864e5 - Date.now(), can = vip && left <= 0;
  return '<div class="cc-wallet"><div class="cc-bal">' + CC_ICON + '<div><small>Tes V-Coins</small><b>' + ccn(ccBal()) + '</b></div></div>' +
    (vip ? (can ? '<button type="button" class="btn primary sm" data-cas="claim">🎁 Bonus du jour : +50 VC</button>' : '<small class="cc-next">Prochain bonus dans ' + waitTxt(left) + '</small>') : '') +
    '<button type="button" class="btn sm ghost" data-cas="shop-cc">Échanger en boutique</button></div>';
}
function casinoShopHTML(){
  var cc = ccBal(), done = CAS.exToday || 0, left = Math.max(0, 160 - done);
  if (!CAS.loaded) casinoLoad();
  var packs = [[40, 0.5], [80, 1], [160, 2], [400, 5]];
  return '<section class="cc-shop"><p class="eyebrow">🎰 V-Coins</p><h2 class="sec shop-h">Échange tes V-Coins</h2><p class="help">Les V-Coins se gagnent au casino (réservé aux VIP). <b>80 VC = 1 coin</b>. Limite : 160 VC échangeables par jour (2 coins).</p>' +
    '<div class="cc-wallet"><div class="cc-bal">' + CC_ICON + '<div><small>Ton solde</small><b>' + ccn(cc) + '</b></div></div><small class="cc-next">Échangé aujourd\'hui : ' + fmt(done) + ' / 160 VC</small><a class="btn sm" href="#casino">Aller au casino</a></div>' +
    '<div class="shop-grid cc-packs">' + packs.map(function(p){ var off = cc < p[0] || p[0] > left; return '<div class="shop-item cc-pack"><b class="cc-in">' + ccn(p[0]) + '</b><span aria-hidden="true">→</span><b class="cc-out">' + cn(p[1]) + '</b><button type="button" class="btn sm primary" data-cas="exch:' + p[0] + '"' + (off ? ' disabled' : '') + '>Échanger</button></div>'; }).join('') + '</div></section>' + casinoTitlesHTML();
}
var CASINO_TITLES = {casino_rookie: ['🎲 Joueur du Casino', 50], casino_pro: ['🎰 Pro du Casino', 100], casino_high_roller: ['💎 High Roller', 200], casino_lucky: ['🍀 Lucky Seven', 300], casino_allin: ['🔥 All-In Legend', 500], casino_baron: ['👑 Baron du Casino', 800]};
function casinoTitlesHTML(){
  var p = me(), cc = ccBal();
  return '<section><h2 class="sec shop-h">Titres exclusifs du casino</h2><p class="help" style="margin-bottom:12px">Impossibles à avoir autrement : ils s\'achètent uniquement en V-Coins, et s\'équipent comme les autres titres.</p><div class="title-grid">' + Object.keys(CASINO_TITLES).map(function(k){
    var t = CASINO_TITLES[k], own = (p.owned || []).indexOf('title:' + k) >= 0, on = p.titleKey === k;   // pas hasItem : le VIP ne donne pas ces titres
    var act = own ? (on ? '<button class="btn sm ghost" data-act="equip-title" data-key="">Retirer</button>' : '<button class="btn sm" data-act="equip-title" data-key="' + k + '">Équiper</button>') : '<button type="button" class="btn sm primary" data-cas="title:' + k + '"' + (cc < t[1] ? ' disabled' : '') + '>' + ccn(t[1]) + '</button>';
    return '<div class="title-item casino' + (on ? ' on' : '') + '"><span class="ptitle casino">' + esc(t[0]) + '</span><div class="shop-act-row">' + act + '</div></div>';
  }).join('') + '</div></section>';
}
var CAS = {game: 'roulette', bet: 'red', stake: 1, loaded: false, loading: false, hist: [], feed: [], today: 0, exToday: 0, res: null, busy: false};
var CAS_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
var CAS_RED = {1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 18: 1, 19: 1, 21: 1, 23: 1, 25: 1, 27: 1, 30: 1, 32: 1, 34: 1, 36: 1};
var CAS_SEG = 360 / 37, CAS_CAP = 25, casRot = 0, casHit = -1;
function casFree(){ return true; }   // mise libre (all-in et montant au choix) en permanence ; le plafond de gains de 25 coins/jour s'applique toujours
var CAS_NAME = {red: 'rouge', black: 'noir', green: 'vert'}, CAS_MULT = {red: 1.9, black: 1.9, green: 30}, CAS_MAXWIN = Infinity;
function casGain(st){ return Math.min(Math.round(st * (CAS_MULT[CAS.bet] - 1) * 100) / 100, CAS_MAXWIN); }
function casMultTxt(c){ return 'x' + String(CAS_MULT[c]).replace('.', ','); }
function casColor(n){ return n === 0 ? 'green' : CAS_RED[n] ? 'red' : 'black'; }
function casStake(){
  if (casFree()) return CAS.stake === 'all' ? Math.floor(ccBal() * 100) / 100 : (Math.round(CAS.stake * 100) / 100 || 0);   // ce soir : mise libre, all-in = tout le solde disponible
  return CAS.bet === 'green' ? 0.5 : ([0.5, 1, 2, 5].indexOf(CAS.stake) < 0 ? 1 : CAS.stake);
}

function casinoLoad(){
  if (CAS.loading || !S.me) return;
  CAS.loading = true;
  Promise.all([
    sb.from('casino_spins').select('number,at').eq('player', S.me).in('bet', ['red', 'black', 'green']).order('at', {ascending: false}).limit(14),
    sb.from('casino_spins').select('player,payout,stake,bet,at').gt('payout', 0).order('at', {ascending: false}).limit(6),
    sb.rpc('casino_today'),
    sb.rpc('casino_exchanged_today')
  ]).then(function(r){
    CAS.loading = false; CAS.loaded = true;
    CAS.hist = r[0].data || []; CAS.feed = (r[1].data || []).filter(function(x){ return Number(x.payout) > Number(x.stake); }); CAS.today = Number(r[2].data) || 0; CAS.exToday = Number(r[3].data) || 0;
    if ((viewName() === 'casino' || viewName() === 'boutique') && !spinLock) render();
  }).catch(function(){ CAS.loading = false; CAS.loaded = true; });
}

function casinoSVG(){
  var s = '', bulbs = '', i, n, col, a0, a1, fill;
  for (i = 0; i < 37; i++) {
    n = CAS_ORDER[i]; col = casColor(n); fill = col === 'red' ? '#c8283c' : col === 'green' ? '#12a35c' : '#161823';
    a0 = (i * CAS_SEG - CAS_SEG / 2 - 90) * Math.PI / 180; a1 = ((i + 1) * CAS_SEG - CAS_SEG / 2 - 90) * Math.PI / 180;
    s += '<path id="cs-' + i + '" class="cs' + (i === casHit ? ' hit' : '') + '" d="M0 0L' + (88 * Math.cos(a0)).toFixed(2) + ' ' + (88 * Math.sin(a0)).toFixed(2) + 'A88 88 0 0 1 ' + (88 * Math.cos(a1)).toFixed(2) + ' ' + (88 * Math.sin(a1)).toFixed(2) + 'Z" fill="' + fill + '" stroke="#2a2330" stroke-width=".6"/>';
    s += '<text transform="rotate(' + (i * CAS_SEG).toFixed(3) + ') translate(0 -74) rotate(-90)" text-anchor="middle" dominant-baseline="middle" class="cl">' + n + '</text>';
    bulbs += '<circle class="cbulb" cx="' + (94 * Math.cos((i * CAS_SEG - CAS_SEG / 2 - 90) * Math.PI / 180)).toFixed(2) + '" cy="' + (94 * Math.sin((i * CAS_SEG - CAS_SEG / 2 - 90) * Math.PI / 180)).toFixed(2) + '" r="1.7"/>';
  }
  return '<svg viewBox="-100 -100 200 200" aria-hidden="true"><defs><radialGradient id="cg-rim" r="1"><stop offset=".86" stop-color="#2a1a00"/><stop offset=".93" stop-color="#ffc93c"/><stop offset="1" stop-color="#8a5d00"/></radialGradient><radialGradient id="cg-shine"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>' +
    '<circle r="99" fill="url(#cg-rim)"/><g id="cas-g" style="transform:rotate(' + casRot + 'deg)">' + s + '<circle r="56" fill="#0e0a14" stroke="#ffc93c" stroke-width="1.4"/></g>' +
    '<circle r="88" fill="url(#cg-shine)" pointer-events="none"/><g>' + bulbs + '</g><circle r="22" fill="#0b0f12" stroke="#ffc93c" stroke-width="3"/><text class="cl-hub" text-anchor="middle" dominant-baseline="central">L</text></svg>';
}

function casinoHTML(){
  if (CAS.game === 'slots') return slotsPage();
  if (CAS.game === 'chicken') return chickenPage();
  if (CAS.game === 'blackjack') return blackjackPage();
  if (CAS.game === 'mines') return minesPage();
  if (CAS.game === 'plinko') return plinkoPage();
  if (CAS.game === 'hilo') return hiloPage();
  if (CAS.game === 'tower') return towerPage();
  return rouletteHTML();
}
function rouletteHTML(){
  var vip = !!(me() && me().vip), st = casStake(), a = ccBal(), capped = CAS.today >= CAS_CAP;
  if (vip && !CAS.loaded) casinoLoad();
  var h = '<section class="hero"><div><p class="eyebrow">👑 Réservé aux VIP · 100 % virtuel</p><h1>Le Casino Legacy.</h1><p class="lead">Joue avec tes <b>V-Coins</b> 💜 · roulette européenne : <b>rouge</b> ou <b>noir</b> pour presque doubler ta mise (x1,9), <b>vert</b> pour tenter le x30. Les coins n\'ont aucune valeur réelle : joue pour le plaisir.</p></div></section>';
  h += casinoTabsHTML();
  h += '<div class="cas-wrap' + (vip ? '' : ' locked') + '"><div class="cas-stage"><div class="cas-box" id="cas-box"><div class="cas-pin" id="cas-pin" aria-hidden="true"></div><div class="cas-wheel">' + casinoSVG() + '</div></div>';
  if (!vip) h += '<div class="cas-lock"><b>🔒 Réservé aux membres VIP</b><p>Le Pass VIP ouvre le casino, booste la roue quotidienne et bien plus.</p><button class="btn primary" data-act="shop-vip">Devenir VIP · ' + ccn(20) + '</button></div>';
  h += '</div><div class="cas-side">' + casinoWalletHTML(vip);
  if (CAS.res) {
    var r = CAS.res, win = r.payout > 0;
    h += '<div class="cas-res ' + (win ? 'win' : 'lose') + '"><span class="cas-ball ' + r.color + '">' + r.number + '</span><div><b>' + (win ? '🎉 Gagné · +' + ccn(r.net) : 'Perdu · −' + ccn(r.stake)) + '</b><small>Le ' + r.number + ' ' + CAS_NAME[r.color] + ' · tu avais misé ' + ccn(r.stake) + ' sur ' + CAS_NAME[r.bet] + '</small></div></div>';
  }
  h += '<div class="cas-bets" role="group" aria-label="Choisis ta couleur">' + ['red', 'black', 'green'].map(function(c){
    return '<button type="button" class="cas-col ' + c + (CAS.bet === c ? ' sel' : '') + '" data-cas="bet:' + c + '"' + (vip ? '' : ' disabled') + '>' + CAS_NAME[c].charAt(0).toUpperCase() + CAS_NAME[c].slice(1) + '<small>' + casMultTxt(c) + '</small></button>';
  }).join('') + '</div>';
  var cv = (typeof CAS.stake === 'number' && [0.5, 1, 2, 5].indexOf(CAS.stake) < 0 && CAS.stake > 0) ? String(CAS.stake).replace('.', ',') : '';
  h += '<div class="cas-stakes" role="group" aria-label="Ta mise"><span>Mise</span>' + [0.5, 1, 2, 5].map(function(v){
    var off = !vip || (!casFree() && CAS.bet === 'green' && v > 0.5);
    return '<button type="button" class="cas-chip' + (CAS.stake !== 'all' && st === v ? ' sel' : '') + '" data-cas="stake:' + v + '"' + (off ? ' disabled' : '') + '>' + ccn(v) + '</button>';
  }).join('') + (casFree() ? '<button type="button" class="cas-chip allin' + (CAS.stake === 'all' ? ' sel' : '') + '" data-cas="stake:all"' + (!vip || a < 0.01 ? ' disabled' : '') + '>🔥 ALL-IN</button><label class="cas-custom' + (cv ? ' sel' : '') + '"><span>ou</span><input id="cas-custom" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 12,5" value="' + cv + '"' + (vip ? '' : ' disabled') + ' aria-label="Montant libre en coins"><em>coins</em></label>' : '') + '</div>';
  h += '<button type="button" class="btn primary lg cas-go" id="cas-spin" data-cas="spin"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>🎰 Lancer · ' + ccn(st) + '</button>';
  if (vip) {
    h += (capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de coins disponibles pour cette mise.</p>' : '<p class="help" id="cas-gain">Gain possible : <b>+' + ccn(casGain(st)) + '</b> · Disponible : ' + ccn(a) + '</p>');
    h += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
    h += '<div class="cas-hist"><small>Tes derniers numéros</small><div>' + (CAS.hist.length ? CAS.hist.map(function(x){ return '<span class="cas-ball sm ' + casColor(x.number) + '">' + x.number + '</span>'; }).join('') : '<em>Aucun lancer pour le moment.</em>') + '</div></div>';
    h += '<div class="cas-feed"><small>Derniers gains du casino</small>' + (CAS.feed.length ? '<ul>' + CAS.feed.filter(function(x){ return S.players[x.player]; }).map(function(x){ return '<li>' + av(P(x.player), 'sm') + '<span>' + nm(P(x.player)) + '</span><b>+' + ccn(Number(x.payout) - Number(x.stake)) + '</b></li>'; }).join('') + '</ul>' : '<em>Personne n\'a encore gagné aujourd\'hui.</em>') + '</div>';
  }
  h += '<ul class="cas-rules"><li>Roulette européenne : 37 cases (0 à 36). Le 0 est vert.</li><li>Tu joues avec des <b>V-Coins (VC)</b> : bonus VIP de 50 VC par jour, échangeables en boutique (80 VC = 1 coin).</li><li>Mise libre : choisis un montant (même avec des décimales) ou fais <b>🔥 ALL-IN</b>.</li><li>Plafond de gains : <b>' + ccn(CAS_CAP) + ' par jour</b>, pour garder une économie équilibrée' + '' + '.</li><li>Un lancer toutes les 4 secondes. Jeu 100 % virtuel, sans valeur réelle.</li></ul>';
  return h + '</div></div>';
}

function casinoSpin(){
  if (spinLock || CAS.busy || !me() || !me().vip) return;
  var st = casStake(), bet = CAS.bet, btn = document.getElementById('cas-spin');
  audio(); CAS.busy = true; if (btn) { btn.disabled = true; btn.textContent = 'La roulette tourne…'; }
  sb.rpc('casino_roulette', {p_bet: bet, p_stake: st}).then(function(r){
    CAS.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render); return; }
    var res = r.data, idx = CAS_ORDER.indexOf(res.number);
    var start = casRot, cur = ((start % 360) + 360) % 360, target = (360 - idx * CAS_SEG) % 360;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var end = start + 360 * (reduce ? 4 : 7) + ((target - cur + 360) % 360) + (Math.random() * 0.6 - 0.3) * CAS_SEG, D = reduce ? 3500 : 6000;
    var g = document.getElementById('cas-g'), pin = document.getElementById('cas-pin'), box = document.getElementById('cas-box');
    var t0 = performance.now(), lastSeg = null, lastTick = 0;
    spinLock = true; casHit = -1; CAS.res = null; if (box) box.classList.add('spinning');
    function ease(t){ return 1 - Math.pow(1 - t, 4); }
    function frame(now){
      var t = Math.min(1, (now - t0) / D), rot = start + (end - start) * ease(t);
      if (g) g.style.transform = 'rotate(' + rot + 'deg)';
      var seg = Math.floor((((-rot % 360) + 360) % 360 + CAS_SEG / 2) / CAS_SEG) % 37;
      if (seg !== lastSeg) { lastSeg = seg; if (now - lastTick > 30) { lastTick = now; tickSound(); if (pin) { pin.classList.remove('kick'); void pin.offsetWidth; pin.classList.add('kick'); } } }
      if (t < 1) { requestAnimationFrame(frame); return; }
      casRot = end; casHit = idx; if (box) box.classList.remove('spinning');
      var hit = document.getElementById('cs-' + idx); if (hit) hit.classList.add('hit');
      if (res.payout > 0) winSound(res.color === 'green' ? 6 : 2);
      setTimeout(function(){
        CAS.res = res; if (me()) me().cc = Number(res.balance); CAS.today = Number(res.today) || 0; CAS.hist.unshift({number: res.number}); CAS.hist = CAS.hist.slice(0, 14);
        if (res.payout > 0) CAS.feed.unshift({player: S.me, payout: res.payout, stake: res.stake, bet: res.bet}); CAS.feed = CAS.feed.slice(0, 6);
        spinLock = false;
        toast(res.payout > 0 ? 'Gagné ! +' + ccn(res.net) : 'Perdu, retente ta chance !');
        refresh().then(function(){
          render();
          if (res.color === 'green' && res.payout > 0) { document.body.insertAdjacentHTML('beforeend', winFxHTML('confetti', 'cas' + Date.now())); var fx = document.body.lastElementChild; setTimeout(function(){ if (fx) fx.remove(); }, 5000); }
        }).catch(function(){ render(); });
      }, 600);
    }
    requestAnimationFrame(frame);
  });
}
// mise libre (ce soir) : mise à jour du bouton sans refaire toute la page, pour ne pas perdre le curseur dans le champ
function casSync(){
  var st = casStake(), a = ccBal(), btn = document.getElementById('cas-spin'), g = document.getElementById('cas-gain');
  [].forEach.call(document.querySelectorAll('.cas-chip'), function(c){ c.classList.remove('sel'); });
  if (btn && !CAS.busy && !spinLock) { btn.textContent = '🎰 Lancer · ' + ccn(st); btn.disabled = !(st >= 0.01) || a < st; }
  if (g) g.innerHTML = !(st >= 0.01) ? 'Entre un montant à partir de 0,01 coin.' : a < st ? '<span class="cas-warn">Pas assez de coins disponibles (' + ccn(a) + ').</span>' : 'Gain possible : <b>+' + ccn(casGain(st)) + '</b> · Disponible : ' + ccn(a);
}
function casinoInit(){
  document.addEventListener('input', function(e){
    if (e.target && e.target.id === 'g-custom') {
      var gm = parseFloat(String(e.target.value).replace(',', '.')), gg = e.target.getAttribute('data-game');
      GS[gg] = isFinite(gm) && gm >= 0.01 ? Math.round(gm * 100) / 100 : 0;
      gSync(gg);
      var gl = e.target.parentNode; if (gl) gl.classList.add('sel');
      return;
    }
    if (!e.target || e.target.id !== 'cas-custom') return;
    var n = parseFloat(String(e.target.value).replace(',', '.'));
    CAS.stake = isFinite(n) && n >= 0.01 ? Math.round(n * 100) / 100 : 0;
    casSync();
    var lab = e.target.parentNode; if (lab) lab.classList.add('sel');
  });
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('[data-cas]') : null; if (!t || t.disabled) return;
    var v = t.getAttribute('data-cas');
    if (v === 'spin') casinoSpin();
    else if (v.indexOf('game:') === 0) { CAS.game = v.slice(5); render(); }
    else if (v.indexOf('gs:') === 0) { var gp = v.split(':'); GS[gp[1]] = gp[2] === 'all' ? 'all' : parseFloat(gp[2]); render(); }
    else if (v === 'slspin') slotsSpin();
    else if (v === 'chstart') chStart();
    else if (v === 'mnstart') mnStart();
    else if (v === 'plkgo') plinkoDrop();
    else if (v.indexOf('plkrisk:') === 0) { PL.risk = v.slice(8); render(); }
    else if (v === 'hlstart') hlCall('casino_hilo_start', {p_stake: gStakeVal('hl')}, true);
    else if (v === 'hlhi') hlCall('casino_hilo_guess', {p_dir: 'hi'});
    else if (v === 'hllo') hlCall('casino_hilo_guess', {p_dir: 'lo'});
    else if (v === 'hlcash') hlCall('casino_hilo_cashout');
    else if (v === 'twstart') twStart();
    else if (v === 'twcash') twCash();
    else if (v.indexOf('twpick:') === 0) twPick(parseInt(v.slice(7), 10));
    else if (v.indexOf('twdiff:') === 0) { TW.diff = v.slice(7); render(); }
    else if (v === 'mncash') mnCash();
    else if (v.indexOf('mnpick:') === 0) mnPick(parseInt(v.slice(7), 10));
    else if (v.indexOf('mn:') === 0) { var mv = v.slice(3); MN.n = mv === 'min' ? 1 : mv === 'max' ? 24 : Math.max(1, Math.min(24, MN.n + (mv === 'inc' ? 1 : -1))); render(); }
    else if (v === 'bjstart') bjCall('casino_bj_start', {p_stake: gStakeVal('bj')}, true);
    else if (v === 'bjhit') bjCall('casino_bj_hit');
    else if (v === 'bjstand') bjCall('casino_bj_stand');
    else if (v === 'bjdouble') bjCall('casino_bj_double');
    else if (v === 'chgo') chGo();
    else if (v === 'chcash') chCash();
    else if (v === 'claim') {
      sb.rpc('casino_claim').then(function(r){
        if (r.error) { toast(cleanErr(r.error.message)); return; }
        var p0 = me(); if (p0) { p0.cc = Number(r.data) || 0; p0.ccClaim = Date.now(); }
        toast('🎁 +50 V-Coins !'); render();
      });
    }
    else if (v === 'shop-cc') { shopTab = 'casino'; if (viewName() === 'boutique') render(); else location.hash = '#boutique'; }
    else if (v.indexOf('title:') === 0) {
      var tk = v.slice(6);
      sb.rpc('casino_buy_title', {p_key: tk}).then(function(r){
        if (r.error) { toast(cleanErr(r.error.message)); return; }
        var p2 = me(); if (p2) { p2.cc = Number(r.data.cc) || 0; p2.owned = (p2.owned || []).concat(['title:' + tk]); }
        toast('Titre acheté : ' + CASINO_TITLES[tk][0] + ' ! Équipe-le juste en dessous.');
        refresh().then(render, render);
      });
    }
    else if (v.indexOf('exch:') === 0) {
      sb.rpc('casino_exchange', {p_cc: parseInt(v.slice(5), 10)}).then(function(r){
        if (r.error) { toast(cleanErr(r.error.message)); return; }
        var p1 = me(); if (p1) p1.cc = Number(r.data.cc) || 0; CAS.exToday = Number(r.data.done_today) || 0;
        toast('Échange réussi : +' + cn(Number(r.data.coins)) + ' !');
        refresh().then(render, render);
      });
    }
    else if (v.indexOf('bet:') === 0) { CAS.bet = v.slice(4); render(); }
    else if (v.indexOf('stake:') === 0) { CAS.stake = v.slice(6) === 'all' ? 'all' : parseFloat(v.slice(6)); render(); }
  });
}

/* ---------- casino : onglets, machine à sous et poulet qui traverse ---------- */
function casinoTabsHTML(){
  var tabs = [['roulette', '🎡 Roulette'], ['slots', '🎰 Machine à sous'], ['chicken', '🐔 Poulet'], ['blackjack', '🃏 Blackjack'], ['mines', '⛏️ Legacy Miner'], ['plinko', '🔻 Plinko'], ['hilo', '↕️ Hi-Lo'], ['tower', '🗼 Tower']];
  return '<div class="tabs cas-tabs" role="tablist">' + tabs.map(function(t){ return '<button type="button" role="tab" aria-selected="' + (CAS.game === t[0]) + '" data-cas="game:' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
}
function casinoHeroHTML(){
  return '<section class="hero"><div><p class="eyebrow">👑 Réservé aux VIP · 100 % virtuel</p><h1>Le Casino Legacy.</h1><p class="lead">Roulette, machine à sous, poulet… Joue avec tes <b>V-Coins</b> 💜 : ils n\'ont aucune valeur réelle, joue pour le plaisir.</p></div></section>';
}
function casinoGameShell(vip, stageHTML, sideHTML){
  return casinoHeroHTML() + casinoTabsHTML() + '<div class="cas-wrap' + (vip ? '' : ' locked') + '"><div class="cas-stage cas-stage-wide">' + stageHTML +
    (vip ? '' : '<div class="cas-lock"><b>🔒 Réservé aux membres VIP</b><p>Le Pass VIP ouvre le casino, booste la roue quotidienne et bien plus.</p><button class="btn primary" data-act="shop-vip">Devenir VIP · ' + cn(20) + '</button></div>') +
    '</div><div class="cas-side">' + casinoWalletHTML(vip) + sideHTML + '</div></div>';
}

/* --- mise : jetons, ALL-IN et montant libre (commun aux deux jeux) --- */
var GS = {slots: 1, chicken: 1, bj: 1, mn: 1, plk: 1, hl: 1, tw: 1};
var GSYNC = {slots: ['sl-spin', '🎰 LANCER · '], chicken: ['ch-start', '🐔 JOUER · '], bj: ['bj-start', '🃏 DISTRIBUER · '], mn: ['mn-start', '⛏️ JOUER · '], plk: ['plk-go', '🔻 LÂCHER LA BILLE · '], hl: ['hl-start', '↕️ JOUER · '], tw: ['tw-start', '🗼 GRIMPER · ']};
function gStakeVal(g){ var v = GS[g]; return v === 'all' ? Math.floor(ccBal() * 100) / 100 : (Math.round(v * 100) / 100 || 0); }
function gStakeHTML(g, vip, lock){
  var cur = GS[g], chips = [1, 2, 5, 10, 25], off = !vip || lock ? ' disabled' : '';
  var cv = (typeof cur === 'number' && chips.indexOf(cur) < 0 && cur > 0) ? String(cur).replace('.', ',') : '';
  return '<div class="cas-stakes" role="group" aria-label="Ta mise"><span>Mise</span>' + chips.map(function(v){
    return '<button type="button" class="cas-chip' + (cur === v ? ' sel' : '') + '" data-cas="gs:' + g + ':' + v + '"' + off + '>' + ccn(v) + '</button>';
  }).join('') + '<button type="button" class="cas-chip allin' + (cur === 'all' ? ' sel' : '') + '" data-cas="gs:' + g + ':all"' + (off || (ccBal() < 0.01 ? ' disabled' : '')) + '>🔥 ALL-IN</button>' +
    '<label class="cas-custom' + (cv ? ' sel' : '') + '"><span>ou</span><input id="g-custom" data-game="' + g + '" type="text" inputmode="decimal" autocomplete="off" placeholder="ex. 12,5" value="' + cv + '"' + off + ' aria-label="Montant libre en V-Coins"><em>VC</em></label></div>';
}
function gSync(g){
  var st = gStakeVal(g), a = ccBal(), capped = CAS.today >= CAS_CAP;
  [].forEach.call(document.querySelectorAll('.cas-stakes .cas-chip'), function(c){ c.classList.remove('sel'); });
  var gm = GSYNC[g] || GSYNC.chicken, btn = document.getElementById(gm[0]), led = document.getElementById('led-bet');
  if (btn && !CAS.busy && !SL.spinning && !spinLock) { btn.textContent = gm[1] + ccn(st); btn.disabled = !(st >= 0.01) || a < st || capped; }
  if (led) led.textContent = fmt(st);
}

/* =================== MACHINE À SOUS =================== */
var SL_KEYS = ['L', '7', 'BAR', 'DIA', 'CHE', 'STA', 'COI'];
var SL_TRI = {L: 200, '7': 60, BAR: 25, DIA: 12, CHE: 8, STA: 6, COI: 5}, SL_PAIR = {L: 8, '7': 5, BAR: 3, DIA: 2, CHE: 1.5, STA: 1, COI: 0.5};
function slSym(k){
  if (k === 'L') return '<img class="sy-logo" src="logo.svg" alt="L">';
  if (k === '7') return '<span class="sy7">7</span>';
  if (k === 'BAR') return '<span class="sybar">BAR</span>';
  if (k === 'DIA') return '<span class="syemo">💎</span>';
  if (k === 'CHE') return '<span class="syemo">🍒</span>';
  if (k === 'STA') return '<span class="syemo">⭐</span>';
  return '<span class="sycoin">' + CC_ICON + '</span>';
}
function slRnd(){ return SL_KEYS[Math.floor(Math.random() * SL_KEYS.length)]; }
var SL = {cells: [[slRnd(), '7', slRnd()], [slRnd(), 'L', slRnd()], [slRnd(), 'BAR', slRnd()]], win: 0, res: null, spinning: false};
function slCell(k){ return '<div class="reel-cell">' + slSym(k) + '</div>'; }
function slMini(k){ return '<span class="mini">' + slSym(k) + '</span>'; }
function slPaytable(){
  var top = ['L', '7', 'BAR', 'DIA', 'CHE', 'STA', 'COI'];
  return '<div class="slot-top"><div class="sp-head"><span class="sp-jack">JACKPOT</span><b>x' + SL_TRI.L + '</b><span class="sp-logo"><img src="logo.svg" alt="" width="26" height="26"> LEGACY</span></div><div class="sp-grid">' +
    top.map(function(k){ return '<div class="sp-cell">' + slMini(k) + slMini(k) + slMini(k) + '<b>x' + SL_TRI[k] + '</b></div>'; }).join('') +
    '<div class="sp-cell sp-free">2 identiques<b>jusqu\'à x' + SL_PAIR.L + '</b></div></div></div>';
}
function slStickers(){
  var logo = '<img src="logo.svg" alt="">';
  var items = [[logo, '1%', '-3%', -14, 62], ['⭐', '9%', '93%', 16, 38], ['🍒', '24%', '-4%', -20, 44], ['<span class="sy7 s">7</span>', '36%', '95%', 12, 46], ['💎', '52%', '-4%', -10, 42],
    ['<span class="stk-tag">VIP 👑</span>', '62%', '88%', 9, 0], ['🪙', '72%', '-3%', 14, 40], [logo, '78%', '91%', 10, 54], ['<span class="stk-tag alt">LEGACY</span>', '88%', '-5%', -7, 0], ['🎰', '94%', '90%', -12, 42], ['⭐', '44%', '-2%', 18, 28], ['🍒', '16%', '97%', -14, 34]];
  return '<div class="slot-stickers" aria-hidden="true">' + items.map(function(s, i){
    return '<span class="stk" style="top:' + s[1] + ';left:' + s[2] + ';--r:' + s[3] + 'deg;' + (s[4] ? 'font-size:' + s[4] + 'px;width:' + s[4] + 'px;' : '') + 'animation-delay:-' + (i * 0.7).toFixed(1) + 's">' + s[0] + '</span>';
  }).join('') + '</div>';
}
function slotsPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('slots'), a = ccBal(), capped = CAS.today >= CAS_CAP;
  if (vip && !CAS.loaded) casinoLoad();
  var stage = '<div class="slot-stage">' + slStickers() + '<div class="slot-machine' + (SL.win > 0 ? ' win' : '') + '" id="slot-machine">' + slPaytable() +
    '<div class="slot-window"><div class="slot-reels">' + [0, 1, 2].map(function(i){ return '<div class="reel"><div class="reel-strip" id="reel-' + i + '">' + SL.cells[i].map(slCell).join('') + '</div></div>'; }).join('') + '</div><div class="slot-payline"></div></div>' +
    '<div class="slot-panel"><div class="led"><small>MISE</small><b id="led-bet">' + fmt(st) + '</b></div><div class="led"><small>CRÉDIT</small><b id="led-credit">' + fmt(a) + '</b></div><div class="led win"><small>GAIN</small><b id="led-win">' + fmt(SL.win) + '</b></div></div></div></div>';
  var side = '';
  if (SL.res) {
    var r = SL.res, win = r.payout > 0;
    side += '<div class="cas-res ' + (win ? 'win' : 'lose') + '"><span class="cas-ball red">🎰</span><div><b>' + (win ? (r.net >= 0 ? '🎉 Gagné · +' + ccn(r.net) : 'Presque ! Tu récupères ' + ccn(r.payout)) : 'Perdu · −' + ccn(r.stake)) + '</b><small>' + (r.mult ? 'Combinaison x' + String(r.mult).replace('.', ',') : 'Aucune combinaison') + ' · mise ' + ccn(r.stake) + '</small></div></div>';
  }
  side += gStakeHTML('slots', vip, false);
  side += '<button type="button" class="btn primary lg cas-go" id="sl-spin" data-cas="slspin"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>🎰 LANCER · ' + ccn(st) + '</button>';
  side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<ul class="cas-rules"><li>3 rouleaux : <b>3 symboles identiques</b> = gros gain (3 logos Legacy = x' + SL_TRI.L + ' !).</li><li><b>2 symboles identiques</b> sur la ligne rouge : petit gain.</li><li>Retour moyen d\'environ 91 % : la machine garde un peu d\'avance.</li><li>Un lancer toutes les 3 secondes. Jeu 100 % virtuel, sans valeur réelle.</li></ul>';
  return casinoGameShell(vip, stage, side);
}
function slotsSpin(){
  if (spinLock || SL.spinning || !me() || !me().vip) return;
  var st = gStakeVal('slots'), btn = document.getElementById('sl-spin');
  audio(); SL.spinning = true; if (btn) { btn.disabled = true; btn.textContent = 'Ça tourne…'; }
  sb.rpc('casino_slots', {p_stake: st}).then(function(r){
    if (r.error) { SL.spinning = false; toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var res = r.data, N = 26, durs = [1500, 2150, 2800], first = document.querySelector('.reel-cell'), H = first ? first.offsetHeight : 92;
    spinLock = true; SL.win = 0;
    var machine = document.getElementById('slot-machine'); if (machine) machine.classList.remove('win');
    var lw = document.getElementById('led-win'); if (lw) lw.textContent = '0';
    var strips = [0, 1, 2].map(function(i){
      var el = document.getElementById('reel-' + i); if (!el) return null;
      var cells = []; for (var k = 0; k < N; k++) cells.push(slRnd());
      cells[N - 2] = res.reels[i];
      el.innerHTML = cells.map(slCell).join(''); el.style.transform = 'translateY(0px)';
      return {el: el, cells: cells};
    });
    var t0 = performance.now(), lastTick = 0;
    function frame(now){
      var all = true;
      strips.forEach(function(s, i){
        if (!s) return;
        var t = Math.min(1, (now - t0) / durs[i]);
        s.el.style.transform = 'translateY(' + (-(N - 3) * H * (1 - Math.pow(1 - t, 3))) + 'px)';
        if (t < 1) all = false;
      });
      if (!all && now - lastTick > 75) { lastTick = now; tickSound(); }
      if (!all) return false;
      strips.forEach(function(s, i){ if (!s) return; SL.cells[i] = [s.cells[N - 3], res.reels[i], s.cells[N - 1]]; s.el.innerHTML = SL.cells[i].map(slCell).join(''); s.el.style.transform = 'translateY(0px)'; });
      SL.res = res; SL.win = Number(res.payout) || 0; SL.spinning = false; CAS.today = Number(res.today) || 0;
      if (me()) me().cc = Number(res.balance);
      if (machine && SL.win > 0) machine.classList.add('win');
      if (lw) lw.textContent = fmt(SL.win);
      var lc = document.getElementById('led-credit'); if (lc) lc.textContent = fmt(res.balance);
      if (res.payout > 0) winSound(res.mult >= 25 ? 6 : res.mult >= 8 ? 4 : res.net > 0 ? 2 : 0);
      setTimeout(function(){
        spinLock = false;
        toast(res.net > 0 ? 'Gagné ! +' + ccn(res.net) : res.payout > 0 ? 'Presque ! Tu récupères ' + ccn(res.payout) : 'Perdu, retente ta chance !');
        refresh().then(function(){
          render();
          if (res.mult >= 25) { document.body.insertAdjacentHTML('beforeend', winFxHTML('confetti', 'sl' + Date.now())); var fx = document.body.lastElementChild; setTimeout(function(){ if (fx) fx.remove(); }, 5000); }
        }).catch(function(){ render(); });
      }, 500);
      return true;
    }
    casLoop(frame);
  });
}

/* =================== POULET QUI TRAVERSE =================== */
var CH_MULT = [1, 1.2, 1.4, 1.7, 2.0, 2.4, 2.9, 3.5, 4.3, 5.3, 6.6, 8.2, 10.5], CH_PITCH = 112, CH_STEPS = 12;
var CH = {active: false, step: 0, run: 1, busy: false, loaded: false, loading: false, res: null};
function chX(i){ return 84 + i * CH_PITCH; }
function chMultTxt(i){ return 'x' + String(CH_MULT[i]).replace('.', ','); }
function chLoad(){
  if (CH.loaded || CH.loading || !S.me) return;
  CH.loading = true;
  sb.rpc('casino_chicken_state').then(function(r){
    CH.loading = false; CH.loaded = true;
    if (r.data) { CH.active = true; CH.step = Number(r.data.step) || 0; CH.run = Number(r.data.stake) || 1; }
    if (viewName() === 'casino' && CAS.game === 'chicken' && !spinLock) render();
  }).catch(function(){ CH.loading = false; CH.loaded = true; });
}
function chickenPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('chicken'), a = ccBal(), capped = CAS.today >= CAS_CAP;
  if (vip) { chLoad(); if (!CAS.loaded) casinoLoad(); }
  var track = '', i, cars = '', icons = ['🚗', '🚕', '🚙', '🚌', '🏎️'];
  for (i = 0; i <= CH_STEPS; i++) {
    track += '<div class="chk-plate' + (CH.active && i <= CH.step ? ' done' : '') + (CH.active && i === CH.step ? ' cur' : '') + (i === CH_STEPS ? ' end' : '') + '" style="left:' + chX(i) + 'px"><span>' + (i === 0 ? 'DÉPART' : chMultTxt(i)) + '</span></div>';
    if (i >= 1) {
      track += '<div class="chk-lane" style="left:' + (chX(i) - CH_PITCH / 2) + 'px"></div>';
      cars += '<span class="chk-car decor" data-lane="' + i + '" data-spd="' + (0.22 + (i * 37 % 11) / 30).toFixed(2) + '" data-off="' + ((i * 53 % 17) / 17).toFixed(2) + '" style="left:' + (chX(i) - CH_PITCH / 2 + 27) + 'px">' + icons[i % icons.length] + '</span>';
    }
  }
  var scene = '<div class="chk-scene"><div class="chk-view" id="chk-view"><div class="chk-track" id="chk-track" style="width:' + (chX(CH_STEPS) + 90) + 'px">' + track + cars +
    '<div class="chk-chicken" id="chk-chicken" style="left:' + chX(CH.active ? CH.step : 0) + 'px">🐔</div></div></div>' +
    '<div class="chk-hud"><span>' + (CH.active ? 'Mise ' + ccn(CH.run) : 'Prêt à traverser ?') + '</span><b id="chk-mult">' + chMultTxt(CH.active ? CH.step : 0) + '</b><span>' + (CH.active ? 'Gain actuel ' + ccn(Math.round(CH.run * CH_MULT[CH.step] * 100) / 100) : 'Chaque plaque multiplie ta mise') + '</span></div></div>';
  var side = '';
  if (CH.res) {
    var r = CH.res;
    side += '<div class="cas-res ' + (r.dead ? 'lose' : 'win') + '"><span class="cas-ball ' + (r.dead ? 'red' : 'green') + '">' + (r.dead ? '💥' : '💰') + '</span><div><b>' + (r.dead ? 'Écrasé ! −' + ccn(r.stake) : '🎉 Encaissé · +' + ccn(r.net)) + '</b><small>' + (r.dead ? 'La voiture a gagné cette fois.' : 'Tu repars avec ' + chMultTxt(r.step) + ' (' + ccn(r.payout) + ')') + '</small></div></div>';
  }
  if (CH.active) {
    var nxt = CH.step < CH_STEPS ? CH_MULT[CH.step + 1] : null;
    side += '<button type="button" class="btn primary lg cas-go" id="ch-go" data-cas="chgo"' + (CH.busy ? ' disabled' : '') + '>🐔 AVANCER' + (nxt ? ' · prochaine plaque ' + chMultTxt(CH.step + 1) : '') + '</button>';
    side += '<button type="button" class="btn lg cas-cash" id="ch-cash" data-cas="chcash"' + (CH.step < 1 || CH.busy ? ' disabled' : '') + '>💰 ENCAISSER · ' + ccn(Math.round(CH.run * CH_MULT[CH.step] * 100) / 100) + '</button>';
    side += '<p class="help">Mise en jeu : <b>' + ccn(CH.run) + '</b>. Si une voiture t\'écrase, tu perds tout. Encaisse quand tu veux !</p>';
  } else {
    side += gStakeHTML('chicken', vip, false);
    side += '<button type="button" class="btn primary lg cas-go" id="ch-start" data-cas="chstart"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>🐔 JOUER · ' + ccn(st) + '</button>';
    side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  }
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<ul class="cas-rules"><li>Ton poulet traverse les plaques d\'égout : <b>x1,2</b>, <b>x1,4</b>, <b>x1,7</b>… jusqu\'à <b>x10,5</b> !</li><li>À chaque pas, une voiture peut l\'écraser : <b>mise perdue</b>.</li><li>Tu peux <b>encaisser</b> à tout moment, dès la 1re plaque.</li><li>Retour moyen d\'environ 93 %. Jeu 100 % virtuel, sans valeur réelle.</li></ul>';
  return casinoGameShell(vip, scene, side);
}
// boucle d'animation : image par image + minuterie de secours (le navigateur suspend requestAnimationFrame quand la page n'est pas affichée)
function casLoop(fn){
  var fin = false, iv = null;
  function step(){ if (fin) return; if (fn(performance.now())) { fin = true; clearInterval(iv); } }
  iv = setInterval(step, 30);
  (function loop(){ if (fin) return; step(); requestAnimationFrame(loop); })();
}
function chTween(ms, fn, done){
  var t0 = performance.now();
  casLoop(function(now){ var t = Math.min(1, (now - t0) / ms); fn(t); if (t < 1) return false; if (done) done(); return true; });
}
function chFollow(x){
  var view = document.getElementById('chk-view'), track = document.getElementById('chk-track'); if (!view || !track) return;
  var vw = view.clientWidth, tw = track.offsetWidth, tx = Math.max(vw - tw, Math.min(0, -(x - vw * 0.4)));
  track.style.transform = 'translateX(' + tx + 'px)';
}
function chStart(){
  if (CH.active || CH.busy || spinLock || !me() || !me().vip) return;
  var st = gStakeVal('chicken'); CH.busy = true; audio();
  sb.rpc('casino_chicken_start', {p_stake: st}).then(function(r){
    CH.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    CH.active = true; CH.step = 0; CH.run = Number(r.data.stake); CH.res = null;
    if (me()) me().cc = Number(r.data.balance);
    render();
  });
}
function chEnd(res){   // fin de partie : met l'écran à jour
  CH.active = false; CH.step = 0; CH.busy = false; CH.res = res; spinLock = false;
  refresh().then(render, render);
}
function chGo(){
  if (!CH.active || CH.busy || spinLock) return;
  CH.busy = true; audio();
  var b1 = document.getElementById('ch-go'), b2 = document.getElementById('ch-cash'); if (b1) b1.disabled = true; if (b2) b2.disabled = true;
  sb.rpc('casino_chicken_step').then(function(r){
    if (r.error) { CH.busy = false; toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var res = r.data, from = CH.step, xa = chX(from), xb = chX(from + 1), lane = (xa + xb) / 2;
    var el = document.getElementById('chk-chicken'), track = document.getElementById('chk-track'), view = document.getElementById('chk-view');
    if (!el || !track || !view) { if (res.dead) chEnd({dead: true, stake: CH.run}); else { CH.step = res.step; CH.busy = false; render(); } return; }
    spinLock = true;
    var H = view.clientHeight;
    function put(x, up){ el.style.left = x + 'px'; el.style.transform = 'translateY(' + (-up) + 'px) scaleX(-1)'; chFollow(x); }
    function car(){ var c = document.createElement('span'); c.className = 'chk-car hit'; c.textContent = '🚗'; c.style.left = (lane - 0) + 'px'; c.style.top = '-70px'; track.appendChild(c); return c; }
    var decor = track.querySelector('.chk-car.decor[data-lane="' + (from + 1) + '"]'); if (decor) decor.style.display = 'none';
    if (res.dead) {
      tickSound();
      chTween(380, function(t){ put(xa + (lane - xa) * t, Math.sin(Math.PI * t) * 30); }, function(){
        var c = car(), target = H * 0.5 - 40;
        chTween(380, function(t){ c.style.top = (-70 + (target + 70) * t * t) + 'px'; }, function(){
          el.textContent = '💥'; beep(110, 0, 0.45, 'sawtooth', 0.16); beep(70, 0.05, 0.5, 'square', 0.1);
          chTween(900, function(t){ c.style.top = (target + (H + 80 - target) * t * t) + 'px'; }, function(){
            if (me()) me().cc = Number(res.balance);
            toast('Écrasé ! Tu perds ' + ccn(CH.run));
            chEnd({dead: true, stake: CH.run, step: res.step});
          });
        });
      });
      return;
    }
    var c = car();
    chTween(520, function(t){ c.style.top = (-70 + (H + 140) * t) + 'px'; }, function(){
      c.remove();
      chTween(460, function(t){ put(xa + (xb - xa) * t, Math.sin(Math.PI * t) * 34); if (t > 0.5 && t < 0.56) tickSound(); }, function(){
        CH.step = res.step;
        var m = document.getElementById('chk-mult'); if (m) m.textContent = chMultTxt(res.step);
        if (res.done) {
          if (me()) me().cc = Number(res.balance);
          winSound(4); toast('Arrivé au bout ! +' + ccn(res.net));
          chEnd({dead: false, stake: CH.run, step: res.step, payout: res.payout, net: res.net});
        } else {
          winSound(0); CH.busy = false; spinLock = false; render();
        }
      });
    });
  });
}
function chCash(){
  if (!CH.active || CH.busy || spinLock || CH.step < 1) return;
  CH.busy = true; audio();
  sb.rpc('casino_chicken_cashout').then(function(r){
    if (r.error) { CH.busy = false; toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var res = r.data; if (me()) me().cc = Number(res.balance); CAS.today = Number(res.today) || 0;
    winSound(res.mult >= 3 ? 4 : 2); toast('Encaissé ! +' + ccn(res.net));
    chEnd({dead: false, stake: CH.run, step: res.step, payout: res.payout, net: res.net});
  });
}
// voitures décoratives qui traversent la route en boucle + cadrage du poulet
setInterval(function(){
  var track = document.getElementById('chk-track'); if (!track) return;
  var view = document.getElementById('chk-view'), H = view.clientHeight, t = performance.now() / 1000;
  [].forEach.call(track.querySelectorAll('.chk-car.decor'), function(c){
    if (CH.busy && Number(c.getAttribute('data-lane')) === CH.step + 1) return;
    c.style.display = (CH.active && Number(c.getAttribute('data-lane')) === CH.step + 1) ? 'none' : '';
    var ph = ((t * parseFloat(c.getAttribute('data-spd')) + parseFloat(c.getAttribute('data-off'))) % 1);
    c.style.top = (-70 + ph * (H + 140)) + 'px';
  });
  if (!CH.busy && track.getAttribute('data-fit') !== CH.step + ':' + view.clientWidth) { track.setAttribute('data-fit', CH.step + ':' + view.clientWidth); chFollow(chX(CH.active ? CH.step : 0)); }
}, 50);

/* =================== BLACKJACK (contre le croupier bot) =================== */
var BJ = {g: null, res: null, busy: false, loaded: false, loading: false, nP: 0, nD: 0};
var BJ_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], BJ_SUITS = ['♠', '♥', '♦', '♣'];
function bjCard(c, i, fresh){
  var s = Math.floor(c / 13), red = s === 1 || s === 2;
  return '<div class="bj-card ' + (red ? 'red' : 'black') + '"' + (fresh ? ' data-new="' + i + '"' : '') + '><b>' + BJ_RANKS[c % 13] + '</b><i>' + BJ_SUITS[s] + '</i><span class="bj-mid">' + BJ_SUITS[s] + '</span></div>';
}
function bjBack(){ return '<div class="bj-card back"><img src="logo.svg" alt="" width="34" height="34"></div>'; }
function bjLoad(){
  if (BJ.loaded || BJ.loading || !S.me) return;
  BJ.loading = true;
  sb.rpc('casino_bj_state').then(function(r){
    BJ.loading = false; BJ.loaded = true;
    if (r.data) { BJ.g = r.data; BJ.nP = r.data.pcards.length; BJ.nD = r.data.dcards.length; }
    if (viewName() === 'casino' && CAS.game === 'blackjack') render();
  }).catch(function(){ BJ.loading = false; BJ.loaded = true; });
}
function bjResultText(r){
  if (r.result === 'blackjack') return ['🃏 BLACKJACK ! +' + ccn(r.net), 'win', 'As + figure : payé 6 pour 5.'];
  if (r.result === 'win') return ['🎉 Gagné · +' + ccn(r.net), 'win', r.dtotal > 21 ? 'Le croupier dépasse 21 !' : 'Tu fais ' + r.ptotal + ' contre ' + r.dtotal + '.'];
  if (r.result === 'push') return ['🤝 Égalité · mise rendue', 'win', 'Vous avez tous les deux ' + r.ptotal + '.'];
  return ['Perdu · −' + ccn(r.stake), 'lose', r.ptotal > 21 ? 'Tu dépasses 21 : perdu.' : 'Le croupier fait ' + r.dtotal + ' contre ' + r.ptotal + '.'];
}
function blackjackPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('bj'), a = ccBal(), capped = CAS.today >= CAS_CAP;
  if (vip) { bjLoad(); if (!CAS.loaded) casinoLoad(); }
  var g = BJ.g, live = !!(g && !g.done), shownD = g ? g.dcards : [], shownP = g ? g.pcards : [];
  var dHTML = shownD.map(function(c, i){ return bjCard(c, i, i >= BJ.nD); }).join('') + (g && g.hidden ? bjBack() : '');
  var pHTML = shownP.map(function(c, i){ return bjCard(c, i, i >= BJ.nP); }).join('');
  var table = '<div class="bj-table"><div class="bj-seat"><div class="bj-who"><span class="bj-bot">🤖</span><b>Croupier Legacy</b><small>bot · tire jusqu\'à 17</small></div><div class="bj-hand">' + (dHTML || '<span class="bj-empty">Le croupier attend ta mise…</span>') + '</div>' +
    '<div class="bj-total">' + (g ? (g.hidden ? 'Carte visible' : 'Total ' + g.dtotal) : '') + '</div></div>' +
    '<div class="bj-felt-mid"><img src="logo.svg" alt="" width="46" height="46"><span>LEGACY BLACKJACK</span><small>Blackjack paye 6 pour 5 · le croupier reste sur 17</small></div>' +
    '<div class="bj-seat"><div class="bj-total">' + (g ? 'Ton total ' + g.ptotal : '') + '</div><div class="bj-hand">' + (pHTML || '<span class="bj-empty">Ta main apparaîtra ici</span>') + '</div>' +
    '<div class="bj-who"><span class="bj-bot">🧑</span><b>' + esc((me() || {}).pseudo || 'Toi') + '</b><small>' + (g ? 'mise ' + ccn(g.stake) : 'prêt ?') + '</small></div></div></div>';
  var side = '';
  if (BJ.res) { var t = bjResultText(BJ.res); side += '<div class="cas-res ' + t[1] + '"><span class="cas-ball ' + (t[1] === 'win' ? 'green' : 'red') + '">🃏</span><div><b>' + t[0] + '</b><small>' + t[2] + '</small></div></div>'; }
  if (live) {
    side += '<div class="bj-actions"><button type="button" class="btn primary lg" data-cas="bjhit"' + (BJ.busy ? ' disabled' : '') + '>🃏 TIRER</button><button type="button" class="btn lg bj-stand" data-cas="bjstand"' + (BJ.busy ? ' disabled' : '') + '>✋ RESTER</button>' +
      '<button type="button" class="btn lg" data-cas="bjdouble"' + (BJ.busy || !g.can_double || a < g.stake ? ' disabled' : '') + ' title="Tu doubles ta mise et tu reçois une seule carte">✖️2 DOUBLER</button></div>';
    side += '<p class="help">Mise en jeu : <b>' + ccn(g.stake) + '</b>. <b>Tirer</b> = une carte de plus · <b>Rester</b> = tu gardes ta main · <b>Doubler</b> = mise x2, une seule carte.</p>';
  } else {
    side += gStakeHTML('bj', vip, false);
    side += '<button type="button" class="btn primary lg cas-go" id="bj-start" data-cas="bjstart"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>🃏 DISTRIBUER · ' + ccn(st) + '</button>';
    side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  }
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<details class="bj-howto"><summary>❓ Comment jouer au blackjack ?</summary><ul class="cas-rules"><li>Le but : avoir <b>plus que le croupier sans dépasser 21</b>.</li><li>Les cartes de 2 à 10 valent leur chiffre, <b>J, Q, K valent 10</b>, l\'<b>As vaut 1 ou 11</b> (le mieux pour toi).</li><li>Tu reçois 2 cartes, le croupier en montre 1. <b>Tire</b> pour en demander une autre, <b>reste</b> quand ça te va.</li><li>Si tu dépasses 21, tu perds tout de suite.</li><li>Le croupier (un bot) tire jusqu\'à 17 puis s\'arrête.</li><li>Gagner = tu doubles ta mise. <b>Blackjack</b> (As + figure dès le départ) = x2,2. Égalité = mise rendue.</li></ul></details>';
  return casinoGameShell(vip, table, side);
}
function bjAnimNew(){   // petites cartes qui arrivent en glissant depuis le sabot
  var els = document.querySelectorAll('.bj-card[data-new]');
  [].forEach.call(els, function(el, k){
    var t0 = performance.now() + k * 230; el.style.opacity = '0';
    casLoop(function(now){
      var t = Math.max(0, Math.min(1, (now - t0) / 320)), e = 1 - Math.pow(1 - t, 3);
      el.style.opacity = t > 0 ? '1' : '0';
      el.style.transform = 'translate(' + ((1 - e) * 140) + 'px,' + (-(1 - e) * 90) + 'px) rotate(' + ((1 - e) * 24) + 'deg)';
      if (t === 0 && !el.__snd) { return false; }
      if (t > 0 && !el.__snd) { el.__snd = 1; tickSound(); }
      if (t >= 1) { el.style.transform = ''; return true; }
      return false;
    });
    el.removeAttribute('data-new');
  });
}
function bjApply(res){   // met à jour l'état puis redessine
  var wasP = BJ.g ? BJ.g.pcards.length : 0, wasD = BJ.g ? BJ.g.dcards.length : 0;
  BJ.nP = wasP; BJ.nD = res.hidden ? wasD : Math.min(wasD, 1);
  BJ.g = res; if (me() && res.balance != null) me().cc = Number(res.balance);
  if (res.done) { BJ.res = res; CAS.today = Number(res.today) || CAS.today; }
  render(); bjAnimNew();
  BJ.nP = res.pcards.length; BJ.nD = res.dcards.length;   // les cartes déjà posées ne rejouent pas l'animation
  if (res.done) {
    var win = res.result === 'win' || res.result === 'blackjack';
    setTimeout(function(){ if (win) winSound(res.result === 'blackjack' ? 5 : 2); else if (res.result === 'lose') beep(140, 0, 0.35, 'sawtooth', 0.12); }, 450);
    toast(res.result === 'push' ? 'Égalité : mise rendue' : win ? 'Gagné ! +' + ccn(res.net) : 'Perdu, retente ta chance !');
    BJ.g = res; refresh().then(render, render);
  }
}
function bjCall(fn, args, first){
  if (BJ.busy || !me() || !me().vip) return;
  BJ.busy = true; audio();
  sb.rpc(fn, args || {}).then(function(r){
    BJ.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    if (first) { BJ.res = null; BJ.g = null; BJ.nP = 0; BJ.nD = 0; }
    bjApply(r.data);
  });
}

/* =================== LEGACY MINER (jeu de mines 5x5) =================== */
function mnMult(m, k){
  if (k <= 0) return 1;
  var f = 1; for (var i = 0; i < k; i++) f *= (25 - i) / (25 - m - i);
  return Math.min(Math.round(0.96 * f * 10000) / 10000, 1000);
}
function mnTxt(x){ return 'x' + String(Math.round(x * 100) / 100).replace('.', ','); }
var MN = {n: 3, active: false, run: 1, rev: [], mult: 1, next: 1, mines: null, boom: -1, res: null, busy: false, loaded: false, loading: false, pop: -1};
function mnLoad(){
  if (MN.loaded || MN.loading || !S.me) return;
  MN.loading = true;
  sb.rpc('casino_mines_state').then(function(r){
    MN.loading = false; MN.loaded = true;
    var d = r.data;
    if (d) { MN.active = true; MN.n = Number(d.n_mines) || 3; MN.run = Number(d.stake) || 1; MN.rev = d.revealed || []; MN.mult = Number(d.mult) || 1; MN.next = Number(d.next) || 1; }
    if (viewName() === 'casino' && CAS.game === 'mines') render();
  }).catch(function(){ MN.loading = false; MN.loaded = true; });
}
function minesPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('mn'), a = ccBal(), capped = CAS.today >= CAS_CAP;
  if (vip) { mnLoad(); if (!CAS.loaded) casinoLoad(); }
  var tiles = '', i;
  for (i = 0; i < 25; i++) {
    var rev = MN.rev.indexOf(i) >= 0, isMine = MN.mines && MN.mines.indexOf(i) >= 0;
    if (rev) tiles += '<button type="button" class="mn-tile safe" disabled' + (MN.pop === i ? ' data-pop="1"' : '') + '><span>💎</span></button>';
    else if (isMine) tiles += '<button type="button" class="mn-tile mine' + (MN.boom === i ? ' boom' : '') + '" disabled><span>💣</span></button>';
    else if (MN.mines) tiles += '<button type="button" class="mn-tile ghost" disabled><span>💎</span></button>';
    else tiles += '<button type="button" class="mn-tile" ' + (MN.active ? 'data-cas="mnpick:' + i + '"' + (MN.busy ? ' disabled' : '') : 'disabled') + '><span>?</span></button>';
  }
  var maxM = mnMult(MN.n, 25 - MN.n), cur = MN.active ? Math.round(MN.run * MN.mult * 100) / 100 : 0;
  var scene = '<div class="mn-scene"><div class="mn-title"><span class="g">LEGACY</span> <span class="s">MINER</span><i class="mn-ball" aria-hidden="true">💣</i></div>' +
    '<div class="mn-board"><div class="mn-grid" id="mn-grid">' + tiles + '</div></div>' +
    '<div class="mn-hud"><span>' + (MN.active ? 'Mise ' + ccn(MN.run) + ' · ' + MN.n + ' mine' + (MN.n > 1 ? 's' : '') : 'Choisis ta mise et tes mines') + '</span><b>' + mnTxt(MN.active ? MN.mult : 1) + '</b><span>' + (MN.active ? 'Prochaine case ' + mnTxt(MN.next) : 'Gain max ' + mnTxt(maxM)) + '</span></div></div>';
  var side = '';
  if (MN.res) {
    var r = MN.res;
    side += '<div class="cas-res ' + (r.boom ? 'lose' : 'win') + '"><span class="cas-ball ' + (r.boom ? 'red' : 'green') + '">' + (r.boom ? '💥' : '💎') + '</span><div><b>' + (r.boom ? 'BOUM ! −' + ccn(r.stake) : '🎉 Encaissé · +' + ccn(r.net)) + '</b><small>' + (r.boom ? 'Tu es tombé sur une mine.' : 'Tu repars avec ' + mnTxt(r.mult) + ' (' + ccn(r.payout) + ').') + '</small></div></div>';
  }
  if (MN.active) {
    side += '<button type="button" class="btn lg cas-cash" data-cas="mncash"' + (MN.busy || !MN.rev.length ? ' disabled' : '') + '>💰 ENCAISSER · ' + ccn(cur) + '</button>';
    side += '<p class="help">Ouvre des cases : chaque 💎 augmente ton gain. Si tu tombes sur une 💣, tu perds ta mise. Encaisse quand tu veux, dès la 1re case.</p>';
  } else {
    side += '<button type="button" class="btn primary lg cas-go mn-play" id="mn-start" data-cas="mnstart"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>⛏️ JOUER · ' + ccn(st) + '</button>';
    side += gStakeHTML('mn', vip, false);
    side += '<div class="mn-step"><span>MINES</span><div class="mn-stepper"><button type="button" data-cas="mn:min"' + (vip ? '' : ' disabled') + '>MIN</button><button type="button" data-cas="mn:dec"' + (vip ? '' : ' disabled') + '>−</button><b>' + MN.n + '</b><button type="button" data-cas="mn:inc"' + (vip ? '' : ' disabled') + '>+</button><button type="button" data-cas="mn:max"' + (vip ? '' : ' disabled') + '>MAX</button></div></div>';
    side += '<p class="help mn-note">Avec ce nombre de mines, le gain maximum est <b>' + ccn(Math.round(st * maxM * 100) / 100) + '</b> (' + mnTxt(maxM) + ').</p>';
    side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  }
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<ul class="cas-rules"><li>La grille cache <b>1 à 24 mines</b> sur 25 cases. Plus il y a de mines, plus chaque case rapporte.</li><li>Chaque case sûre (💎) multiplie ta mise. Une mine (💣) fait tout perdre.</li><li>Les mines sont placées par le serveur au début de la partie : impossible de tricher.</li><li>Retour moyen d\'environ 96 %. Jeu 100 % virtuel, sans valeur réelle.</li></ul>';
  return casinoGameShell(vip, scene, side);
}
function mnAnim(){
  var pop = document.querySelector('.mn-tile[data-pop]');
  if (pop) {
    var t0 = performance.now(); pop.removeAttribute('data-pop');
    casLoop(function(now){ var t = Math.min(1, (now - t0) / 320), s = t < 0.6 ? 0.55 + t / 0.6 * 0.6 : 1.15 - (t - 0.6) / 0.4 * 0.15; pop.style.transform = 'scale(' + s + ')'; if (t >= 1) { pop.style.transform = ''; return true; } return false; });
  }
}
function mnShake(){
  var g = document.getElementById('mn-grid'); if (!g) return;
  var t0 = performance.now();
  casLoop(function(now){ var t = Math.min(1, (now - t0) / 450); g.style.transform = 'translate(' + (Math.sin(t * 40) * 9 * (1 - t)) + 'px,' + (Math.cos(t * 33) * 5 * (1 - t)) + 'px)'; if (t >= 1) { g.style.transform = ''; return true; } return false; });
}
function mnStart(){
  if (MN.active || MN.busy || !me() || !me().vip) return;
  var st = gStakeVal('mn'); MN.busy = true; audio();
  sb.rpc('casino_mines_start', {p_stake: st, p_mines: MN.n}).then(function(r){
    MN.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var d = r.data; MN.active = true; MN.run = Number(d.stake); MN.rev = []; MN.mult = 1; MN.next = Number(d.next) || 1; MN.mines = null; MN.boom = -1; MN.res = null;
    if (me()) me().cc = Number(d.balance);
    render();
  });
}
function mnPick(i){
  if (!MN.active || MN.busy || MN.rev.indexOf(i) >= 0) return;
  MN.busy = true; audio();
  sb.rpc('casino_mines_pick', {p_cell: i}).then(function(r){
    MN.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var d = r.data;
    if (d.boom) {
      MN.mines = d.mines; MN.rev = d.revealed || []; MN.boom = d.cell; MN.active = false; MN.res = {boom: true, stake: MN.run};
      if (me()) me().cc = Number(d.balance);
      render(); mnShake(); beep(120, 0, 0.5, 'sawtooth', 0.16); beep(70, 0.06, 0.55, 'square', 0.1);
      toast('BOUM ! Tu perds ' + ccn(MN.run)); refresh().then(render, render); return;
    }
    MN.rev = d.revealed; MN.mult = Number(d.mult); MN.next = Number(d.next) || MN.next; MN.pop = d.cell;
    if (me()) me().cc = Number(d.balance);
    if (d.done) {
      MN.active = false; MN.mines = d.mines; MN.res = {boom: false, mult: Number(d.mult), payout: d.payout, net: d.net}; CAS.today = Number(d.today) || CAS.today;
      winSound(5); toast('Grille nettoyée ! +' + ccn(d.net));
    } else beep(520 + MN.rev.length * 45, 0, 0.14, 'triangle', 0.12);
    render(); mnAnim(); MN.pop = -1;
    if (d.done) refresh().then(render, render);
  });
}
function mnCash(){
  if (!MN.active || MN.busy || !MN.rev.length) return;
  MN.busy = true; audio();
  sb.rpc('casino_mines_cashout').then(function(r){
    MN.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var d = r.data; MN.active = false; MN.mines = d.mines; MN.res = {boom: false, mult: Number(d.mult), payout: d.payout, net: d.net};
    if (me()) me().cc = Number(d.balance); CAS.today = Number(d.today) || CAS.today;
    winSound(d.mult >= 3 ? 4 : 2); toast('Encaissé ! +' + ccn(d.net));
    render(); refresh().then(render, render);
  });
}

/* =================== PLINKO =================== */
var PL_T = {low: [8.5, 3, 1.6, 1.3, 1.1, 0.9, 0.5, 0.9, 1.1, 1.3, 1.6, 3, 8.5], med: [28, 10, 4, 1.9, 1.1, 0.6, 0.3, 0.6, 1.1, 1.9, 4, 10, 28], high: [140, 22, 8, 1.9, 0.7, 0.2, 0.2, 0.2, 0.7, 1.9, 8, 22, 140]};
var PL_NAME = {low: 'Faible', med: 'Moyen', high: 'Élevé'};
var PL = {risk: 'med', busy: false, hist: [], res: null, hit: -1};
var PL_CX = 320, PL_DX = 40, PL_Y0 = 46, PL_DY = 33;
function plColor(m){ return m >= 10 ? '#ff4d5a' : m >= 3 ? '#ff9a3c' : m >= 1.5 ? '#ffd84a' : m >= 1 ? '#8be28b' : '#6f86a8'; }
function plMulTxt(m){ return String(m).replace('.', ',') + 'x'; }
function plinkoPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('plk'), a = ccBal(), capped = CAS.today >= CAS_CAP, tbl = PL_T[PL.risk], i, j, pegs = '', buckets = '';
  if (vip && !CAS.loaded) casinoLoad();
  for (i = 0; i < 12; i++) for (j = 0; j <= i; j++) pegs += '<circle cx="' + (PL_CX + (j - i / 2) * PL_DX) + '" cy="' + (PL_Y0 + i * PL_DY) + '" r="3.6" fill="#dfe8ff" opacity=".9"/>';
  for (i = 0; i <= 12; i++) {
    var bx = PL_CX + (i - 6) * PL_DX, by = PL_Y0 + 12 * PL_DY - 4;
    buckets += '<g class="plk-b' + (PL.hit === i ? ' hit' : '') + '" id="plk-b' + i + '"><rect x="' + (bx - 18) + '" y="' + by + '" width="36" height="28" rx="6" fill="' + plColor(tbl[i]) + '"/><text x="' + bx + '" y="' + (by + 19) + '" text-anchor="middle" font-size="' + (tbl[i] >= 100 ? 10 : 11.5) + '" font-weight="800" fill="#10131f">' + plMulTxt(tbl[i]) + '</text></g>';
  }
  var board = '<div class="plk-scene"><svg viewBox="0 0 640 500" class="plk-svg" role="img" aria-label="Plateau de Plinko">' + pegs + buckets + '<circle id="plk-ball" cx="' + PL_CX + '" cy="12" r="8" fill="#fff" stroke="#8b5cff" stroke-width="3" opacity="' + (PL.busy ? 1 : 0.0) + '"/></svg>' +
    '<div class="plk-hist"><small>Dernières billes</small><div>' + (PL.hist.length ? PL.hist.map(function(m){ return '<span style="background:' + plColor(m) + '">' + plMulTxt(m) + '</span>'; }).join('') : '<em>Aucune bille pour le moment.</em>') + '</div></div></div>';
  var side = '';
  if (PL.res) { var r = PL.res, win = r.net > 0; side += '<div class="cas-res ' + (win ? 'win' : 'lose') + '"><span class="cas-ball ' + (win ? 'green' : 'red') + '">🔻</span><div><b>' + (win ? '🎉 +' + ccn(r.net) : r.net === 0 ? 'Mise récupérée' : 'Perdu · −' + ccn(Math.abs(r.net))) + '</b><small>Case ' + plMulTxt(r.mult) + ' · mise ' + ccn(r.stake) + '</small></div></div>'; }
  side += '<div class="cas-stakes" role="group" aria-label="Niveau de risque"><span>Risque</span>' + ['low', 'med', 'high'].map(function(k){ return '<button type="button" class="cas-chip' + (PL.risk === k ? ' sel' : '') + '" data-cas="plkrisk:' + k + '"' + (!vip || PL.busy ? ' disabled' : '') + '>' + PL_NAME[k] + '</button>'; }).join('') + '</div>';
  side += gStakeHTML('plk', vip, PL.busy);
  side += '<button type="button" class="btn primary lg cas-go" id="plk-go" data-cas="plkgo"' + (!vip || PL.busy || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>🔻 LÂCHER LA BILLE · ' + ccn(st) + '</button>';
  side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<ul class="cas-rules"><li>Ta bille rebondit sur 12 rangées de clous et tombe dans une case : le multiplicateur de la case multiplie ta mise.</li><li><b>Risque faible</b> : gains réguliers. <b>Élevé</b> : souvent perdu, mais jusqu\'à <b>x140</b> sur les bords.</li><li>Le chemin est tiré par le serveur : impossible de tricher.</li><li>Retour moyen d\'environ 95 %. Jeu 100 % virtuel.</li></ul>';
  return casinoGameShell(vip, board, side);
}
function plinkoDrop(){
  if (PL.busy || spinLock || !me() || !me().vip) return;
  var st = gStakeVal('plk'), risk = PL.risk; audio(); PL.busy = true; PL.hit = -1;
  var btn = document.getElementById('plk-go'); if (btn) { btn.disabled = true; btn.textContent = 'La bille tombe…'; }
  sb.rpc('casino_plinko', {p_stake: st, p_risk: risk}).then(function(r){
    if (r.error) { PL.busy = false; toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    var res = r.data, ball = document.getElementById('plk-ball'), pts = [], R = 0, i;
    spinLock = true;
    pts.push({x: PL_CX, y: 14});
    for (i = 0; i < 12; i++) { pts.push({x: PL_CX + (R - i / 2) * PL_DX, y: PL_Y0 + i * PL_DY - 11}); R += res.path[i]; }
    pts.push({x: PL_CX + (R - 6) * PL_DX, y: PL_Y0 + 12 * PL_DY + 10});
    if (ball) ball.setAttribute('opacity', '1');
    var seg = 0, SEG = 92;
    function finish(){
      PL.busy = false; PL.res = res; PL.hit = res.bucket; PL.hist.unshift(Number(res.mult)); PL.hist = PL.hist.slice(0, 12);
      CAS.today = Number(res.today) || 0; if (me()) me().cc = Number(res.balance);
      var bk = document.getElementById('plk-b' + res.bucket); if (bk) bk.classList.add('hit');
      if (res.net > 0) winSound(res.mult >= 10 ? 5 : res.mult >= 3 ? 3 : 2); else beep(180, 0, 0.25, 'triangle', 0.1);
      setTimeout(function(){
        spinLock = false; toast(res.net > 0 ? 'Gagné ! +' + ccn(res.net) : res.net === 0 ? 'Mise récupérée' : 'Perdu, retente ta chance !');
        refresh().then(render, render);
      }, 450);
    }
    (function nextSeg(){
      if (seg >= pts.length - 1) { finish(); return; }
      var a0 = pts[seg], b0 = pts[seg + 1], t0 = performance.now();
      casLoop(function(now){
        var t = Math.min(1, (now - t0) / SEG), e = t * t * (3 - 2 * t);
        if (ball) { ball.setAttribute('cx', a0.x + (b0.x - a0.x) * e); ball.setAttribute('cy', a0.y + (b0.y - a0.y) * t - Math.sin(Math.PI * t) * 9); }
        if (t >= 1) { tickSound(); seg++; nextSeg(); return true; }
        return false;
      });
    })();
  });
}

/* =================== HI-LO =================== */
var HL = {g: null, hist: [], res: null, busy: false, loaded: false, loading: false, n: 0};
function hlLoad(){
  if (HL.loaded || HL.loading || !S.me) return;
  HL.loading = true;
  sb.rpc('casino_hilo_state').then(function(r){
    HL.loading = false; HL.loaded = true; if (r.data) { HL.g = r.data; HL.hist = []; }
    if (viewName() === 'casino' && CAS.game === 'hilo') render();
  }).catch(function(){ HL.loading = false; HL.loaded = true; });
}
function hiloPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('hl'), a = ccBal(), capped = CAS.today >= CAS_CAP, g = HL.g, live = !!(g && !g.over);
  if (vip) { hlLoad(); if (!CAS.loaded) casinoLoad(); }
  var rank = g ? g.card % 13 + 1 : 0;
  var cards = '<div class="hl-table"><div class="hl-hist">' + HL.hist.slice(-6).map(function(c){ return bjCard(c, 0, false); }).join('') + '</div><div class="hl-main">' +
    (g ? bjCard(g.card, 0, HL.n >= 0 && HL.fresh) : '<div class="bj-card back"><img src="logo.svg" alt="" width="40" height="40"></div>') +
    '<div class="hl-next"><div class="bj-card back"><img src="logo.svg" alt="" width="34" height="34"></div></div></div>' +
    '<div class="hl-info">' + (live ? 'Gain actuel <b>' + ccn(Math.round(g.stake * g.mult * 100) / 100) + '</b> · ' + mnTxt(g.mult) : g ? 'Dernière carte tirée' : 'Devine si la prochaine carte sera plus haute ou plus basse') + '</div></div>';
  var side = '';
  if (HL.res) { var r = HL.res; side += '<div class="cas-res ' + (r.won ? 'win' : 'lose') + '"><span class="cas-ball ' + (r.won ? 'green' : 'red') + '">' + (r.won ? '💰' : '✖') + '</span><div><b>' + (r.won ? '🎉 Encaissé · +' + ccn(r.net) : 'Raté · −' + ccn(r.stake)) + '</b><small>' + (r.won ? 'Tu repars avec ' + mnTxt(r.mult) + '.' : 'La carte n\'était pas la bonne (égalité = perdu).') + '</small></div></div>'; }
  if (live) {
    var pHi = Math.round((13 - rank) / 13 * 100), pLo = Math.round((rank - 1) / 13 * 100);
    side += '<div class="hl-btns"><button type="button" class="btn primary lg" data-cas="hlhi"' + (HL.busy || !g.m_hi ? ' disabled' : '') + '>⬆️ PLUS HAUT<small>' + (g.m_hi ? pHi + ' % · ' + mnTxt(g.m_hi) + ' par pas' : 'impossible') + '</small></button>' +
      '<button type="button" class="btn lg hl-lo" data-cas="hllo"' + (HL.busy || !g.m_lo ? ' disabled' : '') + '>⬇️ PLUS BAS<small>' + (g.m_lo ? pLo + ' % · ' + mnTxt(g.m_lo) + ' par pas' : 'impossible') + '</small></button></div>';
    side += '<button type="button" class="btn lg cas-cash" data-cas="hlcash"' + (HL.busy || g.steps < 1 ? ' disabled' : '') + '>💰 ENCAISSER · ' + ccn(Math.round(g.stake * g.mult * 100) / 100) + '</button>';
    side += '<p class="help">Mise en jeu : <b>' + ccn(g.stake) + '</b> · cartes devinées : <b>' + g.steps + '</b>. Une égalité fait perdre.</p>';
  } else {
    side += gStakeHTML('hl', vip, false);
    side += '<button type="button" class="btn primary lg cas-go" id="hl-start" data-cas="hlstart"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>↕️ JOUER · ' + ccn(st) + '</button>';
    side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  }
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<ul class="cas-rules"><li>Une carte est tirée. Devine si la <b>suivante sera plus haute ou plus basse</b> (As = la plus basse, Roi = la plus haute).</li><li>Plus ton choix est risqué, plus il rapporte. Chaque bonne réponse multiplie ton gain.</li><li>Encaisse quand tu veux, dès la 1re bonne réponse. Une égalité = perdu.</li><li>Les cartes sont tirées par le serveur. Jeu 100 % virtuel.</li></ul>';
  return casinoGameShell(vip, cards, side);
}
function hlApply(res, first){
  var prev = HL.g ? HL.g.card : null;
  if (first) { HL.hist = []; HL.res = null; }
  else if (prev != null) HL.hist.push(prev);
  HL.fresh = true; HL.n = 0;
  if (res.balance != null && me()) me().cc = Number(res.balance);
  if (res.correct === false) {
    HL.g = {card: res.card, mult: 1, steps: res.steps, stake: res.stake, over: true}; HL.res = {won: false, stake: res.stake};
    render(); bjAnimNew(); beep(140, 0, 0.35, 'sawtooth', 0.12); toast('Raté ! Tu perds ' + ccn(res.stake)); refresh().then(render, render); return;
  }
  HL.g = res; if (res.done) { HL.res = {won: true, mult: res.mult, net: res.net, payout: res.payout}; CAS.today = Number(res.today) || CAS.today; HL.g.over = true; winSound(5); toast('Maximum atteint ! +' + ccn(res.net)); }
  else if (!first) winSound(0);
  render(); bjAnimNew(); HL.fresh = false;
  if (res.done) refresh().then(render, render);
}
function hlCall(fn, args, first){
  if (HL.busy || !me() || !me().vip) return;
  HL.busy = true; audio();
  sb.rpc(fn, args || {}).then(function(r){
    HL.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    if (fn === 'casino_hilo_cashout') { var d = r.data; HL.g.over = true; HL.res = {won: true, mult: d.mult, net: d.net, payout: d.payout}; if (me()) me().cc = Number(d.balance); CAS.today = Number(d.today) || CAS.today; winSound(d.mult >= 3 ? 4 : 2); toast('Encaissé ! +' + ccn(d.net)); render(); refresh().then(render, render); return; }
    hlApply(r.data, first);
  });
}

/* =================== TOWER =================== */
var TW_CFG = {easy: [4, 1, 'Facile', '4 cases, 1 piège'], medium: [3, 1, 'Moyen', '3 cases, 1 piège'], hard: [2, 1, 'Difficile', '2 cases, 1 piège'], expert: [3, 2, 'Expert', '3 cases, 2 pièges']};
function twMult(d, l){ if (l <= 0) return 1; var c = TW_CFG[d]; return Math.min(Math.round(0.96 * Math.pow(c[0] / (c[0] - c[1]), l) * 10000) / 10000, 1000); }
var TW = {diff: 'medium', active: false, tiles: 3, level: 0, mult: 1, stake: 1, picks: [], traps: null, res: null, busy: false, loaded: false, loading: false};
function twLoad(){
  if (TW.loaded || TW.loading || !S.me) return;
  TW.loading = true;
  sb.rpc('casino_tower_state').then(function(r){
    TW.loading = false; TW.loaded = true; var d = r.data;
    if (d) { TW.active = true; TW.diff = d.diff; TW.tiles = Number(d.tiles); TW.level = Number(d.level); TW.mult = Number(d.mult); TW.stake = Number(d.stake); TW.picks = []; TW.traps = null; }
    if (viewName() === 'casino' && CAS.game === 'tower') render();
  }).catch(function(){ TW.loading = false; TW.loaded = true; });
}
function towerPage(){
  var vip = !!(me() && me().vip), st = gStakeVal('tw'), a = ccBal(), capped = CAS.today >= CAS_CAP, cfg = TW_CFG[TW.diff], tiles = TW.active || TW.traps ? TW.tiles : cfg[0], f, k;
  if (vip) { twLoad(); if (!CAS.loaded) casinoLoad(); }
  var rows = '';
  for (f = 8; f >= 1; f--) {
    var done = f <= TW.level, cur = TW.active && f === TW.level + 1, tr = TW.traps ? TW.traps[f - 1] : null, cells = '';
    for (k = 0; k < tiles; k++) {
      var picked = TW.picks[f - 1] === k, isTrap = tr && tr.indexOf(k) >= 0;
      if (isTrap) cells += '<button type="button" class="tw-tile trap' + (TW.boomLevel === f && TW.boomTile === k ? ' boom' : '') + '" disabled><span>💣</span></button>';
      else if (picked && done) cells += '<button type="button" class="tw-tile safe" disabled><span>💎</span></button>';
      else if (tr) cells += '<button type="button" class="tw-tile ghost" disabled><span>💎</span></button>';
      else if (cur) cells += '<button type="button" class="tw-tile cur" data-cas="twpick:' + k + '"' + (TW.busy ? ' disabled' : '') + '><span>?</span></button>';
      else cells += '<button type="button" class="tw-tile" disabled><span>' + (done ? '·' : '?') + '</span></button>';
    }
    rows += '<div class="tw-row' + (cur ? ' now' : '') + (done ? ' done' : '') + '"><b class="tw-mult">' + mnTxt(twMult(TW.diff, f)) + '</b><div class="tw-cells" style="grid-template-columns:repeat(' + tiles + ',1fr)">' + cells + '</div></div>';
  }
  var scene = '<div class="tw-scene"><div class="mn-title"><span class="g">LEGACY</span> <span class="s">TOWER</span><i class="mn-ball" aria-hidden="true">🗼</i></div><div class="tw-tower">' + rows + '</div></div>';
  var side = '';
  if (TW.res) { var r = TW.res; side += '<div class="cas-res ' + (r.boom ? 'lose' : 'win') + '"><span class="cas-ball ' + (r.boom ? 'red' : 'green') + '">' + (r.boom ? '💥' : '🗼') + '</span><div><b>' + (r.boom ? 'Piège ! −' + ccn(r.stake) : '🎉 Encaissé · +' + ccn(r.net)) + '</b><small>' + (r.boom ? 'Tu étais à l\'étage ' + r.level + '.' : 'Étage ' + r.level + ' · ' + mnTxt(r.mult) + ' (' + ccn(r.payout) + ')') + '</small></div></div>'; }
  if (TW.active) {
    side += '<button type="button" class="btn lg cas-cash" data-cas="twcash"' + (TW.busy || TW.level < 1 ? ' disabled' : '') + '>💰 ENCAISSER · ' + ccn(Math.round(TW.stake * TW.mult * 100) / 100) + '</button>';
    side += '<p class="help">Étage <b>' + TW.level + '/8</b> · prochain <b>' + mnTxt(twMult(TW.diff, TW.level + 1)) + '</b> · mise ' + ccn(TW.stake) + '. Choisis une case de l\'étage en surbrillance : l\'une cache un piège.</p>';
  } else {
    side += '<button type="button" class="btn primary lg cas-go mn-play" id="tw-start" data-cas="twstart"' + (!vip || !(st >= 0.01) || a < st || capped ? ' disabled' : '') + '>🗼 GRIMPER · ' + ccn(st) + '</button>';
    side += gStakeHTML('tw', vip, false);
    side += '<div class="cas-stakes" role="group" aria-label="Difficulté"><span>Niveau</span>' + Object.keys(TW_CFG).map(function(d){ return '<button type="button" class="cas-chip' + (TW.diff === d ? ' sel' : '') + '" data-cas="twdiff:' + d + '"' + (vip ? '' : ' disabled') + ' title="' + TW_CFG[d][3] + '">' + TW_CFG[d][2] + '</button>'; }).join('') + '</div>';
    side += '<p class="help">' + cfg[3] + ' par étage · sommet <b>' + mnTxt(twMult(TW.diff, 8)) + '</b> (' + ccn(Math.round(st * twMult(TW.diff, 8) * 100) / 100) + ').</p>';
    side += capped ? '<p class="help cas-warn">Plafond de gains du jour atteint : le casino rouvre demain à minuit.</p>' : a < st ? '<p class="help cas-warn">Pas assez de V-Coins pour cette mise.</p>' : '';
  }
  side += '<div class="cas-meter" title="Bénéfice net du jour"><div class="cas-meter-top"><span>Gains du jour</span><b>' + (CAS.today > 0 ? '+' : CAS.today < 0 ? '−' : '') + ccn(Math.abs(CAS.today)) + ' / ' + ccn(CAS_CAP) + '</b></div><div class="cas-bar"><i style="width:' + Math.max(0, Math.min(100, CAS.today / CAS_CAP * 100)) + '%"></i></div></div>';
  side += '<ul class="cas-rules"><li>Tu montes une tour de <b>8 étages</b>. À chaque étage, choisis une case : une (ou deux) cache un <b>piège</b>.</li><li>Étage réussi = ton gain monte. Piège = tu perds ta mise.</li><li>Encaisse quand tu veux, dès le 1er étage. Au sommet, c\'est automatique.</li><li>Les pièges sont placés par le serveur dès le départ. Retour moyen d\'environ 96 %.</li></ul>';
  return casinoGameShell(vip, scene, side);
}
function twApply(d, first){
  if (first) { TW.active = true; TW.diff = d.diff; TW.tiles = Number(d.tiles); TW.level = 0; TW.mult = 1; TW.stake = Number(d.stake); TW.picks = []; TW.traps = null; TW.res = null; TW.boomLevel = -1; TW.boomTile = -1; }
}
function twCall(fn, args, onOk){
  if (TW.busy || !me() || !me().vip) return;
  TW.busy = true; audio();
  sb.rpc(fn, args || {}).then(function(r){
    TW.busy = false;
    if (r.error) { toast(cleanErr(r.error.message)); refresh().then(render, render); return; }
    if (r.data && r.data.balance != null && me()) me().cc = Number(r.data.balance);
    onOk(r.data);
  });
}
function twStart(){ twCall('casino_tower_start', {p_stake: gStakeVal('tw'), p_diff: TW.diff}, function(d){ twApply(d, true); render(); }); }
function twPick(k){
  if (!TW.active) return;
  twCall('casino_tower_pick', {p_tile: k}, function(d){
    if (d.boom) {
      TW.active = false; TW.traps = d.traps; TW.boomLevel = TW.level + 1; TW.boomTile = d.tile; TW.res = {boom: true, stake: TW.stake, level: TW.level};
      render(); beep(120, 0, 0.5, 'sawtooth', 0.16); beep(70, 0.06, 0.55, 'square', 0.1); toast('Piège ! Tu perds ' + ccn(TW.stake)); refresh().then(render, render); return;
    }
    TW.picks[TW.level] = d.tile; TW.level = d.level; TW.mult = Number(d.mult);
    if (d.done) { TW.active = false; TW.traps = d.traps; TW.res = {boom: false, level: d.level, mult: Number(d.mult), payout: d.payout, net: d.net}; CAS.today = Number(d.today) || CAS.today; winSound(5); toast('Sommet atteint ! +' + ccn(d.net)); }
    else beep(480 + d.level * 55, 0, 0.14, 'triangle', 0.12);
    render(); if (d.done) refresh().then(render, render);
  });
}
function twCash(){
  if (!TW.active || TW.level < 1) return;
  twCall('casino_tower_cashout', {}, function(d){
    TW.active = false; TW.traps = d.traps; TW.res = {boom: false, level: d.level, mult: Number(d.mult), payout: d.payout, net: d.net}; CAS.today = Number(d.today) || CAS.today;
    winSound(d.mult >= 3 ? 4 : 2); toast('Encaissé ! +' + ccn(d.net)); render(); refresh().then(render, render);
  });
}

/* ---------- tournois ---------- */
var tourId = null;
var TOUR_STATUS = {registration: ['Inscriptions ouvertes', 'open'], running: ['En cours', 'live'], done: ['Terminé', 'done'], cancelled: ['Annulé', 'cancelled']};
function tourPot(x){ return Number(x.entry_fee) * x.players.length + Number(x.prize_bonus); }
function tournamentsHTML(){
  if (customId && S.customs && S.customs[customId]) return customDetailHTML(S.customs[customId]);
  if (tourId && S.tours && S.tours[tourId]) return tourDetailHTML(S.tours[tourId]);
  return '<section class="hero"><div><p class="eyebrow">Compétition</p><h1>Les tournois Legacy.</h1><p class="lead">Deux façons de t\'affronter : des <b>parties perso</b> en gros lobby, ou des <b>tournois 1v1</b> en élimination directe. Choisis ton format ci-dessous.</p></div></section>' + customsSectionHTML() + toursSectionHTML();
}
function tourEmptyHTML(ic, label){
  return '<div class="empty tour-empty"><b>' + ic + ' ' + label + '</b>Les prochains seront annoncés ici et sur le Discord.' + (S.players && me() ? '<div style="margin-top:14px">' + dcBtn('Suivre les annonces sur le Discord') + '</div>' : '') + '</div>';
}
function toursSectionHTML(){
  var all = Object.keys(S.tours || {}).map(function(k){ return S.tours[k]; });
  var active = all.filter(function(x){ return x.status === 'registration' || x.status === 'running'; });
  var done = all.filter(function(x){ return x.status === 'done' || (x.status === 'cancelled' && canTourney()); });
  active.sort(function(a, b){ return ({running:0,registration:1})[a.status] - ({running:0,registration:1})[b.status] || Date.parse(b.created_at) - Date.parse(a.created_at); });
  done.sort(function(a, b){ return Date.parse(b.created_at) - Date.parse(a.created_at); });
  var html = '<section class="fmt-head g-1v1"><div class="fmt-ic">⚔️</div><div class="fmt-txt"><h2 class="sec">Tournois 1v1</h2><p class="help">Des duels en élimination directe jusqu\'à la finale. Le gagnant rafle toute la cagnotte.</p></div>' + (canTourney() ? '<button class="btn primary" data-act="tour-new">+ Créer</button>' : '') + '</section>';
  if (!active.length && !done.length) return html + tourEmptyHTML('🏆', 'Aucun tournoi 1v1 pour l\'instant');
  html += active.length ? '<div class="tour-grid">' + active.map(tourCardHTML).join('') + '</div>' : '<p class="muted-line">Aucun tournoi 1v1 en ce moment.</p>';
  if (done.length) html += '<details class="done-wrap"' + (active.length ? '' : ' open') + '><summary>🏁 Tournois terminés (' + done.length + ')</summary><div class="tour-grid">' + done.map(tourCardHTML).join('') + '</div></details>';
  return html;
}
function tourCardHTML(x){
  var st = TOUR_STATUS[x.status], inT = x.players.some(function(p){ return p.player === S.me; }), pct = Math.round(x.players.length / x.max_players * 100);
  return '<article class="tour-card t-' + x.status + '" data-act="open-tour" data-id="' + esc(x.id) + '" tabindex="0" role="button"><div class="tc-top"><span class="chip ' + st[1] + '">' + st[0] + '</span>' + (inT ? '<span class="fr-tag ok">✓ Inscrit</span>' : '') + '</div>' +
    '<h3>' + esc(x.name) + '</h3>' +
    '<div class="cust-chips"><span class="cchip c-1v1">⚔️ 1v1</span><span class="cchip">' + esc(x.mode) + '</span><span class="cchip">' + esc(BO_LABEL[x.bo] || x.bo) + '</span>' + (x.pingpong ? '<span class="cchip">ping-pong</span>' : '') + '</div>' +
    (x.status === 'registration' ? '<div class="cust-bar"><i style="width:' + pct + '%"></i></div>' : '') +
    '<div class="tc-facts"><div><b>' + x.players.length + '/' + x.max_players + '</b><span>Joueurs</span></div><div><b>' + (Number(x.entry_fee) > 0 ? fmt(x.entry_fee) : 'Gratuit') + '</b><span>Inscription</span></div><div><b class="gold">' + fmt(tourPot(x)) + '</b><span>Cagnotte</span></div></div>' +
    (x.starts_at && x.status !== 'done' ? '<p class="help">📅 ' + new Date(x.starts_at).toLocaleString('fr-FR', {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'}) + '</p>' : '') +
    (x.status === 'done' && x.winner ? '<div class="tc-champ">' + av(P(x.winner), 'sm') + '<div><b>🏆 ' + nm(P(x.winner)) + '</b><span>Champion · ' + cn(tourPot(x)) + '</span></div></div>' : '') + '</article>';
}
function tourDetailHTML(x){
  var st = TOUR_STATUS[x.status], inT = x.players.some(function(p){ return p.player === S.me; }), full = x.players.length >= x.max_players, id = esc(x.id);
  var html = '<button class="btn sm ghost back" data-act="tour-back">← Tous les tournois</button>';
  html += '<section class="mhead"><div><p class="eyebrow">Tournoi · <span class="chip ' + st[1] + '" style="margin:0">' + st[0] + '</span></p><h1>' + esc(x.name) + '</h1></div></section>';
  html += '<section class="tour-info"><div><b>' + esc(x.mode) + '</b><span>1v1 · ' + esc(BO_LABEL[x.bo] || x.bo) + (x.pingpong ? ' · ping-pong' : '') + '</span></div><div><b>' + x.players.length + '/' + x.max_players + '</b><span>Joueurs inscrits</span></div><div><b>' + (Number(x.entry_fee) > 0 ? cn(x.entry_fee) : 'Gratuit') + '</b><span>Inscription</span></div><div><b class="gold">' + cn(tourPot(x)) + '</b><span>Cagnotte du gagnant</span></div>' +
    (x.starts_at ? '<div><b>' + new Date(x.starts_at).toLocaleString('fr-FR', {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) + '</b><span>Début</span></div>' : '') + '</section>';
  if (x.rules) html += '<section class="panel"><h2>Règles</h2><p style="white-space:pre-wrap">' + esc(x.rules) + '</p></section>';
  // actions joueur
  if (x.status === 'registration') {
    html += '<section class="panel"><h2>Inscription</h2>' + (inT
      ? '<p>✓ Tu es inscrit. Le fondateur lancera le tournoi et tirera l\'arbre au sort.</p><div class="actions"><button class="btn danger" data-act="tour-leave" data-id="' + id + '">Me désinscrire' + (Number(x.entry_fee) > 0 ? ' (remboursé)' : '') + '</button></div>'
      : full ? '<p>Le tournoi est complet.</p>'
      : '<p>Les gagnants avancent jusqu\'à la finale. Le vainqueur remporte <b>' + cn(tourPot(x) + Number(x.entry_fee)) + '</b> si tu t\'inscris.</p><div class="actions"><button class="btn primary lg" data-act="tour-join" data-id="' + id + '"' + (avail(S.me) < Number(x.entry_fee) ? ' disabled' : '') + '>S\'inscrire' + (Number(x.entry_fee) > 0 ? ' · ' + cn(x.entry_fee) : ' gratuitement') + '</button></div>') + '</section>';
  }
  if (x.status === 'done' && x.winner) html += '<div class="banner pos tour-champ">🏆 ' + nm(P(x.winner)) + ' remporte le tournoi<small>Cagnotte : ' + cn(tourPot(x)) + '</small></div>';
  // arbre
  if (x.matches.length) html += bracketHTML(x);
  // inscrits
  html += '<section class="panel"><h2>Joueurs inscrits (' + x.players.length + '/' + x.max_players + ')</h2>' + (x.players.length ? '<div class="tour-players">' + x.players.map(function(p){ return '<button class="tp" data-act="goto-player" data-pid="' + esc(p.player) + '">' + av(P(p.player), 'sm') + '<span>' + nm(P(p.player)) + '</span></button>'; }).join('') + '</div>' : '<p class="help">Personne pour l\'instant. Sois le premier !</p>') + '</section>';
  // fondateur
  if (canTourney() && (x.status === 'registration' || x.status === 'running')) {
    html += '<section class="adminbox"><p class="help"><b>Organisation</b> : gestion du tournoi.' + (x.status === 'running' ? ' Clique sur le gagnant de chaque match dans l\'arbre pour le faire avancer.' : '') + '</p><div class="actions">' +
      (x.status === 'registration' ? '<button class="btn primary" data-act="tour-start" data-id="' + id + '"' + (x.players.length < 2 ? ' disabled' : '') + '>Lancer le tournoi (tirage au sort)</button>' : '') +
      '<button class="btn danger" data-act="tour-cancel" data-id="' + id + '">Annuler et rembourser</button></div></section>';
  }
  if (isOwner()) html += '<section class="adminbox danger-zone"><p class="help">🗑️ Suppression définitive : le tournoi disparaît complètement, pour tout le monde. Impossible à récupérer.</p><div class="actions"><button class="btn danger" data-act="tour-delete" data-id="' + id + '">Supprimer définitivement</button></div></section>';
  return html;
}
function bracketHTML(x){
  var rounds = {}, maxR = 0;
  x.matches.forEach(function(m){ (rounds[m.round] = rounds[m.round] || []).push(m); if (m.round > maxR) maxR = m.round; });
  function rname(r){ var left = maxR - r; return left === 0 ? 'Finale' : left === 1 ? 'Demi-finales' : left === 2 ? 'Quarts de finale' : 'Huitièmes'; }
  function slotHTML(m, pid){
    if (!pid) return '<div class="bp empty">' + (m.round === 1 ? 'Qualifié d\'office' : 'À déterminer') + '</div>';
    var win = m.winner === pid, lose = m.winner && m.winner !== pid;
    var pick = canTourney() && x.status === 'running' && !m.winner && m.p1 && m.p2;
    return '<div class="bp' + (win ? ' win' : '') + (lose ? ' lose' : '') + (pid === S.me ? ' me' : '') + '">' + av(P(pid), 'sm') + '<span>' + nm(P(pid)) + '</span>' +
      (pick ? '<button class="btn sm win" data-act="tour-win" data-id="' + esc(x.id) + '" data-round="' + m.round + '" data-slot="' + m.slot + '" data-pid="' + esc(pid) + '">Gagnant</button>' : win ? '<b class="bw">✓</b>' : '') + '</div>';
  }
  var html = '<section class="panel"><h2>Arbre du tournoi</h2><div class="bracket">';
  for (var r = 1; r <= maxR; r++) {
    html += '<div class="bround"><p class="eyebrow">' + rname(r) + '</p>' + rounds[r].sort(function(a, b){ return a.slot - b.slot; }).map(function(m){ return '<div class="bmatch">' + slotHTML(m, m.p1) + slotHTML(m, m.p2) + '</div>'; }).join('') + '</div>';
  }
  return html + '</div></section>';
}
function tourNewDialog(){
  var d = new Date(Date.now() + 864e5); d.setMinutes(0, 0, 0);
  var local = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  return dialogShell('<h2 id="dt">Créer un tournoi</h2><form data-form="tour-create" novalidate>' +
    '<label for="t-name">Nom du tournoi</label><input id="t-name" name="name" maxlength="40" required placeholder="Ex. Legacy Cup #1">' +
    '<div class="row"><div><label for="t-mode">Mode</label><select id="t-mode" name="mode">' + MODES.map(function(x){ return '<option>' + x + '</option>'; }).join('') + '</select></div>' +
    '<div><label for="t-bo">Format</label><select id="t-bo" name="bo">' + BOS.map(function(x, i){ return '<option value="' + x + '"' + (i === 1 ? ' selected' : '') + '>' + BO_LABEL[x] + '</option>'; }).join('') + '</select></div></div>' +
    '<label class="rules-check pp-check"><input type="checkbox" name="pingpong" value="1"> Ping-pong</label>' +
    '<div class="row"><div><label for="t-max">Places</label><select id="t-max" name="max"><option value="4">4 joueurs</option><option value="8" selected>8 joueurs</option><option value="16">16 joueurs</option></select></div>' +
    '<div><label for="t-start">Début</label><input id="t-start" name="starts" type="datetime-local" value="' + local + '"></div></div>' +
    '<div class="row"><div><label for="t-fee">Inscription (coins)</label><input id="t-fee" name="fee" type="number" inputmode="decimal" min="0" step="0.5" value="0"></div>' +
    '<div><label for="t-bonus">Bonus au gagnant (coins)</label><input id="t-bonus" name="bonus" type="number" inputmode="decimal" min="0" step="0.5" value="0"></div></div>' +
    '<p class="hint">Le gagnant remporte toutes les inscriptions + le bonus. 0 = gratuit.</p>' +
    '<label for="t-rules">Règles (facultatif)</label><textarea id="t-rules" name="rules" maxlength="300" placeholder="Île, code, règles particulières…"></textarea>' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Créer le tournoi</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}

/* ---------- parties perso (Battle Royale / Recharge, jusqu'à 100 joueurs) ---------- */
var customId = null;
var CGAME = {br: 'Battle Royale', reload: 'Recharge'};
var CTEAM = {1: 'Solo', 2: 'Duo', 3: 'Trio', 4: 'Section'};
var CTEAMS_BY_GAME = {br: [1, 2, 3, 4], reload: [1, 2, 4]};
var CDEFAULT_MAX = {br: 100, reload: 40};
var CSTATUS = {registration: ['Inscriptions ouvertes', 'open'], live: ['En cours', 'live'], done: ['Terminée', 'done'], cancelled: ['Annulée', 'cancelled']};
function customFormat(x){ return x.format === 'ppstack' ? 'PP Stack (type Noble)' + (x.no_fight_top ? ' · pas de fight avant le top ' + x.no_fight_top : '') : 'Classique'; }
function customTeams(x){
  var by = {};
  x.entries.forEach(function(e){ var k = x.team_size > 1 ? (e.team_tag || '—').toLowerCase() : e.player; (by[k] = by[k] || {tag: e.team_tag, players: []}).players.push(e.player); });
  return Object.keys(by).map(function(k){ return by[k]; });
}
function customDate(x, long){ return x.starts_at ? new Date(x.starts_at).toLocaleString('fr-FR', long ? {weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'} : {day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'}) : ''; }
function customsSectionHTML(){
  var all = Object.keys(S.customs || {}).map(function(k){ return S.customs[k]; });
  var active = all.filter(function(x){ return x.status === 'registration' || x.status === 'live'; });
  var done = all.filter(function(x){ return x.status === 'done' || (x.status === 'cancelled' && canTourney()); });
  active.sort(function(a, b){ return ({live:0,registration:1})[a.status] - ({live:0,registration:1})[b.status] || Date.parse(b.created_at) - Date.parse(a.created_at); });
  done.sort(function(a, b){ return Date.parse(b.created_at) - Date.parse(a.created_at); });
  var html = '<section class="fmt-head g-br"><div class="fmt-ic">🎮</div><div class="fmt-txt"><h2 class="sec">Parties perso</h2><p class="help">Gros lobby jusqu\'à 100 joueurs (Battle Royale ou Recharge). Tu t\'inscris, et le code de la partie t\'arrive au lancement.</p></div>' + (canTourney() ? '<button class="btn primary" data-act="custom-new">+ Créer</button>' : '') + '</section>';
  if (!active.length && !done.length) return html + tourEmptyHTML('🎮', 'Aucune partie perso prévue');
  html += active.length ? '<div class="tour-grid">' + active.map(customCardHTML).join('') + '</div>' : '<p class="muted-line">Aucune partie perso en ce moment.</p>';
  if (done.length) html += '<details class="done-wrap"' + (active.length ? '' : ' open') + '><summary>🏁 Parties perso terminées (' + done.length + ')</summary><div class="tour-grid">' + done.map(customCardHTML).join('') + '</div></details>';
  return html;
}
function customCardHTML(x){
  var st = CSTATUS[x.status], inC = x.entries.some(function(e){ return e.player === S.me; }), pct = Math.round(x.entries.length / x.max_players * 100);
  return '<article class="tour-card cust-card ' + x.game + '" data-act="open-custom" data-id="' + esc(x.id) + '" tabindex="0" role="button">' +
    '<div class="tc-top"><span class="chip ' + st[1] + '">' + st[0] + '</span>' + (inC ? '<span class="fr-tag ok">✓ Inscrit</span>' : '') + '</div>' +
    '<h3>' + esc(x.name) + '</h3>' +
    '<div class="cust-chips"><span class="cchip g-' + x.game + '">' + CGAME[x.game] + '</span><span class="cchip">' + CTEAM[x.team_size] + '</span>' + (x.format === 'ppstack' ? '<span class="cchip pp">PP Stack' + (x.no_fight_top ? ' · top ' + x.no_fight_top : '') + '</span>' : '') + (x.games > 1 ? '<span class="cchip">' + x.games + ' parties</span>' : '') + '</div>' +
    '<div class="cust-bar"><i style="width:' + pct + '%"></i></div><p class="help"><b>' + x.entries.length + '/' + x.max_players + '</b> joueurs' + (x.team_size > 1 ? ' · ' + customTeams(x).length + (customTeams(x).length > 1 ? ' équipes' : ' équipe') : '') + '</p>' +
    (x.starts_at ? '<p class="help">📅 ' + customDate(x, true) + '</p>' : '') + (x.map_name ? '<p class="help">🗺️ ' + esc(x.map_name) + '</p>' : '') + (x.prize ? '<p class="help">🏆 ' + esc(x.prize.split('\n')[0]) + (x.prize.indexOf('\n') > -1 ? ' …' : '') + '</p>' : '') + '</article>';
}
function customDetailHTML(x){
  var st = CSTATUS[x.status], id = esc(x.id), me0 = x.entries.find(function(e){ return e.player === S.me; }), full = x.entries.length >= x.max_players, teams = customTeams(x);
  var html = '<button class="btn sm ghost back" data-act="custom-back">← Tous les tournois</button>';
  html += '<section class="mhead"><div><p class="eyebrow">Partie perso · <span class="chip ' + st[1] + '" style="margin:0">' + st[0] + '</span></p><h1>' + esc(x.name) + '</h1></div></section>';
  html += '<section class="tour-info"><div><b>' + CGAME[x.game] + '</b><span>Mode</span></div><div><b>' + CTEAM[x.team_size] + '</b><span>Équipes</span></div>' +
    '<div><b>' + x.entries.length + '/' + x.max_players + '</b><span>Joueurs' + (x.team_size > 1 ? ' · ' + teams.length + (teams.length > 1 ? ' équipes' : ' équipe') : '') + '</span></div>' +
    '<div><b>' + (x.format === 'ppstack' ? 'PP Stack' : 'Classique') + '</b><span>' + (x.format === 'ppstack' ? (x.no_fight_top ? 'Pas de fight avant le top ' + x.no_fight_top : 'Type Noble') : 'Type de partie') + '</span></div>' +
    '<div><b>' + x.games + '</b><span>Partie' + (x.games > 1 ? 's' : '') + '</span></div>' +
    (x.starts_at ? '<div><b>' + customDate(x) + '</b><span>Début</span></div>' : '') +
    (x.map_name ? '<div><b>' + esc(x.map_name) + '</b><span>Map</span></div>' : '') + '</section>';
  // code de la partie perso
  if (me0 || canTourney()) {
    if (x.code) html += '<section class="code-box"><p class="eyebrow">🎮 Code de la partie perso · partie ' + x.code.game_no + (x.games > 1 ? '/' + x.games : '') + '</p><div class="code-row"><b class="code-val">' + esc(x.code.code) + '</b><button class="btn primary" data-act="copy-code" data-code="' + esc(x.code.code) + '">Copier</button></div><p class="help">Dans Fortnite : <b>Partie personnalisée</b> → entre ce code → prêt. Envoyé ' + ago(Date.parse(x.code.sent_at)) + '.</p></section>';
    else if (me0) html += '<section class="code-box wait"><p class="eyebrow">🎮 Code de la partie perso</p><p>Le code apparaîtra ici et dans tes notifications 🔔 dès que le fondateur lance la partie.</p></section>';
  }
  // map + récompenses
  if (x.map_code) html += '<section class="map-box"><p class="eyebrow">🗺️ Map' + (x.map_name ? ' · ' + esc(x.map_name) : '') + '</p><div class="code-row"><b class="map-val">' + esc(x.map_code) + '</b><button class="btn" data-act="copy-code" data-code="' + esc(x.map_code) + '">Copier</button></div><p class="help">Code de l\'île à entrer dans Fortnite (Découvrir → recherche).</p></section>';
  if (x.prize) html += '<section class="panel prize-panel"><h2>🏆 Récompenses</h2><p>' + esc(x.prize) + '</p></section>';
  if (x.rules || x.format === 'ppstack') html += '<section class="panel"><h2>Règles</h2>' + (x.format === 'ppstack' ? '<p class="pp-rule">⚠️ <b>PP Stack (type Noble)</b>' + (x.no_fight_top ? ' : interdiction de se tirer dessus avant le <b>top ' + x.no_fight_top + '</b>.' : '.') + '</p>' : '') + (x.rules ? '<p style="white-space:pre-wrap">' + esc(x.rules) + '</p>' : '') + '</section>';
  // inscription
  if (x.status === 'registration' || me0) {
    html += '<section class="panel"><h2>Inscription</h2>';
    if (me0) html += '<p>✓ Tu es inscrit' + (me0.team_tag ? ' avec l\'équipe <b>' + esc(me0.team_tag) + '</b>' : '') + '.</p>' + (x.status === 'registration' ? '<div class="actions"><button class="btn danger" data-act="custom-leave" data-id="' + id + '">Me désinscrire</button></div>' : '');
    else if (full) html += '<p>La partie est complète.</p>';
    else {
      var open = teams.filter(function(t){ return x.team_size > 1 && t.tag && t.players.length < x.team_size; });
      html += '<form data-form="custom-join" data-id="' + id + '" novalidate>' + (x.team_size > 1
        ? '<label for="cj-team">Nom de ton équipe (' + CTEAM[x.team_size].toLowerCase() + ')</label><input id="cj-team" name="team" maxlength="30" list="cj-teams" autocomplete="off" placeholder="Ex. Les Boss"><datalist id="cj-teams">' + open.map(function(t){ return '<option value="' + esc(t.tag) + '">'; }).join('') + '</datalist><p class="hint">Tes mates s\'inscrivent avec <b>exactement le même nom d\'équipe</b>.' + (open.length ? ' Équipes avec de la place : ' + open.map(function(t){ return '<b>' + esc(t.tag) + '</b> (' + t.players.length + '/' + x.team_size + ')'; }).join(', ') + '.' : '') + '</p>'
        : '') + '<p class="err" role="alert"></p><div class="actions"><button class="btn primary lg" type="submit">S\'inscrire gratuitement</button></div></form>';
    }
    html += '</section>';
  }
  // inscrits
  html += '<section class="panel"><h2>' + (x.team_size > 1 ? 'Équipes inscrites (' + teams.length + ')' : 'Joueurs inscrits (' + x.entries.length + '/' + x.max_players + ')') + '</h2>';
  if (!x.entries.length) html += '<p class="help">Personne pour l\'instant. Sois le premier !</p>';
  else if (x.team_size > 1) html += '<div class="cust-teams">' + teams.map(function(t){ return '<div class="cust-team"><p><b>' + esc(t.tag || '—') + '</b> <span class="fr-tag' + (t.players.length >= x.team_size ? ' ok' : '') + '">' + t.players.length + '/' + x.team_size + '</span></p><div class="tour-players">' + t.players.map(function(pid){ return customPlayerHTML(x, pid); }).join('') + '</div></div>'; }).join('') + '</div>';
  else html += '<div class="tour-players">' + x.entries.map(function(e){ return customPlayerHTML(x, e.player); }).join('') + '</div>';
  html += '</section>';
  // organisation
  if (canTourney()) {
    html += '<section class="adminbox owner-panel"><h2>👑 Organisation · gestion de la partie</h2>';
    if (x.status !== 'done' && x.status !== 'cancelled') html += '<form data-form="custom-code" data-id="' + id + '" class="code-send" novalidate><label for="cc-code">Code de la partie perso' + (x.code ? ' (partie ' + (x.code.game_no + 1) + ')' : '') + '</label><div class="code-row"><input id="cc-code" name="code" maxlength="40" autocomplete="off" placeholder="Ex. LEGACY1234"><button class="btn primary" type="submit">📨 Envoyer aux ' + x.entries.length + ' inscrits</button></div><p class="err" role="alert"></p><p class="help">Chaque inscrit reçoit le code en notification et le voit sur cette page. Pour la partie suivante, envoie simplement le nouveau code.</p></form>';
    html += '<div class="actions">' +
      '<button class="btn" data-act="custom-edit" data-id="' + id + '">✏️ Modifier (mode, règles…)</button>' +
      (x.status === 'registration' ? '<button class="btn" data-act="custom-status" data-id="' + id + '" data-s="live">Fermer les inscriptions</button>' : '') +
      (x.status === 'live' ? '<button class="btn" data-act="custom-status" data-id="' + id + '" data-s="registration">Rouvrir les inscriptions</button><button class="btn win" data-act="custom-status" data-id="' + id + '" data-s="done">Terminer la partie</button>' : '') +
      (x.status !== 'cancelled' && x.status !== 'done' ? '<button class="btn danger" data-act="custom-status" data-id="' + id + '" data-s="cancelled">Annuler</button>' : '') +
      (x.status === 'cancelled' || x.status === 'done' ? '<button class="btn" data-act="custom-status" data-id="' + id + '" data-s="registration">Relancer les inscriptions</button>' : '') +
      (isOwner() ? '<button class="btn danger" data-act="custom-delete" data-id="' + id + '">🗑️ Supprimer définitivement</button>' : '') +
      '</div></section>';
  }
  return html;
}
function customPlayerHTML(x, pid){
  return '<span class="tp-wrap"><button class="tp" data-act="goto-player" data-pid="' + esc(pid) + '">' + av(P(pid), 'sm') + '<span>' + nm(P(pid)) + (P(pid).fortnite ? ' <small>🎮 ' + esc(P(pid).fortnite) + '</small>' : '') + '</span></button>' +
    (canTourney() ? '<button class="btn sm ghost" title="Retirer de la partie" data-act="custom-kick" data-id="' + esc(x.id) + '" data-pid="' + esc(pid) + '">✕</button>' : '') + '</span>';
}
function customDialog(cid){
  var x = cid && S.customs && S.customs[cid], g = x ? x.game : 'br';
  var local = '';
  if (x && x.starts_at) { var dd = new Date(x.starts_at); local = new Date(dd.getTime() - dd.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
  else { var d0 = new Date(Date.now() + 864e5); d0.setMinutes(0, 0, 0); local = new Date(d0.getTime() - d0.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); }
  var ts = x ? x.team_size : 2, fm = x ? x.format : 'classic';
  var teamOpts = CTEAMS_BY_GAME[g].map(function(n){ return '<option value="' + n + '"' + (n === ts ? ' selected' : '') + '>' + CTEAM[n] + '</option>'; }).join('');
  var rulesDefault = x ? x.rules : '• Pas de teaming : on ne s\'allie pas avec une autre équipe.\n• Respect de tous les joueurs, pas d\'insultes.\n• Un joueur qui quitte ne peut pas revenir dans la partie.\n• En cas de souci, ouvre un ticket sur le Discord.';
  return dialogShell('<h2 id="dt">' + (x ? 'Modifier la partie perso' : 'Créer une partie perso') + '</h2><form data-form="custom-save" data-id="' + (x ? esc(x.id) : '') + '" novalidate>' +
    '<label for="c-name">Nom</label><input id="c-name" name="name" maxlength="50" required value="' + (x ? esc(x.name) : '') + '" placeholder="Ex. Legacy Cup · Battle Royale">' +
    '<div class="row"><div><label for="c-game">Mode</label><select id="c-game" name="game"><option value="br"' + (g === 'br' ? ' selected' : '') + '>Battle Royale</option><option value="reload"' + (g === 'reload' ? ' selected' : '') + '>Recharge</option></select></div>' +
    '<div><label for="c-team">Équipes</label><select id="c-team" name="team_size">' + teamOpts + '</select></div></div>' +
    '<div class="row"><div><label for="c-max">Joueurs max</label><input id="c-max" name="max_players" type="number" inputmode="numeric" min="2" max="100" value="' + (x ? x.max_players : CDEFAULT_MAX[g]) + '"></div>' +
    '<div><label for="c-games">Nombre de parties</label><input id="c-games" name="games" type="number" inputmode="numeric" min="1" max="20" value="' + (x ? x.games : 1) + '"></div></div>' +
    '<p class="hint" id="c-lobby"></p>' +
    '<div class="row"><div><label for="c-format">Type de partie</label><select id="c-format" name="format"><option value="classic"' + (fm === 'classic' ? ' selected' : '') + '>Classique</option><option value="ppstack"' + (fm === 'ppstack' ? ' selected' : '') + '>PP Stack (type Noble)</option></select></div>' +
    '<div id="c-nofight-wrap"' + (fm === 'ppstack' ? '' : ' hidden') + '><label for="c-nofight">Pas de fight avant le top…</label><input id="c-nofight" name="no_fight_top" type="number" inputmode="numeric" min="2" max="100" value="' + (x && x.no_fight_top ? x.no_fight_top : 80) + '"></div></div>' +
    '<label for="c-start">Début</label><input id="c-start" name="starts_at" type="datetime-local" value="' + local + '">' +
    '<div class="row"><div><label for="c-map">Map</label><input id="c-map" name="map_name" maxlength="60" value="' + (x ? esc(x.map_name || '') : '') + '" placeholder="Ex. Map Noble, Battle Royale…"></div>' +
    '<div><label for="c-mapcode">Code de la map</label><input id="c-mapcode" name="map_code" maxlength="40" autocomplete="off" spellcheck="false" value="' + (x ? esc(x.map_code || '') : '') + '" placeholder="Ex. 1234-5678-9012"></div></div>' +
    '<p class="hint">Facultatif. La map et son code s\'affichent pour tout le monde sur la page de la partie.</p>' +
    '<label for="c-prize">Récompenses (texte libre, facultatif)</label><textarea id="c-prize" name="prize" maxlength="500" rows="3" placeholder="Ex. Top 1 : 50 coins + 1000 V-Bucks&#10;Top 2 : 20 coins">' + (x ? esc(x.prize || '') : '') + '</textarea>' +
    '<label for="c-rules">Règles</label><textarea id="c-rules" name="rules" maxlength="3000" rows="7">' + esc(rulesDefault) + '</textarea>' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">' + (x ? 'Enregistrer' : 'Créer la partie perso') + '</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function customLobbyHint(){
  var g = document.getElementById('c-game'), t = document.getElementById('c-team'), m = document.getElementById('c-max'), h = document.getElementById('c-lobby');
  if (!g || !t || !m || !h) return;
  var ts = parseInt(t.value, 10) || 1, mx = parseInt(m.value, 10) || 0;
  h.textContent = 'Lobby : ' + mx + ' joueurs' + (ts > 1 ? ' = ' + Math.floor(mx / ts) + ' ' + CTEAM[ts].toLowerCase() + 's' : '') + '.';
}
function customDialogChange(el){
  if (el.id === 'c-game') {
    var t = document.getElementById('c-team'), m = document.getElementById('c-max'), cur = parseInt(t.value, 10);
    var opts = CTEAMS_BY_GAME[el.value];
    if (opts.indexOf(cur) < 0) cur = opts[opts.length - 1];
    t.innerHTML = opts.map(function(n){ return '<option value="' + n + '"' + (n === cur ? ' selected' : '') + '>' + CTEAM[n] + '</option>'; }).join('');
    m.value = CDEFAULT_MAX[el.value];
  }
  if (el.id === 'c-format') { var w = document.getElementById('c-nofight-wrap'); if (w) w.hidden = el.value !== 'ppstack'; }
  customLobbyHint();
}

/* ---------- cadeau : bannière animée ORIONG Esport (pop-up au prochain lancement du site) ---------- */
var OG_ITEM = 'banner:oriong', ogShowing = false, ogMem = {};
function ogSeenKey(){ return 'lg_og_seen_v2_' + S.me; }
function ogSeenGet(){ try { return localStorage.getItem(ogSeenKey()) === '1'; } catch(e){ return false; } }
function ogSeenSet(){ ogMem[S.me] = 1; try { localStorage.setItem(ogSeenKey(), '1'); } catch(e){} }
function ogCheckGift(){
  if (ogShowing || !S.me || !S.players || !S.players[S.me] || !document.querySelector('header.top') || document.querySelector('.og-gift')) return;
  var p = S.players[S.me];
  if ((p.owned || []).indexOf(OG_ITEM) < 0) return;
  if (ogMem[S.me] || ogSeenGet()) return;
  if (p.eq && p.eq.banner === OG_ITEM) { ogSeenSet(); return; }   // déjà équipée : pas de pop-up
  ogShow();
}
function ogGiftSVG(){
  return '<svg class="og-svg" viewBox="0 0 120 120" aria-hidden="true"><defs><linearGradient id="ogg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a98bff"/><stop offset="1" stop-color="#4a35b8"/></linearGradient></defs>' +
    '<g class="og-body"><rect x="20" y="54" width="80" height="54" rx="6" fill="url(#ogg)"/><rect x="54" y="54" width="12" height="54" fill="#ffd76a"/></g>' +
    '<g class="og-lid"><rect x="14" y="38" width="92" height="20" rx="6" fill="#7b5df0"/><rect x="54" y="38" width="12" height="20" fill="#ffd76a"/>' +
    '<path d="M60 38 C44 12 22 22 36 34 C44 40 56 38 60 38 Z" fill="#ffd76a"/><path d="M60 38 C76 12 98 22 84 34 C76 40 64 38 60 38 Z" fill="#ffd76a"/></g></svg>';
}
function ogShow(){
  ogShowing = true; ogSeenSet();
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches, conf = '';
  for (var i = 0; i < 44; i++) {
    var a = Math.random() * Math.PI * 2, d = 120 + Math.random() * 300;
    conf += '<i style="--dx:' + Math.round(Math.cos(a) * d) + 'px;--dy:' + Math.round(Math.sin(a) * d - 70) + 'px;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;background:hsl(' + (190 + Math.round(Math.random() * 130)) + ' 92% 66%);animation-delay:' + (Math.random() * 0.15).toFixed(2) + 's"></i>';
  }
  var html = '<div class="og-gift" role="dialog" aria-modal="true" aria-label="Cadeau ORIONG Esport"><div class="og-bg"></div><div class="og-stage">' +
    '<div class="og-step og-s1"><button type="button" class="og-box" data-og="open" aria-label="Ouvrir le cadeau">' + ogGiftSVG() + '</button>' +
      '<h2 class="og-title">Un cadeau t\'attend !</h2>' +
      '<p class="og-sub">Offert par <b>Legacy</b> à la team <b>ORIONG Esport</b></p>' +
      '<button type="button" class="btn primary lg" data-og="open">Ouvrir mon cadeau 🎁</button></div>' +
    '<div class="og-step og-s2"><div class="og-burst" aria-hidden="true">' + conf + '</div>' +
      '<p class="og-eyebrow">⭐ Exclusivité ORIONG Esport</p>' +
      '<div class="og-prev bn-oriong" role="img" aria-label="Aperçu de la bannière animée ORIONG Esport"></div>' +
      '<h2 class="og-name">Bannière animée ORIONG Esport</h2>' +
      '<p class="og-sub">Réservée à la team. Elle s\'affiche en haut de ton profil.</p>' +
      '<div class="actions"><button type="button" class="btn primary lg" data-og="equip">Équiper maintenant ✨</button><button type="button" class="btn ghost" data-og="close">Plus tard</button></div></div>' +
    '</div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
  var el = document.body.lastElementChild;
  function close(){ document.removeEventListener('keydown', onKey); el.classList.add('og-out'); setTimeout(function(){ el.remove(); ogShowing = false; }, 320); }
  function onKey(e){ if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onKey);
  el.addEventListener('click', function(e){
    var b = e.target.closest('[data-og]'); if (!b) return;
    var act = b.getAttribute('data-og');
    if (act === 'open') {
      if (el.classList.contains('og-open')) return;
      el.classList.add('og-open');
      setTimeout(function(){ el.classList.add('og-s2on'); var f = el.querySelector('[data-og="equip"]'); if (f) try { f.focus(); } catch(x){} }, reduce ? 0 : 700);
    } else if (act === 'equip') {
      b.disabled = true;
      rpc('set_equip', {p_slot: 'banner', p_item: OG_ITEM}).then(function(r){
        if (!r.ok) { b.disabled = false; return toast(r.msg || 'Impossible pour le moment.'); }
        toast('Bannière ORIONG Esport équipée !'); close(); render();
      });
    } else if (act === 'close') close();
  });
  setTimeout(function(){ var f = el.querySelector('.og-s1 .btn'); if (f) try { f.focus(); } catch(x){} }, 80);
}
/* ---------- message unique : remise à zéro générale des stats (13/11/2026) ---------- */
var resetNoticeShown = false;
function globalResetStamp(){
  var cnt = {}, best = 0, bestN = 0, total = 0;
  Object.keys(S.players || {}).forEach(function(id){ var t = S.players[id].statsResetAt || 0; total++; if (!t) return; cnt[t] = (cnt[t] || 0) + 1; if (cnt[t] > bestN) { bestN = cnt[t]; best = t; } });
  return (best && bestN >= 3 && bestN >= total * 0.6) ? best : 0;   // remise à zéro générale = presque tout le monde a exactement la même heure
}
function resetNoticeCheck(){
  if (resetNoticeShown || !S.me || !S.players || !S.players[S.me] || !document.querySelector('header.top') || document.querySelector('.rn-notice')) return;
  var g = globalResetStamp(); if (!g || Date.now() - g > 30 * 864e5) return;
  if (Math.abs((S.players[S.me].statsResetAt || 0) - g) > 1500) return;
  var key = 'lg_stats_notice_' + S.me + '_' + g;
  try { if (localStorage.getItem(key) === '1') return; } catch(e){}
  resetNoticeShown = true;
  document.body.insertAdjacentHTML('beforeend', '<div class="rn-notice" role="alert"><span class="rn-ic" aria-hidden="true">⚠️</span><p>Une erreur est arrivée. Les stats ont été réinitialisées.</p><button type="button" class="btn sm" data-rn="ok">OK</button></div>');
  var el = document.body.lastElementChild;
  el.querySelector('[data-rn="ok"]').addEventListener('click', function(){ try { localStorage.setItem(key, '1'); } catch(x){} el.classList.add('rn-out'); setTimeout(function(){ el.remove(); }, 250); });
}
/* ---------- chat général (page Arène) + messages privés entre amis, en temps réel ---------- */
var CHT = {rx: {}, msgs: [], ids: {}, loaded: false, open: null, fresh: 0, chan: null, me: null,
  dm: null, dmMsgs: [], dmIds: {}, dmLoaded: false, unread: {}, lastDmRead: 0};
function dmBtn(pid){ var n = dmUnread(pid); return '<button type="button" class="btn sm dmb" data-dm="' + esc(pid) + '">💬 Chat' + (n ? ' <i class="count">' + n + '</i>' : '') + '</button>'; }
var RX_LIST = ['🔥', '😂', '👍', '💜', '😮', '💀'];
function rxHTML(id){
  var m = CHT.rx[id] || {}, h = '';
  RX_LIST.forEach(function(e){
    var ps = m[e] ? Object.keys(m[e]) : []; if (!ps.length) return;
    h += '<button type="button" class="gc-chip' + (m[e][S.me] ? ' mine' : '') + '" data-gcrx="' + id + '|' + e + '" title="' + esc(ps.map(function(k){ return P(k).pseudo; }).join(', ')) + '">' + e + ' ' + ps.length + '</button>';
  });
  return '<div class="gc-rx">' + h + '<button type="button" class="gc-chip gc-add" data-gcrxopen="' + id + '" aria-label="Réagir" title="Réagir">☺＋</button><span class="gc-pick" hidden>' + RX_LIST.map(function(e){ return '<button type="button" data-gcrx="' + id + '|' + e + '">' + e + '</button>'; }).join('') + '</span></div>';
}
function rxPaint(id){ var el = document.querySelector('#gc-list [data-id="' + id + '"] .gc-rx'); if (el) el.outerHTML = rxHTML(id); }
function rxSet(id, e, pid, on){
  var m = CHT.rx[id] || (CHT.rx[id] = {}), o = m[e] || (m[e] = {});
  if (on) o[pid] = 1; else delete o[pid];
  if (!Object.keys(o).length) delete m[e];
  rxPaint(id);
}
function rxLoad(){
  var ids = CHT.msgs.filter(function(x){ return x.kind !== 'warn' && x.kind !== 'fiche'; }).map(function(x){ return x.id; });
  if (!ids.length) return;
  sb.from('chat_reactions').select('message_id,player,emoji').in('message_id', ids).then(function(r){
    if (r.error) return;
    CHT.rx = {}; (r.data || []).forEach(function(x){ var m = CHT.rx[x.message_id] || (CHT.rx[x.message_id] = {}); (m[x.emoji] || (m[x.emoji] = {}))[x.player] = 1; });
    ids.forEach(rxPaint);
  });
}
function rxToggle(id, e){
  var had = !!(CHT.rx[id] && CHT.rx[id][e] && CHT.rx[id][e][S.me]);
  rxSet(id, e, S.me, !had);
  sb.rpc('toggle_chat_reaction', {p_id: id, p_emoji: e}).then(function(r){ if (r.error) { rxSet(id, e, S.me, had); toast(cleanErr(r.error.message)); } });
}
function lfmHTML(){
  var m = me(); if (!m) return '';
  var on = m.lfm && m.lfm > Date.now();
  var fr = (S.friends || []).filter(function(x){ return x.status === 'accepted'; }).map(function(x){ return x.requester === S.me ? x.addressee : x.requester; }).filter(function(k){ return presence(k).k === 'lfm'; });
  return '<button type="button" class="btn' + (on ? ' primary' : '') + '" data-lfm="' + (on ? '0' : '1') + '">' + (on ? '🎯 Je cherche un match · arrêter' : '🎯 Je cherche un match') + '</button>' +
    (fr.length ? '<p class="lfm-fr">🎯 Tes amis qui cherchent un match : ' + fr.map(function(k){ return '<button type="button" class="lfm-name" data-act="goto-player" data-pid="' + esc(k) + '">' + esc(P(k).pseudo) + '</button>'; }).join(' ') + '</p>' : '');
}
function dmUnread(pid){ return CHT.unread[pid] || 0; }
function dmUnreadTotal(){ var n = 0; for (var k in CHT.unread) n += CHT.unread[k]; return n; }
function chatTime(t){ var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function chatMsgHTML(x, priv){
  if (x.kind === 'fiche') return '<div class="gc-warn gc-fiche" data-id="' + x.id + '">🚨 <b>' + esc(P(x.author).pseudo) + '</b> est <b>FICHÉ</b> : il a recommencé à utiliser un langage interdit. Muet 15 minutes.' + (isAdmin() ? '<button type="button" class="gc-del" data-gcdel="' + x.id + '" aria-label="Supprimer">✕</button>' : '') + '</div>';
  if (x.kind === 'warn') return '<div class="gc-warn" data-id="' + x.id + '">⚠️ <b>' + esc(P(x.author).pseudo) + '</b> a reçu un avertissement pour langage interdit. Ce n\'est qu\'un avertissement : la prochaine fois, il sera fiché devant tout le monde.' + (isAdmin() ? '<button type="button" class="gc-del" data-gcdel="' + x.id + '" aria-label="Supprimer">✕</button>' : '') + '</div>';
  var p = P(x.author || x.sender), mine = (x.author || x.sender) === S.me, who = x.author || x.sender;
  return '<div class="gc-msg' + (mine ? ' mine' : '') + '" data-id="' + x.id + '"><button type="button" class="gc-av" data-act="goto-player" data-pid="' + esc(who) + '" aria-label="Profil de ' + esc(p.pseudo) + '">' + av(p, 'sm') + '</button>' +
    '<div class="gc-bub"><b class="gc-h">' + nm(p) + (priv ? '' : badge(p)) + ' <small>' + chatTime(x.at) + '</small>' + (!priv && isAdmin() ? '<button type="button" class="gc-del" data-gcdel="' + x.id + '" title="Supprimer ce message" aria-label="Supprimer ce message">✕</button>' : '') + '</b><span>' + esc(x.body) + '</span>' + (!priv ? rxHTML(x.id) : '') + '</div></div>';
}
function chatAtBottom(el){ return el.scrollHeight - el.scrollTop - el.clientHeight < 70; }
function chatPaint(listId, arr, priv, empty){
  var el = document.getElementById(listId); if (!el) return;
  el.innerHTML = arr.length ? arr.map(function(x){ return chatMsgHTML(x, priv); }).join('') : '<p class="gc-empty">' + empty + '</p>';
  el.scrollTop = el.scrollHeight;
}
function chatAppend(listId, x, priv){
  var el = document.getElementById(listId); if (!el) return;
  var stick = chatAtBottom(el), e0 = el.querySelector('.gc-empty'); if (e0) e0.remove();
  el.insertAdjacentHTML('beforeend', chatMsgHTML(x, priv));
  while (el.children.length > 160) el.removeChild(el.firstChild);
  if (stick || (x.author || x.sender) === S.me) el.scrollTop = el.scrollHeight;
}

/* --- chat général --- */
function chatLoad(){
  if (!S.me) return;
  sb.from('chat_messages').select('id,author,body,at,kind').order('at', {ascending: false}).limit(80).then(function(r){
    if (r.error || !S.me) return;
    CHT.msgs = (r.data || []).reverse(); CHT.ids = {}; CHT.msgs.forEach(function(x){ CHT.ids[x.id] = 1; });
    CHT.loaded = true; chatPaint('gc-list', CHT.msgs, false, 'Aucun message pour l\'instant. Lance la discussion !'); rxLoad();
  });
}
function chatOnInsert(x){
  if (!x || CHT.ids[x.id]) return;
  CHT.ids[x.id] = 1; CHT.msgs.push(x); if (CHT.msgs.length > 160) CHT.msgs.shift();
  chatAppend('gc-list', x, false);
  var g = document.getElementById('gchat');
  if (x.author !== S.me && g && !g.classList.contains('open')) { CHT.fresh++; chatApply(); }
}
function chatOnDelete(x){
  if (!x || x.id == null) return;
  CHT.msgs = CHT.msgs.filter(function(m){ return m.id !== x.id; }); delete CHT.ids[x.id];
  var el = document.querySelector('#gc-list [data-id="' + x.id + '"]'); if (el) el.remove();
}
function chatSend(e){
  e.preventDefault(); e.stopPropagation();
  var inp = document.getElementById('gc-input'), btn = e.target.querySelector('button[type=submit]'), v = inp.value.trim();
  if (!v) return;
  btn.disabled = true;
  sb.rpc('send_chat', {p_body: v}).then(function(r){
    btn.disabled = false;
    if (r.error) { toast(cleanErr(r.error.message)); return; }
    inp.value = ''; inp.focus();
    if (r.data > 0 && !CHT.ids[r.data]) chatOnInsert({id: r.data, author: S.me, body: v, at: new Date().toISOString()});
  });
}

/* --- messages privés --- */
function dmLoad(pid){
  if (!S.me) return;
  var me = S.me;
  sb.from('dm_messages').select('id,sender,recipient,body,at,read_at')
    .or('and(sender.eq.' + me + ',recipient.eq.' + pid + '),and(sender.eq.' + pid + ',recipient.eq.' + me + ')')
    .order('at', {ascending: false}).limit(100).then(function(r){
    if (r.error || CHT.dm !== pid) return;
    CHT.dmMsgs = (r.data || []).reverse(); CHT.dmIds = {}; CHT.dmMsgs.forEach(function(x){ CHT.dmIds[x.id] = 1; });
    CHT.dmLoaded = true; chatPaint('dm-list', CHT.dmMsgs, true, 'Aucun message. Dis salut à ' + esc(P(pid).pseudo) + ' !');
    dmMarkRead(pid);
  });
}
function dmMarkRead(pid){
  if (!CHT.unread[pid]) return;
  delete CHT.unread[pid]; dmBadges();
  sb.rpc('mark_dm_read', {p_with: pid}).then(function(){});
}
function dmOpen(pid){
  if (!S.me || pid === S.me) return;
  CHT.dm = pid; CHT.dmMsgs = []; CHT.dmIds = {}; CHT.dmLoaded = false;
  var p = P(pid), pr = presence(pid), d = document.getElementById('dmchat');
  document.getElementById('dm-who').innerHTML = '<button type="button" class="gc-av" data-act="goto-player" data-pid="' + esc(pid) + '">' + av(p, 'sm') + '</button><span><b>' + nm(p) + '</b><small class="pr-' + pr.k + '">' + esc(pr.label) + '</small></span>';
  document.getElementById('dm-list').innerHTML = '<p class="gc-empty">Chargement…</p>';
  d.hidden = false; chatApply();
  if (innerWidth < 1700) { CHT.open = false; chatApply(); }
  dmLoad(pid);
  setTimeout(function(){ var i = document.getElementById('dm-input'); if (i) try { i.focus(); } catch(e){} }, 60);
}
function dmClose(){ CHT.dm = null; document.getElementById('dmchat').hidden = true; chatApply(); }
function dmOnInsert(x){
  if (!x || (x.sender !== S.me && x.recipient !== S.me)) return;
  var other = x.sender === S.me ? x.recipient : x.sender, incoming = x.sender !== S.me;
  if (CHT.dm === other) {
    if (!CHT.dmIds[x.id]) { CHT.dmIds[x.id] = 1; CHT.dmMsgs.push(x); chatAppend('dm-list', x, true); }
    if (incoming) { CHT.unread[other] = 1; dmMarkRead(other); }
  } else if (incoming) {
    CHT.unread[other] = (CHT.unread[other] || 0) + 1; dmBadges();
    toast('💬 ' + P(other).pseudo + ' : ' + String(x.body).slice(0, 60));
  }
}
function dmSend(e){
  e.preventDefault(); e.stopPropagation();
  var pid = CHT.dm, inp = document.getElementById('dm-input'), btn = e.target.querySelector('button[type=submit]'), v = inp.value.trim();
  if (!pid || !v) return;
  btn.disabled = true;
  sb.rpc('send_dm', {p_to: pid, p_body: v}).then(function(r){
    btn.disabled = false;
    if (r.error) { toast(cleanErr(r.error.message)); return; }
    inp.value = ''; inp.focus();
    if (r.data && !CHT.dmIds[r.data] && CHT.dm === pid) dmOnInsert({id: r.data, sender: S.me, recipient: pid, body: v, at: new Date().toISOString()});
  });
}
function dmLoadUnread(){
  if (!S.me) return;
  sb.from('dm_messages').select('sender').eq('recipient', S.me).is('read_at', null).limit(500).then(function(r){
    if (r.error || !S.me) return;
    var u = {}; (r.data || []).forEach(function(x){ u[x.sender] = (u[x.sender] || 0) + 1; });
    if (CHT.dm) delete u[CHT.dm];
    CHT.unread = u; dmBadges();
  });
}
function dmBadges(){
  [].forEach.call(document.querySelectorAll('[data-dm]'), function(b){
    var n = dmUnread(b.getAttribute('data-dm')), c = b.querySelector('i.count');
    if (n && !c) b.insertAdjacentHTML('beforeend', ' <i class="count">' + n + '</i>'); else if (n && c) c.textContent = n; else if (!n && c) c.remove();
  });
  var a = document.querySelector('.nav a[href="#amis"]'); if (!a) return;
  var tot = pendingIn() + dmUnreadTotal(), c2 = a.querySelector('i.count');
  if (tot && !c2) a.insertAdjacentHTML('beforeend', ' <i class="count">' + tot + '</i>'); else if (tot && c2) c2.textContent = tot; else if (!tot && c2) c2.remove();
}

/* --- affichage, abonnement temps réel, rattrapage --- */
function chatApply(){
  var g = document.getElementById('gchat'), l = document.getElementById('gc-launch'), d = document.getElementById('dmchat');
  if (!g) return;
  var logged = !!(S.me && S.players && S.players[S.me] && document.querySelector('header.top'));
  var allowed = logged && viewName() === 'arene';
  if (innerWidth >= 1700) CHT.open = true; else if (CHT.open === null) CHT.open = false;
  g.hidden = !(allowed && CHT.open); g.classList.toggle('open', allowed && CHT.open);
  l.hidden = !(allowed && !CHT.open); l.classList.toggle('has-new', CHT.fresh > 0);
  var cnt = l.querySelector('i.count'); cnt.hidden = !CHT.fresh; cnt.textContent = CHT.fresh;
  if (allowed && CHT.open) CHT.fresh = 0;
  if (!logged) d.hidden = true; else d.hidden = !CHT.dm;
  g.classList.toggle('dm-on', !d.hidden);
}
function chatSubscribe(){
  try {
    CHT.chan = sb.channel('legacy-chat-' + S.me)
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'chat_messages'}, function(p){ chatOnInsert(p.new); })
      .on('postgres_changes', {event: 'DELETE', schema: 'public', table: 'chat_messages'}, function(p){ chatOnDelete(p.old); })
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'chat_reactions'}, function(p){ if (p.new) rxSet(p.new.message_id, p.new.emoji, p.new.player, true); })
      .on('postgres_changes', {event: 'DELETE', schema: 'public', table: 'chat_reactions'}, function(p){ if (p.old && p.old.emoji) rxSet(p.old.message_id, p.old.emoji, p.old.player, false); })
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'dm_messages'}, function(p){ dmOnInsert(p.new); })
      .subscribe(function(st){ if (st === 'SUBSCRIBED' && CHT.loaded) { chatLoad(); if (CHT.dm) dmLoad(CHT.dm); dmLoadUnread(); } });
  } catch(e){}
}
function chatReset(){
  try { if (CHT.chan) sb.removeChannel(CHT.chan); } catch(e){}
  CHT.chan = null; CHT.msgs = []; CHT.ids = {}; CHT.loaded = false; CHT.dm = null; CHT.dmMsgs = []; CHT.unread = {}; CHT.fresh = 0;
}
function chatPoll(){   // filet de sécurité si la connexion temps réel s'interrompt : on rattrape les messages manquants
  if (!S.me || document.hidden) return;
  var last = 0; CHT.msgs.forEach(function(m){ if (m.id > last) last = m.id; });
  if (CHT.loaded) sb.from('chat_messages').select('id,author,body,at,kind').gt('id', last).order('at').limit(50).then(function(r){ (r.data || []).forEach(chatOnInsert); });
  if (CHT.dm && CHT.dmLoaded) {
    var lastDm = 0; CHT.dmMsgs.forEach(function(m){ if (m.id > lastDm) lastDm = m.id; });
    var pid = CHT.dm;
    sb.from('dm_messages').select('id,sender,recipient,body,at,read_at').gt('id', lastDm).or('and(sender.eq.' + S.me + ',recipient.eq.' + pid + '),and(sender.eq.' + pid + ',recipient.eq.' + S.me + ')').order('at').limit(50).then(function(r){ (r.data || []).forEach(dmOnInsert); });
  }
}
function chatTick(){
  var logged = !!(S.me && S.players && S.players[S.me]);
  if (!logged) { if (CHT.me) { chatReset(); CHT.me = null; } chatApply(); return; }
  if (CHT.me !== S.me) { chatReset(); CHT.me = S.me; chatSubscribe(); chatLoad(); dmLoadUnread(); }
  chatApply();
}
function chatInit(){
  if (document.getElementById('gchat')) return;
  document.body.insertAdjacentHTML('beforeend',
    '<aside id="gchat" class="gchat" hidden aria-label="Chat général"><header class="gc-head"><span>💬 Chat général</span><button type="button" class="gc-x" data-gcclose aria-label="Réduire le chat" title="Réduire">–</button></header>' +
    '<div class="gc-list" id="gc-list" aria-live="polite"></div>' +
    '<form class="gc-form" id="gc-form" autocomplete="off"><input id="gc-input" maxlength="300" placeholder="Écris un message…" aria-label="Ton message"><button class="btn sm primary" type="submit">Envoyer</button></form></aside>' +
    '<button type="button" id="gc-launch" class="gc-launch" hidden>💬 Chat <i class="count" hidden></i></button>' +
    '<aside id="dmchat" class="dmchat" hidden aria-label="Chat privé"><header class="gc-head"><span id="dm-who" class="dm-who"></span><button type="button" class="gc-x" data-dmclose aria-label="Fermer la conversation" title="Fermer">✕</button></header>' +
    '<div class="gc-list" id="dm-list" aria-live="polite"></div>' +
    '<form class="gc-form" id="dm-form" autocomplete="off"><input id="dm-input" maxlength="500" placeholder="Écris en privé…" aria-label="Ton message privé"><button class="btn sm primary" type="submit">Envoyer</button></form></aside>');
  document.getElementById('gc-form').addEventListener('submit', chatSend);
  document.getElementById('dm-form').addEventListener('submit', dmSend);
  document.addEventListener('click', function(e){
    var t = e.target.closest ? e.target.closest('[data-dm],[data-dmclose],[data-gcclose],#gc-launch,[data-gcdel],[data-gcrx],[data-gcrxopen],[data-lfm]') : null; if (!t) return;
    if (t.hasAttribute('data-dm')) { e.preventDefault(); dmOpen(t.getAttribute('data-dm')); }
    else if (t.hasAttribute('data-dmclose')) dmClose();
    else if (t.hasAttribute('data-gcclose')) { CHT.open = false; chatApply(); }
    else if (t.id === 'gc-launch') { CHT.open = true; CHT.fresh = 0; if (innerWidth < 1700) CHT.dm = null; chatApply(); var l = document.getElementById('gc-list'); if (l) l.scrollTop = l.scrollHeight; }
    else if (t.hasAttribute('data-gcrxopen')) { var pk = t.parentNode.querySelector('.gc-pick'); if (pk) pk.hidden = !pk.hidden; }
    else if (t.hasAttribute('data-gcrx')) { var pr = t.getAttribute('data-gcrx').split('|'); rxToggle(parseInt(pr[0], 10), pr[1]); }
    else if (t.hasAttribute('data-lfm')) {
      var on = t.getAttribute('data-lfm') === '1';
      sb.rpc('set_lfm', {p_on: on}).then(function(r){ if (r.error) { toast(cleanErr(r.error.message)); return; } var m0 = me(); if (m0) m0.lfm = r.data ? Date.parse(r.data) : 0; toast(on ? '🎯 Tes amis voient que tu cherches un match (30 min).' : 'Statut retiré.'); render(); });
    }
    else if (t.hasAttribute('data-gcdel')) { if (confirm('Supprimer ce message du chat ?')) sb.rpc('delete_chat_message', {p_id: parseInt(t.getAttribute('data-gcdel'), 10)}).then(function(r){ if (r.error) toast(cleanErr(r.error.message)); }); }
  });
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && S.me && CHT.loaded) { chatLoad(); if (CHT.dm) dmLoad(CHT.dm); dmLoadUnread(); } });
  window.addEventListener('hashchange', chatApply); window.addEventListener('resize', chatApply);
  setInterval(chatTick, 700); setInterval(chatPoll, 12000);
}

/* ---------- streams Twitch ---------- */
var liveCache = {}, LIVE_TTL = 55000;
function isLive(ch){ var c = ch && liveCache[ch]; return !!(c && c.live); }
function checkLive(ch){
  if (!ch) return;
  var c = liveCache[ch];
  if (c && (c.pending || Date.now() - c.at < LIVE_TTL)) return;
  liveCache[ch] = {live: c ? c.live : false, at: Date.now(), pending: true};
  fetch('https://decapi.me/twitch/uptime/' + encodeURIComponent(ch)).then(function(r){ return r.text(); }).then(function(txt){
    var live = !!txt && !/offline|not found|error|invalid/i.test(txt);
    var changed = (liveCache[ch].live !== live);
    liveCache[ch] = {live: live, at: Date.now()};
    if (changed && !typing()) render();
  }).catch(function(){ liveCache[ch] = {live: false, at: Date.now()}; });
}
function matchPlayersTwitch(m){
  return m.teamA.concat(m.teamB).filter(function(pid){ return !masked(m, pid); }).map(function(pid){ return {pid: pid, ch: P(pid).twitch}; }).filter(function(x){ return x.ch; });
}
function matchLive(m){
  if (m.status !== 'live' && m.status !== 'dispute' && m.status !== 'open') return false;
  var list = matchPlayersTwitch(m);
  list.forEach(function(x){ checkLive(x.ch); });
  return list.some(function(x){ return isLive(x.ch); });
}
function streamsSectionHTML(m){
  var list = matchPlayersTwitch(m);
  list.forEach(function(x){ checkLive(x.ch); });
  var live = list.filter(function(x){ return isLive(x.ch); });
  if (!live.length) {
    if (!list.length) return '';
    return '<section class="panel streams"><h2>📺 Streams</h2><p class="help">' + list.map(function(x){ return esc(P(x.pid).pseudo); }).join(', ') + (list.length > 1 ? ' ont' : ' a') + ' une chaîne Twitch. Si un live démarre, il s\'affichera ici automatiquement.</p></section>';
  }
  var host = location.hostname || 'nyro098.github.io';
  return '<section class="panel streams"><h2><span class="live-tag">🔴 LIVE</span> Le match en direct</h2><div class="stream-grid' + (live.length > 1 ? ' two' : '') + '">' +
    live.map(function(x){
      return '<figure class="stream"><div class="stream-frame"><iframe src="https://player.twitch.tv/?channel=' + encodeURIComponent(x.ch) + '&parent=' + encodeURIComponent(host) + '&muted=true&autoplay=true" allowfullscreen allow="autoplay; fullscreen" title="Stream Twitch de ' + esc(P(x.pid).pseudo) + '"></iframe></div>' +
        '<figcaption>' + av(P(x.pid), 'sm') + '<b>' + nm(P(x.pid)) + '</b><a href="https://www.twitch.tv/' + encodeURIComponent(x.ch) + '" target="_blank" rel="noopener noreferrer">Ouvrir sur Twitch ↗</a></figcaption></figure>';
    }).join('') + '</div><p class="help">Le son est coupé au départ : clique sur le lecteur pour l\'activer.</p></section>';
}

/* ---------- chrono anti-AFK (10 min pour contester) ---------- */
var CLAIM_MS = 10 * 60 * 1000, timeoutAsked = {};
function timerHTML(m, mt, myD, od){
  if (m.status !== 'live' || !m.firstDeclAt || (!!m.declA === !!m.declB)) return '';
  var until = m.firstDeclAt + CLAIM_MS, declSide = m.declA ? 'A' : 'B', declCap = declSide === 'A' ? capA(m) : capB(m);
  var claim = m.afkClaim ? 'une victoire par <b>AFK</b>' : ((declSide === 'A' ? m.declA : m.declB) === 'won' ? 'une victoire' : 'une défaite');
  var sc = declScore(m, declSide); if (sc && !m.afkClaim) claim += ' <b class="mono">' + sc[0] + '–' + sc[1] + '</b>';
  var cd = '<b class="countdown" data-until="' + until + '" data-id="' + esc(m.id) + '">' + mmss(until - Date.now()) + '</b>';
  var txt;
  if (mt && S.me === declCap) txt = 'Résultat envoyé. Si ton adversaire ne conteste pas dans ' + cd + ', ton résultat sera <b>validé automatiquement</b>.';
  else if (mt && (S.me === capA(m) || S.me === capB(m))) txt = '<b>' + esc(P(declCap).pseudo) + '</b> a déclaré ' + claim + '. Tu as ' + cd + ' pour contester en envoyant ton score ci-dessus, sinon son résultat sera validé.';
  else txt = '<b>' + esc(P(declCap).pseudo) + '</b> a déclaré ' + claim + '. Validation automatique dans ' + cd + ' sans contestation.';
  return '<div class="claim-timer"><span class="ct-ico">⏱️</span><p>' + txt + '</p></div>';
}
function mmss(ms){ if (ms <= 0) return '0:00'; var s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
setInterval(function(){
  var els = document.querySelectorAll('.countdown');
  Array.prototype.forEach.call(els, function(el){
    var left = parseInt(el.dataset.until, 10) - Date.now();
    el.textContent = mmss(left);
    el.classList.toggle('urgent', left < 60000);
    if (left <= 0 && !timeoutAsked[el.dataset.id] && sb) {
      timeoutAsked[el.dataset.id] = true;
      el.textContent = 'validation…';
      sb.rpc('resolve_timeout', {mid: el.dataset.id}).then(function(){ setTimeout(function(){ refresh().then(render); }, 800); });
    }
  });
}, 1000);

/* ---------- scores et captures ---------- */
function declScore(m, side){
  if (side === 'A') return m.aSA != null ? [m.aSA, m.aSB] : null;
  return m.bSA != null ? [m.bSB, m.bSA] : null;
}
var proofsCache = {};
function loadProofs(mid){
  if (proofsCache[mid] === 'loading') return;
  proofsCache[mid] = 'loading';
  sb.from('match_proofs').select('id,author,url,created_at').eq('match_id', mid).order('created_at', {ascending: true}).then(function(r){
    proofsCache[mid] = r.data || [];
    var el = document.getElementById('proofs-' + mid);
    if (el) el.innerHTML = proofsGridHTML(S.matches[mid], el.dataset.canadd === '1');
  });
}
function proofsGridHTML(m, canAdd){
  var list = proofsCache[m.id];
  if (!list || list === 'loading') return '<p class="help">Chargement des captures…</p>';
  var html = '<div class="proof-grid">' + list.map(function(x){
    return '<figure class="proof"><button class="proof-img" data-act="proof-view" data-url="' + esc(x.url) + '" aria-label="Agrandir la capture"><img src="' + esc(x.url) + '" alt="Capture du résultat" loading="lazy"></button><figcaption>' + av(P(x.author), 'sm') + '<span>' + esc(P(x.author).pseudo) + '<small>' + ago(Date.parse(x.created_at)) + '</small></span>' +
      (x.author === S.me || isAdmin() ? '<button class="btn sm ghost" data-act="proof-del" data-pid="' + x.id + '" data-id="' + esc(m.id) + '" title="Supprimer">✕</button>' : '') + '</figcaption></figure>';
  }).join('');
  if (canAdd && list.length < 8) html += '<label class="proof add"><input type="file" accept="image/*" class="proof-file" data-id="' + esc(m.id) + '"><span>📷</span><b>Ajouter une capture</b><small>' + list.length + '/8</small></label>';
  html += '</div>';
  if (!list.length && !canAdd) html = '<p class="help">Aucune capture pour ce match.</p>';
  return html;
}
function proofsSectionHTML(m, canAdd){
  if (!proofsCache[m.id]) loadProofs(m.id);
  return '<section class="panel"><h2>Captures du match</h2><p class="help">Les captures d\'écran du score servent de preuve en cas de litige. Clique sur une image pour l\'agrandir.</p><div id="proofs-' + esc(m.id) + '" data-canadd="' + (canAdd ? '1' : '0') + '">' + proofsGridHTML(m, canAdd) + '</div></section>';
}
function fitJpeg(file, max){
  return new Promise(function(resolve, reject){
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function(){
      var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h)), c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(function(b){ b ? resolve(b) : reject(new Error('conversion')); }, 'image/jpeg', 0.85);
    };
    img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error('format')); };
    img.src = url;
  });
}
function uploadProof(mid, file){
  if (!/^image\//.test(file.type || 'image/')) return Promise.reject(new Error('Choisis une image.'));
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error('Image trop lourde (25 Mo max).'));
  return fitJpeg(file, 1600).then(function(blob){
    var path = mid + '/' + S.me + '/' + Date.now() + '.jpg';
    return sb.storage.from('proofs').upload(path, blob, {contentType: 'image/jpeg', upsert: false}).then(function(r){
      if (r.error) throw r.error;
      return sb.rpc('add_proof', {mid: mid, p_url: sb.storage.from('proofs').getPublicUrl(path).data.publicUrl});
    }).then(function(r){ if (r.error) throw r.error; delete proofsCache[mid]; loadProofs(mid); });
  }).catch(function(e){ throw new Error(e && e.message === 'format' ? 'Format d\'image non reconnu. Essaie une capture JPG ou PNG.' : cleanErr(e && e.message)); });
}
function imgDialog(url){ return '<div class="overlay lightbox"><button class="x" data-act="close" aria-label="Fermer">×</button><img src="' + esc(url) + '" alt="Capture du résultat"></div>'; }

/* ---------- chat de match ---------- */
var chatCache = {};
function loadChat(mid){
  if (chatCache[mid] === 'loading') return;
  if (!chatCache[mid]) chatCache[mid] = 'loading';
  sb.from('match_messages').select('id,author,body,at,kind').eq('match_id', mid).order('at', {ascending: true}).limit(200).then(function(r){
    chatCache[mid] = r.data || [];
    paintChat(mid);
  });
}
function chatListHTML(mid){
  var list = chatCache[mid];
  if (!list || list === 'loading') return '<p class="help">Chargement…</p>';
  if (!list.length) return '<p class="help">Aucun message. Lance la discussion !</p>';
  return list.map(function(x){
    var p = P(x.author), mine = x.author === S.me;
    return '<div class="msg' + (mine ? ' mine' : '') + '">' + av(p, 'sm') + '<div class="bub"><b>' + nm(p) + badge(p) + ' <small>' + ago(Date.parse(x.at)) + '</small></b><span>' + esc(x.body) + '</span></div></div>';
  }).join('');
}
function paintChat(mid){
  var el = document.getElementById('chat-list');
  if (!el || S.lastMatch !== mid || viewName() !== 'match') return;
  el.innerHTML = chatListHTML(mid);
  el.scrollTop = el.scrollHeight;
}

/* ---------- équipes ---------- */
function canJoinA(m){ if (!m.teamATeam) return true; var tm = S.teams && S.teams[m.teamATeam]; return !!(tm && tm.members.some(function(mb){ return mb.player === S.me && mb.status === 'accepted'; })); }
function myTeams(){ return Object.keys(S.teams || {}).map(function(k){ return S.teams[k]; }).filter(function(x){ return x.members.some(function(mb){ return mb.player === S.me && mb.status === 'accepted'; }); }).sort(function(a, b){ return a.name.localeCompare(b.name); }); }
function teamInvites(){ return Object.keys(S.teams || {}).map(function(k){ return S.teams[k]; }).filter(function(x){ return x.members.some(function(mb){ return mb.player === S.me && mb.status === 'pending'; }); }); }
function teamComplete(x){ return x.members.filter(function(mb){ return mb.status === 'accepted'; }).length >= x.size; }
function tourBanRemain(until){ var ms = until - Date.now(); if (ms <= 0) return ''; var h = Math.floor(ms / 3.6e6), m = Math.ceil((ms % 3.6e6) / 6e4); return h > 0 ? h + ' h' + (m ? ' ' + (m < 10 ? '0' : '') + m : '') : m + ' min'; }
function tourRestrictPanelHTML(){
  var bans = Object.keys(S.tourBans || {}).filter(function(pid){ return S.tourBans[pid] > Date.now(); });
  var opts = [[1,'1 heure'],[2,'2 heures'],[3,'3 heures'],[6,'6 heures'],[12,'12 heures'],[24,'1 jour'],[72,'3 jours'],[168,'7 jours']];
  var dl = Object.keys(S.players).map(function(id){ return '<option value="' + esc(P(id).pseudo) + '">'; }).join('');
  var html = '<section class="panel esport-panel"><h2>🎮 Restreindre des joueurs de tournoi</h2><p class="help">Empêche un joueur de s\'inscrire aux tournois et parties perso pendant la durée choisie. Le staff ne peut pas être restreint.</p>' +
    '<form data-form="tour-restrict" novalidate><div class="row"><div><label for="tr-p">Joueur</label><input id="tr-p" name="pseudo" list="tr-players" autocomplete="off" required placeholder="Cherche un pseudo…"><datalist id="tr-players">' + dl + '</datalist></div>' +
    '<div><label for="tr-h">Durée</label><select id="tr-h" name="hours">' + opts.map(function(o){ return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></div></div>' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn danger" type="submit">Restreindre</button></div></form>';
  if (bans.length) html += '<h3 style="margin:16px 0 8px">Restreints actuellement (' + bans.length + ')</h3><div class="esport-bans">' + bans.sort(function(a,b){ return S.tourBans[a] - S.tourBans[b]; }).map(function(pid){ return '<div class="eban"><button class="tp" data-act="goto-player" data-pid="' + esc(pid) + '">' + av(P(pid), 'sm') + '<span>' + nm(P(pid)) + '</span></button><span class="help">encore ' + tourBanRemain(S.tourBans[pid]) + '</span><button class="btn sm ghost" data-act="tour-unrestrict" data-pid="' + esc(pid) + '">Lever</button></div>'; }).join('') + '</div>';
  else html += '<p class="help" style="margin-top:10px">Aucun joueur restreint pour l\'instant.</p>';
  return html + '</section>';
}
function teamsSectionHTML(){
  var mine = myTeams(), inv = teamInvites();
  var html = '<section class="panel teams-panel"><h2>Mes équipes</h2><p class="help">Crée une équipe avec tes potes : quand tu lances un 2v2 ou un 3v3, tu choisis ton équipe et les places de ton côté lui sont réservées.</p>';
  if (inv.length) html += '<div class="team-invites">' + inv.map(function(x){ var by = (x.members.find(function(mb){ return mb.player === S.me; }) || {}).invited_by; return '<div class="team-card pending"><div><b>' + esc(x.name) + '</b> <span class="fr-tag">' + x.size + 'v' + x.size + '</span><p class="help">' + esc(P(by).pseudo) + ' t\'invite dans son équipe.</p></div><div class="actions"><button class="btn sm primary" data-act="team-accept" data-id="' + esc(x.id) + '">Rejoindre</button><button class="btn sm ghost" data-act="team-decline" data-id="' + esc(x.id) + '">Refuser</button></div></div>'; }).join('') + '</div>';
  html += mine.length ? '<div class="team-grid">' + mine.map(function(x){
    var own = x.owner === S.me, acc = x.members.filter(function(mb){ return mb.status === 'accepted'; }).length, full = x.members.length >= x.size;
    var rows = x.members.slice().sort(function(a, b){ return (b.player === x.owner) - (a.player === x.owner); }).map(function(mb){
      var p = P(mb.player);
      return '<li>' + av(p, 'sm') + '<span class="nm">' + nm(p) + (mb.player === x.owner ? ' <i class="fr-tag">Chef</i>' : '') + (mb.status === 'pending' ? ' <i class="fr-tag">Invité</i>' : '') + '</span>' + (own && mb.player !== S.me ? '<button class="btn sm ghost" data-act="team-kick" data-id="' + esc(x.id) + '" data-pid="' + esc(mb.player) + '" title="Retirer">✕</button>' : '') + '</li>';
    }).join('');
    for (var i = x.members.length; i < x.size; i++) rows += '<li class="free"><span class="av sm empty-av">+</span><span class="nm">Place libre</span></li>';
    return '<div class="team-card"><div class="team-head"><b>' + esc(x.name) + '</b><span class="fr-tag">' + x.size + 'v' + x.size + '</span><span class="fr-tag ' + (acc >= x.size ? 'ok' : '') + '">' + (acc >= x.size ? 'Prête' : acc + '/' + x.size) + '</span></div><ul class="team-members">' + rows + '</ul><div class="actions">' +
      (!full ? '<button class="btn sm primary" data-act="pick" data-purpose="team" data-id="' + esc(x.id) + '">+ Inviter un joueur</button>' : '') +
      '<button class="btn sm ghost" data-act="team-leave" data-id="' + esc(x.id) + '">' + (own ? 'Supprimer l\'équipe' : 'Quitter') + '</button></div></div>';
  }).join('') + '</div>' : '<div class="empty"><b>Aucune équipe</b>Crée ta première équipe juste en dessous.</div>';
  html += '<form data-form="team-create" class="team-create" novalidate><input name="name" maxlength="24" autocomplete="off" placeholder="Nom de l\'équipe" aria-label="Nom de l\'équipe"><select name="size" aria-label="Taille"><option value="2">2v2</option><option value="3">3v3</option></select><button class="btn primary" type="submit">Créer l\'équipe</button></form><p class="err" role="alert"></p></section>';
  return html;
}

/* ---------- notifications ---------- */
function unread(){ return (S.notifs || []).filter(function(n){ return !n.read; }).length; }
function notifRow(n){
  var a = esc(P(n.actor).pseudo), t = S.teams && S.teams[n.team_id], m = S.matches[n.match_id], txt = '', act = '';
  var tn = t ? '« ' + esc(t.name) + ' »' : 'une équipe';
  var mDesc = m ? esc(m.mode) + ' ' + esc(m.format) + ' · ' + cn(m.stake) : 'un match';
  if (n.kind === 'friend_request') { txt = '<b>' + a + '</b> t\'a envoyé une demande d\'ami.'; if (rel(n.actor) === 'received') act = '<button class="btn sm primary" data-act="friend-accept" data-pid="' + esc(n.actor) + '">Accepter</button><button class="btn sm ghost" data-act="friend-decline" data-pid="' + esc(n.actor) + '">Refuser</button>'; }
  else if (n.kind === 'friend_accept') txt = '<b>' + a + '</b> a accepté ta demande d\'ami.';
  else if (n.kind === 'team_invite') { txt = '<b>' + a + '</b> t\'invite dans l\'équipe ' + tn + (t ? ' (' + t.size + 'v' + t.size + ')' : '') + '.'; if (t && t.members.some(function(mb){ return mb.player === S.me && mb.status === 'pending'; })) act = '<button class="btn sm primary" data-act="team-accept" data-id="' + esc(n.team_id) + '">Rejoindre</button><button class="btn sm ghost" data-act="team-decline" data-id="' + esc(n.team_id) + '">Refuser</button>'; }
  else if (n.kind === 'team_join') txt = '<b>' + a + '</b> a rejoint ton équipe ' + tn + '.';
  else if (n.kind === 'team_match') { txt = '<b>' + a + '</b> a lancé un match avec ton équipe ' + tn + ' : ' + mDesc + '.'; if (m) act = '<button class="btn sm primary" data-act="open-match" data-id="' + esc(m.id) + '">' + (m.status === 'open' && !teamOf(m, S.me) ? 'Rejoindre' : 'Voir') + '</button>'; }
  else if (n.kind === 'match_invite') { txt = '<b>' + a + '</b> t\'invite dans son match : ' + mDesc + '.'; if (m) act = '<button class="btn sm primary" data-act="open-match" data-id="' + esc(m.id) + '">Voir le match</button>'; }
  else if (n.kind === 'result_claim') { txt = '<b>' + a + '</b> a déclaré le résultat de votre match (' + mDesc + '). Tu as <b>10 minutes</b> pour contester.'; if (m) act = '<button class="btn sm primary" data-act="open-match" data-id="' + esc(m.id) + '">Voir le match</button>'; }
  else if (n.kind === 'custom_code') {
    var cpart = (n.note || '').split('|'), ccid = cpart[0], cno = cpart[1], ccode = cpart[2], cname = cpart.slice(3).join('|');
    txt = '🎮 Code de la partie perso <b>« ' + esc(cname) + ' »</b>' + (Number(cno) > 1 ? ' (partie ' + esc(cno) + ')' : '') + ' : <b class="code-inline">' + esc(ccode) + '</b>';
    act = '<button class="btn sm primary" data-act="copy-code" data-code="' + esc(ccode) + '">Copier</button><button class="btn sm" data-act="goto-custom" data-id="' + esc(ccid) + '">Voir la partie</button>';
  }
  else if (n.kind === 'tournament_win') { txt = '🏆 Tu as <b>gagné un tournoi</b> ! Tes gains ont été ajoutés à ton solde.'; act = '<button class="btn sm primary" data-act="goto-tours">Voir les tournois</button>'; }
  else if (n.kind === 'challenge') { txt = '<b>' + a + '</b> te défie en 1v1 : ' + mDesc + '.'; if (m) act = '<button class="btn sm primary" data-act="open-match" data-id="' + esc(m.id) + '">Voir le défi</button>'; }
  else if (n.kind === 'double_req') { txt = '🔥 <b>' + a + '</b> veut faire un <b>Double</b> (' + (m ? cn(m.stake * 2) : 'mise x2') + ') ! Clique sur Double pour accepter.'; if (m) act = '<button class="btn sm win" data-act="open-match" data-id="' + esc(m.id) + '">Répondre au Double</button>'; }
  else if (n.kind === 'double_go') { txt = '🔥 <b>' + a + '</b> a accepté le <b>Double</b> ! La revanche (' + mDesc + ') est lancée.'; if (m) act = '<button class="btn sm primary" data-act="open-match" data-id="' + esc(m.id) + '">Aller au match</button>'; }
  else if (n.kind === 'gift') {
    var parts = (n.note || '').split('|'), gItem = parts[0] || '', gMsg = parts[1] || '';
    var iLabel = gItem.indexOf('vcoins:') === 0 ? fmt(parseFloat(gItem.slice(7)) || 0) + ' V-Coins' : gItem === 'vip' ? 'le Pass VIP (1 mois)' : itemName(gItem);
    txt = '🎁 <b>' + a + '</b> t\'a offert <b>' + esc(iLabel) + '</b> en cadeau !' + (gMsg ? '<br><small style="color:var(--accent);font-style:italic">« ' + esc(gMsg) + ' »</small>' : '');
    act = '<button class="btn sm primary" data-act="shop-tab" data-tab="profil">Voir dans la boutique</button>';
  }
  else txt = 'Notification.';
  return '<li class="notif' + (n.read ? '' : ' new') + '">' + av(P(n.actor), 'sm') + '<div class="nt"><p>' + txt + '</p><small>' + ago(Date.parse(n.created_at)) + '</small>' + (act ? '<div class="actions">' + act + '</div>' : '') + '</div></li>';
}
function notifsDialog(){
  var list = S.notifs || [];
  return dialogShell('<h2 id="dt">Notifications</h2>' + (list.length ? '<ul class="notif-list">' + list.map(notifRow).join('') + '</ul>' : '<p class="help" style="margin-top:14px">Rien pour l\'instant. Les demandes d\'amis, invitations d\'équipe et invitations de match apparaîtront ici.</p>'));
}

/* ---------- choisir un joueur (inviter) ---------- */
var pickQ = '';
function pickCandidates(){
  var ctx = dlg || {}, q = pickQ.trim().toLowerCase(), ex = {};
  ex[S.me] = 1;
  if (ctx.purpose === 'team' && S.teams[ctx.id]) S.teams[ctx.id].members.forEach(function(mb){ ex[mb.player] = 1; });
  if (ctx.purpose === 'match' && S.matches[ctx.id]) S.matches[ctx.id].teamA.concat(S.matches[ctx.id].teamB).forEach(function(k){ ex[k] = 1; });
  return Object.keys(S.players).filter(function(k){ return !ex[k] && (!q || P(k).pseudo.toLowerCase().indexOf(q) >= 0); })
    .sort(function(a, b){ return (rel(b) === 'friend') - (rel(a) === 'friend') || P(a).pseudo.localeCompare(P(b).pseudo); }).slice(0, 25);
}
function pickListHTML(){
  var c = pickCandidates();
  if (!c.length) return '<p class="help">Aucun joueur trouvé.</p>';
  return '<ul class="fr-list">' + c.map(function(k){ return personRow(k, (rel(k) === 'friend' ? '<span class="fr-tag">Ami</span>' : '') + '<button class="btn sm primary" data-act="pick-send" data-pid="' + esc(k) + '">Inviter</button>'); }).join('') + '</ul>';
}
function pickDialog(){
  var ctx = dlg, title = ctx.purpose === 'team' ? 'Inviter dans « ' + esc((S.teams[ctx.id] || {}).name || '') + ' »' : 'Inviter dans le match';
  return dialogShell('<h2 id="dt">' + title + '</h2><input id="pick-q" type="search" autocomplete="off" placeholder="Rechercher un pseudo…" value="' + esc(pickQ) + '" style="margin-top:14px" aria-label="Rechercher un joueur"><p class="help" style="margin:8px 0">Tes amis apparaissent en premier.</p><div id="pick-list">' + pickListHTML() + '</div>');
}

/* ---------- boutique ---------- */
var ITEM_PRICE = 3;
var TITLES = {best_fighter: 'Best Fighter', roi_box: 'Roi du Box Fight', edit_machine: 'Edit Machine', build_god: 'Build God', clutch: 'Clutch Master', zone_wars: 'Pro des Zone Wars',
  piece_control: 'Piece Control', invaincu: 'Invaincu', sniper: 'Sniper d\'élite', sang_froid: 'Sang-froid', tryhard: 'Tryhard assumé', legende: 'Légende de l\'arène',
  cracked: 'Cracked', sweaty: 'Sweaty', aim_god: 'Aim God', pioche: 'Maître de la pioche', speedrunner: 'Speedrunner', no_scope: 'No-Scope',
  turtle: 'Roi du turtle', w_key: 'W-Key', one_pump: 'One Pump', cranker: 'Cranker 90s', realistic: 'Pro du Realistic', smurf: 'Smurf assumé',
  grinder: 'Grinder', chill: 'Toujours chill', trash_talk: 'Trash-talker'};
var RARE_TITLES = {intouchable: ['Intouchable', 10], predateur: ['Prédateur', 12], sans_pitie: ['Sans pitié', 12], monstre: ['Le Monstre', 12], le_boss: ['Le Boss', 15], phenomene: ['Phénomène', 15],
  prodige: ['Prodige', 18], demi_dieu: ['Demi-Dieu', 20], inarretable: ['L\'Inarrêtable', 20], legende_vivante: ['Légende vivante', 25], patron: ['Le Patron', 25], champion_legacy: ['Champion de Legacy', 30],
  empereur: ['L\'Empereur', 35], maitre_du_jeu: ['Maître du jeu', 35], prince_legacy: ['Prince de Legacy', 40], seigneur_arene: ['Seigneur de l\'arène', 45], goat: ['Le G.O.A.T', 50], main_de_dieu: ['Main de Dieu', 60],
  immortel: ['Immortel', 75], divin: ['Divin', 100], roi_legacy: ['Roi de Legacy', 150], reine_legacy: ['Reine de Legacy', 150], eternel: ['L\'Éternel', 175]};
function titleTier(k){ if (CASINO_TITLES[k]) return ' casino'; var r = RARE_TITLES[k]; return !r ? '' : r[1] >= 75 ? ' mythic' : r[1] >= 35 ? ' legend' : ' rare'; }
Object.keys(RARE_TITLES).forEach(function(k){ TITLES[k] = RARE_TITLES[k][0]; });
var LIMITED_UNTIL = Date.parse('2027-01-01T00:00:00+01:00');
var CATALOG = {
  'frame:neon': ['Cadre néon', 4], 'frame:fire': ['Cadre flammes', 6], 'frame:lightning': ['Cadre éclair', 6], 'frame:diamond': ['Cadre diamant', 8], 'frame:winter': ['Cadre Hiver 2026', 5],
  'banner:galaxy': ['Bannière galaxie', 5], 'banner:sunset': ['Bannière coucher de soleil', 5], 'banner:matrix': ['Bannière matrix', 5],
  'fx:galaxy': ['Pseudo galaxie', 5], 'fx:glitch': ['Pseudo glitch', 8], 'fx:sparkle': ['Pseudo scintillant', 6], 'fx:wave': ['Pseudo vague', 6],
  'emoji:fire': ['🔥', 2], 'emoji:crown': ['👑', 2], 'emoji:bolt': ['⚡', 2], 'emoji:gem': ['💎', 2], 'emoji:goat': ['🐐', 2], 'emoji:target': ['🎯', 2],
  'poster:lava': ['Affiche lave', 5], 'poster:ice': ['Affiche glace', 5], 'poster:galaxy': ['Affiche galaxie', 5], 'poster:gold': ['Affiche or', 6],
  'win:confetti': ['Victoire confettis', 6], 'win:lightning': ['Victoire éclairs', 8],
  'frame:gold': ['Cadre or', 10], 'frame:toxic': ['Cadre toxique', 10], 'frame:galaxy': ['Cadre galaxie', 12], 'frame:blood': ['Cadre sang', 12], 'frame:rainbow': ['Cadre arc-en-ciel', 15],
  'frame:plasma': ['Cadre plasma', 40], 'frame:crown': ['Cadre royal', 75], 'frame:legacy': ['Cadre Legacy holographique', 150],
  'banner:ocean': ['Bannière océan', 5], 'banner:aurora': ['Bannière aurore boréale', 8], 'banner:lava': ['Bannière lave', 8], 'banner:neon_city': ['Bannière ville néon', 10],
  'banner:gold_rush': ['Bannière ruée vers l\'or', 40], 'banner:legacy': ['Bannière Legacy mythique', 120],
  'banner:peaks': ['Sommets au crépuscule', 12], 'banner:night_sea': ['Mer de nuit', 12], 'banner:forest': ['Forêt enchantée', 12], 'banner:cyber_city': ['Ville cyber', 15],
  'banner:volcano': ['Volcan en éruption', 15], 'banner:storm_eye': ['Œil de la tempête', 15], 'banner:saturn': ['Planète aux anneaux', 18], 'banner:synthwave': ['Synthwave', 20],
  'banner:arena': ['Arène Legacy', 25], 'banner:phoenix': ['Phénix', 35], 'banner:throne': ['Salle du trône', 90],
  'banner:sig_ice': ['Signature Glace', 30], 'banner:sig_fire': ['Signature Feu', 30], 'banner:sig_toxic': ['Signature Toxique', 30], 'banner:sig_void': ['Signature Néant', 32],
  'banner:sig_gold': ['Signature Or', 35], 'banner:tera': ['Exclusivité Tera', 0], 'banner:shxwn': ['Exclusivité Shxwn', 0], 'banner:new_polska': ['Exclusivité New Polska', 0], 'banner:oriong': ['Exclusivité ORIONG Esport', 0], 'banner:tera_warrior': ['Exclusivité Tera · Le Guerrier', 2],
  'fx:shadow': ['Pseudo ombre', 8], 'fx:fire': ['Pseudo en feu', 10], 'fx:ice': ['Pseudo givré', 10], 'fx:gold': ['Pseudo or massif', 30], 'fx:holo': ['Pseudo holographique', 80],
  'emoji:skull': ['💀', 2], 'emoji:ghost': ['👻', 2], 'emoji:alien': ['👽', 2], 'emoji:rocket': ['🚀', 2], 'emoji:money': ['💸', 2], 'emoji:ninja': ['🥷', 2],
  'emoji:ice': ['🧊', 2], 'emoji:clown': ['🤡', 2], 'emoji:brain': ['🧠', 2], 'emoji:eyes': ['👀', 2], 'emoji:dragon': ['🐉', 10], 'emoji:unicorn': ['🦄', 10], 'emoji:trophy': ['🏆', 15],
  'poster:neon': ['Affiche néon', 6], 'poster:toxic': ['Affiche toxique', 6], 'poster:storm': ['Affiche tempête', 8], 'poster:legacy': ['Affiche Legacy mythique', 60],
  'win:fireworks': ['Victoire feu d\'artifice', 12], 'win:money': ['Victoire pluie de billets', 15], 'win:crown': ['Victoire couronne royale', 50]
};
var EMOJI = {fire: '🔥', crown: '👑', bolt: '⚡', gem: '💎', goat: '🐐', target: '🎯', skull: '💀', ghost: '👻', alien: '👽', rocket: '🚀', money: '💸', ninja: '🥷', ice: '🧊', clown: '🤡', brain: '🧠', eyes: '👀', dragon: '🐉', unicorn: '🦄', trophy: '🏆'};
var SIG = {sig_ice: 1, sig_fire: 1, sig_toxic: 1, sig_void: 1, sig_gold: 1};  // la bannière de Tera est une image avec son nom déjà dessus
function sigHTML(key, name){ return SIG[key] ? '<div class="sig-name' + (key === 'tera' ? ' sig-tera' : '') + '">' + (key === 'tera' ? '<i>Exclusivité</i>' : '') + '<b>' + esc(SIG[key] === 1 ? name : SIG[key]) + '</b><small>Legacy · Competitive player</small></div>' : ''; }
var RESERVED = {'banner:tera_warrior': ['tera x6', 'Tera'], 'banner:new_polska': ['NEW polska', 'New Polska']};  // en vente, mais achetable seulement par ce joueur
var SCENES = ['oriong', 'new_polska', 'tera_warrior', 'shxwn', 'sig_ice', 'sig_fire', 'sig_toxic', 'sig_void', 'sig_gold', 'tera', 'peaks', 'night_sea', 'forest', 'cyber_city', 'volcano', 'storm_eye', 'saturn', 'synthwave', 'arena', 'phoenix', 'throne'];
var WIN_ICON = {confetti: '🎉', lightning: '⚡', fireworks: '🎆', money: '💸', crown: '👑'};
function ownersOf(i){ var n = 0; for (var k in S.players) { var p = S.players[k]; if ((p.owned || []).indexOf(i) >= 0) n++; } return n; }
function itemPrice(i){ if (i.indexOf('title:') === 0) { var k = i.slice(6); return RARE_TITLES[k] ? RARE_TITLES[k][1] : ITEM_PRICE; } return CATALOG[i] ? CATALOG[i][1] : ITEM_PRICE; }
function isVipItem(i){ return i === 'neon' || i === 'gif' || (i.indexOf('title:') === 0 && !RARE_TITLES[i.slice(6)]); }
function hasItem(i){ var p = me(); return !!(p && ((p.owned || []).indexOf(i) >= 0 || (p.vip && isVipItem(i)))); }
function itemName(i){ return i === 'neon' ? 'Pseudo néon' : i === 'gif' ? 'Photo de profil animée' : i.indexOf('title:') === 0 ? 'Titre « ' + (TITLES[i.slice(6)] || i) + ' »' : (CATALOG[i] ? (i.indexOf('emoji:') === 0 ? 'Emoji ' : '') + CATALOG[i][0] : i); }
function buyBtn(i){
  if (hasItem(i)) return '<span class="fr-tag ok">✓ Débloqué</span>';
  if (i === 'frame:winter' && Date.now() >= LIMITED_UNTIL) return '<span class="fr-tag">Épuisé</span>';
  if (i === 'banner:tera') return '<span class="fr-tag excl">🔒 Réservée à Tera</span>';
  if (i === 'banner:oriong') return '<span class="fr-tag excl">🔒 Réservée à ORIONG Esport</span>';
  if (i === 'banner:shxwn') return '<span class="fr-tag excl-red">🔒 Réservée à Shxwn</span>';
  if (i === 'banner:new_polska') {
    var _p = me();
    if (_p && _p.pseudo && _p.pseudo.toLowerCase() === 'new polska') return '<button class="btn sm primary" data-act="buy-item" data-item="' + i + '">Gratuit</button>';
    return '<span class="fr-tag excl-ice">🔒 Réservée à New Polska</span>';
  }
  if (RESERVED[i] && (!me() || me().pseudo !== RESERVED[i][0])) return '<span class="fr-tag excl">🔒 Réservée à ' + RESERVED[i][1] + ' · ' + COIN + ' ' + itemPrice(i) + '</span>';
  var pr = itemPrice(i);
  return '<button class="btn sm primary" data-act="buy-item" data-item="' + i + '"' + (avail(S.me) < pr ? ' disabled' : '') + '>' + COIN + ' ' + pr + '</button>';
}
function slotOf(i){ return i.split(':')[0]; }
function isGiftable(i){
  if (i === 'banner:tera' || i === 'banner:shxwn' || i === 'banner:new_polska' || i === 'banner:oriong') return false;
  if (RESERVED[i]) return false;
  if (i === 'frame:winter' && Date.now() >= LIMITED_UNTIL) return false;
  if (i === 'neon' || i === 'gif') return false;
  return true;
}
function giftPrice(i){ return i === 'vip' ? 20 : itemPrice(i); }
function giftItemName(i){ return i === 'vip' ? 'Pass VIP (1 mois)' : itemName(i); }
function itemAction(i){
  var gift = isGiftable(i) ? '<button class="btn sm ghost gift-btn" title="Offrir à un joueur" data-act="gift-dialog" data-item="' + i + '">🎁 Offrir</button>' : '';
  if (!hasItem(i)) {
    var b = buyBtn(i);
    return gift ? '<div class="shop-act-row">' + b + gift + '</div>' : b;
  }
  var p = me(), slot = slotOf(i), on = p.eq && p.eq[slot] === i;
  var eqBtn = on ? '<button class="btn sm ghost" data-act="equip" data-slot="' + slot + '" data-item="">Retirer</button>' : '<button class="btn sm" data-act="equip" data-slot="' + slot + '" data-item="' + i + '">Équiper</button>';
  return gift ? '<div class="shop-act-row">' + eqBtn + gift + '</div>' : eqBtn;
}
function previewOf(i){
  var p = me(), slot = slotOf(i), key = i.split(':')[1];
  if (slot === 'frame') return '<span class="avf avf-' + key + '"><span class="av lg" style="--h:' + hue(p.pseudo) + '">' + (p.avatar ? '<img src="' + esc(p.avatar) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : ini(p.pseudo)) + '</span></span>';
  if (slot === 'banner') return '<span class="bn-prev bn-' + key + (SIG[key] ? ' sig-prev' : '') + '">' + (SIG[key] ? '<span class="sig-mini">' + esc(SIG[key] === 1 ? p.pseudo : SIG[key]) + '</span>' : '') + '</span>';
  if (slot === 'fx') return '<span class="si-demo"><span class="fx-' + key + '" data-t="' + esc(p.pseudo) + '">' + esc(p.pseudo) + '</span></span>';
  if (slot === 'emoji') return '<span class="emo-prev">' + EMOJI[key] + '</span>';
  if (slot === 'poster') return '<span class="pt-prev pt-' + key + '"></span>';
  if (slot === 'win') return '<span class="win-prev">' + (WIN_ICON[key] || '🎉') + '</span>';
  return '';
}
function itemCard(i, desc){
  var on = me().eq && me().eq[slotOf(i)] === i;
  return '<div class="shop-item' + (on ? ' on' : '') + '"><div class="si-prev">' + previewOf(i) + '</div><div class="si-txt"><b>' + esc(itemName(i)) + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' + itemAction(i) + '</div>';
}
var shopTab = 'vip';
function shopHTML(){
  var p = me();
  var tabs = [['vip', '👑 VIP'], ['profil', '✨ Profil'], ['matchs', '⚔️ Matchs'], ['titres', '🏷️ Titres'], ['limite', '⏳ Limité'], ['prestige', '💎 Prestige'], ['casino', '🎰 Casino']];
  var html = '<section class="hero"><div><p class="eyebrow">Boutique</p><h1>Fais briller ton profil.</h1><p class="lead">Dépense tes coins pour te démarquer. Achats définitifs, aucun argent réel. Ton solde : <b>' + cn(avail(S.me)) + '</b>' + ((p.owned || []).length ? ' · ' + (p.owned || []).length + ' article' + ((p.owned || []).length > 1 ? 's' : '') + ' achetés' : '') + '.</p></div></section>';
  html += '<div class="gift-banner"><div class="gift-banner-txt"><h3>🎁 Système de cadeaux</h3><p>Fais plaisir à n\'importe quel joueur : offre un effet de pseudo, un cadre, une bannière ou même le VIP !</p></div><button class="btn primary" data-act="gift-dialog">🎁 Offrir un cadeau</button></div>';
  html += '<div class="tabs shop-tabs" role="tablist">' + tabs.map(function(t){ return '<button role="tab" aria-selected="' + (shopTab === t[0]) + '" data-act="shop-tab" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  if (shopTab === 'vip') return html + vipShopHTML();
  if (shopTab === 'casino') return html + casinoShopHTML();
  if (shopTab === 'profil') {
    html += '<section><h2 class="sec shop-h">Cadres de photo</h2><div class="shop-grid">' + ['frame:neon', 'frame:fire', 'frame:lightning', 'frame:diamond', 'frame:gold', 'frame:toxic', 'frame:galaxy', 'frame:blood', 'frame:rainbow'].map(function(i){ return itemCard(i, 'Un contour animé autour de ta photo, partout sur le site.'); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Bannières Signature <span class="new-tag">Nouveau</span></h2><p class="help" style="margin-bottom:12px">Ton pseudo en énorme sur une scène animée : portail runique qui tourne, cristaux qui flottent, rayon de lumière.</p><div class="shop-grid scene-grid sig-grid">' +
      [['banner:tera', '❄️ La vraie bannière de Tera, réservée à lui seul : impossible à acheter.'], ['banner:shxwn', '🥀 Le lys rouge animé de Shxwn : pétales qui tombent, réservée à lui seul.'], ['banner:new_polska', '❄️ Avalanche et bonhomme de neige : le vrai GIF d\'hiver, réservé à New Polska.'], ['banner:tera_warrior', '⚔️ Le guerrier dans le vent : herbes emportées, nuages, soleil. Seul Tera peut l\'acheter… pour 2 coins.'], ['banner:sig_ice', 'Bleu glacé, cristaux et portail.'], ['banner:sig_fire', 'Rouge et orange, braises qui montent.'],
       ['banner:sig_toxic', 'Vert radioactif, éclats lumineux.'], ['banner:sig_void', 'Violet du néant, énergie mystique.'], ['banner:sig_gold', 'Or massif, pour les plus riches.'], ['banner:oriong', 'Bannière animée offerte à la team ORIONG Esport.']].filter(function(x){ return (x[0] !== 'banner:tera' || hasItem('banner:tera')) && (x[0] !== 'banner:oriong' || hasItem('banner:oriong')); }).map(function(x){ var c = itemCard(x[0], x[1]); return x[0] === 'banner:shxwn' ? c.replace('class="shop-item', 'class="shop-item shx-card') : x[0] === 'banner:tera_warrior' ? c.replace('class="shop-item', 'class="shop-item war-card') : x[0] === 'banner:new_polska' ? c.replace('class="shop-item', 'class="shop-item polska-card') : c; }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Bannières illustrées</h2><p class="help" style="margin-bottom:12px">De vraies scènes animées en haut de ton profil : étoiles qui scintillent, lucioles, projecteurs, éruption…</p><div class="shop-grid scene-grid">' +
      [['banner:peaks', 'Montagnes au soleil couchant et oiseaux.'], ['banner:night_sea', 'Lune, étoiles et reflets sur l\'eau.'], ['banner:forest', 'Sapins dans la brume et lucioles.'], ['banner:cyber_city', 'Gratte-ciel néon et soleil rétro.'],
       ['banner:volcano', 'Lave, étincelles et fumée.'], ['banner:storm_eye', 'Un vortex qui tourne et des éclairs.'], ['banner:saturn', 'Nébuleuse et planète à anneaux.'], ['banner:synthwave', 'Grille rétro et montagnes néon.'],
       ['banner:arena', 'Projecteurs, foule et logo Legacy.'], ['banner:phoenix', 'Un phénix aux ailes de feu.']].map(function(x){ return itemCard(x[0], x[1]); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Bannières de profil</h2><div class="shop-grid">' + ['banner:galaxy', 'banner:sunset', 'banner:matrix', 'banner:ocean', 'banner:aurora', 'banner:lava', 'banner:neon_city'].map(function(i){ return itemCard(i, 'Le fond animé en haut de ton profil.'); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Effets de pseudo</h2><div class="shop-grid">' + ['fx:galaxy', 'fx:glitch', 'fx:sparkle', 'fx:wave', 'fx:shadow', 'fx:fire', 'fx:ice'].map(function(i){ return itemCard(i, i === 'fx:galaxy' ? 'Dégradé galaxie cosmique et étoiles animées.' : 'Ton pseudo s\'anime partout.'); }).join('') + itemCard('neon', 'Choisis la couleur néon de ton pseudo.') + itemCard('gif', 'Mets un GIF comme photo de profil.') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Emoji à côté du pseudo</h2><div class="emoji-grid">' + Object.keys(EMOJI).map(function(k){ var i = 'emoji:' + k, on = p.eq && p.eq.emoji === i; return '<div class="emoji-item' + (on ? ' on' : '') + '"><span>' + EMOJI[k] + '</span>' + itemAction(i) + '</div>'; }).join('') + '</div></section>';
    if (hasItem('neon')) html += neonPickerHTML();
  } else if (shopTab === 'matchs') {
    html += '<section><h2 class="sec shop-h">Thème d\'affiche</h2><p class="help" style="margin-bottom:12px">Ton côté de l\'affiche de match avec un fond spécial.</p><div class="shop-grid">' + ['poster:lava', 'poster:ice', 'poster:galaxy', 'poster:gold', 'poster:neon', 'poster:toxic', 'poster:storm'].map(function(i){ return itemCard(i, ''); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Animation de victoire</h2><p class="help" style="margin-bottom:12px">Quand tu gagnes, l\'animation se joue sur la page du match, sous les yeux de ton adversaire.</p><div class="shop-grid">' + ['win:confetti', 'win:lightning', 'win:fireworks', 'win:money'].map(function(i){ return itemCard(i, ''); }).join('') + '</div></section>';
    html += '<section class="panel"><h2>📌 Défi épinglé · ' + cn(3) + '</h2><p class="help">Ton défi reste tout en haut de l\'arène pendant 1 heure. Ouvre un de tes défis ouverts et clique sur « Épingler ».</p></section>';
  } else if (shopTab === 'titres') {
    html += '<section><h2 class="sec shop-h">Titres légendaires</h2><p class="help" style="margin-bottom:12px">Dorés et animés, ils se voient de loin.</p><div class="title-grid">' + Object.keys(RARE_TITLES).filter(function(k){ return titleTier(k) === ' legend'; }).map(titleCard).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Titres rares</h2><div class="title-grid">' + Object.keys(RARE_TITLES).filter(function(k){ return titleTier(k) === ' rare'; }).map(titleCard).join('') + '</div></section>';
    html += '<section class="panel"><h2>💎 Les titres mythiques sont dans l\'onglet Prestige</h2><p class="help">Immortel, Divin, Roi de Legacy, L\'Éternel… les titres les plus rares du site.</p></section>';
    html += '<section><h2 class="sec shop-h">Titre exclusif de la roue</h2><p class="help" style="margin-bottom:12px">Impossible à acheter : seuls les plus chanceux le gagnent à la <a href="#roue">roue quotidienne</a>.</p><div class="title-grid">' + Object.keys(WHEEL_TITLES).map(function(k){
      var own = (p.owned || []).indexOf('title:' + k) >= 0, on = p.titleKey === k;
      return '<div class="title-item rare' + (on ? ' on' : '') + '"><span class="ptitle rare luck">' + esc(WHEEL_TITLES[k]) + '</span>' + (own ? (on ? '<button class="btn sm ghost" data-act="equip-title" data-key="">Retirer</button>' : '<button class="btn sm" data-act="equip-title" data-key="' + k + '">Équiper</button>') : '<span class="help">🎡 Roue uniquement</span>') + '</div>';
    }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Titres · ' + cn(ITEM_PRICE) + '</h2><p class="help" style="margin-bottom:12px">Inclus dans le VIP.</p><div class="title-grid">' + Object.keys(TITLES).filter(function(k){ return !RARE_TITLES[k]; }).map(titleCard).join('') + '</div></section>';
  } else if (shopTab === 'prestige') {
    html += prestigeHTML();
  } else if (shopTab === 'limite') {
    var left = LIMITED_UNTIL - Date.now(), days = Math.max(0, Math.ceil(left / 864e5));
    html += '<section class="limited"><p class="eyebrow">Édition limitée</p><h2 class="sec">Cadre Hiver 2026</h2><p class="help">' + (left > 0 ? 'Disponible encore <b>' + days + ' jour' + (days > 1 ? 's' : '') + '</b>, ensuite il ne sera plus jamais en vente.' : 'Cette édition est terminée.') + '</p><div class="shop-grid">' + itemCard('frame:winter', 'Flocons et givre animés autour de ta photo.') + '</div></section>';
    html += '<section class="panel"><h2>🏅 Badge Collectionneur</h2><p class="help">Gratuit et automatique dès que tu possèdes <b>10 articles</b> achetés. Tu en as ' + (p.owned || []).length + '/10.</p></section>';
  }
  return html;
}
function titleCard(k){
  var p = me(), own = hasItem('title:' + k), on = p.titleKey === k, rare = RARE_TITLES[k], tier = titleTier(k);
  var gift = '<button class="btn sm ghost gift-btn" title="Offrir ce titre" data-act="gift-dialog" data-item="title:' + k + '">🎁</button>';
  var main = own ? (on ? '<button class="btn sm ghost" data-act="equip-title" data-key="">Retirer</button>' : '<button class="btn sm" data-act="equip-title" data-key="' + k + '">Équiper</button>') : buyBtn('title:' + k);
  return '<div class="title-item' + (on ? ' on' : '') + tier + '"><span class="ptitle' + tier + '">' + esc(TITLES[k]) + '</span><div class="shop-act-row">' + main + gift + '</div></div>';
}
function prestigeCard(i, desc){
  var key = i.split(':')[1], isTitle = i.indexOf('title:') === 0, n = ownersOf(i);
  var prev = isTitle ? '<span class="ptitle big' + titleTier(key) + '">' + esc(TITLES[key]) + '</span>' : previewOf(i);
  var gift = isGiftable(i) ? '<button class="btn sm ghost gift-btn" title="Offrir à un joueur" data-act="gift-dialog" data-item="' + i + '">🎁 Offrir</button>' : '';
  var act = isTitle ? (hasItem(i) ? (me().titleKey === key ? '<button class="btn sm ghost" data-act="equip-title" data-key="">Retirer</button>' : '<button class="btn sm" data-act="equip-title" data-key="' + key + '">Équiper</button>') : buyBtn(i)) : itemAction(i);
  if (isTitle && gift) act = '<div class="shop-act-row">' + act + gift + '</div>';
  return '<div class="prestige-item"><div class="pi-prev">' + prev + '</div><div class="pi-txt"><b>' + esc(itemName(i)) + '</b><small>' + desc + '</small><span class="pi-own">' + (n ? '👥 ' + n + ' joueur' + (n > 1 ? 's' : '') + ' l\'ont' : '🔒 Personne ne l\'a encore') + '</span></div><div class="pi-buy">' + act + '</div></div>';
}
function prestigeHTML(){
  var html = '<section class="prestige-hero"><p class="eyebrow">💎 Prestige</p><h2>Les objets les plus rares de Legacy.</h2><p class="help">Hors de prix, ultra visibles, et presque personne ne les a. Le VIP ne les inclut pas.</p></section>';
  html += '<section><h2 class="sec shop-h">Titres mythiques</h2><div class="prestige-grid">' +
    prestigeCard('title:immortel', 'Holographique et animé, sous ton pseudo partout.') + prestigeCard('title:divin', 'Pour ceux qui ne perdent jamais.') +
    prestigeCard('title:roi_legacy', 'Le titre du patron de l\'arène.') + prestigeCard('title:reine_legacy', 'La reine de l\'arène, au même rang que le Roi.') + prestigeCard('title:eternel', 'Le plus cher du site. Une légende pour toujours.' + (ownersOf('title:eternel') ? '<span class="promo done">🎁 L\'offre de Tera a déjà été remportée.</span>' : '<span class="promo">🎁 (Le premier à l\'acheter recevra 1 500 V-Bucks de la part de Tera)</span>')) + '</div></section>';
  html += '<section><h2 class="sec shop-h">Cadres & bannières</h2><div class="prestige-grid">' +
    prestigeCard('frame:plasma', 'Un cadre d\'énergie qui pulse en continu.') + prestigeCard('frame:crown', 'Or massif, rubis et saphirs autour de ta photo.') + prestigeCard('frame:legacy', 'Le cadre holographique aux couleurs de Legacy.') +
    prestigeCard('banner:throne', 'Ta salle du trône : piliers d\'or, tapis rouge et couronne.') + prestigeCard('banner:gold_rush', 'Une pluie d\'or en haut de ton profil.') + prestigeCard('banner:legacy', 'La bannière mythique, holographique et animée.') + '</div></section>';
  html += '<section><h2 class="sec shop-h">Pseudo, affiche & victoire</h2><div class="prestige-grid">' +
    prestigeCard('fx:gold', 'Ton pseudo en or massif qui brille.') + prestigeCard('fx:holo', 'Ton pseudo change de couleur comme une carte holo.') +
    prestigeCard('poster:legacy', 'Ton côté de l\'affiche de match en version mythique.') + prestigeCard('win:crown', 'Une pluie de couronnes quand tu gagnes, sous les yeux de ton adversaire.') + '</div></section>';
  return html;
}
function neonPickerHTML(){
  var p = me();
  return '<section class="panel"><h2>Couleur de ton pseudo</h2><form data-form="cosmetics" novalidate><input type="hidden" name="title" value="' + esc(p.titleKey) + '">' +
    '<div class="neon-pick">' + NEON.map(function(n){ return '<label class="np"><input type="radio" name="style" value="' + n[0] + '"' + (p.nameStyle === n[0] ? ' checked' : '') + '><span class="' + (n[0] ? 'neon neon-' + n[0] : '') + '">' + esc(p.pseudo) + '</span><small>' + n[1] + '</small></label>'; }).join('') + '</div>' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Enregistrer la couleur</button></div></form></section>';
}
function vipShopHTML(){
  var p = me();
  return '<section class="vip-card' + (p.vip ? ' owned' : '') + '"><div class="vip-head"><em class="beta vip big">VIP</em><div><h2>Pass VIP</h2><p class="help">1 mois · l\'offre tout compris</p></div><div class="vip-price">' + COIN + '<b>20</b></div></div>' +
    '<ul class="vip-perks">' +
    '<li><span>👑</span><div><b>Badge VIP</b><small>Exclusif, à côté de ton pseudo partout.</small></div></li>' +
    '<li><span>✨</span><div><b>Pseudo néon</b><small>Toutes les couleurs, dont l\'arc-en-ciel animé.</small></div></li>' +
    '<li><span>🎞️</span><div><b>Photo animée</b><small>Un GIF comme photo de profil.</small></div></li>' +
    '<li><span>🏷️</span><div><b>12 titres</b><small>Tous les titres classiques débloqués.</small></div></li>' +
    '</ul>' +
    (p.vip ? '<p class="vip-owned">✓ Tu es VIP jusqu’au ' + dateTxt(p.vipUntil) + ' (encore ' + daysLeft(p.vipUntil) + ').</p><div class="actions"><button class="btn lg" data-act="buy-vip"' + (avail(S.me) < 20 ? ' disabled' : '') + '>Prolonger d’un mois · ' + cn(20) + '</button><button class="btn lg ghost gift-btn" data-act="gift-dialog" data-item="vip">🎁 Offrir le VIP</button></div>'
           : '<div class="actions"><button class="btn primary lg" data-act="buy-vip"' + (avail(S.me) < 20 ? ' disabled' : '') + '>Devenir VIP · ' + cn(20) + '</button><button class="btn lg ghost gift-btn" data-act="gift-dialog" data-item="vip">🎁 Offrir le VIP</button></div>' + (avail(S.me) < 20 ? '<p class="help">Il te faut 20 coins disponibles.</p>' : '')) +
    '<p class="help">Les cadres, bannières, effets, thèmes, titres rares et éditions limitées s\'achètent à part.</p></section>' + (hasItem('neon') ? neonPickerHTML() : '');
}

/* ---------- animation de victoire ---------- */
var winFxPlayed = {};
function winFxHTML(kind, mid){
  if (winFxPlayed[mid]) return '';
  winFxPlayed[mid] = true;
  var n = kind === 'confetti' ? 40 : kind === 'crown' ? 26 : kind === 'money' ? 22 : kind === 'fireworks' ? 16 : 10, parts = '';
  for (var i = 0; i < n; i++) {
    var left = Math.round(Math.random() * 100), delay = (Math.random() * 0.8).toFixed(2), hueV = Math.round(Math.random() * 360), dur = (1.8 + Math.random() * 1.4).toFixed(2);
    parts += kind === 'confetti'
      ? '<i style="left:' + left + '%;animation-delay:' + delay + 's;animation-duration:' + dur + 's;background:hsl(' + hueV + ' 90% 60%)"></i>'
      : '<i style="left:' + left + '%;animation-delay:' + delay + 's">' + (kind === 'fireworks' ? (i % 2 ? '🎆' : '🎇') : kind === 'money' ? (i % 3 ? '💸' : '💰') : kind === 'crown' ? (i % 4 ? '✨' : '👑') : '⚡') + '</i>';
  }
  return '<div class="win-fx win-' + kind + '" aria-hidden="true">' + parts + '</div>';
}

/* ---------- réception d'un cadeau : pop-up interactive & animée ---------- */
var giftQueue = [], giftShowing = false, giftSeenMem = {};
function giftSeenKey(){ return 'lg_gift_seen_v3_' + (S.me || 'anon'); }
function giftSeenGet(){
  try { return JSON.parse(localStorage.getItem(giftSeenKey()) || '{}') || {}; }
  catch(e){ return giftSeenMem; }
}
function giftSeenAdd(id){
  if (!id) return;
  var s = giftSeenGet();
  s[id] = 1;
  giftSeenMem[id] = 1;
  try { localStorage.setItem(giftSeenKey(), JSON.stringify(s)); } catch(e){}
}
function shopTabForItem(i){
  if (i === 'vip') return 'vip';
  if (i.indexOf('title:') === 0) return 'titres';
  if (i.indexOf('win:') === 0 || i.indexOf('poster:') === 0) return 'matchs';
  return 'profil';
}
function giftRevealPreview(item){
  var p = me() || {pseudo: 'Toi', avatar: ''};
  if (item.indexOf('vcoins:') === 0) return '<div class="gr-pv-vc">' + CC_ICON + '<b>+' + fmt(parseFloat(item.slice(7)) || 0) + '</b><small>V-Coins</small></div>';
  if (item === 'vip') {
    return '<div class="gr-pv-vip"><span class="gr-crown" aria-hidden="true">👑</span><span class="gr-vip-lbl">PASS VIP</span><small>Accès illimité 30 jours</small></div>';
  }
  if (item.indexOf('title:') === 0) {
    var tk = item.slice(6), tName = TITLES[tk] || WHEEL_TITLES[tk] || tk;
    return '<div class="gr-pv-title"><span class="ptitle lg' + titleTier(tk) + '">' + esc(tName) + '</span></div>';
  }
  var slot = slotOf(item), key = item.split(':')[1] || '';
  if (slot === 'frame') {
    return '<div class="gr-pv-frame"><span class="avf avf-' + key + ' xl"><span class="av xl' + (p.avatar ? ' has-img' : '') + '" style="--h:' + hue(p.pseudo) + '">' +
      (p.avatar ? '<img src="' + esc(p.avatar) + '" alt="">' : ini(p.pseudo)) + '</span></span></div>';
  }
  if (slot === 'banner') {
    var sigText = SIG[key] ? (SIG[key] === 1 ? p.pseudo : SIG[key]) : '';
    return '<div class="gr-pv-banner"><div class="bn-prev bn-' + key + (SIG[key] ? ' sig-prev' : '') + '">' +
      (sigText ? '<span class="sig-mini">' + esc(sigText) + '</span>' : '') + '</div></div>';
  }
  if (slot === 'fx') {
    return '<div class="gr-pv-fx"><span class="fx-' + key + '" data-t="' + esc(p.pseudo) + '">' + esc(p.pseudo) + '</span></div>';
  }
  if (slot === 'emoji') {
    return '<div class="gr-pv-emoji"><span>' + (EMOJI[key] || '✨') + '</span></div>';
  }
  if (slot === 'poster') {
    return '<div class="gr-pv-poster"><span class="pt-prev pt-' + key + '"></span></div>';
  }
  if (slot === 'win') {
    return '<div class="gr-pv-win"><span class="win-prev">' + (WIN_ICON[key] || '🎉') + '</span></div>';
  }
  return '<div class="gr-pv-generic"><span class="emo-prev">🎁</span></div>';
}
function checkGiftReveal(){
  if (!S.me || !S.notifs || !document.querySelector('header.top')) return;
  var seen = giftSeenGet();
  (S.notifs || []).slice().reverse().forEach(function(n){
    if (!n || n.kind !== 'gift') return;
    var item = String(n.note || '').split('|')[0] || '';
    if (n.actor === S.me && item.indexOf('vcoins:') !== 0) return;
    if (item === 'banner:oriong') return; // la bannière ORIONG a son propre pop-up
    if (seen[n.id] || giftSeenMem[n.id]) return;
    // Si la notif est déjà lue et date de plus de 7 jours, on l'ignore
    var age = Date.now() - (Date.parse(n.created_at) || 0);
    if (n.read && age > 7 * 864e5) { giftSeenAdd(n.id); return; }
    if (giftQueue.some(function(q){ return q.id === n.id; })) return;
    giftQueue.push(n);
  });
  if (!giftShowing && giftQueue.length) showNextGift();
}
function showNextGift(){
  if (document.querySelector('.gift-reveal')) return;
  var n = giftQueue.shift();
  if (!n) { giftShowing = false; return; }
  giftShowing = true;
  giftSeenAdd(n.id);
  if (sb && !n.read) {
    sb.from('notifications').update({read: true}).eq('id', n.id).then(function(){ n.read = true; });
  }

  var parts = String(n.note || '').split('|');
  var item = (parts[0] || '').trim();
  var msg = parts.slice(1).join('|').trim();
  var from = P(n.actor) || {pseudo: 'Un joueur', avatar: ''};
  var vcGift = item.indexOf('vcoins:') === 0, name = vcGift ? fmt(parseFloat(item.slice(7)) || 0) + ' V-Coins' : item === 'vip' ? 'Pass VIP (1 mois)' : (item.indexOf('title:') === 0 && WHEEL_TITLES[item.slice(6)] ? 'Titre « ' + WHEEL_TITLES[item.slice(6)] + ' »' : itemName(item));
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var burst = '', rain = '';
  for (var i = 0; i < 48; i++) {
    var ang = Math.random() * Math.PI * 2, dist = 140 + Math.random() * 260;
    burst += '<i style="--dx:' + Math.round(Math.cos(ang) * dist) + 'px;--dy:' + Math.round(Math.sin(ang) * dist) + 'px;--r:' + Math.round(Math.random() * 720 - 360) + 'deg;background:hsl(' + Math.round(Math.random() * 360) + ' 95% 62%);animation-delay:' + (Math.random() * 0.12).toFixed(2) + 's"></i>';
  }
  for (var j = 0; j < 36; j++) {
    rain += '<i style="left:' + Math.round(Math.random() * 100) + '%;animation-delay:' + (0.1 + Math.random() * 1.5).toFixed(2) + 's;animation-duration:' + (2.2 + Math.random() * 1.4).toFixed(2) + 's;background:hsl(' + Math.round(Math.random() * 360) + ' 90% 60%)"></i>';
  }

  var isEquippable = false, eqBtnLabel = '✨ Équiper maintenant', isEquipped = false;
  var myP = me();
  if (item === 'vip') {
    isEquippable = false;
  } else if (item.indexOf('title:') === 0) {
    isEquippable = true;
    eqBtnLabel = '✨ Équiper ce titre';
    isEquipped = myP && myP.titleKey === item.slice(6);
  } else {
    var sl = slotOf(item);
    if (sl && ['frame', 'banner', 'fx', 'emoji', 'poster', 'win'].indexOf(sl) >= 0) {
      isEquippable = true;
      isEquipped = myP && myP.eq && myP.eq[sl] === item;
    }
  }

  var actHtml = '';
  if (isEquippable) {
    if (isEquipped) {
      actHtml += '<button type="button" class="btn primary lg" disabled>✓ Déjà équipé</button>';
    } else {
      actHtml += '<button type="button" class="btn primary lg" data-act="gift-reveal-equip" data-item="' + esc(item) + '">' + eqBtnLabel + '</button>';
    }
  } else if (item === 'vip') {
    actHtml += '<button type="button" class="btn primary lg" data-act="gift-reveal-profile">👑 Voir mon statut VIP</button>';
  } else if (vcGift) {
    actHtml += '<button type="button" class="btn primary lg" data-act="gift-reveal-vc">🎰 Aller au casino</button>';
  }
  actHtml += '<button type="button" class="btn ghost" data-act="gift-reveal-close">Trop bien, merci ! 🎉</button>';
  if (!vcGift) actHtml += '<button type="button" class="btn ghost sm" data-act="gift-reveal-shop" data-item="' + esc(item) + '">Voir dans la boutique</button>';

  var html = '<div class="gift-reveal' + (reduce ? ' gr-reduce gr-opened gr-s2on' : '') + '" role="dialog" aria-modal="true" aria-label="Cadeau reçu">' +
    '<div class="gr-bg" data-act="gift-reveal-close" title="Fermer"></div>' +
    '<button type="button" class="gr-x" data-act="gift-reveal-close" aria-label="Fermer" title="Fermer (Échap)">✕</button>' +
    '<div class="gr-rays" aria-hidden="true"></div>' +
    '<div class="gr-flash" aria-hidden="true"></div>' +
    '<div class="gr-rain" aria-hidden="true">' + rain + '</div>' +
    '<div class="gr-stage">' +
      '<div class="gr-step gr-s1">' +
        '<div class="gr-intro">' + av(from, 'sm') + ' <span><b>' + esc(from.pseudo) + '</b> t\'envoie un cadeau !</span></div>' +
        '<button type="button" class="gr-box-wrap" data-act="gift-reveal-open" aria-label="Ouvrir le cadeau">' +
          '<div class="gr-box" aria-hidden="true">' +
            '<div class="gr-lid"><span class="gr-bow"></span></div>' +
            '<div class="gr-body"></div>' +
          '</div>' +
          '<div class="gr-pulse-glow" aria-hidden="true"></div>' +
        '</button>' +
        '<p class="gr-tap-hint">Touche la boîte pour l\'ouvrir !</p>' +
        '<button type="button" class="btn primary lg gr-open-btn" data-act="gift-reveal-open">🎁 Déballer mon cadeau</button>' +
      '</div>' +
      '<div class="gr-step gr-s2">' +
        '<div class="gr-burst" aria-hidden="true">' + burst + '</div>' +
        '<div class="gr-card">' +
          '<div class="gr-prev">' + giftRevealPreview(item) + '</div>' +
          '<p class="gr-from">' + av(from, 'sm') + ' <span><b>' + esc(from.pseudo) + '</b> t\'a offert</span></p>' +
          '<h2 class="gr-name">' + esc(name) + '</h2>' +
          (msg ? '<p class="gr-msg">« ' + esc(msg) + ' »</p>' : '') +
          '<div class="actions gr-actions">' + actHtml + '</div>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';

  document.body.insertAdjacentHTML('beforeend', html);
  var el = document.body.lastElementChild;

  function onKey(e){ if (e.key === 'Escape') closeGiftReveal(); }
  window.addEventListener('keydown', onKey);
  el._onKey = onKey;

  setTimeout(function(){
    var b = el.querySelector(reduce ? '.gr-card .btn' : '.gr-open-btn');
    if (b) try { b.focus(); } catch(x){}
  }, 100);
}
function openGiftReveal(){
  var el = document.querySelector('.gift-reveal');
  if (!el || el.classList.contains('gr-opened')) return;
  el.classList.add('gr-opened');
  try { winSound(4); } catch(e){}
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  setTimeout(function(){
    if (!el.isConnected) return;
    el.classList.add('gr-s2on');
    var b = el.querySelector('.gr-card .btn.primary') || el.querySelector('.gr-card .btn');
    if (b) try { b.focus(); } catch(x){}
  }, reduce ? 20 : 500);
}
function closeGiftReveal(){
  var el = document.querySelector('.gift-reveal');
  if (!el) {
    giftShowing = false;
    if (giftQueue.length) setTimeout(showNextGift, 250);
    return;
  }
  if (el._onKey) {
    window.removeEventListener('keydown', el._onKey);
    delete el._onKey;
  }
  if (el.classList.contains('gr-out')) return;
  el.classList.add('gr-out');
  setTimeout(function(){
    if (el.parentNode) el.parentNode.removeChild(el);
    giftShowing = false;
    if (giftQueue.length) {
      setTimeout(showNextGift, 250);
    }
  }, 320);
}

/* ---------- joueurs de la semaine ---------- */
function dateTxt(ts){ var d = new Date(ts); return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear(); }
function daysLeft(ts){ var d = Math.max(0, Math.ceil((ts - Date.now()) / 864e5)); return d + ' jour' + (d > 1 ? 's' : ''); }
function weeklyTop(){
  var since = Date.now() - 7 * 864e5, sc = {};
  Object.keys(S.matches).forEach(function(k){
    var m = S.matches[k];
    if (m.status !== 'done' || m.finishedAt < since) return;
    (m.winner === 'A' ? m.teamA : m.teamB).filter(function(pid){ return m.finishedAt >= (P(pid).statsResetAt || 0); }).forEach(function(pid){ sc[pid] = sc[pid] || {net: 0, w: 0, l: 0}; sc[pid].net += m.stake; sc[pid].w++; });
    (m.winner === 'A' ? m.teamB : m.teamA).filter(function(pid){ return m.finishedAt >= (P(pid).statsResetAt || 0); }).forEach(function(pid){ sc[pid] = sc[pid] || {net: 0, w: 0, l: 0}; sc[pid].net -= m.stake; sc[pid].l++; });
  });
  return Object.keys(sc).filter(function(pid){ return S.players[pid] && S.players[pid].status !== 'banned' && !S.players[pid].owner && sc[pid].w > 0; })
    .sort(function(a, b){ return sc[b].net - sc[a].net || sc[b].w - sc[a].w; }).slice(0, 3).map(function(pid){ return {pid: pid, s: sc[pid]}; });
}
function podiumHTML(compact){
  var top = weeklyTop();
  if (!top.length) return compact ? '' : '<section class="podium-wrap"><h2 class="sec">🏆 Joueurs de la semaine</h2><p class="help">Aucun match gagné ces 7 derniers jours. Le podium se remplit dès les premières victoires !</p></section>';
  var medals = ['🥇', '🥈', '🥉'], order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
  return '<section class="podium-wrap' + (compact ? ' compact' : '') + '"><h2 class="sec">🏆 Joueurs de la semaine</h2><p class="help">Les plus gros gains en coins sur les 7 derniers jours.</p><div class="podium">' +
    order.map(function(idx){ var x = top[idx], p = P(x.pid); return '<button class="pod pod-' + (idx + 1) + '" data-act="goto-player" data-pid="' + esc(x.pid) + '"><span class="medal">' + medals[idx] + '</span>' + av(p, idx === 0 ? 'lg' : '') + '<b>' + nm(p) + '</b>' + titleHTML(p) + '<span class="pod-net' + (x.s.net < 0 ? ' neg' : '') + '">' + (x.s.net > 0 ? '+' : x.s.net < 0 ? '−' : '') + fmt(Math.abs(x.s.net)) + ' ' + COIN + '</span><small>' + x.s.w + 'V · ' + x.s.l + 'D</small><span class="pod-step">' + (idx + 1) + '</span></button>'; }).join('') +
    '</div></section>';
}
function oldShopHTML2(){
  var p = me(), html = '<section class="hero"><div><p class="eyebrow">Boutique</p><h1>Fais briller ton profil.</h1><p class="lead">Dépense tes coins pour te démarquer dans l\'arène. Achats définitifs, aucun argent réel. Ton solde : <b>' + cn(avail(S.me)) + '</b>.</p></div></section>';
  // VIP
  html += '<section class="vip-card' + (p.vip ? ' owned' : '') + '"><div class="vip-head"><em class="beta vip big">VIP</em><div><h2>Pass VIP</h2><p class="help">À vie · débloque tout</p></div><div class="vip-price">' + COIN + '<b>20</b></div></div>' +
    '<ul class="vip-perks">' +
    '<li><span>👑</span><div><b>Badge VIP</b><small>Exclusif, à côté de ton pseudo partout sur le site.</small></div></li>' +
    '<li><span>✨</span><div><b>Pseudo néon</b><small>Toutes les couleurs, dont l\'arc-en-ciel animé.</small></div></li>' +
    '<li><span>🎞️</span><div><b>Photo animée</b><small>Mets un GIF comme photo de profil.</small></div></li>' +
    '<li><span>🏷️</span><div><b>Les ' + Object.keys(TITLES).length + ' titres</b><small>Tous débloqués, change quand tu veux.</small></div></li>' +
    '</ul>' +
    (p.vip ? '<p class="vip-owned">✓ Tu es VIP depuis ' + ago(p.vipSince || Date.now()) + '. Tout est débloqué.</p>'
           : '<div class="actions"><button class="btn primary lg" data-act="buy-vip"' + (avail(S.me) < 20 ? ' disabled' : '') + '>Devenir VIP · ' + cn(20) + '</button></div>' + (avail(S.me) < 20 ? '<p class="help">Il te faut 20 coins disponibles. Gagne des matchs pour en avoir plus !</p>' : '')) +
    '</section>';
  // À l'unité
  html += '<section><h2 class="sec" style="margin-bottom:6px">À l\'unité</h2><p class="help" style="margin-bottom:14px">Tu préfères juste un truc ? Chaque article coûte ' + cn(ITEM_PRICE) + '.</p><div class="shop-grid">' +
    '<div class="shop-item"><div class="si-ico">✨</div><div class="si-txt"><b>Pseudo néon</b><small>Ton pseudo brille : or, violet, cyan, rose, vert, rouge ou arc-en-ciel animé.</small><span class="si-demo"><span class="neon neon-rainbow">' + esc(p.pseudo) + '</span></span></div>' + buyBtn('neon') + '</div>' +
    '<div class="shop-item"><div class="si-ico">🎞️</div><div class="si-txt"><b>Photo de profil animée</b><small>Mets un GIF (4 Mo max) comme photo de profil.</small></div>' + buyBtn('gif') + '</div>' +
    '</div></section>';
  // Titres
  html += '<section><h2 class="sec" style="margin-bottom:6px">Titres</h2><p class="help" style="margin-bottom:14px">Un titre s\'affiche sous ton pseudo. Achète ceux que tu veux, puis équipe celui de ton choix.</p><div class="title-grid">' +
    Object.keys(TITLES).map(function(k){
      var own = hasItem('title:' + k), on = p.titleKey === k;
      return '<div class="title-item' + (on ? ' on' : '') + '"><span class="ptitle">' + esc(TITLES[k]) + '</span>' +
        (own ? (on ? '<button class="btn sm ghost" data-act="equip-title" data-key="">Retirer</button>' : '<button class="btn sm" data-act="equip-title" data-key="' + k + '">Équiper</button>') : buyBtn('title:' + k)) + '</div>';
    }).join('') + '</div></section>';
  // Style néon
  if (hasItem('neon')) {
    html += '<section class="panel"><h2>Couleur de ton pseudo</h2><form data-form="cosmetics" novalidate><input type="hidden" name="title" value="' + esc(p.titleKey) + '">' +
      '<div class="neon-pick">' + NEON.map(function(n){ return '<label class="np"><input type="radio" name="style" value="' + n[0] + '"' + (p.nameStyle === n[0] ? ' checked' : '') + '><span class="' + (n[0] ? 'neon neon-' + n[0] : '') + '">' + esc(p.pseudo) + '</span><small>' + n[1] + '</small></label>'; }).join('') + '</div>' +
      '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Enregistrer la couleur</button></div></form></section>';
  }
  if (hasItem('gif')) html += '<p class="help">🎞️ Photo animée débloquée : va sur <a href="#profil" data-act="myprofile">ton profil</a> → « Changer la photo » et choisis un GIF.</p>';
  return html;
}
var VIP_PRICE = 20;
var NEON = [['gold', 'Or'], ['violet', 'Violet'], ['cyan', 'Cyan'], ['rose', 'Rose'], ['green', 'Vert'], ['red', 'Rouge'], ['rainbow', 'Arc-en-ciel'], ['galaxy', 'Galaxie 🌌'], ['', 'Aucun']];
function oldShopHTML(){
  var p = me(), html = '<section class="hero"><div><p class="eyebrow">Boutique</p><h1>Fais briller ton profil.</h1><p class="lead">Dépense tes coins pour te démarquer dans l\'arène. Achats définitifs, aucun argent réel.</p></div></section>';
  html += '<section class="vip-card' + (p.vip ? ' owned' : '') + '"><div class="vip-head"><em class="beta vip big">VIP</em><div><h2>Pass VIP</h2><p class="help">À vie · achat unique</p></div><div class="vip-price">' + COIN + '<b>' + VIP_PRICE + '</b></div></div>' +
    '<ul class="vip-perks">' +
    '<li><span>👑</span><div><b>Badge VIP</b><small>À côté de ton pseudo, partout sur le site.</small></div></li>' +
    '<li><span>✨</span><div><b>Pseudo néon</b><small>Or, violet, cyan, rose, vert, rouge ou arc-en-ciel animé.</small></div></li>' +
    '<li><span>🎞️</span><div><b>Photo de profil animée</b><small>Mets un GIF comme photo de profil.</small></div></li>' +
    '<li><span>🏷️</span><div><b>Titre sous ton pseudo</b><small>« Best fighter », « Roi du box fight »… à toi de choisir.</small></div></li>' +
    '</ul>';
  if (p.vip) html += '<p class="vip-owned">✓ Tu es VIP depuis ' + ago(p.vipSince || Date.now()) + '. Personnalise ton style juste en dessous.</p></section>';
  else html += '<div class="actions"><button class="btn primary lg" data-act="buy-vip"' + (avail(S.me) < VIP_PRICE ? ' disabled' : '') + '>Devenir VIP · ' + cn(VIP_PRICE) + '</button></div>' +
    (avail(S.me) < VIP_PRICE ? '<p class="help">Il te faut ' + cn(VIP_PRICE) + ' disponibles. Tu en as ' + cn(avail(S.me)) + '. Gagne des matchs pour en avoir plus !</p>' : '') + '</section>';
  if (p.vip) {
    html += '<section class="panel"><h2>Ton style VIP</h2><form data-form="cosmetics" novalidate>' +
      '<label>Couleur néon du pseudo</label><div class="neon-pick">' + NEON.map(function(n){ return '<label class="np"><input type="radio" name="style" value="' + n[0] + '"' + (p.nameStyle === n[0] ? ' checked' : '') + '><span class="' + (n[0] ? 'neon neon-' + n[0] : '') + '">' + esc(p.pseudo) + '</span><small>' + n[1] + '</small></label>'; }).join('') + '</div>' +
      '<label for="v-title">Titre sous ton pseudo</label><input id="v-title" name="title" maxlength="24" autocomplete="off" value="' + esc(p.title) + '" placeholder="Ex. Best fighter">' +
      '<p class="hint">24 caractères maximum. Les titres déplacés peuvent être effacés par les admins.</p>' +
      '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Enregistrer mon style</button></div></form>' +
      '<p class="help" style="margin-top:6px">🎞️ Pour une photo animée : va sur <a href="#profil" data-act="myprofile">ton profil</a> → « Changer la photo » et choisis un GIF (4 Mo max).</p></section>';
  }
  return html;
}

/* ---------- amis ---------- */
var friendQ = '';
function rel(pid){
  var f = (S.friends || []).find(function(x){ return (x.requester === S.me && x.addressee === pid) || (x.addressee === S.me && x.requester === pid); });
  if (!f) return 'none';
  if (f.status === 'accepted') return 'friend';
  return f.requester === S.me ? 'sent' : 'received';
}
var onlinePeers = {};
function presence(pid){
  var p = P(pid);
  for (var k in S.matches) { var m = S.matches[k]; if ((m.status === 'live' || m.status === 'dispute') && teamOf(m, pid)) return {k: 'match', label: 'En match', mid: m.id}; }
  if (p.lfm && p.lfm > Date.now()) return {k: 'lfm', label: '🎯 Cherche un match'};
  if (pid === S.me || onlinePeers[pid] || (p.lastSeen && Date.now() - p.lastSeen < 300000)) return {k: 'online', label: 'En ligne'};
  return {k: 'off', label: p.lastSeen ? 'Hors ligne · vu ' + ago(p.lastSeen) : 'Hors ligne'};
}
function pendingIn(){ return (S.friends || []).filter(function(x){ return x.addressee === S.me && x.status === 'pending'; }).length; }
function friendBtn(pid){
  var r = rel(pid);
  if (pid === S.me) return '';
  if (r === 'friend') return dmBtn(pid) + '<span class="fr-tag">✓ Amis</span>';
  if (r === 'sent') return '<button class="btn sm ghost" data-act="friend-remove" data-pid="' + esc(pid) + '">Annuler la demande</button>';
  if (r === 'received') return '<button class="btn sm primary" data-act="friend-accept" data-pid="' + esc(pid) + '">Accepter</button>';
  return '<button class="btn sm primary" data-act="friend-add" data-pid="' + esc(pid) + '">+ Ajouter en ami</button>';
}
function personRow(pid, actions){
  var p = P(pid), pr = presence(pid);
  return '<li class="fr-row"><button class="fr-who" data-act="goto-player" data-pid="' + esc(pid) + '"><span class="fr-av">' + av(p) + '<i class="dot ' + pr.k + '"></i></span><span class="fr-txt"><b>' + nm(p) + badge(p) + '</b><small class="pr-' + pr.k + '">' + esc(pr.label) + '</small></span></button><div class="actions">' + actions + '</div></li>';
}
function searchResultsHTML(){
  var q = friendQ.trim().toLowerCase();
  if (!q) return '<p class="help">Tape au moins une lettre du pseudo.</p>';
  var res = Object.keys(S.players).filter(function(k){ return k !== S.me && S.players[k].pseudo.toLowerCase().indexOf(q) >= 0; })
    .sort(function(a, b){ return P(a).pseudo.toLowerCase().indexOf(q) - P(b).pseudo.toLowerCase().indexOf(q) || P(a).pseudo.localeCompare(P(b).pseudo); }).slice(0, 20);
  if (!res.length) return '<p class="help">Aucun joueur trouvé pour « ' + esc(friendQ) + ' ».</p>';
  return '<ul class="fr-list">' + res.map(function(k){ return personRow(k, friendBtn(k)); }).join('') + '</ul>';
}
function friendsHTML(){
  var F = S.friends || [];
  var other = function(x){ return x.requester === S.me ? x.addressee : x.requester; };
  var friends = F.filter(function(x){ return x.status === 'accepted'; }).map(other);
  var order = {lfm: 0, match: 0, online: 1, off: 2};
  friends.sort(function(a, b){ return order[presence(a).k] - order[presence(b).k] || P(a).pseudo.localeCompare(P(b).pseudo); });
  var inc = F.filter(function(x){ return x.status === 'pending' && x.addressee === S.me; }).map(function(x){ return x.requester; });
  var out = F.filter(function(x){ return x.status === 'pending' && x.requester === S.me; }).map(function(x){ return x.addressee; });
  var online = friends.filter(function(k){ return presence(k).k !== 'off'; }).length;
  var html = '<section><p class="eyebrow">Amis</p><h2 class="sec" style="margin-top:8px">Ta liste d\'amis</h2></section>';
  html += '<section class="panel"><h2>Rechercher un joueur</h2><input id="friend-q" type="search" autocomplete="off" placeholder="Tape un pseudo…" value="' + esc(friendQ) + '" aria-label="Rechercher un joueur"><div id="friend-results">' + searchResultsHTML() + '</div></section>';
  if (inc.length) html += '<section class="panel fr-incoming"><h2>Demandes reçues <i class="count">' + inc.length + '</i></h2><ul class="fr-list">' + inc.map(function(k){ return personRow(k, '<button class="btn sm primary" data-act="friend-accept" data-pid="' + esc(k) + '">Accepter</button><button class="btn sm ghost" data-act="friend-decline" data-pid="' + esc(k) + '">Refuser</button>'); }).join('') + '</ul></section>';
  html += '<section class="panel"><h2>Mes amis <small class="help" style="font:500 14px var(--f-body);text-transform:none;letter-spacing:0">' + friends.length + ' ami' + (friends.length > 1 ? 's' : '') + ' · ' + online + ' connecté' + (online > 1 ? 's' : '') + '</small></h2>' +
    (friends.length ? '<ul class="fr-list">' + friends.map(function(k){ var pr = presence(k); return personRow(k, (pr.k === 'match' ? '<button class="btn sm" data-act="open-match" data-id="' + esc(pr.mid) + '">Voir le match</button>' : '') + dmBtn(k) + '<button class="btn sm ghost" data-act="friend-remove" data-pid="' + esc(k) + '" title="Retirer de mes amis">Retirer</button>'); }).join('') + '</ul>'
      : '<div class="empty"><b>Pas encore d\'amis</b>Cherche un pseudo juste au-dessus et envoie une demande.</div>') + '</section>';
  if (out.length) html += '<section class="panel"><h2>Demandes envoyées</h2><ul class="fr-list">' + out.map(function(k){ return personRow(k, '<span class="fr-tag">En attente</span><button class="btn sm ghost" data-act="friend-remove" data-pid="' + esc(k) + '">Annuler</button>'); }).join('') + '</ul></section>';
  return html;
}

function reportHTML(){
  return '<section><p class="eyebrow">Signaler</p><h2 class="sec" style="margin-top:8px">Un problème avec un joueur ?</h2><p style="margin-top:12px;max-width:62ch;color:var(--fg-2)">Triche, faux résultat déclaré, insultes, joueur qui ne se présente pas… Ne règle pas ça tout seul : ouvre un ticket sur le Discord.</p></section>' +
    '<ol class="steps">' +
    '<li><div><b>Rejoins le Discord GRIND</b><p>Si ce n\'est pas déjà fait, clique sur le bouton ci-dessous.</p></div></li>' +
    '<li><div><b>Ouvre un ticket</b><p>Va dans le salon des tickets du serveur et crée un ticket. Donne le pseudo du joueur, le match concerné et explique ce qui s\'est passé.</p></div></li>' +
    '<li><div><b>Ajoute tes preuves</b><p>Captures d\'écran, clips vidéo, messages : plus tu en donnes, plus c\'est rapide à régler.</p></div></li>' +
    '<li><div><b>Un modérateur te répondra</b><p>Il regarde les preuves et tranche. Si besoin, il annule le match ou rend les coins.</p></div></li>' +
    '</ol><div class="actions">' + dcBtn('Ouvrir le Discord pour faire un ticket') + '</div>';
}

var RULES = [
  ['Gratuit à 100 %', ['Aucun paiement, abonnement ni achat, ni en argent réel, ni en monnaie du jeu (V-Bucks).', 'Pas de publicité payante ni de sponsor qui oblige à payer quoi que ce soit.']],
  ['Aucun dépôt, aucun retrait', ['Il est impossible d\'ajouter de l\'argent sur le site.', 'Il est impossible de retirer de l\'argent, des V-Bucks, des cartes cadeaux ou toute récompense ayant une valeur réelle.', 'Les coins n\'ont aucune valeur monétaire : ils ne peuvent pas être échangés, vendus ni convertis.']],
  ['Utilisation des coins', ['Les coins servent uniquement à des activités sur le site : défis, classements, tournois amicaux, personnalisation du profil.', 'Les coins sont gagnés uniquement en jouant ou en participant (défis, missions, événements).']],
  ['Pas de jeu d\'argent', ['Pas de paris, loteries payantes ni de mises de coins pour gagner autre chose.', 'Aucun hasard lié à une récompense de valeur.']],
  ['Sécurité et vie privée', ['Ne jamais demander de mot de passe Epic Games, d\'e-mail de connexion ni de moyen de paiement.', 'Pas de collecte de données personnelles inutiles.', 'Un âge minimum est conseillé, avec l\'accord des parents pour les mineurs.']],
  ['Fair-play', ['Pas de triche, de bots, de multi-comptes ni d\'exploitation de failles.', 'Sanctions progressives : avertissement, puis suspension, puis bannissement.']],
  ['Comportement', ['Pas d\'insultes, de harcèlement ni de discrimination.', 'Les pseudos et contenus inappropriés sont modérés.']],
  ['Mentions légales', ['Le site n\'est pas affilié à Epic Games ni à Fortnite, et il doit l\'indiquer clairement.', 'Il ne doit pas utiliser les logos ou marques de Fortnite d\'une façon qui laisse croire à un partenariat officiel.']],
  ['Transparence', ['Les règles sont visibles et accessibles à tous.', 'Elles peuvent évoluer, avec une annonce claire aux utilisateurs.']]
];
var ruleTab = 0;
function ruleBlock(i){ return '<div class="rule-block"><h3><span>' + (i + 1) + '</span>' + esc(RULES[i][0]) + '</h3><ul>' + RULES[i][1].map(function(x){ return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>'; }
function rulesHTML(){
  return '<section><p class="eyebrow">Règles</p><h2 class="sec" style="margin-top:8px">Les règles de Legacy</h2></section>' +
    '<div class="tabs rule-tabs" role="tablist">' + RULES.map(function(r, i){ return '<button role="tab" aria-selected="' + (ruleTab === i) + '" data-act="rule-tab" data-i="' + i + '">' + (i + 1) + '. ' + esc(r[0]) + '</button>'; }).join('') + '</div>' +
    ruleBlock(ruleTab) +
    (me() && me().rulesAt ? '<p class="help">Tu as accepté ces règles ' + ago(me().rulesAt) + '.</p>' : '');
}
function rulesGateHTML(){
  return betaBar() + '<div class="wrap main"><div><div class="logo">' + LOGO + '<span>Legacy</span><em class="beta">BÊTA</em></div><h1 class="sec" style="font-size:clamp(36px,7vw,60px);margin-top:12px">Les règles</h1><p style="color:var(--fg-2);margin-top:10px;max-width:60ch">Salut <b>' + esc(me().pseudo) + '</b> ! Avant de jouer, lis et accepte les règles du site. Tu n\'auras à le faire qu\'une seule fois.</p></div>' +
    '<div class="rules-all">' + RULES.map(function(r, i){ return ruleBlock(i); }).join('') + '</div>' +
    '<div class="card"><label class="rules-check"><input type="checkbox" id="rules-ok"> J\'ai lu les règles et je m\'engage à les respecter.</label>' +
    '<div class="actions" style="margin-top:14px"><button class="btn primary lg" id="rules-btn" data-act="rules-accept" disabled>Accepter les règles</button></div>' +
    '<p class="hint" style="margin-top:14px">Pas le bon compte ? <button class="linkbtn" data-act="logout">Se déconnecter</button></p></div></div>';
}
function oldRulesHTML(){
  return '<section><p class="eyebrow">Règles</p><h2 class="sec" style="margin-top:8px">Comment ça marche</h2></section><ol class="steps">' +
    '<li><div><b>Tu démarres avec ' + cn(START) + '</b><p>Chaque nouveau joueur reçoit ' + cn(START) + ' à l\'inscription. Un seul compte par Discord. Les coins n\'ont aucune valeur réelle : pas d\'achat, pas de retrait. Personne ne peut dépasser ' + MAXC + ' coins : au-delà, le surplus d\'une victoire est perdu.</p></div></li>' +
    '<li><div><b>Lance ou rejoins un défi</b><p>Choisis le mode, le format (1v1, 2v2 ou 3v3), le format (premier à 3, 5 ou 7, avec ou sans ping-pong) et ta mise, par tranches de 0,5 coin. Ta mise sort de ton solde dès que tu rejoins et part dans le pot.</p></div></li>' +
    '<li><div><b>Jouez sur Fortnite</b><p>Le match démarre quand les deux équipes sont complètes. Mettez-vous d\'accord sur l\'île et les règles dans le chat du match.</p></div></li>' +
    '<li><div><b>Les deux capitaines déclarent le résultat</b><p>Le premier joueur de chaque équipe est son capitaine. Si les deux déclarations concordent, chaque gagnant récupère sa mise plus celle d\'un perdant. Les perdants ne revoient jamais leur mise. Si l\'autre capitaine ne conteste pas dans les 10 minutes après la première déclaration (par exemple s\'il est AFK), le résultat déclaré est validé automatiquement. En cas de désaccord ou de triche, ouvre un ticket sur le Discord (onglet Signaler) : un modérateur tranchera à partir des preuves.</p></div></li>' +
    '<li><div><b>À zéro coin ?</b><p>Tu gardes ton profil et n\'importe quel joueur peut t\'envoyer des coins avec un pourboire.</p></div></li></ol>';
}

function welcomeHTML(){
  return betaBar() + '<div class="wrap welcome"><div><div class="logo">' + LOGO + '<span>Legacy</span><em class="beta">BÊTA</em></div><h1>Les défis Fortnite qui comptent.</h1><p style="color:var(--fg-2);margin-top:16px;max-width:42ch">Mise des coins, gagne contre un autre joueur ou une autre équipe et grimpe au classement. ' + cn(START) + ' offerts à l\'inscription.</p><div style="margin-top:18px">' + dcBtn('Rejoindre le Discord GRIND') + '</div></div>' +
    '<div class="card auth"><div class="tabs" role="tablist" style="margin-bottom:6px"><button role="tab" aria-selected="' + (authTab === 'login') + '" data-act="auth-tab" data-tab="login">Connexion</button><button role="tab" aria-selected="' + (authTab === 'signup') + '" data-act="auth-tab" data-tab="signup">Inscription</button></div>' +
    (authTab === 'login'
      ? '<form data-form="login" novalidate><label for="l-discord">Discord</label><input id="l-discord" name="discord" required maxlength="64" autocomplete="username" placeholder="Ton pseudo Discord">' +
        '<label for="l-pw">Mot de passe</label><input id="l-pw" name="password" type="password" required autocomplete="current-password">' +
        '<p class="err" role="alert"></p><button class="btn primary" type="submit" style="width:100%">Se connecter</button></form>' +
        '<p class="hint" style="margin-top:16px">Pas encore de compte ? <button class="linkbtn" data-act="auth-tab" data-tab="signup">Inscris-toi</button> et reçois ' + cn(START) + '.</p>'
      : '<form data-form="signup" novalidate><label for="w-discord">Discord</label><input id="w-discord" name="discord" required maxlength="64" autocomplete="username" placeholder="Ton pseudo Discord">' +
        '<label for="w-pseudo">Pseudo Fortnite</label><input id="w-pseudo" name="pseudo" required maxlength="24" autocomplete="off" placeholder="Ton pseudo exact, espaces et symboles OK">' +
        '<div class="row"><div><label for="w-pw">Mot de passe</label><input id="w-pw" name="password" type="password" required autocomplete="new-password"></div>' +
        '<div><label for="w-pw2">Confirmer</label><input id="w-pw2" name="password2" type="password" required autocomplete="new-password"></div></div>' +
        '<label for="w-twitter">X / Twitter (facultatif)</label><input id="w-twitter" name="twitter" maxlength="33" autocomplete="off" placeholder="@pseudo">' +
        '<p class="hint">Un seul compte par Discord. Tous les caractères sont acceptés. Mot de passe : 8 caractères minimum.</p>' +
        '<p class="err" role="alert"></p><button class="btn primary" type="submit" style="width:100%">Créer mon compte</button></form>') +
    '</div></div>';
}

/* ---------- fenêtres ---------- */
function dialogShell(inner){ return '<div class="overlay"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dt"><button class="x" data-act="close" aria-label="Fermer">×</button>' + inner + '</div></div>'; }
function newMatchDialog(){
  var a = Math.max(avail(S.me), 0);
  if (a < 0.5) return dialogShell('<h2 id="dt">Lancer un défi</h2><p style="margin-top:14px">Il te faut au moins 0,5 coin disponible pour miser (tu en as ' + cn(a) + '). Demande un pourboire à un autre joueur.</p><div class="actions" style="margin-top:18px"><button class="btn" data-act="copy-pseudo">Copier mon pseudo</button><button class="btn ghost" data-act="close">Fermer</button></div>');
  var others = Object.keys(S.players).filter(function(k){ return k !== S.me; }).sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); });
  var initStake = a >= 1 ? 1 : 0.5;
  return dialogShell('<h2 id="dt">Lancer un défi</h2><form data-form="match" novalidate>' +
    '<label for="c-mode">Mode</label><select id="c-mode" name="mode">' + MODES.map(function(x){ return '<option>' + x + '</option>'; }).join('') + '</select>' +
    '<div class="row"><div><label for="c-format">Équipes</label><select id="c-format" name="format"><option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option></select></div>' +
    '<div><label for="c-bo">Format</label><select id="c-bo" name="bo">' + BOS.map(function(x, i){ return '<option value="' + x + '"' + (i === 1 ? ' selected' : '') + '>' + BO_LABEL[x] + '</option>'; }).join('') + '</select></div></div>' +
    '<label for="c-kl">Kill lead</label><select id="c-kl" name="kill_lead"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select>' +
    '<label class="rules-check pp-check"><input type="checkbox" name="pingpong" value="1"> Ping-pong <small>(il faut gagner avec 2 points d\'écart)</small></label>' +
    '<label class="rules-check pp-check"><input type="checkbox" name="nobreak" value="1"> 🚫 Casser interdit <small>(interdit de casser les constructions de l\'adversaire)</small></label>' +
    '<label for="c-stake">Mise par joueur (coins)</label><input id="c-stake" name="stake" type="number" inputmode="decimal" min="0.5" max="' + a + '" step="0.5" value="' + initStake + '" required><p class="hint">Disponible : ' + cn(a) + '. Mise par tranches de 0,5 (ex. 0,5 · 1 · 1,5). Ta mise sort de ton solde tout de suite.</p>' +
    '<label for="c-target">Adversaire (1v1 uniquement)</label><select id="c-target" name="target"><option value="">Ouvert à tous</option>' + others.map(function(k){ return '<option value="' + esc(k) + '">' + esc(P(k).pseudo) + '</option>'; }).join('') + '</select>' +
    '<label for="c-team">Ton équipe (2v2 / 3v3)</label><select id="c-team" name="team" disabled><option value="">Aucune : places libres pour n\'importe qui</option>' + myTeams().filter(function(x){ return teamComplete(x); }).map(function(x){ return '<option value="' + esc(x.id) + '" data-size="' + x.size + '" hidden>' + esc(x.name) + ' (' + x.size + 'v' + x.size + ')</option>'; }).join('') + '</select><p class="hint" id="c-team-hint">Pas d\'équipe en 1v1.</p>' +
    '<label for="c-rules">Règles, code île (facultatif)</label><input id="c-rules" name="rules" maxlength="120" autocomplete="off" placeholder="Ex. île 1v1, premier à 3 rounds">' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Publier le défi</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function betDialog(mid, defaultSide){
  var m = S.matches[mid];
  if (!m) return dialogShell('<h2 id="dt">Parier</h2><p style="margin-top:14px">Match introuvable.</p>');
  var a = Math.max(avail(S.me), 0);
  if (a < 0.5) return dialogShell('<h2 id="dt">Parier sur ce match</h2><p style="margin-top:14px">Il te faut au moins 0,5 coin disponible pour parier (tu en as ' + cn(a) + ').</p><div class="actions" style="margin-top:18px"><button class="btn ghost" data-act="close">Fermer</button></div>');
  
  var myB = myBet(mid);
  var side = myB ? myB.side : (defaultSide || 'A');
  var pA = PM(m, m.teamA[0]), pB = m.teamB.length ? PM(m, m.teamB[0]) : null;
  var nameA = m.size > 1 ? 'Équipe A (' + esc(pA.pseudo) + '...)' : esc(pA.pseudo);
  var nameB = m.size > 1 ? ('Équipe B' + (pB ? ' (' + esc(pB.pseudo) + '...)' : '')) : (pB ? esc(pB.pseudo) : 'Équipe B (en attente)');
  var initAmt = Math.min(1, a);

  return dialogShell('<h2 id="dt">🎲 Parier sur le match · x2</h2>' +
    '<p class="help" style="margin-top:6px">Multiplicateur <b>x2 fixe</b> : si ton équipe gagne, ta mise est doublée !</p>' +
    '<form data-form="place-bet" data-id="' + esc(mid) + '" novalidate style="margin-top:14px">' +
    '<label>Choisis ton équipe gagnante</label>' +
    '<div class="bet-side-picker" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">' +
      '<label class="bet-opt"><input type="radio" name="side" value="A"' + (side === 'A' ? ' checked' : '') + (myB && myB.side !== 'A' ? ' disabled' : '') + '><span><b>🔵 Équipe A</b><small>' + nameA + '</small></span></label>' +
      '<label class="bet-opt"><input type="radio" name="side" value="B"' + (side === 'B' ? ' checked' : '') + (myB && myB.side !== 'B' ? ' disabled' : '') + '><span><b>🔴 Équipe B</b><small>' + nameB + '</small></span></label>' +
    '</div>' +
    '<label for="b-amount">Montant du pari (coins)</label>' +
    '<input id="b-amount" name="amount" type="number" inputmode="decimal" min="0.5" max="' + Math.min(a, 100) + '" step="0.5" value="' + initAmt + '" required>' +
    '<p class="hint">Disponible : <b>' + cn(a) + '</b>. Gain si victoire : <b id="bet-win-calc" class="w" style="color:#ffc93c">' + fmt(initAmt * 2) + ' coins (x2)</b>.</p>' +
    (myB ? '<p class="help" style="margin-top:8px">ℹ️ Tu as déjà parié ' + cn(myB.amount) + ' sur l\'équipe ' + myB.side + '. Ce montant s\'ajoutera à ton pari !</p>' : '') +
    '<p class="err" role="alert"></p>' +
    '<div class="actions" style="margin-top:18px"><button class="btn primary lg" type="submit">Confirmer le pari</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function playerOptions(sel){
  return Object.keys(S.players).filter(function(k){ return k !== S.me; }).sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); })
    .map(function(k){ return '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(P(k).pseudo) + ' · ' + fmt(avail(k)) + ' coins</option>'; }).join('');
}
function tipDialog(pid){
  var a = avail(S.me);
  if (Object.keys(S.players).length < 2) return dialogShell('<h2 id="dt">Pourboire</h2><p style="margin-top:14px">Il n\'y a pas encore d\'autre joueur à qui envoyer des coins.</p>');
  if (a < 1) return dialogShell('<h2 id="dt">Pourboire</h2><p style="margin-top:14px">Tu n\'as plus de coins disponibles à donner.</p>');
  return dialogShell('<h2 id="dt">Donner des coins</h2><form data-form="tip" novalidate>' +
    '<label for="t-to">Joueur</label><select id="t-to" name="to">' + playerOptions(pid) + '</select>' +
    '<label for="t-amount">Montant</label><input id="t-amount" name="amount" type="number" inputmode="decimal" min="0.01" max="' + Math.min(a, 50) + '" step="0.01" value="1" required><p class="hint">Disponible : ' + cn(a) + '. Tu peux donner <b>n\'importe quel montant dès 0,01</b> (2 décimales max), <b>50 coins maximum</b> par don. Un pourboire est définitif.</p>' +
    '<label for="t-note">Message (facultatif)</label><input id="t-note" name="note" maxlength="60" autocomplete="off" placeholder="Pour ton prochain défi">' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Envoyer</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function giftPlayerOptions(sel){
  return Object.keys(S.players).filter(function(k){ return k !== S.me && S.players[k].status !== 'banned'; })
    .sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); })
    .map(function(k){ return '<option value="' + esc(k) + '"' + (k === sel ? ' selected' : '') + '>' + esc(P(k).pseudo) + '</option>'; }).join('');
}
function giftItemOptions(sel){
  var groups = [
    { label: '👑 Pass VIP', items: [['vip', 'Pass VIP 1 mois', 20]] },
    { label: '✨ Effets de pseudo', items: [
      ['fx:galaxy', 'Pseudo galaxie 🌌', 5],
      ['fx:sparkle', 'Pseudo scintillant', 6],
      ['fx:wave', 'Pseudo vague', 6],
      ['fx:glitch', 'Pseudo glitch', 8],
      ['fx:shadow', 'Pseudo ombre', 8],
      ['fx:fire', 'Pseudo en feu', 10],
      ['fx:ice', 'Pseudo givré', 10],
      ['fx:gold', 'Pseudo or massif', 30],
      ['fx:holo', 'Pseudo holographique', 80]
    ]},
    { label: '🖼️ Cadres de photo', items: [
      ['frame:neon', 'Cadre néon', 4],
      ['frame:fire', 'Cadre flammes', 6],
      ['frame:lightning', 'Cadre éclair', 6],
      ['frame:diamond', 'Cadre diamant', 8],
      ['frame:gold', 'Cadre or', 10],
      ['frame:toxic', 'Cadre toxique', 10],
      ['frame:galaxy', 'Cadre galaxie', 12],
      ['frame:blood', 'Cadre sang', 12],
      ['frame:rainbow', 'Cadre arc-en-ciel', 15],
      ['frame:plasma', 'Cadre plasma', 40],
      ['frame:crown', 'Cadre royal', 75],
      ['frame:legacy', 'Cadre Legacy holographique', 150]
    ]},
    { label: '🌄 Bannières de profil & signatures', items: [
      ['banner:galaxy', 'Bannière galaxie', 5],
      ['banner:sunset', 'Bannière coucher de soleil', 5],
      ['banner:matrix', 'Bannière matrix', 5],
      ['banner:ocean', 'Bannière océan', 5],
      ['banner:aurora', 'Bannière aurore boréale', 8],
      ['banner:lava', 'Bannière lave', 8],
      ['banner:neon_city', 'Bannière ville néon', 10],
      ['banner:peaks', 'Sommets au crépuscule', 12],
      ['banner:night_sea', 'Mer de nuit', 12],
      ['banner:forest', 'Forêt enchantée', 12],
      ['banner:cyber_city', 'Ville cyber', 15],
      ['banner:volcano', 'Volcan en éruption', 15],
      ['banner:storm_eye', 'Œil de la tempête', 15],
      ['banner:saturn', 'Planète aux anneaux', 18],
      ['banner:synthwave', 'Synthwave', 20],
      ['banner:arena', 'Arène Legacy', 25],
      ['banner:sig_ice', 'Signature Glace', 30],
      ['banner:sig_fire', 'Signature Feu', 30],
      ['banner:sig_toxic', 'Signature Toxique', 30],
      ['banner:sig_void', 'Signature Néant', 32],
      ['banner:sig_gold', 'Signature Or', 35],
      ['banner:phoenix', 'Phénix', 35],
      ['banner:gold_rush', 'Bannière ruée vers l\'or', 40],
      ['banner:throne', 'Salle du trône', 90],
      ['banner:legacy', 'Bannière Legacy mythique', 120]
    ]},
    { label: '🎉 Animations de victoire', items: [
      ['win:confetti', 'Victoire confettis', 6],
      ['win:lightning', 'Victoire éclairs', 8],
      ['win:fireworks', 'Victoire feu d\'artifice', 12],
      ['win:money', 'Victoire pluie de billets', 15],
      ['win:crown', 'Victoire couronne royale', 50]
    ]},
    { label: '🎭 Affiches de match', items: [
      ['poster:lava', 'Affiche lave', 5],
      ['poster:ice', 'Affiche glace', 5],
      ['poster:galaxy', 'Affiche galaxie', 5],
      ['poster:neon', 'Affiche néon', 6],
      ['poster:gold', 'Affiche or', 6],
      ['poster:toxic', 'Affiche toxique', 6],
      ['poster:storm', 'Affiche tempête', 8],
      ['poster:legacy', 'Affiche Legacy mythique', 60]
    ]},
    { label: '🏷️ Titres', items: Object.keys(TITLES).filter(function(k){ return !WHEEL_TITLES[k]; }).map(function(k){
      return ['title:' + k, 'Titre « ' + TITLES[k] + ' »', itemPrice('title:' + k)];
    })}
  ];
  return groups.map(function(g){
    var opts = g.items.map(function(it){
      var isSel = it[0] === sel;
      return '<option value="' + esc(it[0]) + '" data-price="' + it[2] + '"' + (isSel ? ' selected' : '') + '>' + esc(it[1]) + ' · ' + it[2] + ' coins</option>';
    }).join('');
    return '<optgroup label="' + esc(g.label) + '">' + opts + '</optgroup>';
  }).join('');
}
function giftPreview(i){
  if (i === 'vip') return '<span class="emo-prev">👑</span>';
  if (i.indexOf('title:') === 0) return '<span class="ptitle">' + esc(TITLES[i.slice(6)] || i.slice(6)) + '</span>';
  return previewOf(i) || '<span class="emo-prev">🎁</span>';
}
function giftDialog(defaultItem, locked){
  var a = Math.max(avail(S.me), 0);
  var otherPlayers = Object.keys(S.players).filter(function(k){ return k !== S.me && S.players[k].status !== 'banned'; });
  if (!otherPlayers.length) return dialogShell('<h2 id="dt">🎁 Offrir un cadeau</h2><p style="margin-top:14px">Il n\'y a pas encore d\'autre joueur inscrit à qui offrir un cadeau.</p><div class="actions" style="margin-top:16px"><button class="btn ghost" data-act="close">Fermer</button></div>');
  var selItem = defaultItem || 'fx:galaxy';
  var pr = giftPrice(selItem);
  var itemField = locked
    ? '<input type="hidden" name="item" value="' + esc(selItem) + '">' +
      '<div class="gift-locked"><div class="gl-prev">' + giftPreview(selItem) + '</div><div class="gl-txt"><small>Tu offres</small><b>' + esc(giftItemName(selItem)) + '</b></div></div>'
    : '<label for="g-item">Article à offrir</label>' +
      '<select id="g-item" name="item" required>' + giftItemOptions(selItem) + '</select>';
  return dialogShell('<h2 id="dt">🎁 ' + (locked ? 'Offrir cet article' : 'Offrir un cadeau de la boutique') + '</h2>' +
    '<p class="help" style="margin-top:6px">' + (locked ? 'Choisis à qui tu l\'offres. Les coins seront débités de ton solde.' : 'Fais plaisir à un joueur en lui offrant un cosmétique ou le VIP ! Les coins seront débités de ton solde.') + '</p>' +
    '<form data-form="gift-item" novalidate style="margin-top:14px">' +
    (locked ? itemField : '') +
    '<label for="g-to">Destinataire</label>' +
    '<select id="g-to" name="to" required>' + giftPlayerOptions() + '</select>' +
    (locked ? '' : itemField) +
    '<div id="g-price-box" style="margin-top:8px;font-size:0.92rem;color:var(--fg-2)">Coût : <b id="g-price-val" style="color:var(--accent)">' + cn(pr) + '</b> (disponible : <b>' + cn(a) + '</b>)</div>' +
    '<label for="g-msg" style="margin-top:12px">Mot doux / Message (facultatif)</label>' +
    '<input id="g-msg" name="message" maxlength="120" autocomplete="off" placeholder="Ex. Pour ton beau clutch hier soir ! GG">' +
    '<p class="err" role="alert" style="margin-top:10px"></p>' +
    '<div class="actions" style="margin-top:18px"><button class="btn primary lg" type="submit"' + (a < pr ? ' disabled' : '') + '>🎁 Confirmer et offrir</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function vcSwitch(pid, cur){
  if (!isOwner()) return '';
  return '<div class="actions" style="margin:0 0 12px"><button type="button" class="btn sm' + (cur === 'coins' ? ' primary' : '') + '" data-act="admin-dialog" data-pid="' + esc(pid || '') + '" data-mode="give">🪙 Coins</button><button type="button" class="btn sm' + (cur === 'vc' ? ' primary' : '') + '" data-act="admin-dialog" data-pid="' + esc(pid || '') + '" data-mode="vcoins">💜 V-Coins</button></div>';
}
function ownerVcDialog(pid){
  var all = Object.keys(S.players).sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); });
  return dialogShell('<h2 id="dt">Donner des V-Coins</h2>' + vcSwitch(pid, 'vc') + '<form data-form="owner-give-vc" novalidate>' +
    '<label for="a-to">Joueur</label><select id="a-to" name="to">' + all.map(function(k){ return '<option value="' + esc(k) + '"' + (k === pid ? ' selected' : '') + '>' + esc(P(k).pseudo) + ' · ' + fmt(P(k).cc || 0) + ' VC</option>'; }).join('') + '</select>' +
    '<label for="a-amount">V-Coins à donner</label><input id="a-amount" name="amount" type="text" inputmode="decimal" autocomplete="off" value="100" required>' +
    '<p class="hint">Autant que tu veux (jusqu\'à 1 000 000), avec 2 décimales maximum. Mets un nombre négatif (ex. -50) pour en retirer.</p>' +
    '<label for="a-note">Raison (facultatif)</label><input id="a-note" name="note" maxlength="60" autocomplete="off" placeholder="Ex. cadeau">' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Valider</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function adminDialog(pid, mode){
  if (mode === 'vcoins' && isOwner()) return ownerVcDialog(pid);
  var remove = mode === 'remove' && isOwner();
  var all = Object.keys(S.players).filter(function(k){ return isOwner() || (k !== S.me && !P(k).owner); }).sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); });
  return dialogShell('<h2 id="dt">' + (remove ? 'Retirer des coins' : 'Donner des coins') + '</h2>' + vcSwitch(pid, 'coins') + '<form data-form="admin-give" data-mode="' + (remove ? 'remove' : 'give') + '" novalidate>' +
    '<label for="a-to">Joueur</label><select id="a-to" name="to">' + all.map(function(k){ return '<option value="' + esc(k) + '"' + (k === pid ? ' selected' : '') + '>' + esc(P(k).pseudo) + ' · ' + fmt(avail(k)) + ' coins dispo</option>'; }).join('') + '</select>' +
    '<label for="a-amount">' + (remove ? 'Coins à retirer' : 'Coins à donner') + '</label><input id="a-amount" name="amount" type="number" inputmode="decimal" min="0.5" step="0.5" value="1" required>' +
    (remove ? '<p class="hint">Seuls les coins disponibles peuvent être retirés (pas ceux en jeu dans un match).</p>' : '') +
    '<label for="a-note">Raison (facultatif)</label><input id="a-note" name="note" maxlength="60" autocomplete="off" placeholder="Ex. récompense tournoi">' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Valider</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function discordGateHTML(){
  return betaBar() + '<div class="wrap welcome"><div><div class="logo">' + LOGO + '<span>Legacy</span><em class="beta">BÊTA</em></div><h1>Dernière étape.</h1><p style="color:var(--fg-2);margin-top:16px;max-width:42ch">Salut <b>' + esc(me().pseudo) + '</b> ! Pour jouer sur Legacy, rejoins le serveur Discord <b>GRIND</b>. C\'est obligatoire et ça ne se fait qu\'une seule fois.</p></div>' +
    '<div class="card"><h2 class="sec">Rejoins le Discord</h2>' +
    '<ol class="dc-steps"><li>Clique sur le bouton bleu et rejoins le serveur.</li><li>Reviens ici et clique sur « J\'ai rejoint le serveur ».</li></ol>' +
    '<div class="actions" style="margin-top:18px"><a class="btn lg discord-btn" href="' + DISCORD_URL + '" target="_blank" rel="noopener noreferrer" data-act="discord-open">' + DC_ICON + '<span>Ouvrir le serveur Discord</span></a></div>' +
    '<div class="actions" style="margin-top:12px"><button class="btn win lg" id="dc-ok" data-act="discord-confirm">J\'ai rejoint le serveur</button></div>' +
    '<p class="hint" style="margin-top:14px">Pas le bon compte ? <button class="linkbtn" data-act="logout">Se déconnecter</button></p></div></div>';
}
function discordDialog(){ return ''; }
function untilTxt(ts){ if (!ts) return '?'; var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2) + (d.toDateString() !== new Date().toDateString() ? ' le ' + d.getDate() + '/' + (d.getMonth() + 1) : ''); }
var searchQ = '';
function searchListHTML(){
  var q = searchQ.trim().toLowerCase();
  if (!q) return '<p class="help">Tape le pseudo d\'un joueur pour aller sur son profil.</p>';
  var res = Object.keys(S.players).filter(function(k){ var p = S.players[k]; return (isAdmin() || p.status !== 'banned') && (p.pseudo.toLowerCase().indexOf(q) >= 0 || (p.fortnite || '').toLowerCase().indexOf(q) >= 0); })
    .sort(function(a, b){ return P(a).pseudo.toLowerCase().indexOf(q) - P(b).pseudo.toLowerCase().indexOf(q) || P(a).pseudo.localeCompare(P(b).pseudo); }).slice(0, 20);
  if (!res.length) return '<p class="help">Aucun joueur trouvé pour « ' + esc(searchQ) + ' ».</p>';
  return '<ul class="fr-list">' + res.map(function(k){ return personRow(k, '<button class="btn sm" data-act="goto-player" data-pid="' + esc(k) + '">Voir le profil</button>'); }).join('') + '</ul>';
}
function searchDialog(){
  return dialogShell('<h2 id="dt">Rechercher un joueur</h2><input id="search-q" type="search" autocomplete="off" placeholder="Pseudo du joueur…" value="' + esc(searchQ) + '" style="margin-top:14px" aria-label="Pseudo du joueur"><div id="search-list" style="margin-top:12px">' + searchListHTML() + '</div>');
}
function sanctionDialog(pid, mode){
  var p = P(pid), label = mode === 'banned' ? 'Bannir' : mode === 'restricted' ? 'Restreindre' : 'Lever la sanction';
  return dialogShell('<h2 id="dt">' + label + '</h2><p style="margin-top:12px">Joueur : <b>' + esc(p.pseudo) + '</b></p><form data-form="sanction" data-pid="' + esc(pid) + '" data-mode="' + esc(mode) + '" novalidate>' +
    (mode === 'restricted' ? '<label for="s-hours">Durée</label><select id="s-hours" name="hours"><option value="1">1 heure</option><option value="2">2 heures</option><option value="5">5 heures</option><option value="10">10 heures</option><option value="24">24 heures</option></select>' : '') + (mode !== 'ok' ? '<label for="s-reason">Raison (le joueur la verra)</label><input id="s-reason" name="reason" maxlength="140" autocomplete="off" placeholder="Ex. triche, insultes, multi-comptes…">' : '<p class="help" style="margin-top:10px">Le joueur retrouve un accès normal au site.</p>') +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn ' + (mode === 'ok' ? 'win' : 'danger') + '" type="submit">' + label + '</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function bannedHTML(){
  var p = me();
  return betaBar() + '<div class="wrap welcome"><div><div class="logo">' + LOGO + '<span>Legacy</span><em class="beta">BÊTA</em></div><h1>Compte banni.</h1><p style="color:var(--fg-2);margin-top:16px;max-width:46ch">Ton compte <b>' + esc(p.pseudo) + '</b> a été banni de Legacy' + (p.statusReason ? ' pour la raison suivante : « ' + esc(p.statusReason) + ' »' : '') + '.</p></div>' +
    '<div class="card"><h2 class="sec">Contester</h2><p style="margin-top:10px;color:var(--fg-2)">Si tu penses que c\'est une erreur, ouvre un ticket sur le Discord.</p><div class="actions" style="margin-top:16px">' + dcBtn('Ouvrir le Discord') + '<button class="btn ghost" data-act="logout">Se déconnecter</button></div></div></div>';
}
function renderDialog(){
  var L = $('#layer');
  if (!dlg) { L.innerHTML = ''; return; }
  L.innerHTML = dlg.kind === 'discord' ? discordDialog() : dlg.kind === 'new' ? newMatchDialog() : dlg.kind === 'bet' ? betDialog(dlg.mid, dlg.side) : dlg.kind === 'custom' ? customDialog(dlg.id) : dlg.kind === 'gift' ? giftDialog(dlg.item, dlg.locked) : dlg.kind === 'tip' ? tipDialog(dlg.pid) : dlg.kind === 'sanction' ? sanctionDialog(dlg.pid, dlg.mode) : dlg.kind === 'notifs' ? notifsDialog() : dlg.kind === 'search' ? searchDialog() : dlg.kind === 'img' ? imgDialog(dlg.url) : dlg.kind === 'watch' ? watchDialog(dlg.ch, dlg.pid) : dlg.kind === 'tour-new' ? tourNewDialog() : dlg.kind === 'pick' ? pickDialog() : adminDialog(dlg.pid, dlg.mode);
  var f = L.querySelector('input,select,button.btn.primary,.x'); if (f) f.focus();
}
function openDialog(d){ lastFocus = document.activeElement; dlg = d; renderDialog(); }
function closeDialog(){ dlg = null; $('#layer').innerHTML = ''; if (lastFocus && lastFocus.focus && document.contains(lastFocus)) try { lastFocus.focus(); } catch(e){} }

/* ---------- rendu ---------- */
function render(){
  if (spinLock) { renderPending = true; return; }
  var app = $('#app');
  if (!configured) { app.innerHTML = betaBar() + '<div class="wrap welcome"><div class="card"><h2 class="sec">Site pas encore relié</h2><p style="margin-top:12px">Il manque l\'adresse et la clé Supabase dans <code>config.js</code>.</p></div></div>'; return; }
  if (!loaded) { app.innerHTML = betaBar() + '<div class="wrap welcome"><p class="eyebrow">Chargement de l\'arène…</p></div>'; return; }
  if (loadErr && S.me && !me()) {
    app.innerHTML = betaBar() + '<div class="wrap welcome"><div class="card"><h2 class="sec">Erreur de chargement</h2><p style="margin-top:12px">Impossible de charger les données : ' + esc(loadErr) + '</p><div style="margin-top:16px"><button class="btn primary" onclick="location.reload()">Réessayer</button></div></div></div>';
    return;
  }
  if (S.me && !me()) S.me = null;
  if (!me() || me().status === 'banned' || !me().rulesAt || !me().joined) { updateStreamsHost(false); var f0 = document.getElementById('foot'); if (f0) f0.innerHTML = ''; }
  if (!me()) { app.innerHTML = welcomeHTML(); return; }
  if (me().status === 'banned') { app.innerHTML = bannedHTML(); return; }
  if (!me().rulesAt) { if (!document.getElementById('rules-btn')) { app.innerHTML = rulesGateHTML(); window.scrollTo(0, 0); } return; }
  if (!me().joined) { if (!document.getElementById('dc-ok')) app.innerHTML = discordGateHTML(); return; }
  var v = viewName();
  var body = v === 'classement' ? boardHTML() : v === 'profil' ? profileHTML() : v === 'regles' ? rulesHTML() : v === 'signaler' ? reportHTML() : v === 'amis' ? friendsHTML() : v === 'boutique' ? shopHTML() : v === 'tournois' ? tournamentsHTML() : v === 'roue' ? wheelHTML() : v === 'casino' ? casinoHTML() : v === 'match' ? matchPageHTML() : arenaHTML();
  app.innerHTML = headerHTML(v) + (loadErr ? '<div class="wrap"><div class="notice" style="margin-top:16px"><p>Problème de connexion au serveur : ' + esc(loadErr) + '</p></div></div>' : '') + '<main class="wrap main" id="main">' + (me().status === 'restricted' ? '<div class="notice restricted"><p><b>Compte restreint jusqu\'à ' + untilTxt(me().restrictedUntil) + '.</b> Tu peux regarder le site mais tu ne peux plus jouer, écrire dans les chats ni envoyer de coins' + (me().statusReason ? ' (raison : « ' + esc(me().statusReason) + ' »)' : '') + '. Pour contester, ouvre un ticket sur le Discord.</p></div>' : '') + body + '</main>';
  updateStreamsHost(v === 'arene');
  var ft = document.getElementById('foot'); if (ft && !ft.firstChild) ft.innerHTML = footerHTML();
  var cl = document.getElementById('chat-list'); if (cl) cl.scrollTop = cl.scrollHeight;
}
/* rubrique streams : en dehors de #app pour ne pas relancer les lecteurs à chaque rafraîchissement */
var streamsSig = null;
function updateStreamsHost(show){
  var host = document.getElementById('streams-host');
  if (!host) return;
  if (!show) { if (streamsSig !== '') { host.innerHTML = ''; streamsSig = ''; } host.hidden = true; return; }
  host.hidden = false;
  var list = Object.keys(S.players).map(function(k){ return S.players[k]; }).filter(function(p){ return p.twitch && p.status !== 'banned'; });
  list.forEach(function(p){ checkLive(p.twitch); });
  var sig = list.map(function(p){ return p.id + ':' + p.twitch + ':' + (isLive(p.twitch) ? 1 : 0) + ':' + p.pseudo + ':' + p.avatar; }).sort().join('|');
  if (sig === streamsSig) return;
  streamsSig = sig;
  host.innerHTML = communityStreamsHTML();
}
setInterval(function(){
  if (!S.players || !me() || viewName() !== 'arene') return;
  Object.keys(S.players).forEach(function(k){ var ch = S.players[k].twitch; if (ch) checkLive(ch); });
  setTimeout(function(){ updateStreamsHost(true); }, 2500);
}, 60000);
/* rafraîchissement automatique sans casser ce que la personne tape */
function typing(){ var a = document.activeElement; return dlg || (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
var passiveT = null;
function passiveRefresh(){
  clearTimeout(passiveT);
  passiveT = setTimeout(function(){ if (busy) return; refresh().then(function(){ if (!typing()) render(); }); }, 400);
}
function done(r, okMsg){ busy = false; if (r.ok) { if (okMsg) toast(okMsg); } else toast(r.msg); render(); return r.ok; }
function doRpc(fn, args, okMsg, after){
  if (busy) return; busy = true;
  rpc(fn, args).then(function(r){ if (done(r, typeof okMsg === 'function' ? okMsg(r) : okMsg) && after) after(r); });
}

/* ---------- événements ---------- */
function act(name, el){
  var d = el.dataset;
  switch (name) {
    case 'tab': tab = d.tab; render(); break;
    case 'auth-tab': authTab = d.tab; render(); var fi = document.querySelector('.auth input'); if (fi) fi.focus(); break;
    case 'open-match': openMatch(d.id); break;
    case 'back': location.hash = '#arene'; break;
    case 'new-match': openDialog({kind: 'new'}); break;
    case 'bet-dialog': openDialog({kind: 'bet', mid: d.id, side: d.side || 'A'}); break;
    case 'shop-vip': shopTab = 'vip'; location.hash = '#boutique'; render(); break;
    case 'discord-open': var cb = document.getElementById('dc-ok'); if (cb) cb.disabled = false; break;
    case 'sanction': openDialog({kind: 'sanction', pid: d.pid, mode: d.mode}); break;
    case 'friend-add': doRpc('send_friend_request', {p_to: d.pid}, function(r){ return r.data === 'accepted' ? 'Vous êtes maintenant amis !' : 'Demande d\'ami envoyée à ' + P(d.pid).pseudo + '.'; }); break;
    case 'friend-accept': doRpc('respond_friend_request', {p_from: d.pid, p_accept: true}, 'Toi et ' + P(d.pid).pseudo + ' êtes maintenant amis !'); break;
    case 'friend-decline': doRpc('respond_friend_request', {p_from: d.pid, p_accept: false}, 'Demande refusée.'); break;
    case 'friend-remove': doRpc('remove_friend', {p_other: d.pid}, rel(d.pid) === 'sent' ? 'Demande annulée.' : P(d.pid).pseudo + ' a été retiré de tes amis.'); break;
    case 'notifs': openDialog({kind: 'notifs'}); if (unread()) sb.rpc('mark_notifications_read').then(function(){ (S.notifs || []).forEach(function(n){ n.read = true; }); render(); }); break;
    case 'pick': pickQ = ''; openDialog({kind: 'pick', purpose: d.purpose, id: d.id}); break;
    case 'pick-send':
      if (busy || !dlg) break; busy = true;
      var ctxp = dlg;
      rpc(ctxp.purpose === 'team' ? 'invite_to_team' : 'invite_to_match', ctxp.purpose === 'team' ? {p_team: ctxp.id, p_player: d.pid} : {mid: ctxp.id, p_player: d.pid}).then(function(r){ busy = false; toast(r.ok ? 'Invitation envoyée à ' + P(d.pid).pseudo + '.' : r.msg); if (ctxp.purpose === 'team' && r.ok) closeDialog(); render(); if (dlg) renderDialog(); });
      break;
    case 'team-accept': doRpc('respond_team_invite', {p_team: d.id, p_accept: true}, 'Tu as rejoint l\'équipe !', function(){ if (dlg && dlg.kind === 'notifs') renderDialog(); }); break;
    case 'team-decline': doRpc('respond_team_invite', {p_team: d.id, p_accept: false}, 'Invitation refusée.', function(){ if (dlg && dlg.kind === 'notifs') renderDialog(); }); break;
    case 'team-leave': var tl = S.teams[d.id]; if (tl && !confirm(tl.owner === S.me ? 'Supprimer l\'équipe « ' + tl.name + ' » ?' : 'Quitter l\'équipe « ' + tl.name + ' » ?')) break; doRpc('leave_team', {p_team: d.id}, tl && tl.owner === S.me ? 'Équipe supprimée.' : 'Tu as quitté l\'équipe.'); break;
    case 'team-kick': doRpc('kick_from_team', {p_team: d.id, p_player: d.pid}, P(d.pid).pseudo + ' a été retiré de l\'équipe.'); break;
    case 'proof-view': openDialog({kind: 'img', url: d.url}); break;
    case 'proof-del': if (!confirm('Supprimer cette capture ?')) break; sb.rpc('remove_proof', {p_id: parseInt(d.pid, 10)}).then(function(r){ if (r.error) { toast(cleanErr(r.error.message)); return; } toast('Capture supprimée.'); delete proofsCache[d.id]; loadProofs(d.id); }); break;
    case 'afk-claim':
      if (!confirm('Déclarer que ton adversaire ne joue pas ? Tu seras déclaré gagnant s\'il ne conteste pas dans les 10 minutes.')) break;
      doRpc('declare_result', {mid: d.id, val: 'won', p_my: null, p_opp: null}, 'Victoire par AFK déclarée. Ton adversaire a 10 minutes pour contester.');
      break;
    case 'toggle-anon': doRpc('set_anon', {p_on: !me().anon}, me().anon ? 'Mode anonyme désactivé.' : 'Mode anonyme activé : ton pseudo sera caché quand tu rejoins un défi.'); break;
    case 'reset-stats':
      if (!confirm('Remettre toutes tes stats à zéro (victoires, défaites, taux, bilan, série) pour ' + cn(5) + ' ? Tes coins et tes articles sont conservés.')) break;
      doRpc('reset_stats', {}, 'Stats remises à zéro. Nouveau départ !');
      break;
    case 'watch': openDialog({kind: 'watch', ch: d.ch, pid: d.pid}); break;
    case 'goto-tours': tourId = null; if (dlg) closeDialog(); if (viewName() === 'tournois') render(); else location.hash = '#tournois'; break;
    case 'open-tour': tourId = d.id; if (viewName() === 'tournois') render(); else location.hash = '#tournois'; window.scrollTo(0, 0); break;
    case 'tour-back': tourId = null; render(); window.scrollTo(0, 0); break;
    case 'open-custom': customId = d.id; tourId = null; if (viewName() === 'tournois') render(); else location.hash = '#tournois'; window.scrollTo(0, 0); break;
    case 'custom-back': customId = null; render(); window.scrollTo(0, 0); break;
    case 'custom-new': openDialog({kind: 'custom', id: null}); setTimeout(customLobbyHint, 0); break;
    case 'custom-edit': openDialog({kind: 'custom', id: d.id}); setTimeout(customLobbyHint, 0); break;
    case 'custom-leave': if (!confirm('Te désinscrire de cette partie perso ?')) break; doRpc('leave_custom', {cid: d.id}, 'Tu es désinscrit.'); break;
    case 'custom-kick': if (!confirm('Retirer ' + P(d.pid).pseudo + ' de la partie ?')) break; doRpc('owner_kick_custom', {cid: d.id, p_player: d.pid}, P(d.pid).pseudo + ' a été retiré.'); break;
    case 'custom-status': { var cs = {live: 'Fermer les inscriptions ?', registration: 'Rouvrir les inscriptions ?', done: 'Terminer la partie perso ?', cancelled: 'Annuler la partie perso ?'}[d.s]; if (!confirm(cs)) break; doRpc('set_custom_status', {cid: d.id, p_status: d.s}, 'C\'est fait.'); break; }
    case 'copy-code': { var cc = d.code; try { navigator.clipboard.writeText(cc).then(function(){ toast('Code copié : ' + cc); }, function(){ toast('Code : ' + cc); }); } catch(e){ toast('Code : ' + cc); } break; }
    case 'goto-custom': customId = d.id; tourId = null; closeDialog(); location.hash = '#tournois'; render(); window.scrollTo(0, 0); break;
    case 'tour-unrestrict': doRpc('tour_unrestrict', {p_player: d.pid}, 'Restriction levée.'); break;
    case 'tour-new': openDialog({kind: 'tour-new'}); break;
    case 'tour-join': { var tj = S.tours[d.id]; if (Number(tj.entry_fee) > 0 && !confirm('T\'inscrire pour ' + cn(tj.entry_fee) + ' ?')) break; doRpc('join_tournament', {tid: d.id}, 'Inscrit au tournoi ! Bonne chance.'); break; }
    case 'tour-leave': if (!confirm('Te désinscrire du tournoi ?')) break; doRpc('leave_tournament', {tid: d.id}, 'Tu t\'es désinscrit.'); break;
    case 'tour-start': if (!confirm('Lancer le tournoi ? Les inscriptions seront fermées et l\'arbre tiré au sort.')) break; doRpc('start_tournament', {tid: d.id}, 'Tournoi lancé ! L\'arbre est prêt.'); break;
    case 'tour-cancel': if (!confirm('Annuler le tournoi et rembourser tous les inscrits ?')) break; doRpc('cancel_tournament', {tid: d.id}, 'Tournoi annulé, inscrits remboursés.'); break;
    case 'tour-delete': if (!confirm('Supprimer DÉFINITIVEMENT ce tournoi ? Il disparaîtra complètement et ne pourra pas être récupéré.')) break; tourId = null; doRpc('delete_tournament', {tid: d.id}, 'Tournoi supprimé définitivement.'); break;
    case 'custom-delete': if (!confirm('Supprimer DÉFINITIVEMENT cette partie perso ? Elle disparaîtra complètement.')) break; customId = null; doRpc('delete_custom', {cid: d.id}, 'Partie perso supprimée définitivement.'); break;
    case 'tour-win': if (!confirm(P(d.pid).pseudo + ' a gagné ce match ?')) break; doRpc('set_tournament_winner', {tid: d.id, p_round: parseInt(d.round, 10), p_slot: parseInt(d.slot, 10), p_winner: d.pid}, P(d.pid).pseudo + ' passe au tour suivant !'); break;
    case 'shop-tab': shopTab = d.tab; render(); break;
    case 'equip': doRpc('set_equip', {p_slot: d.slot, p_item: d.item || null}, d.item ? itemName(d.item) + ' équipé !' : 'Retiré.'); break;
    case 'pin': if (!confirm('Épingler ce défi en haut de l\'arène pendant 1 heure pour ' + cn(3) + ' ?')) break; doRpc('pin_match', {mid: d.id}, 'Défi épinglé pour 1 heure !'); break;
    case 'buy-item':
      if (!confirm('Acheter « ' + itemName(d.item) + ' » pour ' + cn(itemPrice(d.item)) + ' ?')) break;
      doRpc('buy_item', {p_item: d.item}, 'Achat réussi : ' + itemName(d.item) + ' !');
      break;
    case 'spin': spinWheel(); break;
    case 'own-vip-give': { var mo = parseInt(prompt('Combien de mois de VIP offrir à ' + P(d.pid).pseudo + ' ? (1 à 24)', '1'), 10); if (!mo) break; doRpc('owner_give_vip', {p_player: d.pid, p_months: mo}, mo + ' mois de VIP offerts à ' + P(d.pid).pseudo + '.'); break; }
    case 'own-vip-remove': { var rf = Number(d.refund) || 0; if (!confirm('Retirer le VIP de ' + P(d.pid).pseudo + (rf ? ' et lui rembourser ' + rf + ' coins' : '') + ' ?')) break; doRpc('owner_remove_vip', {p_player: d.pid, p_refund: rf}, 'VIP retiré' + (rf ? ', ' + rf + ' coins remboursés.' : '.')); break; }
    case 'own-item-remove': { var rb = d.refund === '1'; if (!confirm('Retirer « ' + ownerItemName(d.item) + ' » à ' + P(d.pid).pseudo + (rb ? ' et le rembourser' : '') + ' ?')) break; doRpc('owner_remove_item', {p_player: d.pid, p_item: d.item, p_refund: rb}, function(r){ return 'Article retiré' + (rb ? (Number(r.data) > 0 ? ', ' + cn(Number(r.data)) + ' remboursé(s).' : ' (article gratuit, rien à rembourser).') : '.'); }); break; }
    case 'own-item-give': { var gs = document.getElementById('own-give-sel'); if (!gs || !gs.value) break; var gi = gs.value; if (!confirm('Offrir « ' + ownerItemName(gi) + ' » à ' + P(d.pid).pseudo + ' gratuitement ?')) break; doRpc('owner_give_item', {p_player: d.pid, p_item: gi}, 'Cadeau envoyé à ' + P(d.pid).pseudo + ' !'); break; }
    case 'ticket-open': openTicket(d.id); break;
    case 'wheel-sound': wheelSound = !wheelSound; try { localStorage.setItem('legacy-wheel-sound', wheelSound ? '1' : '0'); } catch (e) {} el.textContent = wheelSound ? '🔊 Son activé' : '🔇 Son coupé'; if (wheelSound) tickSound(); break;
    case 'equip-title': doRpc('set_cosmetics', {p_style: me().nameStyle, p_title: d.key}, d.key ? 'Titre équipé !' : 'Titre retiré.'); break;
    case 'buy-vip':
      if (!confirm('Acheter 1 mois de Pass VIP pour ' + cn(VIP_PRICE) + ' ?')) break;
      doRpc('buy_vip', {}, 'VIP activé pour 1 mois !');
      break;
    case 'clear-title': if (!confirm('Effacer le titre de ' + P(d.pid).pseudo + ' ?')) break; doRpc('admin_clear_title', {p_player: d.pid}, 'Titre effacé.'); break;
    case 'rule-tab': ruleTab = parseInt(d.i, 10) || 0; render(); break;
    case 'rules-accept':
      if (busy) break; busy = true;
      rpc('accept_rules', {}).then(function(r){ busy = false; if (!r.ok) { toast(r.msg); return; } toast('Règles acceptées. Merci !'); document.getElementById('app').innerHTML = ''; window.scrollTo(0, 0); render(); });
      break;
    case 'discord-confirm':
      if (busy) break; busy = true;
      rpc('confirm_discord_join', {}).then(function(r){ busy = false; if (!r.ok) { toast(r.msg); return; } closeDialog(); toast('Bienvenue dans la commu ! Tu peux jouer.'); document.getElementById('app').innerHTML = ''; location.hash = '#arene'; render(); });
      break;
    case 'tip-dialog': openDialog({kind: 'tip', pid: d.pid || null}); break;
    case 'gift-dialog': openDialog({kind: 'gift', item: d.item || 'fx:galaxy', locked: !!d.item}); break;
    case 'gift-reveal-open':
      openGiftReveal();
      break;
    case 'gift-reveal-equip': {
      var it = d.item || '';
      closeGiftReveal();
      if (it.indexOf('title:') === 0) {
        var tk = it.slice(6);
        doRpc('set_cosmetics', {p_style: (me() && me().nameStyle) || '', p_title: tk}, 'Titre « ' + (TITLES[tk] || WHEEL_TITLES[tk] || tk) + ' » équipé !');
      } else {
        var sl = slotOf(it);
        if (sl) doRpc('set_equip', {p_slot: sl, p_item: it}, itemName(it) + ' équipé !');
      }
      break;
    }
    case 'gift-reveal-profile':
      closeGiftReveal();
      viewPid = S.me;
      editing = false;
      if (dlg) closeDialog();
      location.hash = '#profil';
      render();
      window.scrollTo(0, 0);
      break;
    case 'gift-reveal-shop': {
      var gi = d.item || '';
      closeGiftReveal();
      shopTab = shopTabForItem(gi);
      if (dlg) closeDialog();
      location.hash = '#boutique';
      render();
      window.scrollTo(0, 0);
      break;
    }
    case 'gift-reveal-vc':
      closeGiftReveal();
      if (dlg) closeDialog();
      location.hash = '#casino';
      render();
      window.scrollTo(0, 0);
      break;
    case 'gift-reveal-close':
      closeGiftReveal();
      break;
    case 'admin-dialog': openDialog({kind: 'admin', pid: d.pid || null, mode: d.mode || 'give'}); break;
    case 'close': closeDialog(); break;
    case 'myprofile': viewPid = S.me; editing = false; break;
    case 'search': searchQ = ''; openDialog({kind: 'search'}); break;
    case 'goto-player': if (dlg) closeDialog(); viewPid = d.pid; editing = false; if (viewName() === 'profil') render(); else location.hash = '#profil'; window.scrollTo(0, 0); break;
    case 'edit-on': editing = true; render(); break;
    case 'edit-off': editing = false; render(); break;
    case 'avatar-remove':
      if (busy) break; busy = true;
      rpc('set_avatar', {p_url: ''}).then(function(r){ busy = false; toast(r.ok ? 'Photo retirée.' : r.msg); render(); });
      break;
    case 'join': {
      var m = S.matches[d.id];
      doRpc('join_match', {mid: d.id, team: d.team || 'B'}, m ? cn(m.stake) + ' mis dans le pot. Bonne chance !' : '', function(){ openMatch(d.id); });
      break;
    }
    case 'double': {
      var dm = S.matches[d.id];
      if (!dm) break;
      if (dm.doubleMatchId) { openMatch(dm.doubleMatchId); break; }
      var dStake = dm.stake * 2, dSide = teamOf(dm, S.me);
      if (!dSide) break;
      if (avail(S.me) < dStake) { toast('Il te faut ' + cn(dStake) + ' disponibles pour faire un Double.'); break; }
      var oppAlready = dSide === 'A' ? dm.doubleB : dm.doubleA;
      var dOpp = dSide === 'A' ? capB(dm) : capA(dm);
      var msgConfirm = oppAlready
        ? 'Ton adversaire est déjà prêt ! Confirmer le Double et lancer le match maintenant pour ' + cn(dStake) + ' ?'
        : 'Proposer le Double (' + cn(dStake) + ') à ' + (dOpp ? P(dOpp).pseudo : 'ton adversaire') + ' ? Le match se lancera dès que vous aurez tous les deux cliqué sur Double.';
      if (!confirm(msgConfirm)) break;
      doRpc('request_double', {mid: d.id}, function(r){
        var res = r && r.data;
        if (res && res.status === 'started') return '🔥 Les deux ont accepté ! Le match Double (' + cn(dStake) + ') est lancé !';
        return '🔥 Demande de Double envoyée (1/2) ! En attente de l\'accord de ton adversaire.';
      }, function(r){
        var res = r && r.data;
        if (res && res.status === 'started' && res.match_id) openMatch(res.match_id);
        else openMatch(d.id);
      });
      break;
    }
    case 'leave': doRpc('leave_match', {mid: d.id}, 'Tu as quitté le match. Ta mise t\'est rendue.'); break;
    case 'cancel': doRpc('cancel_match', {mid: d.id}, 'Défi annulé, mises rendues.', function(){ location.hash = '#arene'; }); break;
    case 'declare': {
      var mm = S.matches[d.id];
      doRpc('declare_result', {mid: d.id, val: d.val}, function(r){
        if (r.data === 'done') { var x = S.matches[d.id]; return x && teamOf(x, S.me) === x.winner ? 'Victoire ! Tu récupères ' + cn(mm.stake * 2) + '.' : 'Défaite : ta mise de ' + cn(mm.stake) + ' est perdue.'; }
        return r.data === 'dispute' ? 'Les deux déclarations ne concordent pas : litige, un admin va trancher.' : 'Résultat enregistré. En attente de l\'autre capitaine.';
      });
      break;
    }
    case 'admin-win': doRpc('admin_resolve', {mid: d.id, side: d.side}, 'Équipe ' + d.side + ' déclarée gagnante.'); break;
    case 'admin-cancel': doRpc('admin_cancel', {mid: d.id}, 'Match annulé, mises rendues.'); break;
    case 'logout': sb.auth.signOut().then(function(){ S.me = null; viewPid = null; editing = false; closeDialog(); authTab = 'login'; location.hash = ''; toast('Tu es déconnecté.'); render(); }); break;
    case 'share': {
      var url = location.origin + location.pathname + '#match-' + d.id;
      try { navigator.clipboard.writeText(url).then(function(){ toast('Lien copié. Envoie-le à ton adversaire !'); }, function(){ toast(url); }); } catch(e){ toast(url); }
      break;
    }
    case 'fn-setup': viewPid = S.me; editing = true; if (viewName() === 'profil') render(); else location.hash = '#profil'; setTimeout(function(){ var i = document.getElementById('e-fortnite'); if (i) i.focus(); }, 80); break;
    case 'epic-link': {
      var st = Math.random().toString(36).slice(2) + Date.now().toString(36);
      try { sessionStorage.setItem('legacy-epic-state', st); } catch (e) {}
      location.href = 'https://www.epicgames.com/id/authorize?client_id=' + encodeURIComponent(EPIC_ID) + '&response_type=code&scope=basic_profile&redirect_uri=' + encodeURIComponent(epicRedirect()) + '&state=' + st;
      break;
    }
    case 'epic-unlink': if (!confirm('Délier ton compte Epic ? Ton pseudo Fortnite ne se mettra plus à jour tout seul.')) break; epicCall({action: 'unlink'}, 'Compte Epic délié.'); break;
    case 'copy-fn': {
      var fnp = P(d.pid).fortnite;
      try { navigator.clipboard.writeText(fnp).then(function(){ toast('Pseudo Fortnite copié : ' + fnp); }, function(){ toast('Pseudo Fortnite : ' + fnp); }); } catch(e){ toast('Pseudo Fortnite : ' + fnp); }
      break;
    }
    case 'copy-pseudo': {
      var nm = me().pseudo;
      try { navigator.clipboard.writeText(nm).then(function(){ toast('Pseudo copié : ' + nm); }, function(){ toast('Ton pseudo : ' + nm); }); } catch(e){ toast('Ton pseudo : ' + nm); }
      break;
    }
  }
}
document.addEventListener('click', function(e){
  var el = e.target.closest('[data-act]');
  if (el) { if (el.tagName === 'INPUT') return; act(el.dataset.act, el); return; }
  var card = e.target.closest('[data-open]');
  if (card) { openMatch(card.dataset.open); return; }
  if (e.target.classList && e.target.classList.contains('overlay')) closeDialog();
});
document.addEventListener('change', function(e){
  var el = e.target;
  if (el.id === 'c-game' || el.id === 'c-format' || el.id === 'c-team') { customDialogChange(el); return; }
  if (el.id === 'avatar-file' && el.files && el.files[0]) { uploadAvatar(el.files[0]); el.value = ''; return; }
  if (el.classList && el.classList.contains('proof-file') && el.files && el.files[0]) { var pmid = el.dataset.id, pf = el.files[0]; el.value = ''; toast('Envoi de la capture…'); uploadProof(pmid, pf).then(function(){ toast('Capture ajoutée !'); }, function(e){ toast(e.message); }); return; }
  if (el.name === 'shot' && el.files && el.files[0]) { var st2 = el.parentNode.querySelector('.shot-txt'); if (st2) st2.innerHTML = '✓ ' + esc(el.files[0].name) + ' <small>(cliquer pour changer)</small>'; el.parentNode.classList.add('ok'); return; }
  if (el.id === 'g-item') {
    var val = el.value;
    var pr = giftPrice(val);
    var pVal = document.getElementById('g-price-val');
    if (pVal) pVal.textContent = fmt(pr) + ' ' + (pr > 1 ? 'coins' : 'coin');
    var sbtn = el.form && el.form.querySelector('button[type=submit]');
    if (sbtn) sbtn.disabled = avail(S.me) < pr;
    return;
  }
  if (el.id === 'rules-ok') { var rb = document.getElementById('rules-btn'); if (rb) rb.disabled = !el.checked; return; }
  if (el.id === 'c-format') {
    var t = $('#c-target'); if (t) { t.disabled = el.value !== '1v1'; if (t.disabled) t.value = ''; }
    var ts = $('#c-team');
    if (ts) {
      var sz = el.value.charAt(0), any = false;
      Array.prototype.forEach.call(ts.options, function(o){ var ok = !o.value || o.dataset.size === sz; o.hidden = !ok; if (ok && o.value) any = true; });
      ts.value = ''; ts.disabled = el.value === '1v1';
      var hn = $('#c-team-hint');
      if (hn) hn.textContent = el.value === '1v1' ? 'Pas d\'équipe en 1v1.' : any ? 'Choisis une de tes équipes : les places de ton côté lui seront réservées.' : 'Aucune équipe complète en ' + el.value + '. Crée-en une dans ton profil.';
    }
  }
});
document.addEventListener('input', function(e){
  if (e.target && e.target.id === 'c-max') customLobbyHint();
  if (e.target.id === 'b-amount') {
    var bv = num(e.target.value) || 0;
    var calc = document.getElementById('bet-win-calc');
    if (calc) calc.textContent = fmt(bv * 2) + ' coins (x2)';
    return;
  }
  if (e.target.id === 'search-q') { searchQ = e.target.value; var sl = document.getElementById('search-list'); if (sl) sl.innerHTML = searchListHTML(); return; }
  if (e.target.id === 'pick-q') { pickQ = e.target.value; var pl = document.getElementById('pick-list'); if (pl) pl.innerHTML = pickListHTML(); return; }
  if (e.target.id === 'friend-q') { friendQ = e.target.value; var fr = document.getElementById('friend-results'); if (fr) fr.innerHTML = searchResultsHTML(); }
});
document.addEventListener('keydown', function(e){
  if (e.key === 'Escape' && dlg) { closeDialog(); return; }
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-open]')) { e.preventDefault(); openMatch(e.target.dataset.open); }
});
document.addEventListener('submit', function(e){
  e.preventDefault();
  var f = e.target, kind = f.dataset.form, d = {}, fd = new FormData(f);
  fd.forEach(function(v, k){ d[k] = v; });
  var err = f.querySelector('.err'), btn = f.querySelector('button[type=submit]');
  function fail(msg){ if (btn) btn.disabled = false; if (err) err.textContent = msg; }
  if (btn) btn.disabled = true;
  if (kind === 'chat') {
    var mid = f.dataset.id, inp = f.querySelector('input[name=body]');
    if (!String(d.body || '').trim()) { if (btn) btn.disabled = false; return; }
    sb.rpc('send_message', {mid: mid, p_body: d.body}).then(function(r){
      if (btn) btn.disabled = false;
      if (r.error) { toast(cleanErr(r.error.message)); return; }
      inp.value = ''; inp.focus(); delete chatCache[mid]; loadChat(mid);
    });
    return;
  }
  if (kind === 'signup' || kind === 'login') {
    (kind === 'signup' ? signup(d) : login(d)).then(function(r){
      if (!r.ok) return fail(r.msg);
      return sb.auth.getSession().then(function(s){
        S.me = s.data.session ? s.data.session.user.id : null;
        return refresh();
      }).then(function(){
        viewPid = null; editing = false;
        toast(kind === 'signup' ? 'Bienvenue sur Legacy. ' + cn(START) + ' t\'attendent dans ton solde.' : 'Content de te revoir, ' + (me() ? me().pseudo : '') + '.');
        location.hash = '#arene'; render();
      });
    }).catch(function(e){
      fail((e && e.message) || 'Erreur lors de la connexion. Réessaie.');
    });
    return;
  }
  if (kind === 'result') {
    var rmid = f.dataset.id, my = parseInt(d.my, 10), opp = parseInt(d.opp, 10), shot = f.querySelector('input[name=shot]').files[0];
    if (isNaN(my) || isNaN(opp) || my < 0 || opp < 0 || my > 99 || opp > 99) return fail('Entre les deux scores (de 0 à 99).');
    if (my === opp) return fail('Il ne peut pas y avoir d\'égalité : il faut un gagnant.');
    var rm = S.matches[rmid];
    if (!confirm('Confirmer le score ' + my + ' – ' + opp + ' ? Ça veut dire que tu as ' + (my > opp ? 'GAGNÉ' : 'PERDU') + '.')) return fail('');
    (shot ? uploadProof(rmid, shot) : Promise.resolve()).then(function(){
      return rpc('declare_result', {mid: rmid, val: my > opp ? 'won' : 'lost', p_my: my, p_opp: opp});
    }).then(function(r){
      if (!r.ok) return fail(r.msg);
      var x = S.matches[rmid];
      toast(r.data === 'done' ? (x && teamOf(x, S.me) === x.winner ? 'Victoire ' + my + '–' + opp + ' ! Tu récupères ' + cn(rm.stake * 2) + '.' : 'Défaite ' + my + '–' + opp + ' : ta mise de ' + cn(rm.stake) + ' est perdue.') : r.data === 'dispute' ? 'Les deux déclarations ne concordent pas : litige, un admin va trancher.' : 'Score envoyé. En attente de l\'autre capitaine.');
      render();
    }, function(e){ fail(e.message); });
    return;
  }
  if (kind === 'place-bet') {
    var bmid = f.dataset.id, bamt = num(d.amount), bside = d.side;
    if (!bside || (bside !== 'A' && bside !== 'B')) return fail('Choisis l\'équipe A ou l\'équipe B.');
    if (isNaN(bamt) || bamt < 0.5) return fail('Mise invalide (minimum 0,5 coin).');
    if (bamt > avail(S.me)) return fail('Solde insuffisant (tu as ' + cn(Math.max(avail(S.me), 0)) + ').');
    rpc('place_bet', {mid: bmid, p_side: bside, p_amount: bamt}).then(function(r){
      if (!r.ok) return fail(r.msg);
      closeDialog();
      toast('🎲 Pari de ' + cn(bamt) + ' placé sur l\'équipe ' + bside + ' (gain x2) !');
      return refresh().then(render);
    });
    return;
  }
  if (kind === 'gift-item') {
    var toPid = d.to, gitm = d.item, gmsg = String(d.message || '').trim();
    if (!toPid) return fail('Choisis un destinataire.');
    if (!gitm) return fail('Choisis un article.');
    var cost = giftPrice(gitm);
    if (cost > avail(S.me)) return fail('Solde insuffisant (il te faut ' + cn(cost) + ', tu as ' + cn(Math.max(avail(S.me), 0)) + ').');
    var dest = P(toPid);
    var destName = dest ? dest.pseudo : 'ce joueur';
    if (!confirm('Offrir « ' + giftItemName(gitm) + ' » à ' + destName + ' pour ' + cn(cost) + ' ?')) {
      if (btn) btn.disabled = false;
      return;
    }
    rpc('gift_item', {p_to: toPid, p_item: gitm, p_message: gmsg}).then(function(r){
      if (!r.ok) return fail(r.msg);
      closeDialog();
      toast('🎁 Cadeau envoyé avec succès à ' + destName + ' !');
      return refresh().then(render);
    });
    return;
  }
  if (kind === 'admin-score') {
    rpc('admin_set_score', {mid: f.dataset.id, p_a: parseInt(d.a, 10), p_b: parseInt(d.b, 10)}).then(function(r){ if (!r.ok) return fail(r.msg); toast('Score mis à jour.'); render(); });
    return;
  }
  if (kind === 'tour-restrict') {
    var who = String(d.pseudo || '').trim().toLowerCase();
    var hit = Object.keys(S.players).filter(function(id){ return P(id).pseudo.toLowerCase() === who; });
    if (!hit.length) return fail('Joueur introuvable. Choisis un pseudo dans la liste.');
    rpc('tour_restrict', {p_player: hit[0], p_hours: parseInt(d.hours, 10)}).then(function(r){ if (!r.ok) return fail(r.msg); toast('Joueur restreint de tournoi.'); render(); });
    return;
  }
  if (kind === 'custom-save') {
    var cp = {name: d.name, game: d.game, team_size: parseInt(d.team_size, 10), max_players: parseInt(d.max_players, 10), format: d.format, no_fight_top: d.format === 'ppstack' ? String(parseInt(d.no_fight_top, 10) || '') : '', games: parseInt(d.games, 10) || 1, rules: d.rules || '', prize: d.prize || '', map_name: d.map_name || '', map_code: d.map_code || '', starts_at: d.starts_at ? new Date(d.starts_at).toISOString() : ''};
    var cedit = f.dataset.id;
    rpc(cedit ? 'update_custom' : 'create_custom', cedit ? {cid: cedit, p: cp} : {p: cp}).then(function(r){
      if (!r.ok) return fail(r.msg);
      closeDialog(); customId = cedit || r.data; tourId = null; toast(cedit ? 'Partie perso mise à jour.' : 'Partie perso créée ! Les inscriptions sont ouvertes.'); if (viewName() !== 'tournois') location.hash = '#tournois'; else render();
    });
    return;
  }
  if (kind === 'custom-join') {
    rpc('join_custom', {cid: f.dataset.id, p_team: d.team || ''}).then(function(r){ if (!r.ok) return fail(r.msg); toast('Inscrit ! Tu recevras le code de la partie perso au lancement.'); render(); });
    return;
  }
  if (kind === 'custom-code') {
    if (!confirm('Envoyer le code « ' + String(d.code || '').trim() + ' » à tous les inscrits ?')) { if (btn) btn.disabled = false; return; }
    rpc('send_custom_code', {cid: f.dataset.id, p_code: d.code || ''}).then(function(r){ if (!r.ok) return fail(r.msg); toast('Code envoyé à ' + r.data + ' joueur' + (r.data > 1 ? 's' : '') + ' !'); render(); });
    return;
  }
  if (kind === 'tour-create') {
    rpc('create_tournament', {p_name: d.name, p_mode: d.mode, p_bo: d.bo, p_pingpong: !!d.pingpong, p_max: parseInt(d.max, 10), p_fee: num(d.fee) || 0, p_bonus: num(d.bonus) || 0, p_rules: d.rules || '', p_starts: d.starts ? new Date(d.starts).toISOString() : null}).then(function(r){
      if (!r.ok) return fail(r.msg);
      closeDialog(); tourId = r.data; toast('Tournoi créé ! Les inscriptions sont ouvertes.'); if (viewName() !== 'tournois') location.hash = '#tournois'; else render();
    });
    return;
  }
  if (kind === 'cosmetics') {
    rpc('set_cosmetics', {p_style: d.style || '', p_title: d.title || ''}).then(function(r){ if (!r.ok) return fail(r.msg); toast('Style VIP enregistré !'); render(); });
    return;
  }
  if (kind === 'team-create') {
    rpc('create_team', {p_name: d.name, p_size: parseInt(d.size, 10)}).then(function(r){ if (btn) btn.disabled = false; if (!r.ok) { var er = f.parentNode.querySelector('.err'); if (er) er.textContent = r.msg; return; } toast('Équipe créée ! Invite tes coéquipiers.'); render(); });
    return;
  }
  if (kind === 'match') {
    var stkW = num(d.stake);
    if (isNaN(stkW) || stkW < 0.5) return fail('Mise invalide (minimum 0,5 coin).');
    if (stkW > avail(S.me)) return fail('Solde insuffisant (tu as ' + cn(Math.max(avail(S.me), 0)) + ').');
  }
  var map = {
    edit: ['update_profile', {p_pseudo: d.pseudo, p_twitter: String(d.twitter || '').trim().replace(/^@/, ''), p_bio: d.bio}, 'Profil mis à jour.'],
    match: ['create_match', {p_mode: d.mode, p_format: d.format, p_bo: d.bo, p_stake: num(d.stake), p_rules: d.rules, p_target: d.target || null, p_team: d.team || null, p_pingpong: !!d.pingpong, p_kill_lead: isNaN(parseInt(d.kill_lead, 10)) ? 0 : parseInt(d.kill_lead, 10), p_no_break: !!d.nobreak}, 'Défi publié. ' + cn(num(d.stake) || 0) + ' mis en jeu.'],
    tip: ['send_tip', {p_to: d.to, p_amount: num(d.amount), p_note: d.note}, cn(num(d.amount) || 0) + ' envoyé(s).'],
    sanction: ['set_player_status', {p_player: f.dataset.pid, p_status: f.dataset.mode, p_reason: d.reason || '', p_hours: f.dataset.mode === 'restricted' ? parseInt(d.hours, 10) : null}, f.dataset.mode === 'ok' ? 'Sanction levée.' : f.dataset.mode === 'banned' ? 'Joueur banni.' : 'Joueur restreint.'],
    'owner-give-vc': ['owner_give_vcoins', {p_player: d.to, p_amount: num(d.amount), p_note: d.note}, (num(d.amount) < 0 ? fmt(Math.abs(num(d.amount))) + ' VC retirés.' : fmt(num(d.amount) || 0) + ' VC donnés.')],
    'admin-give': ['admin_give', {p_player: d.to, p_amount: (f.dataset.mode === 'remove' ? -1 : 1) * Math.abs(num(d.amount)), p_note: d.note}, f.dataset.mode === 'remove' ? cn(Math.abs(num(d.amount)) || 0) + ' retiré(s).' : cn(Math.abs(num(d.amount)) || 0) + ' donné(s).']
  }[kind];
  if (!map) return;
  rpc(map[0], map[1]).then(function(r){
    if (!r.ok || kind !== 'edit') return r;
    return rpc('set_twitch', {p_twitch: d.twitch || ''});
  }).then(function(r){
    if (!r.ok || kind !== 'edit' || me().epic) return r;
    return rpc('set_fortnite', {p_name: d.fortnite || ''});
  }).then(function(r){
    if (!r.ok) return fail(r.msg);
    if (kind === 'edit') editing = false;
    if (kind === 'match') { tab = 'ouverts'; if (viewName() !== 'arene') location.hash = '#arene'; }
    closeDialog(); toast(map[2]); render();
  });
});
window.addEventListener('hashchange', function(){ if (viewName() === 'profil' && !S.players[viewPid]) viewPid = S.me; render(); window.scrollTo(0, 0); });


/* ---------- panneau fondateur : VIP et articles des joueurs ---------- */
function allShopItems(){
  var list = ['neon', 'gif'].concat(Object.keys(CATALOG));
  Object.keys(TITLES).forEach(function(k){ list.push('title:' + k); });
  Object.keys(WHEEL_TITLES).forEach(function(k){ list.push('title:' + k); });
  return list.filter(function(i, n){ return list.indexOf(i) === n; });
}
function ownerItemName(i){ return i.indexOf('title:') === 0 && WHEEL_TITLES[i.slice(6)] ? 'Titre « ' + WHEEL_TITLES[i.slice(6)] + ' »' : itemName(i); }
function ownerPanelHTML(pid){
  var p = P(pid), owned = (p.owned || []).slice(), id = esc(pid);
  var vip = p.vip ? '<b style="color:var(--gold)">VIP jusqu’au ' + dateTxt(p.vipUntil) + '</b>' : '<b>Pas VIP</b>';
  var html = '<section class="panel owner-panel"><h2>👑 Fondateur · achats et VIP de ' + esc(p.pseudo) + '</h2>';
  html += '<div class="op-row"><p>Statut : ' + vip + '</p><div class="actions">' +
    '<button class="btn sm" data-act="own-vip-give" data-pid="' + id + '">Offrir du VIP</button>' +
    (p.vip ? '<button class="btn sm ghost" data-act="own-vip-remove" data-pid="' + id + '" data-refund="0">Retirer le VIP</button><button class="btn sm danger" data-act="own-vip-remove" data-pid="' + id + '" data-refund="20">Retirer le VIP + rembourser 20</button>' : '') +
    '</div></div>';
  html += '<h3 class="op-h">Articles possédés (' + owned.length + ')</h3>';
  html += owned.length ? '<ul class="op-items">' + owned.map(function(i){
    return '<li><span>' + esc(ownerItemName(i)) + '<small>' + esc(i) + '</small></span><div class="actions">' +
      '<button class="btn sm ghost" data-act="own-item-remove" data-pid="' + id + '" data-item="' + esc(i) + '" data-refund="0">Retirer</button>' +
      '<button class="btn sm danger" data-act="own-item-remove" data-pid="' + id + '" data-item="' + esc(i) + '" data-refund="1">Retirer + rembourser</button></div></li>';
  }).join('') + '</ul>' : '<p class="help">Aucun article.</p>';
  var dispo = allShopItems().filter(function(i){ return owned.indexOf(i) < 0; });
  html += '<h3 class="op-h">Offrir un article gratuitement</h3><div class="op-give"><select id="own-give-sel">' +
    dispo.map(function(i){ return '<option value="' + esc(i) + '">' + esc(ownerItemName(i)) + '</option>'; }).join('') +
    '</select><button class="btn sm primary" data-act="own-item-give" data-pid="' + id + '">🎁 Offrir</button></div>';
  html += '<p class="help">« Rembourser » rend au joueur le prix boutique de l’article. Un article retiré est aussi déséquipé tout seul.</p></section>';
  return html;
}

/* ---------- connexion Epic Games ---------- */
var EPIC_ID = (window.LEGACY_CONFIG && window.LEGACY_CONFIG.epicClientId) || '';
// tant qu'Epic n'a pas validé la marque (Brand Review), seul le fondateur peut lier son compte
var EPIC_PUBLIC = !!(window.LEGACY_CONFIG && window.LEGACY_CONFIG.epicPublic);
function epicRedirect(){ return location.origin + location.pathname; }
function epicCall(body, okMsg){
  if (busy) return; busy = true;
  return sb.functions.invoke('epic', {body: body}).then(function(r){
    if (!r.error) return r.data || {};
    var ctx = r.error.context;
    return (ctx && ctx.json ? ctx.json().catch(function(){ return {}; }) : Promise.resolve({})).then(function(j){ throw new Error((j && j.error) || 'La connexion avec Epic a échoué.'); });
  }).then(function(d){ busy = false; toast(typeof okMsg === 'function' ? okMsg(d) : okMsg); return refresh(); }, function(e){ busy = false; toast(e.message); }).then(render);
}
function epicReturn(){
  var q = new URLSearchParams(location.search), code = q.get('code'), st = q.get('state'), saved = null;
  if (!code) return;
  try { saved = sessionStorage.getItem('legacy-epic-state'); sessionStorage.removeItem('legacy-epic-state'); } catch (e) {}
  history.replaceState(null, '', location.pathname + '#profil');
  if (!S.me || !saved || saved !== st) { toast('Liaison Epic annulée, réessaie depuis ton profil.'); return; }
  viewPid = S.me; render();
  epicCall({action: 'link', code: code}, function(d){ return 'Compte Epic lié ! Pseudo Fortnite : ' + (d.fortnite || ''); });
}

/* ---------- démarrage ---------- */
render();
if (sb) {
  var liveChan = null;
  function trackPresence(){
    if (liveChan && S.me) {
      try { liveChan.track({user_id: S.me, at: Date.now()}); } catch(e){}
    }
  }
  function beat(){
    if (!S.me || document.visibilityState === 'hidden') return;
    trackPresence();
    if (S.players[S.me]) S.players[S.me].lastSeen = Date.now();
    sb.rpc('heartbeat').then(function(){
      if (S.players[S.me]) S.players[S.me].lastSeen = Date.now();
    });
  }
  sb.auth.getSession().then(function(s){
    S.me = s.data.session ? s.data.session.user.id : null;
    if (S.me) beat();
    return refresh();
  }).then(function(){ render(); epicReturn(); beat(); });
  sb.auth.onAuthStateChange(function(ev, session){
    S.me = session ? session.user.id : null;
    if (S.me) beat();
  });
  try {
    liveChan = sb.channel('legacy-live')
      .on('presence', {event: 'sync'}, function(){
        var st = liveChan.presenceState(), map = {};
        Object.keys(st || {}).forEach(function(k){
          (st[k] || []).forEach(function(x){
            if (x && x.user_id) {
              map[x.user_id] = true;
              if (S.players[x.user_id]) S.players[x.user_id].lastSeen = Date.now();
            }
          });
        });
        onlinePeers = map;
        if (!typing() && viewName() === 'amis') render();
      })
      .on('postgres_changes', {event: '*', schema: 'public', table: 'matches'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'profiles'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'friendships'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'notifications'}, function(){
        passiveRefresh();
        setTimeout(checkGiftReveal, 600);
        setTimeout(function(){ if (dlg && dlg.kind === 'notifs') renderDialog(); }, 1200);
      })
      .on('postgres_changes', {event: '*', schema: 'public', table: 'team_members'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'tournaments'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'tournament_players'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'tournament_matches'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'customs'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'custom_entries'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'custom_codes'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'tour_bans'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'match_proofs'}, function(p){ var mid = (p.new && p.new.match_id) || (p.old && p.old.match_id); if (mid && proofsCache[mid]) { delete proofsCache[mid]; loadProofs(mid); } })
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'match_messages'}, function(p){
        var mid = p && p.new && p.new.match_id;
        if (mid && chatCache[mid]) { delete chatCache[mid]; loadChat(mid); }
      })
      .subscribe(function(status){
        if (status === 'SUBSCRIBED') beat();
      });
  } catch(e){}
  setInterval(passiveRefresh, 30000);
  setTimeout(beat, 1000); setInterval(beat, 30000);
  document.addEventListener('visibilitychange', beat);
  window.addEventListener('focus', beat);
}
collabInit();
chatInit();
casinoInit();
})();
