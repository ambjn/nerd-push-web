# NerdPush decision log

Dated, append-only. Cloud refs here are verified from local configuration, not from the cloud consoles.

## 2026-10-26 Phase 1: cloud ownership

- Supabase A (app source) = project ref `bjsazcpqtmjyiasvggyt`. Evidence: NeshPushAndroid/.env SUPABASE_URL. Migrations live in `nerd-push-web/supabase/app/`.
- Supabase B (control) = project ref `bbcmuwexbiloxqehcabu`. Evidence: nerd-push-web/.env.local NEXT_PUBLIC_SUPABASE_URL. Migrations live in `nerd-push-web/supabase/control/`.
- Firebase = project `nerd-push`, Android package `com.ambjn.neshpushandroid`. Evidence: NeshPushAndroid/app/google-services.json (gitignored, present locally).
- Both repos push to GitHub user `ambjn` over the `github-personal` SSH host only.
- Registration API owner: nerd-push-web, under `app/api/app/`, using only the A write credential. The control worker uses a separate SELECT-only A connection.
- Not verified: Supabase display names, existing schema in either project, web hosting and scheduler. `supabase login` has not been run on this machine, so migrations are authored here and applied by the owner.
- Android talks to Supabase A only through the app-owned registration API, never with a Supabase key in the APK. The in-progress `todos` Postgrest demo is replaced in Phase 2.
