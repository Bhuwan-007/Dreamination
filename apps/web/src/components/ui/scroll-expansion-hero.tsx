"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { ChevronDown, FastForward } from "lucide-react";

export interface ScrollExpandMediaProps {
  mediaType?: "video" | "image";
  mediaSrc: string;
  posterSrc?: string;
  bgImageSrc: string;
  title?: string;
  date?: string;
  scrollToExpand?: string;
  textBlend?: boolean;
  children?: ReactNode;
}

export default function ScrollExpandMedia({
  mediaType = "image",
  mediaSrc,
  posterSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand = "Scroll to step through",
  textBlend = false,
  children,
}: ScrollExpandMediaProps) {
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [showContent, setShowContent] = useState<boolean>(false);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState<boolean>(false);
  const [touchStartY, setTouchStartY] = useState<number>(0);
  const [isMobileState, setIsMobileState] = useState<boolean>(false);
  const [isBypassed, setIsBypassed] = useState<boolean>(false);

  // Check for reduced motion and Calm mode on mount
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isCalm =
      typeof window !== "undefined" &&
      (localStorage.getItem("calm_mode") === "true" ||
        document.body.classList.contains("calm-mode"));

    if (prefersReducedMotion || isCalm) {
      setScrollProgress(1);
      setShowContent(true);
      setMediaFullyExpanded(true);
      setIsBypassed(true);
    }
  }, []);

  // Handle responsive viewport size
  useEffect(() => {
    const checkIfMobile = (): void => {
      setIsMobileState(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);

  // Skip intro handler (Section 12 requirement 2)
  const handleSkipIntro = useCallback(() => {
    setScrollProgress(1);
    setMediaFullyExpanded(true);
    setShowContent(true);
  }, []);

  // Wheel and Touch interactions (active only while NOT fully expanded)
  useEffect(() => {
    if (isBypassed || mediaFullyExpanded) {
      return;
    }

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scrollDelta = e.deltaY * 0.0012;
      setScrollProgress((prev) => {
        const next = Math.min(Math.max(prev + scrollDelta, 0), 1);
        if (next >= 1) {
          setMediaFullyExpanded(true);
          setShowContent(true);
        } else if (next < 0.75) {
          setShowContent(false);
        }
        return next;
      });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        setTouchStartY(e.touches[0].clientY);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartY || e.touches.length === 0) return;
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;

      e.preventDefault();
      const scrollFactor = deltaY < 0 ? 0.007 : 0.005;
      const scrollDelta = deltaY * scrollFactor;

      setScrollProgress((prev) => {
        const next = Math.min(Math.max(prev + scrollDelta, 0), 1);
        if (next >= 1) {
          setMediaFullyExpanded(true);
          setShowContent(true);
        } else if (next < 0.75) {
          setShowContent(false);
        }
        return next;
      });
      setTouchStartY(touchY);
    };

    const handleTouchEnd = () => {
      setTouchStartY(0);
    };

    const handleScroll = () => {
      if (!mediaFullyExpanded) {
        window.scrollTo(0, 0);
      }
    };

    // Keyboard navigation (Section 12 requirement 2)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setScrollProgress((prev) => {
          const next = Math.min(prev + 0.25, 1);
          if (next >= 1) {
            setMediaFullyExpanded(true);
            setShowContent(true);
          }
          return next;
        });
      } else if (e.key === "Home" || e.key === "Escape") {
        e.preventDefault();
        setScrollProgress(0);
        setShowContent(false);
        setMediaFullyExpanded(false);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("touchstart", handleTouchStart, { passive: false });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBypassed, mediaFullyExpanded, touchStartY]);

  // Scaling math
  const mediaWidth = 300 + scrollProgress * (isMobileState ? 650 : 1250);
  const mediaHeight = 400 + scrollProgress * (isMobileState ? 200 : 400);
  const textTranslateX = scrollProgress * (isMobileState ? 180 : 150);

  const firstWord = title ? title.split(" ")[0] : "";
  const restOfTitle = title ? title.split(" ").slice(1).join(" ") : "";

  return (
    <div className="relative transition-colors duration-700 ease-in-out overflow-x-hidden bg-bg text-text">
      {/* Skip Intro button (Section 12 requirement 2) */}
      {!mediaFullyExpanded && !isBypassed && (
        <button
          onClick={handleSkipIntro}
          aria-label="Skip portal intro"
          className="fixed top-6 right-6 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-hairline/80 bg-surface/85 backdrop-blur-md text-xs font-serif text-text-muted hover:text-text hover:border-accent transition-colors shadow-lantern-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <span>Skip intro</span>
          <FastForward className="w-3.5 h-3.5 text-accent" />
        </button>
      )}

      <section className="relative flex flex-col items-center justify-start min-h-[100dvh]">
        <div className="relative w-full flex flex-col items-center min-h-[100dvh]">
          {/* Background art image */}
          <motion.div
            className="absolute inset-0 z-0 h-full pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 - scrollProgress }}
            transition={{ duration: 0.2 }}
          >
            <Image
              src={bgImageSrc}
              alt="Night Void Atmosphere"
              fill
              sizes="100vw"
              priority
              className="object-cover object-center w-full h-full"
            />
            <div className="absolute inset-0 bg-bg/40" />
          </motion.div>

          <div className="container mx-auto flex flex-col items-center justify-start relative z-10">
            <div className="flex flex-col items-center justify-center w-full h-[100dvh] relative">
              {/* Expanding Portal Window Frame */}
              <div
                className="absolute z-0 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-2xl overflow-hidden border border-hairline"
                style={{
                  width: `${mediaWidth}px`,
                  height: `${mediaHeight}px`,
                  maxWidth: "96vw",
                  maxHeight: "88vh",
                  boxShadow:
                    "0 0 0 1px var(--hairline), 0 20px 60px -15px rgba(0, 0, 0, 0.7)",
                }}
              >
                {mediaType === "video" ? (
                  <div className="relative w-full h-full pointer-events-none">
                    <video
                      src={mediaSrc}
                      poster={posterSrc}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload={isMobileState ? "metadata" : "auto"}
                      className="w-full h-full object-cover"
                      controls={false}
                      disablePictureInPicture
                      disableRemotePlayback
                    />
                    <motion.div
                      className="absolute inset-0 bg-void/30 pointer-events-none"
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0.4 - scrollProgress * 0.3 }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-full">
                    <Image
                      src={mediaSrc}
                      alt={title || "Portal window to the dream"}
                      fill
                      sizes="(max-width: 768px) 95vw, 1200px"
                      priority
                      className="object-cover object-center w-full h-full"
                    />
                    <motion.div
                      className="absolute inset-0 bg-void/40 pointer-events-none"
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0.4 - scrollProgress * 0.3 }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}

                {/* Subtitle / date & prompt inside frame */}
                <div className="flex flex-col items-center text-center relative z-10 mt-4 px-4">
                  {date && (
                    <p
                      className="text-lg md:text-xl font-serif text-accent tracking-wide"
                      style={{ transform: `translateX(-${textTranslateX}vw)` }}
                    >
                      {date}
                    </p>
                  )}
                  {scrollToExpand && (
                    <div
                      className="flex items-center gap-1.5 text-text-muted font-serif text-xs md:text-sm mt-1"
                      style={{ transform: `translateX(${textTranslateX}vw)` }}
                    >
                      <span>{scrollToExpand}</span>
                      <ChevronDown className="w-3.5 h-3.5 text-accent animate-bounce" />
                    </div>
                  )}
                </div>
              </div>

              {/* Title sliding apart on scroll */}
              <div
                className={`flex items-center justify-center text-center gap-2 md:gap-4 w-full relative z-10 flex-col ${
                  textBlend ? "mix-blend-difference" : "mix-blend-normal"
                }`}
              >
                <motion.h2
                  className="text-4xl md:text-6xl lg:text-7xl font-display font-light text-text leading-tight"
                  style={{ transform: `translateX(-${textTranslateX}vw)` }}
                >
                  {firstWord}
                </motion.h2>
                <motion.h2
                  className="text-4xl md:text-6xl lg:text-7xl font-display italic font-light text-accent leading-tight"
                  style={{ transform: `translateX(${textTranslateX}vw)` }}
                >
                  {restOfTitle}
                </motion.h2>
              </div>
            </div>

            {/* Revealed content sections after expansion */}
            <motion.section
              className="flex flex-col w-full relative z-20"
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.6 }}
            >
              {children}
            </motion.section>
          </div>
        </div>
      </section>
    </div>
  );
}

