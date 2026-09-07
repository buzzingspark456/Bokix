// Ported from Tremor Raw (tremorlabs/tremor, MIT license) —
// hasOnlyOneValueForKey [v0.1.0]. Unchanged from upstream, just JS instead
// of TS.
export function hasOnlyOneValueForKey(array, keyToCheck) {
  const val = [];
  for (const obj of array) {
    if (Object.prototype.hasOwnProperty.call(obj, keyToCheck)) {
      val.push(obj[keyToCheck]);
      if (val.length > 1) return false;
    }
  }
  return true;
}
