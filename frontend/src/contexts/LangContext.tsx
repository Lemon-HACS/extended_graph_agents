import { createContext, useContext } from "react";
import type { Translations } from "../utils/i18n";
import { defaultTranslations } from "../utils/i18n";

export const LangContext = createContext<Translations>(defaultTranslations);

export function useLang(): Translations {
  return useContext(LangContext);
}
