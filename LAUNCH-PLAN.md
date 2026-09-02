# SW Electrical: brand, build and launch plan

Everything below refers to the site in this folder. It is a plain static site (HTML, one CSS file, one JS file, no build step) designed to sit on Cloudflare Pages.

---

## 1. Sitemap and navigation

**Primary navigation (7 items, flat, no dropdowns on mobile)**

| Page | File | Purpose |
|---|---|---|
| Home | `index.html` | Convert. Proof, services, coverage, CTA |
| Electrical services | `services.html` | Hub. Links to the two service pages, plus inspections and repairs sections |
| ├ Domestic | `domestic-electrician.html` | Ranking page for "domestic electrician Shropshire" |
| └ Commercial | `commercial-electrician.html` | Ranking page for "commercial electrician Shropshire" |
| EV charge points | `ev-charging.html` | Ranking page for "EV charger installation Shropshire" |
| Air conditioning | `air-conditioning.html` | Coming soon, interest capture, future-ready |
| About Sean | `about.html` | Trust and E-E-A-T signal |
| Areas covered | `areas-covered.html` | Local SEO |
| Contact | `contact.html` | Form, phone, WhatsApp, hours |

Plus `privacy.html`, `404.html`, `sitemap.xml`, `robots.txt`.

**Why this shape:** two service subpages rather than five thin ones. Inspections, fault finding and upgrades live as anchored sections on the services hub. They are real search intents but not big enough to sustain their own page until there is content and photography to fill them. Easy to promote to full pages later.

**Persistent CTAs:** phone button in the desktop header, and a fixed Call / WhatsApp bar on mobile. On a trade site this bar is usually the single highest-converting element.

---

## 2. Brand direction

### Logo assessment

The current logo has three good ideas buried under four dated ones.

**Keep:** the ring-and-bolt device, the bolt standing in for the "E" in Electrical, navy as the base colour.

**Fix:** the outlined yellow display type (1990s, unreadable small), three competing colours (navy, yellow, red), the clenched fist gripping the ring (muddy below about 60px and reads oddly), no clear space, and no version that works as a favicon or profile picture.

**The refinement in this build** (`assets/logo-mark.svg`): the ring and bolt survive as a standalone mark that works at 32px. The bolt keeps a navy keyline so it holds together on light and dark backgrounds. The wordmark is set as live text next to it, which means it stays crisp at any size and does not need a font file embedding in the SVG.

This keeps a van, a business card and the Facebook page recognisably the same business, which matters when the existing customers are word-of-mouth.

**Recommend to Sean:** get the refined mark redrawn as proper vector artwork with a horizontal lockup, a stacked lockup, a mark-only version, and single-colour black/white versions for signwriting.

### Colour directions

**Direction A: Navy & Brass (active in the build, recommended)**

| Role | Hex |
|---|---|
| Ink | `#0C1B2E` |
| Navy | `#12294A` |
| Brass accent | `#E5A11C` |
| Paper | `#F7F5F1` |
| Slate text | `#4B5B70` |

Why this one: it is the existing logo, matured. Navy and yellow are already Sean's colours, so continuity is free. Dropping the yellow's saturation to a brass tone removes the "hazard tape" association without abandoning brand recognition. Brass is used only for rules, the bolt and the primary button, never for small text, so contrast never becomes a problem.

**Direction B: Graphite & Signal** (`#1D2126` / `#F5C518` / `#F5F5F3`). Sharper and more industrial. Leans commercial, slightly cooler for domestic customers. Higher risk of tipping into the hazard-stripe cliché if the yellow is used generously.

**Direction C: Deep Teal & Copper** (`#123A38` / `#C4703A` / `#F5F3EE`). The most distinctive and the most "designed". It would stand out against every other electrician in Shropshire, but it walks away from the existing logo colours entirely and reads slightly more premium-interiors than trade.

**To switch:** replace the `:root` colour block at the top of `assets/site.css`. Both alternates are commented at the bottom of that file, ready to paste. Nothing else changes.

### Typography

