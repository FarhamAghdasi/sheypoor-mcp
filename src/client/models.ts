import { z } from "zod";

export const PriceSchema = z.object({
  label: z.string().optional().nullable(),
  amount: z.union([z.string(), z.number()]).nullable().optional(),
  currency: z.string().optional().nullable(),
});
export type Price = z.infer<typeof PriceSchema>;

export const BreadcrumbSchema = z.object({
  title: z.string(),
  url: z.string().optional(),
  type: z.string().optional(),
  subType: z.number().optional(),
});
export type Breadcrumb = z.infer<typeof BreadcrumbSchema>;

export const SellerSchema = z
  .object({
    url: z.string().optional(),
    name: z.string().optional(),
    registeredAt: z.string().optional().nullable(),
    image: z.string().optional().nullable(),
    rates: z.unknown().optional().nullable(),
    hasReviews: z.boolean().optional(),
    listingCount: z.unknown().optional().nullable(),
    invoiceCount: z.unknown().optional().nullable(),
  })
  .passthrough();
export type Seller = z.infer<typeof SellerSchema>;

export const ListingImageSchema = z.object({
  source: z
    .object({
      mobile: z.string().optional(),
      desktop: z.string().optional(),
    })
    .optional(),
  title: z.string().optional(),
  alt: z.string().optional(),
});
export type ListingImage = z.infer<typeof ListingImageSchema>;

export const AttributeSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    key: z.string().optional(),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    type: z.string().optional(),
    icon: z.string().nullable().optional(),
    icon_caption: z.string().nullable().optional(),
  })
  .passthrough();
export type Attribute = z.infer<typeof AttributeSchema>;

export const ListingDetailSchema = z
  .object({
    type: z.string().optional(),
    id: z.string(),
    title: z.string().optional(),
    url: z.string().optional(),
    timePassedLabel: z.string().optional(),
    description: z.string().optional(),
    imageCount: z.number().optional(),
    videoCount: z.number().optional(),
    breadcrumbs: z.array(BreadcrumbSchema).optional(),
    seller: SellerSchema.nullable().optional(),
    phone: z.string().nullable().optional(),
    isPhoneVerified: z.boolean().optional(),
    isShopProfile: z.boolean().optional(),
    isSecurePurchase: z.boolean().optional(),
    price: z.array(PriceSchema).optional(),
    location: z.string().nullable().optional(),
    images: z.array(ListingImageSchema).optional(),
    attributes: z.array(AttributeSchema).optional(),
    actions: z.array(z.string()).optional(),
    categoryId: z.number().nullable().optional(),
    topCategoryId: z.number().nullable().optional(),
    addedAt: z.string().optional(),
    landings: z.array(z.unknown()).optional(),
    hideContactInfo: z.boolean().optional(),
    paidTags: z.array(z.string()).optional(),
  })
  .passthrough();
export type ListingDetail = z.infer<typeof ListingDetailSchema>;

export interface NormalizedPrice {
  amount: number | null;
  currency: "IRR" | "IRT" | null;
  negotiable: boolean;
  display: string;
  raw: string;
}

export const SearchMetaSchema = z
  .object({
    total: z.number().optional(),
    normal_count: z.number().optional(),
    p: z.number().optional(),
    items_per_page: z.number().optional(),
    f: z.string().optional(),
    query_id: z.string().nullable().optional(),
    mnp: z.number().optional(),
    mxp: z.number().optional(),
    api_version: z.string().optional(),
  })
  .passthrough();
export type SearchMeta = z.infer<typeof SearchMetaSchema>;

export const SearchResponseSchema = z.object({
  data: z.array(z.unknown()),
  extra_sections: z.array(z.unknown()).optional(),
  meta: SearchMetaSchema.optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export interface Listing {
  id: string;
  type: string;
  title: string;
  url: string;
  price: Price[];
  location: string | null;
  categoryId: number | null;
  imageCount: number;
  videoCount: number;
  telephone: string | null;
  attributes: Attribute[];
  raw: Record<string, unknown>;
}
