(() => {
    const BASE = 'https://psgc.cloud/api/v2';
    const LEGACY_BASE = 'https://psgc.cloud/api/v1';
    const cache = new Map();
    const cityCache = new Map();

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

    // v1 locality records include zip_code. Use them for city/municipality
    // lists so the selected city can supply its postal code directly.
    const listCities = async provinceCode => rememberCities(
        await request(LEGACY_BASE, `/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`)
    );

    const listCitiesByRegion = async regionCode => rememberCities(
        await request(BASE, `/regions/${encodeURIComponent(regionCode)}/cities-municipalities`)
    );

    const listBarangays = cityCode => request(BASE, `/cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);

    const getCityDetails = async cityCode => {
        const cached = cityCache.get(String(cityCode));
        if (cached) return cached;
        const city = await requestObject(LEGACY_BASE, `/cities-municipalities/${encodeURIComponent(cityCode)}`);
        if (city?.code) cityCache.set(String(city.code), city);
        return city;
    };

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
