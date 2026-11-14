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
