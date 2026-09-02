# SW Electrical website

Static site. No build step. Deploy the contents of this folder to Cloudflare Pages.

## Go live in three steps

1. **Edit `assets/config.js`** with Sean's phone, WhatsApp number and email.
2. **Search and replace** `INSERT_PHONE` and `INSERT_EMAIL` in the `<script type="application/ld+json">` blocks in the HTML files (search engines read these before JS runs).
3. **Set the form env vars** in Cloudflare Pages: `RESEND_API_KEY`, `TO_EMAIL`, `FROM_EMAIL`. See `functions/api/enquiry.js`.

## Files

- `*.html` — pages
- `assets/site.css` — all styling. Palette tokens are in `:root` at the top; two alternate palettes are commented at the bottom.
- `assets/config.js` — contact details, the only file that needs editing to launch
- `assets/site.js` — nav, contact injection, form handling
- `functions/api/enquiry.js` — Cloudflare Pages Function for the enquiry form
- `LAUNCH-PLAN.md` — brand direction, SEO plan, integrations, what Sean needs to supply, staged launch

## Local preview

    python3 -m http.server 8080

Then open http://localhost:8080 (the form endpoint only works once deployed).
