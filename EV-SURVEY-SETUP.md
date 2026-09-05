# EV charge point survey: setup

The survey form at `/ev-survey.html` reuses everything already set up for the
enquiry form (D1, Resend, the same worker) plus one new piece: photo storage.

**Flow:** form → compress photos in the browser → `POST /api/ev-survey` →
each photo saved to R2 → row saved to D1 → email sent to Sean with the
photos attached.

Same reliability pattern as the enquiry form: photos and the database row
are saved *before* the email is attempted, so a Resend outage can never
lose a survey, only delay the notification.

---

## Already done

| | |
|---|---|
| R2 bucket | `sw-electrical-survey-photos` (created, empty until first submission) |
| D1 table | `ev_surveys`, in the same `sw-electrical` database as `enquiries` |
| Code | Pushed to `main` — page, styling, `survey.js`, and the `/api/ev-survey` route in `_worker.js` |

---

## 1. Add the R2 binding (the one thing only you can do)

**Pages → your project → Settings → Bindings → Add → R2 bucket**

| Field | Value |
|---|---|
| Variable name | `SURVEY_PHOTOS` |
| R2 bucket | `sw-electrical-survey-photos` |

The variable name must be exactly `SURVEY_PHOTOS`, capitals, matching what
`_worker.js` looks for. This is separate from the `DB` binding already
there — you'll end up with two bindings listed, D1 and R2.

**Redeploy after adding it.** Same rule as always: bindings only apply to
the deployment made after they're saved.

No new variables or secrets are needed — `RESEND_API_KEY`, `FROM_EMAIL`
and `TO_EMAIL` are already in place and this reuses them.

---

## 2. Test it

1. Go to `swelectrical.co.uk/ev-survey.html` and submit a real test, one
   photo is enough to prove the pipeline works.
2. Check `info@swelectrical.co.uk` (once that mailbox exists) for the
   notification, with the photo attached.
3. Check the database:
   ```sql
   SELECT id, created_at, name, postcode, photo_consumer_unit, emailed
   FROM ev_surveys ORDER BY created_at DESC LIMIT 5;
   ```
   A filled `photo_consumer_unit` column (or whichever slots you tested)
   confirms R2 storage worked; `emailed = 1` confirms Resend worked.

**Reading a failure:**

| Symptom | Likely cause |
|---|---|
| Row never appears at all | `SURVEY_PHOTOS` binding missing, or not redeployed since adding it |
| Row appears but photo columns are empty | The photo binding exists but the R2 bucket name doesn't match, or a photo failed to upload — check the browser console |
| Row appears, `emailed = 0` | Same causes as the enquiry form: Resend not configured, or the sending domain not verified |

---

## Where photos actually live

Cloudflare Storage & Databases → R2 → `sw-electrical-survey-photos`.
Each survey's photos sit under a folder named with that survey's ID, e.g.
`ev-surveys/<id>/consumer_unit.jpg`. There's no cleanup job — photos stay
indefinitely unless deleted manually. Worth revisiting once real volume
builds up, but not urgent at this size.

**One thing worth knowing:** this bucket was created in North America
(Cloudflare's R2 tool didn't offer a location choice), while the D1
database is in Western Europe. For photos of UK domestic properties this
is a minor point, not a compliance problem, but if it matters to you later
the bucket can be recreated in the EU and the binding repointed.

---

## Extending the form later

Sean may want extra fields captured. Two-step change, both in `build.py`:

1. Add the field to the `<form>` markup on `ev-survey.html` (copy an
   existing `.field` block)
2. Add the same field name to `SURVEY_TEXT_FIELDS` in `_worker.js` and to
   the `INSERT INTO ev_surveys` statement, plus a new column via
   `ALTER TABLE ev_surveys ADD COLUMN ...` in D1

Small, contained change — nothing structural needs to move.
