// Tremor Raw AreaChart, ported from tremorlabs/tremor (MIT license,
// https://github.com/tremorlabs/tremor) — this is a genuine port of their
// component (interactive legend w/ keyboard scroll, gradient fills, custom
// tooltip, click-to-isolate a category/point), not a simplified rebuild.
// Changes from upstream: TypeScript stripped to plain JS/JSX (this project
// has no .ts/.tsx files anywhere else), @remixicon/react's two chevron
// icons swapped for lucide-react's ChevronLeft/ChevronRight (lucide is
// already the one icon set every other component in this app uses — no
// reason to pull in a second icon library for two arrows), "use client"
// dropped (a Next.js-only directive, meaningless under Vite). Recharts
// sub-API (Area/CartesianGrid/Dot/Label/Line/Tooltip/XAxis/YAxis/
// ResponsiveContainer) is otherwise identical to what Dashboard.jsx
// already uses successfully against this project's recharts v3 install.
//
// Styling is real Tailwind utility classes (bg-*, stroke-*, fill-*, ...) —
// scoped via src/tremor.css, see that file's own comment for why the rest
// of the app's hand-styled components are unaffected.
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Area, CartesianGrid, Dot, Label, Line,
  AreaChart as RechartsAreaChart, Legend as RechartsLegend,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useOnWindowResize } from './hooks/useOnWindowResize';
