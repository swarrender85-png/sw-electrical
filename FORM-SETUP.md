# Enquiry form: setup

Everything runs in Cloudflare. No third-party database.

**Flow:** form → `POST /api/enquiry` → saved to D1 → email sent to Sean via Resend.

The enquiry is saved *before* the email is attempted, and the email is sent after the response goes back to the visitor. So a mail failure never loses an enquiry, and the visitor never waits on Resend.

---

## Already done

The D1 database exists with the table and indexes created.

| | |
|---|---|
| Database name | `sw-electrical` |
| Database ID | `62485317-4449-402b-b38a-947dd2471696` |
| Region | Western Europe |
| Table | `enquiries` |

---

## 1. Bind the database to Pages

**Pages → your project → Settings → Bindings → Add → D1 database**

| Field | Value |
|---|---|
| Variable name | `DB` |
| D1 database | `sw-electrical` |

The variable name must be exactly `DB`, in capitals. That is what the worker looks for.

Add it to **both** Production and Preview if you use preview deployments.

---

## 2. Resend, for the email (about 10 minutes, mostly DNS)

1. Sign up at resend.com. Free tier is 3,000 emails a month.
2. **Domains → Add domain →** `sw-electrical.net`.
3. Add the DNS records it gives you (DKIM, SPF, return-path) in Cloudflare DNS. Set them to **DNS only**, grey cloud, not proxied.
4. Wait for Verified.
5. **API Keys → Create.** Copy it once, it is not shown again.

Mail from a verified domain reaches the inbox. Mail from an unverified sender goes to spam, and a missed enquiry is a lost job.

---

## 3. Variables

**Pages → Settings → Variables and secrets**

| Name | Value | Type |
|---|---|---|
| `RESEND_API_KEY` | key from step 2 | Secret |
| `FROM_EMAIL` | `website@sw-electrical.net` | Text |
| `TO_EMAIL` | `info@sw-electrical.net` | Text |
| `ADMIN_SECRET` | a long random string you invent | Secret |

Keep `FROM_EMAIL` different from `TO_EMAIL`. Sending and receiving on the same address causes filtering problems.

**Redeploy after adding bindings and variables.** They are only picked up on a new deployment.

---

## 4. Test

1. Submit a real enquiry on the live contact page.
2. Check the inbox, including spam.
3. Check the database. Either:
   - **Cloudflare dashboard → Storage & Databases → D1 → sw-electrical → Console**, run `SELECT * FROM enquiries ORDER BY created_at DESC;`
   - or hit the JSON endpoint:
     ```
     curl https://sw-electrical.net/api/enquiries -H "x-admin-secret: YOUR_ADMIN_SECRET"
     ```

**Reading the result:**

| What you see | Meaning |
|---|---|
| Row present, `emailed = 1` | Everything works |
| Row present, `emailed = 0` | Saved fine, Resend failed. Check domain verification and `FROM_EMAIL` |
| No row, form says it failed | `DB` binding missing, or not redeployed after adding it |
| 404 on the endpoint | `_worker.js` not deployed |

---

## Changing the recipient later

Edit `TO_EMAIL` in Pages and redeploy. The address also appears on the contact page, in the footer and in the schema markup, so those need a find-and-replace for `info@sw-electrical.net` at the same time.

---

## Useful queries

```sql
-- Everything, newest first
SELECT created_at, name, phone, postcode, service, status
FROM enquiries ORDER BY created_at DESC;

-- Anything that failed to email
SELECT * FROM enquiries WHERE emailed = 0;

-- Mark one as dealt with
UPDATE enquiries SET status = 'contacted' WHERE id = '...';

-- Where enquiries come from
SELECT service, COUNT(*) FROM enquiries GROUP BY service ORDER BY 2 DESC;
```

`status` accepts: `new`, `contacted`, `quoted`, `won`, `lost`, `spam`.

---

## If spam starts arriving

The honeypot stops naive bots. A targeted script hitting `/api/enquiry` directly will get through. The fix is Cloudflare Turnstile, which is free and native: add the widget to the form and verify the token in the worker. Roughly 20 lines. Not worth doing before there is a problem.
