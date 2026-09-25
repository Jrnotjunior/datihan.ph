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

    // v2 city details do not expose zip_code. Use the v1 locality endpoint by
    // city name as a compatibility lookup; v1 accepts a locality code or name.
    const getCityDetails = async cityCode => {
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
