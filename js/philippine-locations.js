(() => {
    const BASE = 'https://psgc.cloud/api/v2';
    const LEGACY_BASE = 'https://psgc.cloud/api/v1';
    const cache = new Map();

    const unwrap = payload => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    const request = async path => {
        const url = `${BASE}${path}`;
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

    const listRegions = () => request('/regions');
    const listProvinces = regionCode => request(`/regions/${encodeURIComponent(regionCode)}/provinces`);
    const listAllProvinces = () => request('/provinces');
    const listCities = provinceCode => request(`/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`);
    const listCitiesByRegion = regionCode => request(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities`);
    const listBarangays = cityCode => request(`/cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);

    // v2 is used for the hierarchy. The v1 locality detail still exposes the
    // postal/ZIP field, which v2's city detail intentionally does not include.
    const getCityDetails = cityCode => requestObject(LEGACY_BASE, `/cities-municipalities/${encodeURIComponent(cityCode)}`);

    window.DatihanLocations = {
        listRegions,
        listProvinces,
        listAllProvinces,
        listCities,
        listCitiesByRegion,
        listBarangays,
        getCityDetails
    };
})();
