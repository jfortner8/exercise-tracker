import Storage from "expo-sqlite/kv-store";

/** Where the query cache is kept between launches, so the app opens on the last data it saw. */
export const cacheStorage = Storage;
