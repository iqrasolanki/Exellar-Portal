# Exellar Portal

## Required Supabase environment variables

This project expects the browser to load a generated config file called `assets/js/exellar-config.js` at runtime.

Create or update that file with the real public Supabase anon key for the existing project:

```js
window.EXELLAR_CONFIG = {
  supabaseUrl: 'https://hxwctxkjujiyxmhyvwdw.supabase.co',
  supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY'
};
```

Do not expose the Supabase service role key in the browser or commit it to GitHub.

## Initial admin setup

Set `INITIAL_ADMIN_EMAIL` in the Supabase Auth or deployment configuration for the first administrator account. The first authenticated user matching that email will become the portal admin after the user profile is created.

## Database setup

Apply the SQL from `supabase-roles.sql` in the Supabase SQL editor for the existing project.

## Important security note

The portal frontend should never be trusted as the only authorization layer. Row Level Security on Supabase tables is required to enforce `USER` and `ADMIN` permissions.
