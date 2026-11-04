import { clsx, type ClassValue } from "clsx";

/** Join conditional class names. Components avoid conflicting utilities by design. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
