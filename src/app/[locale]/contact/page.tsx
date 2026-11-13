import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Mail, Phone, MapPin } from "lucide-react";
import { hasLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { localePath, routes } from "@/i18n/routes";
import { buildMetadata } from "@/lib/metadata";
import { siteConfig } from "@/lib/site";
import { PageHero } from "@/components/ui/PageHero";
import { ImageReveal } from "@/components/animations/ImageReveal";
import { ContactForm } from "@/components/forms/ContactForm";
import { pad } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/contact">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(locale)) return {};
  const t = await getDictionary(locale);
  return buildMetadata({ locale, path: routes.contact, ...t.meta.pages.contact });
}

export default async function ContactPage({ params }: PageProps<"/[locale]/contact">) {
  const { locale } = await params;
  if (!hasLocale(locale)) notFound();
  const t = await getDictionary(locale);
  const c = t.contact;
  const { email, phone, address } = siteConfig.contact;
  const details = [
    email && { icon: Mail, label: c.email, value: email, href: `mailto:${email}` },
    phone && { icon: Phone, label: c.phone, value: phone, href: `tel:${phone.replace(/\s/g, "")}` },
    address && { icon: MapPin, label: c.address, value: address, href: undefined },
  ].filter((d): d is { icon: typeof Mail; label: string; value: string; href: string | undefined } => Boolean(d));

  return (
    <>
      <PageHero locale={locale} eyebrow={c.hero.eyebrow} title={c.hero.title} lead={c.hero.lead} />

      <section id="inquiry" className="bg-ink pb-[var(--section-y)] pt-16 text-bone md:pt-24">
        <div className="container-x grid gap-12 lg:grid-cols-12 lg:gap-10">
          <aside className="lg:col-span-4">
            <ImageReveal
              image="villageSteps"
              locale={locale}
              sizes="(min-width: 1024px) 30vw, 100vw"
              direction="up"
              className="aspect-[4/3] lg:aspect-[4/5]"
            />
            <h2 className="text-eyebrow mt-12 font-sans text-fog">{c.asideTitle}</h2>
            <ol className="mt-6 space-y-6">
              {c.steps.map((s, i) => (
                <li key={s.title} className="grid grid-cols-[2.5rem_1fr] gap-3 border-t border-bone/15 pt-5">
                  <span className="text-sm tabular-nums text-lichen">{pad(i + 1)}</span>
                  <div>
                    <p className="font-display text-2xl">{s.title}</p>
                    <p className="mt-1 text-sm text-fog">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <h2 className="text-eyebrow mt-12 font-sans text-fog">{c.detailsTitle}</h2>
            {details.length ? (
              <ul className="mt-5 space-y-3">
                {details.map(({ icon: Icon, label, value, href }) => (
                  <li key={label} className="flex items-center gap-3">
                    <Icon aria-hidden className="size-4 text-lichen" />
                    <span className="sr-only">{label}:</span>
                    {href ? (
                      <a href={href} className="inline-flex min-h-10 items-center hover:text-lichen">
                        {value}
                      </a>
                    ) : (
                      <span>{value}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 text-sm text-fog">{c.detailsPending}</p>
            )}
          </aside>

          <div className="on-light bg-limestone p-6 sm:p-10 lg:col-span-8 lg:p-14">
            <ContactForm locale={locale} t={c.form} privacyHref={localePath(locale, routes.privacy)} />
          </div>
        </div>
      </section>
    </>
  );
}
