# Email sign-in setup, step by step

ICDMS signs IC members in with a one-time link sent to their official college email. There is no Google sign-in and no password to remember. You need:

- **An email account for the site to send from.** These steps use Gmail; any SMTP account works (see the end).
- **The `.members` list**, which you fill with `npm run add-member`.
- **Five settings** (environment variables), all explained below.

## How it works

1. A member opens **Upload**, types their name and official college email, and clicks **Email me a sign-in link**.
2. The site scrambles (hashes) the email and looks for it in `.members`. If it is there, the site emails a link that works for **15 minutes**. If not, nothing is sent, and the page says the same thing either way, so nobody can use the form to find out who is on the list.
3. Clicking the link signs the member in for **30 days** on that browser.

## 1. Choose the sending account

Use a shared IC Gmail account, for example `icdms.nitp@gmail.com`, not a personal one. The account is the "From" address on every sign-in email, and it should stay with the IC after you graduate. Free Gmail accounts can send about 500 emails a day, far more than ICDMS needs.

## 2. Turn on 2-Step Verification

Gmail only gives app passwords to accounts with 2-Step Verification.

1. Sign in to the sending account and open [myaccount.google.com/security](https://myaccount.google.com/security).
2. Under *How you sign in to Google*, open **2-Step Verification** and follow the steps to turn it on.

## 3. Create an app password

1. Open [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) (sign in again if asked).
2. Type `ICDMS` as the app name and click **Create**.
3. Google shows a 16-character password like `abcd efgh ijkl mnop`. Copy it **without the spaces**. It is shown only once; if you lose it, delete it and create a new one.

The app password can only send and read mail for this account; it is not the account password. Changing the account password cancels all app passwords, so create a new one afterwards.

## 4. Fill in the settings

**On your computer**, in `.env` (or `.env.local`) in the project folder:

```
AUTH_SECRET=<a long random string; this prints one: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))">
SITE_URL=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=icdms.nitp@gmail.com
SMTP_PASS=abcdefghijklmnop
GITHUB_UPLOAD_TOKEN=<see README, Setup>
```

| Setting | What it is |
|---|---|
| `AUTH_SECRET` | Signs the sign-in links and cookies. Anyone who has it can sign in as anyone, so keep it secret, and use a different one on Vercel. Changing it signs everybody out. |
| `SITE_URL` | The live address, like `https://icdms.vercel.app`. Sign-in links point here. Leave it empty on your computer. |
| `SMTP_HOST`, `SMTP_PORT` | Gmail: `smtp.gmail.com` and `465`. |
| `SMTP_USER`, `SMTP_PASS` | The sending address and the app password from step 3. |

**Testing on your computer without email:** leave `SMTP_HOST` empty. When you ask for a link, it is printed in the terminal running `npm run dev` instead of being emailed. Copy it into the browser.

**On Vercel:** *Project → Settings → Environment Variables*, add all five with `SITE_URL` set to the live address, then redeploy (*Deployments → ⋯ → Redeploy*). Settings apply only to new deployments.

Never commit `.env` or `.env.local`; both are in `.gitignore`.

## 5. Add the IC members

```
npm run add-member your.name@nitp.ac.in
npm run add-member asha.r@nitp.ac.in rohit.k@nitp.ac.in
```

Each email is added to `.members` as a hash; the file never holds a readable address. Commit `.members` and push. The new members can sign in after the deploy finishes, a minute or two later.

**To remove someone:** find their line, delete it from `.members`, commit and push.

```
npm run add-member -- --find asha.r@nitp.ac.in
```

They lose upload access at the next deploy, even if they are still signed in.

## 6. Test it

1. Add your own email (step 5) and run `npm run dev`.
2. Open http://localhost:3000/upload, enter your name and email, and click **Email me a sign-in link**.
3. Open the link (from your inbox, or the terminal if `SMTP_HOST` is empty). You land on the upload form, signed in.
4. Try an email that is not on the list: the page says the same thing, but no email arrives.

## If something goes wrong

| What you see | Cause and fix |
|---|---|
| "Couldn't send the email" on the site, and `535 … Username and Password not accepted` in the logs | The app password is wrong, has spaces, or was cancelled by a password change. Create a new one (step 3). |
| A member gets no email | Check their address is on the list: `npm run add-member -- --find their@email`. Check that `.members` was pushed and deployed, and ask them to look in spam. |
| "That sign-in link has expired or isn't valid" | Links last 15 minutes, and stop working if the member was removed or `AUTH_SECRET` changed. Ask for a new link. |
| Sign-in emails go to spam | Ask members to mark the first one "Not spam". Sending from a shared account with a clear name helps. |
| Links in the email point to `localhost` | `SITE_URL` isn't set on Vercel. Set it and redeploy. |

## Using another email provider

Any SMTP account works: the college mail server, Outlook, Zoho, Brevo and so on. Use the host, port, username and password your provider gives for SMTP. Port `465` uses SSL; port `587` uses STARTTLS, and both are handled automatically.
