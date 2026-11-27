import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const BUCKET = 'relationship-gallery';
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const $ = (id) => document.getElementById(id);
const sb = window.__loversSupabase || createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null,
  page: 'chat',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: dateISO(new Date()),
  events: [],
  tasks: [],
  photos: [],
  editingPhotoId: null,
  voices: [],
  voiceUrls: new Map(),
  names: new Map(),
  milestones: [],
  timelineItems: [],
  ideas: [],
  checkins: [],
  notes: [],
  savedMessages: [],
  searchResults: [],
  searchErrors: [],
  editingNoteId: null,
  selectedIdeaId: null,
  selectedMood: 'good',
  channel: null,
  timer: null,
  refreshTimer: null,
  loadingPhotos: false,
  signedUrls: new Map(),
};

const icons = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  gallery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
  tasks: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="m8 9 1.5 1.5L12 8M14 9h2M8 16l1.5 1.5L12 15M14 16h2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-1-4.5A7.5 7.5 0 1 1 20 11.5Z"/><path d="M8 11h8M8 14h5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m14 5 5 5M4 20l4.5-1 10.8-10.8a2.1 2.1 0 0 0-3-3L5.5 16z"/><path d="M13 20h7"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>',
};

function dateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(value) {
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(value, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en-GB', options).format(parseDate(value));
}

function escapeText(value) {
  return String(value ?? '');
}

function toast(message) {
  const node = $('toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timeout);
  toast.timeout = setTimeout(() => node.classList.remove('show'), 2600);
}

function setActiveNavigation(page) {
  document.querySelectorAll('[data-space]').forEach((button) => {
    const active = button.dataset.space === page;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

const pageCopy = {
  home: ['Our little universe', 'A small place for the dates, photos, and ordinary moments you want to keep.'],
  calendar: ['Our calendar', 'Birthdays, anniversaries, and the little dates worth remembering.'],
  gallery: ['Our gallery', 'Your shared photo shelf — private, searchable, and saved with its date.'],
  voices: ['Voice library', 'Little voice notes and messages, saved with their dates so you can hear them again.'],
  tasks: ['Little plans', 'Small things to do together, one check at a time.'],
  timeline: ['Our timeline', 'A growing story made from your dates, photographs, and little milestones.'],
  jar: ['Date night jar', 'Let the jar choose a simple, fun plan for the two of you.'],
  checkin: ['Daily check-in', 'A small daily pause to share how today is going.'],
  search: ['Search everything', 'Find messages, photo captions, shared notes, dates and plans.'],
  saved: ['Saved messages', 'Your personal shelf for messages you want to find again.'],
  notes: ['Shared notes', 'A little notebook both of you can read and update.'],
};

function showPage(page) {
  if (page === 'chat') {
    state.page = 'chat';
    $('app').classList.remove('space-open');
    $('couple-space').hidden = true;
    if (matchMedia('(max-width: 760px)').matches) $('app').classList.add('chat-open');
    else $('app').classList.remove('chat-open');
    setActiveNavigation('chat');
    return;
  }

  if (!pageCopy[page]) return;
  state.page = page;
  $('app').classList.remove('chat-open');
  $('app').classList.add('space-open');
  $('couple-space').hidden = false;
  document.querySelectorAll('.space-view').forEach((view) => {
    view.hidden = view.id !== `space-${page}`;
  });
  $('space-page-title').textContent = pageCopy[page][0];
  $('space-page-subtitle').textContent = pageCopy[page][1];
  setActiveNavigation(page);

  if (page === 'calendar') renderCalendar();
  if (page === 'gallery') loadPhotos();
  if (page === 'voices') loadVoices();
  if (page === 'tasks') renderTasks();
  if (page === 'home') renderHome();
  if (page === 'timeline') loadTimeline();
  if (page === 'jar') loadDateIdeas();
  if (page === 'checkin') loadCheckins();
  if (page === 'saved') loadSavedMessages();
  if (page === 'notes') loadNotes();
}

function wireNavigation() {
  document.querySelectorAll('[data-space]').forEach((button) => {
    button.addEventListener('click', () => showPage(button.dataset.space));
  });
  $('space-chat-button')?.addEventListener('click', () => showPage('chat'));
}

async function loadBaseData() {
  const [eventsResult, tasksResult, profilesResult] = await Promise.all([
    sb.from('relationship_events').select('*').order('event_date', { ascending: true }),
    sb.from('relationship_tasks').select('*').order('done', { ascending: true }).order('created_at', { ascending: false }),
    sb.from('profiles').select('id, display_name, username'),
  ]);

  if (eventsResult.error) toast(`Calendar: ${eventsResult.error.message}`);
  else state.events = eventsResult.data || [];

  if (tasksResult.error) toast(`To-do list: ${tasksResult.error.message}`);
  else state.tasks = tasksResult.data || [];

  if (profilesResult.error) toast(`Profiles: ${profilesResult.error.message}`);
  else state.names = new Map((profilesResult.data || []).map((profile) => [
    profile.id,
    profile.display_name || profile.username || 'One of you',
  ]));

  renderHome();
  renderCalendar();
  renderTasks();
}

function setupRealtime() {
  if (state.channel) sb.removeChannel(state.channel);
  const channel = sb.channel(`relationship-space-${state.user.id}`);
  for (const table of [
    'relationship_events',
    'relationship_tasks',
    'relationship_photos',
    'relationship_timeline_entries',
    'relationship_date_ideas',
    'relationship_daily_checkins',
    'relationship_voice_records',
    'relationship_notes',
    'relationship_saved_messages',
  ]) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(async () => {
        await loadBaseData();
        if (state.page === 'gallery') await loadPhotos();
        if (state.page === 'timeline') await loadTimeline();
        if (state.page === 'jar') await loadDateIdeas();
        if (state.page === 'checkin') await loadCheckins();
        if (state.page === 'voices') await loadVoices();
        if (state.page === 'notes') await loadNotes();
        if (state.page === 'saved') await loadSavedMessages();
      }, 250);
    });
  }
  channel.subscribe();
  state.channel = channel;
}

async function initialise(user) {
  if (!user || state.user?.id === user.id) return;
  state.user = user;
  await loadBaseData();
  setupRealtime();
  startAnniversaryClock();
  $('gallery-date').value = dateISO(new Date());
  $('voice-date').value = dateISO(new Date());
  $('event-date').value = state.selectedDate;
}

function resetSpace() {
  if (state.channel) sb.removeChannel(state.channel);
  state.channel = null;
  state.user = null;
  state.events = [];
  state.tasks = [];
  state.photos = [];
  state.voices = [];
  state.voiceUrls.clear();
  state.milestones = [];
  state.timelineItems = [];
  state.ideas = [];
  state.checkins = [];
  state.notes = [];
  state.savedMessages = [];
  state.editingNoteId = null;
  state.selectedIdeaId = null;
  state.names.clear();
  clearInterval(state.timer);
  clearTimeout(state.refreshTimer);
  $('couple-space').hidden = true;
  $('app').classList.remove('space-open');
  showPage('chat');
}

function startAuth() {
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      resetSpace();
      return;
    }
    if (session?.user) setTimeout(() => initialise(session.user), 0);
  });
  sb.auth.getSession().then(({ data, error }) => {
    if (error) return;
    if (data.session?.user) initialise(data.session.user);
  });
}

/* ----------------------------- Anniversary clock ----------------------------- */
function startAnniversaryClock() {
  clearInterval(state.timer);
  const start = new Date(2026, 10, 22, 0, 0, 0);
  const update = () => {
    const now = new Date();
    if (now < start) {
      $('timer-years').textContent = '0';
      $('timer-days').textContent = '0';
      $('timer-hours').textContent = '0';
      $('timer-minutes').textContent = '0';
      $('timer-seconds').textContent = '0';
      return;
    }

    let years = now.getFullYear() - start.getFullYear();
    let anchor = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
    if (now < anchor) {
      years -= 1;
      anchor = new Date(start.getFullYear() + years, start.getMonth(), start.getDate());
    }
    let remaining = Math.floor((now - anchor) / 1000);
    const days = Math.floor(remaining / 86400);
    remaining -= days * 86400;
    const hours = Math.floor(remaining / 3600);
    remaining -= hours * 3600;
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining - minutes * 60;

    $('timer-years').textContent = String(years);
    $('timer-days').textContent = String(days);
    $('timer-hours').textContent = String(hours).padStart(2, '0');
    $('timer-minutes').textContent = String(minutes).padStart(2, '0');
    $('timer-seconds').textContent = String(seconds).padStart(2, '0');
  };
  update();
  state.timer = setInterval(update, 1000);
}

