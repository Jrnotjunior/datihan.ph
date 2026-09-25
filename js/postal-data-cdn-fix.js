(() => {
    const nativeFetch = window.fetch.bind(window);
    const RAW_PREFIX = 'https://raw.githubusercontent.com/open-admin-data/philippines-administrative-divisions/main/data/barangay-by-region/';
    const CDN_PREFIX = 'https://cdn.jsdelivr.net/gh/open-admin-data/philippines-administrative-divisions@main/data/barangay-by-region/';

    window.fetch = (input, init) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url.startsWith(RAW_PREFIX)) {
            const redirectedUrl = CDN_PREFIX + url.slice(RAW_PREFIX.length);
            if (typeof input === 'string') return nativeFetch(redirectedUrl, init);
            return nativeFetch(new Request(redirectedUrl, input), init);
        }
        return nativeFetch(input, init);
    };
})();
