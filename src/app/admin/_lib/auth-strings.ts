import { t } from "./strings";

/**
 * Copy for the signed-out admin pages (login, forgot password, reset
 * password). These pages can be shown in Greek (default) or English via
 * `?lang=en`; the signed-in dashboard stays Greek-only.
 */
export type AuthLang = "el" | "en";

export function resolveAuthLang(value: unknown): AuthLang {
  return value === "en" ? "en" : "el";
}

/** Appends `lang=en` to an admin path when needed. */
export function withLang(path: string, lang: AuthLang): string {
  if (lang === "el") return path;
  return `${path}${path.includes("?") ? "&" : "?"}lang=en`;
}

export const PASSWORD_MIN_LENGTH = 12;
/** Supabase Auth (bcrypt) ignores anything beyond 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;

const el = {
  langLabel: "Γλώσσα",
  login: {
    ...t.login,
    forgot: "Ξέχασες τον κωδικό σου;",
    resetSuccess: "Ο κωδικός άλλαξε. Συνδεθείτε με τον νέο σας κωδικό.",
  },
  forgot: {
    metaTitle: "Επαναφορά κωδικού",
    title: "Επαναφορά κωδικού",
    intro: "Εισάγετε το email διαχειριστή και θα σας στείλουμε σύνδεσμο επαναφοράς κωδικού.",
    email: "Email",
    submit: "Αποστολή συνδέσμου",
    submitting: "Αποστολή…",
    back: "Επιστροφή στη σύνδεση",
    sent: "Αν το email ανήκει σε λογαριασμό διαχειριστή, θα λάβετε σε λίγα λεπτά έναν σύνδεσμο επαναφοράς. Ελέγξτε και τον φάκελο ανεπιθύμητης αλληλογραφίας.",
    sendAnother: "Αποστολή σε άλλο email",
    invalidEmail: "Εισάγετε ένα έγκυρο email.",
    notConfigured: "Η επαναφορά κωδικού δεν έχει ρυθμιστεί ακόμη. Επικοινωνήστε με τον προγραμματιστή.",
  },
  reset: {
    metaTitle: "Νέος κωδικός",
    title: "Ορίστε νέο κωδικό",
    intro: "Επιλέξτε έναν νέο, ισχυρό κωδικό για τον λογαριασμό διαχειριστή.",
    password: "Νέος κωδικός",
    confirm: "Επιβεβαίωση νέου κωδικού",
    hint: `Τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες.`,
    show: "Εμφάνιση κωδικού",
    hide: "Απόκρυψη κωδικού",
    submit: "Ενημέρωση κωδικού",
    submitting: "Ενημέρωση…",
    success: "Ο κωδικός άλλαξε. Μεταφορά στη σύνδεση…",
    back: "Επιστροφή στη σύνδεση",
    invalidTitle: "Ο σύνδεσμος δεν είναι έγκυρος",
    invalidLink:
      "Ο σύνδεσμος επαναφοράς δεν είναι έγκυρος, έχει λήξει ή έχει ήδη χρησιμοποιηθεί. Ζητήστε νέο σύνδεσμο.",
    requestNew: "Αίτηση νέου συνδέσμου",
    checking: "Έλεγχος συνδέσμου…",
    errors: {
      short: `Ο κωδικός πρέπει να έχει τουλάχιστον ${PASSWORD_MIN_LENGTH} χαρακτήρες.`,
      long: "Ο κωδικός είναι πολύ μεγάλος (έως 72 χαρακτήρες).",
      mismatch: "Οι κωδικοί δεν ταιριάζουν.",
      samePassword: "Ο νέος κωδικός πρέπει να είναι διαφορετικός από τον παλιό.",
      weak: "Ο κωδικός είναι πολύ αδύναμος. Χρησιμοποιήστε μεγαλύτερο ή πιο σύνθετο κωδικό.",
      rateLimited: "Πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.",
      generic: "Η αλλαγή κωδικού απέτυχε. Δοκιμάστε ξανά.",
    },
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
type AuthStrings = Widen<typeof el>;

const en: AuthStrings = {
  langLabel: "Language",
  login: {
    title: "Administrator sign in",
    subtitle: "For authorised OurWay administrators only.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in…",
    invalid: "Incorrect email or password.",
    forbidden: "Your account does not have administrator access.",
    notConfigured: "The database (Supabase) has not been configured yet. Fill in .env.local — see the README.",
    rateLimited: "Too many attempts. Please try again in a few minutes.",
    generic: "Sign in failed. Please try again.",
    forgot: "Forgot your password?",
    resetSuccess: "Your password has been changed. Sign in with your new password.",
  },
  forgot: {
    metaTitle: "Reset password",
    title: "Reset your password",
    intro: "Enter your administrator email address and we will send you a password reset link.",
    email: "Email",
    submit: "Send Reset Link",
    submitting: "Sending…",
    back: "Back to Login",
    sent: "If this email belongs to an administrator account, you will receive a reset link in a few minutes. Please also check your spam folder.",
    sendAnother: "Use a different email",
    invalidEmail: "Please enter a valid email address.",
    notConfigured: "Password reset has not been set up yet. Please contact the developer.",
  },
  reset: {
    metaTitle: "New password",
    title: "Choose a new password",
    intro: "Choose a new, strong password for your administrator account.",
    password: "New password",
    confirm: "Confirm new password",
    hint: `At least ${PASSWORD_MIN_LENGTH} characters.`,
    show: "Show password",
    hide: "Hide password",
    submit: "Update Password",
    submitting: "Updating…",
    success: "Password updated. Redirecting to sign in…",
    back: "Back to Login",
    invalidTitle: "This link is not valid",
    invalidLink: "This password reset link is invalid, has expired or has already been used. Please request a new one.",
    requestNew: "Request a new link",
    checking: "Checking your link…",
    errors: {
      short: `Your password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
      long: "Your password is too long (72 characters maximum).",
      mismatch: "The passwords do not match.",
      samePassword: "Your new password must be different from your old one.",
      weak: "This password is too weak. Use a longer or more complex password.",
      rateLimited: "Too many attempts. Please try again in a few minutes.",
      generic: "The password could not be changed. Please try again.",
    },
  },
};

export const authStrings: Record<AuthLang, AuthStrings> = { el, en };
export type { AuthStrings };
