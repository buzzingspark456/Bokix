import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

// Sida 43 (uppföljning): en enda delad tabell-komponent för listsidornas
// rader — riktig <table>/<thead>/<tbody>, aldrig fritt staplade <div>:er
// där ett fält kan hamna på en egen rad av misstag. Det var den troliga
// grundorsaken till att en trasig datapunkt (se felsökningen i Sida 43)
// hade kunnat visas som flera staplade rader istället för en ren cell —
// en riktig tabellcell kan bara innehålla EN sak per kolumn, aldrig ett
// oavsiktligt radbrytande extra värde.
//
// Låst radhöjd/padding/vertikal centrering på alla sidor genom att bara
// byta DEN HÄR komponentens konstanter, ingen enskild sidas tabell-JSX rörd.
const CELL_PADDING = '14px 16px'; // ≈ h-12/py-3 tillsammans med 13–14px text
const HEAD_CELL_PADDING = '12px 16px';

/**
 * Delad listtabell.
 *
 * @param {Array<{key, label, align?: 'left'|'right'|'center', render?: (row, i) => ReactNode, width?, wrap?: boolean, fontWeight?, color?}>} columns
 *   - `render` får hela raden + index; annars visas `row[col.key]` rakt av.
 *   - `wrap: true` tillåter radbrytning i cellen (annars nowrap, standard för tabellrader).
 * @param {Array<object>} rows
 * @param {(row) => string} rowKey
 * @param {(row) => void} [onRowClick] - gör hela raden klickbar (hover-bakgrund + pekarcursor).
 * @param {string} [emptyMessage] - visas som en centrerad rad när `rows` är tom.
 * @param {{checked: (row) => boolean, onToggle: (row) => void, allChecked?: boolean, onToggleAll?: () => void}} [selectable]
 *   - lägger till en kryssrutekolumn längst till vänster, inkl. en "markera alla" i headern.
 * @param {(row) => boolean} [isExpanded] - tillsammans med `renderExpanded`: en rad som kan fällas
 *   ut till en extra detaljrad under sig (t.ex. Bokförings verifikationsrader) istället för att
 *   navigera bort — vanlig radklick-navigering (`onRowClick`) och utfällning är ömsesidigt uteslutande.
 * @param {(row) => ReactNode} [renderExpanded]
 * @param {(row) => object} [rowStyle] - extra style-overrides för en enskild rad (t.ex.
 *   färgkodning per status/markerad) — slås samman ovanpå tabellens egna standardstilar.
 * @param {{key: string, dir: 'asc'|'desc', onSort: (sortKeyName: string) => void}} [sort]
 *   - tillsammans med `col.sortKeyName`: klickbar kolumnrubrik med sorteringspil.
 */
export default function ListTable({ columns, rows, rowKey, onRowClick, emptyMessage = 'Inga poster', selectable, isExpanded, renderExpanded, rowStyle, sort }) {
  const colSpan = columns.length + (selectable ? 1 : 0);
  return (
    // overflowX:'auto' (bugkritiskt, kundfeedback: "Status rutan är
    // sammanslagen med sidans header" — i själva verket klipptes
    // Status-kolumnen tyst bort utanför synfältet på smalare bredder,
    // eftersom .main-wrapper har overflow-x:hidden och den här boxen
    // tidigare bara klippte (overflow:'hidden') istället för att scrolla.
    // Nu får en tabell som är bredare än sin yta en egen vågrät scrollbar
    // istället för att sista kolumnen bara försvinner utanför kanten.
    // Kundfeedback: "toppen på rutorna ska vara rektangelar och inte en
    // rund format" — tabellen sitter numera flush direkt under filterraden
    // (ingen padding-gap ovanför den längre, se överflödesfixet ovan), så
    // en rundad TOPP lämnade två små böjda glipor där sidbakgrunden lyste
    // igenom i de övre hörnen istället för att kortet kändes hopfogat med
    // filterraden ovanför. Bara nederkanten rundad nu (samma "fäst mot det
    // ovanför, avrundad mot sidbakgrunden under"-princip som ListFilterBar/
    // ListPageHeader redan följer på sina egna nederkanter).
    <div style={{ background: 'var(--bg-card)', borderRadius: '0 0 12px 12px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)', overflowX: 'auto', overflowY: 'hidden' }}>
      {/* .responsive-table (Sida 38, punkt 1): staplar kolumnerna med
          data-label-etiketter under en brytpunkt istället för att tvinga
          sidledesskroll — samma klass alla listsidors tabeller redan delar. */}
      <table className="responsive-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--bg-muted)' }}>
            {selectable && (
              <th style={{ width: 36, padding: HEAD_CELL_PADDING, borderBottom: '1px solid var(--border)' }}>
                <input type="checkbox" checked={Boolean(selectable.allChecked)} onChange={() => selectable.onToggleAll?.()} style={{ cursor: 'pointer' }} />
              </th>
            )}
            {columns.map(col => {
              const sortable = sort && col.sortKeyName;
              const sortActive = sortable && sort.key === col.sortKeyName;
              return (
                <th
                  key={col.key}
                  onClick={sortable ? () => sort.onSort(col.sortKeyName) : undefined}
                  style={{
                    padding: HEAD_CELL_PADDING, textAlign: col.align || 'left', fontSize: '12px', fontWeight: 700,
                    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', width: col.width,
                    cursor: sortable ? 'pointer' : undefined, userSelect: sortable ? 'none' : undefined,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {col.label}
                    {sortActive && (sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />)}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                {emptyMessage}
              </td>
            </tr>
          ) : rows.map((row, i) => {
            const key = rowKey(row);
            const expanded = Boolean(isExpanded?.(row));
            return (
              <React.Fragment key={key}>
                <tr
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={{
                    borderBottom: expanded ? 'none' : (i < rows.length - 1 ? '1px solid var(--border-light)' : 'none'),
                    background: expanded ? 'var(--status-green-bg)' : undefined,
                    cursor: onRowClick ? 'pointer' : 'default', transition: 'background 0.1s',
                    ...rowStyle?.(row),
                  }}
                  onMouseEnter={onRowClick && !expanded ? e => { e.currentTarget.style.filter = 'brightness(0.97)'; } : undefined}
                  onMouseLeave={onRowClick && !expanded ? e => { e.currentTarget.style.filter = ''; } : undefined}
                >
                  {selectable && (
                    <td style={{ padding: CELL_PADDING, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectable.checked(row)} onChange={() => selectable.onToggle(row)} style={{ cursor: 'pointer' }} />
                    </td>
                  )}
                  {columns.map(col => (
                    <td
                      key={col.key}
                      data-label={col.label}
                      style={{
                        padding: CELL_PADDING, textAlign: col.align || 'left', verticalAlign: 'middle',
                        fontSize: col.fontSize || '13px', color: col.color || 'var(--text-secondary)',
                        fontWeight: col.fontWeight, whiteSpace: col.wrap ? 'normal' : 'nowrap',
                      }}
                    >
                      {col.render ? col.render(row, i) : row[col.key]}
                    </td>
                  ))}
                </tr>
                {expanded && renderExpanded && (
                  <tr style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                    <td colSpan={colSpan} className="td-detail" style={{ padding: 0, background: 'var(--status-green-bg)' }}>
                      {renderExpanded(row)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
