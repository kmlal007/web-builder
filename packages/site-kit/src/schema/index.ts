import { z } from "zod";

/**
 * Single source of truth for everything stored in a customer site repo.
 * Templates, the CLI, the renderer and (later) the CMS config all use these schemas.
 */

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #1a2b3c");

/** Relative site path ("/about"), in-page anchor ("#contact"), or absolute http(s)/mailto/tel URL. */
export const linkHref = z
  .string()
  .refine(
    (v) => /^(\/|#)/.test(v) || /^(https?:\/\/|mailto:|tel:)/i.test(v),
    "Link must start with /, #, http(s)://, mailto: or tel:",
  );

/** Image path inside the site's public/ folder ("/images/hero.jpg") or an https URL. */
export const imageSrc = z
  .string()
  .refine((v) => v.startsWith("/") || /^https:\/\//i.test(v), "Image must be a /public path or https URL");

const link = z.object({ label: z.string().min(1), href: linkHref });
const image = z.object({ src: imageSrc, alt: z.string() });

// ---------------------------------------------------------------- theme

export const themeSchema = z.object({
  colors: z.object({
    primary: hexColor,
    /** Text color on primary backgrounds. Derived (black/white) when omitted. */
    onPrimary: hexColor.optional(),
    accent: hexColor,
    background: hexColor,
    surface: hexColor,
    text: hexColor,
    muted: hexColor,
  }),
  fonts: z.object({
    /** CSS font-family stacks. System stacks avoid third-party font requests (GDPR). */
    heading: z.string().min(1),
    body: z.string().min(1),
  }),
  radius: z.enum(["none", "sm", "md", "lg", "full"]).default("md"),
  density: z.enum(["compact", "comfortable", "spacious"]).default("comfortable"),
});
export type Theme = z.infer<typeof themeSchema>;

// ---------------------------------------------------------------- sections

export const heroSection = z.object({
  type: z.literal("hero"),
  variant: z.enum(["centered", "split"]).default("centered"),
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  subheading: z.string().optional(),
  primaryCta: link.optional(),
  secondaryCta: link.optional(),
  image: image.optional(),
});

export const featuresSection = z.object({
  type: z.literal("features"),
  variant: z.enum(["grid", "list"]).default("grid"),
  heading: z.string().min(1),
  intro: z.string().optional(),
  items: z.array(z.object({ title: z.string().min(1), body: z.string() })).min(1),
});

export const textSection = z.object({
  type: z.literal("text"),
  heading: z.string().optional(),
  /** Plain paragraphs. No HTML is accepted, which keeps CMS content XSS-safe by construction. */
  paragraphs: z.array(z.string()).min(1),
});

export const testimonialsSection = z.object({
  type: z.literal("testimonials"),
  heading: z.string().min(1),
  items: z
    .array(z.object({ quote: z.string().min(1), author: z.string().min(1), role: z.string().optional() }))
    .min(1),
});

export const ctaSection = z.object({
  type: z.literal("cta"),
  heading: z.string().min(1),
  body: z.string().optional(),
  action: link,
});

export const contactSection = z.object({
  type: z.literal("contact"),
  heading: z.string().min(1),
  intro: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.array(z.string()).optional(),
  hours: z.array(z.object({ days: z.string(), time: z.string() })).optional(),
});

export const sectionSchema = z.discriminatedUnion("type", [
  heroSection,
  featuresSection,
  textSection,
  testimonialsSection,
  ctaSection,
  contactSection,
]);
export type Section = z.infer<typeof sectionSchema>;
export type SectionType = Section["type"];
export type SectionOf<T extends SectionType> = Extract<Section, { type: T }>;

// ---------------------------------------------------------------- pages & site

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, digits and hyphens");

export const pageSchema = z.object({
  /** "home" is served at "/". */
  slug,
  title: z.string().min(1),
  description: z.string().max(200).optional(),
  sections: z.array(sectionSchema).min(1),
});
export type Page = z.infer<typeof pageSchema>;

export const siteConfigSchema = z.object({
  name: z.string().min(1),
  tagline: z.string().optional(),
  /** Absolute production URL, used for canonical links. Optional until a domain is known. */
  url: z.string().url().optional(),
  lang: z.string().default("en"),
  logo: image.optional(),
  nav: z.array(link).default([]),
  footer: z
    .object({
      text: z.string().optional(),
      links: z.array(link).default([]),
    })
    .default({ links: [] }),
});
export type SiteConfig = z.infer<typeof siteConfigSchema>;

// ---------------------------------------------------------------- template manifest & lock file

export const templateManifestSchema = z.object({
  id: slug,
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string(),
  verticals: z.array(z.string()).min(1),
  /** Theme paths the team may change during customization (documentation + future configurator). */
  customizable: z.array(z.string()).default([]),
});
export type TemplateManifest = z.infer<typeof templateManifestSchema>;

export const siteLockSchema = z.object({
  customer: z.string().min(1),
  template: z.object({ id: z.string(), version: z.string() }),
  kit: z.object({ name: z.string(), version: z.string() }),
  createdAt: z.string(),
  /** "managed": we own it and apply kit upgrades. "ejected": kit vendored, no further upgrades. */
  status: z.enum(["managed", "ejected"]).default("managed"),
});
export type SiteLock = z.infer<typeof siteLockSchema>;
