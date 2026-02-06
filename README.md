# Taxtor

Indian Advance Tax Calculator — a web app that helps Indian taxpayers calculate advance tax liability, penalties, and interest for FY 2025-26 (AY 2026-27).

## Features

- **Multi-step wizard** guiding you through income entry (salary, mutual fund withdrawals, US stock sales, other income), deductions, and advance tax payments
- **Dual regime comparison** — computes tax under both Old and New regimes side by side
- **Capital gains classification** — automatic LTCG/STCG determination for mutual funds (equity/debt) and US stocks
- **Interest calculation** — computes interest under sections 234B and 234C for shortfall/deferred advance tax
- **CSV import** for US stock transactions
- **Auto-save** to localStorage with JSON export/import
- **Print-friendly worksheet** and PDF export

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Zustand (state management)
- React Hook Form + Zod (validation)
- Radix UI (accessible components)
- Vitest (testing)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

### Other Commands

```bash
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint
npm run test       # Run tests (Vitest)
```

## Project Structure

```
src/
  components/    # React components (wizard steps, UI elements)
  hooks/         # Custom React hooks
  lib/           # Calculation engine and utilities
  store/         # Zustand state management
  types/         # TypeScript type definitions
docs/
  req.md         # Full requirements specification
```

## License

[MIT](LICENSE)
