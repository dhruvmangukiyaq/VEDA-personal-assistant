"use client";
import { useRef, useEffect } from "react";

// Ambient deep-space drift: glowing particles slowly travelling
// from one side of the screen to the other, behind everything.
export default function SpaceDrift() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, raf = 0;

    type Dot = {
      x: number; y: number; vx: number; vy: number;
      s: number; col: string; tw: number; streak: boolean;
    };
    let dots: Dot[] = [];

    const build = () => {
      dots = Array.from({ length: 90 }, () => {
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.00012 + Math.random() * 0.0005;
        const streak = Math.random() < 0.12;
        const cols = ["0,220,255", "200,120,255", "255,170,90", "120,255,220"];
        return {
          x: Math.random(), y: Math.random(),
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          s: streak ? 1.5 + Math.random() * 2 : 0.6 + Math.random() * 1.8,
          col: cols[Math.floor(Math.random() * cols.length)],
          tw: Math.random() * Math.PI * 2,
          streak,
        };
      });
    };

    const resize = () => {
      w = canvas.width = canvas.offsetWidth * devicePixelRatio;
      h = canvas.height = canvas.offsetHeight * devicePixelRatio;
    };
    resize();
    build();
    window.addEventListener("resize", resize);

    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      ctx.clearRect(0, 0, w, h);
      const t = now / 1000;
      for (const d of dots) {
        d.x += (d.vx * dt) / 16.7;
        d.y += (d.vy * dt) / 16.7;
        if (d.x < -0.02) d.x = 1.02; if (d.x > 1.02) d.x = -0.02;
        if (d.y < -0.02) d.y = 1.02; if (d.y > 1.02) d.y = -0.02;
        const a = 0.18 + 0.22 * Math.abs(Math.sin(t * 0.8 + d.tw));
        const x = d.x * w, y = d.y * h;
        if (d.streak) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - d.vx * w * 90, y - d.vy * h * 90);
          ctx.strokeStyle = `rgba(${d.col},${a})`;
          ctx.lineWidth = d.s * devicePixelRatio * 0.6;
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(x, y, d.s * devicePixelRatio * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${d.col},${a})`;
          ctx.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}
