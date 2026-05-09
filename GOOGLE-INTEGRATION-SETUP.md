# Google Drive + Calendar Integration — Setup Guide

You asked for Google Drive and Calendar built into Taha OS. These need OAuth credentials from your Google Cloud account before any code can talk to them — that part can't be automated. Once you have the credentials, the integration plugs in cleanly.

This is a 10-minute setup. Do it when you have a quiet 10 minutes; don't rush it during a meeting.

## Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com
2. Top-left "Select a project" → "New project"
3. Name: `taha-media-os`
4. Create. Wait 30 seconds. Make sure it's selected at the top.

## Step 2 — Enable the APIs you need

In the left sidebar, go to **APIs & Services → Library**. Search and click "Enable" for each:

- Google Drive API
- Google Calendar API
- Google People API (just for showing the connected user's name)

## Step 3 — Create OAuth consent screen

In **APIs & Services → OAuth consent screen**:

1. User Type: **External** → Create
2. App name: `Taha Media OS`
3. User support email: your Gmail
4. Developer email: your Gmail
5. Save and continue
6. Scopes — click "Add or remove scopes" and tick:
   - `.../auth/drive.readonly` (read Drive files)
   - `.../auth/drive.file` (let the app create/edit files it owns)
   - `.../auth/calendar` (read + write calendar)
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
7. Save and continue
8. Test users — add your own Gmail (`tahagroupsltd@gmail.com`) and any teammates who'll connect.
9. Save. Leave the app in "Testing" mode for now — it works fine for a small team.

## Step 4 — Create OAuth client ID

In **APIs & Services → Credentials**:

1. "Create credentials" → "OAuth client ID"
2. Application type: **Web application**
3. Name: `Taha OS Web`
4. Authorized JavaScript origins:
   - `https://taha-os-clean.vercel.app`
   - `http://localhost:3000` (so it works locally too)
5. Authorized redirect URIs:
   - `https://taha-os-clean.vercel.app/api/google/callback`
   - `http://localhost:3000/api/google/callback`
6. Create.
7. Copy the **Client ID** and **Client secret** somewhere safe — you'll only see the secret once.

## Step 5 — Send me the credentials

Send the Client ID and Client Secret in the chat (or paste them into a file in this folder named `google-creds.txt`). I'll wire them into:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` env vars on Vercel
- A new "Connect Google" button in Settings that takes the user through OAuth
- `/drive` page that lists and opens Drive files
- `/calendar` integration that syncs two-way with Google Calendar

## What you'll get afterwards

- **Drive:** Browse files, attach Drive links to Content items, upload from Taha OS into a project folder.
- **Calendar:** Two-way sync — events created in Taha OS show up in your Google Calendar and vice versa.
- **Per-user connection:** Each team member connects their own Google account from Settings. You see their availability.

---

If you want me to skip OAuth and just hard-code your single Google account: that's possible too (simpler, but only works for one user). Tell me which way to go.
