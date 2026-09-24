const supabase = window.datihanSupabase;
let modal, form, editingId = null, addresses = [], initialized = false;

const statusEl = () => document.getElementById('address-status');
const formStatusEl = () => document.getElementById('address-form-status');

const showStatus = (message, type = 'success') => {
    const el = statusEl();
    if (el) {
        el.textContent = message;
        el.className = `address-status ${type}`;
    }
};

const showFormStatus = (message, type = 'success') => {
    const el = formStatusEl();
    if (el) {
        el.textContent = message;
        el.className = `address-form-status ${type}`;
    }
};

const closeModal = () => {
    const m = document.getElementById('address-modal');
    if (m) m.hidden = true;
    form?.reset();
    editingId = null;
    showFormStatus('');
    const t = document.getElementById('address-modal-title');
    if (t) t.textContent = 'Add address';
};

const openModal = (address = null) => {
    const m = document.getElementById('address-modal');
    if (!m) return;

    editingId = address?.id || null;

    const t = document.getElementById('address-modal-title');
    if (t) t.textContent = address ? 'Edit address' : 'Add address';

    form?.reset();
    showFormStatus('');

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

    m.hidden = false;
};

window.openAddressModal = openModal;

const render = () => {
    const l = document.getElementById('address-list');
    const e = document.getElementById('empty-addresses');
    if (!l || !e) return;

    l.innerHTML = '';
    e.hidden = addresses.length !== 0;

    addresses.forEach(a => {
        const card = document.createElement('article');
        card.className = `address-card${a.is_default ? ' default' : ''}`;
        card.dataset.id = a.id;

        card.innerHTML = `
            <div class="address-top">
                <div>
                    <span class="address-label"></span>
                    ${a.is_default ? '<span class="default-badge">Default</span>' : ''}
                </div>
                <button class="text-button delete-address" type="button">Delete</button>
            </div>
            <p class="address-name"></p>
            <p class="address-lines"></p>
            <p class="address-phone"></p>
            <div class="address-actions">
                <button class="button button-secondary edit-address" type="button">Edit</button>
                ${a.is_default ? '' : '<button class="text-button set-default" type="button">Set as default</button>'}
            </div>
        `;

        card.querySelector('.address-label').textContent = a.label || 'Address';
        card.querySelector('.address-name').textContent = `${a.first_name || ''} ${a.last_name || ''}`.trim();
        card.querySelector('.address-lines').innerHTML = `${a.address_line || ''}<br>${a.city || ''}, ${a.province || ''} ${a.postal_code || ''}<br>Philippines`;
        card.querySelector('.address-phone').textContent = a.phone || '';

        l.appendChild(card);
    });
};

const getSession = async () => {
    if (!supabase) throw new Error('Supabase client is not available.');

    const r = await supabase.auth.getSession();
    if (r.error) throw r.error;
    if (!r.data.session) throw new Error('Your session has expired. Please log in again.');

    return r.data.session;
};

const loadAddresses = async () => {
    try {
        const session = await getSession();

        showStatus('Loading addresses...', 'success');

        const r = await supabase
            .from('saved_addresses')
            .select('*')
            .eq('user_id', session.user.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false });

        if (r.error) throw r.error;

        addresses = r.data || [];
        render();

        if (!addresses.length) {
            showStatus('No saved addresses yet.', 'success');
        } else {
            showStatus('', 'success');
        }
    } catch (e) {
        console.error('Load addresses error:', e);
        showStatus(`Unable to load addresses: ${e.message || e}`, 'error');
    }
};

const validate = () => {
    const p = document.getElementById('address-phone').value.trim();
    const z = document.getElementById('address-postal').value.trim();

    if (!/^09\d{9}$/.test(p)) {
        showFormStatus('Contact number must be exactly 11 digits and start with 09.', 'error');
        return false;
    }

    if (!/^\d{4}$/.test(z)) {
        showFormStatus('Postal code must be exactly 4 digits.', 'error');
        return false;
    }

    return true;
};

