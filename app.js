// =====================================================================
//  1-to-1 chat (Supabase + plain JS). App name + logo: config.js and logo.svg
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import {
  SUPABASE_URL, SUPABASE_KEY, APP_NAME, APP_TAGLINE,
  IMAGE_BUCKET, PROFILE_BUCKET, STICKERS,
} from './config.js';

const PAGE_SIZE = 40;                    // messages loaded at a time
const GROUP_GAP_MS = 5 * 60 * 1000;      // messages closer than this are grouped
const SIGNED_URL_SECONDS = 6 * 60 * 60;  // photo links stay valid for 6 hours
const STICKER_PATH = 'stickers/';
const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '🔥', '👍'];
const MAX_VOICE_SECONDS = 120;
const MAX_SONG_MB = 20;
const EMOJI_PICKER_URL = 'https://cdn.jsdelivr.net/npm/emoji-picker-element@1/index.js';

const isConfigured = !SUPABASE_URL.includes('YOUR-PROJECT') && !SUPABASE_KEY.startsWith('YOUR-');
const sb = isConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;
// Share the existing authenticated client with the private-space module.
if (sb) window.__loversSupabase = sb;
const isTouch = matchMedia('(pointer: coarse)').matches;
const isNarrow = () => matchMedia('(max-width: 760px)').matches;

// localStorage can be missing or blocked (private mode): never let it crash the app
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

// ---------------------------------------------------------------- DOM
const $ = (sel) => document.querySelector(sel);
const el = {
  boot: $('#boot'),
  login: $('#login'), loginForm: $('#login-form'), loginUser: $('#login-user'),
  loginPass: $('#login-pass'), loginError: $('#login-error'), loginBtn: $('#login-btn'),
  app: $('#app'), contacts: $('#contact-list'), meAvatar: $('#me-avatar'), meName: $('#me-name'),
  settingsBtn: $('#settings-btn'),
  chatEmpty: $('#chat-empty'),
  chatHead: $('#chat-head'), pinnedBanner: $('#pinned-banner'), pinnedOpen: $('#pinned-banner-open'),
  pinnedLabel: $('#pinned-banner-label'), pinnedText: $('#pinned-banner-text'), pinnedSaved: $('#pinned-banner-saved'),
  back: $('#back-btn'), peerBtn: $('#peer-btn'), peerSong: $('#peer-song'),
  peerAvatar: $('#peer-avatar'), peerName: $('#peer-name'), peerStatus: $('#peer-status'),
  stage: $('#stage'), messages: $('#messages'), jump: $('#jump'), dropHint: $('#drop-hint'),
  emojiTray: $('#emoji-tray'), stickerTray: $('#sticker-tray'), stickerGrid: $('#sticker-grid'),
  replyBar: $('#reply-bar'), replyWho: $('#reply-who'), replyText: $('#reply-text'), replyCancel: $('#reply-cancel'),
  composer: $('#composer'), emojiBtn: $('#emoji-btn'), stickerBtn: $('#sticker-btn'),
  imageBtn: $('#image-btn'), imageInput: $('#image-input'), text: $('#text-input'), send: $('#send-btn'),
  composeTools: $('#compose-tools'), mic: $('#mic-btn'), recBar: $('#rec-bar'), recCancel: $('#rec-cancel'),
  recTime: $('#rec-time'), recWave: $('#rec-wave'),
  profileView: $('#profile-view'), pvClose: $('#pv-close'), pvAvatar: $('#pv-avatar'), pvName: $('#pv-name'),
  pvUsername: $('#pv-username'), pvStatus: $('#pv-status'), pvBio: $('#pv-bio'), pvSong: $('#pv-song'),
  pvEdit: $('#pv-edit'),
  setAvatar: $('#set-avatar'), avatarChange: $('#avatar-change'), avatarRemove: $('#avatar-remove'),
  avatarInput: $('#avatar-input'), setBio: $('#set-bio'), bioCount: $('#bio-count'),
  songCurrent: $('#song-current'), setSongTitle: $('#set-song-title'), songChange: $('#song-change'),
  songRemove: $('#song-remove'), songInput: $('#song-input'),
  stickerManage: $('#sticker-manage'), stickerInput: $('#sticker-input'),
  menu: $('#msg-menu'), quickReacts: $('#quick-reacts'),
  settings: $('#settings'), settingsForm: $('#settings-form'), setName: $('#set-name'),
  setPass: $('#set-pass'), setPass2: $('#set-pass2'), setNotify: $('#set-notify'), setMsg: $('#set-msg'),
  setSave: $('#settings-save'), setCancel: $('#settings-cancel'), logout: $('#logout-btn'),
  lightbox: $('#lightbox'), lightboxImg: $('#lightbox-img'), toast: $('#toast'),
};

const ICON = {
  clock: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="8" cy="8" r="5.5"/><path d="M8 5.2V8l2 1.4"/></svg>',
  single: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.6l3 3 7-7"/></svg>',
  double: '<svg viewBox="0 0 20 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8.6l3 3 7-7"/><path d="M7.5 10.6l1 1 7-7"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5.5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18.5" cy="12" r="1.8"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4.2" height="14" rx="1.2"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.2"/></svg>',
};

// -------------------------------------------------------------- STATE
const state = {
  me: null,                 // my profile row
  contacts: new Map(),      // id -> profile
  activeId: null,           // who I'm chatting with
  convos: new Map(),        // id -> conversation cache (see convo())
  unread: new Map(),        // id -> unread count
  previews: new Map(),      // id -> latest message
  online: new Set(),        // ids currently online
  typing: new Map(),        // id -> timeout handle
  reactions: new Map(),     // message id -> Map(user id -> emoji)
  quoteCache: new Map(),    // message id -> message (replied-to messages not loaded yet)
  replyTo: null,            // message being replied to
  menuMsg: null,            // message whose menu is open
  room: null,
  inbox: null,
  heartbeat: null,
  messagePoll: null,
  pollingMessages: false,
  seenIncoming: new Set(),
  seenOutgoing: new Set(),
  lastOutgoingMessageId: 0,
  lastTypingSent: 0,
  stickToBottom: true,
  lastSync: 0,
  suppressClick: false,
  profileViewId: null,      // whose profile is open
  pending: { avatar: null, song: null },   // profile changes waiting for "Save changes"
  customStickers: [],       // stickers you two added (newest first)
  stickerEdit: false,       // showing the "remove" buttons in the sticker tray
};

function convo(id) {
  if (!state.convos.has(id)) {
    state.convos.set(id, {
      list: [], byId: new Map(), els: new Map(),
      loaded: false, done: false, loading: false, unreadMarkerId: null,
    });
  }
  return state.convos.get(id);
}

// ============================================================ STARTUP
document.title = APP_NAME;
document.querySelectorAll('.app-name').forEach((n) => { n.textContent = APP_NAME; });
document.querySelectorAll('.app-tagline').forEach((n) => { n.textContent = APP_TAGLINE; });
buildStickerTray();
buildQuickReacts();
wireEvents();
start();

async function start() {
  if (!sb) {
    showLogin('Add your Supabase URL and key in config.js first.');
    return;
  }
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') { teardown(); showLogin(); }
  });
  const { data: { session } } = await sb.auth.getSession();
  if (session) boot(session.user);
  else showLogin();
}

function showLogin(message = '') {
  el.boot.hidden = true;
  el.app.hidden = true;
  el.login.hidden = false;
  el.loginError.textContent = message;
  el.loginBtn.disabled = false;
  el.loginBtn.textContent = 'Log in';
  if (!isTouch) el.loginUser.focus();
}

async function login(e) {
  e.preventDefault();
  if (!sb) {
    showLogin('Supabase is not configured. Check the URL and publishable key in config.js.');
    return;
  }

  // Support Gmail, Hotmail, iCloud, and other providers by sending
  // the complete registered email address. Never guess a domain.
  const email = el.loginUser.value.trim().toLowerCase();
  const password = el.loginPass.value;

  if (!email || !password) {
    showLogin('Enter your full email address and password.');
    return;
  }
  const atIndex = email.indexOf('@');
  const domainDot = email.lastIndexOf('.');
  const hasWhitespace = Array.from(email).some((char) => char.charCodeAt(0) <= 32);
  if (atIndex <= 0 || atIndex !== email.lastIndexOf('@') ||
      domainDot <= atIndex + 1 || domainDot === email.length - 1 || hasWhitespace) {
    showLogin('Enter your complete email address, including @gmail.com, @hotmail.com, or @icloud.com.');
    return;
  }

  el.loginBtn.disabled = true;
  el.loginBtn.textContent = 'Logging in…';
  el.loginError.textContent = '';

  try {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      const wrong = /invalid login credentials/i.test(error.message);
      showLogin(wrong
        ? `Supabase rejected ${email}. Check that this exact address exists in Authentication → Users and that its current password is correct.`
        : `Can't log in right now: ${error.message}`);
      return;
    }

    el.loginPass.value = '';
    await boot(data.user);
  } catch (error) {
    showLogin(`Can't log in right now: ${error?.message || 'Unexpected network error.'}`);
  }
}

async function boot(user) {
  const { data: me, error } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error || !me) {
    await sb.auth.signOut();
    showLogin(error ? `Can't load your profile: ${error.message}` :
      'This account has no profile yet. Run database.sql in Supabase and log in again.');
    return;
  }
  state.me = me;
  await loadContacts();
  await Promise.all([loadUnread(), loadPreviews(), loadCustomStickers()]);

  el.boot.hidden = true;
  el.login.hidden = true;
  el.app.hidden = false;
  renderMe();
  renderContacts();
  updateTitle();
  subscribe();
  startMessagePolling();
  startHeartbeat();

  const saved = store.get('chat:last-chat');
  const first = state.contacts.has(saved) ? saved : sortedContacts()[0]?.id;
  if (first && (state.contacts.size === 1 || !isNarrow())) openConvo(first);
}

function teardown() {
  sb?.removeAllChannels();
  clearInterval(state.heartbeat);
  state.typing.forEach(clearTimeout);
  clearInterval(state.messagePoll);
  Object.assign(state, {
    me: null, activeId: null, room: null, inbox: null, heartbeat: null, messagePoll: null,
    pollingMessages: false, seenIncoming: new Set(), seenOutgoing: new Set(),
    lastOutgoingMessageId: 0, replyTo: null, menuMsg: null,
    contacts: new Map(), convos: new Map(), unread: new Map(), previews: new Map(),
    online: new Set(), typing: new Map(), reactions: new Map(), quoteCache: new Map(),
    customStickers: [], stickerEdit: false,
  });
  closeMenu();
  stopAudio();
  cancelRecording();
  if (el.settings.open) el.settings.close();
  if (el.profileView.open) el.profileView.close();
  el.messages.replaceChildren();
  el.contacts.replaceChildren();
  el.app.classList.remove('chat-open');
  showChatPane(false);
  document.title = APP_NAME;
}

// ============================================================ LOADING
async function loadContacts() {
  const { data, error } = await sb.from('profiles').select('*').neq('id', state.me.id).order('username');
  if (error) { toast(`Can't load contacts: ${error.message}`); return; }
  state.contacts = new Map(data.map((p) => [p.id, p]));
}

async function loadUnread() {
  const { data, error } = await sb.from('messages').select('sender_id')
    .eq('receiver_id', state.me.id).is('read_at', null).is('deleted_at', null);
  if (error) return;
  state.unread = new Map();
  for (const row of data) state.unread.set(row.sender_id, (state.unread.get(row.sender_id) || 0) + 1);
}

async function loadPreviews() {
  await Promise.all([...state.contacts.keys()].map(async (id) => {
    const { data } = await conversationQuery(id).order('id', { ascending: false }).limit(1);
    if (data?.[0]) state.previews.set(id, data[0]);
  }));
}

function conversationQuery(otherId) {
  const me = state.me.id;
  return sb.from('messages').select('*')
    .or(`and(sender_id.eq.${me},receiver_id.eq.${otherId}),and(sender_id.eq.${otherId},receiver_id.eq.${me})`);
}

