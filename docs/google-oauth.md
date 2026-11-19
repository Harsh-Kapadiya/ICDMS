# Google sign-in setup (OAuth), step by step

ICDMS uses "Sign in with Google" only to learn who is uploading. It asks Google for the user's name and email, nothing else. Who may upload is decided by `members.json`, not by Google.

You need: a Google account, the site's address (for example `https://icdms.vercel.app`), and about 15 minutes.

> **Use a shared IC account if you can.** The OAuth app belongs to whichever Google account creates it. If it is a student's personal account, it leaves with them when they graduate.

## 1. Create a Google Cloud project

1. Open [console.cloud.google.com](https://console.cloud.google.com) and sign in.
2. Click the project picker in the top bar, then **New project**.
3. Name it `ICDMS`, leave Organisation as it is, and click **Create**.
4. When it is ready, pick **ICDMS** in the project picker so everything below happens inside it.

## 2. Set up the Google Auth Platform

1. In the search bar, type **Google Auth Platform** and open it. (It is also under *APIs & Services → OAuth consent screen*.)
2. Click **Get started**.
3. **App information:** App name `ICDMS`. User support email: the IC email. Click **Next**.
4. **Audience:** choose **External**. This lets any Google account reach the sign-in screen; `members.json` then lets only IC members upload.
   - *Internal* appears only if the project was created inside the college's Google Workspace organisation. It limits sign-in to college accounts and needs a Workspace admin. External plus `members.json` works without that.
5. **Contact information:** your email. Click **Next**.
6. **Finish:** tick the box agreeing to the *Google API Services: User Data Policy*, click **Continue**, then **Create**.

Do not upload an app logo under *Branding*. A logo makes Google require a brand review before you can publish; the name alone needs none.

## 3. Create the OAuth client

1. In the Google Auth Platform menu, open **Clients**, then **+ Create client**.
2. **Application type:** Web application. **Name:** `ICDMS web`.
3. Under **Authorized JavaScript origins**, click **Add URI** twice and add:
   - `http://localhost:3000`
   - `https://icdms.vercel.app` (your real site address)
4. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://icdms.vercel.app/api/auth/callback/google`

   These must match exactly: `http` vs `https`, no trailing slash, the same domain.
5. Click **Create**.
6. A dialog shows the **Client ID** and **Client secret**. Copy both now, or click **Download JSON**. Google may not show the secret again; if you lose it, add a new secret to the client.

## 4. Data access

Nothing to add. ICDMS requests only `openid`, `email` and `profile`, which are basic scopes that need no review.

## 5. Publish the app

1. Open **Audience**. The publishing status starts as **Testing**.
2. Click **Publish app**, then **Confirm**. With only basic scopes, Google does not ask for verification.

   (If you stay in Testing, sign-in still works for these basic scopes, but Google shows users a "this app is being tested" warning.)

## 6. Put the keys in ICDMS

**Locally:** copy `.env.example` to `.env.local` and fill in:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<output of: openssl rand -base64 32>
GOOGLE_ID=<Client ID>
GOOGLE_SECRET=<Client secret>
GITHUB_UPLOAD_TOKEN=<see README, Setup step 3>
```

**On Vercel:** *Project → Settings → Environment Variables*, add the same five, with `NEXTAUTH_URL` set to `https://icdms.vercel.app`. Then redeploy (*Deployments → ⋯ → Redeploy*), because environment variables apply only to new deployments.

Never commit `.env.local`; it is already in `.gitignore`.

## 7. Test it

1. Add your own official email to `members.json`.
2. Run `npm run dev` and open http://localhost:3000/upload.
3. Click **Sign in with Google** and pick your college account. You should land on the upload form, signed in.
4. Sign out, then sign in with a personal Gmail that is not in `members.json`. You should be sent back with "That account isn't on the IC members list".

## If something goes wrong

| What you see | Cause and fix |
|---|---|
| `Error 400: redirect_uri_mismatch` | The redirect URI in step 3.4 doesn't match the site exactly. Check `http`/`https`, the domain, and that there is no trailing slash. Changes can take a few minutes to apply. |
| `Access blocked: … has not completed the Google verification process` | A logo or an extra scope was added. Remove the logo under *Branding*, or publish the app (step 5). |
| "That account isn't on the IC members list" for a real member | Their email in `members.json` has a typo, or the change hasn't been deployed yet. |
| "Couldn't find your Google Account" for a college email | That address isn't a Google account. Ask whether the college uses Google Workspace; if not, the member can create a Google account with their existing college email at [accounts.google.com/signup](https://accounts.google.com/signup) (choose *Use your existing email*). |
| Sign-in works locally but not on the site | `NEXTAUTH_URL` on Vercel isn't the live address, or the site wasn't redeployed after adding the variables. |