- **Archivo** for headings. Slightly condensed, engineered, confident without being corporate.
- **Inter** for body. Neutral, excellent on small screens, readable for older customers.

Two weights each, loaded with `display=swap`. Type scale runs on a `clamp()` so headlines shrink properly on a 360px phone.

### Layout principles

- Mobile-first. Everything is designed at 360px and expanded, not the reverse.
- One accent colour, used sparingly. Service blocks are marked with a 4px brass rule on the left edge, borrowed from the visual language of a labelled circuit, rather than the usual drop-shadow card kit.
- One animation on the whole site: a short staggered reveal on the hero, disabled under `prefers-reduced-motion`. Nothing animates on scroll.
- Placeholder blocks for photos and reviews are visibly placeholders. No stock photography, no invented testimonials, no fake badges.

---

## 3. Copy

Full draft copy is written into every page. Voice: UK English, plain, competent, no superlatives, no "we pride ourselves". Written as one experienced tradesperson speaking, because that is what the business is.

Two things worth Sean reading before launch:

1. The Air Conditioning page states plainly that SW Electrical is **not** currently REFCOM or F-Gas registered. That is deliberate and legally safer than vagueness. It updates in one paragraph when the registration lands.
2. The EV page deliberately makes no grant, pricing, eligibility or charger-brand claims. Those change too often to publish. It points people to ask instead.

---

## 4. SEO and AI search

**On-page (already implemented)**
- Unique title and meta description per page, all written around intent plus location.
- One `<h1>` per page, logical heading order, semantic landmarks, skip link.
- Canonical URLs, `og:` tags, `theme-color`.
- Internal linking: every service page links to contact, areas and at least one sibling service. The areas page links out to all four services.
- `sitemap.xml` and `robots.txt`, with GPTBot, ClaudeBot, PerplexityBot and Google-Extended explicitly allowed so the site is eligible to be cited in AI answers.
- Descriptive anchor text (`Domestic electrical work`, not `read more`).

**Schema (already implemented)**
- `Electrician` (a LocalBusiness subtype) on home and contact, with `@id` so other schema references it rather than duplicating it. Includes area served, opening hours, a `GeoCircle` for the 40 mile radius, and credentials.
- `Service` schema on each service page, pointing back at the business `@id`.
- `FAQPage` on home, domestic, commercial, EV, air conditioning and areas.
- `AboutPage` with a `Person` entity for Sean, which is the thing that earns author trust in both Google and LLM answers.

**Target queries, mapped**

| Query | Page |
|---|---|
| electrician Shrewsbury / electrician Shropshire | Home |
| domestic electrician Shropshire | Domestic |
| commercial electrician Shropshire | Commercial |
| EV charger installation Shropshire / EV charge point installer Shrewsbury | EV |
| emergency electrician Shrewsbury | Home + Contact |
| landlord electrical report Shropshire | Services (inspections) |

**What matters more than any of the above:** the Google Business Profile and reviews. For a local trade, the map pack drives more enquiries than organic listings. Prioritise section 6.

**Do not** add town-by-town doorway pages. Google treats them as spam and they would undermine an otherwise clean site.

---

## 5. Integrations

### Contact details, one file

Open `assets/config.js` and fill in the phone, WhatsApp number and email. Every `tel:` link, WhatsApp button and email address across the site updates from that one file. Placeholders stay visible until it is edited, so nothing ships looking half-finished by accident.

Also search and replace `INSERT_PHONE` and `INSERT_EMAIL` in the JSON-LD blocks in the HTML, since search engines read those before JavaScript runs.

### Enquiry form

`functions/api/enquiry.js` is a Cloudflare Pages Function that emails submissions via Resend. Set three environment variables in the Pages dashboard: `RESEND_API_KEY`, `TO_EMAIL`, `FROM_EMAIL`. Resend's free tier covers this comfortably.

Simpler alternative if you would rather not manage a key: delete the function, sign up for Web3Forms or Formspree, and point the `fetch()` in `assets/site.js` at their endpoint. Same form, same UX.