async function fetchPage(otherId, beforeId = null) {
  let q = conversationQuery(otherId).order('id', { ascending: false }).limit(PAGE_SIZE);
  if (beforeId) q = q.lt('id', beforeId);
  const { data, error } = await q;
  if (error) throw error;
  const page = data.reverse();
  await loadReactions(page.map((m) => m.id));
  return page;
}

async function loadReactions(ids) {
  if (!ids.length) return;
  const { data, error } = await sb.from('reactions').select('message_id, user_id, emoji').in('message_id', ids);
  if (error) return;
  ids.forEach((id) => state.reactions.delete(id));
  for (const r of data) {
    if (!state.reactions.has(r.message_id)) state.reactions.set(r.message_id, new Map());
    state.reactions.get(r.message_id).set(r.user_id, r.emoji);
  }
}

async function loadOlder() {
  const id = state.activeId;
  const c = convo(id);
  if (!id || c.loading || c.done || !c.loaded) return;
  const oldest = c.list.find((m) => typeof m.id === 'number');
  if (!oldest) return;
  c.loading = true;
  renderMessages();
  try {
    const page = await fetchPage(id, oldest.id);
    if (page.length < PAGE_SIZE) c.done = true;
    page.forEach((m) => upsert(c, m));
  } catch (err) {
    toast(`Can't load older messages: ${err.message}`);
  }
  c.loading = false;
  if (state.activeId !== id) return;
  const box = el.messages;
  const fromBottom = box.scrollHeight - box.scrollTop;
  renderMessages();
  box.scrollTop = box.scrollHeight - fromBottom;   // keep your place
}

// Fetch anything missed while the tab slept or the connection dropped.
async function syncMissed() {
  if (!state.me || Date.now() - state.lastSync < 3000) return;
  state.lastSync = Date.now();
  await loadContacts();
  await Promise.all([loadUnread(), loadPreviews()]);
  const id = state.activeId;
  if (id && convo(id).loaded) {
    try {
      const wasBottom = nearBottom();
      (await fetchPage(id)).forEach((m) => upsert(convo(id), m));
      if (state.activeId === id) {
        renderMessages();
        if (wasBottom) scrollToBottom();
        markRead(id);
      }
    } catch { /* offline — try again later */ }
  }
  renderContacts();
  renderHeader();
  updateTitle();
}


/* Keep unread messages moving even if a browser's Realtime socket drops.
   Realtime remains the fast path; this small inbox-only query is a safety net. */
async function pollIncomingMessages() {
  if (!state.me || document.visibilityState !== 'visible' || state.pollingMessages) return;
  state.pollingMessages = true;
  try {
    const [incomingResult, outgoingResult] = await Promise.all([
      sb.from('messages')
        .select('*')
        .eq('receiver_id', state.me.id)
        .is('read_at', null)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .limit(100),
      sb.from('messages')
        .select('*')
        .eq('sender_id', state.me.id)
        .gt('id', state.lastOutgoingMessageId)
        .is('deleted_at', null)
        .order('id', { ascending: true })
        .limit(100),
    ]);

    if (incomingResult.error) {
      console.warn('Unread-message sync:', incomingResult.error.message);
    } else {
      const unread = new Map();
      for (const message of incomingResult.data || []) {
        unread.set(message.sender_id, (unread.get(message.sender_id) || 0) + 1);
        if (!state.seenIncoming.has(message.id)) onIncoming(message);
      }
      // The server's unread set is authoritative. Realtime and polling share
      // the same message-id guard so the same message is never counted twice.
      state.unread = unread;
      renderContacts();
      updateTitle();
    }

    if (outgoingResult.error) {
      console.warn('Sent-message device sync:', outgoingResult.error.message);
    } else {
      for (const message of outgoingResult.data || []) {
        onSentFromOtherDevice(message);
      }
    }
  } catch (error) {
    console.warn('Message sync failed:', error);
  } finally {
    state.pollingMessages = false;
  }
}

function startMessagePolling() {
  clearInterval(state.messagePoll);
  // loadPreviews() ran before boot() starts the poller; use their latest
  // outgoing row as the cursor so we only look for messages sent afterwards.
  state.lastOutgoingMessageId = Math.max(
    0,
    ...[...state.previews.values()]
      .filter((message) => message.sender_id === state.me?.id)
      .map((message) => Number(message.id) || 0)
  );
  pollIncomingMessages();
  state.messagePoll = setInterval(pollIncomingMessages, 3000);
}

// ============================================================ REALTIME
function subscribe() {
  const me = state.me.id;
  const inbox = sb.channel(`inbox-${me}`);

  inbox
    // new messages addressed to this account
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` },
      (p) => onIncoming(p.new))
    // messages sent by this account on another device (same login, other session)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${me}` },
      (p) => onSentFromOtherDevice(p.new))
    // my messages being read
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${me}` },
      (p) => applyUpdate(p.new))
    // their messages being unsent
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `receiver_id=eq.${me}` },
      (p) => applyUpdate(p.new))
    // reactions (the database only sends ones from your own conversations)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'reactions' },
      (p) => onReactionChange(p))
    // profile changes: new picture, name, bio or song
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'profiles' },
      (p) => onProfileChange(p.new))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        syncMissed();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        console.warn(`Inbox Realtime status: ${status}. The unread-message sync will keep the chat current.`);
      }
    });
  state.inbox = inbox;

  // Who is online + typing indicator
  const room = sb.channel('chat-room', { config: { presence: { key: me } } });
  room
    .on('presence', { event: 'sync' }, () => {
      state.online = new Set(Object.keys(room.presenceState()).filter((k) => k !== me));
      renderContacts();
      renderHeader();
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      const p = state.contacts.get(key);
      if (p) p.last_seen = new Date().toISOString();
      clearTyping(key);
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.to === me && state.contacts.has(payload.from)) showTyping(payload.from);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await room.track({ since: new Date().toISOString() });
    });
  state.room = room;
}

function onSentFromOtherDevice(m) {
  if (!m || m.sender_id !== state.me?.id) return;
  if (state.seenOutgoing.has(m.id)) return;
  state.seenOutgoing.add(m.id);
  if (state.seenOutgoing.size > 600) {
    const first = state.seenOutgoing.values().next().value;
    state.seenOutgoing.delete(first);
  }
  state.lastOutgoingMessageId = Math.max(state.lastOutgoingMessageId, Number(m.id) || 0);

  const other = m.receiver_id;
  if (!state.contacts.has(other)) loadContacts().then(renderContacts);
  setPreview(other, m);

  const c = convo(other);
  if (c.loaded) upsert(c, m);
  if (state.activeId === other && c.loaded) {
    const wasBottom = nearBottom();
    renderMessages();
    if (wasBottom) scrollToBottom(true);
    else el.jump.hidden = false;
  }
  renderContacts();
  renderHeader();
}

function onIncoming(m) {
  if (!m || m.receiver_id !== state.me?.id) return;
  if (state.seenIncoming.has(m.id)) return;
  state.seenIncoming.add(m.id);
  if (state.seenIncoming.size > 600) {
    const first = state.seenIncoming.values().next().value;
    state.seenIncoming.delete(first);
  }

  const other = m.sender_id;
  if (!state.contacts.has(other)) loadContacts().then(renderContacts);
  clearTyping(other);
  setPreview(other, m);

  const c = convo(other);
  if (c.loaded) upsert(c, m);
  const isOpen = other === state.activeId && c.loaded;
  const viewing = isOpen && document.visibilityState === 'visible';

  if (isOpen) {
    const wasBottom = nearBottom();
    renderMessages();
    if (wasBottom) scrollToBottom(true);
    else el.jump.hidden = false;
  }
  if (viewing) {
    markRead(other);
  } else {
    state.unread.set(other, (state.unread.get(other) || 0) + 1);
    blip();
    notify(displayName(state.contacts.get(other) || { username: 'New message' }), snippet(m), other);
  }
  renderContacts();
  renderHeader();
  updateTitle();
}

// A message changed: read receipt, or unsent.
function applyUpdate(m) {
  const other = m.sender_id === state.me.id ? m.receiver_id : m.sender_id;
  const c = convo(other);
  if (c.byId.has(m.id)) upsert(c, m);
  if (m.deleted_at) {
    state.quoteCache.set(m.id, m);
    // replies that quote it show "Message unsent" now
    for (const x of c.list) if (x.reply_to === m.id) c.els.delete(x.id);
    if (state.replyTo?.id === m.id) cancelReply();
    if (state.menuMsg?.id === m.id) closeMenu();
    if (m.sender_id !== state.me.id && !m.read_at) {
      state.unread.set(other, Math.max(0, (state.unread.get(other) || 0) - 1));
      updateTitle();
    }
  }
  const prev = state.previews.get(other);
  if (prev?.id === m.id && prev !== c.byId.get(m.id)) Object.assign(prev, m);
  if (state.activeId === other && c.loaded && m.deleted_at) renderMessages();
  renderContacts();
}

function onProfileChange(row) {
  if (!row?.id || !state.me) return;
  if (row.id === state.me.id) {
    Object.assign(state.me, row);       // changed on another device
    renderMe();
    return;
  }
  const p = state.contacts.get(row.id);
  if (!p) { loadContacts().then(renderContacts); return; }
  const visible = ['display_name', 'avatar_path', 'bio', 'song_path', 'song_title']
    .some((k) => (p[k] ?? null) !== (row[k] ?? null));
  Object.assign(p, row);
  if (!visible) return;                 // just a "last seen" heartbeat
  renderContacts();
  renderHeader();
  if (state.profileViewId === p.id && el.profileView.open) openProfile(p.id);
}

function onReactionChange(p) {
  if (p.eventType === 'DELETE') {
    if (p.old?.message_id) setReaction(p.old.message_id, p.old.user_id, null);
    return;
  }
  const r = p.new;
  setReaction(r.message_id, r.user_id, r.emoji, true);
  if (r.user_id !== state.me.id) {
    notify(displayName(state.contacts.get(r.user_id) || { username: 'Someone' }),
      `Reacted ${r.emoji} to your message`, r.user_id);
  }
}

function sendTyping() {
  if (!state.room || !state.activeId) return;
  const now = Date.now();
  if (now - state.lastTypingSent < 2000) return;
  state.lastTypingSent = now;
  state.room.send({ type: 'broadcast', event: 'typing', payload: { from: state.me.id, to: state.activeId } });
}

function showTyping(id) {
  clearTimeout(state.typing.get(id));
  state.typing.set(id, setTimeout(() => clearTyping(id), 3500));
  renderHeader();
  renderContacts();
  updateTypingRow();
}

function clearTyping(id) {
  if (!state.typing.has(id)) return;
  clearTimeout(state.typing.get(id));
  state.typing.delete(id);
  renderHeader();
  renderContacts();
  updateTypingRow();
}

function startHeartbeat() {
  const beat = () => {
    if (state.me && document.visibilityState === 'visible') {
      sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.me.id).then(() => {});
    }
  };
  beat();
  state.heartbeat = setInterval(beat, 60_000);
}

// ============================================================ MESSAGES
function upsert(c, m) {
  const existing = c.byId.get(m.id);
  if (existing) {
    const nowDeleted = !existing.deleted_at && m.deleted_at;
    Object.assign(existing, m);
    if (nowDeleted) c.els.delete(m.id);          // rebuilt on next render
    else {
      const node = c.els.get(m.id);
      if (node) paintState(node, existing);
    }
    return existing;
  }
  c.byId.set(m.id, m);
  c.list.push(m);
  c.list.sort(byOrder);
  return m;
}

// Saved messages by id; messages still sending go last.
function byOrder(a, b) {
  const ai = typeof a.id === 'number' ? a.id : Infinity;
  const bi = typeof b.id === 'number' ? b.id : Infinity;
  return ai - bi || (a.created_at < b.created_at ? -1 : 1);
}

function removeLocal(c, id) {
  c.byId.delete(id);
  c.els.delete(id);
  c.list = c.list.filter((m) => m.id !== id);
}

function findMsg(id) {
  for (const c of state.convos.values()) if (c.byId.has(id)) return c.byId.get(id);
  return state.quoteCache.get(id) || null;
}

async function send(payload) {
  const to = state.activeId;
  if (!to) return;
  const c = convo(to);
  const temp = {
    id: `tmp-${crypto.randomUUID()}`,
    sender_id: state.me.id,
    receiver_id: to,
    kind: payload.kind,
    body: payload.body ?? null,
    image_path: null,
    reply_to: state.replyTo?.id ?? null,
    created_at: new Date().toISOString(),
    read_at: null,
    deleted_at: null,
    _pending: true,
    _file: payload.file || null,
    _localUrl: payload.file ? URL.createObjectURL(payload.file) : null,
  };
  cancelReply();
  c.unreadMarkerId = null;
  upsert(c, temp);
  setPreview(to, temp);
  if (state.activeId === to) { renderMessages(); scrollToBottom(true); }
  renderContacts();
  await deliver(c, temp);
}

async function deliver(c, temp) {
  temp._pending = true;
  temp._failed = false;
  repaint(c, temp);
  try {
    if (temp.kind === 'image' && !temp.image_path) {
      const { blob, ext, type } = await prepareImage(temp._file);
      const path = `${state.me.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from(IMAGE_BUCKET)
        .upload(path, blob, { contentType: type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      temp.image_path = path;
      urlCache.set(`${IMAGE_BUCKET}:${path}`, { url: temp._localUrl, expires: Infinity });
    }
    if (temp.kind === 'audio' && !temp.image_path) {
      const type = baseType(temp._file.type) || 'audio/webm';
      const path = `${state.me.id}/${crypto.randomUUID()}.${audioExt(type)}`;
      const { error } = await sb.storage.from(IMAGE_BUCKET)
        .upload(path, temp._file, { contentType: type, cacheControl: '31536000', upsert: false });
      if (error) throw error;
      temp.image_path = path;
      urlCache.set(`${IMAGE_BUCKET}:${path}`, { url: temp._localUrl, expires: Infinity });
    }
    const { data, error } = await sb.from('messages').insert({
      sender_id: temp.sender_id,
      receiver_id: temp.receiver_id,
      kind: temp.kind,
      body: temp.body,
      image_path: temp.image_path,
      reply_to: temp.reply_to,
    }).select().single();
    if (error) throw error;

    // swap the temporary bubble for the saved message, keeping its element
    const node = c.els.get(temp.id);
    removeLocal(c, temp.id);
    if (!c.byId.has(data.id)) {
      upsert(c, data);
      if (node) { c.els.set(data.id, node); paintState(node, data); }
    }
    setPreview(data.receiver_id, data);
    if (state.activeId === data.receiver_id) renderMessages();
    renderContacts();
  } catch (err) {
    console.error(err);
    temp._pending = false;
    temp._failed = true;
    repaint(c, temp);
    toast(`Message not sent: ${err.message || 'check your connection'}`);
  }
}

