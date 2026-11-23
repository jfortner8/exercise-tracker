/**
 * The website the app talks to. EAS builds set EXPO_PUBLIC_API_URL per profile (eas.json); for local
 * work, put EXPO_PUBLIC_API_URL=http://<your computer's address>:3000 in apps/mobile/.env.local.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || "https://exercise.johnafortner.com").replace(/\/$/, "");
