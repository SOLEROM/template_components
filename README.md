# AI Editor Template

A full-stack AI-powered app builder with a 3-panel layout: chat with an AI assistant, live preview of generated React components, and a code editor for the generated files.

Built with Next.js 15, React 19, Vercel AI SDK, Monaco Editor, and Prisma. Works out of the box in **mock mode** (no API key needed) or with a real Claude API key for full AI capabilities.

---

## How It Looks

```
┌─────────────────┬──────────────────────────────────────┐
│                 │                                      │
│   Chat Panel    │         Live Preview / Code Editor   │
│                 │                                      │
│  · Send a       │  Preview tab: renders the generated  │
│    prompt       │  React app in a sandboxed iframe      │
│  · AI replies   │                                      │
│    with tool    │  Code tab: file tree + Monaco editor │
│    calls        │  to browse and edit generated files  │
│  · Files are    │                                      │
│    created in   │                                      │
│    real time    │                                      │
│                 │                                      │
└─────────────────┴──────────────────────────────────────┘
```

---

## Install

**Requirements:** Node.js 18+ and npm.

```bash
# Clone or copy this folder, then:
cd _templateApp

# Install dependencies
npm install

# Generate the Prisma client
npx prisma generate

# Create the local SQLite database
npx prisma migrate dev --name init
```

---

## Configure

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env`:

```env
# Leave empty to use mock mode (no API key required)
# Set to your Anthropic key for real Claude AI
ANTHROPIC_API_KEY=

# Secret key for JWT session tokens — change this in production
JWT_SECRET=development-secret-key

# SQLite database location (local file, no setup needed)
DATABASE_URL="file:./prisma/dev.db"
```

---

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Using the App

### Mock mode (no API key)

Without `ANTHROPIC_API_KEY` set, the app runs a built-in mock AI that simulates a 4-step generation flow and creates a demo app based on keywords in your prompt:

- Type **"counter"** → generates a counter component
- Type **"card"** → generates a card component
- Type **"form"** → generates a form component
- Any other prompt → defaults to counter

This is useful for testing the UI and the preview/editor pipeline without spending API credits.

### With a real API key

Set `ANTHROPIC_API_KEY` in `.env` and restart the dev server. The app will use Claude Haiku 4.5 by default. You can describe any React component or mini-app and the AI will generate it using multi-step tool calls:

1. **Create files** — the AI creates `/App.jsx` and any supporting files
2. **Edit files** — the AI uses str_replace to refine the code
3. **Live preview** — changes appear in the preview panel instantly

### The virtual file system

All generated files live in an **in-memory virtual file system** (`Record<string, string>`, path → content) held in React state — nothing is written to your disk. Directories are implicit (they exist when files beneath them exist). The file tree is visible in the Code tab. When you save a project (requires login), the file system is serialized to JSON in the SQLite database.

### Projects and auth

- **Anonymous**: you can use the app without signing up. Work is tracked in `localStorage`.
- **Sign up / Sign in**: creates an account. Projects are saved to the database and persist across sessions.
- **New Project**: starts a fresh file system and chat history.

---

## Modifying the App

### Change the AI model

In `src/lib/provider.ts`, `getLanguageModel()` returns the model used for real AI calls:

```typescript
// Default: Claude Haiku 4.5 (fast, cheap)
return anthropic("claude-haiku-4-5-20251001");