function retry(id) {
  const c = convo(state.activeId);
  const m = c.byId.get(id);
  if (m?._failed) deliver(c, m);
}

async function markRead(id) {
  if (!id || id !== state.activeId || document.visibilityState !== 'visible') return;
  const c = convo(id);
  const now = new Date().toISOString();
  let changed = (state.unread.get(id) || 0) > 0;
  for (const m of c.list) {
    if (m.sender_id === id && !m.read_at) { m.read_at = now; changed = true; }
  }
  if (!changed) return;
  state.unread.set(id, 0);
  renderContacts();
  updateTitle();
  const { error } = await sb.from('messages').update({ read_at: now })
    .eq('receiver_id', state.me.id).eq('sender_id', id).is('read_at', null);
  if (error) console.warn('markRead', error);
}

async function unsend(m) {
  closeMenu();
  if (m.image_path) await sb.storage.from(IMAGE_BUCKET).remove([m.image_path]).catch(() => {});
  const { error } = await sb.rpc('unsend_message', { msg_id: m.id });
  if (error) { toast(`Couldn't unsend: ${error.message}`); return; }
  applyUpdate({ ...m, body: null, image_path: null, deleted_at: new Date().toISOString(),
    _pending: undefined, _failed: undefined });
}

// ============================================================ REACTIONS
function setReaction(msgId, userId, emoji, pop = false) {
  if (!state.reactions.has(msgId)) state.reactions.set(msgId, new Map());
  const map = state.reactions.get(msgId);
  if ((map.get(userId) || null) === (emoji || null)) return;   // nothing changed (e.g. echo of my own)
  if (emoji) map.set(userId, emoji); else map.delete(userId);
  for (const c of state.convos.values()) {
    const node = c.els.get(msgId);
    if (node) paintReacts(node, c.byId.get(msgId), pop ? emoji : null);
  }
}

async function toggleReaction(m, emoji) {
  if (!m || typeof m.id !== 'number' || m.deleted_at) return;
  const mine = state.reactions.get(m.id)?.get(state.me.id) || null;
  const next = mine === emoji ? null : emoji;
  setReaction(m.id, state.me.id, next, true);       // show it right away
  const { error } = next
    ? await sb.from('reactions').upsert({ message_id: m.id, user_id: state.me.id, emoji: next })
    : await sb.from('reactions').delete().eq('message_id', m.id).eq('user_id', state.me.id);
  if (error) {
    setReaction(m.id, state.me.id, mine);
    toast(`Couldn't react: ${error.message}`);
  }
}

function paintReacts(node, m, pop) {
  const box = node.querySelector('.reacts');
  if (!box || !m) return;
  const groups = new Map();
  state.reactions.get(m.id)?.forEach((emoji, uid) => {
    const g = groups.get(emoji) || { count: 0, mine: false };
    g.count++;
    if (uid === state.me.id) g.mine = true;
    groups.set(emoji, g);
  });
  box.replaceChildren(...[...groups].map(([emoji, g]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'react-pill';
    b.classList.toggle('mine-react', g.mine);
    if (pop === emoji) b.classList.add('react-pop');
    b.append(emoji);
    if (g.count > 1) {
      const n = document.createElement('b');
      n.textContent = g.count;
      b.append(n);
    }
    b.setAttribute('aria-label', g.mine ? `${emoji}, you reacted. Remove` : `${emoji} reaction. React the same`);
    b.addEventListener('click', () => toggleReaction(m, emoji));
    return b;
  }));
}

// ============================================================ PHOTOS
const urlCache = new Map();   // "bucket:path" -> { url, expires }

// Files are private, so we ask Supabase for a temporary link to each one.
function cachedUrl(bucket, path) {
  const hit = urlCache.get(`${bucket}:${path}`);
  return hit && hit.expires > Date.now() ? hit.url : null;
}

async function mediaUrl(bucket, path) {
  const hit = cachedUrl(bucket, path);
  if (hit) return hit;
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, SIGNED_URL_SECONDS);
  if (error) throw error;
  urlCache.set(`${bucket}:${path}`, { url: data.signedUrl, expires: Date.now() + (SIGNED_URL_SECONDS - 300) * 1000 });
  return data.signedUrl;
}
const photoUrl = (path) => mediaUrl(IMAGE_BUCKET, path);

const baseType = (type) => (type || '').split(';')[0].trim().toLowerCase();
function audioExt(type) {
  return { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac',
    'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/flac': 'flac' }[baseType(type)] || 'webm';
}

// Shrinks big photos before upload (keeps GIFs animated).
async function prepareImage(file) {
  const allowed = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
  if (!allowed[file.type]) throw new Error('only PNG, JPG, GIF and WEBP photos can be sent');
  if (file.type === 'image/gif' || file.size < 400_000) {
    return { blob: file, ext: allowed[file.type], type: file.type };
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return { blob, ext: 'jpg', type: 'image/jpeg' };
}

function sendFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return;
  if (!state.activeId) { toast('Open a conversation first.'); return; }
  for (const f of images) {
    if (f.size > 10 * 1024 * 1024 && f.type === 'image/gif') { toast('GIFs must be under 10 MB.'); continue; }
    send({ kind: 'image', file: f });
  }
}

function openLightbox(src) {
  if (!src || state.suppressClick) return;
  el.lightboxImg.src = src;
  el.lightbox.showModal();
}

// ============================================================ RENDER: SIDEBAR
function renderMe() {
  el.meName.textContent = displayName(state.me);
  fillAvatar(el.meAvatar, state.me);
}

// Shows the profile picture if there is one, otherwise the first letter.
function fillAvatar(span, p, { dot = false, localUrl = null } = {}) {
  span.replaceChildren(initial(p));
  const path = p?.avatar_path;
  if (localUrl || path) {
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.addEventListener('error', () => img.remove());
    const known = localUrl || cachedUrl(PROFILE_BUCKET, path);
    if (known) img.src = known;
    else mediaUrl(PROFILE_BUCKET, path).then((url) => { img.src = url; }).catch(() => img.remove());
    span.append(img);
  }
  if (dot) {
    const d = document.createElement('span');
    d.className = 'dot';
    span.append(d);
  }
}

function sortedContacts() {
  const time = (id) => state.previews.get(id)?.created_at || '';
  return [...state.contacts.values()].sort((a, b) =>
    time(b.id).localeCompare(time(a.id)) || a.username.localeCompare(b.username));
}

function renderContacts() {
  if (!state.me) return;
  const items = sortedContacts().map((p) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'contact';
    btn.classList.toggle('active', p.id === state.activeId);
    btn.addEventListener('click', () => openConvo(p.id));

    const unread = state.unread.get(p.id) || 0;
    btn.classList.toggle('has-unread', unread > 0);

    const preview = document.createElement('span');
    preview.className = 'c-preview';
    if (state.typing.has(p.id)) {
      preview.textContent = 'typing…';
      preview.classList.add('typing');
    } else {
      const last = state.previews.get(p.id);
      preview.textContent = last ? (last.sender_id === state.me.id ? 'You: ' : '') + snippet(last) : 'Say hi';
    }

    const name = document.createElement('span');
    name.className = 'c-name';
    name.textContent = displayName(p);
    const main = document.createElement('span');
    main.className = 'c-main';
    main.append(name, preview);

    const side = document.createElement('span');
    side.className = 'c-side';
    const last = state.previews.get(p.id);
    if (last) {
      const t = document.createElement('time');
      t.textContent = shortWhen(last.created_at);
      side.append(t);
    }
    if (unread) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = unread > 99 ? '99+' : unread;
      badge.setAttribute('aria-label', `${unread} unread`);
      side.append(badge);
    }

    btn.append(avatarEl(p), main, side);
    li.append(btn);
    return li;
  });

  if (!items.length) {
    const li = document.createElement('li');
    li.className = 'contacts-empty';
    li.textContent = 'No one else has an account yet. Add a second user in Supabase.';
    items.push(li);
  }
  el.contacts.replaceChildren(...items);
}

function snippet(m) {
  if (!m) return '';
  if (m.deleted_at) return 'Message unsent';
  if (m.kind === 'image') return 'Photo';
  if (m.kind === 'sticker') return 'Sticker';
  if (m.kind === 'audio') return `Voice message (${fmtDuration(voiceInfo(m).d)})`;
  return (m.body || '').replace(/\s+/g, ' ');
}

function setPreview(id, m) {
  const cur = state.previews.get(id);
  if (!cur || byOrder(cur, m) <= 0 || String(cur.id).startsWith('tmp-')) state.previews.set(id, m);
}

function avatarEl(p) {
  const a = document.createElement('span');
  a.className = 'avatar';
  a.classList.toggle('online', state.online.has(p.id));
  fillAvatar(a, p, { dot: true });
  return a;
}

// ============================================================ RENDER: CHAT
function showChatPane(open) {
  el.chatEmpty.hidden = open;
  el.chatHead.hidden = !open;
  el.stage.hidden = !open;
  el.composer.hidden = !open;
  if (el.pinnedBanner) el.pinnedBanner.hidden = !open;
  if (!open) { closeTrays(); cancelReply(); }
}

