export * from "./generated";
// Friendlier aliases for entities whose only OpenAPI-documented response
// schema is the *DocsOut variant (see apps/api/app/schemas/party.py) --
// keeps call sites using the same short names (Party, Supplier) they used
// before this package existed.
export type { PartyDocsOut as Party, SupplierDocsOut as Supplier } from "./generated";
