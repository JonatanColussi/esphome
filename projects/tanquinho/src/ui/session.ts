import type { WashOutcome } from '../domain/wash';
import { washOutcome } from '../domain/wash';

/**
 * What the screen remembers about the current wash between renders: whether the person
 * stopped it, how it ended, and the longest remaining time seen (the progress bar's 100 %).
 */
export class WashSession {
  private wasRunning: boolean | null = null;

  private stoppedByUser = false;

  private currentOutcome: WashOutcome | null = null;

  private roundTotal = 0;

  public get outcome(): WashOutcome | null {
    return this.currentOutcome;
  }

  public get roundTotalSeconds(): number {
    return this.roundTotal;
  }

  /** Call on every render; returns the outcome only on the render where the wash ended. */
  public observe(running: boolean | undefined, remainingSeconds: number): WashOutcome | null {
    let finished: WashOutcome | null = null;

    if (running !== undefined) {
      if (this.wasRunning !== null) {
        finished = washOutcome(this.wasRunning, running, this.stoppedByUser);
      }

      this.wasRunning = running;
    }

    if (finished) {
      this.currentOutcome = finished;
    }

    const isRunning = running === true;

    if (isRunning) {
      this.currentOutcome = null;
    }

    this.roundTotal = isRunning ? Math.max(this.roundTotal, remainingSeconds) : 0;

    return finished;
  }

  public markStarted(): void {
    this.stoppedByUser = false;
    this.currentOutcome = null;
  }

  public markStoppedByUser(): void {
    this.stoppedByUser = true;
  }

  public dismissOutcome(): void {
    this.currentOutcome = null;
  }
}