// For more capable responses, switch to Sonnet:
// return anthropic("claude-sonnet-4-6");
```

### Change the system prompt

Edit `src/lib/prompts/generation.tsx`. The prompt instructs the AI on:
- Always creating `/App.jsx` as the entry point
- Using Tailwind CSS for styling
- Using `@/` import aliases for local files

### Change the welcome / empty states

| File | What to change |
|------|---------------|
| `src/components/chat/MessageList.tsx` | Empty chat state text |
| `src/components/chat/MessageInput.tsx` | Input placeholder |
| `src/components/preview/PreviewFrame.tsx` | First-load welcome screen |
| `src/app/main-content.tsx` | Header title |
| `src/app/layout.tsx` | Browser tab title |

### Add more AI tools

Tools are defined in `src/lib/tools/`. Each tool is a Zod-schema-validated function passed to `streamText()` in `src/app/api/chat/route.ts`.

To add a new tool:

1. Create `src/lib/tools/my-tool.ts` — export a `buildMyTool(files: Files)` function that returns a Vercel AI SDK `tool()` object. Mutate the `files` object directly inside `execute`.
2. Import and register it in `src/app/api/chat/route.ts` under the `tools:` key.
3. Handle its client-side result in `src/lib/contexts/file-system-context.tsx` inside `handleToolCall()`.

### Change the layout

The 3-panel layout lives in `src/app/main-content.tsx`. It uses `react-resizable-panels`. Adjust `defaultSize`, `minSize`, and `maxSize` props on `<ResizablePanel>` to change proportions.

### Style the app

Global styles are in `src/app/globals.css` (Tailwind CSS v4). Theme variables (colors, radius, etc.) are defined as CSS custom properties inside `@layer base`. Shadcn/ui component styles are in `src/components/ui/`.

### Swap the database

The app uses SQLite via Prisma for local development. To switch to Postgres or MySQL:

1. Update `prisma/schema.prisma` — change `provider = "sqlite"` to `"postgresql"` or `"mysql"`.
2. Update `DATABASE_URL` in `.env` to your connection string.
3. Run `npx prisma migrate dev --name switch-db`.

---

## Project Structure

```
_templateApp/
├── prisma/
│   └── schema.prisma          # User + Project models
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Root layout, browser title
│   │   ├── page.tsx            # Home page (project list)
│   │   ├── main-content.tsx    # 3-panel layout
│   │   ├── globals.css         # Tailwind v4 + theme vars
│   │   ├── [projectId]/
│   │   │   └── page.tsx        # Project page
│   │   └── api/chat/
│   │       └── route.ts        # AI streaming endpoint
│   ├── lib/
│   │   ├── provider.ts         # AI model + MockLanguageModel
│   │   ├── file-system.ts      # Files type + pure functions (create/view/replace/insert/delete/rename)
│   │   ├── auth.ts             # JWT helpers
│   │   ├── prisma.ts           # Prisma singleton
│   │   ├── anon-work-tracker.ts
│   │   ├── contexts/
│   │   │   ├── file-system-context.tsx  # VFS state + tool dispatch
│   │   │   └── chat-context.tsx         # useChat wrapper
│   │   ├── tools/
│   │   │   ├── str-replace.ts   # str_replace_editor tool
│   │   │   └── file-manager.ts  # file_manager tool
│   │   ├── transform/
│   │   │   └── jsx-transformer.ts  # Babel + import map + preview HTML
│   │   └── prompts/
│   │       └── generation.tsx   # System prompt
│   ├── actions/                 # Server actions (auth + projects)
│   ├── hooks/
│   │   └── use-auth.ts
│   ├── middleware.ts            # JWT session middleware
│   └── components/
│       ├── chat/               # ChatInterface, MessageList, MessageInput
│       ├── editor/             # CodeEditor (Monaco), FileTree
│       ├── preview/            # PreviewFrame (iframe sandbox)
│       ├── auth/               # AuthDialog, SignInForm, SignUpForm
│       ├── HeaderActions.tsx
│       └── ui/                 # Shadcn/ui primitives
└── .env                        # Local env vars (not committed)
```

> **Upgrading from an older version?** Run `npm run db:reset` — the file system storage format changed to a flat `Record<string, string>` and existing project data will not be compatible.
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| UI | React 19 + Tailwind CSS v4 + Shadcn/ui |
| AI | Vercel AI SDK + Claude (Anthropic) |
| Code Editor | Monaco Editor |
| Preview | Babel (client-side) + esm.sh CDN + iframe sandbox |
| Layout | react-resizable-panels |
| Database | Prisma + SQLite |
| Auth | JWT (jose) + bcrypt |
| Panel resize | react-resizable-panels |
