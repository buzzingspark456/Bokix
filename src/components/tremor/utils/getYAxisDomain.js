// Ported from Tremor Raw (tremorlabs/tremor, MIT license) — getYAxisDomain
// [v0.0.0]. Unchanged from upstream, just JS instead of TS.
export const getYAxisDomain = (autoMinValue, minValue, maxValue) => {
  const minDomain = autoMinValue ? 'auto' : (minValue ?? 0);
  const maxDomain = maxValue ?? 'auto';
  return [minDomain, maxDomain];
};
