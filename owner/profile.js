document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.datihanSupabase;
  const firstName = document.getElementById('first-name');
  const lastName = document.getElementById('last-name');
  const email = document.getElementById('email');
  const phone = document.getElementById('phone');
  const profileStatus = document.getElementById('profile-status');
  const passwordStatus = document.getElementById('password-status');
  const logoutButton = document.getElementById('logout');

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
    } catch (error) {
      console.error('Unable to load owner profile:', error);
      showStatus(profileStatus, 'Unable to load your account information. Please refresh the page.', true);
    }
  }

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
    const password = document.getElementById('new-password').value;
    const confirm = document.getElementById('confirm-password').value;

    if (!password && !confirm) {
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

    button.disabled = true;
    button.textContent = 'Changing…';
    showStatus(passwordStatus, '');

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
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
