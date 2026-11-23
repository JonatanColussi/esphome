import { WashSession } from '../../src/ui/session';

describe('WashSession', () => {
  it('reports nothing until the running flag has been seen once', () => {
    const session = new WashSession();

    expect(session.observe(undefined, 0)).toBeNull();
    expect(session.observe(false, 0)).toBeNull();
    expect(session.outcome).toBeNull();
  });

  it('reports a completed wash when it stops by itself', () => {
    const session = new WashSession();

    session.observe(true, 600);
    expect(session.observe(false, 0)).toBe('completed');
    expect(session.outcome).toBe('completed');
  });

  it('reports an interrupted wash after the person stops it', () => {
    const session = new WashSession();

    session.observe(true, 600);
    session.markStoppedByUser();
    expect(session.observe(false, 0)).toBe('interrupted');
  });

  it('clears the outcome when a new wash starts or the card is dismissed', () => {
    const session = new WashSession();

    session.observe(true, 600);
    session.observe(false, 0);
    session.dismissOutcome();
    expect(session.outcome).toBeNull();

    session.observe(true, 600);
    session.observe(false, 0);
    session.markStarted();
    expect(session.outcome).toBeNull();
  });

  it('keeps the largest remaining time of the running wash as the round total', () => {
    const session = new WashSession();

    session.observe(true, 600);
    session.observe(true, 500);
    expect(session.roundTotalSeconds).toBe(600);

    session.observe(false, 0);
    expect(session.roundTotalSeconds).toBe(0);
  });
});
