const supabase = window.datihanSupabase;

let modal = null;
let form = null;
let editingId = null;
let addresses = [];
let authSession = null;
let initialized = false;

const statusEl = () => document.getElementById('address-status');

const showStatus = (message, type = 'success') => {
    const el = statusEl();
    if (!el) return;

    el.textContent = message;
    el.className = `address-status ${type}`;
    el.hidden = !message;
};

const closeModal = () => {
    const m = document.getElementById('address-modal');
    if (m) m.hidden = true;

    if (form) form.reset();

    editingId = null;

    const title = document.getElementById('address-modal-title');
    if (title) title.textContent = 'Add address';
};

const openModal = (address = null) => {
    const m = document.getElementById('address-modal');
    if (!m) return;

    editingId = address?.id || null;

    const title = document.getElementById('address-modal-title');
    if (title) title.textContent = address ? 'Edit address' : 'Add address';

    if (form) form.reset();

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

const render = () => {
    const list = document.getElementById('address-list');
    const empty = document.getElementById('empty-addresses');
    if (!list || !empty) return;

    list.innerHTML = '';
    empty.hidden = addresses.length !== 0;

    addresses.forEach((address) => {
        const card = document.createElement('article');
        card.className = `address-card${address.is_default ? ' default' : ''}`;
        card.dataset.id = address.id;

        const top = document.createElement('div');
        top.className = 'address-top';

        const titleWrapper = document.createElement('div');
        const label = document.createElement('span');
        label.className = 'address-label';
        label.textContent = address.label || 'Address';
        titleWrapper.appendChild(label);

        if (address.is_default) {
            const badge = document.createElement('span');
            badge.className = 'default-badge';
            badge.textContent = 'Default';
            titleWrapper.appendChild(badge);
        }

        const deleteButton = document.createElement('button');
        deleteButton.className = 'text-button delete-address';
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';

        top.appendChild(titleWrapper);
        top.appendChild(deleteButton);

        const name = document.createElement('p');
        name.className = 'address-name';
        name.textContent = `${address.first_name || ''} ${address.last_name || ''}`.trim();

        const lines = document.createElement('p');
        lines.className = 'address-lines';
        lines.appendChild(document.createTextNode(address.address_line || ''));
        lines.appendChild(document.createElement('br'));
        lines.appendChild(document.createTextNode(`${address.city || ''}, ${address.province || ''} ${address.postal_code || ''}`));
        lines.appendChild(document.createElement('br'));
        lines.appendChild(document.createTextNode('Philippines'));

        const phone = document.createElement('p');
        phone.className = 'address-phone';
        phone.textContent = address.phone || '';

        const actions = document.createElement('div');
        actions.className = 'address-actions';

        const editButton = document.createElement('button');
        editButton.className = 'button button-secondary edit-address';
        editButton.type = 'button';
        editButton.textContent = 'Edit';
        actions.appendChild(editButton);

        if (!address.is_default) {
            const defaultButton = document.createElement('button');
            defaultButton.className = 'text-button set-default';
            defaultButton.type = 'button';
            defaultButton.textContent = 'Set as default';
            actions.appendChild(defaultButton);
        }

        card.appendChild(top);
        card.appendChild(name);
        card.appendChild(lines);
        card.appendChild(phone);
        card.appendChild(actions);
        list.appendChild(card);
    });
};

const loadAddresses = async () => {
    if (!authSession?.user?.id) {
        throw new Error('No authenticated user was found. Please log in again.');
    }

    showStatus('Loading addresses...', 'loading');

    console.log('[Addresses] Loading addresses for user:', authSession.user.id);

    const { data, error } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', authSession.user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[Addresses] Supabase load error:', error);
        throw error;
    }

    addresses = data || [];

    console.log('[Addresses] Addresses returned:', addresses);

    render();

    if (addresses.length) {
        showStatus('', 'success');
    } else {
        showStatus('No saved addresses yet.', 'success');
    }
};

const validate = () => {
    const phone = document.getElementById('address-phone')?.value.trim() || '';
    const postal = document.getElementById('address-postal')?.value.trim() || '';

    if (!/^09\d{9}$/.test(phone)) {
        showStatus('Contact number must be exactly 11 digits and start with 09.', 'error');
        return false;
    }

    if (!/^\d{4}$/.test(postal)) {
        showStatus('Postal code must be exactly 4 digits.', 'error');
        return false;
    }

    return true;
};

