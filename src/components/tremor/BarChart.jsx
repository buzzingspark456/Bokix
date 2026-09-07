// Tremor Raw BarChart, ported from tremorlabs/tremor (MIT license,
// https://github.com/tremorlabs/tremor, src/components/BarChart/BarChart.tsx
// [v1.0.0], fetched verbatim from the upstream repo before porting) — same
// treatment as AreaChart.jsx in this folder: TypeScript stripped to plain
// JS/JSX, @remixicon/react's two chevron icons swapped for lucide-react's
// ChevronLeft/ChevronRight (lucide is already the one icon set every other
// component in this app uses), "use client" dropped (Next.js-only,
// meaningless under Vite). Recharts sub-API (Bar/CartesianGrid/Label/
// Legend/Tooltip/XAxis/YAxis/ResponsiveContainer) and every visual choice
// (flat un-rounded bars via the shape/renderShape trick, legend slider,
// click-to-isolate a category/bar) are otherwise unchanged from upstream.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Bar, CartesianGrid, Label,
  BarChart as RechartsBarChart, Legend as RechartsLegend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useOnWindowResize } from './hooks/useOnWindowResize';
import { AvailableChartColors, constructCategoryColors, getColorClassName, colorStyle, isRawColor } from './utils/chartColors';
import { cx } from './utils/cx';
import { getYAxisDomain } from './utils/getYAxisDomain';

//#region Shape

function deepEqual(obj1, obj2) {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object' || obj1 === null || obj2 === null) return false;
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  for (const key of keys1) {
    if (!keys2.includes(key) || !deepEqual(obj1[key], obj2[key])) return false;
  }
  return true;
}

// Avsteg från upstream Tremor Raw (som ritar en helt fyrkantig <rect>):
// dataviz-skillens mönsterspec vill ha "4px rundad data-ände, fyrkantig vid
// baslinjen" istället för ett fyrkantigt block i båda ändar — en liten,
// namngiven detalj som gör staplar läsbara som "moderna" snarare än en
// platt 2000-tals-stapel. `roundedTopPath` rundar bara änden BORT från
// baslinjen (y/y+height efter normaliseringen nedan) — korrekt för den här
// appens enda konsument (RevenueExpenseChart: Intäkter/Utgifter, alltid
// positiva belopp, aldrig under nollinjen). En framtida konsument med
// NEGATIVA värden (stapel under baslinjen) skulle behöva runda motsatt
// ände — inte hanterat här eftersom inget anropsställe behöver det ännu.
const BAR_RADIUS = 4;
function roundedTopPath(x, y, width, height) {
  const r = Math.max(0, Math.min(BAR_RADIUS, width / 2, height));
  if (r === 0) return `M${x},${y} h${width} v${height} h${-width} Z`;
  return `M${x},${y + r} A${r},${r} 0 0 1 ${x + r},${y} H${x + width - r} A${r},${r} 0 0 1 ${x + width},${y + r} V${y + height} H${x} Z`;
}

// `rawFill`: en rå hex/CSS-färg (se colorStyle i utils/chartColors.js) måste
// sättas som ett `fill`-ATTRIBUT här, inte via `style` på <Bar>. Recharts
// klonar bara `className` (inte `style`) ner på det element `shape` returnerar,
// så en inline-färg på <Bar> nådde aldrig fram — staplarna ritades svarta.
// `undefined` för namngivna tokens: då bär Tailwind-klassen färgen som förut.
const renderShape = (props, activeBar, activeLegend, layout, rawFill) => {
  const { fillOpacity, name, payload, value } = props;
  let { x, width, y, height } = props;

  if (layout === 'horizontal' && height < 0) {
    y += height;
    height = Math.abs(height); // height must be a positive number
  } else if (layout === 'vertical' && width < 0) {
    x += width;
    width = Math.abs(width); // width must be a positive number
  }

  return (
    <path
      d={roundedTopPath(x, y, width, height)}
      fill={rawFill}
      opacity={activeBar || (activeLegend && activeLegend !== name) ? (deepEqual(activeBar, { ...payload, value }) ? fillOpacity : 0.3) : fillOpacity}
    />
  );
};

//#region Legend

