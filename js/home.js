(() => {
  const eventsList = document.querySelector('#hero-events-list');

  if (!eventsList || !window.datihanSupabase) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
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

  function getEventPriority(event) {
    if (event.realtimeStatus === 'happening') return 0;
    return 1;
  }

  function formatTime(value) {
    if (!value) return '';

    const [hours, minutes] = value.slice(0, 5).split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);

    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).format(date);
  }

  function renderEvents(events) {
    if (!events.length) {
      eventsList.innerHTML = '<div class="hero-events-empty">No upcoming pop-up events at the moment.<br>Check back soon for the next DATIHAN.PH meet-up.</div>';
      return;
    }

    eventsList.innerHTML = events.slice(0, 3).map(event => {
      const status = event.realtimeStatus === 'happening' ? 'Happening' : 'Upcoming';
      const statusClass = event.realtimeStatus === 'happening' ? ' is-happening' : '';
      const time = event.start_time
        ? `${formatTime(event.start_time)}${event.end_time ? ` – ${formatTime(event.end_time)}` : ''}`
        : '';

      return `
        <article class="hero-event">
          <span class="hero-event-status${statusClass}">${escapeHtml(status)}</span>
          <h3 class="hero-event-title">${escapeHtml(event.title)}</h3>
          ${event.location ? `<p class="hero-event-location">${escapeHtml(event.location)}</p>` : ''}
          ${time ? `<p class="hero-event-time">${escapeHtml(time)}</p>` : ''}
        </article>
      `;
    }).join('');
  }

  async function loadEvents() {
    try {
      const { data, error } = await window.datihanSupabase
        .from('pop_up_events')
        .select('id, title, location, event_date, start_time, end_time, status')
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      const now = getManilaNow();
      const events = (data || [])
        .filter(event => String(event.status ?? '').toLowerCase() !== 'cancelled')
        .map(event => ({ ...event, realtimeStatus: getRealtimeStatus(event, now) }))
        .filter(event => event.realtimeStatus !== 'past')
        .sort((a, b) => {
          const priorityDifference = getEventPriority(a) - getEventPriority(b);
          if (priorityDifference !== 0) return priorityDifference;
          return `${a.event_date} ${a.start_time || ''}`.localeCompare(`${b.event_date} ${b.start_time || ''}`);
        });

      renderEvents(events);
    } catch (error) {
      console.error('Load homepage pop-up events error:', error);
      eventsList.innerHTML = '<div class="hero-events-empty">Pop-up events are temporarily unavailable.<br>Please check the Pop-ups page.</div>';
    }
  }

  loadEvents();
  window.setInterval(loadEvents, 60 * 1000);
})();
