import Anthropic from "@anthropic-ai/sdk";

// Turns a failed Claude API call into a clear Hebrew sentence for the
// teacher, plus whether pressing "try again" can plausibly help. The raw
// error is logged server-side so the cause shows up in the Vercel logs.
export function explainClaudeError(e: unknown): { message: string; retryable: boolean } {
  console.error("[claude] request failed:", e);

  if (e instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      message: "קלוד לא סיים לבדוק בזמן (ההגשה ארוכה או שהשירות עמוס). אפשר לנסות שוב.",
      retryable: true,
    };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return {
      message: "השרת לא הצליח להתחבר לשירות של קלוד. כנראה תקלה רגעית ברשת. אפשר לנסות שוב.",
      retryable: true,
    };
  }
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return {
      message: "מפתח ה-API של קלוד בשרת לא תקין או שאין לו הרשאה. צריך לעדכן את ANTHROPIC_API_KEY בהגדרות הפריסה ב-Vercel.",
      retryable: false,
    };
  }
  if (e instanceof Anthropic.NotFoundError) {
    return {
      message: "שם המודל של קלוד שמוגדר באתר לא נמצא בחשבון ה-API. צריך לעדכן את הגדרת המודל.",
      retryable: false,
    };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return {
      message: "הגענו למגבלת הקריאות של קלוד לדקה. כדאי לחכות דקה ולנסות שוב.",
      retryable: true,
    };
  }
  if (e instanceof Anthropic.BadRequestError) {
    const raw = e.message.toLowerCase();
    if (raw.includes("credit") || raw.includes("billing") || raw.includes("balance")) {
      return {
        message: "נגמרה יתרת הקרדיט בחשבון ה-API של קלוד. צריך לטעון קרדיט בחשבון אנתרופיק ואז לנסות שוב.",
        retryable: false,
      };
    }
    if (raw.includes("too long") || raw.includes("too many tokens")) {
      return {
        message: "ההגשה ארוכה מדי לבדיקה אוטומטית בבת אחת.",
        retryable: false,
      };
    }
    return {
      message: "שירות קלוד דחה את הבקשה. הפרטים נשמרו ביומן השרת.",
      retryable: false,
    };
  }
  if (e instanceof Anthropic.APIError && (e.status === 529 || (e.status ?? 0) >= 500)) {
    return {
      message: "השירות של קלוד עמוס או בתקלה זמנית. אפשר לנסות שוב בעוד רגע.",
      retryable: true,
    };
  }
  return {
    message: "הבדיקה האוטומטית נכשלה בשרת. הפרטים נשמרו ביומן השרת. אפשר לנסות שוב.",
    retryable: true,
  };
}