The form has a hidden honeypot field, client-side validation, an accessible live-region status message, and a fallback message telling people to call if the send fails.

### WhatsApp

Buttons use `https://wa.me/<number>?text=<prefilled>`. Use the **business** WhatsApp number in international format with no plus sign or spaces. The prefilled message is editable in `config.js`.

### Google Reviews

Two-stage approach, and stage one has to come first.

1. Claim and verify the Google Business Profile, then collect the short review link from "Ask for reviews".
2. Paste that link into `googleReviewUrl` in `config.js`. The "Leave a Google review" button un-hides itself automatically.
3. Once there are five or six reviews, replace the three placeholder slots on the home page with real quotes, attributed by first name and town, copied verbatim from Google. Do not paraphrase them and do not write any yourself.

If you later want them pulling in automatically, the Google Places API returns up to five reviews and could populate that section from a scheduled Cloudflare Worker. Not worth doing until there are reviews to pull.

---

## 6. What Sean needs to provide

**Blocking launch**
- Business phone number, as dialled and as displayed
- Business WhatsApp number
- Email address for enquiries
- Confirmation of the NAPIT registration number and OZEV registration (for the footer, and for the profile)
- Sign-off on the About page copy, since it is written in his voice
- Confirmation of the retention periods in the privacy notice

**Blocking a good launch, not the launch itself**
- Logo source files, ideally the original vector. If only the JPG exists, the mark will need redrawing.
- Google Business Profile: claimed, verified, categories set (Electrician as primary, Electrical installation service as secondary), service area set to the 40 mile radius, hours set including a note about emergency call-outs, and at least ten photos.
- One professional photo of Sean at work, for the About page.

**Fills the gaps over the next few weeks**
- Six to twelve photos of completed jobs: consumer units, EV charge points, commercial lighting, a rewire in progress. Before-and-after pairs work hardest.
- Reviews. Ask every customer, at the point the job is finished and they are pleased, with the short link ready on his phone.
- Facebook page link once it is refreshed, or leave the placeholder empty.

---

## 7. Staged launch plan

**Stage 1: launch (this build)**
Electrical and EV services live. Air conditioning clearly marked coming soon. Placeholder galleries and review slots visible but honest. Contact details filled in, form connected, domain pointed at Cloudflare Pages, `swelectrical.co.uk` set as the primary with the old host retired and 301s in place if any old URLs had traffic. Submit the sitemap in Google Search Console and Bing Webmaster Tools.

**Stage 2: weeks 1 to 8, credibility**
Google Business Profile verified and populated. Reviews requested on every completed job. Photos collected and dropped into the gallery slots, replacing the placeholder blocks. First real review quotes onto the home page. Add the About photo. This stage moves the needle more than any further design work.

**Stage 3: when registrations confirm, air conditioning**
Update the air conditioning page from "coming soon" to live: remove the certification notice, add the registrations to the footer and the LocalBusiness schema `hasCredential`, add a `Service` schema block, and add it to the services grid on the home page. Contact anyone who registered interest. The page is deliberately structured so this is an edit, not a rebuild.

**Optional stage 4**
Two or three genuinely useful articles, written from questions Sean actually gets asked. "What a landlord's electrical report actually checks" and "Where to put an EV charge point" earn links and get quoted by AI answer engines. Only worth doing if the content is real.

---

## 8. Quality standards met

- Responsive from 360px up, touch targets 48px minimum
- WCAG 2.2 AA: contrast checked on every text-on-colour combination, visible focus rings, skip link, semantic landmarks, labelled form fields with a fieldset and legend for the radio group, live-region form status
- Keyboard navigable throughout, including the mobile menu and the FAQ accordions (native `<details>`)
- Respects `prefers-reduced-motion`
- No frameworks, no build step, no tracking. One CSS file, one JS file, two fonts. Should score very well on Core Web Vitals, with LCP being the hero text rather than an image
- No fake reviews, no invented certifications, no stock photography passed off as Sean's work, no invented phone numbers or pricing
