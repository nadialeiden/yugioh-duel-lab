import {$, escape, modal, closeModal, toast} from './ui.mjs';
import {readProfile, saveDisplayName, signIn} from './profiles.mjs';

export function showAccount({id, switchAccount, canSwitch, refreshName}) {
  if (!id) {
    modal('Sign in', `
      <form id="demo-login" class="account-form">
        <label for="login-id">Login ID</label>
        <input id="login-id" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="64" required>
        <label for="login-password">Password</label>
        <input id="login-password" name="password" type="password" autocomplete="current-password" maxlength="128" required>
        <p id="account-error" class="account-error" role="alert"></p>
        <button class="primary" type="submit">Sign in</button>
      </form>
      <details class="demo-credentials">
        <summary>Demo login details</summary>
        <dl><dt>duelist1</dt><dd><code>DuelLab-101!</code></dd><dt>duelist2</dt><dd><code>DuelLab-102!</code></dd><dt>duelist3</dt><dd><code>DuelLab-103!</code></dd></dl>
        <p>These are shared demo logins. Each account’s decks and display name are saved in this browser.</p>
      </details>`);
    const form = $('demo-login');
    form.onsubmit = async event => {
      event.preventDefault();
      const error = $('account-error');
      const submit = form.querySelector('button[type="submit"]');
      const controller = new AbortController();
      const abort = () => controller.abort();
      $('modal').addEventListener('close', abort, {once: true});
      submit.disabled = true;
      error.textContent = '';
      try {
        canSwitch();
        const fields = new FormData(form);
        const account = await signIn(fields.get('username'), fields.get('password'), controller.signal);
        if (!form.isConnected || !$('modal').open) return;
        switchAccount(account);
        closeModal();
        toast('Signed in as ' + readProfile(account).name + '.');
      } catch (failure) {
        if (form.isConnected && !controller.signal.aborted) error.textContent = failure.message;
      } finally {
        $('modal').removeEventListener('close', abort);
        submit.disabled = false;
      }
    };
    $('login-id').focus();
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
  $('account-logout').onclick = () => {
    try {
      switchAccount(null);
      closeModal();
      toast('Signed out.');
    } catch (error) {
      $('account-error').textContent = error.message;
    }
  };
}
