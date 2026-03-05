# System Config — AI-Powered Editor App Template

This document is a system configuration prompt for AI tools building apps that combine a **chat interface**, a **live preview panel**, and a **code editor**. Use this as the foundational specification whenever scaffolding a new app of this type.

---

## 1. App Archetype

You are building an **AI-powered interactive editor**. The core loop is:

```
User describes → AI generates/modifies files → Preview updates live
```

The UI has three primary regions:
- **Chat** — user input and AI output (streamed)
- **Preview** — live rendered output from the current file system state
- **Code Editor** — view and manually edit AI-generated files

---

## 2. Tech Stack

### Frontend
| Concern | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| UI Library | React 19 |
| Styling | Tailwind CSS v4 |
| Components | Shadcn/ui (new-york style, neutral palette) |
| Icons | Lucide React |
| Layout | `react-resizable-panels` |
| Markdown | `react-markdown` |
| Code Editor | `@monaco-editor/react` |

### AI / LLM
| Concern | Choice |
|---|---|
| SDK | Vercel AI SDK (`ai`) |
| Provider | `@ai-sdk/anthropic` |
| Default Model | `claude-haiku-4-5` (fast, cheap iterations) |
| Streaming | `streamText()` with `maxSteps` for multi-tool calls |
| Tools | Anthropic tool_use (structured JSON tool calls) |
| Fallback | `MockLanguageModel` when no API key present |

### Backend / Persistence
| Concern | Choice |
|---|---|
| API | Next.js Route Handlers (`/app/api/`) |
| DB ORM | Prisma |
| DB (dev) | SQLite (`dev.db`) |
| DB (prod) | PostgreSQL or compatible |
| Auth | JWT via `jose`, bcrypt passwords, HTTP-only cookies |
| Sessions | 7-day expiry, HS256 algorithm |

### Preview Runtime
| Concern | Choice |
|---|---|
| JSX Transform | `@babel/standalone` (client-side) |
| Module Resolution | `esm.sh` CDN for npm packages |
| Preview Container | `<iframe>` with import maps |
| File URLs | Blob URLs for in-memory files |

---

## 3. Project File Structure

```
src/
├── app/
│   ├── api/
│   │   └── chat/route.ts          # POST: streamText with tools
│   ├── [projectId]/page.tsx       # Authenticated project view
│   ├── page.tsx                   # Home: auth-based routing
│   ├── layout.tsx                 # Root layout + providers
│   ├── main-content.tsx           # Main 3-panel layout
│   └── globals.css
│
├── components/
│   ├── chat/
│   │   ├── ChatInterface.tsx      # Container, auto-scroll
│   │   ├── MessageList.tsx        # Role-based message rendering
│   │   ├── MessageInput.tsx       # Textarea, Enter=send
│   │   └── MarkdownRenderer.tsx   # react-markdown wrapper
│   ├── editor/
│   │   ├── CodeEditor.tsx         # Monaco wrapper, auto-language detect
│   │   └── FileTree.tsx           # Recursive tree, dirs first
│   ├── preview/
│   │   └── PreviewFrame.tsx       # iframe, entry point detection
│   ├── auth/
│   │   ├── AuthDialog.tsx         # Modal with sign in/up toggle
│   │   ├── SignInForm.tsx
│   │   └── SignUpForm.tsx
│   ├── ui/                        # Shadcn/ui primitives
│   └── HeaderActions.tsx          # Project selector, auth buttons
│
├── lib/
│   ├── auth.ts                    # createSession, getSession, deleteSession
│   ├── prisma.ts                  # Prisma singleton
│   ├── provider.ts                # AI model factory + MockLanguageModel
│   ├── file-system.ts             # VirtualFileSystem class
│   ├── utils.ts                   # cn(), general helpers
│   ├── anon-work-tracker.ts       # Anonymous session state
│   ├── contexts/
│   │   ├── chat-context.tsx       # useChat wrapper + tool dispatch
│   │   └── file-system-context.tsx # VFS state + tool handlers
│   ├── tools/
│   │   ├── str-replace.ts         # str_replace_editor tool impl
│   │   └── file-manager.ts        # rename/delete tool impl
│   ├── transform/
│   │   └── jsx-transformer.ts     # Babel transform + preview HTML gen
│   └── prompts/
│       └── generation.tsx         # System prompt for code generation
│
├── actions/
│   ├── index.ts                   # signUp, signIn, signOut, getUser
│   ├── create-project.ts
│   ├── get-project.ts
│   └── get-projects.ts
│
└── middleware.ts                  # Auth middleware
```

---

## 4. UI Layout

Use `react-resizable-panels` for a horizontal split:

