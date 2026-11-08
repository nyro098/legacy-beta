(function(){
'use strict';

/* ---------- constantes ---------- */
var START = 10;
var MODES = ['Box fight','Build fight','Zone wars','Realistic 1v1','Pickaxe fight'];
var BOS = ['FT3','FT5','FT7'];
var BO_LABEL = {FT3: 'Premier à 3', FT5: 'Premier à 5', FT7: 'Premier à 7'};
function boLabel(m){ return esc(BO_LABEL[m.bo] || m.bo) + (m.pingpong ? ' · ping-pong' : ''); }
var COIN = '<svg class="coin" viewBox="0 0 20 20" aria-hidden="true"><circle class="c1" cx="10" cy="10" r="9"/><circle class="c2" cx="10" cy="10" r="6.5"/><path class="c3" d="M8.2 6.2v7.4h4"/></svg>';
var EMAIL_DOMAIN = 'legacy-beta.app';
var DISCORD_URL = 'https://discord.gg/EpNWaAscD';
var DC_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.6 19.6 0 0 0 15.4 3l-.6 1.3a18 18 0 0 0-5.6 0L8.6 3a19.6 19.6 0 0 0-4.9 1.5C.6 9.1-.3 13.6.1 18a19.8 19.8 0 0 0 6 3l1.3-2.1a12.7 12.7 0 0 1-2-1l.5-.4a14 14 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.7 19.7 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.6zM8 15.3c-1.2 0-2.1-1.1-2.1-2.4S6.8 10.5 8 10.5s2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4zm8 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4z"/></svg>';
function dcBtn(label){ return '<a class="btn sm discord-btn dc-top" href="' + DISCORD_URL + '" target="_blank" rel="noopener noreferrer" title="Rejoindre le serveur Discord GRIND">' + DC_ICON + '<span>' + label + '</span></a>'; }

/* ---------- utilitaires ---------- */
function $(s){ return document.querySelector(s); }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function fmt(n){ n = Math.round(Number(n || 0) * 10) / 10; return String(n).replace('.', ','); }
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

var S = {players: {}, matches: {}, me: null, lastMatch: null};
var txCache = {};
var loaded = false, loadErr = '';

function mapPlayer(p){ return {id: p.id, pseudo: p.pseudo, vip: !!p.vip, nameStyle: p.name_style || '', titleKey: p.title || '', title: (TITLES[p.title] || ''), owned: p.owned_items || [], eq: p.equipped || {}, vipSince: p.vip_since ? Date.parse(p.vip_since) : 0, discord: p.discord, twitter: p.twitter, bio: p.bio, balance: Number(p.balance), admin: p.is_admin, owner: p.is_owner, joined: p.discord_joined, avatar: p.avatar_url || '', rulesAt: p.rules_accepted_at ? Date.parse(p.rules_accepted_at) : 0, status: (p.status === 'restricted' && p.restricted_until && Date.parse(p.restricted_until) <= Date.now()) ? 'ok' : (p.status || 'ok'), statusReason: p.status_reason || '', restrictedUntil: p.restricted_until ? Date.parse(p.restricted_until) : 0, createdAt: Date.parse(p.created_at)}; }
function mapMatch(m){
  return {id: m.id, creator: m.creator, teamA: m.team_a || [], teamB: m.team_b || [], size: m.size, format: m.size + 'v' + m.size, mode: m.mode, bo: m.bo,
    stake: Number(m.stake), pingpong: !!m.pingpong, rules: m.rules, target: m.target, status: m.status, declA: m.decl_a, declB: m.decl_b, winner: m.winner, adminWinner: m.admin_resolved,
    teamATeam: m.team_a_team || null,
    aSA: m.a_decl_sa, aSB: m.a_decl_sb, bSA: m.b_decl_sa, bSB: m.b_decl_sb,
    scoreA: m.score_a, scoreB: m.score_b, scoreOk: !!m.score_confirmed,
    firstDeclAt: m.first_decl_at ? Date.parse(m.first_decl_at) : 0, pinnedUntil: m.pinned_until ? Date.parse(m.pinned_until) : 0, afkClaim: !!m.afk_claim, autoValidated: !!m.auto_validated, createdAt: Date.parse(m.created_at), finishedAt: m.finished_at ? Date.parse(m.finished_at) : 0};
}
function refresh(){
  return Promise.all([
    sb.from('profiles').select('id,pseudo,discord,twitter,bio,balance,is_admin,is_owner,discord_joined,avatar_url,rules_accepted_at,status,status_reason,restricted_until,last_seen,vip,vip_since,name_style,title,owned_items,equipped,created_at'),
    sb.from('matches').select('*').order('created_at', {ascending: false}).limit(400),
    S.me ? sb.from('friendships').select('requester,addressee,status,created_at') : Promise.resolve({data: []}),
    S.me ? sb.from('teams').select('id,name,owner,size,created_at') : Promise.resolve({data: []}),
    S.me ? sb.from('team_members').select('team_id,player,status,invited_by') : Promise.resolve({data: []}),
    S.me ? sb.from('notifications').select('*').order('created_at', {ascending: false}).limit(40) : Promise.resolve({data: []})
  ]).then(function(r){
    if (r[0].error) throw r[0].error;
    if (r[1].error) throw r[1].error;
    var P = {}, M = {};
    r[0].data.forEach(function(p){ P[p.id] = mapPlayer(p); P[p.id].lastSeen = p.last_seen ? Date.parse(p.last_seen) : 0; });
    r[1].data.forEach(function(m){ M[m.id] = mapMatch(m); });
    S.players = P; S.matches = M; S.friends = r[2].data || []; var T = {}; (r[3].data || []).forEach(function(x){ x.members = []; T[x.id] = x; }); (r[4].data || []).forEach(function(x){ if (T[x.team_id]) T[x.team_id].members.push(x); }); S.teams = T; S.notifs = r[5].data || []; loaded = true; loadErr = '';
    txCache = {};
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
  if (pw.length < 6) return Promise.resolve({ok: false, msg: 'Le mot de passe fait au moins 6 caractères.'});
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
function nm(p){ var fx = p.eq && p.eq.fx ? ' fx-' + p.eq.fx.split(':')[1] : '', em = p.eq && p.eq.emoji ? ' <span class="emo">' + (EMOJI[p.eq.emoji.split(':')[1]] || '') + '</span>' : ''; var cls = (p.nameStyle ? 'neon neon-' + p.nameStyle : '') + fx; return (cls ? '<span class="' + cls.trim() + '" data-t="' + esc(p.pseudo) + '">' + esc(p.pseudo) + '</span>' : esc(p.pseudo)) + em; }
function titleHTML(p){ return p.title ? '<span class="ptitle">' + esc(p.title) + '</span>' : ''; }
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
function stats(pid){
  var w = 0, l = 0, net = 0, list = [];
  for (var k in S.matches) {
    var m = S.matches[k], t = teamOf(m, pid);
    if (m.status !== 'done' || !t) continue;
    var win = t === m.winner; list.push({at: m.finishedAt, win: win});
    if (win) { w++; net += m.stake; } else { l++; net -= m.stake; }
  }
  list.sort(function(a, b){ return b.at - a.at; });
  var streak = 0; for (var i = 0; i < list.length; i++) { if (list[i].win) streak++; else break; }
  return {w: w, l: l, net: net, streak: streak, ratio: (w + l) ? Math.round(100 * w / (w + l)) : null};
}
function coinsInPlay(){ var t = 0; for (var k in S.matches) { var m = S.matches[k]; if (active(m)) t += m.stake * (m.teamA.length + m.teamB.length); } return t; }
function myDecl(m){ return S.me === capA(m) ? m.declA : S.me === capB(m) ? m.declB : null; }

/* ---------- état de l'interface ---------- */
var authTab = 'login', tab = 'ouverts', viewPid = null, editing = false, dlg = null, lastFocus = null, toastT = null, busy = false;
var VIEWS = ['arene', 'classement', 'amis', 'boutique', 'profil', 'regles', 'signaler', 'match'];
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

function sideHTML(m, team, ws){
  var ids = team === 'A' ? m.teamA : m.teamB, cls = team === 'A' ? 'a' : 'b', st = stateOf(m);
  var c = cls + (st === 'done' && ws ? (ws === team ? ' win' : ' lose') : '');
  var lead = ids[0] && S.players[ids[0]]; if (lead && lead.eq && lead.eq.poster) c += ' pt-' + lead.eq.poster.split(':')[1];
  var tag = (st === 'done' && ws === team) ? '<span class="tagw">VAINQUEUR</span>' : '';
  if (m.size === 1) {
    var pid = ids[0];
    if (!pid) return '<div class="side ' + c + '"><span class="av lg empty-av">?</span><strong>En attente</strong><small>' + (m.target ? 'Défi pour ' + esc(P(m.target).pseudo) : 'Ouvert à tous') + '</small></div>';
    var p = P(pid), s = stats(pid);
    return '<div class="side ' + c + '">' + av(p, 'lg') + '<strong>' + nm(p) + '</strong>' + titleHTML(p) + '<small>' + s.w + 'V · ' + s.l + 'D</small>' + tag + '</div>';
  }
  var rows = '';
  for (var i = 0; i < m.size; i++) {
    var q = ids[i];
    rows += q ? '<li class="slot">' + av(P(q), 'sm') + '<span class="nm">' + nm(P(q)) + '</span>' + (i === 0 ? '<i>cap.</i>' : '') + '</li>'
              : '<li class="slot free"><span class="av sm empty-av">+</span><span class="nm">Place libre</span></li>';
  }
  return '<div class="side ' + c + '"><span class="tname">Équipe ' + team + '</span><ul class="roster">' + rows + '</ul>' + tag + '</div>';
}

function posterHTML(m, big){
  var st = stateOf(m), ws = winnerSide(m), tm = teamOf(m, S.me), id = esc(m.id);
  var ha = hue(P(m.teamA[0]).pseudo), hb = m.teamB.length ? hue(P(m.teamB[0]).pseudo) : 0;
  var face = '<div class="p-face' + (m.size > 1 ? ' team' : '') + ((m.size === 1 && !m.teamB.length) ? ' vacant-b' : '') + '" style="--ha:' + ha + ';--hb:' + hb + '">' +
    sideHTML(m, 'A', ws) + sideHTML(m, 'B', ws) + (m.status === 'done' && m.scoreA != null ? '<div class="vs score" aria-label="Score ' + m.scoreA + ' à ' + m.scoreB + '">' + m.scoreA + '<i>–</i>' + m.scoreB + '</div>' : '<div class="vs" aria-hidden="true">VS</div>') + '</div>';
  var pot = '<div class="p-pot"><span>Mise de chaque joueur</span><b>' + COIN + fmt(m.stake) + '</b></div>';
  var top = '<div class="p-top"><span class="mode">' + esc(m.mode) + '</span><span class="fmt">' + esc(m.format) + '</span><span class="bo">' + esc(BO_LABEL[m.bo] || m.bo) + '</span>' + (m.pingpong ? '<span class="bo pp">Ping-pong</span>' : '') + (st === 'open' && m.pinnedUntil > Date.now() ? '<span class="pin-tag">📌 Épinglé</span>' : '') + '<span class="chip ' + st + '">' + STATE_LABEL[st] + '</span></div>';
  if (big) return '<div class="poster big">' + top + face + pot + '</div>';
  var f = '', needs = m.size * 2 - m.teamA.length - m.teamB.length;
  if (st === 'open') {
    if (tm) f = '<small>Tu es dans l\'équipe ' + tm + ' · ' + needs + ' place' + (needs > 1 ? 's' : '') + ' libre' + (needs > 1 ? 's' : '') + '</small><button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button>';
    else if (m.target && m.target !== S.me) f = '<small>Réservé à ' + esc(P(m.target).pseudo) + '</small>';
    else if (m.size === 1) f = '<small>Lancé ' + ago(m.createdAt) + '</small><button class="btn primary sm" data-act="join" data-id="' + id + '">Accepter</button>';
    else f = '<small>' + needs + ' place' + (needs > 1 ? 's' : '') + ' libre' + (needs > 1 ? 's' : '') + '</small><div class="actions">' +
        (m.teamA.length < m.size && canJoinA(m) ? '<button class="btn primary sm" data-act="join" data-id="' + id + '" data-team="A">Équipe A</button>' : '') +
        (m.teamB.length < m.size ? '<button class="btn primary sm" data-act="join" data-id="' + id + '" data-team="B">Équipe B</button>' : '') + '</div>';
  } else if (st === 'live' && tm) f = '<small>' + (myDecl(m) ? 'Résultat envoyé' : 'Résultat à déclarer') + '</small><button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button>';
  else if (st === 'dispute') f = '<small>Déclarations contradictoires</small>' + (tm || isAdmin() ? '<button class="btn sm" data-act="open-match" data-id="' + id + '">Ouvrir</button>' : '');
  else if (st === 'done') { var wl = ws === 'A' ? m.teamA : m.teamB; f = '<small>' + esc(names(wl)) + (wl.length > 1 ? ' empochent ' : ' empoche ') + cn(m.stake) + (wl.length > 1 ? ' chacun' : '') + '</small>'; }
  else if (st === 'live') f = '<small>Match en cours</small>';
  else f = '<small>Défi annulé</small>';
  var a = P(m.teamA[0]);
  return '<article class="poster" data-open="' + id + '" tabindex="0" role="button" aria-label="' + esc(m.mode + ' ' + m.format + ' : équipe de ' + a.pseudo + ', mise ' + cn(m.stake)) + '">' + top + face + pot + '<div class="p-foot">' + f + '</div></article>';
}

function betaBar(){ return '<div class="betabar"><b>LEGACY BÊTA</b> · Version de test : les coins n\'ont aucune valeur réelle et les données peuvent être remises à zéro.</div>'; }

function headerHTML(v){
  var p = me(), bal = avail(p.id), lk = locked(p.id);
  function link(h, label){ return '<a href="#' + h + '"' + (v === h || (h === 'arene' && v === 'match') ? ' aria-current="page"' : '') + (h === 'profil' ? ' data-act="myprofile"' : '') + '>' + label + '</a>'; }
  return betaBar() + '<header class="top"><div class="wrap bar">' +
    '<a class="logo" href="#arene" aria-label="Legacy, accueil">' + LOGO + '<span>Legacy</span><em class="beta">BÊTA</em></a>' +
    '<nav class="nav" aria-label="Navigation">' + link('arene', 'Arène') + link('classement', 'Classement') + link('amis', 'Amis' + (pendingIn() ? ' <i class="count">' + pendingIn() + '</i>' : '')) + link('boutique', 'Boutique') + link('profil', 'Mon profil') + link('regles', 'Règles') + link('signaler', 'Signaler') + '</nav>' +
    '<div class="bar-right">' +
    '<a class="bal" href="#profil" data-act="myprofile" title="Ton solde disponible">' + COIN + '<span>' + fmt(bal) + '</span>' + (lk ? '<small>' + fmt(lk) + ' en jeu</small>' : '') + '</a>' +
    dcBtn('Discord') +
    '<button class="btn sm bell" data-act="search" title="Rechercher un joueur" aria-label="Rechercher un joueur">🔍</button>' +
    '<button class="btn sm bell" data-act="notifs" title="Notifications" aria-label="Notifications">🔔' + (unread() ? '<i class="count">' + unread() + '</i>' : '') + '</button>' +
    '<button class="btn sm" data-act="tip-dialog">Pourboire</button>' +
    (isAdmin() ? '<button class="btn sm admin" data-act="admin-dialog">Admin</button>' : '') +
    '<button class="btn sm ghost" data-act="logout">Déconnexion</button>' +
    '</div></div></header>';
}
function footerHTML(){ return '<footer class="foot"><div class="wrap"><span><a href="' + DISCORD_URL + '" target="_blank" rel="noopener noreferrer">Serveur Discord Legacy</a> · Legacy bêta · les coins n\'ont aucune valeur réelle, pas d\'achat ni de retrait.</span><span>Non affilié à Epic Games.</span></div></footer>'; }

function arenaHTML(){
  var all = Object.keys(S.matches).map(function(k){ return S.matches[k]; });
  var open = all.filter(function(m){ return m.status === 'open'; }).sort(function(a, b){ return (b.pinnedUntil > Date.now()) - (a.pinnedUntil > Date.now()) || b.createdAt - a.createdAt; });
  var disputes = isAdmin() ? all.filter(function(m){ return m.status === 'dispute'; }) : [];
  var mineM = all.filter(function(m){ return teamOf(m, S.me) && active(m); });
  var doneM = all.filter(function(m){ return m.status === 'done'; }).sort(function(a, b){ return b.finishedAt - a.finishedAt; }).slice(0, 12);
  var list = tab === 'mes' ? mineM : tab === 'termines' ? doneM : open;
  var played = all.filter(function(m){ return m.status === 'done'; }).length;
  var html = '<section class="hero"><div><p class="eyebrow">Fortnite · défis à mise</p><h1>Mets tes coins en jeu.</h1><p class="lead">Du 1v1 au 3v3 : lance un défi, mise des coins, et empoche la mise des perdants. Tout le monde démarre avec ' + cn(START) + '.</p></div>' +
    '<button class="btn primary" data-act="new-match">Lancer un défi</button></section>';
  html += podiumHTML(true);
  html += '<section class="strip" aria-label="Chiffres de Legacy"><div><b>' + Object.keys(S.players).length + '</b><span>Joueurs</span></div><div><b>' + played + '</b><span>Matchs joués</span></div><div><b>' + fmt(coinsInPlay()) + '</b><span>Coins en jeu</span></div></section>';
  if (avail(S.me) <= 0) html += '<div class="notice"><p><b>Plus aucun coin disponible.</b> Tu peux regarder les défis et en recevoir. Donne ton pseudo à un autre joueur pour qu\'il t\'envoie un pourboire.</p><button class="btn sm" data-act="copy-pseudo">Copier mon pseudo</button></div>';
  function t(id, label, n){ return '<button role="tab" aria-selected="' + (tab === id) + '" data-act="tab" data-tab="' + id + '">' + label + '<i>' + n + '</i></button>'; }
  html += '<div><div class="tabs" role="tablist">' + t('ouverts', 'Défis ouverts', open.length) + t('mes', 'Mes matchs', mineM.length) + t('termines', 'Terminés', doneM.length) + '</div></div>';
  if (!list.length) {
    var msg = tab === 'mes' ? ['Aucun match en cours', 'Lance un défi ou accepte-en un depuis l\'onglet Défis ouverts.'] : tab === 'termines' ? ['Rien de joué pour l\'instant', 'Les matchs terminés apparaîtront ici.'] : tab === 'litiges' ? ['Aucun litige', 'Tout le monde est d\'accord, pour l\'instant.'] : ['Aucun défi ouvert', 'Lance le premier défi de l\'arène.'];
    html += '<div class="empty"><b>' + msg[0] + '</b>' + msg[1] + '</div>';
  } else html += '<div class="grid">' + list.map(function(m){ return posterHTML(m, false); }).join('') + '</div>';
  return html;
}

function teamCard(m, team){
  var ids = team === 'A' ? m.teamA : m.teamB, mt = teamOf(m, S.me);
  var title = mt ? (mt === team ? 'Ton équipe' : 'Équipe adverse') : 'Équipe ' + team, lis = '';
  for (var i = 0; i < m.size; i++) {
    var q = ids[i];
    lis += q ? '<li><button data-act="goto-player" data-pid="' + esc(q) + '">' + av(P(q)) + '<span class="nm">' + nm(P(q)) + (q === S.me ? ' (toi)' : '') + '</span></button>' + (i === 0 ? '<i>Capitaine</i>' : '') + '</li>'
             : '<li class="free"><span class="av empty-av">+</span>Place libre</li>';
  }
  return '<div class="tcard' + (mt === team ? ' mine' : '') + '"><h3>' + title + '<small>ÉQUIPE ' + team + '</small></h3><ul>' + lis + '</ul></div>';
}

function matchPageHTML(){
  var m = S.matches[S.lastMatch], st = stateOf(m), mt = teamOf(m, S.me), ws = winnerSide(m), id = esc(m.id);
  var ca = capA(m), cb = capB(m), isCap = S.me === ca || S.me === cb;
  var html = '<button class="btn sm ghost back" data-act="back">← Retour à l\'arène</button>';
  html += '<section class="mhead"><div><p class="eyebrow">Match · lancé ' + ago(m.createdAt) + '</p><h1>' + esc(m.mode) + ' ' + esc(m.format) + '</h1></div><button class="btn sm" data-act="share" data-id="' + id + '">Copier le lien du match</button></section>';
  html += posterHTML(m, true);
  html += '<section><h2 class="sec" style="margin-bottom:14px">' + (mt ? 'Contre qui tu joues' : 'Les équipes') + '</h2><div class="teams">' + teamCard(m, 'A') + teamCard(m, 'B') + '</div></section>';
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
    } else if (m.creator === S.me) r += '<div class="actions">' + (m.pinnedUntil > Date.now() ? '<span class="pin-tag">📌 Épinglé jusqu\'à ' + untilTxt(m.pinnedUntil) + '</span>' : '<button class="btn" data-act="pin" data-id="' + id + '">📌 Épingler 1 h · ' + cn(3) + '</button>') + '<button class="btn danger" data-act="cancel" data-id="' + id + '">Annuler le défi</button></div><p class="help">Toutes les mises sont rendues si tu annules avant le début du match.</p>';
    else r += '<div class="actions"><button class="btn danger" data-act="leave" data-id="' + id + '">Quitter le match</button></div><p class="help">Ta mise t\'est rendue si tu quittes avant le début du match.</p>';
  } else if (st === 'live' || st === 'dispute') {
    if (mt) {
      var mine = myDecl(m), myCap = mt === 'A' ? ca : cb, oppCap = mt === 'A' ? cb : ca;
      var myD = mt === 'A' ? m.declA : m.declB, od = mt === 'A' ? m.declB : m.declA;
      var myS = declScore(m, mt), oppS = declScore(m, mt === 'A' ? 'B' : 'A');
      if (isCap) {
        r += '<p>' + (st === 'dispute' ? 'Les déclarations ne concordent pas. Vérifie le score : corrige-le si tu t\'es trompé, sinon un admin tranchera à partir des captures.' : 'Une fois le match joué, entre le score final et ajoute la capture d\'écran du résultat. Les coins bougent quand les deux capitaines sont d\'accord.') + '</p>' +
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
    if (isAdmin()) r += '<form data-form="admin-score" data-id="' + id + '" class="adminbox admin-score" novalidate><p class="help"><b>Admin</b> : corriger le score final.</p><div class="score-entry"><label><span>Équipe A</span><input name="a" type="number" min="0" max="99" value="' + (m.scoreA != null ? m.scoreA : '') + '"></label><b>–</b><label><span>Équipe B</span><input name="b" type="number" min="0" max="99" value="' + (m.scoreB != null ? m.scoreB : '') + '"></label><button class="btn sm" type="submit">Enregistrer</button></div><p class="err" role="alert"></p></form>';
  } else r += '<p>Ce défi a été annulé. Les mises ont été rendues.</p>';
  if (isAdmin() && active(m)) {
    r += '<div class="adminbox"><p class="help" style="margin-bottom:10px"><b>Admin</b> : trancher ou annuler ce match.' + (st === 'dispute' ? ' A dit « ' + (m.declA === 'won' ? 'gagné' : 'perdu') + ' », B dit « ' + (m.declB === 'won' ? 'gagné' : 'perdu') + ' ».' : '') + '</p><div class="actions">' +
      (st !== 'open' ? '<button class="btn sm" data-act="admin-win" data-id="' + id + '" data-side="A">Victoire équipe A</button><button class="btn sm" data-act="admin-win" data-id="' + id + '" data-side="B">Victoire équipe B</button>' : '') +
      '<button class="btn sm danger" data-act="admin-cancel" data-id="' + id + '">Annuler et rembourser</button></div></div>';
  }
  html += r + '</section>';
  if (st !== 'open' && st !== 'cancelled') html += proofsSectionHTML(m, !!mt || isAdmin());
  if (mt || isAdmin()) {
    if (!chatCache[m.id]) loadChat(m.id);
    html += '<section class="panel chat"><h2>Chat du match</h2><p class="help">Visible seulement par les joueurs du match' + (isAdmin() && !mt ? ' (et toi, en admin)' : '') + '. Donne ton pseudo Fortnite, le code de l\'île…</p>' +
      '<div id="chat-list" class="chat-list">' + chatListHTML(m.id) + '</div>' +
      '<form data-form="chat" data-id="' + id + '" class="chat-form" novalidate><input name="body" maxlength="300" autocomplete="off" placeholder="Écris un message… (ex. ajoute-moi : MonPseudo)" aria-label="Message"><button class="btn primary" type="submit">Envoyer</button></form></section>';
  }
  html += '<section><h2 class="sec" style="margin-bottom:14px">Détails</h2><dl class="facts"><dt>Lancé par</dt><dd>' + esc(P(m.creator).pseudo) + '</dd>' +
    '<dt>Format</dt><dd>' + esc(m.mode) + ' · ' + esc(m.format) + ' · ' + boLabel(m) + '</dd>' + (m.pingpong ? '<dt>Ping-pong</dt><dd>Oui : il faut gagner avec 2 points d\'écart (ex. 7-5, pas 7-6).</dd>' : '') +
    '<dt>Mise</dt><dd>' + cn(m.stake) + ' par joueur</dd><dt>Pot total</dt><dd>' + cn(m.stake * m.size * 2) + '</dd>' +
    (m.target ? '<dt>Réservé à</dt><dd>' + esc(P(m.target).pseudo) + '</dd>' : '') +
    (m.rules ? '<dt>Règles</dt><dd>' + esc(m.rules) + '</dd>' : '') + '</dl></section>';
  return html;
}

function boardHTML(){
  var rows = Object.keys(S.players).filter(function(k){ return S.players[k].status !== 'banned'; }).map(function(k){ return {p: S.players[k], bal: balance(k), s: stats(k)}; });
  rows.sort(function(a, b){ return b.bal - a.bal || b.s.w - a.s.w || a.p.pseudo.localeCompare(b.p.pseudo); });
  var html = podiumHTML(false) + '<section><p class="eyebrow">Classement</p><h2 class="sec" style="margin-top:8px">Les plus riches de l\'arène</h2></section>';
  html += '<div class="tablewrap"><table><thead><tr><th scope="col">#</th><th scope="col">Joueur</th><th scope="col">Matchs</th><th scope="col">V–D</th><th scope="col">Victoires</th><th scope="col">Coins</th></tr></thead><tbody>';
  rows.forEach(function(r, i){
    html += '<tr class="' + (i === 0 ? 'top1' : '') + '"><td class="rank">' + (i + 1) + '</td><td><button class="who-cell" data-act="goto-player" data-pid="' + esc(r.p.id) + '">' + av(r.p) + '<span class="n">' + nm(r.p) + (r.p.id === S.me ? ' (toi)' : '') + badge(r.p) + (r.p.title ? '<br>' + titleHTML(r.p) : '') + '</span></button></td>' +
      '<td>' + (r.s.w + r.s.l) + '</td><td>' + r.s.w + '–' + r.s.l + '</td><td>' + (r.s.ratio == null ? '–' : r.s.ratio + '%') + '</td><td class="bal-c">' + fmt(r.bal) + '</td></tr>';
  });
  return html + '</tbody></table></div>';
}

var TX_LABEL = {shop: 'Achat boutique', bonus: 'Bonus d\'inscription', stake: 'Mise placée dans un match', refund: 'Mise rendue', win: 'Victoire : mise récupérée + gain', tip_in: 'Pourboire reçu de ', tip_out: 'Pourboire envoyé à ', admin: 'Ajustement admin'};
function profileHTML(){
  var pid = S.players[viewPid] ? viewPid : S.me, p = P(pid), own = pid === S.me, s = stats(pid), bal = avail(pid), lk = locked(pid);
  var html = '';
  if (own && editing) {
    html += '<section class="card" style="max-width:560px"><h2 class="sec">Modifier mon profil</h2><form data-form="edit" novalidate>' +
      '<label for="e-pseudo">Pseudo</label><input id="e-pseudo" name="pseudo" required maxlength="24" autocomplete="off" value="' + esc(p.pseudo) + '">' +
      '<label>Discord (identifiant de connexion)</label><input value="' + esc(p.discord) + '" disabled>' +
      '<label for="e-twitter">X / Twitter (facultatif)</label><input id="e-twitter" name="twitter" maxlength="33" autocomplete="off" value="' + esc(p.twitter) + '" placeholder="@pseudo">' +
      '<label for="e-bio">Bio (facultatif)</label><textarea id="e-bio" name="bio" maxlength="140" placeholder="Ton style de jeu, tes règles préférées…">' + esc(p.bio) + '</textarea>' +
      '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" data-act="edit-off">Annuler</button></div></form></section>';
  } else {
    html += '<section class="phead' + (p.eq && p.eq.banner ? ' bn bn-' + p.eq.banner.split(':')[1] : '') + '">' + av(p, 'xl') + '<div style="min-width:0"><p class="eyebrow">' + (own ? 'Ton profil' : 'Profil joueur') + (p.owner ? ' · fondateur' : p.admin ? ' · admin' : '') + '</p><h1>' + nm(p) + '</h1>' + (p.title ? '<p class="ptitle big">' + esc(p.title) + '</p>' : '') + '<div class="links">' +
      (p.discord ? '<span>Discord : ' + esc(p.discord) + '</span>' : '') +
      (p.twitter ? '<a href="https://x.com/' + encodeURIComponent(p.twitter) + '" target="_blank" rel="noopener noreferrer">X : @' + esc(p.twitter) + '</a>' : '') +
      '<span>Inscrit ' + ago(p.createdAt) + '</span></div>' + (p.bio ? '<p style="margin-top:10px;max-width:56ch;color:var(--fg-2)">' + esc(p.bio) + '</p>' : '') + '</div>' +
      '<div class="actions">' + (own && isOwner() ? '<button class="btn danger" data-act="admin-dialog" data-mode="remove" data-pid="' + esc(pid) + '">Me retirer des coins</button>' : '') + (own ? '<label class="btn primary" style="margin:0;cursor:pointer;color:#fff;letter-spacing:.08em">' + (p.avatar ? 'Changer la photo' : 'Ajouter une photo') + '<input type="file" id="avatar-file" accept="image/*" hidden></label>' + (p.avatar ? '<button class="btn ghost" data-act="avatar-remove">Retirer la photo</button>' : '') + '<button class="btn" data-act="edit-on">Modifier le profil</button>' : friendBtn(pid) + '<button class="btn" data-act="tip-dialog" data-pid="' + esc(pid) + '">Donner des coins</button>' + (isAdmin() && (isOwner() || !p.owner) ? '<button class="btn admin" data-act="admin-dialog" data-pid="' + esc(pid) + '">Admin : donner des coins</button>' : '') + (isOwner() && pid !== S.me ? '<button class="btn danger" data-act="admin-dialog" data-mode="remove" data-pid="' + esc(pid) + '">Retirer des coins</button>' : '')) + '</div></section>';
  }
  html += '<section class="pstats" aria-label="Statistiques"><div><b style="color:var(--gold)">' + fmt(bal) + '</b><span>Solde dispo</span></div><div><b>' + fmt(lk) + '</b><span>En jeu</span></div><div><b>' + s.w + '</b><span>Victoires</span></div><div><b>' + s.l + '</b><span>Défaites</span></div><div><b>' + (s.ratio == null ? '–' : s.ratio + '%') + '</b><span>Taux de victoire</span></div><div><b class="' + (s.net > 0 ? 'pos' : s.net < 0 ? 'neg' : '') + '">' + (s.net > 0 ? '+' : '') + fmt(s.net) + '</b><span>Bilan net</span></div><div><b>' + s.streak + '</b><span>Série en cours</span></div></section>';
  var cur = Object.keys(S.matches).map(function(k){ return S.matches[k]; }).filter(function(m){ return teamOf(m, pid) && active(m); });
  if (cur.length) html += '<section><h2 class="sec" style="margin-bottom:14px">Matchs en cours</h2><div class="grid">' + cur.map(function(m){ return posterHTML(m, false); }).join('') + '</div></section>';
  if (own && !editing) html += teamsSectionHTML();
  if (isAdmin() && !own && !p.owner && (isOwner() || !p.admin)) {
    html += '<section class="panel sanction"><h2>Modération</h2><p>Statut actuel : <b>' + (p.status === 'banned' ? 'Banni' : p.status === 'restricted' ? 'Restreint jusqu\'à ' + untilTxt(p.restrictedUntil) : 'Normal') + '</b>' + (p.statusReason ? ' · raison : « ' + esc(p.statusReason) + ' »' : '') + '</p><div class="actions">' +
      (p.status !== 'restricted' ? '<button class="btn" data-act="sanction" data-mode="restricted" data-pid="' + esc(pid) + '">Restreindre</button>' : '') +
      (p.status !== 'banned' ? '<button class="btn danger" data-act="sanction" data-mode="banned" data-pid="' + esc(pid) + '">Bannir</button>' : '') +
      (p.status !== 'ok' ? '<button class="btn win" data-act="sanction" data-mode="ok" data-pid="' + esc(pid) + '">Lever la sanction</button>' : '') +
      (p.title ? '<button class="btn ghost" data-act="clear-title" data-pid="' + esc(pid) + '">Effacer son titre</button>' : '') +
      '</div><p class="help">Restreint : peut regarder le site mais ne peut plus jouer, écrire dans les chats ni envoyer de coins. Banni : ne voit plus qu\'un écran « compte banni ».</p></section>';
  }
  if (!own && !isOwner()) return html;
  html += '<section><h2 class="sec" style="margin-bottom:14px">Historique des coins</h2>' + (own ? '<p class="help" style="margin:-6px 0 12px">Privé : toi seul vois ton historique.</p>' : '');
  var tx = txCache[pid];
  if (!tx) { loadTx(pid); tx = 'loading'; }
  if (tx === 'loading') html += '<div class="empty">Chargement…</div>';
  else if (!tx.length) html += '<div class="empty"><b>Rien pour l\'instant</b></div>';
  else {
    html += '<ul class="hist">';
    tx.forEach(function(e){
      var d = Number(e.delta), cls = d > 0 ? 'pos' : 'neg', m = e.match_id ? S.matches[e.match_id] : null;
      var title = esc(TX_LABEL[e.kind] || e.kind) + (e.kind === 'tip_in' || e.kind === 'tip_out' ? esc(P(e.other).pseudo) : '');
      var sub = (m ? esc(m.mode) + ' · ' + esc(m.format) + (m.status === 'done' && m.scoreA != null && (e.kind === 'win' || e.kind === 'stake') ? ' · ' + (teamOf(m, pid) === 'B' ? m.scoreB + '–' + m.scoreA : m.scoreA + '–' + m.scoreB) : '') + ' · ' : '') + (e.note ? '« ' + esc(e.note) + ' » · ' : '') + ago(Date.parse(e.at));
      var inner = '<b>' + title + '</b><small>' + sub + '</small>';
      html += '<li>' + (m ? '<button class="t" data-act="open-match" data-id="' + esc(m.id) + '">' + inner + '</button>' : '<div class="t">' + inner + '</div>') + '<span class="amt ' + cls + '">' + (d > 0 ? '+' : '−') + fmt(Math.abs(d)) + ' ' + COIN + '</span></li>';
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
  sb.from('match_messages').select('id,author,body,at').eq('match_id', mid).order('at', {ascending: true}).limit(200).then(function(r){
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
  else if (n.kind === 'challenge') { txt = '<b>' + a + '</b> te défie en 1v1 : ' + mDesc + '.'; if (m) act = '<button class="btn sm primary" data-act="open-match" data-id="' + esc(m.id) + '">Voir le défi</button>'; }
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
  piece_control: 'Piece Control', invaincu: 'Invaincu', sniper: 'Sniper d\'élite', sang_froid: 'Sang-froid', tryhard: 'Tryhard assumé', legende: 'Légende de l\'arène'};
var RARE_TITLES = {intouchable: ['Intouchable', 10], le_boss: ['Le Boss', 15], legende_vivante: ['Légende vivante', 25]};
Object.keys(RARE_TITLES).forEach(function(k){ TITLES[k] = RARE_TITLES[k][0]; });
var LIMITED_UNTIL = Date.parse('2027-01-01T00:00:00+01:00');
var CATALOG = {
  'frame:neon': ['Cadre néon', 4], 'frame:fire': ['Cadre flammes', 6], 'frame:lightning': ['Cadre éclair', 6], 'frame:diamond': ['Cadre diamant', 8], 'frame:winter': ['Cadre Hiver 2026', 5],
  'banner:galaxy': ['Bannière galaxie', 5], 'banner:sunset': ['Bannière coucher de soleil', 5], 'banner:matrix': ['Bannière matrix', 5],
  'fx:glitch': ['Pseudo glitch', 8], 'fx:sparkle': ['Pseudo scintillant', 6], 'fx:wave': ['Pseudo vague', 6],
  'emoji:fire': ['🔥', 2], 'emoji:crown': ['👑', 2], 'emoji:bolt': ['⚡', 2], 'emoji:gem': ['💎', 2], 'emoji:goat': ['🐐', 2], 'emoji:target': ['🎯', 2],
  'poster:lava': ['Affiche lave', 5], 'poster:ice': ['Affiche glace', 5], 'poster:galaxy': ['Affiche galaxie', 5], 'poster:gold': ['Affiche or', 6],
  'win:confetti': ['Victoire confettis', 6], 'win:lightning': ['Victoire éclairs', 8]
};
var EMOJI = {fire: '🔥', crown: '👑', bolt: '⚡', gem: '💎', goat: '🐐', target: '🎯'};
function itemPrice(i){ if (i.indexOf('title:') === 0) { var k = i.slice(6); return RARE_TITLES[k] ? RARE_TITLES[k][1] : ITEM_PRICE; } return CATALOG[i] ? CATALOG[i][1] : ITEM_PRICE; }
function isVipItem(i){ return i === 'neon' || i === 'gif' || (i.indexOf('title:') === 0 && !RARE_TITLES[i.slice(6)]); }
function hasItem(i){ var p = me(); return !!(p && ((p.owned || []).indexOf(i) >= 0 || (p.vip && isVipItem(i)))); }
function itemName(i){ return i === 'neon' ? 'Pseudo néon' : i === 'gif' ? 'Photo de profil animée' : i.indexOf('title:') === 0 ? 'Titre « ' + (TITLES[i.slice(6)] || i) + ' »' : (CATALOG[i] ? (i.indexOf('emoji:') === 0 ? 'Emoji ' : '') + CATALOG[i][0] : i); }
function buyBtn(i){
  if (hasItem(i)) return '<span class="fr-tag ok">✓ Débloqué</span>';
  if (i === 'frame:winter' && Date.now() >= LIMITED_UNTIL) return '<span class="fr-tag">Épuisé</span>';
  var pr = itemPrice(i);
  return '<button class="btn sm primary" data-act="buy-item" data-item="' + i + '"' + (avail(S.me) < pr ? ' disabled' : '') + '>' + COIN + ' ' + pr + '</button>';
}
function slotOf(i){ return i.split(':')[0]; }
function itemAction(i){
  if (!hasItem(i)) return buyBtn(i);
  var p = me(), slot = slotOf(i), on = p.eq && p.eq[slot] === i;
  return on ? '<button class="btn sm ghost" data-act="equip" data-slot="' + slot + '" data-item="">Retirer</button>' : '<button class="btn sm" data-act="equip" data-slot="' + slot + '" data-item="' + i + '">Équiper</button>';
}
function previewOf(i){
  var p = me(), slot = slotOf(i), key = i.split(':')[1];
  if (slot === 'frame') return '<span class="avf avf-' + key + '"><span class="av lg" style="--h:' + hue(p.pseudo) + '">' + (p.avatar ? '<img src="' + esc(p.avatar) + '" alt="" style="width:100%;height:100%;object-fit:cover">' : ini(p.pseudo)) + '</span></span>';
  if (slot === 'banner') return '<span class="bn-prev bn-' + key + '"></span>';
  if (slot === 'fx') return '<span class="si-demo"><span class="fx-' + key + '" data-t="' + esc(p.pseudo) + '">' + esc(p.pseudo) + '</span></span>';
  if (slot === 'emoji') return '<span class="emo-prev">' + EMOJI[key] + '</span>';
  if (slot === 'poster') return '<span class="pt-prev pt-' + key + '"></span>';
  if (slot === 'win') return '<span class="win-prev">' + (key === 'confetti' ? '🎉' : '⚡') + '</span>';
  return '';
}
function itemCard(i, desc){
  var on = me().eq && me().eq[slotOf(i)] === i;
  return '<div class="shop-item' + (on ? ' on' : '') + '"><div class="si-prev">' + previewOf(i) + '</div><div class="si-txt"><b>' + esc(itemName(i)) + '</b>' + (desc ? '<small>' + desc + '</small>' : '') + '</div>' + itemAction(i) + '</div>';
}
var shopTab = 'vip';
function shopHTML(){
  var p = me();
  var tabs = [['vip', '👑 VIP'], ['profil', '✨ Profil'], ['matchs', '⚔️ Matchs'], ['titres', '🏷️ Titres'], ['limite', '⏳ Limité']];
  var html = '<section class="hero"><div><p class="eyebrow">Boutique</p><h1>Fais briller ton profil.</h1><p class="lead">Dépense tes coins pour te démarquer. Achats définitifs, aucun argent réel. Ton solde : <b>' + cn(avail(S.me)) + '</b>' + ((p.owned || []).length ? ' · ' + (p.owned || []).length + ' article' + ((p.owned || []).length > 1 ? 's' : '') + ' achetés' : '') + '.</p></div></section>';
  html += '<div class="tabs shop-tabs" role="tablist">' + tabs.map(function(t){ return '<button role="tab" aria-selected="' + (shopTab === t[0]) + '" data-act="shop-tab" data-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>';
  if (shopTab === 'vip') return html + vipShopHTML();
  if (shopTab === 'profil') {
    html += '<section><h2 class="sec shop-h">Cadres de photo</h2><div class="shop-grid">' + ['frame:neon', 'frame:fire', 'frame:lightning', 'frame:diamond'].map(function(i){ return itemCard(i, 'Un contour animé autour de ta photo, partout sur le site.'); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Bannières de profil</h2><div class="shop-grid">' + ['banner:galaxy', 'banner:sunset', 'banner:matrix'].map(function(i){ return itemCard(i, 'Le fond animé en haut de ton profil.'); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Effets de pseudo</h2><div class="shop-grid">' + ['fx:glitch', 'fx:sparkle', 'fx:wave'].map(function(i){ return itemCard(i, 'Ton pseudo s\'anime partout.'); }).join('') + itemCard('neon', 'Choisis la couleur néon de ton pseudo.') + itemCard('gif', 'Mets un GIF comme photo de profil.') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Emoji à côté du pseudo</h2><div class="emoji-grid">' + Object.keys(EMOJI).map(function(k){ var i = 'emoji:' + k, on = p.eq && p.eq.emoji === i; return '<div class="emoji-item' + (on ? ' on' : '') + '"><span>' + EMOJI[k] + '</span>' + itemAction(i) + '</div>'; }).join('') + '</div></section>';
    if (hasItem('neon')) html += neonPickerHTML();
  } else if (shopTab === 'matchs') {
    html += '<section><h2 class="sec shop-h">Thème d\'affiche</h2><p class="help" style="margin-bottom:12px">Ton côté de l\'affiche de match avec un fond spécial.</p><div class="shop-grid">' + ['poster:lava', 'poster:ice', 'poster:galaxy', 'poster:gold'].map(function(i){ return itemCard(i, ''); }).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Animation de victoire</h2><p class="help" style="margin-bottom:12px">Quand tu gagnes, l\'animation se joue sur la page du match, sous les yeux de ton adversaire.</p><div class="shop-grid">' + ['win:confetti', 'win:lightning'].map(function(i){ return itemCard(i, ''); }).join('') + '</div></section>';
    html += '<section class="panel"><h2>📌 Défi épinglé · ' + cn(3) + '</h2><p class="help">Ton défi reste tout en haut de l\'arène pendant 1 heure. Ouvre un de tes défis ouverts et clique sur « Épingler ».</p></section>';
  } else if (shopTab === 'titres') {
    html += '<section><h2 class="sec shop-h">Titres rares</h2><div class="title-grid">' + Object.keys(RARE_TITLES).map(titleCard).join('') + '</div></section>';
    html += '<section><h2 class="sec shop-h">Titres · ' + cn(ITEM_PRICE) + '</h2><p class="help" style="margin-bottom:12px">Inclus dans le VIP.</p><div class="title-grid">' + Object.keys(TITLES).filter(function(k){ return !RARE_TITLES[k]; }).map(titleCard).join('') + '</div></section>';
  } else if (shopTab === 'limite') {
    var left = LIMITED_UNTIL - Date.now(), days = Math.max(0, Math.ceil(left / 864e5));
    html += '<section class="limited"><p class="eyebrow">Édition limitée</p><h2 class="sec">Cadre Hiver 2026</h2><p class="help">' + (left > 0 ? 'Disponible encore <b>' + days + ' jour' + (days > 1 ? 's' : '') + '</b>, ensuite il ne sera plus jamais en vente.' : 'Cette édition est terminée.') + '</p><div class="shop-grid">' + itemCard('frame:winter', 'Flocons et givre animés autour de ta photo.') + '</div></section>';
    html += '<section class="panel"><h2>🏅 Badge Collectionneur</h2><p class="help">Gratuit et automatique dès que tu possèdes <b>10 articles</b> achetés. Tu en as ' + (p.owned || []).length + '/10.</p></section>';
  }
  return html;
}
function titleCard(k){
  var p = me(), own = hasItem('title:' + k), on = p.titleKey === k, rare = RARE_TITLES[k];
  return '<div class="title-item' + (on ? ' on' : '') + (rare ? ' rare' : '') + '"><span class="ptitle' + (rare ? ' rare' : '') + '">' + esc(TITLES[k]) + '</span>' +
    (own ? (on ? '<button class="btn sm ghost" data-act="equip-title" data-key="">Retirer</button>' : '<button class="btn sm" data-act="equip-title" data-key="' + k + '">Équiper</button>') : buyBtn('title:' + k)) + '</div>';
}
function neonPickerHTML(){
  var p = me();
  return '<section class="panel"><h2>Couleur de ton pseudo</h2><form data-form="cosmetics" novalidate><input type="hidden" name="title" value="' + esc(p.titleKey) + '">' +
    '<div class="neon-pick">' + NEON.map(function(n){ return '<label class="np"><input type="radio" name="style" value="' + n[0] + '"' + (p.nameStyle === n[0] ? ' checked' : '') + '><span class="' + (n[0] ? 'neon neon-' + n[0] : '') + '">' + esc(p.pseudo) + '</span><small>' + n[1] + '</small></label>'; }).join('') + '</div>' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Enregistrer la couleur</button></div></form></section>';
}
function vipShopHTML(){
  var p = me();
  return '<section class="vip-card' + (p.vip ? ' owned' : '') + '"><div class="vip-head"><em class="beta vip big">VIP</em><div><h2>Pass VIP</h2><p class="help">À vie · l\'offre tout compris</p></div><div class="vip-price">' + COIN + '<b>20</b></div></div>' +
    '<ul class="vip-perks">' +
    '<li><span>👑</span><div><b>Badge VIP</b><small>Exclusif, à côté de ton pseudo partout.</small></div></li>' +
    '<li><span>✨</span><div><b>Pseudo néon</b><small>Toutes les couleurs, dont l\'arc-en-ciel animé.</small></div></li>' +
    '<li><span>🎞️</span><div><b>Photo animée</b><small>Un GIF comme photo de profil.</small></div></li>' +
    '<li><span>🏷️</span><div><b>12 titres</b><small>Tous les titres classiques débloqués.</small></div></li>' +
    '</ul>' +
    (p.vip ? '<p class="vip-owned">✓ Tu es VIP depuis ' + ago(p.vipSince || Date.now()) + '.</p>'
           : '<div class="actions"><button class="btn primary lg" data-act="buy-vip"' + (avail(S.me) < 20 ? ' disabled' : '') + '>Devenir VIP · ' + cn(20) + '</button></div>' + (avail(S.me) < 20 ? '<p class="help">Il te faut 20 coins disponibles.</p>' : '')) +
    '<p class="help">Les cadres, bannières, effets, thèmes, titres rares et éditions limitées s\'achètent à part.</p></section>' + (hasItem('neon') ? neonPickerHTML() : '');
}

/* ---------- animation de victoire ---------- */
var winFxPlayed = {};
function winFxHTML(kind, mid){
  if (winFxPlayed[mid]) return '';
  winFxPlayed[mid] = true;
  var n = kind === 'confetti' ? 40 : 10, parts = '';
  for (var i = 0; i < n; i++) {
    var left = Math.round(Math.random() * 100), delay = (Math.random() * 0.8).toFixed(2), hueV = Math.round(Math.random() * 360), dur = (1.8 + Math.random() * 1.4).toFixed(2);
    parts += kind === 'confetti'
      ? '<i style="left:' + left + '%;animation-delay:' + delay + 's;animation-duration:' + dur + 's;background:hsl(' + hueV + ' 90% 60%)"></i>'
      : '<i style="left:' + left + '%;animation-delay:' + delay + 's">⚡</i>';
  }
  return '<div class="win-fx win-' + kind + '" aria-hidden="true">' + parts + '</div>';
}

/* ---------- joueurs de la semaine ---------- */
function weeklyTop(){
  var since = Date.now() - 7 * 864e5, sc = {};
  Object.keys(S.matches).forEach(function(k){
    var m = S.matches[k];
    if (m.status !== 'done' || m.finishedAt < since) return;
    (m.winner === 'A' ? m.teamA : m.teamB).forEach(function(pid){ sc[pid] = sc[pid] || {net: 0, w: 0, l: 0}; sc[pid].net += m.stake; sc[pid].w++; });
    (m.winner === 'A' ? m.teamB : m.teamA).forEach(function(pid){ sc[pid] = sc[pid] || {net: 0, w: 0, l: 0}; sc[pid].net -= m.stake; sc[pid].l++; });
  });
  return Object.keys(sc).filter(function(pid){ return S.players[pid] && S.players[pid].status !== 'banned' && sc[pid].w > 0; })
    .sort(function(a, b){ return sc[b].net - sc[a].net || sc[b].w - sc[a].w; }).slice(0, 3).map(function(pid){ return {pid: pid, s: sc[pid]}; });
}
function podiumHTML(compact){
  var top = weeklyTop();
  if (!top.length) return compact ? '' : '<section class="podium-wrap"><h2 class="sec">🏆 Joueurs de la semaine</h2><p class="help">Aucun match gagné ces 7 derniers jours. Le podium se remplit dès les premières victoires !</p></section>';
  var medals = ['🥇', '🥈', '🥉'], order = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
  return '<section class="podium-wrap' + (compact ? ' compact' : '') + '"><h2 class="sec">🏆 Joueurs de la semaine</h2><p class="help">Les plus gros gains en coins sur les 7 derniers jours.</p><div class="podium">' +
    order.map(function(idx){ var x = top[idx], p = P(x.pid); return '<button class="pod pod-' + (idx + 1) + '" data-act="goto-player" data-pid="' + esc(x.pid) + '"><span class="medal">' + medals[idx] + '</span>' + av(p, idx === 0 ? 'lg' : '') + '<b>' + nm(p) + '</b>' + titleHTML(p) + '<span class="pod-net">+' + fmt(x.s.net) + ' ' + COIN + '</span><small>' + x.s.w + 'V · ' + x.s.l + 'D</small><span class="pod-step">' + (idx + 1) + '</span></button>'; }).join('') +
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
var NEON = [['gold', 'Or'], ['violet', 'Violet'], ['cyan', 'Cyan'], ['rose', 'Rose'], ['green', 'Vert'], ['red', 'Rouge'], ['rainbow', 'Arc-en-ciel'], ['', 'Aucun']];
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
function presence(pid){
  var p = P(pid);
  for (var k in S.matches) { var m = S.matches[k]; if ((m.status === 'live' || m.status === 'dispute') && teamOf(m, pid)) return {k: 'match', label: 'En match', mid: m.id}; }
  if (p.lastSeen && Date.now() - p.lastSeen < 150000) return {k: 'online', label: 'En ligne'};
  return {k: 'off', label: p.lastSeen ? 'Hors ligne · vu ' + ago(p.lastSeen) : 'Hors ligne'};
}
function pendingIn(){ return (S.friends || []).filter(function(x){ return x.addressee === S.me && x.status === 'pending'; }).length; }
function friendBtn(pid){
  var r = rel(pid);
  if (pid === S.me) return '';
  if (r === 'friend') return '<span class="fr-tag">✓ Amis</span>';
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
  var order = {match: 0, online: 1, off: 2};
  friends.sort(function(a, b){ return order[presence(a).k] - order[presence(b).k] || P(a).pseudo.localeCompare(P(b).pseudo); });
  var inc = F.filter(function(x){ return x.status === 'pending' && x.addressee === S.me; }).map(function(x){ return x.requester; });
  var out = F.filter(function(x){ return x.status === 'pending' && x.requester === S.me; }).map(function(x){ return x.addressee; });
  var online = friends.filter(function(k){ return presence(k).k !== 'off'; }).length;
  var html = '<section><p class="eyebrow">Amis</p><h2 class="sec" style="margin-top:8px">Ta liste d\'amis</h2></section>';
  html += '<section class="panel"><h2>Rechercher un joueur</h2><input id="friend-q" type="search" autocomplete="off" placeholder="Tape un pseudo…" value="' + esc(friendQ) + '" aria-label="Rechercher un joueur"><div id="friend-results">' + searchResultsHTML() + '</div></section>';
  if (inc.length) html += '<section class="panel fr-incoming"><h2>Demandes reçues <i class="count">' + inc.length + '</i></h2><ul class="fr-list">' + inc.map(function(k){ return personRow(k, '<button class="btn sm primary" data-act="friend-accept" data-pid="' + esc(k) + '">Accepter</button><button class="btn sm ghost" data-act="friend-decline" data-pid="' + esc(k) + '">Refuser</button>'); }).join('') + '</ul></section>';
  html += '<section class="panel"><h2>Mes amis <small class="help" style="font:500 14px var(--f-body);text-transform:none;letter-spacing:0">' + friends.length + ' ami' + (friends.length > 1 ? 's' : '') + ' · ' + online + ' connecté' + (online > 1 ? 's' : '') + '</small></h2>' +
    (friends.length ? '<ul class="fr-list">' + friends.map(function(k){ var pr = presence(k); return personRow(k, (pr.k === 'match' ? '<button class="btn sm" data-act="open-match" data-id="' + esc(pr.mid) + '">Voir le match</button>' : '') + '<button class="btn sm ghost" data-act="friend-remove" data-pid="' + esc(k) + '" title="Retirer de mes amis">Retirer</button>'); }).join('') + '</ul>'
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
        '<p class="hint">Un seul compte par Discord. Tous les caractères sont acceptés. Mot de passe : 6 caractères minimum.</p>' +
        '<p class="err" role="alert"></p><button class="btn primary" type="submit" style="width:100%">Créer mon compte</button></form>') +
    '</div></div>';
}

/* ---------- fenêtres ---------- */
function dialogShell(inner){ return '<div class="overlay"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dt"><button class="x" data-act="close" aria-label="Fermer">×</button>' + inner + '</div></div>'; }
function newMatchDialog(){
  var a = avail(S.me);
  if (a < 1) return dialogShell('<h2 id="dt">Lancer un défi</h2><p style="margin-top:14px">Tu n\'as plus de coins disponibles pour miser. Demande un pourboire à un autre joueur.</p><div class="actions" style="margin-top:18px"><button class="btn" data-act="copy-pseudo">Copier mon pseudo</button><button class="btn ghost" data-act="close">Fermer</button></div>');
  var others = Object.keys(S.players).filter(function(k){ return k !== S.me; }).sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); });
  return dialogShell('<h2 id="dt">Lancer un défi</h2><form data-form="match" novalidate>' +
    '<label for="c-mode">Mode</label><select id="c-mode" name="mode">' + MODES.map(function(x){ return '<option>' + x + '</option>'; }).join('') + '</select>' +
    '<div class="row"><div><label for="c-format">Équipes</label><select id="c-format" name="format"><option value="1v1">1v1</option><option value="2v2">2v2</option><option value="3v3">3v3</option></select></div>' +
    '<div><label for="c-bo">Format</label><select id="c-bo" name="bo">' + BOS.map(function(x, i){ return '<option value="' + x + '"' + (i === 1 ? ' selected' : '') + '>' + BO_LABEL[x] + '</option>'; }).join('') + '</select></div></div>' +
    '<label class="rules-check pp-check"><input type="checkbox" name="pingpong" value="1"> Ping-pong <small>(il faut gagner avec 2 points d\'écart)</small></label>' +
    '<label for="c-stake">Mise par joueur (coins)</label><input id="c-stake" name="stake" type="number" inputmode="decimal" min="0.5" max="' + a + '" step="0.5" value="1" required><p class="hint">Disponible : ' + cn(a) + '. Mise par tranches de 0,5 (ex. 0,5 · 1 · 1,5). Ta mise sort de ton solde tout de suite.</p>' +
    '<label for="c-target">Adversaire (1v1 uniquement)</label><select id="c-target" name="target"><option value="">Ouvert à tous</option>' + others.map(function(k){ return '<option value="' + esc(k) + '">' + esc(P(k).pseudo) + '</option>'; }).join('') + '</select>' +
    '<label for="c-team">Ton équipe (2v2 / 3v3)</label><select id="c-team" name="team" disabled><option value="">Aucune : places libres pour n\'importe qui</option>' + myTeams().filter(function(x){ return teamComplete(x); }).map(function(x){ return '<option value="' + esc(x.id) + '" data-size="' + x.size + '" hidden>' + esc(x.name) + ' (' + x.size + 'v' + x.size + ')</option>'; }).join('') + '</select><p class="hint" id="c-team-hint">Pas d\'équipe en 1v1.</p>' +
    '<label for="c-rules">Règles, code île (facultatif)</label><input id="c-rules" name="rules" maxlength="120" autocomplete="off" placeholder="Ex. île 1v1, premier à 3 rounds">' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Publier le défi</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
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
    '<label for="t-amount">Montant</label><input id="t-amount" name="amount" type="number" inputmode="decimal" min="0.5" max="' + Math.min(a, 50) + '" step="0.5" value="1" required><p class="hint">Disponible : ' + cn(a) + '. Par tranches de 0,5, <b>50 coins maximum</b> par don. Un pourboire est définitif.</p>' +
    '<label for="t-note">Message (facultatif)</label><input id="t-note" name="note" maxlength="60" autocomplete="off" placeholder="Pour ton prochain défi">' +
    '<p class="err" role="alert"></p><div class="actions"><button class="btn primary" type="submit">Envoyer</button><button class="btn ghost" type="button" data-act="close">Annuler</button></div></form>');
}
function adminDialog(pid, mode){
  var remove = mode === 'remove' && isOwner();
  var all = Object.keys(S.players).filter(function(k){ return isOwner() || (k !== S.me && !P(k).owner); }).sort(function(x, y){ return P(x).pseudo.localeCompare(P(y).pseudo); });
  return dialogShell('<h2 id="dt">' + (remove ? 'Retirer des coins' : 'Donner des coins') + '</h2><form data-form="admin-give" data-mode="' + (remove ? 'remove' : 'give') + '" novalidate>' +
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
    '<div class="actions" style="margin-top:12px"><button class="btn win lg" id="dc-ok" data-act="discord-confirm" disabled>J\'ai rejoint le serveur</button></div>' +
    '<p class="hint" style="margin-top:14px">Pas le bon compte ? <button class="linkbtn" data-act="logout">Se déconnecter</button></p></div></div>';
}
function discordDialog(){ return ''; }
function untilTxt(ts){ if (!ts) return '?'; var d = new Date(ts); return ('0' + d.getHours()).slice(-2) + 'h' + ('0' + d.getMinutes()).slice(-2) + (d.toDateString() !== new Date().toDateString() ? ' le ' + d.getDate() + '/' + (d.getMonth() + 1) : ''); }
var searchQ = '';
function searchListHTML(){
  var q = searchQ.trim().toLowerCase();
  if (!q) return '<p class="help">Tape le pseudo d\'un joueur pour aller sur son profil.</p>';
  var res = Object.keys(S.players).filter(function(k){ var p = S.players[k]; return (isAdmin() || p.status !== 'banned') && p.pseudo.toLowerCase().indexOf(q) >= 0; })
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
  L.innerHTML = dlg.kind === 'discord' ? discordDialog() : dlg.kind === 'new' ? newMatchDialog() : dlg.kind === 'tip' ? tipDialog(dlg.pid) : dlg.kind === 'sanction' ? sanctionDialog(dlg.pid, dlg.mode) : dlg.kind === 'notifs' ? notifsDialog() : dlg.kind === 'search' ? searchDialog() : dlg.kind === 'img' ? imgDialog(dlg.url) : dlg.kind === 'pick' ? pickDialog() : adminDialog(dlg.pid, dlg.mode);
  var f = L.querySelector('input,select,button.btn.primary,.x'); if (f) f.focus();
}
function openDialog(d){ lastFocus = document.activeElement; dlg = d; renderDialog(); }
function closeDialog(){ dlg = null; $('#layer').innerHTML = ''; if (lastFocus && lastFocus.focus && document.contains(lastFocus)) try { lastFocus.focus(); } catch(e){} }

/* ---------- rendu ---------- */
function render(){
  var app = $('#app');
  if (!configured) { app.innerHTML = betaBar() + '<div class="wrap welcome"><div class="card"><h2 class="sec">Site pas encore relié</h2><p style="margin-top:12px">Il manque l\'adresse et la clé Supabase dans <code>config.js</code>.</p></div></div>'; return; }
  if (!loaded) { app.innerHTML = betaBar() + '<div class="wrap welcome"><p class="eyebrow">Chargement de l\'arène…</p></div>'; return; }
  if (S.me && !me()) S.me = null;
  if (!me()) { app.innerHTML = welcomeHTML(); return; }
  if (me().status === 'banned') { app.innerHTML = bannedHTML(); return; }
  if (!me().rulesAt) { if (!document.getElementById('rules-btn')) { app.innerHTML = rulesGateHTML(); window.scrollTo(0, 0); } return; }
  if (!me().joined) { if (!document.getElementById('dc-ok')) app.innerHTML = discordGateHTML(); return; }
  var v = viewName();
  var body = v === 'classement' ? boardHTML() : v === 'profil' ? profileHTML() : v === 'regles' ? rulesHTML() : v === 'signaler' ? reportHTML() : v === 'amis' ? friendsHTML() : v === 'boutique' ? shopHTML() : v === 'match' ? matchPageHTML() : arenaHTML();
  app.innerHTML = headerHTML(v) + (loadErr ? '<div class="wrap"><div class="notice" style="margin-top:16px"><p>Problème de connexion au serveur : ' + esc(loadErr) + '</p></div></div>' : '') + '<main class="wrap main" id="main">' + (me().status === 'restricted' ? '<div class="notice restricted"><p><b>Compte restreint jusqu\'à ' + untilTxt(me().restrictedUntil) + '.</b> Tu peux regarder le site mais tu ne peux plus jouer, écrire dans les chats ni envoyer de coins' + (me().statusReason ? ' (raison : « ' + esc(me().statusReason) + ' »)' : '') + '. Pour contester, ouvre un ticket sur le Discord.</p></div>' : '') + body + '</main>' + footerHTML();
  var cl = document.getElementById('chat-list'); if (cl) cl.scrollTop = cl.scrollHeight;
}
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
    case 'shop-tab': shopTab = d.tab; render(); break;
    case 'equip': doRpc('set_equip', {p_slot: d.slot, p_item: d.item || null}, d.item ? itemName(d.item) + ' équipé !' : 'Retiré.'); break;
    case 'pin': if (!confirm('Épingler ce défi en haut de l\'arène pendant 1 heure pour ' + cn(3) + ' ?')) break; doRpc('pin_match', {mid: d.id}, 'Défi épinglé pour 1 heure !'); break;
    case 'buy-item':
      if (!confirm('Acheter « ' + itemName(d.item) + ' » pour ' + cn(itemPrice(d.item)) + ' ?')) break;
      doRpc('buy_item', {p_item: d.item}, 'Achat réussi : ' + itemName(d.item) + ' !');
      break;
    case 'equip-title': doRpc('set_cosmetics', {p_style: me().nameStyle, p_title: d.key}, d.key ? 'Titre équipé !' : 'Titre retiré.'); break;
    case 'buy-vip':
      if (!confirm('Acheter le Pass VIP à vie pour ' + cn(VIP_PRICE) + ' ?')) break;
      doRpc('buy_vip', {}, 'Bienvenue chez les VIP ! Choisis ton style néon.');
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
  if (el.id === 'avatar-file' && el.files && el.files[0]) { uploadAvatar(el.files[0]); el.value = ''; return; }
  if (el.classList && el.classList.contains('proof-file') && el.files && el.files[0]) { var pmid = el.dataset.id, pf = el.files[0]; el.value = ''; toast('Envoi de la capture…'); uploadProof(pmid, pf).then(function(){ toast('Capture ajoutée !'); }, function(e){ toast(e.message); }); return; }
  if (el.name === 'shot' && el.files && el.files[0]) { var st2 = el.parentNode.querySelector('.shot-txt'); if (st2) st2.innerHTML = '✓ ' + esc(el.files[0].name) + ' <small>(cliquer pour changer)</small>'; el.parentNode.classList.add('ok'); return; }
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
  if (kind === 'admin-score') {
    rpc('admin_set_score', {mid: f.dataset.id, p_a: parseInt(d.a, 10), p_b: parseInt(d.b, 10)}).then(function(r){ if (!r.ok) return fail(r.msg); toast('Score mis à jour.'); render(); });
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
  var map = {
    edit: ['update_profile', {p_pseudo: d.pseudo, p_twitter: String(d.twitter || '').trim().replace(/^@/, ''), p_bio: d.bio}, 'Profil mis à jour.'],
    match: ['create_match', {p_mode: d.mode, p_format: d.format, p_bo: d.bo, p_stake: num(d.stake), p_rules: d.rules, p_target: d.target || null, p_team: d.team || null, p_pingpong: !!d.pingpong}, 'Défi publié. ' + cn(num(d.stake) || 0) + ' mis en jeu.'],
    tip: ['send_tip', {p_to: d.to, p_amount: num(d.amount), p_note: d.note}, cn(num(d.amount) || 0) + ' envoyé(s).'],
    sanction: ['set_player_status', {p_player: f.dataset.pid, p_status: f.dataset.mode, p_reason: d.reason, p_hours: f.dataset.mode === 'restricted' ? parseInt(d.hours, 10) : null}, f.dataset.mode === 'ok' ? 'Sanction levée.' : f.dataset.mode === 'banned' ? 'Joueur banni.' : 'Joueur restreint.'],
    'admin-give': ['admin_give', {p_player: d.to, p_amount: (f.dataset.mode === 'remove' ? -1 : 1) * Math.abs(num(d.amount)), p_note: d.note}, f.dataset.mode === 'remove' ? cn(Math.abs(num(d.amount)) || 0) + ' retiré(s).' : cn(Math.abs(num(d.amount)) || 0) + ' donné(s).']
  }[kind];
  if (!map) return;
  rpc(map[0], map[1]).then(function(r){
    if (!r.ok) return fail(r.msg);
    if (kind === 'edit') editing = false;
    if (kind === 'match') { tab = 'ouverts'; if (viewName() !== 'arene') location.hash = '#arene'; }
    closeDialog(); toast(map[2]); render();
  });
});
window.addEventListener('hashchange', function(){ if (viewName() === 'profil' && !S.players[viewPid]) viewPid = S.me; render(); window.scrollTo(0, 0); });

/* ---------- démarrage ---------- */
render();
if (sb) {
  sb.auth.getSession().then(function(s){
    S.me = s.data.session ? s.data.session.user.id : null;
    return refresh();
  }).then(render);
  sb.auth.onAuthStateChange(function(ev, session){ S.me = session ? session.user.id : null; });
  try {
    sb.channel('legacy-live')
      .on('postgres_changes', {event: '*', schema: 'public', table: 'matches'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'profiles'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'friendships'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'notifications'}, function(){ passiveRefresh(); setTimeout(function(){ if (dlg && dlg.kind === 'notifs') renderDialog(); }, 1200); })
      .on('postgres_changes', {event: '*', schema: 'public', table: 'team_members'}, passiveRefresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'match_proofs'}, function(p){ var mid = (p.new && p.new.match_id) || (p.old && p.old.match_id); if (mid && proofsCache[mid]) { delete proofsCache[mid]; loadProofs(mid); } })
      .on('postgres_changes', {event: 'INSERT', schema: 'public', table: 'match_messages'}, function(p){
        var mid = p && p.new && p.new.match_id;
        if (mid && chatCache[mid]) { delete chatCache[mid]; loadChat(mid); }
      })
      .subscribe();
  } catch(e){}
  setInterval(passiveRefresh, 30000);
  function beat(){ if (S.me && document.visibilityState !== 'hidden') sb.rpc('heartbeat'); }
  setTimeout(beat, 1500); setInterval(beat, 60000);
  document.addEventListener('visibilitychange', beat);
}
})();
