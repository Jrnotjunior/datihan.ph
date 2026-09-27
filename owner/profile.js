document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.datihanSupabase;
  const firstName = document.getElementById('first-name');
  const lastName = document.getElementById('last-name');
  const email = document.getElementById('email');
  const phone = document.getElementById('phone');
  const profileStatus = document.getElementById('profile-status');
  const passwordStatus = document.getElementById('password-status');
  const paymentStatus = document.getElementById('payment-status');
  const logoutButton = document.getElementById('logout');
  const paymentQrFile = document.getElementById('payment-qr-file');
  const paymentQrFileName = document.getElementById('payment-qr-file-name');
  const savePaymentQr = document.getElementById('save-payment-qr');
  const paymentQrPreview = document.getElementById('payment-qr-preview');
  const paymentQrEmpty = document.getElementById('payment-qr-empty');
  const paymentActiveBadge = document.getElementById('payment-active-badge');
  const paymentQrHistory = document.getElementById('payment-qr-history');
  const paymentQrHistoryList = document.getElementById('payment-qr-history-list');

  let currentUser = null;
  let selectedQrFile = null;

  function showStatus(element, message, isError = false) {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle('error', isError);
  }

  async function getUser() {
    if (!supabase) throw new Error('Supabase client is not available.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    const user = data?.session?.user;
    if (!user) {
      window.location.replace('../auth/login.html');
      return null;
    }
    currentUser = user;
    return user;
  }

  async function loadProfile() {
    try {
      const user = await getUser();
      if (!user) return;
      const metadata = user.user_metadata || {};
      firstName.value = metadata.first_name || '';
      lastName.value = metadata.last_name || '';
      phone.value = metadata.phone || '';
      email.value = user.email || '';
      await loadPaymentQr(user);
    } catch (error) {
      console.error('Unable to load owner profile:', error);
      showStatus(profileStatus, 'Unable to load your account information. Please refresh the page.', true);
    }
  }

  async function loadPaymentQr(user) {
    const { data, error } = await supabase
      .from('payment_qr_codes')
      .select('id, storage_path, public_url, is_active, created_at, deactivated_at')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === '42P01') {
        showStatus(paymentStatus, 'Payment QR storage is not set up yet. Run the payment QR SQL migration first.', true);
      } else {
        console.error('Unable to load payment QR:', error);
        showStatus(paymentStatus, 'Unable to load the payment QR. Please refresh the page.', true);
      }
      return;
    }

    const rows = data || [];
    const active = rows.find(row => row.is_active);

    if (active?.public_url) {
      paymentQrPreview.src = active.public_url;
      paymentQrPreview.hidden = false;
      paymentQrEmpty.hidden = true;
      paymentActiveBadge.hidden = false;
    } else {
      paymentQrPreview.removeAttribute('src');
      paymentQrPreview.hidden = true;
      paymentQrEmpty.hidden = false;
      paymentActiveBadge.hidden = true;
    }

    paymentQrHistoryList.innerHTML = rows.map(row => {
      const date = new Date(row.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      return `<div class="payment-history-item">
        ${row.public_url ? `<img class="payment-history-thumb" src="${escapeHtml(row.public_url)}" alt="GCash QR">` : ''}
        <div class="payment-history-meta"><strong>GCash QR</strong><span>Uploaded ${escapeHtml(date)}</span></div>
        <span class="payment-history-status ${row.is_active ? 'active' : 'inactive'}">${row.is_active ? 'ACTIVE' : 'INACTIVE'}</span>
      </div>`;
    }).join('');
    paymentQrHistory.hidden = rows.length === 0;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  paymentQrFile?.addEventListener('change', () => {
    selectedQrFile = paymentQrFile.files?.[0] || null;
    savePaymentQr.disabled = !selectedQrFile;
    if (selectedQrFile) {
      paymentQrFileName.textContent = `${selectedQrFile.name} · ${(selectedQrFile.size / 1024 / 1024).toFixed(2)} MB`;
      const previewUrl = URL.createObjectURL(selectedQrFile);
      paymentQrPreview.src = previewUrl;
      paymentQrPreview.hidden = false;
      paymentQrEmpty.hidden = true;
      paymentActiveBadge.hidden = true;
    } else {
      paymentQrFileName.textContent = 'PNG, JPG, or WEBP · recommended square image';
    }
  });

  savePaymentQr?.addEventListener('click', async () => {
    if (!selectedQrFile || !currentUser) return;

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(selectedQrFile.type)) {
      showStatus(paymentStatus, 'Please choose a PNG, JPG, or WEBP image.', true);
      return;
    }
    if (selectedQrFile.size > 5 * 1024 * 1024) {
      showStatus(paymentStatus, 'The QR image must be 5 MB or smaller.', true);
      return;
    }

    savePaymentQr.disabled = true;
    savePaymentQr.textContent = 'Uploading…';
    showStatus(paymentStatus, 'Uploading your new GCash QR…');

    let uploadedPath = null;
    let previousActiveId = null;

    try {
      const extension = selectedQrFile.name.split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${currentUser.id}/gcash-${Date.now()}.${extension}`;
      uploadedPath = path;

      const { error: uploadError } = await supabase.storage
        .from('payment-qr')
        .upload(path, selectedQrFile, { contentType: selectedQrFile.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('payment-qr').getPublicUrl(path);
      const publicUrl = publicData?.publicUrl;
      if (!publicUrl) throw new Error('Unable to create the public QR image URL.');

      // The database allows only one active QR per owner, so deactivate
      // the current QR before inserting the replacement.
      const { data: previousActive, error: previousActiveError } = await supabase
        .from('payment_qr_codes')
        .select('id')
        .eq('owner_id', currentUser.id)
        .eq('is_active', true)
        .maybeSingle();
      if (previousActiveError) throw previousActiveError;

      previousActiveId = previousActive?.id || null;

      if (previousActiveId) {
        const { error: deactivateError } = await supabase
          .from('payment_qr_codes')
          .update({ is_active: false, deactivated_at: new Date().toISOString() })
          .eq('id', previousActiveId)
          .eq('owner_id', currentUser.id);
        if (deactivateError) throw deactivateError;
      }

      const { error: insertError } = await supabase
        .from('payment_qr_codes')
        .insert({ owner_id: currentUser.id, storage_path: path, public_url: publicUrl, is_active: true });
      if (insertError) {
        // Restore the previous QR if the replacement record could not be created.
        if (previousActiveId) {
          await supabase
            .from('payment_qr_codes')
            .update({ is_active: true, deactivated_at: null })
            .eq('id', previousActiveId)
            .eq('owner_id', currentUser.id);
        }
        throw insertError;
      }

      selectedQrFile = null;
      paymentQrFile.value = '';
      paymentQrFileName.textContent = 'PNG, JPG, or WEBP · recommended square image';
      showStatus(paymentStatus, 'GCash QR uploaded and activated successfully.');
      await loadPaymentQr(currentUser);
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from('payment-qr').remove([uploadedPath]);
      }
      console.error('Unable to save payment QR:', error);
      showStatus(paymentStatus, error.message || 'Unable to save the GCash QR. Please try again.', true);
    } finally {
      savePaymentQr.disabled = !selectedQrFile;
      savePaymentQr.textContent = 'Save & Activate';
    }
  });

  document.getElementById('save-profile')?.addEventListener('click', async () => {
    const button = document.getElementById('save-profile');
    const first = firstName.value.trim();
    const last = lastName.value.trim();
    const contact = phone.value.trim();

    if (!first || !last) {
      showStatus(profileStatus, 'First name and last name are required.', true);
      return;
    }
    if (!/^09\d{9}$/.test(contact)) {
      showStatus(profileStatus, 'Contact number must be exactly 11 digits and start with 09 (example: 09123456789).', true);
      phone.focus();
      return;
    }

    button.disabled = true;
    button.textContent = 'Saving…';
    showStatus(profileStatus, 'Saving your profile…');

    try {
      const { error } = await supabase.auth.updateUser({
        data: { first_name: first, last_name: last, phone: contact }
      });
      if (error) throw error;
      showStatus(profileStatus, 'Profile saved successfully.');
    } catch (error) {
      showStatus(profileStatus, error.message || 'Unable to save your profile.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Save changes';
    }
  });

  document.getElementById('save-password')?.addEventListener('click', async () => {
    const button = document.getElementById('save-password');
    const currentPassword = document.getElementById('current-password').value;
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (!currentPassword) {
      showStatus(passwordStatus, 'Enter your current password first.', true);
      return;
    }
    if (!password) {
      showStatus(passwordStatus, 'Enter a new password first.', true);
      return;
    }
    if (password.length < 8) {
      showStatus(passwordStatus, 'Password must be at least 8 characters.', true);
      return;
    }
    if (password !== confirm) {
      showStatus(passwordStatus, 'Passwords do not match.', true);
      return;
    }
    if (currentPassword === password) {
      showStatus(passwordStatus, 'Your new password must be different from your current password.', true);
      return;
    }

    button.disabled = true;
    button.textContent = 'Changing…';
    showStatus(passwordStatus, 'Verifying your current password…');

    try {
      const user = await getUser();
      if (!user?.email) throw new Error('Unable to verify your account email. Please refresh and try again.');

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });
      if (signInError) throw new Error('Current password is incorrect.');

      showStatus(passwordStatus, 'Updating your password…');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      document.getElementById('current-password').value = '';
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      showStatus(passwordStatus, 'Password changed successfully.');
    } catch (error) {
      showStatus(passwordStatus, error.message || 'Unable to change your password.', true);
    } finally {
      button.disabled = false;
      button.textContent = 'Change password';
    }
  });

  logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;
    logoutButton.textContent = 'Logging out…';
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.replace('../auth/login.html?logged_out=1');
    } catch (error) {
      console.error('Logout error:', error);
      showStatus(profileStatus, error.message || 'Unable to log out. Please try again.', true);
      logoutButton.disabled = false;
      logoutButton.textContent = 'Log out';
    }
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (!session && event === 'SIGNED_OUT') {
      window.location.replace('../auth/login.html?logged_out=1');
    }
  });

  loadProfile();
});
