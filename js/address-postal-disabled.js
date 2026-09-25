(() => {
    // Postal code is currently optional in DATIHAN.PH.
    // Keep a hidden compatibility field for the existing Supabase schema,
    // but do not perform any postal-code lookup or DOM observation.
    const hidePostalField = () => {
        const input = document.getElementById('address-postal');
        if (!input) return;
        const field = input.closest('.field');
        if (field) field.hidden = true;
        input.value = '0000';
    };

    const disablePostalLookup = () => {
        if (window.DatihanLocations) {
            window.DatihanLocations.getBarangayPostalCode = async () => '0000';
        }
    };

    const stripPostalForApi = () => {
        const api = window.DatihanAddressAPI;
        if (!api || api.__postalDisabled) return;
        ['create', 'update'].forEach(method => {
            if (typeof api[method] !== 'function') return;
            const original = api[method].bind(api);
            api[method] = async (...args) => {
                if (args.length && args[args.length - 1] && typeof args[args.length - 1] === 'object') {
                    const payload = { ...args[args.length - 1] };
                    delete payload.postal_code;
                    args[args.length - 1] = payload;
                }
                return original(...args);
            };
        });
        api.__postalDisabled = true;
    };

    const init = () => {
        hidePostalField();
        disablePostalLookup();
        stripPostalForApi();
    };

    // Run once after the script loads. Do NOT attach a MutationObserver here:
    // repeatedly rewriting the address cards caused an infinite DOM mutation loop
    // and made the page unresponsive.
    init();
})();
