/** On the web build (for development only) there's no keychain: the token goes in localStorage. */
const KEY = "session-token";

export const readToken = async () => globalThis.localStorage?.getItem(KEY) ?? null;
export const saveToken = async (token: string) => globalThis.localStorage?.setItem(KEY, token);
export const deleteToken = async () => globalThis.localStorage?.removeItem(KEY);