async function openConvo(id) {
  if (!state.contacts.has(id)) return;
  if (state.activeId !== id) cancelReply();
  state.activeId = id;
  store.set('chat:last-chat', id);
  el.app.classList.add('chat-open');
  showChatPane(true);
  closeTrays();
  closeMenu();
  el.jump.hidden = true;
  renderHeader();
  renderContacts();

  const c = convo(id);
  if (!c.loaded) {
    el.messages.replaceChildren(note('Loading messages…'));
    try {
      const page = await fetchPage(id);
      c.done = page.length < PAGE_SIZE;
      page.forEach((m) => upsert(c, m));
      c.loaded = true;
    } catch (err) {
      el.messages.replaceChildren(note(`Can't load messages: ${err.message}`));
      return;
    }
    if (state.activeId !== id) return;
  }

  // "Unread messages" line above the first one you haven't seen
  const firstUnread = c.list.find((m) => m.sender_id === id && !m.read_at && !m.deleted_at);
  c.unreadMarkerId = firstUnread ? firstUnread.id : null;

  renderMessages();
  const marker = el.messages.querySelector('.unread-sep');
  if (marker) {
    marker.scrollIntoView({ block: 'start' });
    state.anchor = marker;          // keep it in view while photos above it load
    state.stickToBottom = nearBottom();
  } else {
    scrollToBottom();
  }
  markRead(id);
  refreshPinnedBanner(id);
  if (!isTouch) el.text.focus();
}

function renderHeader() {
  const p = state.contacts.get(state.activeId);
  if (!p) return;
  el.peerName.textContent = 'Private chat';
  const key = `${p.id}|${p.avatar_path}|${displayName(p)}`;
  if (el.peerAvatar.dataset.key !== key) {      // only rebuild when the picture changes
    el.peerAvatar.dataset.key = key;
    fillAvatar(el.peerAvatar, p, { dot: true });
  }
  el.peerAvatar.classList.toggle('online', state.online.has(p.id));
  el.peerSong.hidden = !p.song_path;
  el.peerBtn.setAttribute('aria-label', `View ${displayName(p)}'s profile`);
  paintStatus(el.peerStatus, p);
  if (state.profileViewId === p.id && el.profileView.open) paintStatus(el.pvStatus, p);
}

function paintStatus(node, p) {
  node.className = 'peer-status';
  if (state.typing.has(p.id)) {
    node.textContent = 'typing…';
    node.classList.add('typing');
  } else if (state.online.has(p.id)) {
    node.textContent = 'Online';
    node.classList.add('online');
  } else {
    node.textContent = p.last_seen ? `Last seen ${lastSeenText(p.last_seen)}` : 'Offline';
  }
}

function renderMessages() {
  if (!state.activeId) return;
  const c = convo(state.activeId);
  const nodes = [];

  if (c.loading) nodes.push(note('Loading earlier messages…'));
  else if (c.done && c.list.length) nodes.push(note('This is the start of your conversation.'));
  else if (!c.list.length) nodes.push(note('No messages yet. Say hi.'));

  let prev = null;
  const msgNodes = [];
  for (const m of c.list) {
    const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
    if (newDay) {
      const sep = document.createElement('div');
      sep.className = 'day-sep';
      sep.textContent = dayLabel(m.created_at);
      nodes.push(sep);
    }
    const marker = c.unreadMarkerId === m.id;
    if (marker) {
      const sep = document.createElement('div');
      sep.className = 'unread-sep';
      sep.textContent = 'Unread messages';
      nodes.push(sep);
    }
    const node = messageEl(c, m);
    const grouped = prev && !newDay && !marker && prev.sender_id === m.sender_id && !m.reply_to &&
      new Date(m.created_at) - new Date(prev.created_at) < GROUP_GAP_MS;
    node.classList.toggle('cont', Boolean(grouped));
    nodes.push(node);
    msgNodes.push(node);
    prev = m;
  }
  msgNodes.forEach((node, i) => {
    const next = msgNodes[i + 1];
    node.classList.toggle('tail', !(next && next.classList.contains('cont')));
  });
  el.messages.replaceChildren(...nodes);
  updateTypingRow(false);
}

function note(text) {
  const p = document.createElement('p');
  p.className = 'older-note';
  p.textContent = text;
  return p;
}

let typingNode = null;
function updateTypingRow(scroll = true) {
  const id = state.activeId;
  const show = Boolean(id && state.typing.has(id) && convo(id).loaded);
  if (!typingNode) {
    typingNode = document.createElement('div');
    typingNode.className = 'msg theirs tail typing-row';
    typingNode.setAttribute('aria-label', 'typing');
    typingNode.innerHTML = '<div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div>';
  }
  if (show && !typingNode.isConnected) {
    const wasBottom = nearBottom();
    el.messages.append(typingNode);
    if (scroll && wasBottom) scrollToBottom(true);
  } else if (!show && typingNode.isConnected) {
    typingNode.remove();
  }
}

function messageEl(c, m) {
  let node = c.els.get(m.id);
  if (!node) {
    node = buildMessage(m);
    c.els.set(m.id, node);
  }
  paintState(node, m);
  return node;
}

function buildMessage(m) {
  const mine = m.sender_id === state.me.id;
  const root = document.createElement('div');
  root.className = `msg ${mine ? 'mine' : 'theirs'} kind-${m.kind}`;
  const row = document.createElement('div');
  row.className = 'row';
  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  if (m.reply_to && !m.deleted_at) bubble.append(buildQuote(m.reply_to));

  if (m.deleted_at) {
    root.classList.add('deleted');
    const p = document.createElement('p');
    p.className = 'text';
    p.textContent = mine ? 'You unsent a message' : 'This message was unsent';
    bubble.append(p);
  } else if (m.kind === 'sticker') {
    const img = new Image();
    img.className = 'sticker';
    img.alt = 'Sticker';
    setStickerImg(img, m.body);
    img.draggable = false;
    img.addEventListener('load', onMediaLoad);
    bubble.append(img);
  } else if (m.kind === 'audio') {
    bubble.append(buildVoice(m));
  } else if (m.kind === 'image') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-btn';
    btn.setAttribute('aria-label', 'Open photo');
    const img = new Image();
    img.className = 'photo';
    img.alt = 'Photo';
    img.draggable = false;
    img.addEventListener('load', onMediaLoad);
    img.addEventListener('error', () => img.classList.add('broken'));
    btn.addEventListener('click', () => openLightbox(img.src));
    btn.append(img);
    bubble.append(btn);
    if (m._localUrl) img.src = m._localUrl;
    else if (m.image_path) photoUrl(m.image_path).then((url) => { img.src = url; }).catch(() => img.classList.add('broken'));
  } else {
    if (isEmojiOnly(m.body) && !m.reply_to) root.classList.add('big-emoji');
    const p = document.createElement('p');
    p.className = 'text';
    appendLinkified(p, m.body);
    bubble.append(p);
  }

  const meta = document.createElement('span');
  meta.className = 'meta';
  const time = document.createElement('time');
  time.dateTime = m.created_at;
  time.textContent = clock(m.created_at);
  meta.append(time);
  if (mine && !m.deleted_at) {
    const ticks = document.createElement('span');
    ticks.className = 'ticks';
    meta.append(ticks);
  }
  bubble.append(meta);
  row.append(bubble);

  if (!m.deleted_at) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'more';
    more.setAttribute('aria-label', 'Message options');
    more.setAttribute('aria-haspopup', 'menu');
    more.innerHTML = ICON.more;
    more.addEventListener('click', (e) => { e.stopPropagation(); openMenu(msgOf(root), bubble, more); });
    row.append(more);
    addGestures(root, bubble);
  }
  root.append(row);

  const reacts = document.createElement('div');
  reacts.className = 'reacts';
  root.append(reacts);

  if (mine) {
    const retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.className = 'retry';
    retryBtn.textContent = 'Not sent. Tap to try again.';
    retryBtn.addEventListener('click', () => retry(root.dataset.id));
    root.append(retryBtn);
  }
  return root;
}

function msgOf(node) {
  const raw = node.dataset.id;
  const id = /^\d+$/.test(raw) ? Number(raw) : raw;
  return convo(state.activeId).byId.get(id);
}

// right-click / long-press opens the menu, double-click/tap sends ❤️
function addGestures(root, bubble) {
  bubble.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openMenu(msgOf(root), bubble);
  });
  bubble.addEventListener('dblclick', (e) => {
    if (e.target.closest('.voice, .quote')) return;   // fast taps on play shouldn't send a heart
    e.preventDefault();
    window.getSelection()?.removeAllRanges();
    toggleReaction(msgOf(root), '❤️');
  });
  let timer = null;
  let start = null;
  bubble.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    start = [e.clientX, e.clientY];
    timer = setTimeout(() => {
      timer = null;
      state.suppressClick = true;
      setTimeout(() => { state.suppressClick = false; }, 500);
      navigator.vibrate?.(12);
      openMenu(msgOf(root), bubble);
    }, 450);
  });
  const cancel = () => { clearTimeout(timer); timer = null; };
  bubble.addEventListener('pointermove', (e) => {
    if (timer && start && Math.hypot(e.clientX - start[0], e.clientY - start[1]) > 10) cancel();
  });
  bubble.addEventListener('pointerup', cancel);
  bubble.addEventListener('pointercancel', cancel);
}

function buildQuote(id) {
  const q = document.createElement('button');
  q.type = 'button';
  q.className = 'quote';
  const who = document.createElement('span');
  who.className = 'q-who';
  const text = document.createElement('span');
  text.className = 'q-text';
  q.append(who, text);
  q.addEventListener('click', (e) => { e.stopPropagation(); jumpTo(id); });

  const fill = (src) => {
    if (!src) { who.textContent = ''; text.textContent = 'Original message not available'; return; }
    who.textContent = src.sender_id === state.me.id ? 'You' : displayName(state.contacts.get(src.sender_id) || { username: 'Them' });
    text.textContent = snippet(src);
  };
  const known = findMsg(id);
  if (known) fill(known);
  else {
    text.textContent = 'Loading…';
    sb.from('messages').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      if (data) state.quoteCache.set(id, data);
      fill(data);
    });
  }
  return q;
}

async function jumpTo(id) {
  const c = convo(state.activeId);
  let tries = 0;
  while (!c.byId.has(id) && !c.done && tries++ < 25) await loadOlder();
  const node = c.els.get(id);
  if (!node || !node.isConnected) { toast('That message is no longer here.'); return; }
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.remove('flash');
  void node.offsetWidth;   // restart the animation
  node.classList.add('flash');
}

// Updates the bits of a bubble that change: sending / failed / read ticks / reactions.
function paintState(node, m) {
  node.dataset.id = m.id;
  node.classList.toggle('pending', Boolean(m._pending));
  node.classList.toggle('failed', Boolean(m._failed));
  paintReacts(node, m, null);
  const ticks = node.querySelector('.ticks');
  if (!ticks) return;
  const kind = m._pending || m._failed ? 'clock' : m.read_at ? 'double' : 'single';
  if (ticks.dataset.kind !== kind) {
    ticks.dataset.kind = kind;
    ticks.innerHTML = ICON[kind];
  }
  ticks.classList.toggle('read', Boolean(m.read_at));
  ticks.title = m._failed ? 'Not sent' : m._pending ? 'Sending' : m.read_at ? `Seen ${clock(m.read_at)}` : 'Delivered';
}

function repaint(c, m) {
  const node = c.els.get(m.id);
  if (node) paintState(node, m);
}

function onMediaLoad() {
  if (state.anchor?.isConnected) state.anchor.scrollIntoView({ block: 'start' });
  else if (state.stickToBottom) scrollToBottom();
}

// ============================================================ MESSAGE MENU
function buildQuickReacts() {
  el.quickReacts.replaceChildren(...QUICK_REACTIONS.map((emoji) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = emoji;
    b.dataset.emoji = emoji;
    b.setAttribute('aria-label', `React ${emoji}`);
    b.addEventListener('click', () => {
      const m = state.menuMsg;
      closeMenu();
      toggleReaction(m, emoji);
    });
    return b;
  }));
}

