import Image from "next/image";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * Brand mark. With `useLogo`, renders the official OurWay logo as a circular
 * badge (the supplied file has a white background and a round composition).
 * Otherwise — or if no logo is configured — a typographic wordmark.
 */
export function Wordmark({
  className,
  useLogo = false,
  accent = true,
}: {
  className?: string;
  useLogo?: boolean;
  /** Colour "Way" in the accent; turn off when the wordmark is a tinted backdrop. */
  accent?: boolean;
}) {
  const { logo } = siteConfig;
  if (useLogo && logo.src) {
    return (
      <span className={cn("block size-14 overflow-hidden rounded-full bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]", className)}>
        <Image
          src={logo.src}
          alt="OurWay — Alternative Experiences"
          width={logo.width}
          height={logo.height}
          // Badge is at most ~96px; request enough pixels for 3× phone screens.
          sizes="128px"
          quality={90}
          className="size-full scale-[1.06] object-contain"
          priority
        />
      </span>
    );
  }
  return (
    <span className={cn("font-display tracking-[-0.02em]", className)}>
      Our<span className={cn("italic", accent && "text-lichen")}>Way</span>
    </span>
  );
}
