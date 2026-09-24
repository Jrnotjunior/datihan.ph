const supabase = window.datihanSupabase;
const firstName = document.getElementById('first-name');
const lastName = document.getElementById('last-name');
const email = document.getElementById('email');
const phone = document.getElementById('phone');
const profileStatus = document.getElementById('profile-status');
const passwordStatus = document.getElementById('password-status');

function showStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle('error', isError);
}

async function loadProfile() {
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    let user = sessionData?.session?.user || null;

    if (!user) {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      user = userData?.user || null;
    }

    if (!user) {
      window.location.replace('../auth/login.html');
      return;
    }

    const metadata = user.user_metadata || {};
    firstName.value = metadata.first_name || '';
    lastName.value = metadata.last_name || '';
    phone.value = metadata.phone || '';
    email.value = user.email || '';
    email.setAttribute('value', user.email || '');
    showStatus(profileStatus, '');
  } catch (error) {
    console.error('Unable to load profile:', error);
    showStatus(profileStatus, 'Unable to load your account information. Please refresh the page.', true);
  }
}

supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    window.setTimeout(() => {
      loadProfile();
    }, 0);
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

  button.disabled = true;
  button.textContent = 'Saving…';
  showStatus(profileStatus, '');

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

document.getElementById('logout')?.addEventListener('click', async () => {
  const button = document.getElementById('logout');
  button.disabled = true;
  button.textContent = 'Logging out…';
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    window.location.replace('../auth/login.html');
  } catch (error) {
    alert(error.message || 'Unable to log out. Please try again.');
    button.disabled = false;
    button.textContent = 'Log out';
  }
});

document.addEventListener('DOMContentLoaded', loadProfile);