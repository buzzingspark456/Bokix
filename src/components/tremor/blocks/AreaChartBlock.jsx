// Ported from blocks.tremor.so — "Area Chart 6" block
// (tremorlabs/tremor-blocks: src/content/components/area-charts/area-chart-06.tsx,
// MIT license). This is the actual block from that page, not a rebuild:
// Card, title + trend badge, a summary row of totals with colored swatches,
// a Divider, then a solid-fill AreaChart with no Y-axis and start/end-only
// x-axis labels — Tremor's own "revenue this year vs. last year" block.
//
// Genuinely parameterized (title/badge/subtitle/data/categories/colors/
// valueFormatter/summary as props) instead of the block's own hardcoded
// "This year"/"Last year" numbers, so the exact same block can be reused
// for Intäkter vs Utgifter (Dashboard.jsx) and any report card
// (ReportUI.jsx) — but every visual choice (Card padding, badge style,
// summary row layout, Divider, `fill="solid"`/`showYAxis={false}`/
// `startEndOnly`) is copied as-is from the source block, not invented.
import React from 'react';
import { Card } from '../Card';
import { Divider } from '../Divider';
import { AreaChart } from '../AreaChart';
import { cx } from '../utils/cx';

export function AreaChartBlock({
  title, badge, subtitle, data, index = 'date', categories, colors,
  valueFormatter = (n) => n.toString(), summary, showLegend = false,
}) {
  return (
    <div className="tremor obfuscate">
      <Card className="sm:mx-auto sm:max-w-xl">
        <div className="flex items-center space-x-2">
          <h1 className="text-sm font-medium text-gray-900 dark:text-gray-50">{title}</h1>
          {badge && (
            <span className="mt-0.5 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-400">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">{subtitle}</p>}
        <Divider className="!my-3" />
        {summary && (
          <ul role="list" className="flex items-center gap-10">
            {summary.map((category) => (
              <li key={category.name}>
                <div className="flex items-center space-x-2">
                  <span className={cx(category.color, 'h-[3px] w-3.5 shrink-0 rounded-full')} aria-hidden="true" />
                  <p className="text-xs text-gray-700 dark:text-gray-300">{category.name}</p>
                </div>
                <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">{valueFormatter(category.total)}</p>
              </li>
            ))}
          </ul>
        )}
        <AreaChart
          data={data}
          index={index}
          categories={categories}
          colors={colors}
          valueFormatter={valueFormatter}
          showLegend={showLegend}
          showYAxis={false}
          startEndOnly={true}
          fill="solid"
          className="mt-8 !h-48"
        />
      </Card>
    </div>
  );
}