/* ----------------------------- Home dashboard ----------------------------- */
function nextOccurrence(event, today) {
  const [year, month, day] = event.event_date.slice(0, 10).split('-').map(Number);
  let date = new Date(year, month - 1, day);
  if (event.repeat_yearly) {
    date = new Date(today.getFullYear(), month - 1, day);
    if (date < today) date = new Date(today.getFullYear() + 1, month - 1, day);
  }
  if (date < today) return null;
  return date;
}

function renderHome() {
  if (!$('upcoming-events')) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = state.events
    .map((event) => ({ event, date: nextOccurrence(event, today) }))
    .filter((item) => item.date)
    .sort((a, b) => a.date - b.date)
    .slice(0, 4);

  const list = $('upcoming-events');
  list.replaceChildren();
  if (!upcoming.length) {
    list.append(makeEmpty('No dates yet. Add the first one in your calendar.'));
  } else {
    for (const item of upcoming) {
      const days = Math.round((item.date - today) / 86400000);
      const row = document.createElement('div');
      row.className = 'upcoming-item';
      const bar = document.createElement('i');
      bar.className = 'upcoming-bar';
      bar.style.background = item.event.color;
      const copy = document.createElement('div');
      copy.className = 'upcoming-copy';
      const title = document.createElement('strong');
      title.textContent = item.event.title;
      const date = document.createElement('span');
      date.textContent = formatDate(dateISO(item.date), { day: 'numeric', month: 'short', year: 'numeric' });
      copy.append(title, date);
      const count = document.createElement('span');
      count.className = 'upcoming-count';
      count.textContent = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
      row.append(bar, copy, count);
      list.append(row);
    }
  }

  const completed = state.tasks.filter((task) => task.done).length;
  const total = state.tasks.length;
  const pending = total - completed;
  $('home-task-total').textContent = String(total);
  $('home-task-done').textContent = `${completed} done · ${pending} left`;
  $('home-task-fill').style.width = total ? `${Math.round(completed / total * 100)}%` : '0%';
}

function makeEmpty(message) {
  const node = document.createElement('div');
  node.className = 'space-empty';
  node.textContent = message;
  return node;
}

/* ----------------------------- Calendar ----------------------------- */
function eventOccursOn(event, date) {
  const [year, month, day] = event.event_date.slice(0, 10).split('-').map(Number);
  if (event.repeat_yearly) return date.getMonth() + 1 === month && date.getDate() === day;
  return dateISO(date) === event.event_date.slice(0, 10);
}

function eventsOn(date) {
  return state.events.filter((event) => eventOccursOn(event, date));
}

function renderCalendar() {
  if (!$('calendar-days')) return;
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  $('calendar-month-label').textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(state.month);

  const first = new Date(year, month, 1);
  const startOffset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const today = dateISO(new Date());
  const grid = $('calendar-days');
  grid.replaceChildren();

  for (let i = 0; i < cells; i++) {
    const date = new Date(year, month, i - startOffset + 1);
    const iso = dateISO(date);
    const dayEvents = eventsOn(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    if (date.getMonth() !== month) button.classList.add('outside');
    if (iso === today) button.classList.add('today');
    if (iso === state.selectedDate) button.classList.add('selected');
    button.setAttribute('aria-label', `${formatDate(iso)}${dayEvents.length ? `, ${dayEvents.length} event(s)` : ''}`);

    const number = document.createElement('span');
    number.className = 'calendar-day-number';
    number.textContent = String(date.getDate());
    button.append(number);

    if (dayEvents.length) {
      const eventWrap = document.createElement('span');
      eventWrap.className = 'calendar-day-events';

      dayEvents.slice(0, 2).forEach((event) => {
        const chip = document.createElement('span');
        chip.className = 'calendar-day-event';
        chip.style.setProperty('--event-color', event.color);
        chip.textContent = event.title;
        chip.title = event.repeat_yearly ? `${event.title} · Every year` : event.title;
        eventWrap.append(chip);
      });

      if (dayEvents.length > 2) {
        const more = document.createElement('span');
        more.className = 'calendar-day-more';
        more.textContent = `+${dayEvents.length - 2} more`;
        eventWrap.append(more);
      }
      button.append(eventWrap);
    }
    button.addEventListener('click', () => {
      state.selectedDate = iso;
      if (date.getMonth() !== month || date.getFullYear() !== year) {
        state.month = new Date(date.getFullYear(), date.getMonth(), 1);
      }
      renderCalendar();
    });
    grid.append(button);
  }
  renderSelectedDate();
}

function renderSelectedDate() {
  const date = parseDate(state.selectedDate);
  $('calendar-selected-date').textContent = formatDate(state.selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const list = $('calendar-event-list');
  list.replaceChildren();
  const events = eventsOn(date);
  if (!events.length) {
    list.append(makeEmpty('Nothing saved for this day yet.'));
    return;
  }

  for (const event of events) {
    const row = document.createElement('div');
    row.className = 'calendar-event';
    const bar = document.createElement('i');
    bar.className = 'calendar-event-color';
    bar.style.background = event.color;
    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = event.title;
    const description = document.createElement('small');
    description.textContent = event.repeat_yearly
      ? (event.description ? `${event.description} · Every year` : 'Repeats every year')
      : (event.description || 'Saved memory');
    copy.append(title, description);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'calendar-delete';
    remove.setAttribute('aria-label', `Delete ${event.title}`);
    remove.innerHTML = icons.trash;
    remove.addEventListener('click', () => deleteEvent(event));
    row.append(bar, copy, remove);
    list.append(row);
  }
}

async function deleteEvent(event) {
  if (!confirm(`Remove “${event.title}” from the calendar?`)) return;
  const { error } = await sb.from('relationship_events').delete().eq('id', event.id);
  if (error) return toast(`Couldn't remove event: ${error.message}`);
  state.events = state.events.filter((item) => item.id !== event.id);
  renderCalendar();
  renderHome();
  toast('Calendar event removed.');
}

function openEventDialog() {
  $('event-form').reset();
  $('event-date').value = state.selectedDate;
  $('event-color').value = '#ff168f';
  $('event-dialog').showModal();
}

async function saveEvent(event) {
  event.preventDefault();
  const title = $('event-title').value.trim();
  const eventDate = $('event-date').value;
  if (!title || !eventDate || !state.user) return;

  const record = {
    title,
    description: $('event-description').value.trim(),
    event_date: eventDate,
    color: $('event-color').value,
    repeat_yearly: $('event-repeat').checked,
    created_by: state.user.id,
  };
  const { data, error } = await sb.from('relationship_events').insert(record).select().single();
  if (error) return toast(`Couldn't save event: ${error.message}`);
  state.events.push(data);
  state.events.sort((a, b) => a.event_date.localeCompare(b.event_date));
  state.selectedDate = eventDate;
  const date = parseDate(eventDate);
  state.month = new Date(date.getFullYear(), date.getMonth(), 1);
  $('event-dialog').close();
  renderCalendar();
  renderHome();
  toast('Saved to your calendar.');
}

function wireCalendar() {
  $('calendar-prev').addEventListener('click', () => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
    state.selectedDate = dateISO(state.month);
    renderCalendar();
  });
  $('calendar-next').addEventListener('click', () => {
    state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
    state.selectedDate = dateISO(state.month);
    renderCalendar();
  });
  $('calendar-today').addEventListener('click', () => {
    state.month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    state.selectedDate = dateISO(new Date());
    renderCalendar();
  });
  $('calendar-add-event').addEventListener('click', openEventDialog);
  $('home-add-event').addEventListener('click', () => {
    showPage('calendar');
    openEventDialog();
  });
  $('event-close').addEventListener('click', () => $('event-dialog').close());
  $('event-form').addEventListener('submit', saveEvent);
}


/* ----------------------------- Private voice library ----------------------------- */
const VOICE_BUCKET = 'relationship-voice';
const MAX_LIBRARY_VOICE_BYTES = 20 * 1024 * 1024;
const VOICE_MIMES = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/aac': 'aac',
  'audio/x-m4a': 'm4a',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

function voiceFileType(file) {
  const type = (file.type || '').split(';')[0].trim().toLowerCase();
  if (VOICE_MIMES[type]) return { type, ext: VOICE_MIMES[type] };
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const byExt = {
    webm: ['audio/webm','webm'], ogg: ['audio/ogg','ogg'], opus: ['audio/ogg','ogg'],
    m4a: ['audio/mp4','m4a'], mp4: ['audio/mp4','mp4'], mp3: ['audio/mpeg','mp3'],
    aac: ['audio/aac','aac'], wav: ['audio/wav','wav'], flac: ['audio/flac','flac'],
  };
  const result = byExt[ext];
  return result ? { type: result[0], ext: result[1] } : null;
}

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    let settled = false;
    const finish = (duration) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : 0);
    };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () => finish(audio.duration), { once: true });
    audio.addEventListener('error', () => finish(0), { once: true });
    audio.src = url;
  });
}

function formatVoiceDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

async function loadVoices() {
  if (!state.user) return;
  const { data, error } = await sb.from('relationship_voice_records').select('*')
    .order('voice_date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    toast(`Voice library: ${error.message}`);
    return;
  }

  state.voices = data || [];
  state.voiceUrls.clear();
  if (state.voices.length) {
    const { data: signed, error: signedError } = await sb.storage.from(VOICE_BUCKET)
      .createSignedUrls(state.voices.map((voice) => voice.storage_path), 3600);
    if (signedError) {
      toast(`Couldn't open saved voices: ${signedError.message}`);
    } else {
      for (const item of signed || []) {
        if (item.signedUrl) state.voiceUrls.set(item.path, item.signedUrl);
      }
    }
  }
  populateVoiceYears();
  renderVoices();
}

function populateVoiceYears() {
  const select = $('voice-year');
  const selected = select.value;
  const years = [...new Set(state.voices.map((voice) => Number(voice.voice_date.slice(0, 4))))]
    .sort((a, b) => b - a);
  select.replaceChildren(new Option('All years', ''));
  years.forEach((year) => select.add(new Option(String(year), String(year))));
  if (years.includes(Number(selected))) select.value = selected;
}

function filteredVoices() {
  const query = $('voice-search').value.trim().toLowerCase();
  const year = $('voice-year').value;
  const month = $('voice-month').value;
  return state.voices.filter((voice) =>
    (!query || voice.title.toLowerCase().includes(query) || voice.voice_date.includes(query)) &&
    (!year || voice.voice_date.startsWith(`${year}-`)) &&
    (!month || voice.voice_date.slice(5, 7) === month)
  );
}

function renderVoices() {
  const grid = $('voice-grid');
  if (!grid) return;
  const voices = filteredVoices();
  $('voice-count').textContent = `${voices.length} ${voices.length === 1 ? 'recording' : 'recordings'}`;
  grid.replaceChildren();

  if (!voices.length) {
    grid.append(makeEmpty(state.voices.length
      ? 'No recordings match these filters.'
      : 'Your voice library is waiting for its first recording.'));
    return;
  }

  for (const voice of voices) {
    const card = document.createElement('article');
    card.className = 'voice-library-card';

    const top = document.createElement('div');
    top.className = 'voice-library-top';
    const info = document.createElement('div');
    info.className = 'voice-library-copy';
    const title = document.createElement('strong');
    title.textContent = voice.title;
    const meta = document.createElement('span');
    meta.textContent = `${formatDate(voice.voice_date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${formatVoiceDuration(voice.duration_seconds)} · ${state.names.get(voice.uploaded_by) || 'One of you'}`;
    info.append(title, meta);
    top.append(info);

    if (voice.uploaded_by === state.user.id) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'voice-library-delete';
      remove.setAttribute('aria-label', `Delete ${voice.title}`);
      remove.innerHTML = icons.trash;
      remove.addEventListener('click', () => deleteVoiceRecord(voice));
      top.append(remove);
    }

    const player = document.createElement('audio');
    player.className = 'voice-library-player';
    player.controls = true;
    player.preload = 'none';
    player.src = state.voiceUrls.get(voice.storage_path) || '';
    player.setAttribute('aria-label', `Play ${voice.title}`);

    card.append(top, player);
    grid.append(card);
  }
}

async function deleteVoiceRecord(voice) {
  if (!confirm('Delete this recording from your shared voice library?')) return;
  const { error: rowError } = await sb.from('relationship_voice_records').delete().eq('id', voice.id);
  if (rowError) return toast(`Couldn't remove recording: ${rowError.message}`);
  const { error: fileError } = await sb.storage.from(VOICE_BUCKET).remove([voice.storage_path]);
  state.voices = state.voices.filter((item) => item.id !== voice.id);
  state.voiceUrls.delete(voice.storage_path);
  populateVoiceYears();
  renderVoices();
  if (fileError) toast('The library entry was removed, but its stored audio file could not be cleaned up.');
  else toast('Recording removed from your shared library.');
}

async function uploadVoiceFiles() {
  const input = $('voice-file');
  const files = [...(input.files || [])];
  if (!files.length || !state.user) return;
  const date = $('voice-date').value || dateISO(new Date());
  const baseTitle = $('voice-title').value.trim();
  const button = $('voice-upload');
  button.disabled = true;
  button.textContent = 'Saving…';
  let saved = 0;

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const typeInfo = voiceFileType(file);
    if (!typeInfo) {
      toast(`${file.name}: use WEBM, OGG, M4A, MP3, AAC, WAV, or FLAC.`);
      continue;
    }
    if (file.size > MAX_LIBRARY_VOICE_BYTES) {
      toast(`${file.name}: maximum size is 20 MB.`);
      continue;
    }

    const duration = await getAudioDuration(file);
    const cleanName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    const title = (baseTitle
      ? (files.length > 1 ? `${baseTitle} · ${index + 1}` : baseTitle)
      : cleanName || 'Voice recording').slice(0, 120);
    const path = `${state.user.id}/upload-${crypto.randomUUID()}.${typeInfo.ext}`;

    const { error: uploadError } = await sb.storage.from(VOICE_BUCKET).upload(path, file, {
      contentType: typeInfo.type,
      cacheControl: '3600',
      upsert: false,
    });
    if (uploadError) {
      toast(`Couldn't upload ${file.name}: ${uploadError.message}`);
      continue;
    }

    const { error: rowError } = await sb.from('relationship_voice_records').insert({
      storage_path: path,
      title,
      voice_date: date,
      duration_seconds: duration,
      uploaded_by: state.user.id,
    });
    if (rowError) {
      await sb.storage.from(VOICE_BUCKET).remove([path]);
      toast(`Couldn't save ${file.name}: ${rowError.message}`);
      continue;
    }
    saved += 1;
  }

  input.value = '';
  $('voice-file-count').textContent = 'No recordings selected';
  button.disabled = true;
  button.textContent = 'Save recordings';
  if (saved) {
    $('voice-title').value = '';
    await loadVoices();
    toast(`${saved} ${saved === 1 ? 'recording' : 'recordings'} saved to your shared voice library.`);
  }
}

function wireVoices() {
  $('voice-select').addEventListener('click', () => $('voice-file').click());
  $('voice-file').addEventListener('change', () => {
    const files = [...$('voice-file').files];
    $('voice-file-count').textContent = files.length
      ? `${files.length} ${files.length === 1 ? 'recording selected' : 'recordings selected'}`
      : 'No recordings selected';
    $('voice-upload').disabled = !files.length;
  });
  $('voice-upload').addEventListener('click', uploadVoiceFiles);
  $('voice-search').addEventListener('input', renderVoices);
  $('voice-year').addEventListener('change', renderVoices);
  $('voice-month').addEventListener('change', renderVoices);
}

/* ----------------------------- Shared to-do list ----------------------------- */
function taskNode(task) {
  const row = document.createElement('div');
  row.className = `task-row${task.done ? ' done' : ''}`;
  const check = document.createElement('button');
  check.type = 'button';
  check.className = 'task-check';
  check.setAttribute('aria-label', task.done ? 'Mark as not done' : 'Mark as done');
  check.innerHTML = icons.check;
  check.addEventListener('click', () => toggleTask(task));

  const copy = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'task-row-title';
  title.textContent = task.title;
  const meta = document.createElement('small');
  meta.textContent = `Added ${formatDate(task.created_at.slice(0, 10), { day: 'numeric', month: 'short' })}`;
  copy.append(title, meta);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'task-delete';
  remove.setAttribute('aria-label', `Delete ${task.title}`);
  remove.innerHTML = icons.trash;
  remove.addEventListener('click', () => deleteTask(task));
  row.append(check, copy, remove);
  return row;
}

