import { DEFAULT_ACCOUNTS } from '../components/AccountsData';

// BAS gruppkonton (5400, 6000 …) samlar underkonton och ska inte bokföras på.
// De som Bokix själv använder (system, till exempel 4000) räknas inte hit.
const GROUP_CODES = new Set(DEFAULT_ACCOUNTS
  .filter(a => /\(gruppkonto\)/i.test(a.name) && !a.system)
  .map(a => a.code));

export const isGroupAccount = (code) => GROUP_CODES.has(String(code || ''));
