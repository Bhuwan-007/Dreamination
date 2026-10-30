import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { DreamAudioEngine } from "../audio/ambient-bed";

export interface ExportProgressCallback {
  (progress: number, stage: string): void;
}

export class VideoExporter {
  public static isSupported(): boolean {
    return typeof window !== "undefined" && typeof (window as any).VideoEncoder === "function";
  }

  public static async exportScene(
    canvas: HTMLCanvasElement,
    totalDurationSeconds: number,
    renderFrameAtTime: (timeSeconds: number) => void,
    getSubtitleAtTime: (timeSeconds: number) => string,
    onProgress: ExportProgressCallback
  ): Promise<Blob> {
    if (!this.isSupported()) {
      throw new Error(
        "WebCodecs VideoEncoder is not supported in this browser. Please use Chrome/Edge or enable WebCodecs."
      );
    }

    const width = 1920;
    const height = 1080;
    const fps = 30;
    const totalFrames = Math.floor(totalDurationSeconds * fps);
    const frameDurationMicroseconds = Math.round(1_000_000 / fps);

    // 1. Offscreen render canvas sized to 1080p
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D canvas context for export");

    // 2. Check AudioEncoder support for AAC
    const sampleRate = 44100;
    let hasAudio = false;
    let audioEncoder: any = null;

    if (typeof (window as any).AudioEncoder === "function") {
      const audioConfig = {
        codec: "mp4a.40.2", // AAC-LC
        numberOfChannels: 2,
        sampleRate,
        bitrate: 128000,
      };

      try {
        const support = await (window as any).AudioEncoder.isConfigSupported(audioConfig);
        if (support && support.supported) {
          hasAudio = true;
        }
      } catch (e) {
        console.warn("WebCodecs AudioEncoder check skipped:", e);
      }
    }

    // 3. Initialize MP4 Muxer with optional audio track
    const target = new ArrayBufferTarget();
    const muxerOptions: any = {
      target,
      video: {
        codec: "avc",
        width,
        height,
      },
      fastStart: "in-memory",
    };

    if (hasAudio) {
      muxerOptions.audio = {
        codec: "aac",
        numberOfChannels: 2,
        sampleRate,
      };
    }

    const muxer = new Muxer(muxerOptions);

    // 4. Initialize WebCodecs VideoEncoder
    const videoEncoder = new (window as any).VideoEncoder({
      output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
      error: (e: any) => console.error("WebCodecs VideoEncoder error:", e),
    });

    videoEncoder.configure({
      codec: "avc1.640028", // H.264 High Profile Level 4.0
      width,
      height,
      bitrate: 8_000_000, // 8 Mbps
      framerate: fps,
    });

    // 5. Synthesize and encode audio track if supported
    if (hasAudio) {
      try {
        onProgress(5, "Synthesizing dream audio soundscape...");
        audioEncoder = new (window as any).AudioEncoder({
          output: (chunk: any, meta: any) => muxer.addAudioChunk(chunk, meta),
          error: (e: any) => console.error("WebCodecs AudioEncoder error:", e),
        });

        audioEncoder.configure({
          codec: "mp4a.40.2",
          numberOfChannels: 2,
          sampleRate,
          bitrate: 128000,
        });

        const audioBuffer = await DreamAudioEngine.renderOfflineSoundscape(totalDurationSeconds);
        const leftData = audioBuffer.getChannelData(0);
        const rightData = audioBuffer.getChannelData(1);
        const totalSamples = audioBuffer.length;
        const chunkSize = 1024;

        for (let offset = 0; offset < totalSamples; offset += chunkSize) {
          const framesThisChunk = Math.min(chunkSize, totalSamples - offset);
          const planarBuffer = new Float32Array(framesThisChunk * 2);
          planarBuffer.set(leftData.subarray(offset, offset + framesThisChunk), 0);
          planarBuffer.set(rightData.subarray(offset, offset + framesThisChunk), framesThisChunk);

          const timestampMicros = Math.round((offset / sampleRate) * 1_000_000);
          const audioData = new (window as any).AudioData({
            format: "f32-planar",
            sampleRate,
            numberOfFrames: framesThisChunk,
            numberOfChannels: 2,
            timestamp: timestampMicros,
            data: planarBuffer,
          });

          audioEncoder.encode(audioData);
          audioData.close();
        }

        await audioEncoder.flush();
      } catch (err) {
        console.warn("Audio track encoding skipped; continuing with video:", err);
      }
    }

    // 6. Fixed-timestep offline rendering loop
    for (let frame = 0; frame < totalFrames; frame++) {
      const timeSeconds = frame / fps;

      // Render 3D scene at exact deterministic timestep
      renderFrameAtTime(timeSeconds);

      // Draw WebGL canvas onto export canvas
      ctx.drawImage(canvas, 0, 0, width, height);

      // Burn cinematic subtitles onto video frame
      if (getSubtitleAtTime) {
        const subtitle = getSubtitleAtTime(timeSeconds);
        if (subtitle && subtitle.trim().length > 0) {
          ctx.save();
          ctx.font = "italic 36px 'Georgia', 'Newsreader', serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";

          const textMetrics = ctx.measureText(subtitle);
          const textWidth = textMetrics.width;
          const padX = 36;
          const padY = 16;
          const boxX = (width - textWidth) / 2 - padX;
          const boxY = height - 135 - padY;
          const boxW = textWidth + padX * 2;
          const boxH = 46 + padY * 2;

          // Glass backdrop
          ctx.fillStyle = "rgba(9, 13, 17, 0.82)";
          ctx.beginPath();
          if (typeof (ctx as any).roundRect === "function") {
            (ctx as any).roundRect(boxX, boxY, boxW, boxH, 8);
          } else {
            ctx.rect(boxX, boxY, boxW, boxH);
          }
          ctx.fill();

          // Subtle gold border
          ctx.strokeStyle = "rgba(226, 184, 102, 0.35)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Subtitle text with glow
          ctx.fillStyle = "#e9eaeb";
          ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
          ctx.shadowBlur = 10;
          ctx.fillText(subtitle, width / 2, height - 112);
          ctx.restore();
        }
      }

      // Create VideoFrame from canvas
      const timestamp = frame * frameDurationMicroseconds;
      const videoFrame = new (window as any).VideoFrame(exportCanvas, {
        timestamp,
        duration: frameDurationMicroseconds,
      });

      const keyFrame = frame % (fps * 2) === 0;
      videoEncoder.encode(videoFrame, { keyFrame });
      videoFrame.close();

      const percent = Math.round((frame / totalFrames) * 90) + 10;
      onProgress(percent, `Encoding frame ${frame + 1}/${totalFrames}`);

      // Yield event loop slightly every 5 frames so UI stays responsive
      if (frame % 5 === 0) {
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    onProgress(100, "Finalizing MP4 container...");
    await videoEncoder.flush();
    muxer.finalize();

    const buffer = target.buffer;
    return new Blob([buffer], { type: "video/mp4" });
  }

  public static downloadBlob(blob: Blob, filename = "dream-spike.mp4") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
