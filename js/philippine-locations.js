(() => {
    const API_V2 = 'https://psgc.cloud/api/v2';
    const POSTAL_BASE = 'https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/data/barangay-by-region';

    const cache = new Map();
    const regionsByCode = new Map();
    const provincesByCode = new Map();
    const citiesByCode = new Map();
    const postalRegionCache = new Map();

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

    const regionPostalFile = region => {
        const code = String(region?.code || '').toUpperCase();
        const name = String(region?.name || '');
        const map = {
            '0100000000': 'ilocos-region-R01', 'R01': 'ilocos-region-R01',
            '0200000000': 'cagayan-valley-R02', 'R02': 'cagayan-valley-R02',
            '0300000000': 'central-luzon-R03', 'R03': 'central-luzon-R03',
            '0400000000': 'calabarzon-R04A', 'R04A': 'calabarzon-R04A',
            '0500000000': 'bicol-region-R05', 'R05': 'bicol-region-R05',
            '0600000000': 'western-visayas-R06', 'R06': 'western-visayas-R06',
            '0700000000': 'central-visayas-R07', 'R07': 'central-visayas-R07',
            '0800000000': 'eastern-visayas-R08', 'R08': 'eastern-visayas-R08',
            '0900000000': 'zamboanga-peninsula-R09', 'R09': 'zamboanga-peninsula-R09',
            '1000000000': 'northern-mindanao-R10', 'R10': 'northern-mindanao-R10',
            '1100000000': 'davao-region-R11', 'R11': 'davao-region-R11',
            '1200000000': 'soccsksargen-R12', 'R12': 'soccsksargen-R12',
            '1300000000': 'national-capital-region-NCR', 'NCR': 'national-capital-region-NCR',
            '1400000000': 'cordillera-administrative-region-CAR', 'CAR': 'cordillera-administrative-region-CAR',
            '1500000000': 'autonomous-region-in-muslim-mindanao-ARMM', 'ARMM': 'autonomous-region-in-muslim-mindanao-ARMM',
            '1600000000': 'caraga-R13', 'R13': 'caraga-R13',
            '1700000000': 'mimaropa-region-R17', 'R17': 'mimaropa-region-R17'
        };
        if (map[code]) return map[code];
        if (/national capital region|\bncr\b/i.test(name)) return 'national-capital-region-NCR';
        const roman = name.match(/Region\s+([IVXLCDM]+)\b/i)?.[1];
        const romanMap = { I:'R01', II:'R02', III:'R03', IV:'R04A', V:'R05', VI:'R06', VII:'R07', VIII:'R08', IX:'R09', X:'R10', XI:'R11', XII:'R12', XIII:'R13', XVII:'R17' };
        if (roman && romanMap[roman]) {
            const suffix = romanMap[roman];
            const label = name.replace(/^Region\s+[IVXLCDM]+\s*/i, '').replace(/\s*\([^)]*\)\s*/g, '').trim();
            return `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${suffix}`;
        }
        return null;
    };

    const codeVariants = code => {
        const digits = String(code || '').replace(/\D/g, '');
        const variants = [digits];
        if (digits.length === 10) variants.push(digits.slice(0, 9));
        if (digits.length === 9) variants.push(`${digits}0`);
        return [...new Set(variants.filter(Boolean))];
    };

    const selectedContext = () => {
        const regionCode = document.getElementById('address-region')?.value || '';
        const provinceCode = document.getElementById('address-province')?.value || '';
        const cityCode = document.getElementById('address-city')?.value || '';
        const region = regionsByCode.get(String(regionCode));
        const province = provinceCode === '__ncr__'
            ? { code: '1300000000', name: 'Metro Manila', region }
            : provincesByCode.get(String(provinceCode));
        const city = citiesByCode.get(String(cityCode));
        return { region, province, city };
    };

    const loadRegionPostalData = async region => {
        const file = regionPostalFile(region);
        if (!file) throw new Error('Barangay postal location context is unavailable.');
        if (postalRegionCache.has(file)) return postalRegionCache.get(file);

        const url = `${POSTAL_BASE}/${encodeURIComponent(file)}.json`;
        const promise = fetch(url, { headers: { Accept: 'application/json' } })
            .then(async response => {
                if (!response.ok) throw new Error(`Barangay postal data request failed (${response.status}).`);
                const payload = await response.json();
                return Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];
            });
        postalRegionCache.set(file, promise);
        return promise;
    };

    const getBarangayPostalCode = async barangayCode => {
        const { region, city } = selectedContext();
        if (!region || !city) throw new Error('Barangay postal location context is unavailable.');

        const rows = await loadRegionPostalData(region);
        const variants = codeVariants(barangayCode);
        const cityCode = String(city.code || '').replace(/\D/g, '');
        const cityVariants = codeVariants(cityCode);

        const record = rows.find(item => {
            const id = String(item?.id || item?.code?.id || item?.code || '').replace(/\D/g, '');
            if (!variants.includes(id)) return false;
            const parentId = String(item?.parent?.id || '').replace(/\D/g, '');
            return !parentId || cityVariants.includes(parentId);
        });

        if (!record) throw new Error('Postal code is not available for the selected barangay.');
        const values = [record.postal_code, record.zip_code, ...(Array.isArray(record.zip_codes) ? record.zip_codes : [])];
        const zip = values.map(value => String(value || '').replace(/\D/g, '')).find(value => /^\d{4}$/.test(value));
        if (!zip) throw new Error('Postal code is not available for the selected barangay.');
        return zip;
    };

    const bindPostalField = () => {
        const barangay = document.getElementById('address-barangay');
        const postal = document.getElementById('address-postal');
        if (!barangay || !postal || barangay.dataset.postalBound === 'true') return;
        barangay.dataset.postalBound = 'true';
        barangay.addEventListener('change', async () => {
            postal.value = '';
            if (!barangay.value) return;
            try {
                postal.value = await getBarangayPostalCode(barangay.value);
                const status = document.getElementById('address-form-status');
                if (status?.classList.contains('error')) {
                    status.textContent = '';
                    status.className = 'address-form-status';
                }
            } catch (error) {
                const status = document.getElementById('address-form-status');
                if (status) {
                    status.textContent = error.message || String(error);
                    status.className = 'address-form-status error';
                }
            }
        });
    };

    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', bindPostalField, { once: true })
        : bindPostalField();

    window.DatihanLocations = {
        listRegions,
        listProvinces,
        listAllProvinces,
        listCities,
        listCitiesByRegion,
        listBarangays,
        getBarangayPostalCode
    };
})();