import { AvailableChartColors, constructCategoryColors, getColorClassName, colorStyle } from './utils/chartColors';
import { cx } from './utils/cx';
import { getYAxisDomain } from './utils/getYAxisDomain';
import { hasOnlyOneValueForKey } from './utils/hasOnlyOneValueForKey';

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
        className={cx('h-[3px] w-3.5 shrink-0 rounded-full', getColorClassName(color, 'bg'), activeLegend && activeLegend !== name ? 'opacity-40' : 'opacity-100')}
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

  const legendPayload = payload.filter((item) => item.type !== 'none');
  const paddingLeft = legendPosition === 'left' && yAxisWidth ? yAxisWidth - 8 : 0;

  return (
    <div ref={legendRef} style={{ paddingLeft }} className={cx('flex items-center', { 'justify-center': legendPosition === 'center' }, { 'justify-start': legendPosition === 'left' }, { 'justify-end': legendPosition === 'right' })}>
      <Legend
        categories={legendPayload.map((entry) => entry.value)}
        colors={legendPayload.map((entry) => categoryColors.get(entry.value))}
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
                <span aria-hidden="true" className={cx('h-[3px] w-3.5 shrink-0 rounded-full', getColorClassName(color, 'bg'))} style={colorStyle(color, 'bg')} />
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

//#region AreaChart

const AreaChart = React.forwardRef((props, ref) => {
  const {
    data = [], categories = [], index, colors = AvailableChartColors,
    valueFormatter = (value) => value.toString(),
    // Avsteg från upstream: y-axeln kan behöva en KORTARE form än tooltipen.
    // Utkastet skriver axeln i tusental ("500 tkr") men ett bokfört belopp
    // ska kunna läsas exakt vid hovring — upstream tvingar båda att dela
    // samma `valueFormatter`. Faller tillbaka på den när inget skickas.
    tickFormatter,
    startEndOnly = false, showXAxis = true, showYAxis = true, showGridLines = true,
    yAxisWidth = 56, intervalType = 'equidistantPreserveStart',
    showTooltip = true, showLegend = true,
    autoMinValue = false, minValue, maxValue, allowDecimals = true,
    connectNulls = false, className, onValueChange, enableLegendSlider = false,
    // Avsteg från upstream (som hårdkodar `type="linear"` och bara ritar
    // punkter för en serie med EN enda datapunkt):
    //   `curveType` — recharts egen kurvtyp. 'linear' kvar som förval så
    //     inget befintligt diagram ändrar utseende av att egenskapen finns.
    //     Rapportsidans linje- och ytlägen skickar 'monotone': en mjuk kurva
    //     som ALDRIG överskjuter sina egna datapunkter (till skillnad från
    //     'natural'/'basis', som kan rita en topp där det inte finns någon
    //     — oacceptabelt när kurvan visar bokförda belopp).
    //   `showDots` — en markör per datapunkt. I ett linjediagram över
    //     månader är punkterna de faktiska mätvärdena; utan dem går det
    //     inte att se om kurvan har nio värden eller nittio.
    curveType = 'linear', showDots = false,
    //   `strokeWidth` — upstream hårdkodar 2px. Rapportsidans kurvor bär
    //     hela panelen och tål (och behöver) en tjockare linje för att inte
    //     se tunn ut i ett brett kort; 2 kvar som förval så inget annat
    //     diagram ändras av att egenskapen finns.
    strokeWidth = 2,
    //   `dashedCategories` — serier som ska ritas streckade. Upstream kan
    //     inte sätta streckmönster per serie alls. Behövs för
    //     jämförelseserier (föregående år): de skiljs på FORM, inte bara på
    //     en blekare färg, så de går att hålla isär även för den som inte
    //     uppfattar färgskillnaden.
    dashedCategories = [],
    tickGap = 5, xAxisLabel, yAxisLabel, type = 'default', legendPosition = 'right',
    fill = 'gradient', tooltipCallback, customTooltip, ...other
  } = props;
  const CustomTooltip = customTooltip;
  const paddingValue = (!showXAxis && !showYAxis) || (startEndOnly && !showYAxis) ? 0 : 20;
  const [legendHeight, setLegendHeight] = React.useState(60);
  const [activeDot, setActiveDot] = React.useState(undefined);
  const [activeLegend, setActiveLegend] = React.useState(undefined);
  const categoryColors = constructCategoryColors(categories, colors);

  const yAxisDomain = getYAxisDomain(autoMinValue, minValue, maxValue);
  const hasOnValueChange = !!onValueChange;
  const stacked = type === 'stacked' || type === 'percent';
  const areaId = React.useId();

  const prevActiveRef = React.useRef(undefined);
  const prevLabelRef = React.useRef(undefined);

  const getFillContent = ({ fillType, activeDot: ad, activeLegend: al, category }) => {
    const stopOpacity = ad || (al && al !== category) ? 0.1 : 0.3;
    switch (fillType) {
      case 'none':
        return <stop stopColor="currentColor" stopOpacity={0} />;
      case 'gradient':
        return (
          <>
            <stop offset="5%" stopColor="currentColor" stopOpacity={stopOpacity} />
            <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
          </>
        );
      case 'solid':
      default:
        return <stop stopColor="currentColor" stopOpacity={stopOpacity} />;
    }
  };

  function valueToPercent(value) { return `${(value * 100).toFixed(0)}%`; }

  function onDotClick(itemData, event) {
    event.stopPropagation();
    if (!hasOnValueChange) return;
    if (
      (itemData.index === activeDot?.index && itemData.dataKey === activeDot?.dataKey) ||
      (hasOnlyOneValueForKey(data, itemData.dataKey) && activeLegend && activeLegend === itemData.dataKey)
    ) {
      setActiveLegend(undefined);
      setActiveDot(undefined);
      onValueChange?.(null);
    } else {
      setActiveLegend(itemData.dataKey);
      setActiveDot({ index: itemData.index, dataKey: itemData.dataKey });
      onValueChange?.({ eventType: 'dot', categoryClicked: itemData.dataKey, ...itemData.payload });
    }
  }

  function onCategoryClick(dataKey) {
    if (!hasOnValueChange) return;
    if (
      (dataKey === activeLegend && !activeDot) ||
      (hasOnlyOneValueForKey(data, dataKey) && activeDot && activeDot.dataKey === dataKey)
    ) {
      setActiveLegend(undefined);
      onValueChange?.(null);
    } else {
      setActiveLegend(dataKey);
      onValueChange?.({ eventType: 'category', categoryClicked: dataKey });
    }
    setActiveDot(undefined);
  }

  return (
    <div ref={ref} className={cx('tremor h-80 w-full', className)} tremor-id="tremor-raw" {...other}>
      <ResponsiveContainer>
        <RechartsAreaChart
          data={data}
          onClick={hasOnValueChange && (activeLegend || activeDot) ? () => { setActiveDot(undefined); setActiveLegend(undefined); onValueChange?.(null); } : undefined}
          margin={{ bottom: xAxisLabel ? 30 : undefined, left: yAxisLabel ? 20 : undefined, right: yAxisLabel ? 5 : undefined, top: 5 }}
          stackOffset={type === 'percent' ? 'expand' : undefined}
        >
          {showGridLines ? <CartesianGrid className={cx('stroke-gray-200 stroke-1 dark:stroke-gray-800')} horizontal={true} vertical={false} /> : null}
          <XAxis
            padding={{ left: paddingValue, right: paddingValue }}
            hide={!showXAxis}
            dataKey={index}
            interval={startEndOnly ? 'preserveStartEnd' : intervalType}
            tick={{ transform: 'translate(0, 6)' }}
            ticks={startEndOnly ? [data[0][index], data[data.length - 1][index]] : undefined}
            fill=""
            stroke=""
            className={cx('text-xs', 'fill-gray-500 dark:fill-gray-500')}
            tickLine={false}
            axisLine={false}
            minTickGap={tickGap}
          >
            {xAxisLabel && <Label position="insideBottom" offset={-20} className="fill-gray-800 text-sm font-medium dark:fill-gray-200">{xAxisLabel}</Label>}
          </XAxis>
          <YAxis
            width={yAxisWidth}
            hide={!showYAxis}
            axisLine={false}
            tickLine={false}
            type="number"
            domain={yAxisDomain}
            tick={{ transform: 'translate(-3, 0)' }}
            fill=""
            stroke=""
            className={cx('text-xs', 'fill-gray-500 dark:fill-gray-500')}
            tickFormatter={type === 'percent' ? valueToPercent : (tickFormatter || valueFormatter)}
            allowDecimals={allowDecimals}
          >
            {yAxisLabel && <Label position="insideLeft" style={{ textAnchor: 'middle' }} angle={-90} offset={-15} className="fill-gray-800 text-sm font-medium dark:fill-gray-200">{yAxisLabel}</Label>}
          </YAxis>
          <Tooltip
            wrapperStyle={{ outline: 'none' }}
            isAnimationActive={true}
            animationDuration={100}
            cursor={{ stroke: '#d1d5db', strokeWidth: 1 }}
            offset={20}
            position={{ y: 0 }}
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
          {categories.map((category) => {
            const categoryId = `${areaId}-${category.replace(/[^a-zA-Z0-9]/g, '')}`;
            return (
              <React.Fragment key={categoryId}>
                {/* <defs> och <Area> nedan är SYSKON i den här Fragmenten —
                    måste ha olika key trots att båda logiskt "hör till"
                    samma category, annars klagar React (och recharts, som
                    plattar ut children internt) på dubblettnycklar. */}
                <defs key={`${categoryId}-defs`}>
                  <linearGradient className={cx(getColorClassName(categoryColors.get(category), 'text'))} style={colorStyle(categoryColors.get(category), 'text')} id={categoryId} x1="0" y1="0" x2="0" y2="1">
                    {getFillContent({ fillType: fill, activeDot, activeLegend, category })}
                  </linearGradient>
                </defs>
                <Area
                  className={cx(getColorClassName(categoryColors.get(category), 'stroke'))}
                  style={colorStyle(categoryColors.get(category), 'stroke')}
                  strokeOpacity={activeDot || (activeLegend && activeLegend !== category) ? 0.3 : 1}
                  activeDot={(dotProps) => {
                    const { cx: cxCoord, cy: cyCoord, stroke, strokeLinecap, strokeLinejoin, strokeWidth, dataKey } = dotProps;
                    return (
                      <Dot
                        className={cx('stroke-white dark:stroke-gray-950', onValueChange ? 'cursor-pointer' : '', getColorClassName(categoryColors.get(dataKey), 'fill'))}
                        style={colorStyle(categoryColors.get(dataKey), 'fill')}
                        cx={cxCoord} cy={cyCoord} r={5} fill="" stroke={stroke} strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} strokeWidth={strokeWidth}
                        onClick={(_, event) => onDotClick(dotProps, event)}
                      />
                    );
                  }}
                  dot={(dotProps) => {
                    const { stroke, strokeLinecap, strokeLinejoin, strokeWidth, cx: cxCoord, cy: cyCoord, dataKey, index: dotIndex } = dotProps;
                    if (
                      (showDots && !dashedCategories.includes(category) && !(activeDot || (activeLegend && activeLegend !== category))) ||
                      (hasOnlyOneValueForKey(data, category) && !(activeDot || (activeLegend && activeLegend !== category))) ||
                      (activeDot?.index === dotIndex && activeDot?.dataKey === category)
                    ) {
                      return (
                        <Dot
                          key={dotIndex} cx={cxCoord} cy={cyCoord} r={5} stroke={stroke} fill="" strokeLinecap={strokeLinecap} strokeLinejoin={strokeLinejoin} strokeWidth={strokeWidth}
                          className={cx('stroke-white dark:stroke-gray-950', onValueChange ? 'cursor-pointer' : '', getColorClassName(categoryColors.get(dataKey), 'fill'))}
                          style={colorStyle(categoryColors.get(dataKey), 'fill')}
                        />
                      );
                    }
                    return <React.Fragment key={dotIndex}></React.Fragment>;
                  }}
                  key={categoryId}
                  name={category}
                  type={curveType}
                  dataKey={category}
                  stroke=""
                  strokeWidth={dashedCategories.includes(category) ? 2 : strokeWidth}
                  strokeDasharray={dashedCategories.includes(category) ? '4 3' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  isAnimationActive={false}
                  connectNulls={connectNulls}
                  stackId={stacked ? 'stack' : undefined}
                  fill={`url(#${categoryId})`}
                />
              </React.Fragment>
            );
          })}
          {onValueChange
            ? categories.map((category) => (
                <Line
                  className={cx('cursor-pointer')}
                  strokeOpacity={0}
                  key={`${areaId}-${category.replace(/[^a-zA-Z0-9]/g, '')}-hit`}
                  name={category}
                  type="linear"
                  dataKey={category}
                  stroke="transparent"
                  fill="transparent"
                  legendType="none"
                  tooltipType="none"
                  strokeWidth={12}
                  connectNulls={connectNulls}
                  onClick={(lineProps, event) => { event.stopPropagation(); onCategoryClick(lineProps.name); }}
                />
              ))
            : null}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
});
AreaChart.displayName = 'AreaChart';

export { AreaChart };
