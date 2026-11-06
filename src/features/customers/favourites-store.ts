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

function load() {
  loading ??= getFavouriteStateAction()
    .then((result) =>
      set({ loaded: true, signedIn: result.signedIn, isStaff: result.isStaff, ids: new Set(result.ids) }),
    )
    .catch(() => set({ ...state, loaded: true }));
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  void load();
  return () => listeners.delete(listener);
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
