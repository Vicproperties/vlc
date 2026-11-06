"use client";

import { useSyncExternalStore } from "react";
import { getFavouriteStateAction, toggleFavouriteAction } from "./actions";

/**
 * Per-visitor favourites for heart buttons on cached public pages. Loaded once per page view
 * (one server call), shared by every heart, updated optimistically on click.
 */
interface State {
  loaded: boolean;
  signedIn: boolean;
  isStaff: boolean;
  ids: Set<string>;
}

let state: State = { loaded: false, signedIn: false, isStaff: false, ids: new Set() };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const SERVER_STATE: State = { loaded: false, signedIn: false, isStaff: false, ids: new Set() };

function set(next: State) {
  state = next;
  for (const listener of listeners) listener();
}

/**
 * Signing in or out happens on the server and the page then changes without a full reload, so
 * this module would keep the old state. The Supabase session cookie is readable by the page: when
 * it changes (sign in, sign out, account deleted, password reset), the state is loaded again.
 */
function sessionSignature(): string {
  return document.cookie
    .split("; ")
    .filter((cookie) => /^sb-[^=]+-auth-token(\.\d+)?=/.test(cookie))
    .sort()
    .join("|");
}

let signature: string | null = null;
let watcher: ReturnType<typeof setInterval> | null = null;

function load() {
  loading ??= getFavouriteStateAction()
    .then((result) =>
      set({ loaded: true, signedIn: result.signedIn, isStaff: result.isStaff, ids: new Set(result.ids) }),
    )
    .catch(() => set({ ...state, loaded: true }));
  signature ??= sessionSignature();
  return loading;
}

function checkSession() {
  const current = sessionSignature();
  if (signature === null || current === signature) return;
  // Session refreshes rotate the cookie too; reloading is a single cheap request.
  signature = current;
  loading = null;
  void load();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  checkSession();
  watcher ??= setInterval(checkSession, 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && watcher) {
      clearInterval(watcher);
      watcher = null;
    }
  };
}

export function useFavourites(): State {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => SERVER_STATE,
  );
}

/** Current state once loaded; a click before the first load finishes waits for it. */
export async function loadedFavourites(): Promise<State> {
  await load();
  return state;
}

export async function toggleFavourite(propertyId: string): Promise<"ok" | "sign_in" | "staff" | "error"> {
  const had = state.ids.has(propertyId);
  const optimistic = new Set(state.ids);
  if (had) optimistic.delete(propertyId);
  else optimistic.add(propertyId);
  set({ ...state, ids: optimistic });

  const result = await toggleFavouriteAction(propertyId);
  if (result.ok) {
    const ids = new Set(state.ids);
    if (result.favourited) ids.add(propertyId);
    else ids.delete(propertyId);
    set({ ...state, ids });
    return "ok";
  }
  const reverted = new Set(state.ids);
  if (had) reverted.add(propertyId);
  else reverted.delete(propertyId);
  set({ ...state, ids: reverted });
  return result.reason;
}
