export type HeroRole = "TANK" | "SUPPORT" | "DPS";

export interface HeroData {
  id: string;
  nameEn: string;
  nameFr: string;
  gameRole: HeroRole;
  imageUrl: string;
}

export const HEROES: HeroData[] = [
  // Tank — green icon
  { id: "baby", nameEn: "Baby", nameFr: "Baby", gameRole: "TANK", imageUrl: "/baby.webp" },
  { id: "bardock", nameEn: "Bardock", nameFr: "Bardock", gameRole: "TANK", imageUrl: "/bardock.webp" },
  { id: "caulifla", nameEn: "Caulifla", nameFr: "Caulifla", gameRole: "TANK", imageUrl: "/caulifla.webp" },
  { id: "cell", nameEn: "Cell", nameFr: "Cell", gameRole: "TANK", imageUrl: "/cell.webp" },
  { id: "cooler", nameEn: "Cooler", nameFr: "Cooler", gameRole: "TANK", imageUrl: "/cooler.webp" },
  { id: "vegeta-god", nameEn: "Vegeta (SSJ God)", nameFr: "Vegeta (SSJ God)", gameRole: "TANK", imageUrl: "/vegeta-god.webp" },
  { id: "vegeta-ssj4", nameEn: "Vegeta (SSJ4)", nameFr: "Vegeta (SSJ4)", gameRole: "TANK", imageUrl: "/vegeta-ssj4.webp" },
  { id: "vegetassj", nameEn: "Vegeta (SSJ)", nameFr: "Vegeta (SSJ)", gameRole: "TANK", imageUrl: "/vegetassj.webp" },
  { id: "zamasu", nameEn: "Zamasu", nameFr: "Zamasu", gameRole: "TANK", imageUrl: "/zamasu.webp" },

  // Support — blue icon
  { id: "buu-gentil", nameEn: "Good Buu", nameFr: "Buu (gentil)", gameRole: "SUPPORT", imageUrl: "/buu-gentil.webp" },
  { id: "c17", nameEn: "C-17", nameFr: "C-17", gameRole: "SUPPORT", imageUrl: "/c17.webp" },
  { id: "freezer-1er", nameEn: "Frieza (1st Form)", nameFr: "Freezer (1re forme)", gameRole: "SUPPORT", imageUrl: "/freezer-1er.webp" },
  { id: "freezer-final", nameEn: "Frieza (Final Form)", nameFr: "Freezer (forme finale)", gameRole: "SUPPORT", imageUrl: "/freezer-final.webp" },
  { id: "gohan-petit", nameEn: "Gohan (Kid)", nameFr: "Gohan (enfant)", gameRole: "SUPPORT", imageUrl: "/gohan-petit.webp" },
  { id: "gohan-ultime", nameEn: "Gohan (Ultimate)", nameFr: "Gohan (ultime)", gameRole: "SUPPORT", imageUrl: "/gohan-ultime.webp" },
  { id: "gotenks", nameEn: "Gotenks", nameFr: "Gotenks", gameRole: "SUPPORT", imageUrl: "/gotenks.webp" },
  { id: "hit", nameEn: "Hit", nameFr: "Hit", gameRole: "SUPPORT", imageUrl: "/hit.webp" },
  { id: "kid-buu", nameEn: "Kid Buu", nameFr: "Boo (petit)", gameRole: "SUPPORT", imageUrl: "/kid-buu.webp" },
  { id: "krillin", nameEn: "Krillin", nameFr: "Krilin", gameRole: "SUPPORT", imageUrl: "/krillin.webp" },

  // DPS — red icon
  { id: "bojack", nameEn: "Bojack", nameFr: "Bojack", gameRole: "DPS", imageUrl: "/bojack.webp" },
  { id: "broly-dbz", nameEn: "Broly (DBZ)", nameFr: "Broly (DBZ)", gameRole: "DPS", imageUrl: "/broly-dbz.webp" },
  { id: "c18", nameEn: "C-18", nameFr: "C-18", gameRole: "DPS", imageUrl: "/c18.webp" },
  { id: "dabra", nameEn: "Dabra", nameFr: "Dabra", gameRole: "DPS", imageUrl: "/dabra.webp" },
  { id: "gamma", nameEn: "Gamma", nameFr: "Gamma", gameRole: "DPS", imageUrl: "/gamma.webp" },
  { id: "godku", nameEn: "Goku (SSJ God)", nameFr: "Goku (SSJ God)", gameRole: "DPS", imageUrl: "/godku.webp" },
  { id: "goku-daima", nameEn: "Goku (Daima)", nameFr: "Goku (Daima)", gameRole: "DPS", imageUrl: "/goku-daima.webp" },
  { id: "goku-ssj3", nameEn: "Goku (SSJ3)", nameFr: "Goku (SSJ3)", gameRole: "DPS", imageUrl: "/goku-ssj3.webp" },
  { id: "gokussj", nameEn: "Goku (SSJ)", nameFr: "Goku (SSJ)", gameRole: "DPS", imageUrl: "/gokussj.webp" },
  { id: "kale", nameEn: "Kale", nameFr: "Kale", gameRole: "DPS", imageUrl: "/kale.webp" },
  { id: "kefla", nameEn: "Kefla", nameFr: "Kefla", gameRole: "DPS", imageUrl: "/kefla.webp" },
  { id: "kidgoku", nameEn: "Kid Goku", nameFr: "Goku (enfant)", gameRole: "DPS", imageUrl: "/kidgoku.webp" },
  { id: "piccolo", nameEn: "Piccolo", nameFr: "Piccolo", gameRole: "DPS", imageUrl: "/piccolo.webp" },
  { id: "toppo", nameEn: "Toppo", nameFr: "Toppo", gameRole: "DPS", imageUrl: "/toppo.webp" },
  { id: "trunks-ssj", nameEn: "Trunks (SSJ)", nameFr: "Trunks (SSJ)", gameRole: "DPS", imageUrl: "/trunks-ssj.webp" },
  { id: "uub", nameEn: "Uub", nameFr: "Oob", gameRole: "DPS", imageUrl: "/uub.webp" },
  { id: "vegeto-ssj", nameEn: "Vegito (SSJ)", nameFr: "Vegeto (SSJ)", gameRole: "DPS", imageUrl: "/vegeto-ssj.webp" },
];

export function getHeroByName(nameEn: string): HeroData | undefined {
  return HEROES.find((h) => h.nameEn === nameEn);
}

export function getHeroesForApi() {
  return HEROES.map((h) => ({
    id: h.id,
    nameEn: h.nameEn,
    nameFr: h.nameFr,
    gameRole: h.gameRole,
    imageUrl: h.imageUrl,
  }));
}
