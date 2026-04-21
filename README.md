# G7 Systems

G7 Systems is the company brand.
G7CRM is the CRM and operator dashboard inside this repo.

## Project structure

- `web/` — frontend app files for G7CRM
  - `index.html`
  - `customers.html`
  - `deals.html`
  - `tasks.html`
  - `profile.html`
  - `css/`
  - `js/`
- `database/` — Supabase / SQL schema and upgrade files
- `automations/n8n/` — n8n workflow files and helper scripts
- `docs/` — notes and project documentation

## How it works

- Frontend: static HTML/CSS/JS app in `web/`
- Data: Supabase connection in `web/js/config.js`
- Automations: n8n workflows in `automations/n8n/`
- Database scripts: SQL files in `database/`

## Local use

Open the pages from the `web/` folder, or serve that folder with any static server.

Main entry point:
- `web/index.html`

## Branding

- Company name: G7 Systems
- Product name: G7CRM

## Notes

- The Supabase anon key in `web/js/config.js` is public-safe for frontend use.
- Keep private secrets out of this repo.