const LegendItem = ({ name, color, onClick, activeLegend }) => {
  const hasOnValueChange = !!onClick;
  return (
    <li
      className={cx(
        'group inline-flex flex-nowrap items-center gap-1.5 rounded-sm px-2 py-1 whitespace-nowrap transition',
        hasOnValueChange ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-default',
      )}
      onClick={(e) => { e.stopPropagation(); onClick?.(name, color); }}
    >
      <span
        className={cx('size-2 shrink-0 rounded-xs', getColorClassName(color, 'bg'), activeLegend && activeLegend !== name ? 'opacity-40' : 'opacity-100')}
        style={colorStyle(color, 'bg')}
        aria-hidden={true}
      />
      <p className={cx('truncate text-xs whitespace-nowrap', 'text-gray-700 dark:text-gray-300', hasOnValueChange && 'group-hover:text-gray-900 dark:group-hover:text-gray-50', activeLegend && activeLegend !== name ? 'opacity-40' : 'opacity-100')}>
        {name}
      </p>
    </li>
  );
};

const ScrollButton = ({ icon, onClick, disabled }) => {
  const Icon = icon;
  const [isPressed, setIsPressed] = React.useState(false);
  const intervalRef = React.useRef(null);

  React.useEffect(() => {
    if (isPressed) {
      intervalRef.current = setInterval(() => { onClick?.(); }, 300);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isPressed, onClick]);

  React.useEffect(() => {
    if (disabled) {
      clearInterval(intervalRef.current);
      setIsPressed(false);
    }
  }, [disabled]);

  return (
    <button
      type="button"
      className={cx(
        'group inline-flex size-5 items-center truncate rounded-sm transition',
        disabled ? 'cursor-not-allowed text-gray-400 dark:text-gray-600' : 'cursor-pointer text-gray-700 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-50',
      )}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseDown={(e) => { e.stopPropagation(); setIsPressed(true); }}
      onMouseUp={(e) => { e.stopPropagation(); setIsPressed(false); }}
    >
      <Icon className="size-full" aria-hidden="true" />
    </button>
  );
};

const Legend = React.forwardRef((props, ref) => {
  const { categories, colors = AvailableChartColors, className, onClickLegendItem, activeLegend, enableLegendSlider = false, ...other } = props;
  const scrollableRef = React.useRef(null);
  const scrollButtonsRef = React.useRef(null);
  const [hasScroll, setHasScroll] = React.useState(null);
  const [isKeyDowned, setIsKeyDowned] = React.useState(null);
  const intervalRef = React.useRef(null);

  const checkScroll = React.useCallback(() => {
    const scrollable = scrollableRef?.current;
    if (!scrollable) return;
    const hasLeftScroll = scrollable.scrollLeft > 0;
    const hasRightScroll = scrollable.scrollWidth - scrollable.clientWidth > scrollable.scrollLeft;
    setHasScroll({ left: hasLeftScroll, right: hasRightScroll });
  }, []);

  const scrollToTest = React.useCallback((direction) => {
    const element = scrollableRef?.current;
    const scrollButtons = scrollButtonsRef?.current;
    const scrollButtonsWith = scrollButtons?.clientWidth ?? 0;
    const width = element?.clientWidth ?? 0;
    if (element && enableLegendSlider) {
      element.scrollTo({
        left: direction === 'left' ? element.scrollLeft - width + scrollButtonsWith : element.scrollLeft + width - scrollButtonsWith,
        behavior: 'smooth',
      });
      setTimeout(() => { checkScroll(); }, 400);
    }
  }, [enableLegendSlider, checkScroll]);

  React.useEffect(() => {
    const keyDownHandler = (key) => {
      if (key === 'ArrowLeft') scrollToTest('left');
      else if (key === 'ArrowRight') scrollToTest('right');
    };
    if (isKeyDowned) {
      keyDownHandler(isKeyDowned);
      intervalRef.current = setInterval(() => { keyDownHandler(isKeyDowned); }, 300);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isKeyDowned, scrollToTest]);

  const keyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      setIsKeyDowned(e.key);
    }
  };
  const keyUp = (e) => { e.stopPropagation(); setIsKeyDowned(null); };

  React.useEffect(() => {
    const scrollable = scrollableRef?.current;
    if (enableLegendSlider) {
      checkScroll();
      scrollable?.addEventListener('keydown', keyDown);
      scrollable?.addEventListener('keyup', keyUp);
    }
    return () => {
      scrollable?.removeEventListener('keydown', keyDown);
      scrollable?.removeEventListener('keyup', keyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkScroll, enableLegendSlider]);

  return (
    <ol ref={ref} className={cx('relative overflow-hidden', className)} {...other}>
      <div
        ref={scrollableRef}
        tabIndex={0}
        className={cx('flex h-full', enableLegendSlider ? (hasScroll?.right || hasScroll?.left ? 'snap-mandatory items-center overflow-auto pr-12 pl-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : '') : 'flex-wrap')}
      >
        {categories.map((category, index) => (
          <LegendItem key={`item-${index}`} name={category} color={colors[index]} onClick={onClickLegendItem} activeLegend={activeLegend} />
        ))}
      </div>
      {enableLegendSlider && (hasScroll?.right || hasScroll?.left) ? (
        <div className={cx('absolute top-0 right-0 bottom-0 flex h-full items-center justify-center pr-1', 'bg-white dark:bg-gray-950')}>
          <ScrollButton icon={ChevronLeft} onClick={() => { setIsKeyDowned(null); scrollToTest('left'); }} disabled={!hasScroll?.left} />
          <ScrollButton icon={ChevronRight} onClick={() => { setIsKeyDowned(null); scrollToTest('right'); }} disabled={!hasScroll?.right} />
        </div>
      ) : null}
    </ol>
  );
});
Legend.displayName = 'Legend';

const ChartLegend = ({ payload }, categoryColors, setLegendHeight, activeLegend, onClick, enableLegendSlider, legendPosition, yAxisWidth) => {
  const legendRef = React.useRef(null);

  useOnWindowResize(() => {
    const calculateHeight = (height) => (height ? Number(height) + 15 : 60);
    setLegendHeight(calculateHeight(legendRef.current?.clientHeight));
  });

  const filteredPayload = payload.filter((item) => item.type !== 'none');
  const paddingLeft = legendPosition === 'left' && yAxisWidth ? yAxisWidth - 8 : 0;

  return (
    <div style={{ paddingLeft }} ref={legendRef} className={cx('flex items-center', { 'justify-center': legendPosition === 'center' }, { 'justify-start': legendPosition === 'left' }, { 'justify-end': legendPosition === 'right' })}>
      <Legend
        categories={filteredPayload.map((entry) => entry.value)}
        colors={filteredPayload.map((entry) => categoryColors.get(entry.value))}
        onClickLegendItem={onClick}
        activeLegend={activeLegend}
        enableLegendSlider={enableLegendSlider}
      />
    </div>
  );
};

//#region Tooltip

const ChartTooltip = ({ active, payload, label, valueFormatter }) => {
  if (active && payload && payload.length) {
    return (
      <div className={cx('rounded-md border text-sm shadow-md', 'border-gray-200 dark:border-gray-800', 'bg-white dark:bg-gray-950')}>
        <div className={cx('border-b border-inherit px-4 py-2')}>
          <p className={cx('font-medium', 'text-gray-900 dark:text-gray-50')}>{label}</p>
        </div>
        <div className={cx('space-y-1 px-4 py-2')}>
          {payload.map(({ value, category, color }, index) => (
            <div key={`id-${index}`} className="flex items-center justify-between gap-8">
              <div className="flex items-center space-x-2">
                <span aria-hidden="true" className={cx('size-2 shrink-0 rounded-xs', getColorClassName(color, 'bg'))} style={colorStyle(color, 'bg')} />
                <p className={cx('text-right whitespace-nowrap', 'text-gray-700 dark:text-gray-300')}>{category}</p>
              </div>
              <p className={cx('text-right font-medium whitespace-nowrap tabular-nums', 'text-gray-900 dark:text-gray-50')}>{valueFormatter(value)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

//#region BarChart

const BarChart = React.forwardRef((props, forwardedRef) => {
  const {
    data = [], categories = [], index, colors = AvailableChartColors,
    valueFormatter = (value) => value.toString(),
    // Se AreaChart.jsx: y-axeln får en egen, kortare form (tusental) medan
    // tooltipen behåller exakta kronor. Faller tillbaka på valueFormatter.
    tickFormatter,
    startEndOnly = false, showXAxis = true, showYAxis = true, showGridLines = true,
    yAxisWidth = 56, intervalType = 'equidistantPreserveStart',
    showTooltip = true, showLegend = true,
    autoMinValue = false, minValue, maxValue, allowDecimals = true,
    className, onValueChange, enableLegendSlider = false,
    barCategoryGap, tickGap = 5, xAxisLabel, yAxisLabel,
    // Avsteg från upstream: avståndet MELLAN de två staplarna i samma
    // månad. Recharts förval (4px) räcker när staplarna är smala, men när
    // de är breda (rapportsidan, se maxBarSize där) läses paret som en enda
    // bred stapel med en färgskarv i. Ett litet, explicit glapp håller ihop
    // paret som ett par utan att de smälter samman.
    barGap,
    layout = 'horizontal', type = 'default', legendPosition = 'right',
    tooltipCallback, customTooltip,
    // Avsteg från upstream (som inte exponerar detta alls): dataviz-
    // skillens mönsterspec säger staplar ska vara <=24px tjocka — med få
    // kategorier (t.ex. bara 3 månader) i ett brett kort blir recharts
    // egen automatiska bandbredd annars omotiverat FET. `undefined` som
    // standard bevarar exakt tidigare beteende (ingen konsument skickade
    // detta innan) för alla andra anropsställen.
    maxBarSize,
    ...other
  } = props;
  const CustomTooltip = customTooltip;
  const paddingValue = (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20;
  const [legendHeight, setLegendHeight] = React.useState(60);
  const [activeLegend, setActiveLegend] = React.useState(undefined);
  const categoryColors = constructCategoryColors(categories, colors);
  const [activeBar, setActiveBar] = React.useState(undefined);
  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const hasOnValueChange = !!onValueChange;
  const stacked = type === 'stacked' || type === 'percent';

  const prevActiveRef = React.useRef(undefined);
  const prevLabelRef = React.useRef(undefined);

  function valueToPercent(value) { return `${(value * 100).toFixed(0)}%`; }

  function onBarClick(barData, _index, event) {
    event.stopPropagation();
    if (!onValueChange) return;
    if (deepEqual(activeBar, { ...barData.payload, value: barData.value })) {
      setActiveLegend(undefined);
      setActiveBar(undefined);
      onValueChange?.(null);
    } else {
      setActiveLegend(barData.tooltipPayload?.[0]?.dataKey);
      setActiveBar({ ...barData.payload, value: barData.value });
      onValueChange?.({ eventType: 'bar', categoryClicked: barData.tooltipPayload?.[0]?.dataKey, ...barData.payload });
    }
  }

  function onCategoryClick(dataKey) {
    if (!hasOnValueChange) return;
    if (dataKey === activeLegend && !activeBar) {
      setActiveLegend(undefined);
      onValueChange?.(null);
    } else {
      setActiveLegend(dataKey);
      onValueChange?.({ eventType: 'category', categoryClicked: dataKey });
    }
    setActiveBar(undefined);
  }

  return (
    <div ref={forwardedRef} className={cx('tremor h-80 w-full', className)} tremor-id="tremor-raw" {...other}>
      <ResponsiveContainer>
        <RechartsBarChart
          data={data}
          onClick={hasOnValueChange && (activeLegend || activeBar) ? () => { setActiveBar(undefined); setActiveLegend(undefined); onValueChange?.(null); } : undefined}
          margin={{ bottom: xAxisLabel ? 30 : undefined, left: yAxisLabel ? 20 : undefined, right: yAxisLabel ? 5 : undefined, top: 5 }}
          stackOffset={type === 'percent' ? 'expand' : undefined}
          layout={layout}
          barCategoryGap={barCategoryGap}
          barGap={barGap}
        >
          {showGridLines ? <CartesianGrid className={cx('stroke-gray-200 stroke-1 dark:stroke-gray-800')} horizontal={layout !== 'vertical'} vertical={layout === 'vertical'} /> : null}
          <XAxis
            hide={!showXAxis}
            tick={{ transform: layout !== 'vertical' ? 'translate(0, 6)' : undefined }}
            fill="" stroke=""
            className={cx('text-xs', 'fill-gray-500 dark:fill-gray-500', { 'mt-4': layout !== 'vertical' })}
            tickLine={false}
            axisLine={false}
            minTickGap={tickGap}
            {...(layout !== 'vertical'
              ? {
                  padding: { left: paddingValue, right: paddingValue },
                  dataKey: index,
                  interval: startEndOnly ? 'preserveStartEnd' : intervalType,
                  ticks: startEndOnly ? [data[0][index], data[data.length - 1][index]] : undefined,
                }
              : {
                  type: 'number',
                  domain: yAxisDomain,
                  tickFormatter: type === 'percent' ? valueToPercent : (tickFormatter || valueFormatter),
                  allowDecimals,
                })}
          >
            {xAxisLabel && <Label position="insideBottom" offset={-20} className="fill-gray-800 text-sm font-medium dark:fill-gray-200">{xAxisLabel}</Label>}
          </XAxis>
          <YAxis
            width={yAxisWidth}
            hide={!showYAxis}
            axisLine={false}
            tickLine={false}
            fill="" stroke=""
            className={cx('text-xs', 'fill-gray-500 dark:fill-gray-500')}
            tick={{ transform: layout !== 'vertical' ? 'translate(-3, 0)' : 'translate(0, 0)' }}
            {...(layout !== 'vertical'
              ? { type: 'number', domain: yAxisDomain, tickFormatter: type === 'percent' ? valueToPercent : (tickFormatter || valueFormatter), allowDecimals }
              : { dataKey: index, ticks: startEndOnly ? [data[0][index], data[data.length - 1][index]] : undefined, type: 'category', interval: 'equidistantPreserveStart' })}
          >
            {yAxisLabel && <Label position="insideLeft" style={{ textAnchor: 'middle' }} angle={-90} offset={-15} className="fill-gray-800 text-sm font-medium dark:fill-gray-200">{yAxisLabel}</Label>}
          </YAxis>
          <Tooltip
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={true}
            animationDuration={100}
            cursor={{ fill: '#d1d5db', opacity: '0.15' }}
            offset={20}
            position={{ y: layout === 'horizontal' ? 0 : undefined, x: layout === 'horizontal' ? undefined : yAxisWidth + 20 }}
            content={({ active, payload, label }) => {
              const cleanPayload = payload
                ? payload.map((item) => ({ category: item.dataKey, value: item.value, index: item.payload[index], color: categoryColors.get(item.dataKey), type: item.type, payload: item.payload }))
                : [];
              if (tooltipCallback && (active !== prevActiveRef.current || label !== prevLabelRef.current)) {
                tooltipCallback({ active, payload: cleanPayload, label });
                prevActiveRef.current = active;
                prevLabelRef.current = label;
              }
              return showTooltip && active ? (
                CustomTooltip ? <CustomTooltip active={active} payload={cleanPayload} label={label} /> : <ChartTooltip active={active} payload={cleanPayload} label={label} valueFormatter={valueFormatter} />
              ) : null;
            }}
          />
          {showLegend ? (
            <RechartsLegend
              verticalAlign="top"
              height={legendHeight}
              content={({ payload }) => ChartLegend({ payload }, categoryColors, setLegendHeight, activeLegend, hasOnValueChange ? (clicked) => onCategoryClick(clicked) : undefined, enableLegendSlider, legendPosition, yAxisWidth)}
            />
          ) : null}
          {categories.map((category) => (
            <Bar
              className={cx(getColorClassName(categoryColors.get(category), 'fill'), onValueChange ? 'cursor-pointer' : '')}
              style={colorStyle(categoryColors.get(category), 'fill')}
              key={category}
              name={category}
              type="linear"
              dataKey={category}
              stackId={stacked ? 'stack' : undefined}
              isAnimationActive={false}
              fill=""
              maxBarSize={maxBarSize}
              shape={(shapeProps) => renderShape(shapeProps, activeBar, activeLegend, layout, isRawColor(categoryColors.get(category)) ? categoryColors.get(category) : undefined)}
              onClick={onBarClick}
            />
          ))}
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
});
BarChart.displayName = 'BarChart';

export { BarChart };
