# RapidTagsAI Social Agent (Facebook + Pinterest)

Har roz automatically Facebook Page par ek SEO / hashtag post karta hai — AI se caption, aur rapidtagsai.com ka UTM-tracked link. Ek din branded 1080×1080 image post, agle din 20 second ka animated 1080×1920 Reel (hook → 3 tip scenes → CTA).

```
GitHub Actions (cron) → weekday category + format → (trend research) → LLM writes post (JSON)
   → render image or reel → Graph API (photos / video_reels) → save history
```

- **Content guide:** `docs/content-guide.md` (original brief) is encoded in `src/guide.ts`: 9 categories with goals, ideas, CTAs and rules; the weekly calendar; 9 post formats; brand voice and hard rules.
- **Weekly calendar (PKT):** Mon Instagram tags · Tue TikTok tags · Wed YouTube tags · Thu video ideas · Fri YouTube descriptions / SEO titles · Sat trending ideas · Sun SEO checker / SEO blogs. Two-category days alternate.
- **Formats** rotate least-recently-used (tip, step-by-step, before/after, myth vs fact, mistakes, checklist, tool demo, challenge, soft promo).
- **No repeats:** everything published in the last 30 days is fed to the model. `data/history.json` records date, platform, type, category, format, topic, URL.
- **Trending (Saturday):** Gemini + Google Search grounding fetches current trends with sources first; without verified research the post is written as an evergreen idea and never called "trending".
- **SEO checker claims:** off until you set repo Variable `SEO_CHECKER_LIVE=true`.
- **Guardrails:** captions that promise guarantees are rejected and regenerated; 3-8 hashtags; CTA per category.
- **Images:** `template` mode = branded card (free, consistent). `gemini` mode = AI-generated background with the same branded overlay (falls back to template if the image call fails).
- **Providers:** Claude (default) or Gemini for text, switch with `LLM_PROVIDER`.

## 1. Facebook Page token (one-time)

