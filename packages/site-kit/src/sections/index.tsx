import type { ReactElement } from "react";
import type { Page, Section, SectionOf, SectionType, SiteConfig } from "../schema/index.ts";

/**
 * Section components. They are rendered to static HTML at build time (no client JS),
 * so they must be pure functions of their props. React escapes all text content.
 */

function Cta({ href, label, kind = "primary" }: { href: string; label: string; kind?: "primary" | "secondary" }) {
  return (
    <a className={`sk-btn sk-btn--${kind}`} href={href}>
      {label}
    </a>
  );
}

function Hero(s: SectionOf<"hero">) {
  return (
    <section className={`sk-section sk-hero sk-hero--${s.variant}`}>
      <div className="sk-container sk-hero__inner">
        <div className="sk-hero__copy">
          {s.eyebrow && <p className="sk-eyebrow">{s.eyebrow}</p>}
          <h1>{s.heading}</h1>
          {s.subheading && <p className="sk-lead">{s.subheading}</p>}
          {(s.primaryCta || s.secondaryCta) && (
            <div className="sk-actions">
              {s.primaryCta && <Cta {...s.primaryCta} />}
              {s.secondaryCta && <Cta {...s.secondaryCta} kind="secondary" />}
            </div>
          )}
        </div>
        {s.image && (
          <img className="sk-hero__image" src={s.image.src} alt={s.image.alt} loading="eager" decoding="async" />
        )}
      </div>
    </section>
  );
}

function Features(s: SectionOf<"features">) {
  return (
    <section className="sk-section sk-features">
      <div className="sk-container">
        <h2>{s.heading}</h2>
        {s.intro && <p className="sk-lead">{s.intro}</p>}
        <ul className={`sk-features__items sk-features__items--${s.variant}`}>
          {s.items.map((item, i) => (
            <li key={i} className="sk-card">
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Text(s: SectionOf<"text">) {
  return (
    <section className="sk-section sk-text">
      <div className="sk-container sk-container--narrow">
        {s.heading && <h2>{s.heading}</h2>}
        {s.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </section>
  );
}

function Testimonials(s: SectionOf<"testimonials">) {
  return (
    <section className="sk-section sk-testimonials">
      <div className="sk-container">
        <h2>{s.heading}</h2>
        <div className="sk-testimonials__items">
          {s.items.map((t, i) => (
            <figure key={i} className="sk-card">
              <blockquote>{t.quote}</blockquote>
              <figcaption>
                <strong>{t.author}</strong>
                {t.role && <span>, {t.role}</span>}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function CallToAction(s: SectionOf<"cta">) {
  return (
    <section className="sk-section sk-cta">
      <div className="sk-container sk-cta__inner">
        <div>
          <h2>{s.heading}</h2>
          {s.body && <p>{s.body}</p>}
        </div>
        <Cta {...s.action} kind="secondary" />
      </div>
    </section>
  );
}

function Contact(s: SectionOf<"contact">) {
  return (
    <section className="sk-section sk-contact" id="contact">
      <div className="sk-container">
        <h2>{s.heading}</h2>
        {s.intro && <p className="sk-lead">{s.intro}</p>}
        <div className="sk-contact__grid">
          {(s.email || s.phone) && (
            <div className="sk-card">
              <h3>Get in touch</h3>
              {s.email && (
                <p>
                  <a href={`mailto:${s.email}`}>{s.email}</a>
                </p>
              )}
              {s.phone && (
                <p>
                  <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a>
                </p>
              )}
            </div>
          )}
          {s.address && (
            <address className="sk-card">
              <h3>Visit us</h3>
              {s.address.map((line, i) => (
                <span key={i}>
                  {line}
                  <br />
                </span>
              ))}
            </address>
          )}
          {s.hours && (
            <div className="sk-card">
              <h3>Opening hours</h3>
              <dl className="sk-hours">
                {s.hours.map((h, i) => (
                  <div key={i}>
                    <dt>{h.days}</dt>
                    <dd>{h.time}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Adding a section type: schema in schema/index.ts, component here, entry in this map. */
const registry: { [T in SectionType]: (props: SectionOf<T>) => ReactElement } = {
  hero: Hero,
  features: Features,
  text: Text,
  testimonials: Testimonials,
  cta: CallToAction,
  contact: Contact,
};

export const sectionTypes = Object.keys(registry) as SectionType[];

export function SectionView({ section }: { section: Section }) {
  const Component = registry[section.type] as (props: Section) => ReactElement;
  return <Component {...section} />;
}

export function Header({ site, currentSlug }: { site: SiteConfig; currentSlug: string }) {
  const currentPath = currentSlug === "home" ? "/" : `/${currentSlug}`;
  const links = site.nav.map((l) => (
    <li key={l.href}>
      <a href={l.href} aria-current={l.href === currentPath ? "page" : undefined}>
        {l.label}
      </a>
    </li>
  ));
  return (
    <header className="sk-header">
      <div className="sk-container sk-header__inner">
        <a className="sk-brand" href="/">
          {site.logo ? <img src={site.logo.src} alt={site.logo.alt || site.name} height={36} /> : site.name}
        </a>
        <nav aria-label="Main" className="sk-nav sk-nav--desktop">
          <ul>{links}</ul>
        </nav>
        {/* CSS-only mobile menu: works without JavaScript. */}
        <details className="sk-nav sk-nav--mobile">
          <summary aria-label="Menu">Menu</summary>
          <ul>{links}</ul>
        </details>
      </div>
    </header>
  );
}

export function Footer({ site }: { site: SiteConfig }) {
  return (
    <footer className="sk-footer">
      <div className="sk-container sk-footer__inner">
        <p>{site.footer.text ?? `© ${new Date().getFullYear()} ${site.name}`}</p>
        {site.footer.links.length > 0 && (
          <ul>
            {site.footer.links.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </footer>
  );
}

export function PageView({ site, page }: { site: SiteConfig; page: Page }) {
  return (
    <>
      <a className="sk-skip" href="#main">
        Skip to content
      </a>
      <Header site={site} currentSlug={page.slug} />
      <main id="main">
        {page.sections.map((section, i) => (
          <SectionView key={i} section={section} />
        ))}
      </main>
      <Footer site={site} />
    </>
  );
}
