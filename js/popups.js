(() => {
  const container = document.getElementById('popup-events');
  if (!container || !window.datihanSupabase) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Date to be announced';
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeZone: 'Asia/Manila'
    }).format(new Date(`${value}T00:00:00+08:00`));
  }

  function formatTime(value) {
    if (!value) return '';
    const [hour, minute] = value.slice(0, 5).split(':').map(Number);
    const date = new Date(Date.UTC(2000, 0, 1, hour, minute));
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(date);
  }

  function formatTimeRange(start, end) {
    const first = formatTime(start);
    const last = formatTime(end);
    if (first && last) return `${first} – ${last}`;
    return first || last || 'Time to be announced';
  }

  function getManilaNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}:${values.second}`
    };
  }

  function getRealtimeStatus(event, now) {
    if (!event.event_date) return 'upcoming';

    if (event.event_date > now.date) return 'upcoming';
    if (event.event_date < now.date) return 'past';

    const start = event.start_time ? event.start_time.slice(0, 8) : null;
    const end = event.end_time ? event.end_time.slice(0, 8) : null;

    if (!start && !end) return 'happening';
    if (start && now.time < start) return 'upcoming';
    if (end && now.time > end) return 'past';
    return 'happening';
  }

  function statusLabel(status) {
    if (status === 'happening') return 'Happening now';
    if (status === 'past') return 'Past';
    return 'Upcoming';
  }

  function renderEvent(event) {
    return `
      <article class="popup-event">
        <div class="popup-event-header">
          <div>
            <p class="eyebrow">${escapeHtml(formatDate(event.event_date))}</p>
            <h2>${escapeHtml(event.title)}</h2>
          </div>
          <span class="status-badge status-${escapeHtml(event.realtimeStatus)}">${escapeHtml(statusLabel(event.realtimeStatus))}</span>
        </div>
        <div class="popup-meta">
          <span>📍 ${escapeHtml(event.location)}</span>
          <span>🕒 ${escapeHtml(formatTimeRange(event.start_time, event.end_time))}</span>
        </div>
        ${event.description ? `<p class="popup-description">${escapeHtml(event.description)}</p>` : ''}
      </article>
    `;
  }

  function renderGroup(title, events) {
    if (!events.length) return '';
    return `
      <section class="popup-group">
        <div class="popup-group-heading">
          <h2>${title}</h2>
          <span>${events.length} ${events.length === 1 ? 'event' : 'events'}</span>
        </div>
        <div class="popup-list">${events.map(renderEvent).join('')}</div>
      </section>
    `;
  }

  async function loadEvents() {
    try {
      const { data, error } = await window.datihanSupabase
        .from('pop_up_events')
        .select('id, title, description, location, event_date, start_time, end_time, status')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const now = getManilaNow();
      const events = (data || [])
        .filter(event => String(event.status ?? '').toLowerCase() !== 'cancelled')
        .map(event => ({
          ...event,
          realtimeStatus: getRealtimeStatus(event, now)
        }));

      const upcoming = events
        .filter(event => event.realtimeStatus === 'upcoming')
        .sort((a, b) => `${a.event_date} ${a.start_time || ''}`.localeCompare(`${b.event_date} ${b.start_time || ''}`));

      const happening = events
        .filter(event => event.realtimeStatus === 'happening')
        .sort((a, b) => `${a.event_date} ${a.start_time || ''}`.localeCompare(`${b.event_date} ${b.start_time || ''}`));

      const past = events
        .filter(event => event.realtimeStatus === 'past')
        .sort((a, b) => `${b.event_date} ${b.start_time || ''}`.localeCompare(`${a.event_date} ${a.start_time || ''}`));

      if (!events.length) {
        container.innerHTML = '<div class="popup-empty"><h2>No pop-up events yet.</h2><p style="margin-top:.5rem">Check back soon for the next DATIHAN.PH event.</p></div>';
        return;
      }

      container.innerHTML = `
        ${renderGroup('Happening now', happening)}
        ${renderGroup('Upcoming', upcoming)}
        ${renderGroup('Past', past)}
      `;
    } catch (error) {
      console.error('Load public pop-up events error:', error);
      container.innerHTML = '<div class="popup-empty"><h2>Pop-ups are being updated.</h2><p style="margin-top:.5rem">Please check back shortly.</p></div>';
    }
  }

  loadEvents();
  window.setInterval(loadEvents, 60 * 1000);
})();
