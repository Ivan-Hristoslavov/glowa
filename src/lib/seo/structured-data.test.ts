import { describe, expect, it } from "vitest";

import { BUSINESS_CATEGORIES } from "@/lib/business-categories";
import type { BusinessDetail } from "@/lib/queries/discovery";

import { alternatesFor, businessJsonLd } from "./structured-data";

/**
 * A salon shaped like the query returns it. Only the fields the schema reads
 * are filled in; the cast keeps the fixture honest about that.
 */
function salon(overrides: Partial<BusinessDetail> = {}) {
  return {
    id: "b1",
    slug: "hair-lab",
    name: "Hair Lab",
    category: "hair_salon",
    currency: "EUR",
    short_pitch: { bg: "Цвят и грижа" },
    description: null,
    cover_image_url: null,
    logo_url: null,
    phone: "+359 2 000 0000",
    email: null,
    locations: [
      {
        address_line1: "ул. Гурко 24",
        address_line2: null,
        city: "София",
        region: null,
        postal_code: "1000",
        country_code: "BG",
        latitude: null,
        longitude: null,
        phone: null,
        business_hours: [
          { day_of_week: 2, opens_at: "09:00:00", closes_at: "19:00:00" },
        ],
      },
    ],
    services: [
      {
        name: { bg: "Подстригване" },
        description: null,
        price_cents: 3000,
        currency: "EUR",
      },
      {
        name: { bg: "Боядисване" },
        description: null,
        price_cents: 4500,
        currency: "EUR",
      },
    ],
    rating: { average_rating: null, review_count: 0 },
    ...overrides,
  } as unknown as BusinessDetail;
}

describe("businessJsonLd", () => {
  it("maps the category to the schema.org subtype Google recognises", () => {
    expect(businessJsonLd(salon(), "bg")["@type"]).toBe("HairSalon");
    expect(
      businessJsonLd(salon({ category: "nail_studio" }), "bg")["@type"],
    ).toBe("NailSalon");
  });

  it("has a type for every category the product allows", () => {
    // The enum grew once already and the mapping silently fell back to the
    // generic type for every salon. This is that regression, as a test.
    for (const category of BUSINESS_CATEGORIES) {
      const type = businessJsonLd(salon({ category }), "bg")["@type"];
      if (category === "other") {
        expect(type).toBe("HealthAndBeautyBusiness");
      } else {
        expect(type).not.toBe("HealthAndBeautyBusiness");
      }
    }
  });

  it("omits aggregateRating entirely when there are no reviews", () => {
    // Shipping a zeroed rating is both a Google policy violation and the kind
    // of invented traction this product refuses to publish.
    expect(businessJsonLd(salon(), "bg").aggregateRating).toBeUndefined();
  });

  it("includes aggregateRating once reviews exist", () => {
    const data = businessJsonLd(
      salon({ rating: { average_rating: 4.6, review_count: 12 } }),
      "bg",
    );
    expect(data.aggregateRating).toMatchObject({
      ratingValue: "4.6",
      reviewCount: 12,
    });
  });

  it("reports a price band from the real services", () => {
    expect(businessJsonLd(salon(), "bg").priceRange).toBe("30–45 EUR");
  });

  it("does not advertise a one-price salon as a range", () => {
    const one = salon({
      services: [
        { name: { bg: "Маникюр" }, description: null, price_cents: 3000, currency: "EUR" },
      ],
    } as never);
    expect(businessJsonLd(one, "bg").priceRange).toBe("30 EUR");
  });

  it("emits opening hours as schema.org weekdays", () => {
    const hours = businessJsonLd(salon(), "bg")
      .openingHoursSpecification as Record<string, string>[];
    expect(hours[0].dayOfWeek).toBe("https://schema.org/Tuesday");
    expect(hours[0].opens).toBe("09:00");
  });

  it("makes the fallback image absolute", () => {
    const image = businessJsonLd(salon(), "bg").image as string;
    expect(image.startsWith("http")).toBe(true);
  });
});

describe("alternatesFor", () => {
  it("keeps every language plus x-default, whatever the path", () => {
    const alternates = alternatesFor("/bg/business/hair-lab");
    expect(alternates.canonical).toBe("/bg/business/hair-lab");
    expect(alternates.languages).toEqual({
      "bg-BG": "/bg/business/hair-lab",
      "en-GB": "/en/business/hair-lab",
      "ro-RO": "/ro/business/hair-lab",
      "x-default": "/bg/business/hair-lab",
    });
  });

  it("handles the bare locale root", () => {
    expect(alternatesFor("/en").languages["ro-RO"]).toBe("/ro");
  });
});
