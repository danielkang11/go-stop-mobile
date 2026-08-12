import type { UiCard } from "./uiTypes";

export interface FieldSize {
  width: number;
  height: number;
}

export interface CardPlacement {
  card: UiCard;
  x: number;
  y: number;
  rotation: number;
  zIndex: number;
}

export interface TableLayout {
  cardWidth: number;
  cardHeight: number;
  stockX: number;
  stockY: number;
  cards: readonly CardPlacement[];
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export function hashCardId(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createTableLayout(cards: readonly UiCard[], field: FieldSize): TableLayout {
  const width = Math.max(180, field.width);
  const height = Math.max(150, field.height);
  const cardWidth = 46;
  const cardHeight = 70;
  const stockX = (width - cardWidth) / 2;
  const stockY = (height - cardHeight) / 2;
  const xReach = Math.max(50, width / 2 - cardWidth / 2 - 15);
  const yReach = Math.max(42, height / 2 - cardHeight / 2 - 13);
  const sorted = [...cards].sort((left, right) => {
    const leftMonth = left.month ?? 99;
    const rightMonth = right.month ?? 99;
    return leftMonth - rightMonth || left.id.localeCompare(right.id);
  });

  const placements = sorted.map((card, index): CardPlacement => {
    const hash = hashCardId(card.id);
    const jitter = (((hash >>> 8) % 101) / 100 - 0.5) * 0.34;
    const angle = -Math.PI / 2 + index * GOLDEN_ANGLE + jitter;
    const ring = index < 7 ? 0.67 : 0.84 + ((hash >>> 17) % 11) / 100;
    const rawX = stockX + Math.cos(angle) * xReach * ring;
    const rawY = stockY + Math.sin(angle) * yReach * ring;
    return {
      card,
      x: clamp(rawX, 6, width - cardWidth - 6),
      y: clamp(rawY, 6, height - cardHeight - 6),
      rotation: ((hash % 1701) / 100) - 8.5,
      zIndex: index + 2
    };
  });

  return { cardWidth, cardHeight, stockX, stockY, cards: placements };
}

export function eventTargetForCard(card: UiCard, layout: TableLayout, field: FieldSize): CardPlacement {
  const existing = layout.cards.find((placement) => placement.card.id === card.id);
  if (existing) return existing;
  const hash = hashCardId(card.id);
  const width = Math.max(180, field.width);
  const height = Math.max(150, field.height);
  const angle = ((hash % 3600) / 3600) * Math.PI * 2;
  const xReach = Math.max(50, width / 2 - layout.cardWidth / 2 - 15);
  const yReach = Math.max(42, height / 2 - layout.cardHeight / 2 - 13);
  return {
    card,
    x: clamp(layout.stockX + Math.cos(angle) * xReach * 0.7, 6, width - layout.cardWidth - 6),
    y: clamp(layout.stockY + Math.sin(angle) * yReach * 0.7, 6, height - layout.cardHeight - 6),
    rotation: ((hash % 1701) / 100) - 8.5,
    zIndex: 100
  };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