function renderTasks() {
  if (!$('task-list')) return;
  const active = state.tasks.filter((task) => !task.done);
  const completed = state.tasks.filter((task) => task.done);
  $('task-count-all').textContent = String(state.tasks.length);
  $('task-count-open').textContent = String(active.length);
  $('task-count-done').textContent = String(completed.length);
  $('task-list').replaceChildren();
  $('completed-task-list').replaceChildren();

  if (!active.length) $('task-list').append(makeEmpty('Nothing waiting right now. Add a little plan above.'));
  else active.forEach((task) => $('task-list').append(taskNode(task)));

  if (!completed.length) $('completed-task-list').append(makeEmpty('Your finished plans will stay here.'));
  else completed.forEach((task) => $('completed-task-list').append(taskNode(task)));
  renderHome();
}

async function addTask(event) {
  event.preventDefault();
  const input = $('task-title');
  const title = input.value.trim();
  if (!title || !state.user) return;
  const { data, error } = await sb.from('relationship_tasks')
    .insert({ title, created_by: state.user.id })
    .select()
    .single();
  if (error) return toast(`Couldn't add task: ${error.message}`);
  state.tasks.unshift(data);
  input.value = '';
  renderTasks();
  toast('Added to your list.');
}

async function toggleTask(task) {
  const done = !task.done;
  const { data, error } = await sb.from('relationship_tasks')
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq('id', task.id)
    .select()
    .single();
  if (error) return toast(`Couldn't update task: ${error.message}`);
  state.tasks = state.tasks.map((item) => item.id === task.id ? data : item);
  state.tasks.sort((a, b) => Number(a.done) - Number(b.done) || b.created_at.localeCompare(a.created_at));
  renderTasks();
}

async function deleteTask(task) {
  const { error } = await sb.from('relationship_tasks').delete().eq('id', task.id);
  if (error) return toast(`Couldn't delete task: ${error.message}`);
  state.tasks = state.tasks.filter((item) => item.id !== task.id);
  renderTasks();
  toast('Task removed.');
}

function wireTasks() {
  $('task-form').addEventListener('submit', addTask);
}

/* ----------------------------- Private photo gallery ----------------------------- */
function populateGalleryYears() {
  const select = $('gallery-year');
  const selected = select.value;
  const years = [...new Set(state.photos.map((photo) => Number(photo.photo_date.slice(0, 4))))].sort((a, b) => b - a);
  select.replaceChildren(new Option('All years', ''));
  for (const year of years) select.add(new Option(String(year), String(year)));
  if (years.includes(Number(selected))) select.value = selected;
}

function filteredPhotos() {
  const query = $('gallery-search').value.trim().toLowerCase();
  const year = $('gallery-year').value;
  const month = $('gallery-month').value;
  return state.photos.filter((photo) => {
    const matchesQuery = !query || photo.caption.toLowerCase().includes(query) || photo.photo_date.includes(query);
    const matchesYear = !year || photo.photo_date.startsWith(`${year}-`);
    const matchesMonth = !month || photo.photo_date.slice(5, 7) === month;
    return matchesQuery && matchesYear && matchesMonth;
  });
}

async function loadPhotos() {
  if (!state.user || state.loadingPhotos) return;
  state.loadingPhotos = true;
  const { data, error } = await sb.from('relationship_photos').select('*')
    .order('photo_date', { ascending: false }).order('created_at', { ascending: false });
  state.loadingPhotos = false;
  if (error) {
    toast(`Couldn't load gallery: ${error.message}`);
    return;
  }
  state.photos = data || [];
  state.signedUrls.clear();
  populateGalleryYears();
  await renderGallery();
}

async function renderGallery() {
  if (!$('gallery-grid')) return;
  const grid = $('gallery-grid');
  const photos = filteredPhotos();
  $('gallery-count').textContent = `${photos.length} ${photos.length === 1 ? 'photo' : 'photos'}`;

  grid.replaceChildren();
  if (!photos.length) {
    grid.append(makeEmpty(state.photos.length ? 'No photos match these filters.' : 'Your gallery is waiting for its first photo.'));
    return;
  }

  const { data: signed, error } = await sb.storage.from(BUCKET)
    .createSignedUrls(photos.map((photo) => photo.storage_path), 3600);
  if (error) {
    grid.append(makeEmpty(`Photos couldn't be opened: ${error.message}`));
    return;
  }
  const urlMap = new Map((signed || []).map((item) => [item.path, item.signedUrl]));
  state.signedUrls = urlMap;

  for (const photo of photos) {
    const url = urlMap.get(photo.storage_path);
    if (!url) continue;
    const card = document.createElement('article');
    card.className = 'gallery-item';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'gallery-photo-button';
    open.setAttribute('aria-label', `Open photo from ${formatDate(photo.photo_date)}`);
    const img = new Image();
    img.src = url;
    img.alt = photo.caption || `Photo from ${formatDate(photo.photo_date)}`;
    img.loading = 'lazy';
    open.append(img);
    open.addEventListener('click', () => openGalleryPhoto(url, photo));

    const meta = document.createElement('div');
    meta.className = 'gallery-photo-meta';
    const copy = document.createElement('div');
    copy.className = 'gallery-photo-copy';
    const caption = document.createElement('strong');
    caption.textContent = photo.caption || 'A saved moment';
    const detail = document.createElement('span');
    detail.textContent = `${formatDate(photo.photo_date, { day: 'numeric', month: 'short', year: 'numeric' })} · ${state.names.get(photo.uploaded_by) || 'One of you'}`;
    copy.append(caption, detail);
    meta.append(copy);

    if (photo.uploaded_by === state.user.id) {
      const actions = document.createElement('div');
      actions.className = 'gallery-photo-actions';

      const edit = document.createElement('button');
      edit.type = 'button';
      edit.className = 'gallery-edit';
      edit.setAttribute('aria-label', 'Edit photo caption');
      edit.title = 'Edit caption';
      edit.innerHTML = icons.edit;
      edit.addEventListener('click', () => openCaptionEditor(photo));

      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'gallery-remove';
      remove.setAttribute('aria-label', 'Delete this photo');
      remove.innerHTML = icons.trash;
      remove.addEventListener('click', () => deletePhoto(photo));

      actions.append(edit, remove);
      meta.append(actions);
    }

    card.append(open, meta);
    grid.append(card);
  }
}


function openCaptionEditor(photo) {
  state.editingPhotoId = photo.id;
  $('gallery-caption-input').value = photo.caption || '';
  $('gallery-caption-dialog').showModal();
  $('gallery-caption-input').focus();
}

async function savePhotoCaption(event) {
  event.preventDefault();
  if (!state.editingPhotoId) return;
  const caption = $('gallery-caption-input').value.trim();
  const photoId = state.editingPhotoId;
  const { data, error } = await sb.from('relationship_photos')
    .update({ caption })
    .eq('id', photoId)
    .select()
    .single();

  if (error) {
    toast(`Couldn't update caption: ${error.message}`);
    return;
  }

  state.photos = state.photos.map((photo) => photo.id === photoId ? data : photo);
  state.editingPhotoId = null;
  $('gallery-caption-dialog').close();
  populateGalleryYears();
  renderGallery();
  if (state.page === 'timeline') await loadTimeline();
  toast('Photo caption updated.');
}

function openGalleryPhoto(url, photo) {
  $('gallery-lightbox-image').src = url;
  $('gallery-lightbox-caption').textContent = [
    photo.caption || 'A saved moment',
    formatDate(photo.photo_date, { day: 'numeric', month: 'long', year: 'numeric' }),
  ].join(' · ');
  $('gallery-lightbox').showModal();
}

async function deletePhoto(photo) {
  if (!confirm('Delete this photo from your shared gallery?')) return;
  const { error: storageError } = await sb.storage.from(BUCKET).remove([photo.storage_path]);
  if (storageError) return toast(`Couldn't remove photo file: ${storageError.message}`);
  const { error } = await sb.from('relationship_photos').delete().eq('id', photo.id);
  if (error) return toast(`File removed, but its gallery entry couldn't be deleted: ${error.message}`);
  state.photos = state.photos.filter((item) => item.id !== photo.id);
  populateGalleryYears();
  renderGallery();
  toast('Photo deleted.');
}

