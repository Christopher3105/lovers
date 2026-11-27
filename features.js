import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const BUCKET = 'relationship-gallery';
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const $ = (id) => document.getElementById(id);
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null,
  page: 'chat',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedDate: dateISO(new Date()),
  events: [],
  tasks: [],
  photos: [],
  names: new Map(),
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
  tasks: ['Little plans', 'Small things to do together, one check at a time.'],
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
  if (page === 'tasks') renderTasks();
  if (page === 'home') renderHome();
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
  for (const table of ['relationship_events', 'relationship_tasks', 'relationship_photos']) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
      clearTimeout(state.refreshTimer);
      state.refreshTimer = setTimeout(async () => {
        await loadBaseData();
        if (state.page === 'gallery') await loadPhotos();
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
  $('event-date').value = state.selectedDate;
}

function resetSpace() {
  if (state.channel) sb.removeChannel(state.channel);
  state.channel = null;
  state.user = null;
  state.events = [];
  state.tasks = [];
  state.photos = [];
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
      const dots = document.createElement('span');
      dots.className = 'calendar-dots';
      dayEvents.slice(0, 4).forEach((event) => {
        const dot = document.createElement('i');
        dot.style.background = event.color;
        dots.append(dot);
      });
      button.append(dots);
      if (dayEvents.length > 1) {
        const count = document.createElement('span');
        count.className = 'calendar-day-count';
        count.textContent = `${dayEvents.length} events`;
        button.append(count);
      }
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
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'gallery-remove';
      remove.setAttribute('aria-label', 'Delete this photo');
      remove.innerHTML = icons.trash;
      remove.addEventListener('click', () => deletePhoto(photo));
      meta.append(remove);
    }

    card.append(open, meta);
    grid.append(card);
  }
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
  $('gallery-search').addEventListener('input', renderGallery);
  $('gallery-year').addEventListener('change', renderGallery);
  $('gallery-month').addEventListener('change', renderGallery);
  $('gallery-lightbox-close').addEventListener('click', () => $('gallery-lightbox').close());
  $('gallery-lightbox').addEventListener('click', (event) => {
    if (event.target === $('gallery-lightbox')) $('gallery-lightbox').close();
  });
}

/* ----------------------------- Startup ----------------------------- */
function wireAll() {
  wireNavigation();
  wireCalendar();
  wireTasks();
  wireGallery();
}

wireAll();
startAuth();