async function saveAddress(e) {
    e?.preventDefault();

    const saveButton = document.getElementById('save-address-button');
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }

    showFormStatus('Saving address...', 'success');

    try {
        if (!validate()) return;

        const session = await getSession();

        const payload = {
            user_id: session.user.id,
            label: document.getElementById('address-label-input').value.trim(),
            first_name: document.getElementById('address-first-name').value.trim(),
            last_name: document.getElementById('address-last-name').value.trim(),
            address_line: document.getElementById('address-line').value.trim(),
            city: document.getElementById('address-city').value.trim(),
            province: document.getElementById('address-province').value.trim(),
            postal_code: document.getElementById('address-postal').value.trim(),
            phone: document.getElementById('address-phone').value.trim(),
            is_default: document.getElementById('address-default').checked
        };

        if (!payload.label || !payload.first_name || !payload.last_name || !payload.address_line || !payload.city || !payload.province) {
            throw new Error('Please complete all required address fields.');
        }

        if (payload.is_default) {
            const r = await supabase
                .from('saved_addresses')
                .update({ is_default: false })
                .eq('user_id', session.user.id);

            if (r.error) throw r.error;
        }

        let result;

        if (editingId) {
            result = await supabase
                .from('saved_addresses')
                .update(payload)
                .eq('id', editingId)
                .eq('user_id', session.user.id)
                .select()
                .single();
        } else {
            result = await supabase
                .from('saved_addresses')
                .insert(payload)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        const wasEditing = !!editingId;
        closeModal();
        await loadAddresses();
        showStatus(wasEditing ? 'Address updated successfully.' : 'Address saved successfully.', 'success');
    } catch (e) {
        console.error('Saved address error:', e);
        showFormStatus(`Save failed: ${e.message || e}`, 'error');
        showStatus(`Save failed: ${e.message || e}`, 'error');
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save address';
        }
    }
}

async function deleteAddress(id) {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
        const session = await getSession();

        const r = await supabase
            .from('saved_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', session.user.id);

        if (r.error) throw r.error;

        await loadAddresses();
        showStatus('Address deleted successfully.', 'success');
    } catch (e) {
        console.error(e);
        showStatus(`Delete failed: ${e.message || e}`, 'error');
    }
}

async function setDefaultAddress(id) {
    try {
        const session = await getSession();

        const clear = await supabase
            .from('saved_addresses')
            .update({ is_default: false })
            .eq('user_id', session.user.id);

        if (clear.error) throw clear.error;

        const r = await supabase
            .from('saved_addresses')
            .update({ is_default: true })
            .eq('id', id)
            .eq('user_id', session.user.id);

        if (r.error) throw r.error;

        await loadAddresses();
        showStatus('Default address updated successfully.', 'success');
    } catch (e) {
        console.error(e);
        showStatus(`Could not set default address: ${e.message || e}`, 'error');
    }
}

window.saveAddress = saveAddress;

function initAddressPage() {
    if (initialized) return;
    initialized = true;

    modal = document.getElementById('address-modal');
    form = document.getElementById('address-form');

    const addButton = document.getElementById('add-address');
    if (addButton) {
        addButton.addEventListener('click', () => openModal());
    }

    document.getElementById('close-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('address-modal-backdrop')?.addEventListener('click', closeModal);

    form?.addEventListener('submit', saveAddress);

    document.getElementById('address-list')?.addEventListener('click', e => {
        const card = e.target.closest('.address-card');
        if (!card) return;

        const id = card.dataset.id;
        const address = addresses.find(a => String(a.id) === String(id));

        if (e.target.closest('.edit-address')) {
            openModal(address);
        } else if (e.target.closest('.delete-address')) {
            deleteAddress(id);
        } else if (e.target.closest('.set-default')) {
            setDefaultAddress(id);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal && !modal.hidden) closeModal();
    });

    loadAddresses();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAddressPage, { once: true });
} else {
    initAddressPage();
}

window.addEventListener('datihan-auth-ready', () => {
    if (!initialized) initAddressPage();
});