async function uploadPhotos() {
  const input = $('gallery-file');
  const files = [...(input.files || [])];
  if (!files.length || !state.user) return;
  const caption = $('gallery-caption').value.trim();
  const photoDate = $('gallery-date').value || dateISO(new Date());
  const button = $('gallery-upload');
  button.disabled = true;
  button.textContent = 'Saving…';
  let saved = 0;

  for (const file of files) {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      toast(`${file.name}: use JPG, PNG, WEBP, or GIF.`);
      continue;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast(`${file.name}: maximum size is 12 MB.`);
      continue;
    }

    const extension = file.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const unique = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const path = `${state.user.id}/${unique}.${extension}`;
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });
    if (uploadError) {
      toast(`Couldn't upload ${file.name}: ${uploadError.message}`);
      continue;
    }

    const { error: rowError } = await sb.from('relationship_photos').insert({
      storage_path: path,
      caption,
      photo_date: photoDate,
      uploaded_by: state.user.id,
    });
    if (rowError) {
      await sb.storage.from(BUCKET).remove([path]);
      toast(`Couldn't save ${file.name}: ${rowError.message}`);
      continue;
    }
    saved += 1;
  }

  input.value = '';
  $('gallery-file-count').textContent = 'No photos selected';
  button.disabled = true;
  button.textContent = 'Save to gallery';
  if (saved) {
    $('gallery-caption').value = '';
    await loadPhotos();
    toast(`${saved} ${saved === 1 ? 'photo' : 'photos'} saved in your private gallery.`);
  }
}

function wireGallery() {
  $('gallery-select').addEventListener('click', () => $('gallery-file').click());
  $('gallery-file').addEventListener('change', () => {
    const files = [...$('gallery-file').files];
    $('gallery-file-count').textContent = files.length
      ? `${files.length} ${files.length === 1 ? 'photo selected' : 'photos selected'}`
      : 'No photos selected';
    $('gallery-upload').disabled = !files.length;
  });
  $('gallery-upload').addEventListener('click', uploadPhotos);
  $('gallery-caption-form').addEventListener('submit', savePhotoCaption);
  $('gallery-caption-cancel').addEventListener('click', () => {
    state.editingPhotoId = null;
    $('gallery-caption-dialog').close();
  });
  $('gallery-caption-dialog').addEventListener('close', () => { state.editingPhotoId = null; });
  $('gallery-search').addEventListener('input', renderGallery);
  $('gallery-year').addEventListener('change', renderGallery);
  $('gallery-month').addEventListener('change', renderGallery);
  $('gallery-lightbox-close').addEventListener('click', () => $('gallery-lightbox').close());
  $('gallery-lightbox').addEventListener('click', (event) => {
    if (event.target === $('gallery-lightbox')) $('gallery-lightbox').close();
  });
}


/* ----------------------------- Our timeline ----------------------------- */
async function loadTimeline() {
  if (!state.user) return;

  const [milestonesResult, photosResult] = await Promise.all([
    sb.from('relationship_timeline_entries').select('*')
      .order('milestone_date', { ascending: false }).limit(100),
    sb.from('relationship_photos').select('*')
      .order('photo_date', { ascending: false }).order('created_at', { ascending: false }).limit(40),
  ]);

  if (milestonesResult.error) {
    toast(`Timeline: ${milestonesResult.error.message}`);
    state.milestones = [];
  } else {
    state.milestones = milestonesResult.data || [];
  }

  if (photosResult.error) {
    toast(`Timeline photos: ${photosResult.error.message}`);
    state.timelineItems = [];
    renderTimeline();
    return;
  }

  const photos = photosResult.data || [];
  let urlMap = new Map();
  if (photos.length) {
    const { data: signed, error } = await sb.storage.from(BUCKET)
      .createSignedUrls(photos.map((photo) => photo.storage_path), 3600);
    if (!error) urlMap = new Map((signed || []).map((entry) => [entry.path, entry.signedUrl]));
  }

  const items = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const event of state.events) {
    const date = event.repeat_yearly
      ? nextOccurrence(event, today)
      : parseDate(event.event_date);
    if (!date) continue;
    items.push({
      id: `event:${event.id}`,
      type: 'event',
      date: dateISO(date),
      title: event.title,
      description: event.description || (event.repeat_yearly ? 'A date that comes around every year.' : ''),
      color: event.color || '#1478ff',
      repeat: Boolean(event.repeat_yearly),
      author: 'Shared calendar',
    });
  }

  for (const milestone of state.milestones) {
    items.push({
      id: `milestone:${milestone.id}`,
      type: 'milestone',
      date: milestone.milestone_date,
      title: milestone.title,
      description: milestone.description || '',
      color: milestone.color || '#ff168f',
      author: state.names.get(milestone.created_by) || 'One of you',
      createdBy: milestone.created_by,
    });
  }

  for (const photo of photos) {
    const url = urlMap.get(photo.storage_path);
    if (!url) continue;
    items.push({
      id: `photo:${photo.id}`,
      type: 'photo',
      date: photo.photo_date,
      title: photo.caption || 'A saved moment',
      description: '',
      color: '#1478ff',
      author: state.names.get(photo.uploaded_by) || 'One of you',
      url,
      photo,
    });
  }

  state.timelineItems = items.sort((a, b) =>
    b.date.localeCompare(a.date) || a.title.localeCompare(b.title)
  );
  renderTimeline();
}

function renderTimeline() {
  const feed = $('timeline-feed');
  if (!feed) return;

  const type = $('timeline-kind')?.value || 'all';
  const year = $('timeline-year')?.value || '';
  const years = [...new Set(state.timelineItems.map((item) => item.date.slice(0, 4)))].sort().reverse();
  const yearSelect = $('timeline-year');
  const previousYear = yearSelect.value;
  yearSelect.replaceChildren(new Option('All years', ''));
  years.forEach((value) => yearSelect.add(new Option(value, value)));
  if (years.includes(previousYear)) yearSelect.value = previousYear;

  const items = state.timelineItems.filter((item) =>
    (type === 'all' || item.type === type) &&
    (!year || item.date.startsWith(`${year}-`))
  );

  $('timeline-count').textContent = `${items.length} ${items.length === 1 ? 'moment' : 'moments'}`;
  feed.replaceChildren();

  if (!items.length) {
    feed.append(makeEmpty('Your story will appear here as you save photos, dates, and milestones.'));
    return;
  }

  for (const item of items) {
    const card = document.createElement('article');
    card.className = `timeline-item timeline-${item.type}`;
    card.style.setProperty('--timeline-color', item.color);

    const marker = document.createElement('span');
    marker.className = 'timeline-marker';
    marker.setAttribute('aria-hidden', 'true');

    const body = document.createElement('div');
    body.className = 'timeline-card';

    const meta = document.createElement('div');
    meta.className = 'timeline-meta';
    const kind = document.createElement('span');
    kind.className = 'timeline-kind';
    kind.textContent = item.type === 'event' ? 'CALENDAR DATE' : item.type === 'photo' ? 'PHOTO MEMORY' : 'MILESTONE';
    const date = document.createElement('time');
    date.dateTime = item.date;
    date.textContent = formatDate(item.date, { day: 'numeric', month: 'long', year: 'numeric' });
    meta.append(kind, date);

    const heading = document.createElement('h3');
    heading.textContent = item.title;
    body.append(meta, heading);

    if (item.type === 'photo' && item.url) {
      const imageButton = document.createElement('button');
      imageButton.type = 'button';
      imageButton.className = 'timeline-photo-button';
      imageButton.setAttribute('aria-label', `Open ${item.title}`);
      const image = new Image();
      image.src = item.url;
      image.alt = item.title;
      image.loading = 'lazy';
      imageButton.append(image);
      imageButton.addEventListener('click', () => openGalleryPhoto(item.url, item.photo));
      body.append(imageButton);
    }

    if (item.description) {
      const description = document.createElement('p');
      description.textContent = item.description;
      body.append(description);
    }

    const footer = document.createElement('div');
    footer.className = 'timeline-footer';
    const author = document.createElement('span');
    author.textContent = item.repeat ? 'Repeats every year' : item.author;
    footer.append(author);

    if (item.type === 'milestone' && item.createdBy === state.user.id) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'timeline-remove';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => deleteMilestone(item.id.slice('milestone:'.length)));
      footer.append(remove);
    }
    body.append(footer);
    card.append(marker, body);
    feed.append(card);
  }
}

async function deleteMilestone(id) {
  if (!confirm('Remove this milestone from your shared timeline?')) return;
  const { error } = await sb.from('relationship_timeline_entries').delete().eq('id', id);
  if (error) return toast(`Couldn't remove milestone: ${error.message}`);
  state.milestones = state.milestones.filter((item) => item.id !== id);
  await loadTimeline();
  toast('Milestone removed.');
}

