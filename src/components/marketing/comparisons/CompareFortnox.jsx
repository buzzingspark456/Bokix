import React from 'react';
import CompareLayout from './CompareLayout';
import { COMPARISONS } from './comparisonData';

export default function CompareFortnox() {
  return <CompareLayout data={COMPARISONS.fortnox} />;
}
