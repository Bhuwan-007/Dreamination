/**
 * Lip-sync viseme driver for speaking characters.
 * Maps phoneme/word timings to blendshape weights (aa, E, I, O, U, neutral).
 */

export interface WordTiming {
  word: string;
  start: number;
  end: number;
  viseme?: "aa" | "E" | "I" | "O" | "U" | "neutral";
}

export class LipSyncDriver {
  private words: WordTiming[] = [];
  public currentMouthOpen = 0.0;
  public currentViseme: "aa" | "E" | "I" | "O" | "U" | "neutral" = "neutral";

  public setScript(line: string, startTime: number, duration: number, customTimings?: WordTiming[]) {
    if (customTimings && customTimings.length > 0) {
      this.words = customTimings.map((w) => ({
        ...w,
        start: startTime + w.start,
        end: startTime + w.end,
      }));
      return;
    }

    const rawWords = line.split(/\s+/).filter(Boolean);
    const wordDuration = duration / Math.max(1, rawWords.length);

    this.words = rawWords.map((word, i) => {
      const start = startTime + i * wordDuration;
      const end = start + wordDuration * 0.85; // slight natural pause between words
      return { word, start, end };
    });
  }

  public update(currentTimeSeconds: number): { mouthOpen: number; shape: string } {
    let activeWord: WordTiming | null = null;
    for (const w of this.words) {
      if (currentTimeSeconds >= w.start && currentTimeSeconds <= w.end) {
        activeWord = w;
        break;
      }
    }

    if (!activeWord) {
      // Natural mouth closure
      this.currentMouthOpen = THREE_lerp(this.currentMouthOpen, 0.0, 0.25);
      this.currentViseme = "neutral";
      return { mouthOpen: this.currentMouthOpen, shape: "neutral" };
    }

    if (activeWord.viseme) {
      this.currentViseme = activeWord.viseme;
      this.currentMouthOpen = 0.8;
      return { mouthOpen: this.currentMouthOpen, shape: this.currentViseme };
    }

    // Oscillate mouth flap rhythmically during active word
    const progress = (currentTimeSeconds - activeWord.start) / Math.max(0.01, activeWord.end - activeWord.start);
    const flap = Math.sin(progress * Math.PI * 3.5) * 0.5 + 0.5;
    this.currentMouthOpen = THREE_lerp(this.currentMouthOpen, Math.max(0.15, flap * 0.85), 0.35);

    // Alternate viseme vowels based on word characters
    const firstChar = activeWord.word[0]?.toLowerCase() || "a";
    if (["o", "u", "w"].includes(firstChar)) {
      this.currentViseme = "O";
    } else if (["e", "i", "y"].includes(firstChar)) {
      this.currentViseme = "E";
    } else {
      this.currentViseme = "aa";
    }

    return { mouthOpen: this.currentMouthOpen, shape: this.currentViseme };
  }
}

function THREE_lerp(start: number, end: number, t: number): number {
  return start + (end - start) * Math.min(1.0, Math.max(0.0, t));
}
