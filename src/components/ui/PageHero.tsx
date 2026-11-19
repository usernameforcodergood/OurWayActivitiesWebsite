import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { MediaKey } from "@/content/media";
import type { CmsImage } from "@/lib/cms/types";
import { TextReveal } from "@/components/animations/TextReveal";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { BackgroundVideo, type BackgroundVideoSource } from "@/components/animations/BackgroundVideo";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

type Props = {
  locale: Locale;
  eyebrow: string;
  title: string;
  lead?: string;
  image?: MediaKey | CmsImage | null;
  /** Optional call to action under the lead. */
  actions?: ReactNode;
  /** Optional ambient film playing behind the title block (from the very top of the page). */
  video?: BackgroundVideoSource;
};

const topPadding = "pt-[calc(var(--header-h)+clamp(3rem,10vw,8rem))]";

/** Shared opening for inner pages: editorial title, lead, wide image reveal. */
export function PageHero({ locale, eyebrow, title, lead, image, actions, video }: Props) {
  const intro = (
    <div className="container-x grid gap-10 md:grid-cols-12 md:items-end">
      <div className="md:col-span-8">
        <SectionLabel className={video ? "text-bone/80" : "text-fog"}>{eyebrow}</SectionLabel>
        <TextReveal as="h1" trigger="mount" delay={0.1} className="text-display-lg mt-8 max-w-[15ch]">
          {title}
        </TextReveal>
      </div>
      {(lead || actions) && (
        <div className="md:col-span-4">
          {lead && <p className={cn("text-lead", video ? "text-bone/90" : "text-bone/80")}>{lead}</p>}
          {actions && <div className="mt-8">{actions}</div>}
        </div>
      )}
    </div>
  );

  return (
    <section className={cn("bg-ink text-bone", !video && topPadding)}>
      {video ? (
        // The film fills the title area; its bottom gradient ends in solid ink,
        // so the image below sits on the same ink as before.
        <div className={cn("relative isolate pb-16 md:pb-24", topPadding)}>
          <BackgroundVideo {...video} priority className="-z-10" />
          {intro}
        </div>
      ) : (
        intro
      )}
      {image && (
        <div className={cn("container-x", !video && "mt-16 md:mt-24")}>
          <ImageReveal
            image={image}
            locale={locale}
            priority
            sizes="(min-width: 1536px) 1440px, 100vw"
            direction="up"
            parallax={10}
            className="aspect-[4/3] md:aspect-[21/9]"
          />
        </div>
      )}
    </section>
  );
}
