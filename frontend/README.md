# PolyPortfolio Frontend

Next.js frontend application for PolyPortfolio - a portfolio management dashboard for Polymarket wallets.

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
# or
yarn install
```

## Development

Run the development server:

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Building for Production

```bash
pnpm build
pnpm start
```

## Project Structure

```
frontend/
├── app/                 # Next.js app directory
│   ├── api/            # API routes (currently proxying to backend)
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home page
├── components/         # React components
│   ├── ui/             # UI component library
│   └── theme-provider.tsx
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and types
├── public/             # Static assets
└── styles/             # Global styles
```

## Backend Integration

The frontend is configured to work with the FastAPI backend running on `http://localhost:8000`. Make sure the backend is running before starting the frontend.

You can update the API base URL in your API route files if needed.

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

