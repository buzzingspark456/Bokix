// Ported from Tremor Raw (tremorlabs/tremor, MIT license) — cx [v0.0.0].
// Unchanged from upstream, just JS instead of TS (no types to strip here).
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cx(...args) {
  return twMerge(clsx(...args));
}
