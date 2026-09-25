(() => {
    // DATIHAN.PH currently treats postal codes as optional. Keep a hidden
    // compatibility field so the existing address form can continue working
    // until the Supabase address schema is migrated.
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

    const hidePostalFromCards = () => {
        document.querySelectorAll('.address-lines').forEach(el => {
            el.innerHTML = el.innerHTML.replace(/\s+\d{4}(<br>|$)/g, '$1');
        });
    };

    const init = () => {
        hidePostalField();
        disablePostalLookup();
        stripPostalForApi();
        hidePostalFromCards();
    };

    init();
    document.addEventListener('DOMContentLoaded', init, { once: true });
    new MutationObserver(() => {
        hidePostalField();
        disablePostalLookup();
        stripPostalForApi();
        hidePostalFromCards();
    }).observe(document.body, { childList: true, subtree: true });
})();
