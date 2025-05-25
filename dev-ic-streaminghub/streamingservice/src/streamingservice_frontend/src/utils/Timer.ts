export class Timer {
  private startTime: number;
  private splits: Map<string, number>;
  private running: boolean;

  constructor() {
    this.startTime = 0;
    this.splits = new Map();
    this.running = false;
  }

  start(): void {
    this.startTime = performance.now();
    this.splits.clear();
    this.running = true;
  }

  split(label: string): void {
    if (!this.running) {
      throw new Error('Timer is not running');
    }
    this.splits.set(label, performance.now() - this.startTime);
  }

  stop(): Record<string, number> {
    if (!this.running) {
      throw new Error('Timer is not running');
    }
    this.running = false;
    const totalTime = performance.now() - this.startTime;
    
    // Convert splits to a regular object
    const result: Record<string, number> = {
      total: totalTime
    };
    
    this.splits.forEach((time, label) => {
      result[label] = time;
    });

    return result;
  }

  formatTime(ms: number): string {
    if (ms < 1000) {
      return `${ms.toFixed(2)}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = ((ms % 60000) / 1000).toFixed(2);
      return `${minutes}m ${seconds}s`;
    }
  }

  formatResults(results: Record<string, number>): Record<string, string> {
    const formatted: Record<string, string> = {};
    Object.entries(results).forEach(([label, time]) => {
      formatted[label] = this.formatTime(time);
    });
    return formatted;
  }
}