```
┌─────────────────────────────────────────────────┐
│  Header: project name | tab switcher | user menu │
├───────────────────┬─────────────────────────────┤
│                   │  [Preview] or [Code] tab     │
│  Chat Panel       │                              │
│  35% / min 25%    │  Preview: iframe             │
│                   │                              │
│  - MessageList    │  Code: ┌──────────┬────────┐ │
│  - MessageInput   │        │ FileTree │ Monaco │ │
│                   │        │  30%     │  70%   │ │
│                   │        └──────────┴────────┘ │
└───────────────────┴─────────────────────────────┘
```

**Panel defaults:**
- Chat: 35% (range 25–50%)
- Right: 65%
- File tree: 30% of right panel (range 20–50%)
- Editor: 70% of right panel

---

## 5. State Management

### Two Context Providers

**FileSystemContext** wraps the app and owns:
- `files`: `Record<string, string>` — in-memory virtual FS
- `selectedFile`: currently open file path
- CRUD: `createFile`, `updateFile`, `deleteFile`, `renameFile`
- `handleToolCall(toolName, toolInput)`: dispatches AI tool calls to FS ops
- Auto-selects `/App.jsx` or first file on mount

**ChatContext** wraps the app and owns:
- Uses Vercel AI SDK `useChat` hook
- `messages`, `input`, `handleSubmit`, `isLoading`
- On tool call result: calls `fileSystemContext.handleToolCall()`
- Sends current VFS state to API with each request

### Context Provider Order
```tsx
<FileSystemProvider>
  <ChatProvider>
    <App />
  </ChatProvider>
</FileSystemProvider>
```

---

## 6. AI Chat API (`/api/chat`)

```typescript
// POST /api/chat
// Body: { messages, fileSystem: Record<string,string>, projectId? }

export async function POST(req: Request) {
  const { messages, fileSystem } = await req.json()

  return streamText({
    model: getModel(),           // from lib/provider.ts
    system: generationPrompt,    // from lib/prompts/generation.tsx
    messages,
    maxTokens: 10000,
    maxSteps: 40,
    tools: {
      str_replace_editor: strReplaceEditorTool(fileSystem),
      file_manager: fileManagerTool(fileSystem),
    },
  }).toDataStreamResponse()
}
```

**API must:**
- Accept and forward VFS state so tools can operate on it
- Return a streaming response (Vercel AI `toDataStreamResponse()`)
- Use multi-step tool execution (`maxSteps: 40`)
- Inject system prompt with generation instructions

---

## 7. AI Tools

### `str_replace_editor`
Allows AI to read and write files.

| Command | Description |
|---|---|
| `view` | Read file or list directory |
| `create` | Create new file with content |
| `str_replace` | Replace exact string in file |
| `insert` | Insert lines at line number |
| `undo_edit` | Revert last change |

### `file_manager`
Allows AI to organize files.

| Command | Description |
|---|---|
| `rename` | Rename/move file or directory |
| `delete` | Delete file or directory |

**Both tools update the server-side VFS snapshot and return the new state to the frontend via the tool result, which is then applied to FileSystemContext.**

---

## 8. Live Preview System

### Entry Point Resolution
Detect in order: `/App.jsx` → `/App.tsx` → `/index.jsx` → `/index.tsx` → first `.jsx`/`.tsx` file

### Preview HTML Generation (`jsx-transformer.ts`)
1. Collect all files from VFS
2. Build import map:
   - Local files → Blob URLs (Babel-transformed)
   - `react`, `react-dom` → `https://esm.sh/react@19`, `https://esm.sh/react-dom@19`
   - Other npm packages → `https://esm.sh/{package}`
3. Collect CSS files into `<style>` tags
4. Emit HTML with:
   - `<script type="importmap">` for module resolution
   - `<script type="module">` importing entry point
   - Error overlay for runtime errors

### Babel Transform (client-side)
```javascript
Babel.transform(code, {
  presets: ['react', 'typescript'],
  filename: 'file.tsx',
})
```

### PreviewFrame
- Renders into a sandboxed `<iframe>`
- Sets `srcDoc` to generated HTML
- Rebuilds on every VFS change
- Shows placeholder on empty state

---

## 9. System Prompt for Code Generation

The generation system prompt must specify:

```
You are an expert frontend developer. You create React components using:
- Tailwind CSS for all styling (no inline styles, no CSS modules)
- The virtual file system tools to create and edit files
- /App.jsx as the entry point (must export default)
- @/ as the import alias for local files
- esm.sh for any external packages

Rules:
- Always create /App.jsx first
- Keep components modular — split large UIs into multiple files
- Use TypeScript when possible
- Prefer functional components with hooks
- When modifying existing files, use str_replace not full rewrites
- Think step by step before writing code
```

---

## 10. Authentication Pattern

