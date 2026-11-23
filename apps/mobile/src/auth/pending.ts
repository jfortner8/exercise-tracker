/**
 * The email and password from sign-up (or from a sign-in that turned out to be unconfirmed), held in
 * memory only until the confirm screen signs in with them. Never written anywhere.
 */
let pending: { email: string; password: string } | null = null;

export const setPending = (email: string, password: string) => {
  pending = { email, password };
};
export const getPending = () => pending;
export const clearPending = () => {
  pending = null;
};
