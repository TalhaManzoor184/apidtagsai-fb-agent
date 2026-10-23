# RapidTagsAI Facebook Agent

Har roz automatically Facebook Page par ek SEO / hashtag post karta hai — AI se caption, aur rapidtagsai.com ka UTM-tracked link. Ek din branded 1080×1080 image post, agle din 10 second ka animated 1080×1920 Reel.

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

> The app can stay in Development mode as long as you're an admin of both the app and the Page — you're only posting to your own Page.

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
- GitHub disables scheduled workflows after 60 days without repo activity; the daily history commit keeps it active.
- Scheduled runs can start a few minutes late at peak times — normal for Actions.
- Model names and Graph API version are env vars, so updates don't need code changes.

## Photo / Reel rotation

- `POST_TYPE=auto` (default): alternates with the last successful post in `data/history.json` (photo → reel → photo …). A failed run doesn't flip the order.
- `POST_TYPE=photo` or `reel` forces one type (repo Variable, or the *post_type* dropdown on **Run workflow**).
- Reel: 10s, 30 fps, H.264 + AAC music, rendered frame-by-frame (satori + resvg) and encoded with the bundled `ffmpeg-static` binary — no system ffmpeg needed. Text stays inside Facebook's safe area (bottom/right UI overlays).
- Upload uses the Page Reels API (`/{page-id}/video_reels` start → `rupload` → finish) and waits for processing so errors surface in the run. Same Page token permissions as photos.
- Music: each reel gets an original generated track (`src/music.ts`: seeded key/tempo/chords, pads + arp + bass + drums, ~−14 LUFS), so no copyright claims. Put licensed tracks in `assets/music/` to use those instead; `MUSIC=off` for silence.
- Local preview: `npm run mock` (set `POST_TYPE=reel` in `.env`) → `out/reel.mp4` + `out/reel-preview.png`.

## Customise

- Categories, calendar, formats, CTAs, voice and rules: `src/guide.ts`.
- Test a category: **Run workflow** → *category* dropdown.
- Design: colors (`C`) and layout in `src/image.ts`; reel timeline/animation in `src/reel.ts` (`T` timings, `frame()`).
