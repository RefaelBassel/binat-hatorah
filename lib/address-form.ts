// The user's chosen form of address — stored in users.address_form and
// injected into EVERY Claude prompt, so the voice stays consistent.
export type AddressForm = "f" | "m" | "neutral";

export const ADDRESS_OPTIONS: { value: AddressForm; label: string; example: string }[] = [
  { value: "f", label: "לשון נקבה", example: "״נסי, קראי, את״" },
  { value: "m", label: "לשון זכר", example: "״נסה, קרא, אתה״" },
  { value: "neutral", label: "לשון ניטרלית", example: "״נסו, קראו, אפשר״" },
];

export function addressInstruction(form: string | null | undefined): string {
  switch (form) {
    case "f":
      return 'פנייה בלשון נקבה יחידה ("נסי", "קראי", "את") — כך ביקש/ה המשתמש/ת. היה/י עקבי/ת בזה לכל אורך השיחה.';
    case "m":
      return 'פנייה בלשון זכר יחיד ("נסה", "קרא", "אתה") — כך ביקש/ה המשתמש/ת. היה/י עקבי/ת בזה לכל אורך השיחה.';
    default:
      return 'פנייה בגוף שני רבים או בניסוח ניטרלי ("נסו", "קראו", "אפשר לבדוק") — בלי לשון נקבה או זכר בלעדית. עקביות מלאה.';
  }
}
