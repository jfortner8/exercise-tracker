import * as SecureStore from "expo-secure-store";

/** The session token lives in the phone's keychain (iOS) or keystore (Android). */
const KEY = "session-token";

export const readToken = () => SecureStore.getItemAsync(KEY);
export const saveToken = (token: string) => SecureStore.setItemAsync(KEY, token);
export const deleteToken = () => SecureStore.deleteItemAsync(KEY);
