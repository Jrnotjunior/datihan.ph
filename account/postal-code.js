(() => {
    const API = window.DatihanAddressAPI;
    const POSTAL_LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/use-postal-ph@1.1.14/dist/index.mjs';

    const postalEl = () => document.getElementById('address-postal-code');
    const cityEl = () => document.getElementById('address-city');
    const barangayEl = () => document.getElementById('address-barangay');

    const normalise = value => String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const normaliseCity = value => normalise(value)
        .replace(/^city of\s+/, '')
        .replace(/\s+city$/, '')
        .trim();

    const normaliseBarangay = value => normalise(value)
        .replace(/^barangay\s+/, '')
        .trim();

    const selectedText = select => select?.selectedOptions?.[0]?.textContent?.trim() || '';

    let postalLibraryPromise = null;

    const loadPostalLibrary = () => {
        if (!postalLibraryPromise) {
            postalLibraryPromise = import(POSTAL_LIBRARY_URL)
                .then(module => module.default())
                .catch(error => {
                    postalLibraryPromise = null;
                    throw error;
                });
        }
        return postalLibraryPromise;
    };

    const resolvePostalCode = async () => {
        const postal = postalEl();
        const city = cityEl();
        const barangay = barangayEl();
        if (!postal || !city || !barangay) return;

        const cityName = selectedText(city);
        const barangayName = selectedText(barangay);
        if (!cityName || !barangayName) {
            postal.value = '';
            return;
        }

        try {
            const postalPH = await loadPostalLibrary();
            const cityKey = normaliseCity(cityName);
            const barangayKey = normaliseBarangay(barangayName);

            // use-postal-ph stores the city/municipality in `location` and
            // postal delivery areas in `municipality`. A delivery-area name
            // may contain the selected barangay, e.g. "Valenzuela CPO - Malinta".
            const results = postalPH.fetchDataLists({ location: cityKey });
            const candidates = Array.isArray(results?.data) ? results.data : [];

            const match = candidates.find(item => {
                const locationKey = normaliseCity(item.location);
                const municipalityKey = normalise(item.municipality);
                return locationKey === cityKey && (
                    municipalityKey === barangayKey ||
                    municipalityKey.includes(barangayKey)
                );
            });

            postal.value = match?.post_code
                ? String(match.post_code).padStart(4, '0')
                : '';
        } catch (error) {
            postal.value = '';
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

        const postal = postalEl();
        if (postal) {
            postal.readOnly = true;
            postal.setAttribute('aria-readonly', 'true');
        }

        barangayEl()?.addEventListener('change', resolvePostalCode);
        cityEl()?.addEventListener('change', () => {
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