function openMenu(m, bubble, trigger = null) {
  if (!m || typeof m.id !== 'number' || m.deleted_at) return;   // not saved yet / unsent
  closeTrays();
  state.menuMsg = m;
  state.menuTrigger = trigger;
  trigger?.setAttribute('aria-expanded', 'true');
  const mine = m.sender_id === state.me.id;
  const myReact = state.reactions.get(m.id)?.get(state.me.id);
  el.quickReacts.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.emoji === myReact));
  el.menu.querySelector('[data-act="copy"]').hidden = m.kind !== 'text';
  el.menu.querySelector('[data-act="sticker"]').hidden = m.kind !== 'image';
  el.menu.querySelector('[data-act="save-gallery"]').hidden = m.kind !== 'image';
  el.menu.querySelector('[data-act="save-voice"]').hidden = m.kind !== 'audio';
  const unsendBtn = el.menu.querySelector('[data-act="unsend"]');
  unsendBtn.hidden = !mine;
  unsendBtn.dataset.armed = '';
  unsendBtn.querySelector('span').textContent = 'Unsend';

  const saveMessageBtn = el.menu.querySelector('[data-act="save-message"]');
  const pinMessageBtn = el.menu.querySelector('[data-act="pin-message"]');
  saveMessageBtn.querySelector('span').textContent = 'Save message';
  pinMessageBtn.querySelector('span').textContent = 'Pin message';
  sb.from('relationship_saved_messages').select('id,pinned')
    .eq('user_id', state.me.id).eq('message_id', m.id).maybeSingle()
    .then(({ data, error }) => {
      if (error || state.menuMsg?.id !== m.id || el.menu.hidden) return;
      saveMessageBtn.querySelector('span').textContent = data ? 'Remove from saved' : 'Save message';
      pinMessageBtn.querySelector('span').textContent = data?.pinned ? 'Unpin message' : 'Pin message';
    });

  el.menu.hidden = false;
  const r = bubble.getBoundingClientRect();
  const mw = el.menu.offsetWidth;
  const mh = el.menu.offsetHeight;
  let top = r.bottom + 8;
  if (top + mh > innerHeight - 8) top = r.top - mh - 8;
  top = Math.min(Math.max(8, top), innerHeight - mh - 8);
  let left = mine ? r.right - mw : r.left;
  left = Math.min(Math.max(8, left), innerWidth - mw - 8);
  el.menu.style.top = `${top}px`;
  el.menu.style.left = `${left}px`;
  el.quickReacts.querySelector('button')?.focus({ preventScroll: true });
}

function closeMenu() {
  if (el.menu.hidden) return;
  el.menu.hidden = true;
  state.menuTrigger?.setAttribute('aria-expanded', 'false');
  state.menuTrigger = null;
  state.menuMsg = null;
}

