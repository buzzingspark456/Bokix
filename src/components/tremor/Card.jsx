// Ported from tremorlabs/tremor-blocks (MIT license) — Card [v0.0.2].
// TS stripped to JS; dropped the `asChild`/@radix-ui/react-slot polymorphic
// rendering (upstream lets Card render as a different element via Radix's
// Slot) since nothing in this app needs that — always a plain <div>, one
// fewer dependency for a feature we don't use.
import React from 'react';
import { cx } from './utils/cx';

const Card = React.forwardRef(({ className, ...props }, forwardedRef) => (
  <div
    ref={forwardedRef}
    className={cx(
      'relative w-full rounded-lg border p-6 text-left shadow-sm',
      'bg-white dark:bg-[#090E1A]',
      'border-gray-200 dark:border-gray-900',
      className,
    )}
    tremor-id="tremor-raw"
    {...props}
  />
));
Card.displayName = 'Card';

export { Card };
