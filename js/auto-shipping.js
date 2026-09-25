(() => {
  const METRO_MANILA_CITIES = new Set([
    'caloocan', 'las pinas', 'makati', 'malabon', 'mandaluyong', 'manila',
    'marikina', 'muntinlupa', 'navotas', 'paranaque', 'pasay', 'pasig',
    'quezon city', 'san juan', 'taguig', 'valenzuela'
  ]);

  const METRO_MANILA_PROVINCES = new Set([
    'metro manila', 'metropolitan manila', 'ncr', 'national capital region'
  ]);

  const VISAYAS_PROVINCES = new Set([
    'aklan', 'antique', 'capiz', 'guimaras', 'iloilo', 'negros occidental',
    'negros oriental', 'cebu', 'bohol', 'siquijor', 'biliran', 'eastern samar',
    'leyte', 'northern samar', 'samar', 'western samar', 'southern leyte',
    'romblon'
  ]);

  const MINDANAO_PROVINCES = new Set([
    'zamboanga del norte', 'zamboanga del sur', 'zamboanga sibugay', 'basilan',
    'bukidnon', 'camiguin', 'lanao del norte', 'lanao del sur', 'maguindanao',
    'maguindanao del norte', 'maguindanao del sur', 'sulu', 'tawi tawi',
    'davao de oro', 'davao del norte', 'davao del sur', 'davao occidental',
    'davao oriental', 'cotabato', 'north cotabato', 'south cotabato', 'sarangani',
    'sultan kudarat', 'agusan del norte', 'agusan del sur', 'dinagat islands',
    'surigao del norte', 'surigao del sur', 'misamis occidental', 'misamis oriental'
  ]);

  const normalise = value => String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/city of |municipality of /g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const detectZone = (city, province) => {
    const cityName = normalise(city);
    const provinceName = normalise(province);

    // Province is authoritative for NCR addresses, while city is a fallback
    // for older saved addresses that may not have "Metro Manila" in province.
    if (METRO_MANILA_PROVINCES.has(provinceName) || METRO_MANILA_CITIES.has(cityName)) {
      return 'Metro Manila';
    }
    if (VISAYAS_PROVINCES.has(provinceName)) return 'Visayas';
    if (MINDANAO_PROVINCES.has(provinceName)) return 'Mindanao';
    return 'Luzon';
  };

  const rateMatchesZone = (rateName, zone) => {
    const name = normalise(rateName);
    if (zone === 'Metro Manila') return /metro manila|metropolitan manila|national capital region|\bncr\b/.test(name);
    if (zone === 'Visayas') return /visayas/.test(name);
    if (zone === 'Mindanao') return /mindanao/.test(name);
    return /luzon|outside metro manila|outside ncr|nationwide/.test(name);
  };

  const findRate = (select, city, province) => {
    const zone = detectZone(city, province);
    const options = [...select.options].filter(option => option.value);
    let match = options.find(option => rateMatchesZone(option.textContent, zone));

    // For non-Metro areas, support shops that use a single catch-all rate.
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

    const result = findRate(select, address.dataset.city, address.dataset.province);
    select.value = result.match?.value || '';
    select.dispatchEvent(new Event('change', { bubbles: true }));

    const display = document.getElementById('auto-shipping-rate');
    if (!display) return;

    display.innerHTML = '<strong></strong><span></span>';
    display.querySelector('strong').textContent = result.zone;
    display.querySelector('span').textContent = result.match
      ? formatRateText(result.match).replace(/\s*[—-]\s*₱[\d,.]+$/, '').replace(new RegExp(`^${result.zone}\\s*[—-]?\\s*`, 'i'), '').trim()
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
    refresh();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
