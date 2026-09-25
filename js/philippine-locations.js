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
        const promise = fetch(url, { headers: { Accept: 'application/json' } }).then(async response => {
            if (!response.ok) throw new Error(`Location data request failed (${response.status}).`);
            return unwrap(await response.json());
        });
        cache.set(url, promise);
        return promise;
    };

    const requestObject = async path => {
        const url = `${BASE}${path}`;
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
    const getCityDetails = cityCode => requestObject(`/cities-municipalities/${encodeURIComponent(cityCode)}`);

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
