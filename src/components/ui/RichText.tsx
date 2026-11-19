import { richTextToSafeHtml } from "@/lib/cms/richTextSanitize";
import { cn } from "@/lib/utils";

/**
 * Renders a formatted description (editor HTML, or older plain text) on the server.
 * The value is sanitised against a strict allowlist right here, on every render,
 * so nothing unsafe can reach the page even if the database row was edited by hand.
 */
export function RichText({ value, className }: { value: string | null | undefined; className?: string }) {
  const html = richTextToSafeHtml(value);
  if (!html) return null;
  return <div className={cn("rich-text", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
