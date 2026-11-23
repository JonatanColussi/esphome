import {
  cycleProgressText,
  manualRelaysText,
  STAGE_COPY,
  startSubtitle,
  statusText,
  timesLabel,
  washTypeSubtitle,
} from '../src/copy';

describe('copy', () => {
  it('translates firmware stage codes to Portuguese', () => {
    expect(STAGE_COPY.Filling.title).toBe('Enchendo de água');
    expect(STAGE_COPY.Draining.short).toBe('Esvaziar');
  });

  it('describes the cycle progress', () => {
    expect(cycleProgressText({ current: 1, total: 2 })).toBe('Lavagem 1 de 2');
    expect(cycleProgressText(null)).toBe('');
  });

  it('lists relays left on in manual mode', () => {
    expect(manualRelaysText(['switch/Water Valve', 'switch/Auxiliary'])).toBe(
      'Ligado no modo manual: a água, o auxiliar.',
    );
  });

  it('labels counts, wash types, start button and status', () => {
    expect(timesLabel(1)).toBe('1 vez');
    expect(timesLabel(3)).toBe('3 vezes');
    expect(washTypeSubtitle('normal', 28 * 60)).toBe('com molho · 28 min');
    expect(washTypeSubtitle('quick', 15 * 60)).toBe('sem molho · 15 min');
    expect(startSubtitle('15:28')).toBe('termina às 15:28');
    expect(statusText(false, true)).toBe('Sem conexão');
    expect(statusText(true, true)).toBe('Lavando');
    expect(statusText(true, false)).toBe('Pronto');
  });
});
