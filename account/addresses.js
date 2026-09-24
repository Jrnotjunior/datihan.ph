const API = window.DatihanAddressAPI;
let modal;
let form;
let editingId = null;
let addresses = [];

const statusEl = () => document.getElementById('address-status');
const formStatusEl = () => document.getElementById('address-form-status');

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

const setSaving = saving => {
    const button = document.getElementById('save-address-button');
    if (!button) return;
    button.disabled = saving;
    button.textContent = saving ? 'Saving...' : 'Save address';
};

const closeModal = () => {
    if (modal) modal.hidden = true;
    if (form) form.reset();
    editingId = null;
    showFormStatus('');
    const title = document.getElementById('address-modal-title');
    if (title) title.textContent = 'Add address';
};

const openModal = (address = null) => {
    if (!modal) return;
    editingId = address?.id || null;
    if (form) form.reset();
    showFormStatus('');

    const title = document.getElementById('address-modal-title');
    if (title) title.textContent = address ? 'Edit address' : 'Add address';

    if (address) {
        document.getElementById('address-label-input').value = address.label || '';
        document.getElementById('address-first-name').value = address.first_name || '';
        document.getElementById('address-last-name').value = address.last_name || '';
        document.getElementById('address-line').value = address.address_line || '';
        document.getElementById('address-city').value = address.city || '';
        document.getElementById('address-province').value = address.province || '';
        document.getElementById('address-postal').value = address.postal_code || '';
        document.getElementById('address-phone').value = address.phone || '';
        document.getElementById('address-default').checked = !!address.is_default;
    }

    modal.hidden = false;
};

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
        card.innerHTML = `
            <div class="address-top">
                <div>
                    <span class="address-label"></span>
                    ${address.is_default ? '<span class="default-badge">Default</span>' : ''}
                </div>
                <button class="text-button delete-address" type="button">Delete</button>
            </div>
            <p class="address-name"></p>
            <p class="address-lines"></p>
            <p class="address-phone"></p>
            <div class="address-actions">
                <button class="button button-secondary edit-address" type="button">Edit</button>
                ${address.is_default ? '' : '<button class="text-button set-default" type="button">Set as default</button>'}
            </div>`;

        card.querySelector('.address-label').textContent = address.label || 'Address';
        card.querySelector('.address-name').textContent = `${address.first_name || ''} ${address.last_name || ''}`.trim();
        card.querySelector('.address-lines').innerHTML = `${address.address_line || ''}<br>${address.city || ''}, ${address.province || ''} ${address.postal_code || ''}<br>Philippines`;
        card.querySelector('.address-phone').textContent = address.phone || '';
        list.appendChild(card);
    });
};

const loadAddresses = async () => {
    try {
        showStatus('Loading addresses...', 'success');
        addresses = await API.getAll();
        render();
        showStatus(addresses.length ? '' : 'No saved addresses yet.', 'success');
    } catch (error) {
        console.error('Load addresses error:', error);
        showStatus(`Unable to load addresses: ${error.message || error}`, 'error');
    }
};

const validate = () => {
    const requiredIds = [
        'address-label-input',
        'address-first-name',
        'address-last-name',
        'address-line',
        'address-city',
        'address-province'
    ];

    for (const id of requiredIds) {
        if (!document.getElementById(id)?.value.trim()) {
            showFormStatus('Please complete all required address fields.', 'error');
            return false;
        }
    }

    const phone = document.getElementById('address-phone').value.trim();
    const postal = document.getElementById('address-postal').value.trim();

    if (!/^09\d{9}$/.test(phone)) {
        showFormStatus('Contact number must be exactly 11 digits and start with 09.', 'error');
        return false;
    }

    if (!/^\d{4}$/.test(postal)) {
        showFormStatus('Postal code must be exactly 4 digits.', 'error');
        return false;
    }

    return true;
};

const getPayload = () => ({
    label: document.getElementById('address-label-input').value.trim(),
    first_name: document.getElementById('address-first-name').value.trim(),
    last_name: document.getElementById('address-last-name').value.trim(),
    address_line: document.getElementById('address-line').value.trim(),
    city: document.getElementById('address-city').value.trim(),
    province: document.getElementById('address-province').value.trim(),
    postal_code: document.getElementById('address-postal').value.trim(),
    phone: document.getElementById('address-phone').value.trim(),
    is_default: document.getElementById('address-default').checked
});

async function saveAddress(event) {
    event.preventDefault();
    if (!validate()) return;

    setSaving(true);
    showFormStatus('Saving address...', 'success');

    try {
        const payload = getPayload();
        const wasEditing = Boolean(editingId);

        if (wasEditing) {
            await API.update(editingId, payload);
        } else {
            await API.create(payload);
        }

        closeModal();
        await loadAddresses();
        showStatus(wasEditing ? 'Address updated successfully.' : 'Address saved successfully.', 'success');
    } catch (error) {
        console.error('Save address error:', error);
        showFormStatus(`Save failed: ${error.message || error}`, 'error');
    } finally {
        setSaving(false);
    }
}

async function deleteAddress(id) {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
        await API.remove(id);
        await loadAddresses();
        showStatus('Address deleted successfully.', 'success');
    } catch (error) {
        console.error('Delete address error:', error);
        showStatus(`Delete failed: ${error.message || error}`, 'error');
    }
}

async function setDefaultAddress(id) {
    try {
        await API.setDefault(id);
        await loadAddresses();
        showStatus('Default address updated successfully.', 'success');
    } catch (error) {
        console.error('Set default error:', error);
        showStatus(`Could not set default address: ${error.message || error}`, 'error');
    }
}

const init = () => {
    modal = document.getElementById('address-modal');
    form = document.getElementById('address-form');

    document.getElementById('add-address')?.addEventListener('click', () => openModal());
    document.getElementById('close-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('address-modal-backdrop')?.addEventListener('click', closeModal);
    form?.addEventListener('submit', saveAddress);

    document.getElementById('address-list')?.addEventListener('click', event => {
        const card = event.target.closest('.address-card');
        if (!card) return;
        const id = card.dataset.id;
        const address = addresses.find(item => String(item.id) === String(id));

        if (event.target.closest('.edit-address')) openModal(address);
        else if (event.target.closest('.delete-address')) deleteAddress(id);
        else if (event.target.closest('.set-default')) setDefaultAddress(id);
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && modal && !modal.hidden) closeModal();
    });

    loadAddresses();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
    init();
}
