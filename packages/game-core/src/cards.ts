import type { CardDefinition, CardId, Month } from "./model";

const card = (
  id: CardId,
  month: Month | null,
  category: CardDefinition["category"],
  label: string,
  tags: CardDefinition["tags"],
  piValue: CardDefinition["piValue"] = 0,
): CardDefinition => Object.freeze({ id, month, category, label, tags: Object.freeze([...tags]), piValue });

export const CARDS: readonly CardDefinition[] = Object.freeze([
  card("m01-bright", 1, "bright", "Pine bright", ["bright"]),
  card("m01-red-poetry", 1, "ribbon", "Pine red poetry ribbon", ["ribbon", "red-poetry"]),
  card("m01-pi-a", 1, "pi", "Pine pi A", ["pi"], 1),
  card("m01-pi-b", 1, "pi", "Pine pi B", ["pi"], 1),

  card("m02-bird", 2, "animal", "Plum bird", ["animal", "bird"]),
  card("m02-red-poetry", 2, "ribbon", "Plum red poetry ribbon", ["ribbon", "red-poetry"]),
  card("m02-pi-a", 2, "pi", "Plum pi A", ["pi"], 1),
  card("m02-pi-b", 2, "pi", "Plum pi B", ["pi"], 1),

  card("m03-bright", 3, "bright", "Cherry bright", ["bright"]),
  card("m03-red-poetry", 3, "ribbon", "Cherry red poetry ribbon", ["ribbon", "red-poetry"]),
  card("m03-pi-a", 3, "pi", "Cherry pi A", ["pi"], 1),
  card("m03-pi-b", 3, "pi", "Cherry pi B", ["pi"], 1),

  card("m04-bird", 4, "animal", "Wisteria bird", ["animal", "bird"]),
  card("m04-plain-ribbon", 4, "ribbon", "Wisteria plain ribbon", ["ribbon", "plain-ribbon"]),
  card("m04-pi-a", 4, "pi", "Wisteria pi A", ["pi"], 1),
  card("m04-pi-b", 4, "pi", "Wisteria pi B", ["pi"], 1),

  card("m05-animal", 5, "animal", "Iris animal", ["animal"]),
  card("m05-plain-ribbon", 5, "ribbon", "Iris plain ribbon", ["ribbon", "plain-ribbon"]),
  card("m05-pi-a", 5, "pi", "Iris pi A", ["pi"], 1),
  card("m05-pi-b", 5, "pi", "Iris pi B", ["pi"], 1),

  card("m06-animal", 6, "animal", "Peony butterfly", ["animal"]),
  card("m06-blue-ribbon", 6, "ribbon", "Peony blue ribbon", ["ribbon", "blue-ribbon"]),
  card("m06-pi-a", 6, "pi", "Peony pi A", ["pi"], 1),
  card("m06-pi-b", 6, "pi", "Peony pi B", ["pi"], 1),

  card("m07-boar", 7, "animal", "Bush clover boar", ["animal", "boar"]),
  card("m07-plain-ribbon", 7, "ribbon", "Bush clover plain ribbon", ["ribbon", "plain-ribbon"]),
  card("m07-pi-a", 7, "pi", "Bush clover pi A", ["pi"], 1),
  card("m07-pi-b", 7, "pi", "Bush clover pi B", ["pi"], 1),

  card("m08-bright", 8, "bright", "Pampas bright", ["bright"]),
  card("m08-bird", 8, "animal", "Pampas geese", ["animal", "bird"]),
  card("m08-pi-a", 8, "pi", "Pampas pi A", ["pi"], 1),
  card("m08-pi-b", 8, "pi", "Pampas pi B", ["pi"], 1),

  card("m09-cup", 9, "animal", "Chrysanthemum cup", ["animal", "cup"]),
  card("m09-blue-ribbon", 9, "ribbon", "Chrysanthemum blue ribbon", ["ribbon", "blue-ribbon"]),
  card("m09-pi-a", 9, "pi", "Chrysanthemum pi A", ["pi"], 1),
  card("m09-pi-b", 9, "pi", "Chrysanthemum pi B", ["pi"], 1),

  card("m10-animal", 10, "animal", "Maple deer", ["animal"]),
  card("m10-blue-ribbon", 10, "ribbon", "Maple blue ribbon", ["ribbon", "blue-ribbon"]),
  card("m10-pi-a", 10, "pi", "Maple pi A", ["pi"], 1),
  card("m10-pi-b", 10, "pi", "Maple pi B", ["pi"], 1),

  card("m11-bright", 11, "bright", "Paulownia bright", ["bright"]),
  card("m11-pi-a", 11, "pi", "Paulownia pi A", ["pi"], 1),
  card("m11-pi-b", 11, "pi", "Paulownia pi B", ["pi"], 1),
  card("m11-double-pi", 11, "pi", "Paulownia colored double pi", ["pi", "double-pi", "colored-pi"], 2),

  card("m12-rain-bright", 12, "bright", "Willow rain bright", ["bright", "rain-bright"]),
  card("m12-animal", 12, "animal", "Willow swallow", ["animal"]),
  card("m12-rain-ribbon", 12, "ribbon", "Willow rain ribbon", ["ribbon", "rain-ribbon"]),
  card("m12-double-pi", 12, "pi", "Willow double pi", ["pi", "double-pi"], 2),

  // Product-selected service cards: neither card belongs to a month or matches
  // a table card. Each is captured immediately and counts as two pi.
  card("bonus-2pi-a", null, "pi", "Double-pi bonus A", ["pi", "double-pi", "bonus", "service", "joker"], 2),
  card("bonus-2pi-b", null, "pi", "Double-pi bonus B", ["pi", "double-pi", "bonus", "service", "joker"], 2),
]);

export const CARD_BY_ID: ReadonlyMap<CardId, CardDefinition> = new Map(
  CARDS.map((definition) => [definition.id, definition]),
);

export const BOAR_CARD_ID = "m07-boar";
export const CUP_CARD_ID = "m09-cup";
export const BONUS_CARD_IDS = ["bonus-2pi-a", "bonus-2pi-b"] as const;

export function getCard(cardId: CardId): CardDefinition {
  const definition = CARD_BY_ID.get(cardId);
  if (!definition) throw new Error(`Unknown card: ${cardId}`);
  return definition;
}

export function isBonusCard(cardId: CardId): boolean {
  return getCard(cardId).tags.includes("bonus");
}

export function getMatchingMonth(cardId: CardId): Month {
  const definition = getCard(cardId);
  if (definition.month === null) throw new Error(`Bonus card has no matching month: ${cardId}`);
  return definition.month;
}
