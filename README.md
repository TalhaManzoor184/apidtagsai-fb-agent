# RapidTagsAI Facebook Agent

Har roz automatically Facebook Page par ek SEO / hashtag post karta hai — AI se caption, aur rapidtagsai.com ka UTM-tracked link. Ek din branded 1080×1080 image post, agle din 10 second ka animated 1080×1920 Reel.

```
GitHub Actions (cron) → pick content pillar → LLM writes post (JSON)
   → render image (satori + resvg) → Graph API /{page-id}/photos → save history
```

- **8 content pillars** rotate (YouTube tags, TikTok/Instagram hashtags, myth vs fact, mistakes, niche hashtag packs, tool tutorial, algorithm insight).
- **No repeats:** last 40 topics are fed to the model; `data/history.json` is committed back after each post.
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
- Reel: 10s, 30 fps, H.264 + silent AAC, rendered frame-by-frame (satori + resvg) and encoded with the bundled `ffmpeg-static` binary — no system ffmpeg needed. Text stays inside Facebook's safe area (bottom/right UI overlays).
- Upload uses the Page Reels API (`/{page-id}/video_reels` start → `rupload` → finish) and waits for processing so errors surface in the run. Same Page token permissions as photos.
- Local preview: `npm run mock` (set `POST_TYPE=reel` in `.env`) → `out/reel.mp4` + `out/reel-preview.png`.

## Customise

- Topics: edit `PILLARS` in `src/content.ts`.
- Voice/rules: `SYSTEM` prompt in `src/content.ts`.
- Design: colors (`C`) and layout in `src/image.ts`; reel timeline/animation in `src/reel.ts` (`T` timings, `frame()`).
