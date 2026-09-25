(() => {
    // DATIHAN.PH address hierarchy only.
    // Postal-code lookup is intentionally not part of the location system.
    const API_V2 = 'https://psgc.cloud/api/v2';
    const cache = new Map();
    const regionsByCode = new Map();
    const provincesByCode = new Map();
    const citiesByCode = new Map();

    const toArray = payload => Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data) ? payload.data : [];

    const requestList = async path => {
        const url = `${API_V2}${path}`;
        if (cache.has(url)) return cache.get(url);
        const promise = fetch(url, { headers: { Accept: 'application/json' } })
            .then(async response => {
                if (!response.ok) throw new Error(`Location data request failed (${response.status}).`);
                return toArray(await response.json());
            });
        cache.set(url, promise);
        return promise;
    };

    const rememberRegions = items => {
        items.forEach(item => {
            if (item?.code) regionsByCode.set(String(item.code), item);
        });
        return items;
    };

    const rememberProvinces = (items, region) => {
        items.forEach(item => {
            if (item?.code) provincesByCode.set(String(item.code), { ...item, region });
        });
        return items;
    };

    const rememberCities = (items, provinceCode = '', regionCode = '') => {
        items.forEach(item => {
            if (!item?.code) return;
            citiesByCode.set(String(item.code), {
                ...item,
                provinceCode: String(item.provinceCode || provinceCode || ''),
                regionCode: String(item.regionCode || regionCode || '')
            });
        });
        return items;
    };

    const listRegions = async () => rememberRegions(await requestList('/regions'));

    const listProvinces = async regionCode => {
        const region = regionsByCode.get(String(regionCode));
        return rememberProvinces(
            await requestList(`/regions/${encodeURIComponent(regionCode)}/provinces`),
            region
        );
    };

    const listAllProvinces = async () => {
        const items = await requestList('/provinces');
        items.forEach(item => {
            if (item?.code) provincesByCode.set(String(item.code), item);
        });
        return items;
    };

    const listCities = async provinceCode => {
        const province = provincesByCode.get(String(provinceCode));
        return rememberCities(
            await requestList(`/provinces/${encodeURIComponent(provinceCode)}/cities-municipalities`),
            provinceCode,
            province?.region?.code || province?.regionCode || ''
        );
    };

    const listCitiesByRegion = async regionCode => {
        const provinces = await listProvinces(regionCode);
        const cities = await requestList(`/regions/${encodeURIComponent(regionCode)}/cities-municipalities`);
        return rememberCities(cities.map(city => {
            const province = provinces.find(item => String(item.code) === String(city.provinceCode || city.province?.code || ''));
            return {
                ...city,
                regionCode: String(regionCode),
                provinceCode: String(city.provinceCode || province?.code || '')
            };
        }), '', regionCode);
    };

    const listBarangays = async cityCode => {
        const items = await requestList(`/cities-municipalities/${encodeURIComponent(cityCode)}/barangays`);
        return items.map(item => ({ ...item, cityCode: String(cityCode) }));
    };

    window.DatihanLocations = {
        listRegions,
        listProvinces,
        listAllProvinces,
        listCities,
        listCitiesByRegion,
        listBarangays
    };
})();
