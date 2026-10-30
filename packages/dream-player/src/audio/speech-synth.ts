/**
 * Speech Audio Synthesizer for live preview playback
 * Prefers the high-fidelity synthesized speech audio clip, falling back to Web Speech API
 */

export class DreamSpeechSynthesizer {
  public isSpeaking = false;
  public isMuted = false;
  private audioEl: HTMLAudioElement | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.audioEl = new Audio("/audio/speech_spike.wav");
      this.audioEl.preload = "auto";
    }
  }

  public speak(line: string, onStart?: () => void, onEnd?: () => void) {
    if (this.isMuted) return;

    if (this.audioEl) {
      this.audioEl.currentTime = 0;
      this.audioEl.volume = 0.95;
      this.audioEl
        .play()
        .then(() => {
          this.isSpeaking = true;
          if (onStart) onStart();
        })
        .catch(() => {
          this.fallbackSpeak(line, onStart, onEnd);
        });

      this.audioEl.onended = () => {
        this.isSpeaking = false;
        if (onEnd) onEnd();
      };
      return;
    }

    this.fallbackSpeak(line, onStart, onEnd);
  }

  private fallbackSpeak(line: string, onStart?: () => void, onEnd?: () => void) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(line);
    utterance.rate = 0.88;
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith("en") && !v.name.includes("Google"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stop() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
  }
}
