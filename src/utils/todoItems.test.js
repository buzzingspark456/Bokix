import { describe, it, expect } from 'vitest';
import { buildTodoItems } from './todoItems';

const t = (key, vars) => (vars ? `${key} ${JSON.stringify(vars)}` : key);
const today = new Date('2026-10-10T10:00:00');
const base = { t, today, company: { orgNr: '5566778899', address: 'Gatan 1', bankgiro: '123-4567', vatRegistered: true, fiscalYear: '2026-01-01' } };
const kinds = (items) => items.map(i => i.kind);
// Ett etablerat företag (inga Kom igång-rader).
const established = Array.from({ length: 30 }, (_, i) => ({ id: `v${i}`, date: '2026-09-01', rows: [] }));

describe('buildTodoItems', () => {
  it('förfallen faktura öppnar just den fakturan', () => {
    const items = buildTodoItems({ ...base, verifications: established, invoices: [{ id: 'f1', status: 'sent', dueDate: '2026-10-01', invoiceNumber: 7, total: 100 }] });
    const row = items.find(i => i.kind === 'overdue_invoices');
    expect(row.target).toEqual({ tab: 'invoices', action: { type: 'open_invoice', payload: { id: 'f1' } } });
    expect(row.sev).toBe('danger');
  });

  it('leverantörsfaktura som förfaller inom tre dagar, men inte en betald eller långt fram', () => {
    const expenses = [
      { id: 'l1', type: 'supplier_invoice', status: 'unpaid', dueDate: '2026-10-12', amount: 500, costAccount: '4010' },
      { id: 'l2', type: 'supplier_invoice', status: 'paid', dueDate: '2026-10-11', amount: 500, costAccount: '4010' },
      { id: 'l3', type: 'supplier_invoice', status: 'unpaid', dueDate: '2026-11-30', amount: 500, costAccount: '4010' },
    ];
    const row = buildTodoItems({ ...base, verifications: established, expenses }).find(i => i.kind === 'supplier_due');
    expect(row.target).toEqual({ tab: 'supplier_invoices', action: { type: 'view_supplier_invoice', payload: { id: 'l1' } } });
    expect(row.sev).toBe('warning');
  });

  it('banktransaktioner, anställda utan skattetabell och AGI', () => {
    const items = buildTodoItems({
      ...base, verifications: established,
      bankTransactions: [{ id: 'b1', status: 'unmatched' }, { id: 'b2', status: 'booked' }],
      employees: [{ id: 'e1', firstName: 'Bo', lastName: 'Berg', taxTable: { tabellnr: '' } }, { id: 'e2', taxTable: { tabellnr: '33' } }],
      payrollRuns: [{ id: 'r1', period: '2026-09', completedSteps: ['calculated', 'booked'] }],
    });
    expect(kinds(items)).toEqual(expect.arrayContaining(['bank_unmatched', 'employees_tax', 'agi_deadline']));
    expect(items.find(i => i.kind === 'employees_tax').title).toContain('Bo Berg');
  });

  it('AGI syns inte när den är inlämnad', () => {
    const items = buildTodoItems({
      ...base, verifications: established,
      payrollRuns: [{ id: 'r1', period: '2026-09', completedSteps: ['booked'] }],
      agiReports: [{ period: '2026-09', status: 'submitted' }],
    });
    expect(kinds(items)).not.toContain('agi_deadline');
  });

  it('förra året ej stängt, men inte när det är låst', () => {
    const verifications = [...established, { id: 'old', date: '2025-05-01', rows: [] }];
    expect(kinds(buildTodoItems({ ...base, verifications }))).toContain('year_end');
    const locked = { ...base.company, lockedFiscalYears: { 2025: { lockedAt: 'x' } } };
    expect(kinds(buildTodoItems({ ...base, company: locked, verifications }))).not.toContain('year_end');
  });

  it('gömda sidor ger inga rader', () => {
    const items = buildTodoItems({ ...base, verifications: established, hiddenNavIds: ['payroll'], employees: [{ id: 'e1', taxTable: {} }] });
    expect(kinds(items)).not.toContain('employees_tax');
  });

  it('dolda rader försvinner och försenat står först', () => {
    const args = { ...base, verifications: established, invoices: [{ id: 'f1', status: 'sent', dueDate: '2026-10-01', total: 100 }, { id: 'f2', status: 'draft' }] };
    const all = buildTodoItems(args);
    expect(all[0].kind).toBe('overdue_invoices');
    const hidden = buildTodoItems({ ...args, dismissedKeys: new Set([all[0].dismissKey]) });
    expect(kinds(hidden)).not.toContain('overdue_invoices');
  });

  it('nytt konto får Kom igång-rader', () => {
    const items = buildTodoItems({ t, today, company: {} });
    expect(kinds(items)).toEqual(['start_company', 'start_vat', 'start_receipt', 'start_invoice']);
  });
});
