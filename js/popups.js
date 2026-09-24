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
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(new Date(`${value}T00:00:00`));
  }

  function formatTime(value) {
    if (!value) return '';
    const [hour, minute] = value.slice(0, 5).split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function formatTimeRange(start, end) {
    const first = formatTime(start);
    const last = formatTime(end);
    if (first && last) return `${first} – ${last}`;
    return first || last || 'Time to be announced';
  }

  async function loadEvents() {
    try {
      const { data, error } = await window.datihanSupabase
        .from('pop_up_events')
        .select('id, title, description, location, event_date, start_time, end_time, status')
        .in('status', ['upcoming', 'ongoing'])
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;

      if (!data?.length) {
        container.innerHTML = '<div class="popup-empty"><h2>No upcoming pop-ups yet.</h2><p style="margin-top:.5rem">Check back soon for the next DATIHAN.PH event.</p></div>';
        return;
      }

      container.innerHTML = data.map(event => `
        <article class="popup-event">
          <div class="popup-event-header">
            <div>
              <p class="eyebrow">${escapeHtml(formatDate(event.event_date))}</p>
              <h2>${escapeHtml(event.title)}</h2>
            </div>
            <span class="status-badge">${escapeHtml(event.status)}</span>
          </div>
          <div class="popup-meta">
            <span>📍 ${escapeHtml(event.location)}</span>
            <span>🕒 ${escapeHtml(formatTimeRange(event.start_time, event.end_time))}</span>
          </div>
          ${event.description ? `<p class="popup-description">${escapeHtml(event.description)}</p>` : ''}
        </article>
      `).join('');
    } catch (error) {
      console.error('Load public pop-up events error:', error);
      container.innerHTML = '<div class="popup-empty"><h2>Pop-ups are being updated.</h2><p style="margin-top:.5rem">Please check back shortly.</p></div>';
    }
  }

  loadEvents();
})();
