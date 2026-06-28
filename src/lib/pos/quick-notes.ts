/**
 * Generate quick-note shortcuts based on a dish's description.
 *
 * Parses the description string (e.g. "Papa a la francesa, salchicha, queso
 * costeño, lechuga, papa ripio y salsas (tomate, tártara, piña)") and returns
 * relevant "Sin X" notes + "Para llevar".
 *
 * For add-on items (description contains "adicional" or "Porción de"),
 * only "Para llevar" is returned.
 */

/** Common ingredients to detect and offer "Sin X" for. */
const INGREDIENT_NOTES: { match: RegExp; note: string }[] = [
  { match: /lechuga/i, note: "Sin lechuga" },
  { match: /ripio/i, note: "Sin ripio" },
  { match: /jamón/i, note: "Sin jamón" },
  { match: /tocineta/i, note: "Sin tocineta" },
  { match: /queso costeño/i, note: "Sin queso costeño" },
  { match: /queso mozzarella/i, note: "Sin queso mozzarella" },
  { match: /papa a la francesa|papas a la francesa/i, note: "Sin papas" },
];

/**
 * Extract quick notes from a dish description.
 * Returns notes in a stable order: salsas first, then ingredients, then "Para llevar".
 */
export function getQuickNotes(description: string): string[] {
  const notes: string[] = [];

  const isAddon = /adicional|porción de/i.test(description);

  if (!isAddon) {
    // Extract sauces from "salsas (a, b, c)" pattern
    const salsasMatch = description.match(/salsas\s*\(([^)]+)\)/i);
    if (salsasMatch) {
      notes.push("Sin salsas");
      const sauces = salsasMatch[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const sauce of sauces) {
        notes.push(`Sin ${sauce}`);
      }
    }

    // Check for common ingredients
    for (const { match, note } of INGREDIENT_NOTES) {
      if (match.test(description) && !notes.includes(note)) {
        notes.push(note);
      }
    }
  }

  // Always include "Para llevar"
  notes.push("Para llevar");

  return notes;
}
