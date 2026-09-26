(() => {
  const announcement = document.querySelector('.hero-announcement');
  const label = document.querySelector('.hero-announcement-label');
  const text = document.querySelector('.hero-announcement-text');

  if (!announcement || !label || !text || !window.datihanSupabase) return;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return '';

    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'Asia/Manila'
    }).format(new Date(`${value}T00:00:00+08:00`));
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
    if (event.realtimeStatus === 'upcoming') return 1;
    return 2;
  }

  async function loadFeaturedEvent() {
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
        .map(event => ({
          ...event,
          realtimeStatus: getRealtimeStatus(event, now)
        }))
        .filter(event => event.realtimeStatus !== 'past')
        .sort((a, b) => {
          const priorityDifference = getEventPriority(a) - getEventPriority(b);
          if (priorityDifference !== 0) return priorityDifference;

          return `${a.event_date} ${a.start_time || ''}`.localeCompare(
            `${b.event_date} ${b.start_time || ''}`
          );
        });

      if (!events.length) {
        label.textContent = 'POP-UP EVENT';
        text.textContent = 'See where DATIHAN.PH is popping up next.';
        announcement.setAttribute('aria-label', 'See upcoming DATIHAN.PH pop-up events');
        return;
      }

      const event = events[0];
      const statusText = event.realtimeStatus === 'happening' ? 'Happening now' : 'Upcoming';
      const dateText = formatDate(event.event_date);
      const locationText = event.location ? ` · ${event.location}` : '';

      label.textContent = statusText.toUpperCase();
      text.innerHTML = `${escapeHtml(event.title)} · ${escapeHtml(dateText)}${escapeHtml(locationText)}`;
      announcement.setAttribute(
        'aria-label',
        `${statusText}: ${event.title}${event.location ? ` at ${event.location}` : ''} on ${dateText}`
      );
    } catch (error) {
      console.error('Load homepage pop-up event error:', error);
      label.textContent = 'POP-UP EVENT';
      text.textContent = 'See where DATIHAN.PH is popping up next.';
      announcement.setAttribute('aria-label', 'See upcoming DATIHAN.PH pop-up events');
    }
  }

  loadFeaturedEvent();
  window.setInterval(loadFeaturedEvent, 60 * 1000);
})();
