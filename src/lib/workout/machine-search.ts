import { GYM_MACHINES } from "./machines";

function normalize(value: string) {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function oneEditApart(left: string, right: string) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let edits = 0, i = 0, j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (left.length >= right.length) i++;
    if (right.length >= left.length) j++;
  }
  return edits + (left.length - i) + (right.length - j) <= 1;
}

const ALIASES: Record<string, string> = {
  assisted_pullup: "гравитрон подтягивания",
  assisted_dips: "гравитрон брусья",
  elliptical: "эллипс орбитрек",
  treadmill_incline: "дорожка ходьба бег",
  pec_deck: "бабочка пекдек грудь",
  cable_crunch: "молитва пресс",
  smith_squat: "смит присед",
  cable_crossover: "кроссовер грудь",
};

const index = GYM_MACHINES.map((machine) => ({
  machine,
  name: normalize(`${machine.name} ${machine.nameEn ?? ""}`),
  terms: normalize(`${machine.name} ${machine.nameEn ?? ""} ${machine.targetMuscles.join(" ")} ${ALIASES[machine.id] ?? ""}`).split(" "),
}));

export function searchMachines(query: string, category = "all") {
  const normalized = normalize(query);
  const tokens = normalized.split(" ").filter(Boolean);
  return index
    .filter(({ machine, terms }) => (category === "all" || category === machine.category)
      && tokens.every((token) => terms.some((term) => term.includes(token) || (token.length >= 4 && oneEditApart(token, term)))))
    .sort((a, b) => Number(b.name.includes(normalized)) - Number(a.name.includes(normalized)))
    .map(({ machine }) => machine);
}
