"use client";
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  PaintEngine,
  PALETTE_PIGMENTS,
  PigmentMode,
  CHAPTER_CONFIGS,
  FlyingBalloon,
  WetSplash,
  RippleRing,
  DropletParticle,
} from "./paint-engine";
import { useSoundContext } from "./sound-provider";
import {
  Volume2,
  VolumeX,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { PrimaryButton } from "@/components/ui/primary-button";
interface PaintTheatreProps {
  primaryTargetHref?: string;
}
export function PaintTheatre({ primaryTargetHref = "/capture" }: PaintTheatreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sound = useSoundContext();
  const engine = useMemo(() => new PaintEngine(), []);
  // UI & Scroll states
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(0);
  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [isMidTransition, setIsMidTransition] = useState<boolean>(false);
  const [selectedPigment, setSelectedPigment] = useState<PigmentMode>("true");
  const [kintsugiFactor, setKintsugiFactor] = useState<number>(0.5);
  const [chapterCoverages, setChapterCoverages] = useState<number[]>([0, 0, 0, 0, 0]);
  const [hasThrownFirstBalloon, setHasThrownFirstBalloon] = useState<boolean>(false);
  const [isCalmOrReduced, setIsCalmOrReduced] = useState<boolean>(false);
  const [ariaAnnouncement, setAriaAnnouncement] = useState<string>("");
  const [allChaptersComplete, setAllChaptersComplete] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  // Performance telemetry
  const fpsRef = useRef<{ frames: number; lastTime: number; currentFps: number }>({
    frames: 0,
    lastTime: performance.now(),
    currentFps: 60,
  });
  // Persistent image-space canvas buffers (1 per chapter)
  const imageBuffersRef = useRef<{
    masks: HTMLCanvasElement[];
    glazes: HTMLCanvasElement[];
    loadedInkImages: (HTMLImageElement | null)[];
    loadedColorImages: (HTMLImageElement | null)[];
    loadedInkImagesTall: (HTMLImageElement | null)[];
    loadedColorImagesTall: (HTMLImageElement | null)[];
  }>({
    masks: [],
    glazes: [],
    loadedInkImages: [null, null, null, null, null],
    loadedColorImages: [null, null, null, null, null],
    loadedInkImagesTall: [null, null, null, null, null],
    loadedColorImagesTall: [null, null, null, null, null],
  });
  const balloonsRef = useRef<FlyingBalloon[]>([]);
  const wetSplashesRef = useRef<WetSplash[]>([]);
  const ripplesRef = useRef<RippleRing[]>([]);
  const dropletsRef = useRef<DropletParticle[]>([]);
  const ambientParticlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[]
  >([]);
  const mousePosRef = useRef<{ x: number; y: number; rawX: number; rawY: number }>({
    x: 0,
    y: 0,
    rawX: 0,
    rawY: 0,
  });
  const chimePlayedRef = useRef<boolean[]>([false, false, false, false, false]);
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCalm =
      typeof window !== "undefined" &&
      (localStorage.getItem("calm_mode") === "true" ||
        document.body.classList.contains("calm-mode"));
    if (prefersReducedMotion || isCalm) {
      setIsCalmOrReduced(true);
    }
  }, []);
  // Pre-initialize image-space persistent mask & glaze canvases
  useEffect(() => {
    const masks: HTMLCanvasElement[] = [];
    const glazes: HTMLCanvasElement[] = [];
    CHAPTER_CONFIGS.forEach((cfg) => {
      const mc = document.createElement("canvas");
      mc.width = cfg.maskWidth;
      mc.height = cfg.maskHeight;
      const mctx = mc.getContext("2d");
      if (mctx) mctx.clearRect(0, 0, cfg.maskWidth, cfg.maskHeight);
      masks.push(mc);
      const gc = document.createElement("canvas");
      gc.width = cfg.maskWidth;
      gc.height = cfg.maskHeight;
      const gctx = gc.getContext("2d");
      if (gctx) gctx.clearRect(0, 0, cfg.maskWidth, cfg.maskHeight);
      glazes.push(gc);
    });
    imageBuffersRef.current.masks = masks;
    imageBuffersRef.current.glazes = glazes;
    CHAPTER_CONFIGS.forEach((cfg, idx) => {
      const ink = new Image();
      ink.src = cfg.inkSrc;
      ink.onload = () => {
        imageBuffersRef.current.loadedInkImages[idx] = ink;
      };
      const color = new Image();
      color.src = cfg.artSrc;
      color.onload = () => {
        imageBuffersRef.current.loadedColorImages[idx] = color;
      };
      if (cfg.artSrcTall && cfg.inkSrcTall) {
        const inkTall = new Image();
        inkTall.src = cfg.inkSrcTall;
        inkTall.onload = () => {
          imageBuffersRef.current.loadedInkImagesTall[idx] = inkTall;
        };
        const colorTall = new Image();
        colorTall.src = cfg.artSrcTall;
        colorTall.onload = () => {
          imageBuffersRef.current.loadedColorImagesTall[idx] = colorTall;
        };
      }
    });
    const ambient: { x: number; y: number; vx: number; vy: number; r: number; alpha: number }[] =
      [];
    for (let i = 0; i < 48; i++) {
      ambient.push({
        x: Math.random() * 1920,
        y: Math.random() * 1080,
        vx: (Math.random() - 0.5) * 0.45,
        vy: -0.15 - Math.random() * 0.35,
        r: 1.0 + Math.random() * 2.2,
        alpha: 0.15 + Math.random() * 0.45,
      });
    }
    ambientParticlesRef.current = ambient;
  }, []);
  // Continuous Progress t = scrollProgress * 4 (~150vh per chapter)
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalDist = rect.height - window.innerHeight;
      if (totalDist <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / totalDist));
      const t = progress * 4;
      const baseChapter = Math.min(3, Math.floor(t));
      const localTau = t - baseChapter;
      if (t >= 3.98) {
        setActiveChapterIndex(4);
        setIsMidTransition(false);
        setTransitionProgress(0);
        return;
      }
      if (localTau <= 0.70) {
        setActiveChapterIndex((prev) => {
          if (prev !== baseChapter) {
            setAriaAnnouncement(
              `Entered ${CHAPTER_CONFIGS[baseChapter].name}: ${CHAPTER_CONFIGS[baseChapter].headline}`
            );
          }
          return baseChapter;
        });
        setIsMidTransition(false);
        setTransitionProgress(0);
      } else {
        const trans = (localTau - 0.70) / 0.30;
        setActiveChapterIndex(baseChapter);
        setIsMidTransition(true);
        setTransitionProgress(trans);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const stampSplashInImageSpace = useCallback(
    (
      chapterIdx: number,
      imgX: number,
      imgY: number,
      imgRadius: number,
      pigment: PigmentMode,
      pigmentHex: string
    ) => {
      const masks = imageBuffersRef.current.masks;
      const glazes = imageBuffersRef.current.glazes;
      const maskCanvas = masks[chapterIdx];
      const glazeCanvas = glazes[chapterIdx];
      if (!maskCanvas || !glazeCanvas) return;
      const maskCtx = maskCanvas.getContext("2d");
      const glazeCtx = glazeCanvas.getContext("2d");
      if (!maskCtx || !glazeCtx) return;
      const contour = PaintEngine.generateLobedContour(imgRadius, imgX, imgY, 18);
      maskCtx.save();
      maskCtx.fillStyle = "rgba(255, 255, 255, 1.0)";
      maskCtx.beginPath();
      maskCtx.moveTo(imgX + contour[0][0], imgY + contour[0][1]);
      for (let i = 1; i < contour.length; i++) {
        maskCtx.lineTo(imgX + contour[i][0], imgY + contour[i][1]);
      }
      maskCtx.closePath();
      maskCtx.fill();
      const satellites = PaintEngine.generateSatelliteDroplets(imgRadius, 14);
      for (const drop of satellites) {
        maskCtx.beginPath();
        maskCtx.arc(imgX + drop.x, imgY + drop.y, drop.radius, 0, Math.PI * 2);
        maskCtx.fill();
      }
      maskCtx.restore();
      if (pigment !== "true") {
        glazeCtx.save();
        glazeCtx.fillStyle = pigmentHex;
        glazeCtx.globalAlpha = 0.55;
        glazeCtx.beginPath();
        glazeCtx.moveTo(imgX + contour[0][0], imgY + contour[0][1]);
        for (let i = 1; i < contour.length; i++) {
          glazeCtx.lineTo(imgX + contour[i][0], imgY + contour[i][1]);
        }
        glazeCtx.closePath();
        glazeCtx.fill();
        glazeCtx.restore();
      }
      engine.markDirty(chapterIdx);
      if (chapterIdx === 3) {
        setKintsugiFactor((prev) => PaintEngine.healWeave(prev, 0.08));
      }
    },
    [engine]
  );
  const onSplashImpact = useCallback(
    (
      chapterIdx: number,
      stageX: number,
      stageY: number,
      stageRadius: number,
      pigment: PigmentMode,
      pigmentHex: string
    ) => {
      sound.playWaterDrop();
      sound.playSplashBrushWash();
      const cfg = CHAPTER_CONFIGS[chapterIdx];
      const isPortrait =
        typeof window !== "undefined" && window.innerWidth < 768 && cfg.artSrcTall;
      const maskW = isPortrait ? 540 : cfg.maskWidth;
      const maskH = isPortrait ? 960 : cfg.maskHeight;
      const stageW = canvasRef.current?.width || window.innerWidth;
      const stageH = canvasRef.current?.height || window.innerHeight;
      const transform = PaintEngine.computeCoverTransform(stageW, stageH, maskW, maskH);
      const imgPoint = PaintEngine.mapStageToImage(stageX, stageY, transform);
      const imgRadius = PaintEngine.mapStageRadiusToImage(stageRadius, transform);
      stampSplashInImageSpace(chapterIdx, imgPoint.x, imgPoint.y, imgRadius, pigment, pigmentHex);
      wetSplashesRef.current.push({
        id: `wet-${Date.now()}-${Math.random()}`,
        chapterIndex: chapterIdx,
        x: stageX,
        y: stageY,
        radius: stageRadius,
        color: pigmentHex,
        pigment,
        elapsed: 0,
        duration: 0.9,
        isDry: false,
      });
      for (let i = 0; i < 12; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.8 + Math.random() * 4.5;
        dropletsRef.current.push({
          x: stageX,
          y: stageY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          radius: 1.8 + Math.random() * 2.8,
          alpha: 0.85,
          color: pigmentHex,
        });
      }
      ripplesRef.current.push({
        x: stageX,
        y: stageY,
        radius: 6,
        maxRadius: stageRadius * 1.6,
        alpha: 0.75,
        color: pigmentHex,
      });
    },
    [sound, stampSplashInImageSpace]
  );
  const throwBalloon = useCallback(
    (targetStageX: number, targetStageY: number, customPigment?: PigmentMode) => {
      if (isMidTransition) return;
      const now = performance.now();
      if (!engine.canThrow(now)) return;
      const pigmentKey = customPigment || selectedPigment;
      const pigmentDef =
        PALETTE_PIGMENTS.find((p) => p.key === pigmentKey) || PALETTE_PIGMENTS[0];
      const pigmentHex = pigmentDef.hex;
      setHasThrownFirstBalloon(true);
      const stageW = canvasRef.current?.width || window.innerWidth;
      const stageH = canvasRef.current?.height || window.innerHeight;
      if (isCalmOrReduced) {
        onSplashImpact(activeChapterIndex, targetStageX, targetStageY, 68, pigmentKey, pigmentHex);
        return;
      }
      sound.playBalloonWhoosh();
      const startX = stageW * 0.5 + (Math.random() - 0.5) * 80;
      const startY = stageH + 30;
      const duration = PaintEngine.calculateFlightDuration(
        startX,
        startY,
        targetStageX,
        targetStageY
      );
      const arcHeight = PaintEngine.calculateArcHeight(
        startX,
        startY,
        targetStageX,
        targetStageY
      );
      balloonsRef.current.push({
        id: `b-${now}-${Math.random()}`,
        startX,
        startY,
        targetX: targetStageX,
        targetY: targetStageY,
        arcHeight,
        duration,
        pigment: pigmentKey,
        color: pigmentHex,
        wobblePhase: Math.random() * Math.PI * 2,
        elapsed: 0,
        chapterIndex: activeChapterIndex,
        splashRadius: 65 + Math.random() * 15,
      });
    },
    [
      isMidTransition,
      engine,
      selectedPigment,
      isCalmOrReduced,
      activeChapterIndex,
      sound,
      onSplashImpact,
    ]
  );
  useEffect(() => {
    if (isCalmOrReduced) return;
    const timer = setTimeout(() => {
      const stageW = canvasRef.current?.width || window.innerWidth;
      const stageH = canvasRef.current?.height || window.innerHeight;
      throwBalloon(stageW * 0.52, stageH * 0.56, "true");
    }, 1200);
    return () => clearTimeout(timer);
  }, [isCalmOrReduced, throwBalloon]);
  useEffect(() => {
    const interval = setInterval(() => {
      const masks = imageBuffersRef.current.masks;
      const updatedCoverages: number[] = [];
      masks.forEach((maskCanvas, idx) => {
        const mctx = maskCanvas.getContext("2d");
        if (!mctx) {
          updatedCoverages.push(0);
          return;
        }
        const imgData = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        const coverage = PaintEngine.sampleCoverage(
          imgData.data,
          maskCanvas.width,
          maskCanvas.height,
          PaintEngine.GRID_COLS,
          PaintEngine.GRID_ROWS,
          30,
          4
        );
        engine.setCoverage(idx, coverage);
        updatedCoverages.push(coverage);
        if (coverage >= 0.7 && !chimePlayedRef.current[idx]) {
          chimePlayedRef.current[idx] = true;
          sound.playMilestoneChime();
          setAriaAnnouncement(
            `${CHAPTER_CONFIGS[idx].name} has reached seventy percent reveal.`
          );
        }
      });
      setChapterCoverages(updatedCoverages);
      if (engine.areAllChaptersComplete()) {
        setAllChaptersComplete(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [engine, sound]);
  const handlePaintTheRest = useCallback(() => {
    const maskCanvas = imageBuffersRef.current.masks[activeChapterIndex];
    if (!maskCanvas) return;
    const mctx = maskCanvas.getContext("2d");
    if (!mctx) return;
    mctx.fillStyle = "rgba(255, 255, 255, 1.0)";
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    engine.markDirty(activeChapterIndex);
    engine.setCoverage(activeChapterIndex, 1.0);
    sound.playMilestoneChime();
    setAriaAnnouncement(`${CHAPTER_CONFIGS[activeChapterIndex].name} fully revealed.`);
  }, [activeChapterIndex, engine, sound]);
  const drawSceneOntoContext = useCallback(
    (
      targetCtx: CanvasRenderingContext2D,
      chIdx: number,
      width: number,
      height: number,
      scaleFactor = 1.0,
      kenBurnsX = 0,
      kenBurnsY = 0
    ) => {
      const cfg = CHAPTER_CONFIGS[chIdx];
      const isPortrait = width < 768 && cfg.artSrcTall;
      const maskW = isPortrait ? 540 : cfg.maskWidth;
      const maskH = isPortrait ? 960 : cfg.maskHeight;
      const inkImg = isPortrait
        ? imageBuffersRef.current.loadedInkImagesTall[chIdx] ||
          imageBuffersRef.current.loadedInkImages[chIdx]
        : imageBuffersRef.current.loadedInkImages[chIdx];
      const colorImg = isPortrait
        ? imageBuffersRef.current.loadedColorImagesTall[chIdx] ||
          imageBuffersRef.current.loadedColorImages[chIdx]
        : imageBuffersRef.current.loadedColorImages[chIdx];
      const maskCanvas = imageBuffersRef.current.masks[chIdx];
      const glazeCanvas = imageBuffersRef.current.glazes[chIdx];
      const transform = PaintEngine.computeCoverTransform(width, height, maskW, maskH);
      targetCtx.save();
      targetCtx.translate(width / 2 + kenBurnsX, height / 2 + kenBurnsY);
      targetCtx.scale(scaleFactor, scaleFactor);
      targetCtx.translate(-width / 2, -height / 2);
      if (inkImg && inkImg.complete) {
        if (chIdx === 3) {
          PaintEngine.KINTSUGI_SHARDS.forEach((shard) => {
            const shardCenter = PaintEngine.computeShardOffset(
              shard,
              kintsugiFactor,
              width,
              height
            );
            targetCtx.save();
            targetCtx.beginPath();
            targetCtx.moveTo(
              shardCenter.x + shard.points[0][0],
              shardCenter.y + shard.points[0][1]
            );
            for (let p = 1; p < shard.points.length; p++) {
              targetCtx.lineTo(
                shardCenter.x + shard.points[p][0],
                shardCenter.y + shard.points[p][1]
              );
            }
            targetCtx.closePath();
            targetCtx.clip();
            targetCtx.drawImage(
              inkImg,
              transform.offsetX,
              transform.offsetY,
              transform.renderedWidth,
              transform.renderedHeight
            );
            targetCtx.strokeStyle = "rgba(226, 184, 102, 0.45)";
            targetCtx.lineWidth = 1.5;
            targetCtx.stroke();
            targetCtx.restore();
          });
        } else {
          targetCtx.drawImage(
            inkImg,
            transform.offsetX,
            transform.offsetY,
            transform.renderedWidth,
            transform.renderedHeight
          );
        }
      } else {
        targetCtx.fillStyle = "#0C1C17";
        targetCtx.fillRect(0, 0, width, height);
      }
      if (colorImg && colorImg.complete && maskCanvas) {
        const offCanvas = document.createElement("canvas");
        offCanvas.width = width;
        offCanvas.height = height;
        const offCtx = offCanvas.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(
            colorImg,
            transform.offsetX,
            transform.offsetY,
            transform.renderedWidth,
            transform.renderedHeight
          );
          offCtx.globalCompositeOperation = "destination-in";
          offCtx.drawImage(
            maskCanvas,
            transform.offsetX,
            transform.offsetY,
            transform.renderedWidth,
            transform.renderedHeight
          );
          targetCtx.drawImage(offCanvas, 0, 0);
        }
      }
      if (glazeCanvas) {
        targetCtx.drawImage(
          glazeCanvas,
          transform.offsetX,
          transform.offsetY,
          transform.renderedWidth,
          transform.renderedHeight
        );
      }
      if (chIdx === 1 && maskCanvas) {
        const time = performance.now();
        const stars = [
          { x: 0.48, y: 0.28, phase: 0 },
          { x: 0.52, y: 0.32, phase: 1.2 },
          { x: 0.45, y: 0.34, phase: 2.4 },
          { x: 0.55, y: 0.29, phase: 3.6 },
          { x: 0.42, y: 0.25, phase: 0.8 },
          { x: 0.58, y: 0.35, phase: 4.8 },
          { x: 0.50, y: 0.22, phase: 1.9 },
          { x: 0.46, y: 0.40, phase: 3.1 },
        ];
        stars.forEach((s) => {
          const sp = PaintEngine.mapImageToStage(s.x * maskW, s.y * maskH, transform);
          const twinkle = 0.35 + 0.60 * Math.sin(time * 0.003 + s.phase);
          targetCtx.save();
          targetCtx.fillStyle = "rgba(243, 221, 166, " + twinkle + ")";
          targetCtx.beginPath();
          targetCtx.arc(sp.x, sp.y, 1.8, 0, Math.PI * 2);
          targetCtx.fill();
          targetCtx.restore();
        });
      }
      targetCtx.restore();
    },
    [kintsugiFactor]
  );
  useEffect(() => {
    let animId: number;
    let lastTick = performance.now();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const render = (time: number) => {
      animId = requestAnimationFrame(render);
      const dt = Math.min(0.1, (time - lastTick) / 1000);
      lastTick = time;
      fpsRef.current.frames++;
      if (time - fpsRef.current.lastTime >= 1000) {
        fpsRef.current.currentFps = Math.round(
          (fpsRef.current.frames * 1000) / (time - fpsRef.current.lastTime)
        );
        fpsRef.current.frames = 0;
        fpsRef.current.lastTime = time;
      }
      const width = canvas.clientWidth || window.innerWidth;
      const height = canvas.clientHeight || window.innerHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);
      const parallaxX = (mousePosRef.current.rawX / width - 0.5) * 16;
      const parallaxY = (mousePosRef.current.rawY / height - 0.5) * 16;
      const kenBurnsX = Math.sin(time * 0.0003 + activeChapterIndex) * 6;
      const kenBurnsY = Math.cos(time * 0.0002 + activeChapterIndex) * 5;
      ctx.save();
      ctx.translate(parallaxX, parallaxY);
      if (!isMidTransition || activeChapterIndex >= 4) {
        drawSceneOntoContext(ctx, activeChapterIndex, width, height, 1.0, kenBurnsX, kenBurnsY);
      } else {
        const nextChapter = activeChapterIndex + 1;
        const p = transitionProgress;
        if (isCalmOrReduced) {
          ctx.save();
          ctx.globalAlpha = 1 - p;
          drawSceneOntoContext(ctx, activeChapterIndex, width, height, 1.0, kenBurnsX, kenBurnsY);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = p;
          drawSceneOntoContext(ctx, nextChapter, width, height, 1.0, 0, 0);
          ctx.restore();
        } else if (activeChapterIndex === 2 || activeChapterIndex === 3) {
          const cols = 12;
          const rows = 7;
          const tileW = width / cols;
          const tileH = height / rows;
          const displacement = Math.sin(Math.PI * p);
          const curBuf = document.createElement("canvas");
          curBuf.width = width;
          curBuf.height = height;
          const curCtx = curBuf.getContext("2d");
          if (curCtx) {
            drawSceneOntoContext(curCtx, activeChapterIndex, width, height, 1.0, kenBurnsX, kenBurnsY);
          }
          const nextBuf = document.createElement("canvas");
          nextBuf.width = width;
          nextBuf.height = height;
          const nextCtx = nextBuf.getContext("2d");
          if (nextCtx) {
            drawSceneOntoContext(nextCtx, nextChapter, width, height, 1.0, 0, 0);
          }
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const sx = c * tileW;
              const sy = r * tileH;
              const dx = Math.sin(c * 1.7 + r * 2.3) * 45 * displacement;
              const dy = Math.cos(c * 2.1 + r * 1.9) * 35 * displacement;
              const rot = Math.sin(c * 0.9 - r * 1.1) * 0.08 * displacement;
              ctx.save();
              ctx.translate(sx + tileW / 2 + dx, sy + tileH / 2 + dy);
              ctx.rotate(rot);
              const activeSource = p < 0.5 ? curBuf : nextBuf;
              ctx.drawImage(
                activeSource,
                sx,
                sy,
                tileW,
                tileH,
                -tileW / 2,
                -tileH / 2,
                tileW,
                tileH
              );
              ctx.strokeStyle = "rgba(226, 184, 102, " + 0.45 * displacement + ")";
              ctx.lineWidth = 1.0;
              ctx.strokeRect(-tileW / 2, -tileH / 2, tileW, tileH);
              ctx.restore();
            }
          }
        } else {
          const scaleCur = 1.0 + p * 0.06;
          const scaleNext = 1.06 - p * 0.06;
          ctx.save();
          ctx.globalAlpha = 1 - p;
          drawSceneOntoContext(ctx, activeChapterIndex, width, height, scaleCur, kenBurnsX, kenBurnsY);
          ctx.restore();
          ctx.save();
          ctx.globalAlpha = p;
          drawSceneOntoContext(ctx, nextChapter, width, height, scaleNext, 0, 0);
          ctx.restore();
        }
      }
      // Soft painted radial vignette in calm zone
      const cfg = CHAPTER_CONFIGS[activeChapterIndex];
      const isPortrait = width < 768 && cfg.artSrcTall;
      const maskW = isPortrait ? 540 : cfg.maskWidth;
      const maskH = isPortrait ? 960 : cfg.maskHeight;
      const transform = PaintEngine.computeCoverTransform(width, height, maskW, maskH);
      const zone = isPortrait && cfg.calmZoneTall ? cfg.calmZoneTall : cfg.calmZone;
      const czX = transform.offsetX + zone.x * maskW * transform.scale;
      const czY = transform.offsetY + zone.y * maskH * transform.scale;
      const czW = zone.width * maskW * transform.scale;
      const czH = zone.height * maskH * transform.scale;
      const gradVignette = ctx.createRadialGradient(
        czX + czW * 0.45,
        czY + czH * 0.45,
        20,
        czX + czW * 0.45,
        czY + czH * 0.45,
        Math.max(czW, czH) * 0.85
      );
      gradVignette.addColorStop(0, "rgba(9, 13, 17, 0.82)");
      gradVignette.addColorStop(0.55, "rgba(9, 13, 17, 0.48)");
      gradVignette.addColorStop(1, "transparent");
      ctx.fillStyle = gradVignette;
      ctx.fillRect(czX - 30, czY - 30, czW + 60, czH + 60);
      // Hotspot halos
      cfg.hotspots.forEach((h, hIdx) => {
        const stageP = PaintEngine.mapImageToStage(h.x * maskW, h.y * maskH, transform);
        const pulse = Math.sin(time * 0.003 + hIdx * 1.5) * 4;
        const haloR = (h.r * maskW * transform.scale) / 8 + pulse;
        ctx.save();
        ctx.strokeStyle = "rgba(226, 184, 102, 0.42)";
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(stageP.x, stageP.y, haloR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(243, 221, 166, 0.22)";
        ctx.beginPath();
        ctx.arc(stageP.x, stageP.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      // Ripples & Droplets
      for (let i = ripplesRef.current.length - 1; i >= 0; i--) {
        const r = ripplesRef.current[i];
        r.radius += (r.maxRadius - r.radius) * 0.14;
        r.alpha *= 0.92;
        ctx.save();
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = r.alpha;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        if (r.alpha < 0.03) ripplesRef.current.splice(i, 1);
      }
      for (let i = dropletsRef.current.length - 1; i >= 0; i--) {
        const d = dropletsRef.current[i];
        d.x += d.vx;
        d.y += d.vy;
        d.vy += 0.22;
        d.alpha *= 0.94;
        ctx.save();
        ctx.fillStyle = d.color;
        ctx.globalAlpha = d.alpha;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (d.alpha < 0.04) dropletsRef.current.splice(i, 1);
      }
      ambientParticlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < 0) p.y = height;
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        ctx.save();
        ctx.fillStyle = "rgba(226, 184, 102, " + p.alpha * 0.6 + ")";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      const gradMist = ctx.createLinearGradient(0, height - 120, 0, height);
      gradMist.addColorStop(0, "transparent");
      gradMist.addColorStop(1, "rgba(12, 28, 23, 0.45)");
      ctx.fillStyle = gradMist;
      ctx.fillRect(0, height - 120, width, 120);
      // Flying balloons
      for (let i = balloonsRef.current.length - 1; i >= 0; i--) {
        const b = balloonsRef.current[i];
        b.elapsed += dt;
        const t = Math.min(1, b.elapsed / b.duration);
        const shadow = PaintEngine.computeGroundShadow(
          b.startX,
          b.startY,
          b.targetX,
          b.targetY,
          t
        );
        ctx.save();
        ctx.translate(shadow.x, shadow.y);
        ctx.scale(shadow.scaleX, shadow.scaleY);
        ctx.fillStyle = "rgba(0, 0, 0, " + shadow.alpha + ")";
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const pos = PaintEngine.computeBalloonPosition(
          b.startX,
          b.startY,
          b.targetX,
          b.targetY,
          b.arcHeight,
          t
        );
        const scale = PaintEngine.computeBalloonScale(t);
        const wobble = PaintEngine.computeBalloonWobble(time * 0.001, b.wobblePhase, t);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        ctx.rotate(wobble);
        ctx.scale(scale, scale);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, -2, 13, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(-3, -6, 5, 8, -Math.PI / 6, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.moveTo(-2, 14);
        ctx.lineTo(2, 14);
        ctx.lineTo(0, 17);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        if (t >= 1) {
          onSplashImpact(b.chapterIndex, b.targetX, b.targetY, b.splashRadius, b.pigment, b.color);
          balloonsRef.current.splice(i, 1);
        }
      }
      ctx.restore();
    };
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [
    activeChapterIndex,
    isMidTransition,
    transitionProgress,
    isCalmOrReduced,
    drawSceneOntoContext,
    onSplashImpact,
  ]);
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    mousePosRef.current = { x, y, rawX: x, rawY: y };
    if (isDragging) {
      throwBalloon(x, y);
    }
  };
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    throwBalloon(e.clientX - rect.left, e.clientY - rect.top);
  };
  const handlePointerUp = () => {
    setIsDragging(false);
  };
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setActiveChapterIndex((prev) => Math.min(4, prev + 1));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setActiveChapterIndex((prev) => Math.max(0, prev - 1));
      } else if (["1", "2", "3", "4", "5"].includes(e.key)) {
        e.preventDefault();
        setActiveChapterIndex(parseInt(e.key, 10) - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const currentCfg = CHAPTER_CONFIGS[activeChapterIndex];
  const coveragePercent = Math.round((chapterCoverages[activeChapterIndex] || 0) * 100);
  const inkInFactor = Math.min(1, Math.max(0, (coveragePercent - 10) / 60));
  const textR = Math.round(189 + inkInFactor * (226 - 189));
  const textG = Math.round(206 + inkInFactor * (184 - 206));
  const textB = Math.round(188 + inkInFactor * (102 - 188));
  const inkingColor = `rgb(${textR}, ${textG}, ${textB})`;
  const canvas = canvasRef.current;
  const stageWidth = canvas?.width || 1920;
  const stageHeight = canvas?.height || 1080;
  const isPortraitMode = stageWidth < 768 && currentCfg.artSrcTall;
  const maskWidth = isPortraitMode ? 540 : currentCfg.maskWidth;
  const maskHeight = isPortraitMode ? 960 : currentCfg.maskHeight;
  const currentTransform = PaintEngine.computeCoverTransform(
    stageWidth,
    stageHeight,
    maskWidth,
    maskHeight
  );
  const activeZone =
    isPortraitMode && currentCfg.calmZoneTall ? currentCfg.calmZoneTall : currentCfg.calmZone;
  const textLeft = Math.max(
    16,
    Math.min(
      stageWidth - 320,
      currentTransform.offsetX + activeZone.x * maskWidth * currentTransform.scale
    )
  );
  const textTop = Math.max(
    80,
    Math.min(
      stageHeight - 220,
      currentTransform.offsetY + activeZone.y * maskHeight * currentTransform.scale
    )
  );
  const textMaxWidth = Math.min(
    stageWidth - 32,
    Math.max(280, activeZone.width * maskWidth * currentTransform.scale * 1.05)
  );
  const headlineWords = useMemo(() => {
    return currentCfg.headline.split(" ");
  }, [currentCfg.headline]);
  return (
    <div
      ref={containerRef}
      className="relative w-full h-[750vh] bg-bg text-text"
      aria-label="The Paint Theatre"
    >
      <div className="sr-only" aria-live="polite" role="status">
        {ariaAnnouncement}
      </div>
      <a
        href="#painted-journey"
        className="sr-only focus:not-sr-only fixed top-4 left-4 z-50 px-4 py-2 bg-surface text-lantern border border-lantern rounded-lg font-serif text-sm focus:outline-none"
      >
        Skip the theatre
      </a>
      {/* Sticky Stage Viewport */}
      <div className="sticky top-0 w-full h-screen overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
          title="Click or drag to throw pigment balloons"
        />
        <div className="absolute inset-0 cinematic-vignette pointer-events-none" />
        {/* First Throw Invitation Hint */}
        {!hasThrownFirstBalloon && (
          <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-30 pointer-events-none flex flex-col items-center gap-1.5 animate-pulse">
            <span className="font-serif italic text-xs sm:text-sm text-accent bg-void/80 px-4 py-1.5 rounded-full border border-hairline/60 backdrop-blur-md shadow-lantern-sm">
              Throw colour at the picture.
            </span>
          </div>
        )}
        {/* MINIMAL HUD TOP BAR: Arch Dots, Halo Ring, Sound Toggle */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-3 bg-void/75 border border-hairline/60 backdrop-blur-md px-3.5 py-1.5 rounded-full pointer-events-auto">
            <div className="flex items-center gap-1.5">
              {CHAPTER_CONFIGS.map((cfg, idx) => (
                <button
                  key={cfg.key}
                  onClick={() => setActiveChapterIndex(idx)}
                  aria-label={`Jump to ${cfg.name}`}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-serif transition-all ${
                    idx === activeChapterIndex
                      ? "text-accent font-semibold"
                      : "text-text-muted hover:text-text opacity-60"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === activeChapterIndex ? "bg-accent scale-125" : "bg-text-subtle"
                    }`}
                  />
                  <span className="hidden sm:inline text-[11px] font-mono">
                    {idx === 0 ? "I" : idx === 1 ? "II" : idx === 2 ? "III" : idx === 3 ? "IV" : "V"}
                  </span>
                </button>
              ))}
            </div>
            <div
              className="relative flex items-center justify-center w-5 h-5 ml-1"
              title={`${coveragePercent}% coloured`}
            >
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="rgba(40, 46, 49, 0.8)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="#E2B866"
                  strokeWidth="2.5"
                  strokeDasharray="56.5"
                  strokeDashoffset={56.5 - (56.5 * coveragePercent) / 100}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
            </div>
          </div>
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={sound.toggleSound}
              aria-label={sound.soundEnabled ? "Disable sound" : "Enable sound (off by default)"}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-serif backdrop-blur-md transition-all ${
                sound.soundEnabled
                  ? "bg-accent/20 border-accent text-accent shadow-lantern-sm"
                  : "bg-void/75 border-hairline/60 text-text-muted hover:text-text"
              }`}
            >
              {sound.soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Sound ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Sound FX</span>
                </>
              )}
            </button>
          </div>
        </div>
        {/* REAL DOM TEXT POSITIONED IN CALM ZONE (No Box, No Card) */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`calm-text-${activeChapterIndex}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: `${textLeft}px`,
              top: `${textTop}px`,
              maxWidth: `${textMaxWidth}px`,
            }}
            className="z-20 pointer-events-auto select-text space-y-3"
          >
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.85 }}
              transition={{ delay: 0.05, duration: 0.3 }}
              className="text-[11px] font-mono uppercase tracking-widest block"
              style={{ color: inkingColor }}
            >
              {currentCfg.name}
            </motion.span>
            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-light leading-tight text-cloud">
              {headlineWords.map((word, wIdx) => (
                <motion.span
                  key={`${word}-${wIdx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + wIdx * 0.045, duration: 0.32 }}
                  className="inline-block mr-1.5 sm:mr-2"
                >
                  {word}
                </motion.span>
              ))}
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 0.95, y: 0 }}
              transition={{ delay: 0.2 + headlineWords.length * 0.045, duration: 0.4 }}
              className="font-serif italic text-xs sm:text-sm lg:text-base leading-relaxed"
              style={{ color: inkingColor }}
            >
              &ldquo;{currentCfg.poeticCopy}&rdquo;
            </motion.p>
            <div className="pt-2 flex items-center gap-3">
              {activeChapterIndex === 0 && (
                <Link href={primaryTargetHref}>
                  <PrimaryButton className="px-5 py-2 text-xs shadow-lantern">
                    Step through
                  </PrimaryButton>
                </Link>
              )}
              {activeChapterIndex === 4 && allChaptersComplete && (
                <Link href={primaryTargetHref}>
                  <PrimaryButton
                    icon={<CheckCircle2 className="w-4 h-4" />}
                    className="px-6 py-2.5 text-xs shadow-lantern"
                  >
                    Open the door
                  </PrimaryButton>
                </Link>
              )}
              {coveragePercent >= 70 && coveragePercent < 100 && (
                <button
                  onClick={handlePaintTheRest}
                  className="px-3.5 py-1.5 rounded-full text-xs font-serif bg-surface/80 border border-accent/60 text-accent hover:bg-accent hover:text-void transition-all shadow-lantern-sm backdrop-blur-md"
                >
                  Paint the rest
                </button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
        {activeChapterIndex === 3 && (
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30 w-64 max-w-[80vw] pointer-events-auto flex flex-col items-center gap-1">
            <div className="flex items-center justify-between w-full text-[10px] font-serif text-text-muted">
              <span className="flex items-center gap-1 text-accent">
                <Sliders className="w-2.5 h-2.5" />
                <span>Scatter</span>
              </span>
              <span className="font-mono text-accent">{Math.round(kintsugiFactor * 100)}%</span>
              <span className="text-accent">Weave</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={kintsugiFactor}
              onChange={(e) => setKintsugiFactor(parseFloat(e.target.value))}
              className="w-full accent-accent h-1 bg-surface-raised rounded-lg cursor-pointer"
              aria-label="Scatter or weave broken dream shards"
            />
          </div>
        )}
        {/* BOTTOM RIGHT: Pigment Dock */}
        <div className="absolute right-6 bottom-6 z-30 pointer-events-auto">
          <div className="p-2 rounded-full bg-void/85 border border-hairline/80 backdrop-blur-xl shadow-2xl flex items-center gap-1.5">
            {PALETTE_PIGMENTS.map((pigment) => {
              const isSelected = selectedPigment === pigment.key;
              return (
                <button
                  key={pigment.key}
                  onClick={() => setSelectedPigment(pigment.key)}
                  aria-label={`Select ${pigment.name}: ${pigment.label}`}
                  title={`${pigment.name} (${pigment.label})`}
                  className={`relative flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all ${
                    isSelected
                      ? "ring-2 ring-accent scale-110 shadow-lantern-sm"
                      : "opacity-70 hover:opacity-100 hover:scale-105"
                  }`}
                  style={{
                    backgroundColor:
                      pigment.key === "true" ? "#E2B866" : pigment.hex,
                  }}
                >
                  {isSelected && <span className="w-2 h-2 rounded-full bg-void" />}
                  {pigment.key === "true" && <span className="sr-only">True Memory</span>}
                </button>
              );
            })}
          </div>
        </div>
        {/* Visually Hidden Keyboard Hotspots */}
        <div className="absolute top-16 left-4 z-40 pointer-events-auto flex flex-col gap-1">
          {currentCfg.hotspots.map((h) => (
            <button
              key={h.id}
              onClick={() => {
                const cv = canvasRef.current;
                const w = cv?.width || window.innerWidth;
                const hStage = cv?.height || window.innerHeight;
                const isP = w < 768 && currentCfg.artSrcTall;
                const mW = isP ? 540 : currentCfg.maskWidth;
                const mH = isP ? 960 : currentCfg.maskHeight;
                const tr = PaintEngine.computeCoverTransform(w, hStage, mW, mH);
                const p = PaintEngine.mapImageToStage(h.x * mW, h.y * mH, tr);
                throwBalloon(p.x, p.y);
              }}
              className="sr-only focus:not-sr-only px-3 py-1 rounded bg-surface border border-accent text-accent font-serif text-xs shadow-lantern"
            >
              Throw colour at {h.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