function openMilestoneDialog() {
  $('timeline-form').reset();
  $('milestone-date').value = dateISO(new Date());
  $('milestone-color').value = '#ff168f';
  $('timeline-dialog').showModal();
}

async function saveMilestone(event) {
  event.preventDefault();
  const title = $('milestone-title').value.trim();
  const date = $('milestone-date').value;
  if (!title || !date || !state.user) return;

  const { error } = await sb.from('relationship_timeline_entries').insert({
    title,
    description: $('milestone-description').value.trim(),
    milestone_date: date,
    color: $('milestone-color').value,
    created_by: state.user.id,
  });
  if (error) return toast(`Couldn't save milestone: ${error.message}`);
  $('timeline-dialog').close();
  await loadTimeline();
  toast('Milestone added to your story.');
}

function wireTimeline() {
  $('timeline-add').addEventListener('click', openMilestoneDialog);
  $('timeline-dialog-close').addEventListener('click', () => $('timeline-dialog').close());
  $('timeline-form').addEventListener('submit', saveMilestone);
  $('timeline-kind').addEventListener('change', renderTimeline);
  $('timeline-year').addEventListener('change', renderTimeline);
}

/* ----------------------------- Date night jar ----------------------------- */
async function loadDateIdeas() {
  if (!state.user) return;
  const { data, error } = await sb.from('relationship_date_ideas')
    .select('*').order('category', { ascending: true }).order('created_at', { ascending: false });
  if (error) {
    toast(`Date jar: ${error.message}`);
    return;
  }
  state.ideas = data || [];
  // Always reflect the most recent shared draw, including draws made by the other account.
  const recent = [...state.ideas]
    .filter((idea) => idea.last_picked_at)
    .sort((a, b) => b.last_picked_at.localeCompare(a.last_picked_at))[0];
  state.selectedIdeaId = recent?.id || null;
  renderDateIdeas();
}

function renderDateIdeas() {
  const list = $('date-idea-list');
  if (!list) return;
  list.replaceChildren();

  const selected = state.ideas.find((idea) => idea.id === state.selectedIdeaId) ||
    [...state.ideas].filter((idea) => idea.last_picked_at)
      .sort((a, b) => b.last_picked_at.localeCompare(a.last_picked_at))[0] || null;

  const pickedCard = $('date-picked');
  pickedCard.replaceChildren();
  if (selected) {
    const label = document.createElement('span');
    label.className = 'date-picked-label';
    label.textContent = 'THE JAR PICKED';
    const title = document.createElement('h2');
    title.textContent = selected.title;
    const description = document.createElement('p');
    description.textContent = selected.description || 'A little plan, just waiting to happen.';
    const category = document.createElement('span');
    category.className = 'date-category';
    category.textContent = selected.category;
    pickedCard.append(label, title, description, category);
  } else {
    pickedCard.append(makeEmpty('Add a few ideas, then let the jar surprise you.'));
  }

  $('date-idea-count').textContent = `${state.ideas.length} ${state.ideas.length === 1 ? 'idea' : 'ideas'} in the jar`;

  for (const idea of state.ideas) {
    const row = document.createElement('article');
    row.className = 'date-idea-row';
    const copy = document.createElement('div');
    copy.className = 'date-idea-copy';
    const title = document.createElement('strong');
    title.textContent = idea.title;
    const detail = document.createElement('span');
    detail.textContent = `${idea.category}${idea.last_picked_at ? ` · Picked ${formatDate(idea.last_picked_at.slice(0, 10), { day: 'numeric', month: 'short' })}` : ' · Not picked yet'}`;
    copy.append(title, detail);
    row.append(copy);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'date-idea-remove';
    remove.setAttribute('aria-label', `Remove ${idea.title} from the shared jar`);
    remove.title = 'Remove from the shared jar';
    remove.innerHTML = icons.trash;
    remove.addEventListener('click', () => deleteDateIdea(idea.id));
    row.append(remove);
    list.append(row);
  }

  if (!state.ideas.length) list.append(makeEmpty('The jar is empty. Add the first idea.'));
}

async function pickDateIdea() {
  if (!state.ideas.length) return toast('Add an idea to the jar first.');
  const unpicked = state.ideas.filter((idea) => !idea.last_picked_at);
  let pool = unpicked;
  if (!pool.length) {
    const oldestTime = Math.min(...state.ideas.map((idea) => new Date(idea.last_picked_at).getTime()));
    pool = state.ideas.filter((idea) => new Date(idea.last_picked_at).getTime() === oldestTime);
  }

  const selected = pool[Math.floor(Math.random() * pool.length)];
  const pickedAt = new Date().toISOString();
  const { error } = await sb.from('relationship_date_ideas')
    .update({ last_picked_at: pickedAt }).eq('id', selected.id);
  if (error) return toast(`Couldn't draw an idea: ${error.message}`);

  state.ideas = state.ideas.map((idea) =>
    idea.id === selected.id ? { ...idea, last_picked_at: pickedAt } : idea
  );
  state.selectedIdeaId = selected.id;
  renderDateIdeas();
}

async function addDateIdea(event) {
  event.preventDefault();
  const title = $('date-idea-title').value.trim();
  if (!title || !state.user) return;
  const { data, error } = await sb.from('relationship_date_ideas').insert({
    title,
    description: $('date-idea-description').value.trim(),
    category: $('date-idea-category').value,
    created_by: state.user.id,
  }).select().single();

  if (error) {
    const duplicate = /duplicate key/i.test(error.message);
    return toast(duplicate ? 'That idea is already in your jar.' : `Couldn't add idea: ${error.message}`);
  }

  state.ideas.unshift(data);
  state.selectedIdeaId = null;
  $('date-idea-form').reset();
  renderDateIdeas();
  toast('Added to your date jar.');
}

async function deleteDateIdea(id) {
  if (!confirm('Remove this idea from the shared jar?')) return;
  const { error } = await sb.from('relationship_date_ideas').delete().eq('id', id);
  if (error) return toast(`Couldn't remove idea: ${error.message}`);
  state.ideas = state.ideas.filter((idea) => idea.id !== id);
  if (state.selectedIdeaId === id) state.selectedIdeaId = null;
  renderDateIdeas();
}

function wireDateJar() {
  $('date-pick').addEventListener('click', pickDateIdea);
  $('date-idea-form').addEventListener('submit', addDateIdea);
}

/* ----------------------------- Daily check-in ----------------------------- */
const MOODS = {
  great: { emoji: '🌞', label: 'Great' },
  good: { emoji: '😊', label: 'Good' },
  okay: { emoji: '😐', label: 'Okay' },
  tired: { emoji: '😴', label: 'Tired' },
  quiet: { emoji: '🤍', label: 'Need a quiet day' },
};

async function loadCheckins() {
  if (!state.user) return;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const today = dateISO(new Date());
  const { data, error } = await sb.from('relationship_daily_checkins').select('*')
    .gte('checkin_date', dateISO(start)).lte('checkin_date', today)
    .order('checkin_date', { ascending: false }).order('updated_at', { ascending: false });
  if (error) {
    toast(`Daily check-in: ${error.message}`);
    return;
  }

  state.checkins = data || [];
  const own = state.checkins.find((entry) => entry.user_id === state.user.id && entry.checkin_date === today);
  const noteField = $('checkin-note');
  const editing = document.activeElement === noteField ||
    Boolean(document.activeElement?.matches?.('[data-mood]'));
  if (!editing) {
    state.selectedMood = own?.mood || 'good';
    noteField.value = own?.note || '';
  }
  $('checkin-date-label').textContent = formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' });
  renderCheckins();
}

