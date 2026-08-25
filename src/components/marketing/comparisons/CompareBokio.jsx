import React from 'react';
import CompareLayout from './CompareLayout';
import { COMPARISONS } from './comparisonData';

export default function CompareBokio() {
  return <CompareLayout data={COMPARISONS.bokio} />;
}
