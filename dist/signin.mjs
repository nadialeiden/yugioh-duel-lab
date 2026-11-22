const form = document.querySelector('#demo-login');
const signIn = form.querySelector('button');
const guest = document.querySelector('#guest-entry');
const error = document.querySelector('#entry-error');
const hash = ['#practice', '#local', '#decks', '#learn'].includes(location.hash) ? location.hash : '';
const endpoint = '/api/demo-login';

function enter(id) {
  location.replace('/' + (id === 'guest' && hash !== '#learn' ? '#practice' : hash));
}

async function submit(payload, button) {
  const label = button.textContent;
  button.textContent = 'Opening the table…';
  signIn.disabled = guest.disabled = true;
  error.textContent = '';
  try {
    const response = await fetch(endpoint, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (response.ok) return enter(data.id);
    error.textContent = data.error || 'Could not open the table. Try again.';
  } catch {
    error.textContent = 'Could not reach the lab. Try again.';
  }
  button.textContent = label;
  signIn.disabled = guest.disabled = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  submit(Object.fromEntries(new FormData(form)), signIn);
});
guest.addEventListener('click', () => submit({guest: true}, guest));

if (new URLSearchParams(location.search).has('expired')) {
  error.textContent = 'Your session ended. Sign in to continue.';
}