function renderCheckins() {
  const today = dateISO(new Date());
  const todayRows = state.checkins.filter((entry) => entry.checkin_date === today);
  const partnerGrid = $('checkin-people');
  partnerGrid.replaceChildren();

  for (const [userId, name] of state.names.entries()) {
    const entry = todayRows.find((item) => item.user_id === userId);
    const card = document.createElement('article');
    card.className = 'checkin-person-card';
    const nameNode = document.createElement('strong');
    nameNode.textContent = userId === state.user.id ? `${name} · You` : name;
    const moodNode = document.createElement('div');
    moodNode.className = 'checkin-person-mood';

    if (entry) {
      const mood = MOODS[entry.mood] || MOODS.okay;
      moodNode.textContent = `${mood.emoji} ${mood.label}`;
      const note = document.createElement('p');
      note.textContent = entry.note || 'No note today — just checking in.';
      card.append(nameNode, moodNode, note);
      const updated = document.createElement('small');
      updated.textContent = `Shared ${new Date(entry.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      card.append(updated);
    } else {
      moodNode.textContent = '🤍 Not checked in yet';
      const pending = document.createElement('p');
      pending.textContent = userId === state.user.id ? 'Your check-in is ready when you are.' : 'Their update will appear here.';
      card.append(nameNode, moodNode, pending);
    }
    partnerGrid.append(card);
  }

  document.querySelectorAll('[data-mood]').forEach((button) => {
    const active = button.dataset.mood === state.selectedMood;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });

  const history = $('checkin-history');
  history.replaceChildren();
  const older = state.checkins.filter((entry) => entry.checkin_date !== today);
  if (!older.length) {
    history.append(makeEmpty('Your recent check-ins will collect here day by day.'));
  } else {
    for (const entry of older) {
      const row = document.createElement('article');
      row.className = 'checkin-history-row';
      const mood = MOODS[entry.mood] || MOODS.okay;
      const title = document.createElement('strong');
      title.textContent = `${formatDate(entry.checkin_date, { day: 'numeric', month: 'short' })} · ${state.names.get(entry.user_id) || 'One of you'}`;
      const detail = document.createElement('span');
      detail.textContent = `${mood.emoji} ${mood.label}${entry.note ? ` · ${entry.note}` : ''}`;
      row.append(title, detail);
      history.append(row);
    }
  }
}

async function saveCheckin() {
  if (!state.user) return;
  const today = dateISO(new Date());
  const { data, error } = await sb.from('relationship_daily_checkins').upsert({
    user_id: state.user.id,
    checkin_date: today,
    mood: state.selectedMood,
    note: $('checkin-note').value.trim(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,checkin_date' }).select().single();

  if (error) return toast(`Couldn't save check-in: ${error.message}`);
  state.checkins = [
    data,
    ...state.checkins.filter((entry) => !(entry.user_id === data.user_id && entry.checkin_date === data.checkin_date)),
  ];
  renderCheckins();
  toast('Your check-in is shared.');
}

function wireCheckins() {
  document.querySelectorAll('[data-mood]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedMood = button.dataset.mood;
      renderCheckins();
    });
  });
  $('checkin-save').addEventListener('click', saveCheckin);
}

/* ----------------------------- Shared notes ----------------------------- */
async function loadNotes() {
  if (!state.user) return;
  const { data, error } = await sb.from('relationship_notes').select('*')
    .order('updated_at', { ascending: false });
  if (error) {
    toast(`Shared notes: ${error.message}`);
    return;
  }
  state.notes = data || [];
  renderNotes();
}

function renderNotes() {
  const list = $('notes-list');
  if (!list) return;
  list.replaceChildren();
  if (!state.notes.length) {
    list.append(makeEmpty('Your shared notebook is empty. Add your first note.'));
    return;
  }

  for (const note of state.notes) {
    const card = document.createElement('article');
    card.className = 'shared-note-card';
    const head = document.createElement('div');
    head.className = 'shared-note-head';
    const copy = document.createElement('div');
    copy.className = 'shared-note-copy';
    const title = document.createElement('h3');
    title.textContent = note.title;
    const meta = document.createElement('span');
    meta.className = 'shared-note-meta';
    const editorName = state.names.get(note.updated_by) || 'One of you';
    const updated = new Date(note.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    meta.textContent = `Updated by ${editorName} · ${updated}`;
    copy.append(title, meta);
    const actions = document.createElement('div');
    actions.className = 'shared-note-actions';
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'space-button secondary';
    edit.textContent = 'Edit';
    edit.addEventListener('click', () => openNoteEditor(note));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'space-button danger';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => deleteNote(note.id));
    actions.append(edit, remove);
    head.append(copy, actions);
    const content = document.createElement('p');
    content.className = 'shared-note-content';
    content.textContent = note.content || 'This note is empty.';
    card.append(head, content);
    list.append(card);
  }
}

function openNoteEditor(note = null) {
  state.editingNoteId = note?.id || null;
  $('note-dialog-title').textContent = note ? 'Edit shared note' : 'New shared note';
  $('note-title').value = note?.title || '';
  $('note-content').value = note?.content || '';
  $('note-dialog').showModal();
  $('note-title').focus();
}

async function saveNote(event) {
  event.preventDefault();
  if (!state.user) return;
  const title = $('note-title').value.trim();
  const content = $('note-content').value;
  if (!title) return;
  const now = new Date().toISOString();
  const payload = { title, content, updated_by: state.user.id, updated_at: now };

  let result;
  if (state.editingNoteId) {
    result = await sb.from('relationship_notes').update(payload)
      .eq('id', state.editingNoteId).select().single();
  } else {
    result = await sb.from('relationship_notes').insert({
      ...payload,
      created_by: state.user.id,
      created_at: now,
    }).select().single();
  }
  if (result.error) {
    toast(`Couldn't save note: ${result.error.message}`);
    return;
  }
  const note = result.data;
  state.notes = [note, ...state.notes.filter((item) => item.id !== note.id)]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  $('note-dialog').close();
  state.editingNoteId = null;
  renderNotes();
  toast('Shared note saved.');
}

async function deleteNote(id) {
  const note = state.notes.find((item) => item.id === id);
  if (!note || !confirm(`Delete "${note.title}" from the shared notebook?`)) return;
  const { error } = await sb.from('relationship_notes').delete().eq('id', id);
  if (error) return toast(`Couldn't delete note: ${error.message}`);
  state.notes = state.notes.filter((item) => item.id !== id);
  renderNotes();
  toast('Shared note deleted.');
}

function wireNotes() {
  $('note-add').addEventListener('click', () => openNoteEditor());
  $('note-form').addEventListener('submit', saveNote);
  $('note-cancel').addEventListener('click', () => $('note-dialog').close());
  $('note-dialog').addEventListener('close', () => { state.editingNoteId = null; });
}

/* ----------------------------- Saved messages ----------------------------- */
async function loadSavedMessages() {
  if (!state.user) return;
  $('saved-message-count').textContent = 'Loading saved messages…';
  const { data: saved, error } = await sb.from('relationship_saved_messages')
    .select('id,message_id,pinned,created_at')
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    $('saved-message-count').textContent = 'Saved messages could not be loaded.';
    toast(`Saved messages: ${error.message}`);
    return;
  }
  if (!saved?.length) {
    state.savedMessages = [];
    renderSavedMessages();
    return;
  }
  const { data: messages, error: messageError } = await sb.from('messages')
    .select('id,sender_id,receiver_id,kind,body,created_at,deleted_at')
    .in('id', saved.map((item) => item.message_id));
  if (messageError) {
    toast(`Saved messages: ${messageError.message}`);
    return;
  }
  const byId = new Map((messages || []).map((item) => [item.id, item]));
  state.savedMessages = saved
    .map((item) => ({ ...item, message: byId.get(item.message_id) }))
    .filter((item) => item.message && !item.message.deleted_at)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  renderSavedMessages();
}

