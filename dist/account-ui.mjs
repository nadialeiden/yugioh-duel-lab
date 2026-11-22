import {$, escape, modal, closeModal, toast} from './ui.mjs';
import {readProfile, saveDisplayName, sessionEndpoint} from './profiles.mjs';

export function showAccount({id, expires, canSwitch, refreshName}) {
  if (id === 'guest') {
    const endTime = new Date(expires).toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
    modal('Guest pass', `
      <p class="account-note">Your pass covers Practice and Learn and ends at ${escape(endTime)}.</p>
      <p id="account-error" class="account-error" role="alert"></p>
      <button id="guest-sign-in" class="primary guest-sign-in" type="button">Sign in</button>`);
    $('guest-sign-in').onclick = () => {
      try {
        canSwitch();
        location.assign('/signin.html' + location.hash);
      } catch (error) {
        $('account-error').textContent = error.message;
      }
    };
    return;
  }

  modal('Account settings', `
    <p class="account-id">Login ID <strong>${escape(id)}</strong></p>
    <form id="account-name-form" class="account-form">
      <label for="account-name">Display name</label>
      <input id="account-name" name="name" value="${escape(readProfile(id).name)}" maxlength="32" required>
      <p id="account-error" class="account-error" role="alert"></p>
      <div class="account-buttons"><button class="primary" type="submit">Save name</button><button id="account-logout" class="subtle" type="button">Sign out</button></div>
    </form>
    <p class="account-note">Your display name and decks are saved in this browser.</p>`);
  $('account-name-form').onsubmit = event => {
    event.preventDefault();
    try {
      saveDisplayName(id, $('account-name').value);
      refreshName();
      closeModal();
      toast('Display name saved.');
    } catch (error) {
      $('account-error').textContent = error.message;
    }
  };
  $('account-logout').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      canSwitch();
      const response = await fetch(sessionEndpoint, {method: 'DELETE'});
      if (!response.ok) throw new Error('Could not sign out. Try again.');
      location.replace('/signin.html' + location.hash);
    } catch (error) {
      $('account-error').textContent = error.message;
      button.disabled = false;
    }
  };
}
