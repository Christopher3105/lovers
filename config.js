// =====================================================================
//  SETTINGS — the only file you need to edit
// =====================================================================

// Supabase dashboard -> Project Settings -> API (or "API Keys")
export const SUPABASE_URL = 'https://hdldeqwaqgcffokbumvz.supabase.co';

// Use the "publishable" key (sb_publishable_...) or, on older projects,
// the "anon public" key. It is safe to put on GitHub because the
// security rules in database.sql protect the data.
// NEVER put the "secret" / "service_role" key here.
export const SUPABASE_KEY = 'sb_publishable_ngKWdz6Za5pQCxPK28Yw1w_3SMcu5KW';

// People log in with a username. Behind the scenes it becomes
// username@EMAIL_DOMAIN, which must match the email you gave the
// user in Supabase -> Authentication -> Users.
//   "ember"  ->  ember@example.com
export const EMAIL_DOMAIN = 'example.com';

// Your app's name and the line under it on the login screen.
// (The logo is the file logo.svg — replace it to change the logo.
//  Also change "name" in manifest.webmanifest for phone home screens.)
export const APP_NAME = 'Lovers';
export const APP_TAGLINE = 'A Private space for two Lovers and their 3 cats';

// Must match the buckets created in database.sql
export const IMAGE_BUCKET = 'chat-images';      // photos + voice messages
export const PROFILE_BUCKET = 'profile-media';  // profile pictures + profile songs

// Sticker files inside the /stickers folder.
// Add your own PNG / GIF / WEBP / SVG there and list the file name here.
export const STICKERS = [
  'heart.svg',
  'fire.svg',
  'lol.svg',
  'haha.svg',
  'ok.svg',
  'no-way.svg',
  'miss-you.svg',
  'good-night.svg',
  'brb.svg',
  'coffee.svg',
  'blob-happy.svg',
  'blob-love.svg',
  'blob-shock.svg',
  'blob-sad.svg',
  'blob-angry.svg',
];
