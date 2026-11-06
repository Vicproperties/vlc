# Setting up "Continue with Google" (customer sign-in)

Customers sign in with Google. The website code is ready; Google sign-in starts working once
these settings exist in Google Cloud and Supabase. This takes about 15 minutes and needs no
code changes. Staff dashboard sign-in is separate and is not affected.

You need: the Google account that should own the project (website4vic@gmail.com is fine) and
access to the Supabase dashboard.

## 1. Google Cloud: create the project and consent screen

1. Open https://console.cloud.google.com and sign in.
2. Top bar → project picker → **New project**. Name: `Vic Land and Property`. Create, then select it.
3. Left menu → **APIs & Services → OAuth consent screen** (may be shown as **Google Auth Platform**).
   - Click **Get started**.
   - App name: `Vic Land and Property`. User support email: your email.
   - Audience: **External**.
   - Contact email: your email. Agree and **Create**.
4. **Branding** (same area): add the logo if you want, and once the domain exists add the
   home page, privacy policy (`https://YOUR-DOMAIN/privacy-policy`) and terms
   (`https://YOUR-DOMAIN/terms-and-conditions`) links, plus the domain under authorised domains.
5. **Data access**: the default scopes (`email`, `profile`, `openid`) are all we use. Add nothing else.
6. **Audience → Publish app** so any Google user can sign in (while in "Testing", only listed test
   users can). The basic scopes above do not need Google verification.

## 2. Google Cloud: create the OAuth client

1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name: `Website`.
3. **Authorised JavaScript origins**:
   - `http://localhost:3000`
   - later, your live address, e.g. `https://YOUR-DOMAIN`
4. **Authorised redirect URIs** (exactly this, it is Supabase's address, not the website's):
   - `https://tcfpnbliwjlinwlgzmkc.supabase.co/auth/v1/callback`
5. Create. Copy the **Client ID** and **Client secret**. Keep the secret private: paste it only
   into Supabase in the next step, never into chat, email or the code.

## 3. Supabase: turn on Google

1. https://supabase.com/dashboard → the project → **Authentication → Sign In / Providers → Google**.
2. Enable, paste the Client ID and Client secret, **Save**.

## 4. Supabase: allow the website's return address

**Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` for now (change to `https://YOUR-DOMAIN` at launch, Stage 12).
- **Redirect URLs**, add:
  - `http://localhost:3000/auth/callback`
  - later: `https://YOUR-DOMAIN/auth/callback`

## 5. Check it

1. Run the site (`npm run dev`) and open http://localhost:3000/account/login.
2. Click **Continue with Google**, choose an account, and you should land on **My profile**.
3. Open any property, click the heart, then **My account → My favourites**.

Notes

- Use a personal Google account to test. The staff email (website4vic@gmail.com) is a dashboard
  account; if it is used for Google sign-in the site signs it out again and explains that staff
  accounts cannot use customer features. This is deliberate (staff and customer accounts are separate).
- If Google shows `redirect_uri_mismatch`, the redirect URI in step 2.4 is not exactly right.
- If you return to the site with "Sign-in did not complete", check step 4.
