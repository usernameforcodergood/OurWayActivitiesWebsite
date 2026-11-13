import { locale as getLocaleParam } from "next/root-params";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath } from "@/i18n/routes";
import { ButtonLink } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ImageReveal } from "@/components/animations/ImageReveal";

export default async function NotFound() {
  const raw = await getLocaleParam();
  const locale = raw && hasLocale(raw) ? raw : defaultLocale;
  const t = (await getDictionary(locale)).notFound;

  return (
    <section className="bg-ink pb-24 pt-[calc(var(--header-h)+5rem)] text-bone">
      <div className="container-x grid items-center gap-12 md:grid-cols-12">
        <div className="md:col-span-6">
          <SectionLabel className="text-fog">{t.eyebrow}</SectionLabel>
          <h1 className="text-display-lg mt-8">{t.title}</h1>
          <p className="text-lead mt-6 text-bone/75">{t.body}</p>
          <ButtonLink href={localePath(locale)} className="mt-10">
            {t.cta}
          </ButtonLink>
        </div>
        <ImageReveal image="stoneBridge" locale={locale} priority sizes="(min-width: 768px) 45vw, 100vw" className="aspect-[4/3] md:col-span-6" />
      </div>
    </section>
  );
}
