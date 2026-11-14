# getressac.app

The website of [Ressac](https://github.com/kodolaHQ/Ressac), a macOS browser built on Firefox. Its one job during the closed beta: let people request an invite.

- `public/` — the static site, hand-written HTML and CSS. English at `/`, French at `/fr/`.
- `functions/api/invite.js` — the Cloudflare Pages Function behind the invite form; logic in `src/invite.js`.
- `migrations/` — the D1 schema (one `invites` table).
- `scripts/export-invites.sh` — invite requests as CSV.

No build step, no runtime dependency. `wrangler` is the only dev dependency.

## Run it locally

```sh
npm install
cp .dev.vars.example .dev.vars          # Turnstile's always-pass test secret
npx wrangler d1 migrations apply ressac-invites --local
npm run dev                             # http://localhost:8788
npm test
```

For the form to work locally, put Turnstile's test site key `1x00000000000000000000AA` in the two `data-sitekey` attributes (`public/index.html`, `public/fr/index.html`) and don't commit it.

## Deploy (Cloudflare Pages)

```sh
npx wrangler login
npx wrangler d1 create ressac-invites --jurisdiction eu   # put the id in wrangler.toml
npx wrangler d1 migrations apply ressac-invites --remote
npx wrangler pages project create getressac --production-branch main
npx wrangler pages secret put TURNSTILE_SECRET --project-name getressac
npx wrangler pages deploy public --branch preview         # a preview URL
npx wrangler pages deploy public --branch main            # production
```

The Turnstile widget (hostnames `getressac.app` and `localhost`) is created in the Cloudflare dashboard; its site key goes in the two forms, its secret only in the Pages secret above. `updates.getressac.app` is kept for Ressac's updater.

## Invite requests

```sh
scripts/export-invites.sh > invites.csv           # production
scripts/export-invites.sh --local > invites.csv   # local dev database
```

Never commit an export.

## License

[MPL 2.0](LICENSE), like Ressac.
