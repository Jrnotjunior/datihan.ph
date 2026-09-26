(() => {
    const API = window.DatihanAddressAPI;

    const normalise = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    // Valenzuela barangay postal areas used by DATIHAN.PH's address form.
    // The city has multiple postal areas, so the barangay is checked first.
    const VALENZUELA_POSTAL_CODES = {
        'arkong bato': '1444',
        'bagbaguin': '1440',
        'balangkas': '1445',
        'bignay': '1440',
        'bisig': '1440',
        'canumay east': '1447',
        'canumay west': '1443',
        'coloong': '1445',
        'dalandanan': '1443',
        'gen t de leon': '1442',
        'isla': '1440',
        'karuhatan': '1441',
        'lawang bato': '1447',
        'lingunan': '1446',
        'mabolo': '1444',
        'malanday': '1444',
        'malinta': '1440',
        'mapulang lupa': '1448',
        'marulas': '1440',
        'maysan': '1440',
        'palasan': '1444',
        'parada': '1440',
        'pariancillo villa': '1440',
        'paso de blas': '1442',
        'pasolo': '1444',
        'poblacion': '1440',
        'polo': '1444',
        'punturin': '1447',
        'rincon': '1444',
        'tagalag': '1440',
        'ugong': '1440',
        'viente reales': '1440',
        'wawang pulo': '1440'
    };

    let cityPostalPromise = null;

    const postalEl = () => document.getElementById('address-postal-code');
    const cityEl = () => document.getElementById('address-city');
    const barangayEl = () => document.getElementById('address-barangay');

    const selectedText = select => select?.selectedOptions?.[0]?.textContent?.trim() || '';

    const loadCityPostalCodes = async () => {
        if (cityPostalPromise) return cityPostalPromise;
        cityPostalPromise = fetch('https://psgc.cloud/api/cities', {
            headers: { Accept: 'application/json' }
        })
            .then(async response => {
                if (!response.ok) throw new Error(`Postal code lookup failed (${response.status}).`);
                const data = await response.json();
                return Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
            })
            .catch(error => {
                cityPostalPromise = null;
                throw error;
            });
        return cityPostalPromise;
    };

    const resolvePostalCode = async () => {
        const postal = postalEl();
        const city = cityEl();
        const barangay = barangayEl();
        if (!postal || !city || !barangay) return;

        const cityName = normalise(selectedText(city));
        const barangayName = normalise(selectedText(barangay));
        if (!cityName || !barangayName) {
            postal.value = '';
            return;
        }

        if (cityName === 'valenzuela' || cityName === 'city of valenzuela') {
            const code = VALENZUELA_POSTAL_CODES[barangayName];
            if (code) postal.value = code;
            return;
        }

        // For other cities, use the PSGC city-level ZIP as a fallback.
        // The field remains editable so users can correct a postal area when a city has multiple zones.
        try {
            const cities = await loadCityPostalCodes();
            const cityCode = city.value;
            const match = cities.find(item =>
                String(item.code) === String(cityCode) || normalise(item.name) === cityName
            );
            if (match?.zip_code) postal.value = String(match.zip_code);
        } catch (error) {
            console.warn('Postal code lookup unavailable:', error);
        }
    };

    const addPostalToPayload = payload => {
        const postalCode = postalEl()?.value.trim() || '';
        if (!/^\d{4}$/.test(postalCode)) {
            throw new Error('Please enter a valid 4-digit postal code.');
        }
        return { ...payload, postal_code: postalCode };
    };

    const wrapAddressApi = () => {
        if (!API || API.__postalCodeWrapped) return;
        const originalCreate = API.create;
        const originalUpdate = API.update;
        API.create = payload => originalCreate(addPostalToPayload(payload));
        API.update = (id, payload) => originalUpdate(id, addPostalToPayload(payload));
        API.__postalCodeWrapped = true;
    };

    const bind = () => {
        wrapAddressApi();

        barangayEl()?.addEventListener('change', resolvePostalCode);
        cityEl()?.addEventListener('change', () => {
            const postal = postalEl();
            if (postal) postal.value = '';
            resolvePostalCode();
        });

        const barangay = barangayEl();
        if (barangay) {
            const observer = new MutationObserver(() => resolvePostalCode());
            observer.observe(barangay, { childList: true });
        }

        const modal = document.getElementById('address-modal');
        if (modal) {
            const observer = new MutationObserver(() => {
                if (!modal.hidden) resolvePostalCode();
            });
            observer.observe(modal, { attributes: true, attributeFilter: ['hidden'] });
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
    else bind();
})();
