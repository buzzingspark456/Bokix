import React, { useMemo } from 'react';
import { resolveChartPalette, makeAmountFormatters } from '../../utils/chartPalette';
import { useIsDarkTheme } from '../../hooks/useIsDarkTheme';
import { dateLocale } from '../../i18n';

// Det lilla ur ReportUI.jsx som Startsidan behöver direkt, i en egen fil
// utan diagrambiblioteket (recharts, ca 350 kB). Startsidan visar då sina
// siffror medan diagrammet laddas. ReportUI.jsx exporterar samma saker
// vidare, så en och samma kontext gäller överallt.

/**
 * Färg och enhet för rapporternas diagram och belopp (se kommentaren som
 * tidigare låg i ReportUI.jsx): valen är företagets, så samma tal ser
 * likadana ut i varje panel. Utan provider ritas den semantiska paletten
 * och `auto`-enheten, precis som förut.
 */
export const ReportDisplayContext = React.createContext({
  palette: resolveChartPalette(),
  amount: makeAmountFormatters(),
});

export function ReportDisplayProvider({ colors, unit, children }) {
  // Temat läses här, EN gång, så alla paneler under providern byter
  // samtidigt när användaren växlar mellan ljust och mörkt.
  const isDark = useIsDarkTheme();
  const value = useMemo(() => ({
    palette: resolveChartPalette(colors, { dark: isDark }),
    amount: makeAmountFormatters(unit),
  }), [colors, unit, isDark]);
  return <ReportDisplayContext.Provider value={value}>{children}</ReportDisplayContext.Provider>;
}

export function useReportDisplay() {
  return React.useContext(ReportDisplayContext);
}

export const fmtDateRange = (start, end) => new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' }).formatRange(start, end);

/** Periodens namn och dess första och sista dag i klartext. Används av
 * både Företagsöversikten och Startsidan. */
export function PeriodHeading({ label, start, end }) {
  return (
    <div>
      <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>{label}</div>
      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>{fmtDateRange(start, end)}</div>
    </div>
  );
}