function renderSavedMessages() {
  const list = $('saved-message-list');
  if (!list) return;
  list.replaceChildren();
  const totalPinned = state.savedMessages.filter((item) => item.pinned).length;
  $('saved-message-count').textContent = `${state.savedMessages.length} saved · ${totalPinned} pinned`;
  if (!state.savedMessages.length) {
    list.append(makeEmpty('Nothing saved yet. Open a message menu and choose Save message.'));
    return;
  }

  for (const saved of state.savedMessages) {
    const m = saved.message;
    const peerId = m.sender_id === state.user.id ? m.receiver_id : m.sender_id;
    const senderName = state.names.get(m.sender_id) || 'One of you';
    const card = document.createElement('article');
    card.className = 'saved-message-card';
    const top = document.createElement('div');
    top.className = 'saved-message-top';
    const copy = document.createElement('div');
    copy.className = 'saved-message-copy';
    const label = document.createElement('span');
    label.className = 'saved-message-label';
    label.textContent = saved.pinned ? 'Pinned message' : 'Saved message';
    const title = document.createElement('strong');
    title.textContent = `${senderName} · ${new Date(m.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
    const detail = document.createElement('p');
    detail.textContent = m.kind === 'text' ? (m.body || '') :
      m.kind === 'image' ? '📷 Photo message' :
      m.kind === 'audio' ? '🎙 Voice message' : 'Sticker message';
    copy.append(label, title, detail);
    const actions = document.createElement('div');
    actions.className = 'saved-message-actions';
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'space-button secondary';
    open.textContent = 'Open in chat';
    open.addEventListener('click', () => window.dispatchEvent(new CustomEvent('lovers:open-message', {
      detail: { messageId: m.id, peerId },
    })));
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'space-button ghost';
    pin.textContent = saved.pinned ? 'Unpin' : 'Pin';
    pin.addEventListener('click', () => toggleSavedPin(saved));
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'space-button danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeSavedMessage(saved));
    actions.append(open, pin, remove);
    top.append(copy, actions);
    card.append(top);
    list.append(card);
  }
}

async function toggleSavedPin(saved) {
  const { error } = await sb.from('relationship_saved_messages')
    .update({ pinned: !saved.pinned }).eq('id', saved.id);
  if (error) return toast(`Couldn't update pin: ${error.message}`);
  await loadSavedMessages();
  window.dispatchEvent(new CustomEvent('lovers:saved-changed'));
}

async function removeSavedMessage(saved) {
  const { error } = await sb.from('relationship_saved_messages').delete().eq('id', saved.id);
  if (error) return toast(`Couldn't remove saved message: ${error.message}`);
  state.savedMessages = state.savedMessages.filter((item) => item.id !== saved.id);
  renderSavedMessages();
  window.dispatchEvent(new CustomEvent('lovers:saved-changed'));
}

/* ----------------------------- Global search ----------------------------- */
async function runGlobalSearch(event) {
  event?.preventDefault();
  if (!state.user) return;
  const term = $('global-search-input').value.trim().slice(0, 100);
  const kind = $('global-search-kind').value;
  const resultsNode = $('global-search-results');
  resultsNode.replaceChildren();
  if (!term) {
    $('global-search-count').textContent = 'Type something to search.';
    return;
  }

  $('global-search-count').textContent = 'Searching…';
  const pattern = `%${term}%`;
  const jobs = [];
  const add = (type, table, query) => jobs.push(
    query.then(({ data, error }) => {
      if (error) throw new Error(`${table}: ${error.message}`);
      (data || []).forEach((row) => state.searchResults.push({ type, row }));
    }).catch((error) => state.searchErrors.push(error.message))
  );
  state.searchResults = [];
  state.searchErrors = [];

  if (kind === 'all' || kind === 'messages') {
    add('message', 'messages', sb.from('messages')
      .select('id,sender_id,receiver_id,kind,body,created_at')
      .is('deleted_at', null).ilike('body', pattern)
      .order('created_at', { ascending: false }).limit(12));
  }
  if (kind === 'all' || kind === 'photos') {
    add('photo', 'photos', sb.from('relationship_photos')
      .select('id,caption,photo_date,uploaded_by')
      .ilike('caption', pattern).order('photo_date', { ascending: false }).limit(8));
  }
  if (kind === 'all' || kind === 'notes') {
    add('note-title', 'notes', sb.from('relationship_notes')
      .select('id,title,content,updated_at,updated_by')
      .ilike('title', pattern).order('updated_at', { ascending: false }).limit(8));
    add('note-content', 'notes', sb.from('relationship_notes')
      .select('id,title,content,updated_at,updated_by')
      .ilike('content', pattern).order('updated_at', { ascending: false }).limit(8));
  }
  if (kind === 'all' || kind === 'dates') {
    add('date-title', 'calendar', sb.from('relationship_events')
      .select('id,title,description,event_date')
      .ilike('title', pattern).order('event_date', { ascending: false }).limit(8));
    add('date-description', 'calendar', sb.from('relationship_events')
      .select('id,title,description,event_date')
      .ilike('description', pattern).order('event_date', { ascending: false }).limit(8));
  }
  if (kind === 'all' || kind === 'tasks') {
    add('task', 'tasks', sb.from('relationship_tasks')
      .select('id,title,done,created_at')
      .ilike('title', pattern).order('created_at', { ascending: false }).limit(8));
  }

  await Promise.all(jobs);
  const unique = new Map();
  for (const result of state.searchResults) {
    const id = result.row.id;
    const key = `${result.type.startsWith('note') ? 'note' : result.type.startsWith('date') ? 'date' : result.type}:${id}`;
    if (!unique.has(key)) unique.set(key, result);
  }
  state.searchResults = [...unique.values()];
  renderGlobalSearch(term);
}

function renderGlobalSearch(term) {
  const list = $('global-search-results');
  list.replaceChildren();
  $('global-search-count').textContent = `${state.searchResults.length} result${state.searchResults.length === 1 ? '' : 's'} for “${term}”`;
  if (!state.searchResults.length) {
    list.append(makeEmpty(state.searchErrors.length
      ? 'Some sections could not be searched. Check the notification above.'
      : 'No matches found. Try another word or category.'));
    return;
  }

  const labels = {
    message: 'MESSAGE',
    photo: 'PHOTO CAPTION',
    'note-title': 'SHARED NOTE',
    'note-content': 'SHARED NOTE',
    'date-title': 'CALENDAR DATE',
    'date-description': 'CALENDAR DATE',
    task: 'TO-DO ITEM',
  };
  const detailFor = (type, row) => {
    if (type === 'message') return row.kind === 'text' ? row.body : row.kind === 'image' ? 'Photo message' : row.kind === 'audio' ? 'Voice message' : 'Sticker message';
    if (type === 'photo') return row.caption || 'Saved photo';
    if (type.startsWith('note')) return row.content || 'Shared note';
    if (type.startsWith('date')) return row.description || 'Calendar date';
    return row.done ? `Completed · ${row.title}` : row.title;
  };

  for (const result of state.searchResults) {
    const { type, row } = result;
    const card = document.createElement('article');
    card.className = 'tool-result';
    const copy = document.createElement('div');
    copy.className = 'tool-result-copy';
    const label = document.createElement('span');
    label.className = 'tool-result-kind';
    label.textContent = labels[type] || type.toUpperCase();
    const title = document.createElement('strong');
    title.textContent = type === 'message'
      ? (row.kind === 'text' ? (row.body || 'Message').slice(0, 100) : detailFor(type, row))
      : type === 'photo' ? (row.caption || 'Saved photo')
      : type.startsWith('note') ? row.title
      : type.startsWith('date') ? row.title
      : row.title;
    const detail = document.createElement('p');
    detail.textContent = type === 'message' ? `${state.names.get(row.sender_id) || 'One of you'} · ${new Date(row.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`
      : type === 'photo' ? formatDate(row.photo_date)
      : type.startsWith('note') ? `Updated ${new Date(row.updated_at).toLocaleDateString()}`
      : type.startsWith('date') ? formatDate(row.event_date)
      : row.done ? 'Completed' : 'To do';
    const meta = document.createElement('small');
    meta.textContent = detailFor(type, row).slice(0, 220);
    copy.append(label, title, detail, meta);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'space-button secondary';
    open.textContent = 'Open';
    open.addEventListener('click', () => {
      if (type === 'message') {
        const peerId = row.sender_id === state.user.id ? row.receiver_id : row.sender_id;
        window.dispatchEvent(new CustomEvent('lovers:open-message', { detail: { messageId: row.id, peerId } }));
      } else if (type === 'photo') showPage('gallery');
      else if (type.startsWith('note')) showPage('notes');
      else if (type.startsWith('date')) showPage('calendar');
      else showPage('tasks');
    });
    card.append(copy, open);
    list.append(card);
  }
  if (state.searchErrors.length) {
    const warning = document.createElement('p');
    warning.className = 'space-muted';
    warning.textContent = `Some sections were not searched: ${[...new Set(state.searchErrors)].join(' · ')}`;
    list.append(warning);
  }
}

function wireSearch() {
  $('global-search-form').addEventListener('submit', runGlobalSearch);
  $('global-search-clear').addEventListener('click', () => {
    $('global-search-input').value = '';
    $('global-search-results').replaceChildren();
    $('global-search-count').textContent = 'Search results will appear here.';
    $('global-search-input').focus();
  });
}

/* ----------------------------- Startup ----------------------------- */
function wireAll() {
  wireNavigation();
  wireCalendar();
  wireTasks();
  wireGallery();
  wireVoices();
  wireTimeline();
  wireDateJar();
  wireCheckins();
  wireNotes();
  wireSearch();
  window.addEventListener('lovers:show-chat', () => showPage('chat'));
  window.addEventListener('lovers:saved-changed', () => {
    if (state.page === 'saved') loadSavedMessages();
  });
}

wireAll();
startAuth();