### JWT Sessions
```typescript
// lib/auth.ts
createSession(userId, email)   // Signs JWT, sets HTTP-only cookie "auth-token"
getSession()                   // Reads + verifies cookie, returns payload
deleteSession()                // Clears cookie
```

- Algorithm: HS256
- Expiry: 7 days
- Cookie: HTTP-only, Secure in production
- Secret: `JWT_SECRET` env var (fallback: dev default string)

### Password Storage
- bcrypt with salt rounds = 10
- Minimum 8 character requirement enforced at signup

### Middleware
- Protect `/[projectId]/*` routes
- Redirect to `/` if no valid session

---

## 11. Database Schema (Prisma)

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  password  String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  projects  Project[]
}

model Project {
  id        String   @id @default(cuid())
  name      String
  userId    String?
  messages  String   @default("[]")   // JSON: ChatMessage[]
  data      String   @default("{}")   // JSON: Record<string, string> (VFS)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- Messages and file system are stored as JSON strings
- Anonymous sessions have `userId: null`
- Project is the unit of persistence — each AI session maps to one project

---

## 12. Environment Variables

```env
ANTHROPIC_API_KEY=          # Required for real AI; omit for mock mode
JWT_SECRET=                 # Required in production
DATABASE_URL=file:./prisma/dev.db  # SQLite for dev; Postgres for prod
NODE_ENV=development
```

---

## 13. Mock / Dev Mode

When `ANTHROPIC_API_KEY` is absent, use a `MockLanguageModel` that:
- Implements `LanguageModelV1` interface from Vercel AI SDK
- Simulates 3–4 tool calls per session
- Creates representative sample components (Counter, Form, Card, etc.)
- Limits `maxSteps` to 4
- Enables full local dev and testing without API costs

---

## 14. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Virtual file system (in-memory) | No disk I/O needed; files live in React state and DB |
| Client-side Babel transform | Enables live preview without a build server |
| esm.sh CDN import maps | npm packages work in iframe without bundling |
| Blob URLs for local files | Lets the iframe load transformed local modules |
| Streaming AI responses | Immediate feedback; user sees tokens as they arrive |
| Multi-step tool execution | AI can create multiple files in one turn |
| VFS snapshot sent per request | Stateless API; file state is in the request payload |
| Shadcn/ui + Tailwind | Fast UI development with accessible primitives |
| Resizable panels | User can adjust chat/preview/editor ratios to preference |
| Project = unit of persistence | Simple 1:1 mapping between session and saved state |

---

## 15. New App Checklist

When scaffolding a new app from this template:

- [ ] Scaffold Next.js 15 app with TypeScript and Tailwind v4
- [ ] Install: `ai`, `@ai-sdk/anthropic`, `@monaco-editor/react`, `@babel/standalone`, `react-resizable-panels`, `react-markdown`, `lucide-react`, `prisma`, `jose`, `bcryptjs`
- [ ] Add Shadcn/ui (new-york, neutral)
- [ ] Build `VirtualFileSystem` class
- [ ] Build `FileSystemContext` with tool dispatch
- [ ] Build `ChatContext` using `useChat` from `ai/react`
- [ ] Build 3-panel layout in `main-content.tsx`
- [ ] Build `ChatInterface`, `MessageList`, `MessageInput`
- [ ] Build `FileTree` and `CodeEditor` (Monaco)
- [ ] Build `PreviewFrame` with iframe + entry point detection
- [ ] Build `jsx-transformer.ts` (Babel + import map + blob URLs)
- [ ] Implement `/api/chat` with `streamText` + tools
- [ ] Define `str_replace_editor` and `file_manager` tools
- [ ] Write system prompt in `lib/prompts/generation.tsx`
- [ ] Set up Prisma schema (User + Project)
- [ ] Implement JWT auth (`lib/auth.ts` + server actions)
- [ ] Build `AuthDialog` with sign in/up forms
- [ ] Build `HeaderActions` (project selector, auth state)
- [ ] Add `MockLanguageModel` for API-key-free dev mode
- [ ] Add `middleware.ts` for route protection
- [ ] Configure `.env` with required variables
- [ ] Add `npm run setup` script: install + prisma generate + migrate

---

## 16. Customization Points Per App

When adapting this template, the following are expected to change per app:

| Part | What to Customize |
|---|---|
| `lib/prompts/generation.tsx` | Domain-specific instructions for the AI |
| Preview entry point resolution | Change from `/App.jsx` to whatever the domain needs |
| Monaco language support | Add language modes specific to the domain |
| Tailwind theme | Brand colors, fonts |
| AI tools | Add domain-specific tools alongside `str_replace_editor` |
| DB schema | Add domain-specific models |
| AI model choice | Swap Haiku for Sonnet/Opus for harder tasks |
| Max steps / tokens | Tune per task complexity |
