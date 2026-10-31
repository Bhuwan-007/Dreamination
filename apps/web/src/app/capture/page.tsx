"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Mic,
  MicOff,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Save,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Volume2,
  Moon,
  Leaf,
  Compass,
  Waves,
  Zap,
} from "lucide-react";
import { apiClient, FollowupQuestion } from "@/lib/api-client";
import { useToast } from "@/components/ui/toast";
import { TravelerLogo } from "@/components/ui/traveler-logo";
import { PrimaryButton } from "@/components/ui/primary-button";
import { SecondaryButton } from "@/components/ui/secondary-button";
import { ArchCard } from "@/components/ui/arch-card";

// Mood choices from Design.md
const WAKING_MOODS = [
  { id: "wonder", label: "Wonder", icon: <Moon className="w-4 h-4 text-accent" />, description: "Vast, luminous, floating" },
  { id: "serene", label: "Serene", icon: <Leaf className="w-4 h-4 text-leaf" />, description: "Quiet, peaceful, grounded" },
  { id: "curious", label: "Curious", icon: <Compass className="w-4 h-4 text-link" />, description: "Puzzled, intrigued, seeking" },
  { id: "melancholic", label: "Melancholic", icon: <Waves className="w-4 h-4 text-sage" />, description: "Heavy, submerged, gentle ache" },
  { id: "uneasy", label: "Uneasy", icon: <Zap className="w-4 h-4 text-dusk-rose" />, description: "Tense, hurried, lingering tremor" },
];

