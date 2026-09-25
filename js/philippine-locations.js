(() => {
    const BASE = 'https://psgc.cloud/api/v2';
    const LEGACY_BASE = 'https://psgc.cloud/api/v1';
    const POSTAL_DATA_URL = 'https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/data/all-flat.json';
    const cache = new Map();
    const cityCache = new Map();
    let postalDataPromise = null;

    const unwrap = payload => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    const request = async (base, path) => {
        const url = `${base}${path}`;
        if (cache.has(url)) return cache.get(url);
        const promise = fetch(url, { headers: { Accept: 'application/json' } }).then(async response => {
            if (!response.ok) throw new Error(`Location data request failed (${response.status}).`);
            return unwrap(await response.json());
        });
        cache.set(url, promise);
        return promise;
    };

    const requestObject = async (base, path) => {
        const url = `${base}${path}`;
        if (cache.has(url)) return cache.get(url);
        const promise = fetch(url, { headers: { Accept: 'application/json' } }).then(async response => {
            if (!response.ok) throw new Error(`Location data request failed (${response.status}).`);
            const payload = await response.json();
            return payload?.data || payload;
        });
        cache.set(url, promise);
        return promise;
    };

    const rememberCities = cities => {
        cities.forEach(city => {
            if (city?.code) cityCache.set(String(city.code), city);
        });
        return cities;
    };

    const listRegions = () => request(BASE, '/regions');
    const listProvinces = regionCode => request(BASE, `/regions/${encodeURIComponent(regionCode)}/provinces`);
    const listAllProvinces = () => request(BASE, '/provinces');

    // Keep the hierarchy on v2. Its province codes are the same codes used by
    // the v2 child endpoint; the v1 nested endpoint can reject newer codes
    // (for example, provinces affected by PSGC code revisions).
    const listCities = async provinceCode => rememberCities(
        await request(BASE, `/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`)
    );

    const listCitiesByRegion = async regionCode => rememberCities(
        await request(BASE, `/regions/${encodeURIComponent(regionCode)}/cities-municipalities`)
    );

    const listBarangays = cityCode => request(BASE, `/cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);

    // The PSGC hierarchy does not carry barangay-level ZIP codes. DATIHAN.PH
    // uses this maintained open administrative dataset as the postal lookup
    // layer. It contains postal_code/zip_codes on barangay records and is
    // loaded lazily only when a postal code is needed.
    const loadPostalData = async () => {
        if (postalDataPromise) return postalDataPromise;
        postalDataPromise = fetch(POSTAL_DATA_URL, { headers: { Accept: 'application/json' } })
            .then(async response => {
                if (!response.ok) throw new Error(`Postal data request failed (${response.status}).`);
                const payload = await response.json();
                return Array.isArray(payload) ? payload : unwrap(payload);
            })
            .catch(error => {
                postalDataPromise = null;
                throw error;
            });
        return postalDataPromise;
    };

    const postalValue = record => {
        const values = Array.isArray(record?.zip_codes) ? record.zip_codes : [record?.postal_code, record?.zip_code];
        return values.map(value => String(value || '').replace(/\D/g, '')).find(value => /^\d{4}$/.test(value)) || '';
    };

    const getBarangayPostalCode = async (barangayCode, cityCode = '') => {
        if (!barangayCode) return '';
        const records = await loadPostalData();
        const targetCode = String(barangayCode);
        const targetCity = String(cityCode || '');

        let match = records.find(record => String(record?.id ?? record?.code ?? '') === targetCode);
        if (!match) {
            match = records.find(record =>
                String(record?.parent_id ?? '') === targetCity &&
                String(record?.level ?? record?.level_name?.en ?? '').toLowerCase().includes('barangay')
            );
        }

        return postalValue(match);
    };

    // v2 city details do not expose zip_code. For saved-address restoration,
    // prefer the currently selected barangay's postal code and fall back to
    // the city-level legacy value only when no barangay postal record exists.
    const getCityDetails = async cityCode => {
        const selectedBarangay = document.getElementById('address-barangay')?.value || '';
        if (selectedBarangay) {
            try {
                const barangayZip = await getBarangayPostalCode(selectedBarangay, cityCode);
                if (barangayZip) return { zip_code: barangayZip, postal_code: barangayZip, source: 'barangay' };
            } catch (_) {
                // Fall through to the city-level compatibility lookup.
            }
        }

        const cached = cityCache.get(String(cityCode));
        const localityName = cached?.name;
        if (localityName) {
            try {
                return await requestObject(LEGACY_BASE, `/cities-municipalities/${encodeURIComponent(localityName)}`);
            } catch (_) {
                // Fall through to the code lookup for older PSGC records.
            }
        }

        const city = await requestObject(LEGACY_BASE, `/cities-municipalities/${encodeURIComponent(cityCode)}`);
        if (city?.code) cityCache.set(String(city.code), city);
        return city;
    };

    const bindBarangayPostalLookup = () => {
        const barangayEl = document.getElementById('address-barangay');
        const postalEl = document.getElementById('address-postal');
        const cityEl = document.getElementById('address-city');
        if (!barangayEl || !postalEl || !cityEl || barangayEl.dataset.postalBound === 'true') return;

        barangayEl.dataset.postalBound = 'true';
        barangayEl.addEventListener('change', async () => {
            postalEl.value = '';
            if (!barangayEl.value) return;

            try {
                const zip = await getBarangayPostalCode(barangayEl.value, cityEl.value);
                if (zip) {
                    postalEl.value = zip;
                } else {
                    postalEl.value = '';
                    const status = document.getElementById('address-form-status');
                    if (status) {
                        status.textContent = 'Postal code is not available for the selected barangay.';
                        status.className = 'address-form-status error';
                    }
                }
            } catch (error) {
                postalEl.value = '';
                const status = document.getElementById('address-form-status');
                if (status) {
                    status.textContent = `Unable to load barangay postal code: ${error.message || error}`;
                    status.className = 'address-form-status error';
                }
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindBarangayPostalLookup, { once: true });
    } else {
        bindBarangayPostalLookup();
    }

    window.DatihanLocations = {
        listRegions,
        listProvinces,
        listAllProvinces,
        listCities,
        listCitiesByRegion,
        listBarangays,
        getCityDetails,
        getBarangayPostalCode
    };
})();
