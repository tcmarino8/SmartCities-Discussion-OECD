# OECD Smart Cities Knowledge Graph (Starter)

This starter website gives you:

- An interactive knowledge graph inspired by your network canvas concept.
- Accessible module navigation via keyboard-friendly buttons.
- Per-module comments, thoughts, and research ideas.
- Local browser persistence using `localStorage`.
- JSON export of collected comments.

## Quick Start

1. Open `index.html` in your browser.
2. Click a graph node or module button.
3. Add comments or research ideas in the form.
4. Use **Export Comments JSON** to save discussion data.

## Files

- `index.html`: App structure and accessible sections.
- `style.css`: Visual design, layout, and responsive behavior.
- `app.js`: Graph animation, module details, and comment storage.

## Important Note

Comments are local to one browser/device for now. To make this collaborative across users, connect this UI to a shared backend database and authentication layer.

## Next Build Steps

- Parse dimensions directly from `AI_for_advancing_smart_cities.pdf` and replace seed modules.
- Add backend (Supabase/Firebase/Postgres API) for real multi-user discussion.
- Add moderation controls and optional anonymous posting.
- Add upvote tagging for promising research ideas.
