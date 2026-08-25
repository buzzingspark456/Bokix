import React from 'react';
import CompareLayout from './CompareLayout';
import { COMPARISONS } from './comparisonData';

export default function CompareVisma() {
  return <CompareLayout data={COMPARISONS['visma-eekonomi']} />;
}
