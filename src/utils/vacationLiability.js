import { ledgerBalanceAt } from './inventory';
import { round2 } from './fixedAssets';

/**
 * Bokslutsjustering av semesterlöneskulden.
 *
 * Semesterlön som är intjänad men inte uttagen är en skuld vid bokslutet:
 *
 *   2920 Upplupna semesterlöner            (skulden)          motpost 7090
 *   2940 Upplupna lagstadgade sociala avg. (avgifter på den)  motpost 7519
 *
 * Vacation.js räknar ut skulden per anställd; här jämförs den med vad som
 * redan står på 2920/2940 och mellanskillnaden bokförs, så kontona alltid
 * visar årets skuld — och bara förändringen belastar årets resultat.
 */

const credit = (verifications, account, date) => round2(-ledgerBalanceAt(verifications, account, date));

function pair(balanceAccount, costAccount, diff) {
  if (diff === 0) return [];
  const abs = Math.abs(diff);
  return diff > 0
    ? [{ account: costAccount, debet: abs, kredit: 0 }, { account: balanceAccount, debet: 0, kredit: abs }]
    : [{ account: balanceAccount, debet: abs, kredit: 0 }, { account: costAccount, debet: 0, kredit: abs }];
}

export function computeVacationAdjustment({ verifications, date, liability, liabilityFee }) {
  const balance2920 = credit(verifications, '2920', date);
  const balance2940 = credit(verifications, '2940', date);
  return {
    liability: round2(liability),
    liabilityFee: round2(liabilityFee),
    balance2920,
    balance2940,
    diffLiability: round2(round2(liability) - balance2920),
    diffFee: round2(round2(liabilityFee) - balance2940),
  };
}

/** Verifikationen för justeringen, eller null om kontona redan stämmer. */
export function buildVacationLiabilityVerification({ date, diffLiability, diffFee }) {
  const rows = [...pair('2920', '7090', round2(diffLiability)), ...pair('2940', '7519', round2(diffFee))];
  if (rows.length === 0) return null;
  return {
    date,
    description: `Justering semesterlöneskuld per ${date}`,
    source: 'accrual',
    sourceId: `vacation_liability_${date}`,
    rows,
  };
}

export function isVacationAdjustmentBooked(verifications, date) {
  return (verifications || []).some(v => v.sourceId === `vacation_liability_${date}` && (v.status || 'booked') !== 'draft');
}