async function saveMessagePhotoToGallery(m) {
  if (!m?.image_path || !state.me) return;
  try {
    const { data: existing, error: checkError } = await sb.from('relationship_photos')
      .select('id').eq('source_message_id', m.id).maybeSingle();
    if (checkError) throw checkError;
    if (existing) return toast('This photo is already in your gallery.');

    const { data: blob, error: downloadError } = await sb.storage.from(IMAGE_BUCKET).download(m.image_path);
    if (downloadError) throw downloadError;

    const extension = (m.image_path.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
    const contentType = blob.type?.startsWith('image/') ? blob.type : (types[extension] || 'image/jpeg');
    const path = `${state.me.id}/chat-${m.id}-${crypto.randomUUID()}.${extension || 'jpg'}`;
    const { error: uploadError } = await sb.storage.from('relationship-gallery').upload(path, blob, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const date = new Date(m.created_at);
    const photoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const { error: rowError } = await sb.from('relationship_photos').insert({
      storage_path: path,
      caption: 'Saved from chat',
      photo_date: photoDate,
      uploaded_by: state.me.id,
      source_message_id: m.id,
    });
    if (rowError) {
      await sb.storage.from('relationship-gallery').remove([path]);
      if (/duplicate key/i.test(rowError.message)) return toast('This photo is already in your gallery.');
      throw rowError;
    }
    toast('Photo saved to your shared gallery.');
  } catch (error) {
    toast(`Couldn't save photo: ${error.message || 'Unknown error'}`);
  }
}

async function saveMessageVoiceToLibrary(m) {
  if (!m?.image_path || !state.me) return;
  try {
    const { data: existing, error: checkError } = await sb.from('relationship_voice_records')
      .select('id').eq('source_message_id', m.id).maybeSingle();
    if (checkError) throw checkError;
    if (existing) return toast('This voice message is already in your library.');

    const { data: blob, error: downloadError } = await sb.storage.from(IMAGE_BUCKET).download(m.image_path);
    if (downloadError) throw downloadError;

    const extension = (m.image_path.split('.').pop() || 'webm').toLowerCase().replace(/[^a-z0-9]/g, '');
    const types = {
      webm:'audio/webm', ogg:'audio/ogg', m4a:'audio/mp4', mp4:'audio/mp4',
      mp3:'audio/mpeg', aac:'audio/aac', wav:'audio/wav', flac:'audio/flac',
    };
    const contentType = blob.type?.startsWith('audio/') ? blob.type : (types[extension] || 'audio/webm');
    const path = `${state.me.id}/chat-${m.id}-${crypto.randomUUID()}.${extension || 'webm'}`;
    const { error: uploadError } = await sb.storage.from('relationship-voice').upload(path, blob, {
      contentType,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const date = new Date(m.created_at);
    const voiceDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const info = voiceInfo(m);
    const { error: rowError } = await sb.from('relationship_voice_records').insert({
      storage_path: path,
      title: `Voice message · ${fmtDuration(info.d)}`,
      voice_date: voiceDate,
      duration_seconds: Math.round(info.d),
      uploaded_by: state.me.id,
      source_message_id: m.id,
    });
    if (rowError) {
      await sb.storage.from('relationship-voice').remove([path]);
      if (/duplicate key/i.test(rowError.message)) return toast('This voice message is already in your library.');
      throw rowError;
    }
    toast('Voice message saved to your shared library.');
  } catch (error) {
    toast(`Couldn't save voice message: ${error.message || 'Unknown error'}`);
  }
}

async function refreshPinnedBanner(peerId = state.activeId) {
  if (!state.me || !peerId || !el.pinnedBanner) {
    if (el.pinnedBanner) el.pinnedBanner.hidden = true;
    return;
  }
  const { data: savedRows, error: savedError } = await sb.from('relationship_saved_messages')
    .select('message_id').eq('user_id', state.me.id).eq('pinned', true);
  if (savedError) {
    el.pinnedBanner.hidden = true;
    return;
  }
  const ids = (savedRows || []).map((row) => row.message_id);
  if (!ids.length) {
    el.pinnedBanner.hidden = true;
    return;
  }
  const me = state.me.id;
  const { data: messages, error } = await sb.from('messages')
    .select('id,sender_id,receiver_id,kind,body,created_at,deleted_at')
    .in('id', ids)
    .or(`and(sender_id.eq.${me},receiver_id.eq.${peerId}),and(sender_id.eq.${peerId},receiver_id.eq.${me})`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error || state.activeId !== peerId) {
    el.pinnedBanner.hidden = true;
    return;
  }
  const pinned = messages || [];
  if (!pinned.length) {
    el.pinnedBanner.hidden = true;
    return;
  }
  const first = pinned[0];
  el.pinnedOpen.dataset.messageId = String(first.id);
  el.pinnedLabel.textContent = pinned.length > 1 ? `PINNED · ${pinned.length} MESSAGES` : 'PINNED MESSAGE';
  el.pinnedText.textContent = snippet(first);
  el.pinnedBanner.hidden = false;
}

async function changeMessageBookmark(m, action) {
  if (!state.me || !m || typeof m.id !== 'number') return;
  const { data: saved, error: lookupError } = await sb.from('relationship_saved_messages')
    .select('id,pinned').eq('user_id', state.me.id).eq('message_id', m.id).maybeSingle();
  if (lookupError) return toast(`Couldn't check saved message: ${lookupError.message}`);

  if (action === 'save') {
    if (saved) {
      const { error } = await sb.from('relationship_saved_messages').delete().eq('id', saved.id);
      if (error) return toast(`Couldn't remove saved message: ${error.message}`);
      toast('Removed from your saved messages.');
    } else {
      const { error } = await sb.from('relationship_saved_messages').insert({
        user_id: state.me.id, message_id: m.id, pinned: false,
      });
      if (error) return toast(`Couldn't save message: ${error.message}`);
      toast('Message saved.');
    }
  } else if (action === 'pin') {
    if (saved) {
      const { error } = await sb.from('relationship_saved_messages')
        .update({ pinned: !saved.pinned }).eq('id', saved.id);
      if (error) return toast(`Couldn't update pin: ${error.message}`);
      toast(saved.pinned ? 'Message unpinned.' : 'Message pinned.');
    } else {
      const { error } = await sb.from('relationship_saved_messages').insert({
        user_id: state.me.id, message_id: m.id, pinned: true,
      });
      if (error) return toast(`Couldn't pin message: ${error.message}`);
      toast('Message saved and pinned.');
    }
  }
  window.dispatchEvent(new CustomEvent('lovers:saved-changed'));
}

async function jumpToMessage(detail) {
  const messageId = Number(detail?.messageId);
  const peerId = detail?.peerId;
  if (!Number.isSafeInteger(messageId) || !peerId || !state.me) return;
  await loadContacts();
  if (!state.contacts.has(peerId)) return toast('That conversation is no longer available.');
  window.dispatchEvent(new CustomEvent('lovers:show-chat'));
  await openConvo(peerId);
  if (state.activeId !== peerId) return;

  const c = convo(peerId);
  if (!c.byId.has(messageId)) {
    const [beforeResult, targetResult, afterResult] = await Promise.all([
      conversationQuery(peerId).lt('id', messageId).order('id', { ascending: false }).limit(16),
      conversationQuery(peerId).eq('id', messageId).maybeSingle(),
      conversationQuery(peerId).gt('id', messageId).order('id', { ascending: true }).limit(16),
    ]);
    const error = beforeResult.error || targetResult.error || afterResult.error;
    if (error) return toast(`Couldn't open that message: ${error.message}`);
    const rows = [
      ...(beforeResult.data || []).reverse(),
      ...(targetResult.data ? [targetResult.data] : []),
      ...(afterResult.data || []),
    ];
    if (!rows.some((row) => row.id === messageId)) return toast('That message may have been deleted.');
    await loadReactions(rows.map((row) => row.id));
    rows.forEach((row) => upsert(c, row));
    renderMessages();
  }

  const node = el.messages.querySelector(`.msg[data-id="${messageId}"]`);
  if (node) {
    node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    node.classList.add('search-highlight');
    setTimeout(() => node.classList.remove('search-highlight'), 1800);
  }
}

function onMenuAction(act, button) {
  const m = state.menuMsg;
  if (!m) return;
  if (act === 'save-message') { closeMenu(); changeMessageBookmark(m, 'save'); return; }
  if (act === 'pin-message') { closeMenu(); changeMessageBookmark(m, 'pin'); return; }
  if (act === 'save-gallery') { closeMenu(); saveMessagePhotoToGallery(m); return; }
  if (act === 'save-voice') { closeMenu(); saveMessageVoiceToLibrary(m); return; }
  if (act === 'reply') { closeMenu(); startReply(m); }
  if (act === 'sticker') { closeMenu(); saveAsSticker(m); }
  if (act === 'copy') {
    closeMenu();
    navigator.clipboard.writeText(m.body || '')
      .then(() => toast('Copied.'))
      .catch(() => toast("Couldn't copy. Select the text instead."));
  }
  if (act === 'unsend') {
    if (!button.dataset.armed) {
      button.dataset.armed = '1';
      button.querySelector('span').textContent = 'Tap again to unsend for both of you';
      return;
    }
    unsend(m);
  }
}

// ============================================================ REPLIES
function startReply(m) {
  state.replyTo = m;
  const mine = m.sender_id === state.me.id;
  el.replyWho.textContent = mine ? 'Replying to yourself' : `Replying to ${displayName(state.contacts.get(m.sender_id))}`;
  el.replyText.textContent = snippet(m);
  const wasBottom = nearBottom();
  el.replyBar.hidden = false;
  if (wasBottom) scrollToBottom();
  el.text.focus();
}

function cancelReply() {
  state.replyTo = null;
  el.replyBar.hidden = true;
}

// ============================================================ SCROLLING
function nearBottom() {
  const b = el.messages;
  return b.scrollHeight - b.scrollTop - b.clientHeight < 140;
}

function scrollToBottom(smooth = false) {
  state.anchor = null;
  el.messages.scrollTo({ top: el.messages.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  state.stickToBottom = true;
  el.jump.hidden = true;
}

// ============================================================ STICKERS & EMOJI
function stickerSrc(name) {
  const safe = /^[\w-]+\.(svg|png|gif|webp)$/i.test(name || '') ? name : 'heart.svg';
  return `${STICKER_PATH}${safe}`;
}

// A sticker message's body is a built-in file name, or "up:" + a file you two added.
function setStickerImg(img, body) {
  if (!body?.startsWith('up:')) { img.src = stickerSrc(body); return; }
  const path = body.slice(3);
  const known = cachedUrl(PROFILE_BUCKET, path);
  if (known) { img.src = known; return; }
  mediaUrl(PROFILE_BUCKET, path).then((url) => { img.src = url; })
    .catch(() => { img.src = stickerSrc('heart.svg'); });
}

function buildStickerTray() { renderStickerTray(); }

function renderStickerTray() {
  const label = (text) => {
    const l = document.createElement('p');
    l.className = 'tray-label';
    l.textContent = text;
    return l;
  };
  const tile = (body, onClick, ariaLabel) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', ariaLabel);
    const img = new Image();
    img.alt = '';
    img.loading = 'lazy';
    img.draggable = false;
    setStickerImg(img, body);
    b.append(img);
    b.addEventListener('click', onClick);
    return b;
  };
  const items = [label('Added by you two')];

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'sticker-add';
  add.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg><span>Add</span>';
  add.setAttribute('aria-label', 'Add a sticker from your photos');
  add.addEventListener('click', () => el.stickerInput.click());
  items.push(add);

  for (const st of state.customStickers) {
    const mine = st.owner_id === state.me?.id;
    if (state.stickerEdit && mine) {
      const b = tile(`up:${st.path}`, () => removeSticker(st), 'Remove this sticker');
      b.classList.add('removable');
      const x = document.createElement('span');
      x.className = 'remove-x';
      x.textContent = '×';
      b.append(x);
      items.push(b);
    } else {
      items.push(tile(`up:${st.path}`, () => { closeTrays(); send({ kind: 'sticker', body: `up:${st.path}` }); },
        mine ? 'Send a sticker you added' : 'Send a sticker they added'));
    }
  }

  items.push(label('Built-in'));
  for (const name of STICKERS) {
    items.push(tile(name, () => { closeTrays(); send({ kind: 'sticker', body: name }); },
      `Send sticker ${name.replace(/\.\w+$/, '').replace(/-/g, ' ')}`));
  }
  el.stickerGrid.replaceChildren(...items);
  el.stickerManage.hidden = !state.customStickers.some((st) => st.owner_id === state.me?.id);
  el.stickerManage.textContent = state.stickerEdit ? 'Done' : 'Edit';
}

async function loadCustomStickers() {
  const { data, error } = await sb.from('custom_stickers').select('*').order('id', { ascending: false }).limit(300);
  if (error) return;   // table missing? run database.sql again
  state.customStickers = data;
  renderStickerTray();
}

// Turns any picture into a sticker: keeps transparency, max 512px, GIFs stay animated.
async function makeStickerFile(blob) {
  if (blob.type === 'image/gif' && blob.size <= 3 * 1024 * 1024) return { blob, ext: 'gif', type: 'image/gif' };
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, 512 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const toBlob = (type, q) => new Promise((resolve) => canvas.toBlob(resolve, type, q));
  let out = await toBlob('image/webp', 0.9);
  if (!out || out.type !== 'image/webp') out = await toBlob('image/png');
  return { blob: out, ext: out.type === 'image/webp' ? 'webp' : 'png', type: out.type };
}

async function addSticker(source) {
  if (!source) { toast("Couldn't open that picture."); return; }
  if (source.size > 10 * 1024 * 1024) { toast('That picture is too big for a sticker (10 MB max).'); return; }
  toast('Adding sticker…');
  try {
    const { blob, ext, type } = await makeStickerFile(source);
    const path = `${state.me.id}/sticker-${crypto.randomUUID()}.${ext}`;
    await uploadProfileFile(path, blob, type);
    urlCache.set(`${PROFILE_BUCKET}:${path}`, { url: URL.createObjectURL(blob), expires: Infinity });
    const { data, error } = await sb.from('custom_stickers').insert({ owner_id: state.me.id, path }).select().single();
    if (error) throw error;
    state.customStickers.unshift(data);
    renderStickerTray();
    toast('Sticker added. You can both send it now.');
  } catch (err) {
    toast(`Couldn't add that sticker: ${err.message || 'try another picture'}`);
  }
}

async function addStickerFiles(files) {
  const list = [...files].filter((f) => /^image\/(png|jpeg|gif|webp)$/.test(f.type));
  if (!list.length) { toast('Pick a PNG, JPG, GIF or WEBP picture.'); return; }
  for (const f of list) await addSticker(f);
}

async function removeSticker(st) {
  const { error } = await sb.from('custom_stickers').delete().eq('id', st.id).eq('owner_id', state.me.id);
  if (error) { toast(`Couldn't remove it: ${error.message}`); return; }
  state.customStickers = state.customStickers.filter((x) => x.id !== st.id);
  if (!state.customStickers.some((x) => x.owner_id === state.me.id)) state.stickerEdit = false;
  renderStickerTray();
  toast('Removed from the tray. Messages that used it still show it.');
}

// "Add to stickers" on a photo in the chat
async function saveAsSticker(m) {
  const node = convo(state.activeId).els.get(m.id);
  const img = node?.querySelector('.photo');
  let blob = null;
  try {
    const src = img?.src || await photoUrl(m.image_path);
    blob = await (await fetch(src)).blob();
  } catch { /* fall back to the picture already on screen */ }
  if (!blob && img?.complete && img.naturalWidth) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }
  await addSticker(blob);
}

const FALLBACK_EMOJI = ('😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 '
  + '😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 '
  + '😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👻 💀 👽 🤖 💩 🙈 🙉 🙊 '
  + '👋 🤚 ✋ 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 👀 💋 '
  + '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 🌙 ☀️ 🌈 ☁️ ⚡ ❄️ '
  + '🌹 🌸 🌻 🍀 🎉 🎊 🎁 🎂 🎈 🎶 🎵 🎮 🎬 📸 📱 💻 ☕ 🍵 🍕 🍔 🍟 🍗 🍫 🍿 🍩 🍪 🍷 🍺 🥂 🏀 ⚽ 🏆 🚗 ✈️ 🏠 💤 ✅ ❌ ❓ ❗').split(' ');

let emojiReady = null;
function ensureEmojiPicker() {
  emojiReady ||= import(EMOJI_PICKER_URL).then(() => {
    const picker = document.createElement('emoji-picker');
    picker.classList.add('dark');
    picker.addEventListener('emoji-click', (e) => insertText(e.detail.unicode));
    el.emojiTray.replaceChildren(picker);
  }).catch(() => {
    // CDN unreachable: use the built-in set
    const grid = document.createElement('div');
    grid.className = 'emoji-grid';
    grid.append(...FALLBACK_EMOJI.map((emoji) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = emoji;
      b.addEventListener('click', () => insertText(emoji));
      return b;
    }));
    el.emojiTray.replaceChildren(grid);
  });
  return emojiReady;
}

function insertText(str) {
  const t = el.text;
  const start = t.selectionStart ?? t.value.length;
  const end = t.selectionEnd ?? t.value.length;
  t.value = t.value.slice(0, start) + str + t.value.slice(end);
  const pos = start + str.length;
  t.setSelectionRange(pos, pos);
  if (!isTouch) t.focus();
  onTextInput();
}

function toggleTray(which) {
  const tray = which === 'emoji' ? el.emojiTray : el.stickerTray;
  const btn = which === 'emoji' ? el.emojiBtn : el.stickerBtn;
  const opening = tray.hidden;
  closeTrays();
  closeMenu();
  if (!opening) return;
  const wasBottom = nearBottom();
  tray.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  if (which === 'emoji') ensureEmojiPicker();
  else loadCustomStickers();
  if (wasBottom) scrollToBottom();
}

function closeTrays() {
  if (state.stickerEdit) { state.stickerEdit = false; renderStickerTray(); }
  el.emojiTray.hidden = true;
  el.stickerTray.hidden = true;
  el.emojiBtn.setAttribute('aria-expanded', 'false');
  el.stickerBtn.setAttribute('aria-expanded', 'false');
}

// ============================================================ SETTINGS & NOTIFICATIONS
function openSettings() {
  if (el.profileView.open) el.profileView.close();
  state.pending = { avatar: null, song: null };
  el.setName.value = displayName(state.me);
  el.setBio.value = state.me.bio || '';
  el.setSongTitle.value = state.me.song_title || '';
  el.setPass.value = '';
  el.setPass2.value = '';
  el.setNotify.checked = store.get('chat:notify') === 'on' && notificationsAllowed();
  updateBioCount();
  renderAvatarEdit();
  renderSongEdit();
  setSettingsMsg('');
  el.settings.showModal();
}

function setSettingsMsg(text, ok = false) {
  el.setMsg.textContent = text;
  el.setMsg.classList.toggle('form-ok', ok);
}

function updateBioCount() {
  el.bioCount.textContent = `${[...el.setBio.value].length} / 160`;
}

function renderAvatarEdit() {
  const pending = state.pending.avatar;
  if (pending === 'remove') fillAvatar(el.setAvatar, { ...state.me, avatar_path: null });
  else if (pending) fillAvatar(el.setAvatar, state.me, { localUrl: pending.url });
  else fillAvatar(el.setAvatar, state.me);
  el.avatarRemove.hidden = pending === 'remove' || (!pending && !state.me.avatar_path);
  el.avatarChange.textContent = pending === 'remove' || (!pending && !state.me.avatar_path) ? 'Add a picture' : 'Change picture';
}

function renderSongEdit() {
  const pending = state.pending.song;
  const title = el.setSongTitle.value.trim() || 'Untitled';
  let card = null;
  if (pending && pending !== 'remove') card = songCard({ song_path: null, song_title: title }, { localUrl: pending.url });
  else if (!pending && state.me.song_path) card = songCard({ ...state.me, song_title: title });
  el.songCurrent.replaceChildren(...(card ? [card] : []));
  el.setSongTitle.hidden = !card;
  el.songRemove.hidden = !card;
  el.songChange.textContent = card ? 'Choose a different song' : 'Choose a song file';
}

async function pickAvatar(file) {
  if (!file) return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type)) { setSettingsMsg('Pick a PNG, JPG, GIF or WEBP picture.'); return; }
  try {
    const blob = await cropSquare(file, 512);
    state.pending.avatar = { blob, url: URL.createObjectURL(blob) };
    setSettingsMsg('');
    renderAvatarEdit();
  } catch {
    setSettingsMsg("Couldn't open that picture. Try another one.");
  }
}

// Centre-crops a picture to a square and shrinks it, so profile pictures load fast.
async function cropSquare(file, size) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.min(size, side);
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side,
    0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject()), 'image/jpeg', 0.88));
}

const SONG_TYPES = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg',
  wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm',
};
function songType(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const fixed = { 'audio/mp3': 'audio/mpeg', 'audio/x-flac': 'audio/flac', 'audio/vnd.wave': 'audio/wav', 'audio/wave': 'audio/wav' };
  const t = fixed[baseType(file.type)] || baseType(file.type);
  return Object.values(SONG_TYPES).includes(t) || t === 'audio/x-m4a' || t === 'audio/x-wav' ? t : SONG_TYPES[ext] || null;
}

function pickSong(file) {
  if (!file) return;
  if (!songType(file)) { setSettingsMsg('Pick an MP3, M4A, AAC, OGG, WAV or FLAC file.'); return; }
  if (file.size > MAX_SONG_MB * 1024 * 1024) { setSettingsMsg(`That song is too big. The limit is ${MAX_SONG_MB} MB.`); return; }
  stopAudio();
  state.pending.song = { file, url: URL.createObjectURL(file) };
  el.setSongTitle.value = file.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim().slice(0, 100);
  setSettingsMsg('');
  renderSongEdit();
}

async function uploadProfileFile(path, blob, contentType) {
  const { error } = await sb.storage.from(PROFILE_BUCKET)
    .upload(path, blob, { contentType, cacheControl: '31536000', upsert: false });
  if (error) throw error;
}