async function saveAddress(event) {
    event?.preventDefault();

    if (!validate()) return;

    const button = document.getElementById('save-address-button');
    const originalText = button?.textContent || 'Save address';

    try {
        if (!authSession?.user?.id) {
            throw new Error('Your session has expired. Please log in again.');
        }

        if (button) {
            button.disabled = true;
            button.textContent = 'Saving...';
        }

        showStatus('Saving address...', 'loading');

        const payload = {
            user_id: authSession.user.id,
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
            const { error } = await supabase
                .from('saved_addresses')
                .update({ is_default: false })
                .eq('user_id', authSession.user.id);

            if (error) throw error;
        }

        let result;

        if (editingId) {
            result = await supabase
                .from('saved_addresses')
                .update(payload)
                .eq('id', editingId)
                .eq('user_id', authSession.user.id)
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

        showStatus(
            wasEditing ? 'Address updated successfully.' : 'Address saved successfully.',
            'success'
        );
    } catch (error) {
        console.error('[Addresses] Save error:', error);
        showStatus(`Save failed: ${error.message || error}`, 'error');
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = originalText;
        }
    }
}

async function deleteAddress(id) {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
        if (!authSession?.user?.id) {
            throw new Error('Your session has expired. Please log in again.');
        }

        showStatus('Deleting address...', 'loading');

        const { error } = await supabase
            .from('saved_addresses')
            .delete()
            .eq('id', id)
            .eq('user_id', authSession.user.id);

        if (error) throw error;

        await loadAddresses();
        showStatus('Address deleted successfully.', 'success');
    } catch (error) {
        console.error('[Addresses] Delete error:', error);
        showStatus(`Delete failed: ${error.message || error}`, 'error');
    }
}

async function setDefaultAddress(id) {
    try {
        if (!authSession?.user?.id) {
            throw new Error('Your session has expired. Please log in again.');
        }

        showStatus('Updating default address...', 'loading');

        const { error: clearError } = await supabase
            .from('saved_addresses')
            .update({ is_default: false })
            .eq('user_id', authSession.user.id);

        if (clearError) throw clearError;

        const { error } = await supabase
            .from('saved_addresses')
            .update({ is_default: true })
            .eq('id', id)
            .eq('user_id', authSession.user.id);

        if (error) throw error;

        await loadAddresses();
        showStatus('Default address updated successfully.', 'success');
    } catch (error) {
        console.error('[Addresses] Default address error:', error);
        showStatus(`Could not set default address: ${error.message || error}`, 'error');
    }
}

const setupEvents = () => {
    document.getElementById('add-address')?.addEventListener('click', () => openModal());
    document.getElementById('close-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('cancel-address-modal')?.addEventListener('click', closeModal);
    document.getElementById('address-modal-backdrop')?.addEventListener('click', closeModal);
    form?.addEventListener('submit', saveAddress);

    document.getElementById('address-list')?.addEventListener('click', (event) => {
        const card = event.target.closest('.address-card');
        if (!card) return;

        const id = card.dataset.id;
        const address = addresses.find((item) => String(item.id) === String(id));

        if (event.target.closest('.edit-address')) {
            openModal(address);
        } else if (event.target.closest('.delete-address')) {
            deleteAddress(id);
        } else if (event.target.closest('.set-default')) {
            setDefaultAddress(id);
        }
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && modal && !modal.hidden) {
            closeModal();
        }
    });
};

const initAddressPage = async () => {
    if (initialized) return;
    initialized = true;

    modal = document.getElementById('address-modal');
    form = document.getElementById('address-form');

    setupEvents();

    try {
        if (!supabase) {
            throw new Error('Supabase client is not available.');
        }

        showStatus('Loading addresses...', 'loading');

        // Read the current session directly from Supabase.
        // Do not wait for the auth-ready custom event because
        // that event may already have fired before this script runs.
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        authSession = data.session;

        console.log('[Addresses] Current session:', authSession);

        if (!authSession?.user?.id) {
            window.location.replace('../auth/login.html');
            return;
        }

        window.datihanAuthSession = authSession;

        await loadAddresses();
    } catch (error) {
        console.error('[Addresses] Initialization error:', error);
        showStatus(`Unable to load addresses: ${error.message || error}`, 'error');
    }
};

window.saveAddress = saveAddress;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAddressPage, { once: true });
} else {
    initAddressPage();
}
