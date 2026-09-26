(() => {
  const BASE_CART_KEY = "datihan_cart";
  const BASE_SELECTED_KEY = "datihan_selected_cart_items";
  let userId = null;
  let readyPromise = null;

  const safeParse = (value, fallback) => {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (_) {
      return fallback;
    }
  };

  const accountKey = (base) => userId ? `${base}:${userId}` : null;

  const syncLegacyKeys = () => {
    if (!userId) {
      localStorage.removeItem(BASE_CART_KEY);
      localStorage.removeItem(BASE_SELECTED_KEY);
      return;
    }

    const cart = safeParse(localStorage.getItem(accountKey(BASE_CART_KEY)) || "[]", []);
    const selected = safeParse(localStorage.getItem(accountKey(BASE_SELECTED_KEY)) || "null", null);
    localStorage.setItem(BASE_CART_KEY, JSON.stringify(Array.isArray(cart) ? cart : []));
    if (Array.isArray(selected)) localStorage.setItem(BASE_SELECTED_KEY, JSON.stringify(selected.map(String)));
    else localStorage.removeItem(BASE_SELECTED_KEY);
  };

  const ready = async () => {
    if (readyPromise) return readyPromise;
    readyPromise = (async () => {
      try {
        if (!window.datihanSupabase) {
          userId = null;
          syncLegacyKeys();
          return null;
        }
        const { data, error } = await window.datihanSupabase.auth.getSession();
        if (error) throw error;
        userId = data.session?.user?.id || null;
        syncLegacyKeys();
        window.dispatchEvent(new Event("datihan-cart-updated"));
        return userId;
      } catch (error) {
        console.error("Cart account setup error:", error);
        userId = null;
        syncLegacyKeys();
        window.dispatchEvent(new Event("datihan-cart-updated"));
        return null;
      }
    })();
    return readyPromise;
  };

  const read = () => {
    if (!userId) return [];
    const cart = safeParse(localStorage.getItem(accountKey(BASE_CART_KEY)) || "[]", []);
    return Array.isArray(cart) ? cart : [];
  };

  const write = (cart) => {
    if (!userId) return false;
    const safeCart = Array.isArray(cart) ? cart : [];
    localStorage.setItem(accountKey(BASE_CART_KEY), JSON.stringify(safeCart));
    localStorage.setItem(BASE_CART_KEY, JSON.stringify(safeCart));
    window.dispatchEvent(new Event("datihan-cart-updated"));
    return true;
  };

  const readSelected = () => {
    if (!userId) return null;
    const value = safeParse(localStorage.getItem(accountKey(BASE_SELECTED_KEY)) || "null", null);
    return Array.isArray(value) ? value.map(String) : null;
  };

  const writeSelected = (ids) => {
    if (!userId) return false;
    const safeIds = Array.isArray(ids) ? ids.map(String) : [];
    localStorage.setItem(accountKey(BASE_SELECTED_KEY), JSON.stringify(safeIds));
    localStorage.setItem(BASE_SELECTED_KEY, JSON.stringify(safeIds));
    return true;
  };

  const clearLegacy = () => {
    localStorage.removeItem(BASE_CART_KEY);
    localStorage.removeItem(BASE_SELECTED_KEY);
  };

  window.datihanCartStore = {
    ready,
    isAuthenticated: () => Boolean(userId),
    userId: () => userId,
    read,
    write,
    readSelected,
    writeSelected,
    clearLegacy
  };
})();
