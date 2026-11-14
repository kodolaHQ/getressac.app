// The hero form sends ?email=… to #invite; carry it into the full form.
const email = new URLSearchParams(location.search).get('email');
const field = document.querySelector('#invite [name=email]');
if (email && field) {
  field.value = email;
  document.querySelector('#invite [name=origin]')?.focus({ preventScroll: true });
}

// Motion only answers a gesture: with reduced motion, the demo video waits for a click.
if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const v of document.querySelectorAll('video[autoplay]')) {
    v.removeAttribute('autoplay');
    v.pause();
    v.controls = true;
  }
}

// Theme toggle: flips the current look (system choice or saved one) and remembers it.
for (const button of document.querySelectorAll('.theme')) {
  button.addEventListener('click', () => {
    const root = document.documentElement;
    const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch {}
  });
}
