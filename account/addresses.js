const API = window.DatihanAddressAPI;
const LOCATIONS = window.DatihanLocations;
let modal;
let form;
let deleteModal;
let editingId = null;
let pendingDeleteId = null;
let addresses = [];
let regions = [];
let allProvinces = [];
let locationLoading = false;

const statusEl = () => document.getElementById('address-status');
const formStatusEl = () => document.getElementById('address-form-status');
const regionEl = () => document.getElementById('address-region');
const provinceEl = () => document.getElementById('address-province');
const cityEl = () => document.getElementById('address-city');
const barangayEl = () => document.getElementById('address-barangay');

const showStatus = (message, type = 'success') => {
    const el = statusEl();
    if (!el) return;
    el.textContent = message;
    el.className = `address-status ${type}`;
};
const showFormStatus = (message, type = 'success') => {
    const el = formStatusEl();
    if (!el) return;
    el.textContent = message;
    el.className = `address-form-status ${type}`;
};
const showToast = (message, title = 'Success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        container.setAttribute('aria-live', 'polite');
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.innerHTML = '<div class="toast-icon" aria-hidden="true">✓</div><div class="toast-content"><div class="toast-title"></div><div class="toast-message"></div></div><button class="toast-close" type="button" aria-label="Close notification">×</button>';
    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message;
    const remove = () => toast.remove();
    toast.querySelector('.toast-close').addEventListener('click', remove);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(remove, 3500);
};
const setSaving = saving => {
    const button = document.getElementById('save-address-button');
    if (!button) return;
    button.disabled = saving;
    button.textContent = saving ? 'Saving...' : 'Save address';
};
const normalise = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/city of |municipality of /g, '').replace(/\s+city$|\s+municipality$/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const setOptions = (select, items, placeholder) => {
    select.innerHTML = '';
    const first = document.createElement('option');
    first.value = '';
    first.textContent = placeholder;
    select.appendChild(first);
    items.forEach(item => {
        const option = document.createElement('option');
        option.value = String(item.code);
        option.textContent = item.name;
        select.appendChild(option);
    });
};
const setDisabled = (select, disabled) => { select.disabled = disabled; };
const clearLocationFrom = level => {
    if (level <= 1) { setOptions(provinceEl(), [], 'Select province'); setDisabled(provinceEl(), true); }
    if (level <= 2) { setOptions(cityEl(), [], 'Select city / municipality'); setDisabled(cityEl(), true); }
    if (level <= 3) { setOptions(barangayEl(), [], 'Select barangay'); setDisabled(barangayEl(), true); }
};
const selectedRegion = () => regions.find(item => String(item.code) === regionEl().value);
const selectedProvince = () => allProvinces.find(item => String(item.code) === provinceEl().value);

const loadRegions = async () => {
    if (!LOCATIONS) throw new Error('Philippine location data is unavailable.');
    regions = await LOCATIONS.listRegions();
    setOptions(regionEl(), regions, 'Select region');
};
const loadProvincesForRegion = async (regionCode, preferredName = '') => {
    clearLocationFrom(1);
    if (!regionCode) return;
    const region = selectedRegion();
    if (/national capital region|ncr/i.test(String(region?.name || ''))) {
        const option = document.createElement('option');
        option.value = '__ncr__';
        option.textContent = 'Metro Manila';
        provinceEl().appendChild(option);
        setDisabled(provinceEl(), false);
        if (preferredName && normalise(preferredName) === 'metro manila') provinceEl().value = '__ncr__';
        return;
    }
    const provinces = await LOCATIONS.listProvinces(regionCode);
    setOptions(provinceEl(), provinces, 'Select province');
    setDisabled(provinceEl(), false);
    if (preferredName) {
        const match = provinces.find(item => normalise(item.name) === normalise(preferredName));
        if (match) provinceEl().value = String(match.code);
    }
};
const loadCitiesForSelection = async (preferredName = '') => {
    clearLocationFrom(2);
    const region = selectedRegion();
    const province = selectedProvince();
    if (!region) return;
    const cities = provinceEl().value === '__ncr__' ? await LOCATIONS.listCitiesByRegion(region.code) : province ? await LOCATIONS.listCities(province.code) : [];
    setOptions(cityEl(), cities, 'Select city / municipality');
    setDisabled(cityEl(), false);
    if (preferredName) {
        const match = cities.find(item => normalise(item.name) === normalise(preferredName));
        if (match) cityEl().value = String(match.code);
    }
};
const loadBarangaysForCity = async (preferredName = '') => {
    clearLocationFrom(3);
    const cityCode = cityEl().value;
    if (!cityCode) return;
    const barangays = await LOCATIONS.listBarangays(cityCode);
    setOptions(barangayEl(), barangays, 'Select barangay');
    setDisabled(barangayEl(), false);
    if (preferredName) {
        const match = barangays.find(item => normalise(item.name) === normalise(preferredName));
        if (match) barangayEl().value = String(match.code);
    }
};

const setLocationFromAddress = async address => {
    const provinceName = normalise(address?.province);
    const cityName = normalise(address?.city);
    let region = null;
    if (provinceName === 'metro manila' || provinceName === 'ncr' || /valenzuela|manila|quezon city|makati|taguig|pasig|pasay|marikina|malabon|navotas|paranaque|muntinlupa|mandaluyong|san juan|caloocan/.test(cityName)) region = regions.find(item => /national capital region|ncr/i.test(String(item.name)));
    if (!region) {
        const match = allProvinces.find(item => normalise(item.name) === provinceName);
        if (match?.region?.code) region = regions.find(item => String(item.code) === String(match.region.code));
    }
    if (!region) throw new Error('Could not match this saved address to a Philippine region.');
    regionEl().value = String(region.code);
    await loadProvincesForRegion(region.code, address.province);
    await loadCitiesForSelection(address.city);
    await loadBarangaysForCity(address.barangay);
};
const resetLocationFields = () => { regionEl().value = ''; clearLocationFrom(1); };
const closeModal = () => {
    if (modal) modal.hidden = true;
    form?.reset();
    resetLocationFields();
    editingId = null;
    locationLoading = false;
    showFormStatus('');
    const title = document.getElementById('address-modal-title');
    if (title) title.textContent = 'Add address';
};
const openModal = async (address = null) => {
    if (!modal) return;
    editingId = address?.id || null;
    form?.reset();
    resetLocationFields();
    showFormStatus('');
    const title = document.getElementById('address-modal-title');
    if (title) title.textContent = address ? 'Edit address' : 'Add address';
    document.getElementById('address-label-input').value = address?.label || '';
    document.getElementById('address-first-name').value = address?.first_name || '';
    document.getElementById('address-last-name').value = address?.last_name || '';
    document.getElementById('address-line').value = address?.address_line || '';
    document.getElementById('address-phone').value = address?.phone || '';
    document.getElementById('address-default').checked = !!address?.is_default;
    document.getElementById('save-address-button').disabled = true;
    modal.hidden = false;
    try {
        locationLoading = true;
        if (address) { showFormStatus('Loading saved location...', 'success'); await setLocationFromAddress(address); }
        document.getElementById('save-address-button').disabled = false;
        showFormStatus('');
    } catch (error) {
        console.error('Location form error:', error);
        document.getElementById('save-address-button').disabled = false;
        showFormStatus(`Unable to load location data: ${error.message || error}`, 'error');
    } finally { locationLoading = false; }
};
const openDeleteConfirmation = id => { if (!deleteModal) return; pendingDeleteId = id; deleteModal.hidden = false; };
const closeDeleteConfirmation = () => { if (deleteModal) deleteModal.hidden = true; pendingDeleteId = null; };

const render = () => {
    const list = document.getElementById('address-list');
    const empty = document.getElementById('empty-addresses');
    if (!list || !empty) return;
    list.innerHTML = '';
    empty.hidden = addresses.length !== 0;
    addresses.forEach(address => {
        const card = document.createElement('article');
        card.className = `address-card${address.is_default ? ' default' : ''}`;
        card.dataset.id = address.id;
        card.innerHTML = `<div class="address-top"><div><span class="address-label"></span>${address.is_default ? '<span class="default-badge">Default</span>' : ''}</div><button class="text-button delete-address" type="button">Delete</button></div><p class="address-name"></p><p class="address-lines"></p><p class="address-phone"></p><div class="address-actions"><button class="button button-secondary edit-address" type="button">Edit</button>${address.is_default ? '' : '<button class="text-button set-default" type="button">Set as default</button>'}</div>`;
        card.querySelector('.address-label').textContent = address.label || 'Address';
        card.querySelector('.address-name').textContent = `${address.first_name || ''} ${address.last_name || ''}`.trim();
        const barangayLine = address.barangay ? `${address.barangay}, ` : '';
        card.querySelector('.address-lines').innerHTML = `${address.address_line || ''}<br>${barangayLine}${address.city || ''}, ${address.province || ''}<br>Philippines`;
        card.querySelector('.address-phone').textContent = address.phone || '';
        list.appendChild(card);
    });
};
const loadAddresses = async () => {
    try { showStatus('Loading addresses...', 'success'); addresses = await API.getAll(); render(); showStatus(addresses.length ? '' : 'No saved addresses yet.', 'success'); }
    catch (error) { console.error('Load addresses error:', error); showStatus(`Unable to load addresses: ${error.message || error}`, 'error'); }
};
const validate = () => {
    const requiredIds = ['address-label-input','address-first-name','address-last-name','address-line','address-region','address-province','address-city','address-barangay'];
    for (const id of requiredIds) if (!document.getElementById(id)?.value.trim()) { showFormStatus('Please complete all required address fields.', 'error'); return false; }
    const phone = document.getElementById('address-phone').value.trim();
    if (!/^09\d{9}$/.test(phone)) { showFormStatus('Contact number must be exactly 11 digits and start with 09.', 'error'); return false; }
    return true;
};
const getPayload = () => ({
    label: document.getElementById('address-label-input').value.trim(),
    first_name: document.getElementById('address-first-name').value.trim(),
    last_name: document.getElementById('address-last-name').value.trim(),
    address_line: document.getElementById('address-line').value.trim(),
    barangay: barangayEl().selectedOptions[0]?.textContent.trim() || '',
    city: cityEl().selectedOptions[0]?.textContent.trim() || '',
    province: provinceEl().selectedOptions[0]?.textContent.trim() || '',
    phone: document.getElementById('address-phone').value.trim(),
    is_default: document.getElementById('address-default').checked
});
async function saveAddress(event) {
    event.preventDefault();
    if (locationLoading || !validate()) return;
    setSaving(true); showFormStatus('Saving address...', 'success');
    try {
        const payload = getPayload();
        const wasEditing = Boolean(editingId);
        if (wasEditing) await API.update(editingId, payload); else await API.create(payload);
        closeModal(); await loadAddresses();
        showToast(wasEditing ? 'Your address has been updated.' : 'Your new address has been saved.', wasEditing ? 'Address updated' : 'Address saved');
    } catch (error) { console.error('Save address error:', error); showFormStatus(`Save failed: ${error.message || error}`, 'error'); }
    finally { setSaving(false); }
}
async function deleteAddress(id) {
    try { await API.remove(id); await loadAddresses(); showToast('The address has been removed.', 'Address deleted'); }
    catch (error) { console.error('Delete address error:', error); showStatus(`Delete failed: ${error.message || error}`, 'error'); }
}
async function setDefaultAddress(id) {
    try { await API.setDefault(id); await loadAddresses(); showToast('This address is now your default shipping address.', 'Default address updated'); }
    catch (error) { console.error('Set default error:', error); showStatus(`Could not set default address: ${error.message || error}`, 'error'); }
}

const init = async () => {
    modal = document.getElementById('address-modal');
    form = document.getElementById('address-form');
    deleteModal = document.getElementById('delete-confirm-modal');
    document.getElementById('add-address')?.addEventListener('click', () => openModal());
    document.getElementById('close-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('address-modal-backdrop')?.addEventListener('click', closeModal);
    form?.addEventListener('submit', saveAddress);
    regionEl()?.addEventListener('change', async () => { if (locationLoading) return; try { locationLoading = true; await loadProvincesForRegion(regionEl().value); } catch (error) { showFormStatus(`Unable to load provinces: ${error.message || error}`, 'error'); } finally { locationLoading = false; } });
    provinceEl()?.addEventListener('change', async () => { if (locationLoading) return; try { locationLoading = true; await loadCitiesForSelection(); } catch (error) { showFormStatus(`Unable to load cities: ${error.message || error}`, 'error'); } finally { locationLoading = false; } });
    cityEl()?.addEventListener('change', async () => { if (locationLoading) return; try { locationLoading = true; await loadBarangaysForCity(); } catch (error) { showFormStatus(`Unable to load barangays: ${error.message || error}`, 'error'); } finally { locationLoading = false; } });
    document.getElementById('delete-cancel-button')?.addEventListener('click', closeDeleteConfirmation);
    document.getElementById('delete-confirm-backdrop')?.addEventListener('click', closeDeleteConfirmation);
    document.getElementById('delete-confirm-button')?.addEventListener('click', async () => { const id = pendingDeleteId; if (!id) return; closeDeleteConfirmation(); await deleteAddress(id); });
    document.getElementById('address-list')?.addEventListener('click', async event => {
        const card = event.target.closest('.address-card'); if (!card) return;
        const id = card.dataset.id; const address = addresses.find(item => String(item.id) === String(id));
        if (event.target.closest('.edit-address')) await openModal(address);
        else if (event.target.closest('.delete-address')) openDeleteConfirmation(id);
        else if (event.target.closest('.set-default')) await setDefaultAddress(id);
    });
    document.addEventListener('keydown', event => { if (event.key !== 'Escape') return; if (deleteModal && !deleteModal.hidden) closeDeleteConfirmation(); else if (modal && !modal.hidden) closeModal(); });
    try { await Promise.all([loadRegions(), LOCATIONS.listAllProvinces().then(data => { allProvinces = data; })]); }
    catch (error) { console.error('Location initialization error:', error); showStatus(`Unable to load Philippine locations: ${error.message || error}`, 'error'); }
    await loadAddresses();
};
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