1. [developers.facebook.com](https://developers.facebook.com) → **Create App** → type *Business*.
2. Add use case **Manage everything on your Page**; permissions: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`.
3. **Recommended (non-expiring):** Business Settings → *System Users* → add an Admin system user → **Assign assets** → your Page (full control) → **Generate token** for your app with the permissions above. This is a Page-capable token that doesn't expire.
   - Alternative: Graph API Explorer → get a User token → exchange for a long-lived user token → `GET /me/accounts` → copy that Page's `access_token` (long-lived Page tokens from a long-lived user token don't expire unless the password/permissions change).
4. Page ID: Page → About → *Page transparency*, or the `id` from `/me/accounts`.
5. Test: `curl "https://graph.facebook.com/v26.0/<PAGE_ID>?fields=name&access_token=<TOKEN>"` should return your Page name.

> **Switch the app to Live mode.** Posts published by an app in Development mode are visible only to people with a role on the app, not to the public. App settings → Basic: add a Privacy Policy URL and category, then set App Mode to Live. Posting to your own Page works with standard access; no App Review needed.

## 2. Run locally

```bash
npm ci
cp .env.example .env      # fill keys
npm run mock              # no API calls, renders out/post.png + out/post.txt
npm run dry               # real LLM, no posting
npm run post              # posts for real
```

## 3. Deploy on GitHub Actions (free)

1. Push this folder to a **private** GitHub repo.
2. Settings → Secrets and variables → Actions:
   - **Secrets:** `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY`), `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`
   - **Variables (optional):** `LLM_PROVIDER`, `IMAGE_MODE`, `POST_LANGUAGE`, `ANTHROPIC_MODEL`, `GEMINI_IMAGE_MODEL`, `FB_GRAPH_VERSION`
3. Actions → *Facebook auto-post* → **Run workflow** (dry run is on by default) → download the `post-…` artifact to preview.
4. The schedule then posts daily at 8:40 PM PKT. Edit the `cron` lines in `.github/workflows/post.yml` for a different time or more posts per day.

Notes
- Storage: preview artifacts (image/reel/pin) are kept for **1 day** only; each run also deletes any older artifacts. Published posts on Facebook/Pinterest are not affected.
- GitHub disables scheduled workflows after 60 days without repo activity; the daily history commit keeps it active.
- Scheduled runs can start a few minutes late at peak times — normal for Actions.
- Model names and Graph API version are env vars, so updates don't need code changes.

## Photo / Reel rotation

- `POST_TYPE=auto` (default): alternates with the last successful post in `data/history.json` (photo → reel → photo …). A failed run doesn't flip the order.
- `POST_TYPE=photo` or `reel` forces one type (repo Variable, or the *post_type* dropdown on **Run workflow**).
- Reel: 20s (hook 0-4s, one scene per tip 4-16s, CTA 16-20s), 30 fps, H.264 + AAC music, rendered frame-by-frame (satori + resvg) and encoded with the bundled `ffmpeg-static` binary — no system ffmpeg needed. Text stays inside Facebook's safe area (bottom/right UI overlays).
- Upload uses the Page Reels API (`/{page-id}/video_reels` start → `rupload` → finish) and waits for processing so errors surface in the run. Same Page token permissions as photos.
- Music: each reel gets an original generated track (`src/music.ts`: seeded key/tempo/chords, pads + arp + bass + drums, ~−14 LUFS), so no copyright claims. Put licensed tracks in `assets/music/` to use those instead; `MUSIC=off` for silence.
- Local preview: `npm run mock` (set `POST_TYPE=reel` in `.env`) → `out/reel.mp4` + `out/reel-preview.png`.

## Pinterest (after Facebook)

Every run that posts to Facebook also creates a Pin with its own Pinterest title/description and a `utm_source=pinterest` link:
image days → 1000×1500 image Pin; reel days → video Pin (cover = hook frame), falling back to the image Pin if video fails.
Pinterest errors never fail the run (shown as a warning; recorded as `pinterestError` in history).

**Status:** Standard access approved (Oct 2026); the workflow defaults to `PINTEREST_ENV=production`.

**Access levels:** new apps get *Trial* access → use `PINTEREST_ENV=sandbox` (Pins visible only to you). After *Standard* access is approved, switch to `production` and re-run the auth script (sandbox and production have separate tokens and boards).

Setup from GitHub only (no local script):
1. Add Secrets `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`; add `https://rapidtagsai.com/` as a redirect URI in the Pinterest app.
2. **Run workflow** with `platforms = pinterest` (dry run) → the run summary shows a Pinterest login link.
3. Open it, click **Allow**, copy the `code=...` from the address bar on rapidtagsai.com.
4. **Run workflow** again with that value in `pinterest_code` → token + board (*Creator SEO Tips by RapidTagsAI*) are saved encrypted in `data/pinterest-token.enc`.

Alternative local setup:
1. Pinterest **Business** account → [developers.pinterest.com](https://developers.pinterest.com) → **Connect app** (needs a privacy policy URL) → wait for Trial access.
2. In the app settings add redirect URI `http://localhost:8085/`.
3. Locally: put `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` (and `PINTEREST_ENV`) in `.env`, then `npm run pinterest:auth` → log in → it prints the secrets/variables to add (creates the board *Creator SEO Tips by RapidTagsAI* if needed; `-- --board "Name"` to choose).
4. GitHub: Secrets `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET`, `PINTEREST_REFRESH_TOKEN`, `PINTEREST_TOKEN_KEY`; Variables `PINTEREST_BOARD_ID`, `PINTEREST_ENV`.
5. Test: **Run workflow** → `dry_run` off, `platforms = pinterest` (doesn't touch Facebook or history).

Tokens: Pinterest rotates the refresh token on every refresh (~60-day life). The agent stores the newest one AES-256-GCM encrypted in `data/pinterest-token.enc` (key = `PINTEREST_TOKEN_KEY`) and commits it, so daily runs keep it alive. If it ever lapses (e.g. no runs for 60 days), run `npm run pinterest:auth` again and update `PINTEREST_REFRESH_TOKEN`.

**Standard access request:** screen-record `npm run pinterest:auth` (browser login + consent + the API calls printed in the terminal; hide the secrets) and upload it with the request in *My apps → Upgrade*.

## Customise

- Categories, calendar, formats, CTAs, voice and rules: `src/guide.ts`.
- Test a category: **Run workflow** → *category* dropdown.
- Pinterest copy: `pinTitle` / `pinDescription` instructions in `src/content.ts`; Pin image layout = `renderPinImage` in `src/image.ts`.
- Design: colors (`C`) and layout in `src/image.ts`; reel timeline/animation in `src/reel.ts` (`SCENES` timeline, scene functions).