async function saveSettings(e) {
  e.preventDefault();
  const name = el.setName.value.trim();
  const bio = el.setBio.value.trim();
  const songTitle = el.setSongTitle.value.trim();
  const p1 = el.setPass.value;
  const p2 = el.setPass2.value;
  if (!name) { setSettingsMsg('Enter a display name.'); return; }
  if ([...bio].length > 160) { setSettingsMsg('Keep "About you" to 160 characters.'); return; }
  if (p1 || p2) {
    if (p1.length < 6) { setSettingsMsg('Use at least 6 characters for the new password.'); return; }
    if (p1 !== p2) { setSettingsMsg("The two passwords don't match."); return; }
  }
  el.setSave.disabled = true;
  setSettingsMsg('Saving…', true);
  const me = state.me;
  const patch = {};
  const oldFiles = [];
  try {
    if (name !== displayName(me)) patch.display_name = name;
    if (bio !== (me.bio || '')) patch.bio = bio || null;

    const avatar = state.pending.avatar;
    if (avatar === 'remove') {
      patch.avatar_path = null;
    } else if (avatar) {
      setSettingsMsg('Uploading your picture…', true);
      const path = `${me.id}/avatar-${crypto.randomUUID()}.jpg`;
      await uploadProfileFile(path, avatar.blob, 'image/jpeg');
      urlCache.set(`${PROFILE_BUCKET}:${path}`, { url: avatar.url, expires: Infinity });
      patch.avatar_path = path;
    }
    if (avatar && me.avatar_path) oldFiles.push(me.avatar_path);

    const song = state.pending.song;
    if (song === 'remove') {
      patch.song_path = null;
      patch.song_title = null;
    } else if (song) {
      setSettingsMsg('Uploading your song…', true);
      const type = songType(song.file);
      const ext = (song.file.name.split('.').pop() || audioExt(type)).toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
      const path = `${me.id}/song-${crypto.randomUUID()}.${ext}`;
      await uploadProfileFile(path, song.file, type);
      urlCache.set(`${PROFILE_BUCKET}:${path}`, { url: song.url, expires: Infinity });
      patch.song_path = path;
      patch.song_title = songTitle || 'Untitled';
    } else if (me.song_path && songTitle !== (me.song_title || '')) {
      patch.song_title = songTitle || null;
    }
    if (song && me.song_path) oldFiles.push(me.song_path);

    if (Object.keys(patch).length) {
      const { error } = await sb.from('profiles').update(patch).eq('id', me.id);
      if (error) throw error;
      Object.assign(me, patch);
      renderMe();
      if (oldFiles.length) sb.storage.from(PROFILE_BUCKET).remove(oldFiles).catch(() => {});
    }
    state.pending = { avatar: null, song: null };

    if (p1) {
      const { error } = await sb.auth.updateUser({ password: p1 });
      if (error) throw error;
    }
    if (el.setNotify.checked) {
      if (!(await enableNotifications())) {
        el.setNotify.checked = false;
        throw new Error('This browser blocked notifications. Allow them in the site settings, then try again.');
      }
    } else {
      store.set('chat:notify', 'off');
    }
    el.settings.close();
    toast(p1 ? 'Saved. Use your new password next time you log in.' : 'Profile saved.');
  } catch (err) {
    setSettingsMsg(err.message || 'Something went wrong. Try again.');
  } finally {
    el.setSave.disabled = false;
  }
}

// ============================================================ PROFILES
function openProfile(id) {
  const isMe = id === state.me.id;
  const p = isMe ? state.me : state.contacts.get(id);
  if (!p) return;
  closeMenu();
  state.profileViewId = id;
  fillAvatar(el.pvAvatar, p);
  el.pvName.textContent = displayName(p);
  el.pvUsername.textContent = `@${p.username}`;
  if (isMe) {
    el.pvStatus.className = 'peer-status';
    el.pvStatus.textContent = 'This is you';
  } else {
    paintStatus(el.pvStatus, p);
  }
  el.pvBio.textContent = p.bio || (!p.song_path && !isMe ? `${displayName(p)} hasn't added anything to their profile yet.` : '');
  el.pvBio.classList.toggle('muted', !p.bio);
  el.pvSong.replaceChildren(...(p.song_path ? [songCard(p)] : []));
  el.pvEdit.hidden = !isMe;
  if (!el.profileView.open) el.profileView.showModal();
}

// A small music player for someone's profile song.
function songCard(p, { localUrl = null } = {}) {
  const key = localUrl ? `song-local:${localUrl}` : `song:${p.song_path}`;
  const card = document.createElement('div');
  card.className = 'song-card';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'song-play';
  btn.innerHTML = ICON.play;
  const info = document.createElement('div');
  info.className = 'song-info';
  const label = document.createElement('span');
  label.className = 'song-label';
  label.textContent = 'Profile song';
  const title = document.createElement('span');
  title.className = 'song-title';
  title.textContent = p.song_title || 'Untitled';
  const seek = document.createElement('input');
  seek.type = 'range';
  seek.className = 'song-seek';
  seek.min = '0'; seek.max = '1000'; seek.value = '0';
  seek.setAttribute('aria-label', 'Song position');
  const time = document.createElement('span');
  time.className = 'song-time';
  time.textContent = '0:00';
  info.append(label, title, seek);
  card.append(btn, info, time);

  let dragging = false;
  const ui = {
    setPlaying(on) {
      btn.innerHTML = on === true ? ICON.pause : ICON.play;
      btn.classList.toggle('loading', on === 'loading');
      btn.setAttribute('aria-label', on === true ? `Pause ${title.textContent}` : `Play ${title.textContent}`);
    },
    setProgress(t, d) {
      const ok = Number.isFinite(d) && d > 0;
      if (!dragging) seek.value = ok ? String(Math.round((t / d) * 1000)) : '0';
      time.textContent = ok ? `${fmtDuration(t)} / ${fmtDuration(d)}` : fmtDuration(t);
    },
  };
  ui.setPlaying(false);
  btn.addEventListener('click', () => player.toggle(key,
    () => (localUrl ? Promise.resolve(localUrl) : mediaUrl(PROFILE_BUCKET, p.song_path)), ui));
  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('change', () => { dragging = false; player.seek(key, Number(seek.value) / 1000); });
  seek.addEventListener('input', () => { if (!player.isCurrent(key)) seek.value = '0'; });
  player.attach(key, ui);
  return card;
}

// ============================================================ AUDIO PLAYER
// One player for voice messages and profile songs, so only one plays at a time.
const player = {
  audio: new Audio(),
  cur: null,   // { key, ui, dur }
  init() {
    const a = this.audio;
    a.preload = 'metadata';
    a.addEventListener('timeupdate', () => this.cur?.ui.setProgress(a.currentTime, a.duration));
    a.addEventListener('play', () => this.cur?.ui.setPlaying(true));
    a.addEventListener('pause', () => this.cur?.ui.setPlaying(false));
    a.addEventListener('ended', () => { this.cur?.ui.setPlaying(false); this.cur?.ui.setProgress(0, a.duration); });
  },
  isCurrent(key) { return this.cur?.key === key; },
  async toggle(key, getUrl, ui, dur = 0) {
    const a = this.audio;
    if (this.cur?.key === key) {
      if (a.paused) a.play().catch(() => {}); else a.pause();
      return;
    }
    this.stop();
    this.cur = { key, ui, dur };
    ui.setPlaying('loading');
    try {
      const url = await getUrl();
      if (this.cur?.key !== key) return;
      a.src = url;
      await a.play();
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (this.cur?.key === key) { ui.setPlaying(false); this.cur = null; }
      toast("Couldn't play this audio.");
    }
  },
  seek(key, frac) {
    if (this.cur?.key !== key) return;
    const a = this.audio;
    const d = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : this.cur.dur;
    if (d) a.currentTime = Math.max(0, Math.min(1, frac)) * d;
  },
  attach(key, ui) {   // a re-drawn bubble or card takes over the controls
    if (this.cur?.key !== key) return;
    this.cur.ui = ui;
    ui.setPlaying(!this.audio.paused);
    ui.setProgress(this.audio.currentTime, this.audio.duration);
  },
  stop() {
    if (!this.cur) return;
    const { ui } = this.cur;
    this.cur = null;
    this.audio.pause();
    ui.setPlaying(false);
    ui.setProgress(0, 0);
  },
};
player.init();
function stopAudio() { player.stop(); }
function stopSongs() { if (player.cur?.key.startsWith('song')) player.stop(); }

// ============================================================ VOICE MESSAGES
function voiceInfo(m) {
  try {
    const v = JSON.parse(m.body || '{}');
    return { d: Number(v.d) || 0, w: Array.isArray(v.w) ? v.w.map(Number).filter(Number.isFinite) : [] };
  } catch {
    return { d: 0, w: [] };
  }
}

function buildVoice(m) {
  const info = voiceInfo(m);
  const bars = info.w.length ? resample(info.w, 32) : fakeWave(String(m.image_path || m.id), 32);
  const wrap = document.createElement('div');
  wrap.className = 'voice';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'voice-play';
  const wave = document.createElement('span');
  wave.className = 'wave';
  wave.append(...bars.map((v) => {
    const i = document.createElement('i');
    i.style.height = `${Math.round(18 + v * 82)}%`;
    return i;
  }));
  const time = document.createElement('span');
  time.className = 'voice-time';
  time.textContent = fmtDuration(info.d);
  wrap.append(btn, wave, time);

  const key = `voice:${m.image_path || m.id}`;
  const ui = {
    setPlaying(on) {
      btn.innerHTML = on === true ? ICON.pause : ICON.play;
      btn.classList.toggle('loading', on === 'loading');
      btn.setAttribute('aria-label', on === true ? 'Pause voice message' : 'Play voice message');
    },
    setProgress(t, d) {
      const dur = Number.isFinite(d) && d > 0 ? d : info.d;
      const frac = dur ? t / dur : 0;
      const lit = Math.round(frac * bars.length);
      [...wave.children].forEach((bar, n) => bar.classList.toggle('on', n < lit && t > 0));
      time.textContent = t > 0 ? fmtDuration(t) : fmtDuration(info.d);
    },
  };
  ui.setPlaying(false);
  const src = () => (m._localUrl ? Promise.resolve(m._localUrl) : photoUrl(m.image_path));
  btn.addEventListener('click', (e) => { e.stopPropagation(); player.toggle(key, src, ui, info.d); });
  wave.addEventListener('click', (e) => {
    e.stopPropagation();
    const r = wave.getBoundingClientRect();
    player.seek(key, (e.clientX - r.left) / r.width);
  });
  player.attach(key, ui);
  return wrap;
}

function resample(values, n) {
  if (!values.length) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const from = Math.floor((i / n) * values.length);
    const to = Math.max(from + 1, Math.floor(((i + 1) / n) * values.length));
    out.push(Math.max(...values.slice(from, to)));
  }
  const top = Math.max(...out) || 1;
  return out.map((v) => Math.round((v / top) * 100) / 100);
}

function fakeWave(seed, n) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: n }, () => { h = (h * 1103515245 + 12345) >>> 0; return 0.25 + (h % 1000) / 1333; });
}

const rec = { mr: null, stream: null, chunks: [], start: 0, timer: null, ctx: null, analyser: null, levels: [] };

async function startRecording() {
  if (rec.mr || !state.activeId) return;
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    toast("This browser can't record voice messages.");
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (err) {
    toast(err?.name === 'NotFoundError' ? "Couldn't find a microphone."
      : 'Microphone access is blocked. Allow it in your browser settings to send voice messages.');
    return;
  }
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm']
    .find((t) => MediaRecorder.isTypeSupported?.(t));
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
  Object.assign(rec, { mr, stream, chunks: [], start: Date.now(), levels: [] });
  mr.addEventListener('dataavailable', (e) => { if (e.data.size) rec.chunks.push(e.data); });
  mr.start(250);
  try {
    rec.ctx = new AudioContext();
    rec.analyser = rec.ctx.createAnalyser();
    rec.analyser.fftSize = 1024;
    rec.ctx.createMediaStreamSource(stream).connect(rec.analyser);
  } catch { /* the waveform is optional */ }

  stopAudio();
  closeTrays();
  el.composer.classList.add('recording');
  el.composeTools.hidden = true;
  el.recBar.hidden = false;
  el.mic.hidden = true;
  el.send.hidden = false;
  el.send.disabled = false;
  el.send.setAttribute('aria-label', 'Send voice message');
  el.recWave.replaceChildren();
  el.recTime.textContent = '0:00';
  const buf = new Uint8Array(1024);
  rec.timer = setInterval(() => {
    const secs = (Date.now() - rec.start) / 1000;
    el.recTime.textContent = fmtDuration(secs);
    let level = 0;
    if (rec.analyser) {
      rec.analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      level = Math.min(1, Math.sqrt(sum / buf.length) * 5);
    }
    rec.levels.push(level);
    const bar = document.createElement('i');
    bar.style.height = `${Math.max(10, level * 100)}%`;
    el.recWave.append(bar);
    if (el.recWave.childElementCount > 90) el.recWave.firstElementChild.remove();
    if (secs >= MAX_VOICE_SECONDS) finishRecording(true);
  }, 100);
}

