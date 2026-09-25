(() => {
    const BASE = 'https://psgc.cloud/api/v2';
    const cache = new Map();

    const unwrap = payload => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        return [];
    };

    const request = async path => {
        const url = `${BASE}${path}`;
        if (cache.has(url)) return cache.get(url);
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(`Location data request failed (${response.status}).`);
        const promise = response.json().then(unwrap);
        cache.set(url, promise);
        return promise;
    };

    const listRegions = () => request('/regions');
    const listProvinces = regionCode => request(`/regions/${encodeURIComponent(regionCode)}/provinces`);
    const listCities = provinceCode => request(`/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`);
    const listCitiesByRegion = regionCode => request(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities`);
    const listBarangays = cityCode => request(`/cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);

    const getCityDetails = async cityCode => {
        const url = `${BASE}/cities-municipalities/${encodeURIComponent(cityCode)}`;
        if (cache.has(url)) return cache.get(url);
        const promise = fetch(url, { headers: { Accept: 'application/json' } }).then(async response => {
            if (!response.ok) throw new Error(`Location data request failed (${response.status}).`);
            const payload = await response.json();
            return payload?.data || payload;
        });
        cache.set(url, promise);
        return promise;
    };

    window.DatihanLocations = {
        listRegions,
        listProvinces,
        listCities,
        listCitiesByRegion,
        listBarangays,
        getCityDetails
    };
})();
