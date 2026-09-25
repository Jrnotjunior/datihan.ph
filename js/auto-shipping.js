(() => {
  const METRO_MANILA_CITIES = new Set([
    'caloocan', 'las pinas', 'las piñas', 'makati', 'malabon', 'mandaluyong',
    'manila', 'marikina', 'muntinlupa', 'navotas', 'paranaque', 'parañaque',
    'pasay', 'pasig', 'quezon city', 'san juan', 'taguig', 'valenzuela'
  ]);

  const VISAYAS_PROVINCES = new Set([
    'aklan', 'antique', 'capiz', 'guimaras', 'iloilo', 'negros occidental',
    'negros oriental', 'cebu', 'bohol', 'siquijor', 'biliran', 'eastern samar',
    'leyte', 'northern samar', 'samar', 'western samar', 'southern leyte'
  ]);

  const MINDANAO_PROVINCES = new Set([
    'zamboanga del norte', 'zamboanga del sur', 'zamboanga sibugay', 'basilan',
    'bukidnon', 'camiguin', 'lanao del norte', 'lanao del sur', 'misamis occidental',
    'misamis oriental', 'maguindanao', 'maguindanao del norte', 'maguindanao del sur',
    'sulu', 'tawi tawi', 'davao de oro', 'davao del norte', 'davao del sur',
    'davao occidental', 'davao oriental', 'cotabato', 'north cotabato',
    'south cotabato', 'sarangani', 'sultan kudarat', 'agusan del norte',
    'agusan del sur', 'dinagat islands', 'surigao del norte', 'surigao del sur'
  ]);

  const normalise = value => String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/city of |municipality of /g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const detectZone = addressText => {
    const text = normalise(addressText);
    if (text.includes('metro manila') || text.includes('national capital region') || [...METRO_MANILA_CITIES].some(city => text.includes(normalise(city)))) {
      return 'Metro Manila';
    }
    if ([...VISAYAS_PROVINCES].some(province => text.includes(normalise(province))) || text.includes('visayas') || text.includes('negros island')) {
      return 'Visayas';
    }
    if ([...MINDANAO_PROVINCES].some(province => text.includes(normalise(province))) || text.includes('mindanao')) {
      return 'Mindanao';
    }
    return 'Luzon';
  };

  const rateMatchesZone = (rateName, zone) => {
    const name = normalise(rateName);
    if (zone === 'Metro Manila') return /metro manila|national capital region|\bncr\b/.test(name);
    if (zone === 'Visayas') return /visayas/.test(name);
    if (zone === 'Mindanao') return /mindanao/.test(name);
    return /\bluzon\b/.test(name);
  };

  const findRate = (select, addressText) => {
    const zone = detectZone(addressText);
    const options = [...select.options].filter(option => option.value);
    let match = options.find(option => rateMatchesZone(option.textContent, zone));

    // Backward-compatible fallback for shops using one "Outside Metro Manila" rate.
    if (!match && zone !== 'Metro Manila') {
      match = options.find(option => /outside metro manila|outside ncr|nationwide/.test(normalise(option.textContent)));
    }

    return { zone, match };
  };

  const formatRateText = option => option?.textContent.replace(/\s+/g, ' ').trim() || '';

  const apply = () => {
    const address = document.querySelector('input[name="shipping-address"]:checked');
    const select = document.getElementById('shipping-rate');
    const help = document.getElementById('shipping-rate-help');
    if (!address || !select || select.options.length <= 1) return;

    const card = address.closest('.checkout-address-option');
    const addressText = card?.querySelector('.checkout-address-copy > span:nth-of-type(2)')?.textContent || '';
    if (!addressText) return;

    const result = findRate(select, addressText);
    select.value = result.match?.value || '';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    let display = document.getElementById('auto-shipping-rate');
    if (!display) {
      display = document.createElement('div');
      display.id = 'auto-shipping-rate';
      display.className = 'auto-shipping-rate';
      select.parentElement.insertBefore(display, select);
    }

    display.innerHTML = '<strong></strong><span></span>';
    display.querySelector('strong').textContent = result.zone;
    display.querySelector('span').textContent = result.match
      ? formatRateText(result.match).replace(result.zone, '').replace(/^\s*[—-]\s*/, '').trim()
      : 'No shipping rate is available for this address.';
    display.hidden = false;
    select.hidden = true;
    select.disabled = true;

    if (help) {
      help.textContent = result.match
        ? 'Shipping fee is automatically calculated from your delivery address.'
        : 'The shop does not currently have a shipping rate for this delivery area.';
    }
  };

  const start = () => {
    const addressContainer = document.getElementById('saved-addresses');
    const select = document.getElementById('shipping-rate');
    if (!addressContainer || !select) return;

    const refresh = () => apply();
    const observer = new MutationObserver(refresh);
    observer.observe(addressContainer, { childList: true, subtree: true });
    observer.observe(select, { childList: true, subtree: true });
    addressContainer.addEventListener('change', refresh);
    select.addEventListener('change', () => window.setTimeout(apply, 0));
    window.setInterval(refresh, 1000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
