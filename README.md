# DATIHAN.PH

Online-first thrift shop storefront for curated pre-loved pieces and pop-up events.

## Design system

### Typography
- **Manrope** — headings
- **Inter** — body and UI

### Colors
- `#281F17` — Dark Brown
- `#6B4E3D` — Brown
- `#DCC9B8` — Light Beige
- `#FBF6F3` — Off-White

No other font families or unrelated accent colors should be introduced without an explicit design change.

## Project roles

- **Buyer** — browse, cart, checkout, profile and orders
- **Shop Owner** — manage shop products, inventory, orders and promotions
- **Admin** — manage users, shops, products, categories, orders and platform settings

## Project structure

```text
/
├── index.html
├── pages/       # public/buyer storefront pages
├── buyer/       # buyer account pages
├── auth/        # authentication pages
├── owner/       # shop owner management pages
├── admin/       # platform administration pages
├── css/         # global and page styles
├── js/          # frontend JavaScript
└── assets/      # images and icons
```

## Development

The frontend is maintained in GitHub. Supabase/database configuration is maintained separately.

## Current phase

**Phase 1 — Foundation:** project shell, design system, homepage, storefront page shells, authentication page shells, buyer account pages, shop-owner pages, and admin pages.

The current pages are intentionally static shells. Database, authentication, inventory, cart, checkout and role enforcement will be connected after the Supabase schema and policies are finalized.