function finishRecording(sendIt) {
  const { mr } = rec;
  if (!mr) return;
  const secs = (Date.now() - rec.start) / 1000;
  const chunks = rec.chunks;
  const levels = rec.levels;
  mr.addEventListener('stop', () => {
    if (!sendIt) return;
    const type = baseType(mr.mimeType || chunks[0]?.type || 'audio/webm');
    const blob = new Blob(chunks, { type });
    if (secs < 0.8 || !blob.size) { toast('That was too short. Tap the microphone, talk, then press send.'); return; }
    send({ kind: 'audio', file: blob, body: JSON.stringify({ d: Math.round(secs * 10) / 10, w: resample(levels, 40) }) });
  }, { once: true });
  try { mr.stop(); } catch { /* already stopped */ }
  clearInterval(rec.timer);
  rec.stream?.getTracks().forEach((t) => t.stop());
  rec.ctx?.close().catch(() => {});
  Object.assign(rec, { mr: null, stream: null, ctx: null, analyser: null, timer: null });
  el.composer.classList.remove('recording');
  el.composeTools.hidden = false;
  el.recBar.hidden = true;
  el.send.setAttribute('aria-label', 'Send');
  onTextInput();
}

function cancelRecording() { finishRecording(false); }

function notificationsAllowed() {
  try { return 'Notification' in window && Notification.permission === 'granted'; } catch { return false; }
}

async function enableNotifications() {
  try {
    if (!('Notification' in window)) return false;
    let perm = Notification.permission;
    if (perm === 'default') perm = await Notification.requestPermission();
    if (perm !== 'granted') return false;
    store.set('chat:notify', 'on');
    return true;
  } catch {
    return false;
  }
}

function notify(title, body, fromId) {
  if (document.visibilityState === 'visible' || store.get('chat:notify') !== 'on' || !notificationsAllowed()) return;
  try {
    const n = new Notification(title, { body, tag: `chat-${fromId}`, icon: 'icons/icon-192.png' });
    n.onclick = () => { window.focus(); openConvo(fromId); n.close(); };
  } catch { /* some phones only allow notifications from installed apps */ }
}

// ============================================================ EVENTS
function wireEvents() {
  window.addEventListener('lovers:open-message', (event) => jumpToMessage(event.detail));
  window.addEventListener('lovers:open-conversation', (event) => {
    const peerId = event.detail?.peerId;
    if (peerId && state.contacts.has(peerId)) {
      window.dispatchEvent(new CustomEvent('lovers:show-chat'));
      openConvo(peerId);
    }
  });
  window.addEventListener('lovers:saved-changed', () => {
    if (state.activeId) refreshPinnedBanner(state.activeId);
  });
  el.pinnedOpen?.addEventListener('click', () => {
    const messageId = Number(el.pinnedOpen.dataset.messageId);
    if (messageId && state.activeId) jumpToMessage({ messageId, peerId: state.activeId });
  });
  el.pinnedSaved?.addEventListener('click', () => window.dispatchEvent(new CustomEvent('lovers:show-saved')));
  el.loginForm.addEventListener('submit', login);
  el.back.addEventListener('click', () => {
    el.app.classList.remove('chat-open');
    state.activeId = null;
    closeTrays();
    closeMenu();
    cancelReply();
    renderContacts();
  });

  // voice messages
  el.mic.addEventListener('click', startRecording);
  el.recCancel.addEventListener('click', cancelRecording);

  // profiles
  el.peerBtn.addEventListener('click', () => openProfile(state.activeId));
  el.pvClose.addEventListener('click', () => el.profileView.close());
  el.profileView.addEventListener('click', (e) => { if (e.target === el.profileView) el.profileView.close(); });
  el.profileView.addEventListener('close', () => { state.profileViewId = null; stopSongs(); });
  el.pvEdit.addEventListener('click', openSettings);
  el.avatarChange.addEventListener('click', () => el.avatarInput.click());
  el.avatarInput.addEventListener('change', () => { pickAvatar(el.avatarInput.files[0]); el.avatarInput.value = ''; });
  el.avatarRemove.addEventListener('click', () => { state.pending.avatar = 'remove'; renderAvatarEdit(); });
  el.songChange.addEventListener('click', () => el.songInput.click());
  el.songInput.addEventListener('change', () => { pickSong(el.songInput.files[0]); el.songInput.value = ''; });
  el.songRemove.addEventListener('click', () => { stopSongs(); state.pending.song = 'remove'; renderSongEdit(); });
  el.setBio.addEventListener('input', updateBioCount);
  el.setSongTitle.addEventListener('input', () => {
    const t = el.songCurrent.querySelector('.song-title');
    if (t) t.textContent = el.setSongTitle.value.trim() || 'Untitled';
  });
  el.settings.addEventListener('close', stopSongs);

  // settings
  el.settingsBtn.addEventListener('click', openSettings);
  el.settingsForm.addEventListener('submit', saveSettings);
  el.setCancel.addEventListener('click', () => el.settings.close());
  el.logout.addEventListener('click', () => { el.settings.close(); sb?.auth.signOut(); });

  // composer
  el.composer.addEventListener('submit', (e) => {
    e.preventDefault();
    if (rec.mr) { finishRecording(true); return; }
    const body = el.text.value.trim();
    if (!body) return;
    el.text.value = '';
    onTextInput();
    closeTrays();
    send({ kind: 'text', body });
  });
  el.text.addEventListener('input', () => { onTextInput(); sendTyping(); });
  el.text.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTouch && !e.isComposing) {
      e.preventDefault();
      el.composer.requestSubmit();
    }
  });
  el.text.addEventListener('paste', (e) => {
    const files = e.clipboardData?.files;
    if (files?.length) { e.preventDefault(); sendFiles(files); }
  });
  el.replyCancel.addEventListener('click', cancelReply);

  el.emojiBtn.addEventListener('click', () => toggleTray('emoji'));
  el.stickerBtn.addEventListener('click', () => toggleTray('sticker'));
  el.stickerInput.addEventListener('change', () => { addStickerFiles(el.stickerInput.files); el.stickerInput.value = ''; });
  el.stickerManage.addEventListener('click', () => { state.stickerEdit = !state.stickerEdit; renderStickerTray(); });
  el.imageBtn.addEventListener('click', () => el.imageInput.click());
  el.imageInput.addEventListener('change', () => {
    sendFiles(el.imageInput.files);
    el.imageInput.value = '';
  });

  // message menu
  el.menu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) onMenuAction(b.dataset.act, b);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!el.menu.hidden && !el.menu.contains(e.target) && !e.target.closest('.more')) closeMenu();
  });
  window.addEventListener('resize', closeMenu);

  // When the tab becomes visible again, immediately recover any unread messages.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pollIncomingMessages();
      if (Date.now() - state.lastSync > 3000) syncMissed();
    }
  });

  // scrolling: load older messages near the top, track "stuck to bottom"
  el.messages.addEventListener('scroll', () => {
    closeMenu();
    state.stickToBottom = nearBottom();
    if (state.stickToBottom) el.jump.hidden = true;
    if (el.messages.scrollTop < 120) loadOlder();
  }, { passive: true });
  el.jump.addEventListener('click', () => scrollToBottom(true));
  // once you scroll yourself, stop holding the "Unread messages" line in place
  for (const ev of ['wheel', 'touchstart', 'keydown']) {
    el.messages.addEventListener(ev, () => { state.anchor = null; }, { passive: true });
  }

  // drag & drop photos
  let dragDepth = 0;
  el.stage.addEventListener('dragenter', (e) => {
    if (![...e.dataTransfer.types].includes('Files')) return;
    dragDepth++;
    el.dropHint.hidden = false;
  });
  el.stage.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; el.dropHint.hidden = true; } });
  el.stage.addEventListener('dragover', (e) => e.preventDefault());
  el.stage.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDepth = 0;
    el.dropHint.hidden = true;
    sendFiles(e.dataTransfer.files);
  });

  el.lightbox.addEventListener('click', () => el.lightbox.close());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (rec.mr) cancelRecording();
    else if (!el.menu.hidden) closeMenu();
    else if (state.replyTo) cancelReply();
    else closeTrays();
  });

  // coming back to the tab: catch up and mark as read
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.me) return;
    markRead(state.activeId);
    syncMissed();
  });
  window.addEventListener('online', () => syncMissed());
  window.addEventListener('pagehide', () => {
    if (state.me) sb.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', state.me.id).then(() => {});
  });
}

function onTextInput() {
  const t = el.text;
  t.style.height = 'auto';
  t.style.height = `${Math.min(t.scrollHeight + 2, 150)}px`;
  if (rec.mr) return;
  const hasText = Boolean(t.value.trim());
  el.send.hidden = !hasText;     // empty box: show the microphone instead
  el.send.disabled = !hasText;
  el.mic.hidden = hasText;
}

// ============================================================ HELPERS
function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function displayName(p) { return p?.display_name || p?.username || ''; }
function initial(p) { return [...displayName(p)][0] || '?'; }

function appendLinkified(parent, text) {
  const re = /https?:\/\/[^\s<]+[^\s<.,:;"')\]!?]/gi;
  let last = 0;
  for (const match of text.matchAll(re)) {
    parent.append(text.slice(last, match.index));
    const a = document.createElement('a');
    a.href = match[0];
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = match[0];
    parent.append(a);
    last = match.index + match[0].length;
  }
  parent.append(text.slice(last));
}

const EMOJI_ONLY = /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|‍|️|\s)+$/u;
const segmenter = 'Segmenter' in Intl ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
function isEmojiOnly(s) {
  if (!s || s.length > 30 || !EMOJI_ONLY.test(s)) return false;
  const compact = s.replace(/\s/g, '');
  const count = segmenter ? [...segmenter.segment(compact)].length : Math.ceil(compact.length / 2);
  return count > 0 && count <= 3;
}

const clockFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const clock = (iso) => clockFmt.format(new Date(iso));
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const dayKey = (iso) => startOfDay(new Date(iso)).getTime();
const daysAgo = (iso) => Math.round((startOfDay(new Date()) - startOfDay(new Date(iso))) / 86_400_000);

function dayLabel(iso) {
  const d = new Date(iso);
  const n = daysAgo(iso);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  if (n < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' });
}

function shortWhen(iso) {
  const n = daysAgo(iso);
  if (n === 0) return clock(iso);
  if (n === 1) return 'Yesterday';
  if (n < 7) return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function lastSeenText(iso) {
  const mins = (Date.now() - new Date(iso)) / 60_000;
  if (mins < 2) return 'just now';
  if (mins < 60) return `${Math.floor(mins)} min ago`;
  const n = daysAgo(iso);
  if (n === 0) return `today at ${clock(iso)}`;
  if (n === 1) return `yesterday at ${clock(iso)}`;
  return `${shortWhen(iso)} at ${clock(iso)}`;
}

function updateTitle() {
  let total = 0;
  state.unread.forEach((n) => { total += n; });
  document.title = total ? `(${total}) ${APP_NAME}` : APP_NAME;
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3800);
}

// A short, quiet "blip" for new messages.
let audioCtx;
function blip() {
  try {
    audioCtx ||= new AudioContext();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(740, t);
    osc.frequency.exponentialRampToValueAtTime(1180, t + 0.09);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  } catch { /* sound is optional */ }
}
