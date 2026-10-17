<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Cursor Cloud specific instructions

- Install with Bun. The lockfile is `bun.lock`. `bun install --frozen-lockfile` is safe to run more than once. The README `npm i` command does not match this lockfile.
- The dev server listens on port 8080: `bun run dev -- --host 0.0.0.0 --port 8080`.
- The committed `.env` contains the public Supabase URL and publishable key. Homepage, product, and order pages load live catalog prices with those values.
- Creating an order, looking up an order, and admin actions use the service-role client. `SUPABASE_SERVICE_ROLE_KEY` is not in the repository. Do not submit orders against the live project unless that key is present and writing data is intended.
- `bun x tsc --noEmit` and `bun run build` succeed. `bun run lint` reports existing Prettier issues in generated Supabase files.
