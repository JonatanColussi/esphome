import { Entity, MINUTE_SETTINGS, WATER_LEVELS } from '../../src/domain/entities';

describe('MINUTE_SETTINGS', () => {
  it('lists fill and drain for every water level, then mix, soak and wash', () => {
    expect(MINUTE_SETTINGS).toEqual([
      ...WATER_LEVELS.map(level => Entity.fillMinutes[level]),
      ...WATER_LEVELS.map(level => Entity.drainMinutes[level]),
      Entity.mixMinutes,
      Entity.soakMinutes,
      Entity.washMinutes,
    ]);
  });
});
