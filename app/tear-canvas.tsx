'use client';
// Authored transparent tear cels; only whole-packet lift/settle is interpolated.
import { useEffect, useRef, useState } from 'react';
import { assetUrl } from '../game/asset-url';
import { PACK_CANVAS, PACK_DURATION, packFrameRect, packMotion } from '../game/pack-animation';

export default function TearCanvas({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  const rafRef = useRef(0);
  const [ready, setReady] = useState(false);
  onDoneRef.current = onDone;
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onDoneRef.current();
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    let active = true;
    const atlas = new Image();
    // Settlement precedes this visual. A failed image must not trap or repeat it.
    const timeout = window.setTimeout(finish, 5000);
    atlas.onerror = () => { if (active) finish(); };
    atlas.onload = () => {
      if (!active || doneRef.current) return;
      clearTimeout(timeout);
      setReady(true);
      const start = performance.now();
      const frame = (now: number) => {
        if (!active || doneRef.current) return;
        const t = (now - start) / 1000;
        if (t >= PACK_DURATION) { finish(); return; }
        const motion = packMotion(t);
        const rect = packFrameRect(atlas.naturalWidth, atlas.naturalHeight, motion.frame);
        ctx.clearRect(0, 0, PACK_CANVAS.width, PACK_CANVAS.height);
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = motion.alpha;
        ctx.drawImage(atlas, rect.x, rect.y, rect.width, rect.height,
          motion.x, motion.y, rect.width * motion.scale, rect.height * motion.scale);
        ctx.globalAlpha = 1;
        rafRef.current = requestAnimationFrame(frame);
      };
      frame(start);
    };
    atlas.src = assetUrl('/art/pack-tear-v139.png');
    return () => {
      active = false;
      clearTimeout(timeout);
      cancelAnimationFrame(rafRef.current);
      atlas.onload = null;
      atlas.onerror = null;
    };
  }, []);

  return (
    <button type="button" className="tear-player" onClick={finish} aria-label="跳过开包动画">
      {!ready && <span className="tear-loading" role="status">准备拆封…</span>}
      <canvas ref={canvasRef} width={PACK_CANVAS.width} height={PACK_CANVAS.height}
        className="tear-canvas" aria-hidden="true" />
    </button>
  );
}