export default function DreamCapturePage() {
  const { toast, errorToast } = useToast();

  // Capture states
  const [rawText, setRawText] = useState("");
  const [moodOnWaking, setMoodOnWaking] = useState<string | null>(null);
  const [recentLifeContext, setRecentLifeContext] = useState("");
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [autoSaveNotification, setAutoSaveNotification] = useState(false);

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [audioStorageKey, setAudioStorageKey] = useState<string | null>(null);

  // Follow-up questions state
  const [capturedDreamId, setCapturedDreamId] = useState<string | null>(null);
  const [followupQuestions, setFollowupQuestions] = useState<FollowupQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [recordedAnswers, setRecordedAnswers] = useState<
    Array<{ question_id: string; question_text: string; answer: string }>
  >([]);
  const [isGatheringFollowups, setIsGatheringFollowups] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const preRecordingTextRef = useRef<string>("");

  // 1. Auto-save draft restoration (sessionStorage only, life context not stored)
  useEffect(() => {
    const saved = sessionStorage.getItem("dream_capture_draft");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rawText) setRawText(parsed.rawText);
        if (parsed.moodOnWaking) setMoodOnWaking(parsed.moodOnWaking);
      } catch (err) {
        console.error("Failed to restore draft:", err);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (rawText || moodOnWaking) {
        sessionStorage.setItem(
          "dream_capture_draft",
          JSON.stringify({ rawText, moodOnWaking })
        );
        setAutoSaveNotification(true);
        setTimeout(() => setAutoSaveNotification(false), 2000);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [rawText, moodOnWaking]);

  // 2. Audio recording controls
  const startRecording = async () => {
    try {
      preRecordingTextRef.current = rawText;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleAudioUpload(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      // Set up AudioContext for live waveform visualizer
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      mediaRecorder.start(250);
      setIsRecording(true);
      setRecordingDuration(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      visualizeAudio();
    } catch (err) {
      console.error("Microphone access error:", err);
      errorToast("Microphone permission was denied or is unavailable. You can also write your dream directly below.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const visualizeAudio = () => {
    if (!analyserRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyserRef.current!.getByteFrequencyData(dataArray);

      // Compute average level
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const avg = sum / bufferLength;
      setAudioLevel(avg);

      // Render waveform bars
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(226, 184, 102, ${Math.max(0.25, dataArray[i] / 255)})`;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();
  };

  const handleAudioUpload = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const res = await apiClient.uploadAudio(audioBlob);
      setTranscript(res.cleaned_transcript);
      setAudioStorageKey(res.storage_key);

      // If text pool was empty, populate with transcribed dream
      if (!rawText.trim()) {
        setRawText(res.cleaned_transcript);
      }
    } catch (err) {
      console.error("Transcription upload failed:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // 3. Dream submission & follow-up trigger
  const handleCaptureDream = async () => {
    if (!rawText.trim() && !transcript) {
      toast("What do you remember? Even a colour will do.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Create dream in database
      const dream = await apiClient.createDream({
        raw_text: rawText.trim(),
        transcript: transcript || undefined,
        mood_on_waking: moodOnWaking || undefined,
        recent_life_context: recentLifeContext.trim() || undefined,
        raw_audio_key: audioStorageKey || undefined,
      });

      setCapturedDreamId(dream.id);
      sessionStorage.removeItem("dream_capture_draft");

      // Fetch follow-up questions
      setIsGatheringFollowups(true);
      const followups = await apiClient.getFollowupQuestions(dream.id);
      setFollowupQuestions(followups.questions || []);
      setCurrentQuestionIndex(0);
    } catch (err) {
      console.error("Dream capture error:", err);
      errorToast("The tide took that one. Try again?");
    } finally {
      setIsSubmitting(false);
      setIsGatheringFollowups(false);
    }
  };

  // 4. Follow-up answers navigation
  const handleNextQuestion = async (skip = false) => {
    const currentQ = followupQuestions[currentQuestionIndex];
    const newAnswers = [...recordedAnswers];

    if (!skip && currentAnswer.trim() && currentQ) {
      newAnswers.push({
        question_id: currentQ.id,
        question_text: currentQ.text,
        answer: currentAnswer.trim(),
      });
      setRecordedAnswers(newAnswers);
    }

    setCurrentAnswer("");

    if (currentQuestionIndex + 1 < followupQuestions.length && !skip) {
      setCurrentQuestionIndex((prev) => prev + 1);
    } else {
      // Done or skipped to finish
      await finishFollowups(newAnswers);
    }
  };

  const finishFollowups = async (answersToSubmit = recordedAnswers) => {
    if (capturedDreamId && answersToSubmit.length > 0) {
      try {
        await apiClient.submitFollowupAnswers(capturedDreamId, answersToSubmit);
      } catch (err) {
        console.error("Failed to record answers:", err);
      }
    }
    setIsComplete(true);
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div data-theme="night" className="relative min-h-screen bg-bg text-text font-sans selection:bg-accent/30 selection:text-accent-soft pb-24">
      {/* Background artwork per Design.md A2 (Night void) with luminous atmospheric depth */}
      <div className="fixed inset-0 pointer-events-none opacity-55 z-0 transition-opacity duration-1000">
        <Image
          src="/art/night-void.webp"
          alt="Night Void Background"
          fill
          className="object-cover object-center"
          priority
        />
        {/* Soft edge darkening and cinematic vignette allowing the star ring and water to shine through */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/25 to-bg/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(9,13,17,0.75)_100%)]" />
      </div>

      {/* Top Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-hairline backdrop-blur-md bg-bg/40">
        <Link href="/" className="group flex items-center gap-3">
          <TravelerLogo size={28} />
          <span className="font-serif tracking-widest text-sm uppercase text-text-muted group-hover:text-accent transition-colors">
            The Dream Machine
          </span>
        </Link>

        <div className="flex items-center gap-4 text-xs text-text-subtle">
          {autoSaveNotification && (
            <span className="flex items-center gap-1.5 text-accent animate-pulse motion-reduce:animate-none">
              <Save className="w-3.5 h-3.5" /> Draft saved
            </span>
          )}
          <span className="px-2.5 py-1 rounded-full border border-hairline bg-surface/80 text-text-muted">
            Capture · Step 1
          </span>
        </div>
      </header>

      {/* Main Capture Container */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-12">
        {!capturedDreamId ? (
          <div className="space-y-10 animate-fade-in">
            {/* Headline with soft scrim */}
            <div className="text-center space-y-2">
              <h1 className="font-serif text-3xl md:text-4xl text-text tracking-tight font-light">
                What do you remember?
              </h1>
              <div>
                <p className="text-text-subtle text-xs sm:text-sm italic font-serif px-3 py-1 rounded-full bg-bg/60 border border-hairline/40 backdrop-blur-sm inline-block">
                  Even a colour, a phrase, or a feeling will do.
                </p>
              </div>
            </div>

            {/* The Halo Microphone Recorder */}
            <div className="flex flex-col items-center justify-center pt-2 pb-4">
              <div className="relative flex items-center justify-center">
                {/* Pulsing halo ring proportional to audio level */}
                <div
                  className={`absolute rounded-full border border-lantern transition-all duration-150 ${
                    isRecording ? "scale-125 opacity-100" : "scale-100 opacity-20"
                  }`}
                  style={{
                    width: `${120 + (isRecording ? audioLevel * 0.8 : 0)}px`,
                    height: `${120 + (isRecording ? audioLevel * 0.8 : 0)}px`,
                    boxShadow: isRecording
                      ? `0 0 35px rgba(226, 184, 102, ${Math.min(0.6, audioLevel / 80)})`
                      : "none",
                  }}
                />

                {/* Primary Mic Button */}
                <button
                  onClick={toggleRecording}
                  disabled={isTranscribing}
                  className={`relative z-10 flex items-center justify-center w-24 h-24 rounded-full transition-all duration-300 ${
                    isRecording
                      ? "bg-dusk-rose text-void shadow-lg scale-95"
                      : "bg-forest-night border-2 border-lantern/70 text-lantern hover:border-lantern hover:scale-105 shadow-lantern"
                  }`}
                  title={isRecording ? "Tap to stop recording" : "Tap to speak your dream"}
                >
                  {isRecording ? (
                    <MicOff className="w-9 h-9 animate-pulse" />
                  ) : (
                    <Mic className="w-9 h-9" />
                  )}
                </button>
              </div>

              {/* Status and timer with scrim */}
              <div className="mt-4 text-center">
                {isRecording ? (
                  <div className="space-y-1">
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-dusk-rose/20 text-dusk-rose border border-dusk-rose/40">
                      Recording {formatSeconds(recordingDuration)}
                    </span>
                    <div>
                      <p className="text-xs text-text-subtle px-3 py-1 rounded-full bg-bg/70 border border-hairline/40 backdrop-blur-sm inline-block">
                        Speak freely. Pauses and fragments are welcomed.
                      </p>
                    </div>
                  </div>
                ) : isTranscribing ? (
                  <p className="text-xs text-accent animate-pulse motion-reduce:animate-none flex items-center gap-1.5 justify-center px-3 py-1 rounded-full bg-bg/70 border border-hairline/40 backdrop-blur-sm inline-flex">
                    <Sparkles className="w-3.5 h-3.5" /> Gathering your words into text...
                  </p>
                ) : (
                  <p className="text-xs text-text-subtle px-3 py-1 rounded-full bg-bg/70 border border-hairline/40 backdrop-blur-sm inline-block">
                    Tap the halo to speak, or write below
                  </p>
                )}
              </div>

              {/* Live Waveform Canvas */}
              <canvas
                ref={canvasRef}
                width={360}
                height={40}
                className={`mt-3 rounded border border-hairline/40 transition-opacity ${
                  isRecording ? "opacity-100" : "opacity-0 h-0"
                }`}
              />
            </div>

            {/* The Dream Pool: Dark Water Text Area */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs uppercase tracking-widest text-text-muted font-medium">
                  The Dream Pool (Notes & Fragments)
                </label>
                {isRecording && (
                  <span className="flex items-center gap-1.5 text-xs text-accent animate-pulse motion-reduce:animate-none">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    <span>Listening & streaming words live...</span>
                  </span>
                )}
              </div>
              <div className="relative group">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="I was walking along a coast where the sea was completely violet-dark, and someone handed me an iron key..."
                  rows={6}
                  className="w-full px-5 py-4 text-base md:text-lg font-serif bg-surface/85 backdrop-blur-md border border-hairline rounded-2xl text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-focus transition-all resize-y shadow-inner"
                />
                <div className="absolute bottom-3 right-4 text-xs text-text-subtle font-mono">
                  {rawText.length > 0 ? `${rawText.split(/\s+/).filter(Boolean).length} words` : "Empty"}
                </div>
              </div>
            </div>

            {/* Waking Mood Selector */}
            <div className="space-y-3">
              <label className="block text-xs uppercase tracking-widest text-mist font-medium">
                How did you feel on waking?
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {WAKING_MOODS.map((m) => {
                  const isSelected = moodOnWaking === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMoodOnWaking(isSelected ? null : m.id)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                        isSelected
                          ? "bg-surface-raised border-accent text-accent shadow-lantern"
                          : "bg-surface/50 border-hairline/60 text-text-muted hover:border-accent/40 hover:bg-surface"
                      }`}
                    >
                      <span className="mb-1.5 flex items-center justify-center">{m.icon}</span>
                      <span className="text-xs font-medium">{m.label}</span>
                      <span className="text-[10px] text-text-subtle hidden sm:block mt-0.5 line-clamp-1">
                        {m.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collapsible Recent Life Context Field */}
            <div className="border border-hairline/50 rounded-xl overflow-hidden bg-forest-night/30">
              <button
                type="button"
                onClick={() => setShowContextDrawer(!showContextDrawer)}
                className="w-full flex items-center justify-between px-4 py-3 text-xs text-mist hover:text-cloud transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span>Optional: Recent waking life context (stress, recent events)</span>
                </span>
                {showContextDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showContextDrawer && (
                <div className="p-4 pt-0 border-t border-hairline/30 space-y-2">
                  <p className="text-xs text-sage">
                    Helps ground archetypes and daytime residue without flattening the dream. Encrypted securely.
                  </p>
                  <textarea
                    value={recentLifeContext}
                    onChange={(e) => setRecentLifeContext(e.target.value)}
                    placeholder="e.g. Started a new job, had an argument with a friend yesterday, feeling restless..."
                    rows={3}
                    className="w-full px-3 py-2 text-sm bg-surface-raised border border-hairline rounded-lg text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-focus"
                  />
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                onClick={handleCaptureDream}
                disabled={isSubmitting || (!rawText.trim() && !transcript)}
                className="w-full py-4 rounded-xl bg-lantern text-void font-medium text-base hover:bg-lantern-soft active:bg-lantern-deep transition-all shadow-lantern flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-void" />
                    <span>Encrypting & Storing Dream...</span>
                  </>
                ) : (
                  <>
                    <span>Capture Dream</span>
                    <ArrowRight className="w-4 h-4 text-void" />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : !isComplete ? (
          /* Step 2: Follow-Up Questions Flow */
          <div className="space-y-8 animate-fade-in">
            <div className="text-center space-y-2">
              <span className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-lantern/10 text-lantern border border-lantern/30">
                Question {currentQuestionIndex + 1} of {Math.max(1, followupQuestions.length)}
              </span>
              <h2 className="font-serif text-2xl md:text-3xl text-cloud font-light">
                Just a few small questions.
              </h2>
              <p className="text-xs text-sage italic">
                Only to bring the senses and atmosphere into clearer focus. Skip any.
              </p>
            </div>

            {followupQuestions.length > 0 && followupQuestions[currentQuestionIndex] ? (
              <div className="p-8 rounded-2xl border border-hairline bg-slate/80 backdrop-blur-md shadow-lantern space-y-6">
                <div className="space-y-2">
                  <span className="text-[11px] uppercase tracking-wider text-lantern font-mono">
                    Focus: {followupQuestions[currentQuestionIndex].targets}
                  </span>
                  <p className="font-serif text-xl md:text-2xl text-cloud leading-relaxed">
                    &ldquo;{followupQuestions[currentQuestionIndex].text}&rdquo;
                  </p>
                </div>

                <textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="A few words or sensations..."
                  rows={3}
                  autoFocus
                  className="w-full px-4 py-3 bg-surface border border-hairline rounded-xl text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-focus text-base font-serif"
                />

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => handleNextQuestion(true)}
                    className="text-xs text-sage hover:text-mist underline underline-offset-4"
                  >
                    Skip this question
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => finishFollowups()}
                      className="px-4 py-2.5 rounded-lg border border-hairline text-xs text-mist hover:text-cloud hover:border-lantern/40 transition-all"
                    >
                      That&apos;s enough, weave it
                    </button>
                    <button
                      type="button"
                      onClick={() => handleNextQuestion(false)}
                      className="px-5 py-2.5 rounded-lg bg-lantern text-void font-medium text-xs hover:bg-lantern-soft transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center space-y-4 rounded-2xl border border-hairline bg-forest-night/60">
                <Sparkles className="w-8 h-8 text-lantern mx-auto animate-pulse" />
                <p className="font-serif text-lg text-cloud">
                  Your notes are already rich with detail.
                </p>
                <button
                  onClick={() => setIsComplete(true)}
                  className="px-6 py-3 rounded-xl bg-lantern text-void font-medium text-sm hover:bg-lantern-soft"
                >
                  Proceed to Weave
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Step 3: Complete / Success state */
          <div className="p-10 text-center space-y-6 rounded-2xl border border-hairline bg-slate/90 shadow-lantern animate-fade-in">
            <div className="w-16 h-16 rounded-full bg-leaf/20 border border-leaf/40 text-leaf flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif text-2xl md:text-3xl text-cloud">
                Fragments gathered into the vault.
              </h2>
              <p className="text-sm text-mist font-serif max-w-md mx-auto">
                Your dream has been safely encrypted with AES-256-GCM. In the next stage, the Dream Weaver will extract characters, locations, and the surreal arc.
              </p>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => {
                  setCapturedDreamId(null);
                  setRawText("");
                  setTranscript(null);
                  setRecordedAnswers([]);
                  setIsComplete(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-hairline text-xs text-text-muted hover:text-text flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Capture Another</span>
              </button>

              {capturedDreamId && (
                <>
                  <Link
                    href={`/dreams/${capturedDreamId}/review`}
                    className="px-6 py-2.5 rounded-xl bg-accent text-bg font-semibold text-xs hover:bg-accent-soft flex items-center gap-2 shadow-lantern"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Weave & Review Story</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>

                  <Link
                    href={`/dreams/${capturedDreamId}/review?express=true`}
                    className="px-4 py-2.5 rounded-xl border border-hairline bg-surface-raised text-xs text-text-muted hover:text-text flex items-center gap-2"
                  >
                    <span>Watch in 3D (Express)</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
