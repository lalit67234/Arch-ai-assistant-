import React, { useEffect, useRef, useState } from "react";
import { LiveState } from "../lib/audio";

interface ArchAICoreProps {
  state: LiveState;
  getAudioData?: () => Uint8Array | null;
  onCoreClick?: () => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  baseAlpha: number;
}

export const ArchAICore: React.FC<ArchAICoreProps> = ({
  state,
  getAudioData,
  onCoreClick
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    // Resize handling with high DPR
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    updateSize();
    window.addEventListener("resize", updateSize);

    // Initialize 3D particles
    const particleCount = 48;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 40 + Math.random() * 70;
      particles.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        radius: 1 + Math.random() * 2,
        baseAlpha: 0.3 + Math.random() * 0.6
      });
    }

    const render = () => {
      time += 0.02;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cx = width / 2;
      const cy = height / 2 - 15; // Slightly offset to fit pedestal

      ctx.clearRect(0, 0, width, height);

      // 1. Calculate live audio activity
      let rawAudio = 0;
      if (getAudioData) {
        const freq = getAudioData();
        if (freq && freq.length > 0) {
          let sum = 0;
          const sampleCount = Math.min(freq.length, 32);
          for (let i = 0; i < sampleCount; i++) {
            sum += freq[i];
          }
          rawAudio = sum / (sampleCount * 255);
        }
      }

      const activeAudio = Math.max(
        rawAudio,
        state === "speaking" ? 0.35 + 0.25 * Math.sin(time * 8) : state === "listening" ? 0.15 : 0.05
      );
      setAudioLevel(activeAudio);

      // Rotation speeds based on state
      const baseSpeed = state === "speaking" ? 0.045 : state === "listening" ? 0.03 : state === "connecting" ? 0.06 : 0.015;
      const rotX = time * baseSpeed * 0.8;
      const rotY = time * baseSpeed;
      const rotZ = time * baseSpeed * 0.5;

      // ==========================================
      // STAGE 1: METALLIC HOLOGRAPHIC EMITTER BASE (Pedestal)
      // ==========================================
      const pedestalY = cy + 110;
      const pedestalRadiusX = 130;
      const pedestalRadiusY = 32;

      // Floor Reflection Glow
      const floorGrad = ctx.createRadialGradient(cx, pedestalY + 10, 10, cx, pedestalY + 10, 140);
      floorGrad.addColorStop(0, "rgba(0, 240, 255, 0.22)");
      floorGrad.addColorStop(0.5, "rgba(2, 132, 199, 0.08)");
      floorGrad.addColorStop(1, "transparent");
      ctx.fillStyle = floorGrad;
      ctx.beginPath();
      ctx.ellipse(cx, pedestalY + 10, pedestalRadiusX * 1.2, pedestalRadiusY * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pedestal Lower Metallic Tier
      ctx.beginPath();
      ctx.ellipse(cx, pedestalY + 8, pedestalRadiusX, pedestalRadiusY, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.25)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Pedestal Upper Glowing Stage
      ctx.beginPath();
      ctx.ellipse(cx, pedestalY, pedestalRadiusX * 0.85, pedestalRadiusY * 0.85, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0, 240, 255, 0.6)";
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner Core Emitter Well
      ctx.beginPath();
      ctx.ellipse(cx, pedestalY - 4, pedestalRadiusX * 0.55, pedestalRadiusY * 0.55, 0, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(14, 165, 233, 0.8)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Emitter ticks
      const tickCount = 24;
      for (let i = 0; i < tickCount; i++) {
        const angle = (i / tickCount) * Math.PI * 2 + time * 0.2;
        const tx1 = cx + Math.cos(angle) * (pedestalRadiusX * 0.75);
        const ty1 = pedestalY + Math.sin(angle) * (pedestalRadiusY * 0.75);
        const tx2 = cx + Math.cos(angle) * (pedestalRadiusX * 0.85);
        const ty2 = pedestalY + Math.sin(angle) * (pedestalRadiusY * 0.85);
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.strokeStyle = i % 4 === 0 ? "rgba(0, 240, 255, 0.9)" : "rgba(0, 240, 255, 0.3)";
        ctx.lineWidth = i % 4 === 0 ? 2 : 1;
        ctx.stroke();
      }

      // ==========================================
      // STAGE 2: VERTICAL RADIANT LIGHT BEAM
      // ==========================================
      const beamGrad = ctx.createLinearGradient(cx - 8, 0, cx + 8, 0);
      const beamIntensity = 0.35 + activeAudio * 0.35;
      beamGrad.addColorStop(0, "transparent");
      beamGrad.addColorStop(0.3, `rgba(0, 240, 255, ${beamIntensity * 0.3})`);
      beamGrad.addColorStop(0.5, `rgba(255, 255, 255, ${beamIntensity * 0.85})`);
      beamGrad.addColorStop(0.7, `rgba(0, 240, 255, ${beamIntensity * 0.3})`);
      beamGrad.addColorStop(1, "transparent");

      ctx.fillStyle = beamGrad;
      ctx.fillRect(cx - 8, cy - 140, 16, 260);

      // Central Laser Core Needle
      ctx.beginPath();
      ctx.moveTo(cx, cy - 130);
      ctx.lineTo(cx, cy + 120);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 + activeAudio * 0.3})`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ==========================================
      // STAGE 3: BACKGROUND PLASMA AURA
      // ==========================================
      const corePulse = 72 + activeAudio * 28 + Math.sin(time * 3) * 3;
      const plasmaGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, corePulse * 1.5);
      plasmaGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      plasmaGrad.addColorStop(0.2, "rgba(0, 240, 255, 0.75)");
      plasmaGrad.addColorStop(0.5, "rgba(2, 132, 199, 0.35)");
      plasmaGrad.addColorStop(0.8, "rgba(30, 58, 138, 0.12)");
      plasmaGrad.addColorStop(1, "transparent");

      ctx.fillStyle = plasmaGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, corePulse * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // ==========================================
      // STAGE 4: 3D ORBITAL ENERGY RINGS (GYROSCOPE)
      // ==========================================
      const draw3DRing = (
        tiltX: number,
        tiltY: number,
        radius: number,
        color: string,
        lineWidth: number,
        dash: number[] = [],
        hasNodes = true
      ) => {
        const segments = 64;
        const pts: { x: number; y: number; z: number }[] = [];

        for (let i = 0; i <= segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          let x = radius * Math.cos(theta);
          let y = radius * Math.sin(theta);
          let z = 0;

          // Rotate around X
          const y1 = y * Math.cos(tiltX) - z * Math.sin(tiltX);
          const z1 = y * Math.sin(tiltX) + z * Math.cos(tiltX);

          // Rotate around Y
          const x2 = x * Math.cos(tiltY) + z1 * Math.sin(tiltY);
          const z2 = -x * Math.sin(tiltY) + z1 * Math.cos(tiltY);

          // Project to 2D
          const perspective = 300;
          const scale = perspective / (perspective + z2);
          pts.push({
            x: cx + x2 * scale,
            y: cy + y1 * scale,
            z: z2
          });
        }

        // Draw ring segments with depth sorting
        ctx.beginPath();
        ctx.setLineDash(dash);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;

        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Orbiting energetic node
        if (hasNodes) {
          const nodeIdx = Math.floor(((time * 15) % segments));
          const node = pts[nodeIdx];
          if (node) {
            const nodeAlpha = Math.min(Math.max((node.z + 100) / 200, 0.4), 1);
            ctx.beginPath();
            ctx.arc(node.x, node.y, 3 * (1 + activeAudio), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${nodeAlpha})`;
            ctx.shadowColor = "#00f0ff";
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      };

      // Ring 1: Primary Horizontal Tilted Orbit
      draw3DRing(
        0.7 + Math.sin(time * 0.4) * 0.1,
        rotY,
        82 + activeAudio * 15,
        "rgba(0, 240, 255, 0.8)",
        2.2,
        [8, 4]
      );

      // Ring 2: Counter-inclined Gyro Ring
      draw3DRing(
        -0.8 + Math.cos(time * 0.3) * 0.1,
        -rotY * 1.2,
        88 + activeAudio * 18,
        "rgba(56, 189, 248, 0.75)",
        1.8,
        [16, 8]
      );

      // Ring 3: Steep Polar Containment Ring
      draw3DRing(
        rotX * 0.6 + 1.2,
        rotZ * 0.5,
        96 + activeAudio * 20,
        "rgba(14, 165, 233, 0.55)",
        1.5,
        [4, 12]
      );

      // ==========================================
      // STAGE 5: 3D PARTICLE FIELD VORTEX
      // ==========================================
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Orbit around Y and Z
        const speed = baseSpeed * 1.5;
        const cosS = Math.cos(speed);
        const sinS = Math.sin(speed);

        const x1 = p.x * cosS - p.z * sinS;
        const z1 = p.x * sinS + p.z * cosS;
        p.x = x1;
        p.z = z1;

        // Project
        const perspective = 300;
        const scale = perspective / (perspective + p.z);
        const screenX = cx + p.x * scale;
        const screenY = cy + p.y * scale;

        const depthAlpha = Math.min(Math.max((p.z + 100) / 200, 0.2), 1) * p.baseAlpha;
        const particleSize = p.radius * scale * (1 + activeAudio * 0.5);

        ctx.beginPath();
        ctx.arc(screenX, screenY, particleSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 240, 255, ${depthAlpha * (0.6 + activeAudio * 0.4)})`;
        ctx.fill();
      }

      // ==========================================
      // STAGE 6: CENTRAL ARCH CHEVRON "A" GLYPH
      // ==========================================
      const glyphScale = 1 + activeAudio * 0.18 + Math.sin(time * 4) * 0.04;
      const glyphSize = 32 * glyphScale;

      ctx.save();
      ctx.translate(cx, cy);

      // Core Glass Orb surrounding the A
      ctx.beginPath();
      ctx.arc(0, 0, 36 * glyphScale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 18;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner ARCH Triangular Chevron Logo
      ctx.beginPath();
      // Outer triangle/chevron
      ctx.moveTo(0, -glyphSize * 0.75);
      ctx.lineTo(glyphSize * 0.65, glyphSize * 0.65);
      ctx.lineTo(glyphSize * 0.3, glyphSize * 0.65);
      ctx.lineTo(0, -glyphSize * 0.05);
      ctx.lineTo(-glyphSize * 0.3, glyphSize * 0.65);
      ctx.lineTo(-glyphSize * 0.65, glyphSize * 0.65);
      ctx.closePath();

      // Central glowing cutout crossbar
      ctx.moveTo(-glyphSize * 0.22, glyphSize * 0.28);
      ctx.lineTo(glyphSize * 0.22, glyphSize * 0.28);
      ctx.lineTo(0, -glyphSize * 0.2);
      ctx.closePath();

      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "#00f0ff";
      ctx.shadowBlur = 24;
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateSize);
    };
  }, [state, getAudioData]);

  return (
    <div 
      className="relative w-full h-[320px] sm:h-[380px] md:h-[440px] flex items-center justify-center select-none overflow-visible"
      onClick={onCoreClick}
    >
      {/* Background Radial Glow */}
      <div 
        className="absolute w-[360px] h-[360px] sm:w-[480px] sm:h-[480px] rounded-full blur-[90px] pointer-events-none transition-all duration-700"
        style={{
          background: state === "speaking"
            ? "radial-gradient(circle, rgba(0,240,255,0.3) 0%, rgba(2,132,199,0.18) 45%, transparent 75%)"
            : state === "listening"
            ? "radial-gradient(circle, rgba(0,240,255,0.22) 0%, rgba(12,74,110,0.12) 50%, transparent 75%)"
            : state === "connecting"
            ? "radial-gradient(circle, rgba(245,158,11,0.2) 0%, transparent 70%)"
            : "radial-gradient(circle, rgba(0,240,255,0.12) 0%, transparent 70%)"
        }}
      />

      {/* Primary 3D WebGL/Canvas Renderer */}
      <canvas
        ref={canvasRef}
        className="relative w-full h-full max-w-[500px] cursor-pointer"
        title="ARCH Central AI Core"
      />
    </div>
  );
};
