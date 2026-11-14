// The hero form sends ?email=… to #invite; carry it into the full form.
const email = new URLSearchParams(location.search).get('email');
const field = document.querySelector('#invite [name=email]');
if (email && field) {
  field.value = email;
  document.querySelector('#invite [name=origin]')?.focus({ preventScroll: true });
}
