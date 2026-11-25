import { describe, it, expect } from 'vitest';
import { suggestHelpArticles } from './articles';

describe('förslag i supportrutan', () => {
  it('hittar rätt guide för vanliga frågor', () => {
    const ids = (q) => suggestHelpArticles(q).map(a => a.id);
    console.log(ids('Hur lägger jag till min logga på fakturan?'), ids('Kvittot läses inte av när jag laddar upp bilden'), ids('hur gör jag momsdeklarationen'), ids('jag vill bjuda in min redovisningskonsult'));
    expect(ids('Hur lägger jag till min logga på fakturan?')).toContain('logotyp');
    expect(ids('hur gör jag momsdeklarationen')).toContain('moms');
    expect(suggestHelpArticles('hej hej')).toEqual([]);
  });
});
