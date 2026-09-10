'use client';
import { useEffect, useRef } from 'react';
import {
  Sparkles,
  Crosshair,
  Layers3,
  CloudFog,
  Binoculars,
  Wrench,
  Target,
  Radio,
} from 'lucide-react';
import { CARDS, modelOf, type CardId } from './engine';
import { loadArt, drawSprite, cardFrame, soldierEquipment } from './art';
export function SpriteArt({
  id,
  className = '',
}: {
  id: CardId;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    card = CARDS[id];
  useEffect(() => {
    let live = true;
    if (card.type === 'skill') return;
    void loadArt()
      .then((art) => {
        if (!live) return;
        const ctx = ref.current?.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 240, 150);
        ctx.imageSmoothingEnabled = false;
        const uniform = card.uniform
          ? ['marine', 'police', 'recon', 'assault'].indexOf(card.uniform)
          : -1;
        const frame =
          uniform >= 0 ? art.reactions[1][uniform] : cardFrame(art, card.atlas);
        if (card.members) {
          for (const x of [90, 146]) {
            drawSprite(ctx, frame, x, 145, 140, 105);
            const item = soldierEquipment(art, id);
            if (item)
              drawSprite(
                ctx,
                item,
                x + (modelOf(id) === 'medic' ? -12 : 8),
                modelOf(id) === 'mortar'
                  ? 140
                  : modelOf(id) === 'medic'
                    ? 115
                    : 101,
                modelOf(id) === 'medic'
                  ? 20
                  : modelOf(id) === 'mortar'
                    ? 33
                    : 50,
                modelOf(id) === 'medic'
                  ? 23
                  : modelOf(id) === 'mortar'
                    ? 39
                    : 21,
              );
          }
        } else drawSprite(ctx, frame, 120, 140, 192, 112);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, card]);
  if (card.type === 'unit')
    return (
      <canvas
        aria-hidden="true"
        className={className}
        width="240"
        height="150"
        ref={ref}
      />
    );
  const Icon =
    modelOf(id) === 'morale'
      ? Sparkles
      : modelOf(id) === 'artillery'
        ? Crosshair
        : modelOf(id) === 'supply'
          ? Layers3
          : modelOf(id) === 'smoke'
            ? CloudFog
            : modelOf(id) === 'recon'
              ? Binoculars
              : modelOf(id) === 'repair'
                ? Wrench
                : modelOf(id) === 'precision'
                  ? Target
                  : Radio;
  return (
    <div className={'skill-art-icon ' + className} aria-hidden="true">
      <Icon />
    </div>
  );
}
