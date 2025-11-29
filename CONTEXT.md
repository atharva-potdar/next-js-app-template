# CONTEXT.md - Hackathon Starter Template Brain

> **Purpose**: This document defines the architecture, patterns, and rules of engagement for building features on this Next.js 16 + React 19 + Prisma + Clerk hackathon starter. Read this first before writing any code.

---

## 🎯 Quick Stack Overview

- **Next.js 16.0.5** (App Router, RSC, Server Actions)
- **React 19.2.0** with React Compiler enabled
- **Clerk 6.35.5** (Authentication)
- **Prisma 7.0.1** + PostgreSQL 18 (Docker)
- **ShadCN UI** (New York style, Tailwind v4)
- **TypeScript 5** (strict mode)

---

## 1. Database & Schema Design Rules

### ⚠️ CRITICAL: ID Strategy

**NEVER use auto-increment integers for primary keys.** Always use:

- **UUIDs** (`@default(uuid())`) for distributed systems
- **CUIDs** (`@default(cuid())`) for sortable, collision-resistant IDs

```prisma
// ✅ CORRECT
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ❌ WRONG
model User {
  id Int @id @default(autoincrement()) // NO!
}
```

### Naming Conventions

- **Models**: `PascalCase` (e.g., `User`, `BlogPost`, `CommentReply`)
- **Fields**: `camelCase` (e.g., `userId`, `createdAt`, `isPublished`)
- **Relations**: Explicit `@relation` names for clarity

```prisma
model Post {
  id       String    @id @default(cuid())
  author   User      @relation("UserPosts", fields: [authorId], references: [id])
  authorId String
  comments Comment[] @relation("PostComments")
}

model Comment {
  id     String @id @default(cuid())
  post   Post   @relation("PostComments", fields: [postId], references: [id])
  postId String
}
```

### Required Fields (Standard Template)

Every model **MUST** include:

```prisma
id        String   @id @default(cuid())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt
```

### Migration Workflow

1. **Development**: Use `prisma db push` (fast, no migration history)

   ```bash
   pnpm db:up
   npx prisma db push
   ```

2. **Before Deployment**: Use `prisma migrate dev` to create migration history

   ```bash
   npx prisma migrate dev --name add_user_profiles
   ```

3. **Production**: Apply migrations with
   ```bash
   npx prisma migrate deploy
   ```

### Database Connection

The Docker Compose setup provides:

- **Host**: `localhost`
- **Port**: `5432`
- **Database**: `hackathon`
- **User**: `admin`
- **Password**: `password123`

**Environment Variable** (`.env`):

```env
DATABASE_URL="postgresql://admin:password123@localhost:5432/hackathon"
```

---

## 2. Architecture Patterns

### Decision Tree: When to Use What

```
Need to render UI?
├─ Interactive (forms, clicks, state)?
│  └─ ✅ Client Component ("use client")
│     ├─ Form handling? → react-hook-form + zod
│     ├─ Real-time data? → SWR
│     └─ Mutations? → Call Server Action
│
└─ Static or data-fetching only?
   └─ ✅ Server Component (default)
      ├─ Read from DB → Direct Prisma calls
      └─ Mutations → Server Actions
```

### Server Components (RSC) - Default Choice

**Use for**: Pages, layouts, data-heavy components

```tsx
// app/posts/page.tsx
import { prisma } from "@/lib/prisma";

export default async function PostsPage() {
  // Direct database access - no API route needed
  const posts = await prisma.post.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      {posts.map((post) => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>By {post.author.name}</p>
        </article>
      ))}
    </div>
  );
}
```

### Server Actions - For All Mutations

**Use for**: Create, update, delete operations

```tsx
// app/actions/posts.ts
"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(10),
});

export async function createPost(formData: FormData) {
  // 1. Authenticate
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  // 2. Validate (ALWAYS validate server-side)
  const data = createPostSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
  });

  if (!data.success) {
    return { success: false, error: data.error.message };
  }

  // 3. Mutate database
  try {
    const post = await prisma.post.create({
      data: {
        ...data.data,
        authorId: userId,
      },
    });

    // 4. Revalidate cache
    revalidatePath("/posts");

    return { success: true, data: post };
  } catch (error) {
    return { success: false, error: "Failed to create post" };
  }
}
```

### Client Components - Only When Needed

**Use for**: Forms, interactive UI, hooks like `useState`, `useEffect`

```tsx
// components/create-post-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createPost } from "@/app/actions/posts";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(1, "Title required"),
  content: z.string().min(10, "Content too short"),
});

export function CreatePostForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: z.infer<typeof schema>) => {
    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("content", data.content);

    const result = await createPost(formData);

    if (result.success) {
      toast.success("Post created!");
    } else {
      toast.error(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("title")} />
      {errors.title && <p>{errors.title.message}</p>}

      <textarea {...register("content")} />
      {errors.content && <p>{errors.content.message}</p>}

      <button type="submit">Create</button>
    </form>
  );
}
```

### SWR Pattern - Real-Time Data

**Use for**: Client-side data that needs auto-revalidation, optimistic updates

```tsx
"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function LivePostList() {
  const { data, error, mutate } = useSWR("/api/posts", fetcher, {
    refreshInterval: 3000, // Poll every 3s
  });

  if (error) return <div>Failed to load</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <ul>
      {data.posts.map((post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}
```

### ⚠️ No API Routes (Unless External Webhooks)

**Don't create `/app/api/*` routes** unless you need:

- Webhook endpoints (Stripe, Clerk, etc.)
- External API access (mobile apps, third-party services)

For internal data fetching, use **Server Components + Server Actions**.

---

## 3. Authentication Integration (Clerk)

### Setup Checklist

1. **Environment Variables** (`.env.local`):

   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

2. **Wrap App in ClerkProvider** ([`app/layout.tsx`](app/layout.tsx)):

   ```tsx
   import { ClerkProvider } from "@clerk/nextjs";

   export default function RootLayout({ children }) {
     return (
       <ClerkProvider>
         <html lang="en">
           <body>{children}</body>
         </html>
       </ClerkProvider>
     );
   }
   ```

3. **Create Middleware** (`middleware.ts`):

   ```ts
   import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

   const isPublicRoute = createRouteMatcher([
     "/",
     "/sign-in(.*)",
     "/sign-up(.*)",
     "/api/webhooks(.*)",
   ]);

   export default clerkMiddleware(async (auth, request) => {
     if (!isPublicRoute(request)) {
       await auth.protect();
     }
   });

   export const config = {
     matcher: [
       "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
       "/(api|trpc)(.*)",
     ],
   };
   ```

### Getting User Data

**In Server Components**:

```tsx
import { auth, currentUser } from "@clerk/nextjs/server";

export default async function ProfilePage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId) {
    return <div>Not signed in</div>;
  }

  return <div>Hello {user?.firstName}!</div>;
}
```

**In Client Components**:

```tsx
"use client";

import { useAuth, useUser } from "@clerk/nextjs";

export function UserProfile() {
  const { userId } = useAuth();
  const { user } = useUser();

  return <div>{user?.firstName}</div>;
}
```

### Linking Clerk Users to Prisma

**Prisma Schema**:

```prisma
model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique // Link to Clerk userId
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
}
```

**Server Action (First Login)**:

```tsx
"use server";

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function syncUser() {
  const { userId } = await auth();
  if (!userId) return;

  // Check if user exists in DB
  let user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  if (!user) {
    // Create user on first login
    user = await prisma.user.create({
      data: {
        clerkId: userId,
        email: "...", // Get from Clerk user object
      },
    });
  }

  return user;
}
```

### UI Components

```tsx
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export function Header() {
  return (
    <header>
      <SignedOut>
        <SignInButton />
        <SignUpButton />
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </header>
  );
}
```

---

## 4. UI Development Workflow (ShadCN)

### Step-by-Step Component Installation

1. **Install Component**:

   ```bash
   npx shadcn@latest add button
   ```

2. **Import & Use**:

   ```tsx
   import { Button } from "@/components/ui/button";

   <Button variant="destructive" size="lg">
     Delete
   </Button>;
   ```

3. **Custom Styling with `cn()`**:

   ```tsx
   import { Button } from "@/components/ui/button";
   import { cn } from "@/lib/utils";

   <Button className={cn("bg-gradient-to-r from-purple-500 to-pink-500")}>
     Gradient Button
   </Button>;
   ```

### Using Icons (Lucide React)

```tsx
import { Trash2, Download, Plus } from "lucide-react";

<Button>
  <Plus className="mr-2 h-4 w-4" />
  Create Post
</Button>;
```

### Component Variants (CVA)

For complex conditional styles:

```tsx
import { cva, type VariantProps } from "class-variance-authority";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        success: "bg-green-500 text-white",
        warning: "bg-yellow-500 text-black",
      },
      size: {
        sm: "text-xs px-2 py-0.5",
        md: "text-sm px-2.5 py-0.5",
        lg: "text-base px-3 py-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export function Badge({
  variant,
  size,
  className,
  ...props
}: VariantProps<typeof badgeVariants>) {
  return (
    <span
      className={cn(badgeVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

### ShadCN Configuration

- **Style**: `new-york` (see [`components.json`](components.json))
- **Base Color**: `zinc`
- **CSS Variables**: Enabled (see [`app/globals.css`](app/globals.css))
- **Icon Library**: `lucide-react`
- **RSC Support**: Enabled

### Available Path Aliases

From [`components.json`](components.json):

```ts
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSomeHook } from "@/hooks/use-some-hook";
```

---

## 5. Form Handling Rules

### Standard Pattern (React Hook Form + Zod)

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// 1. Define schema
const formSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be 8+ characters"),
  age: z.coerce.number().min(18, "Must be 18+"),
});

type FormData = z.infer<typeof formSchema>;

export function SignupForm() {
  // 2. Setup form
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // 3. Handle submission
  const onSubmit = async (data: FormData) => {
    try {
      const result = await createUser(data); // Server Action

      if (result.success) {
        toast.success("Account created!");
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Something went wrong");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <input {...register("email")} type="email" />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      <div>
        <input {...register("password")} type="password" />
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Sign Up"}
      </Button>
    </form>
  );
}
```

### Server-Side Validation (ALWAYS Required)

**Never trust client-side validation alone.**

```tsx
"use server";

import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function createUser(data: unknown) {
  // Re-validate on server
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: "Invalid data" };
  }

  // Proceed with mutation
  // ...
}
```

### Optimistic Updates with SWR

```tsx
"use client";

import useSWR from "swr";
import { deletePost } from "@/app/actions/posts";

export function PostList() {
  const { data, mutate } = useSWR("/api/posts", fetcher);

  const handleDelete = async (postId: string) => {
    // Optimistic update
    mutate(
      (current) => ({
        ...current,
        posts: current.posts.filter((p) => p.id !== postId),
      }),
      false // Don't revalidate yet
    );

    const result = await deletePost(postId);

    if (!result.success) {
      // Revert on error
      mutate();
      toast.error("Failed to delete");
    }
  };

  return (
    <ul>
      {data?.posts.map((post) => (
        <li key={post.id}>
          {post.title}
          <button onClick={() => handleDelete(post.id)}>Delete</button>
        </li>
      ))}
    </ul>
  );
}
```

---

## 6. Database Workflow (Scripts)

### Development Cycle

| Command          | Purpose                                  | When to Use                  |
| ---------------- | ---------------------------------------- | ---------------------------- |
| `pnpm db:up`     | Start PostgreSQL container               | First time, or after restart |
| `pnpm db:down`   | Stop container (keeps data)              | End of day                   |
| `pnpm db:nuke`   | Delete all data, fresh start             | Reset database completely    |
| `pnpm hack:dev`  | Full dev setup: DB + schema + dev server | **Use this daily**           |
| `pnpm hack:prod` | Full prod build: DB + schema + build     | Test production build        |

### Typical Hackathon Day Workflow

```bash
# Morning: Start fresh
pnpm db:nuke

# Create your schema
# Edit prisma/schema.prisma

# Run dev server (auto-pushes schema)
pnpm hack:dev
# Opens http://localhost:3000

# Make schema changes during dev
npx prisma db push

# View database
npx prisma studio
# Opens http://localhost:5555

# End of day
pnpm db:down
```

### Database Connection Details

From [`docker-compose.yml`](docker-compose.yml):

- **Container Name**: `hackathon-db`
- **Image**: `postgres:18-alpine`
- **Port**: `5432:5432`
- **User**: `admin`
- **Password**: `password123`
- **Database**: `hackathon`
- **Volume**: `db_data` (persists across restarts)

### Health Check

The container includes a health check:

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U admin -d hackathon"]
  interval: 5s
  timeout: 5s
  retries: 5
```

The `wait-on` package ensures DB is ready before Prisma operations:

```json
"hack:dev": "docker compose up -d && wait-on tcp:5432 && npx prisma db push && next dev"
```

---

## 7. File Structure Conventions

```
my-app/
├── app/
│   ├── actions/           # Server Actions (one file per domain)
│   │   ├── posts.ts       # Post-related mutations
│   │   ├── users.ts       # User-related mutations
│   │   └── comments.ts    # Comment-related mutations
│   ├── api/               # Only for webhooks/external APIs
│   │   └── webhooks/
│   │       └── clerk/
│   │           └── route.ts
│   ├── (routes)/          # Route groups (optional)
│   │   ├── (auth)/
│   │   │   ├── sign-in/
│   │   │   └── sign-up/
│   │   └── (dashboard)/
│   │       ├── posts/
│   │       └── profile/
│   ├── globals.css        # Global styles + Tailwind imports
│   ├── layout.tsx         # Root layout (ClerkProvider here)
│   └── page.tsx           # Home page
│
├── components/
│   ├── ui/                # ShadCN components (auto-generated)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   └── toast.tsx
│   ├── create-post-form.tsx  # Custom components
│   └── post-list.tsx
│
├── lib/
│   ├── utils.ts           # cn() utility
│   ├── prisma.ts          # Prisma client singleton
│   └── validations.ts     # Shared Zod schemas
│
├── hooks/                 # Custom React hooks
│   └── use-posts.ts
│
├── types/                 # TypeScript types (if not colocated)
│   └── index.ts
│
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # (Optional) Seed data
│
├── public/                # Static assets
│   └── images/
│
├── .env.local             # Environment variables (DO NOT COMMIT)
├── components.json        # ShadCN config
├── docker-compose.yml     # PostgreSQL container
├── next.config.ts         # Next.js config (React Compiler enabled)
├── tsconfig.json          # TypeScript config
└── package.json           # Dependencies & scripts
```

### Naming Conventions

- **Server Actions**: `app/actions/{domain}.ts` (e.g., `posts.ts`, `comments.ts`)
- **Components**: `kebab-case.tsx` (e.g., `create-post-form.tsx`)
- **Utilities**: `kebab-case.ts` (e.g., `date-utils.ts`)
- **Hooks**: `use-{name}.ts` (e.g., `use-posts.ts`)

---

## 8. Styling Rules (Tailwind v4)

### Tailwind Best Practices

1. **Use utility classes** (avoid custom CSS unless necessary):

   ```tsx
   // ✅ GOOD
   <div className="flex items-center gap-4 p-6 rounded-lg bg-card">

   // ❌ AVOID
   <div className="my-custom-card">
   ```

2. **Responsive Design** (mobile-first):

   ```tsx
   <div className="w-full md:w-1/2 lg:w-1/3">
     <h1 className="text-2xl md:text-4xl lg:text-6xl">
   ```

3. **Dark Mode** (automatic via `.dark` class):

   ```tsx
   <div className="bg-white dark:bg-gray-900 text-black dark:text-white">
   ```

4. **Custom Colors** (defined in [`app/globals.css`](app/globals.css)):
   ```tsx
   <Button className="bg-primary text-primary-foreground">
   <div className="border-border bg-background text-foreground">
   ```

### CSS Variables (Tailwind v4)

From [`app/globals.css`](app/globals.css), colors are defined as CSS variables:

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.141 0.005 285.823);
  --primary: oklch(0.21 0.006 285.885);
  --destructive: oklch(0.577 0.245 27.325);
  /* ... */
}

.dark {
  --background: oklch(0.141 0.005 285.823);
  --foreground: oklch(0.985 0 0);
  /* ... */
}
```

Access via Tailwind classes:

```tsx
<div className="bg-background text-foreground">
<Button className="bg-destructive text-destructive-foreground">
```

### Animations (tw-animate-css)

Use pre-built animations:

```tsx
<div className="animate-fade-in">
<div className="animate-slide-up">
<div className="animate-bounce">
```

Or define custom animations in `globals.css`:

```css
@keyframes pulse-slow {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 3s ease-in-out infinite;
}
```

### Component Variants with CVA

See [Section 4](#4-ui-development-workflow-shadcn) for CVA pattern.

---

## 9. Performance Optimization

### React Compiler is Enabled

From [`next.config.ts`](next.config.ts):

```ts
const nextConfig: NextConfig = {
  reactCompiler: true, // ✅ Enabled
};
```

**What this means**:

- ✅ **No manual memoization needed** (`useMemo`, `useCallback`, `React.memo` are auto-optimized)
- ✅ Automatic dependency tracking for effects
- ✅ Optimized re-renders

**When to still use memoization**:

- Only if profiling shows a specific bottleneck
- For expensive calculations (use `React.useMemo` sparingly)

### Image Optimization

Always use `next/image`:

```tsx
import Image from "next/image";

<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1200}
  height={600}
  priority // For above-the-fold images
/>;
```

### Font Optimization

From [`app/layout.tsx`](app/layout.tsx):

```tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Use in className
<body className={geistSans.variable}>
```

### Code Splitting

- ✅ **Automatic**: Server/Client components are split automatically
- ✅ **Dynamic Imports**: Use for heavy components

```tsx
import dynamic from "next/dynamic";

const HeavyChart = dynamic(() => import("@/components/heavy-chart"), {
  loading: () => <p>Loading chart...</p>,
  ssr: false, // Disable SSR if needed
});
```

### Data Fetching Optimization

```tsx
// ✅ Parallel fetching in Server Components
async function Page() {
  const [posts, users, comments] = await Promise.all([
    prisma.post.findMany(),
    prisma.user.findMany(),
    prisma.comment.findMany(),
  ]);
}

// ❌ Sequential (slower)
const posts = await prisma.post.findMany();
const users = await prisma.user.findMany();
const comments = await prisma.comment.findMany();
```

---

## 10. Error Handling & Logging

### Server Actions (Standard Return Type)

```tsx
type ServerActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createPost(
  data: unknown
): Promise<ServerActionResult<Post>> {
  try {
    const post = await prisma.post.create({ data });
    return { success: true, data: post };
  } catch (error) {
    console.error("Create post error:", error);
    return { success: false, error: "Failed to create post" };
  }
}
```

### Client Error Handling

```tsx
"use client";

import { toast } from "sonner";

const result = await createPost(data);

if (result.success) {
  toast.success("Post created!");
  router.push(`/posts/${result.data.id}`);
} else {
  toast.error(result.error);
}
```

### Form Validation Errors

```tsx
const {
  register,
  setError,
  formState: { errors },
} = useForm();

const onSubmit = async (data) => {
  const result = await createPost(data);

  if (!result.success) {
    // Set field-specific error
    setError("root", {
      type: "manual",
      message: result.error,
    });
  }
};

// Display error
{
  errors.root && <p className="text-destructive">{errors.root.message}</p>;
}
```

### Global Error Boundary

Create `app/error.tsx`:

```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-2xl font-bold">Something went wrong!</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

### Toast Notifications (Sonner)

```tsx
import { toast } from "sonner";

// Success
toast.success("Post created!");

// Error
toast.error("Failed to save", {
  description: "Please try again later",
});

// Loading (with promise)
toast.promise(createPost(data), {
  loading: "Creating post...",
  success: "Post created!",
  error: "Failed to create post",
});

// Custom (with action)
toast("Event created", {
  action: {
    label: "Undo",
    onClick: () => deleteEvent(),
  },
});
```

Add `<Toaster />` to layout:

```tsx
import { Toaster } from "sonner";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

### ⚠️ No console.log in Production

Use environment-aware logging:

```tsx
const isDev = process.env.NODE_ENV === "development";

if (isDev) {
  console.log("Debug info:", data);
}
```

---

## 11. Deployment Readiness

### Pre-Deployment Checklist

#### 1. Environment Variables

Create `.env.production`:

```env
# Database
DATABASE_URL="postgresql://user:pass@prod-host:5432/dbname"

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."

# Next.js
NEXT_PUBLIC_APP_URL="https://yourapp.com"
```

#### 2. Database Migrations

```bash
# Create migration from schema changes
npx prisma migrate dev --name initial_schema

# Deploy to production
npx prisma migrate deploy
```

#### 3. Build Test

```bash
pnpm build
# Should complete without errors
```

#### 4. TypeScript Check

```bash
npx tsc --noEmit
# Should show 0 errors
```

#### 5. Lint Check

```bash
pnpm lint
# Fix all errors before deploying
```

### Production Database Setup

For hosted PostgreSQL (Neon, Supabase, Railway, etc.):

1. **Update `DATABASE_URL`** in production environment
2. **Run migrations**:
   ```bash
   npx prisma migrate deploy
   ```
3. **Generate Prisma Client**:
   ```bash
   npx prisma generate
   ```

### Seed Data (Optional)

Create `prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.create({
    data: {
      clerkId: "seed-user-1",
      email: "demo@example.com",
      name: "Demo User",
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

Run seed:

```bash
npx prisma db seed
```

### Deployment Platforms

| Platform         | Setup                                 |
| ---------------- | ------------------------------------- |
| **Vercel**       | Connect GitHub, auto-deploys on push  |
| **Railway**      | Connect GitHub, add PostgreSQL plugin |
| **Fly.io**       | `fly launch`, configure `fly.toml`    |
| **DigitalOcean** | App Platform, add database cluster    |

---

## 12. Common Patterns & Recipes

### Pattern: Pagination

```tsx
// Server Component
async function PostsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const page = Number(searchParams.page) || 1;
  const perPage = 10;

  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      skip: (page - 1) * perPage,
      take: perPage,
      orderBy: { createdAt: "desc" },
    }),
    prisma.post.count(),
  ]);

  const totalPages = Math.ceil(totalCount / perPage);

  return (
    <div>
      <PostList posts={posts} />
      <Pagination currentPage={page} totalPages={totalPages} />
    </div>
  );
}
```

### Pattern: Search

```tsx
// Server Component
async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const query = searchParams.q || "";

  const results = await prisma.post.findMany({
    where: {
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { content: { contains: query, mode: "insensitive" } },
      ],
    },
  });

  return <SearchResults results={results} query={query} />;
}
```

### Pattern: Infinite Scroll (SWR)

```tsx
"use client";

import useSWRInfinite from "swr/infinite";

export function InfinitePostList() {
  const getKey = (pageIndex: number, previousPageData: any) => {
    if (previousPageData && !previousPageData.posts.length) return null;
    return `/api/posts?page=${pageIndex + 1}`;
  };

  const { data, size, setSize } = useSWRInfinite(getKey, fetcher);

  const posts = data ? data.flatMap((page) => page.posts) : [];
  const isLoadingMore =
    size > 0 && data && typeof data[size - 1] === "undefined";

  return (
    <div>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
      <button onClick={() => setSize(size + 1)} disabled={isLoadingMore}>
        {isLoadingMore ? "Loading..." : "Load More"}
      </button>
    </div>
  );
}
```

### Pattern: File Upload

```tsx
"use client";

import { useState } from "react";
import { uploadFile } from "@/app/actions/files";

export function FileUploadForm() {
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    const result = await uploadFile(formData);

    if (result.success) {
      toast.success("File uploaded!");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button type="submit">Upload</button>
    </form>
  );
}
```

### Pattern: Real-Time with Polling

```tsx
"use client";

import useSWR from "swr";

export function LiveNotifications() {
  const { data } = useSWR("/api/notifications", fetcher, {
    refreshInterval: 5000, // Poll every 5 seconds
    revalidateOnFocus: true,
  });

  return (
    <div>
      {data?.notifications.map((notif) => (
        <div key={notif.id}>{notif.message}</div>
      ))}
    </div>
  );
}
```

### Pattern: Protected Route

```tsx
// app/dashboard/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch user-specific data
  const user = await prisma.user.findUnique({
    where: { clerkId: userId },
  });

  return <div>Welcome, {user?.name}!</div>;
}
```

---

## 13. Quick Reference

### Essential Commands

```bash
# Development
pnpm hack:dev              # Start DB + dev server

# Database
pnpm db:up                 # Start PostgreSQL
pnpm db:down               # Stop PostgreSQL
pnpm db:nuke               # Reset database
npx prisma studio          # View database (localhost:5555)
npx prisma db push         # Push schema changes (dev)
npx prisma migrate dev     # Create migration (before deploy)

# ShadCN
npx shadcn@latest add button  # Install component

# Build
pnpm build                 # Production build
pnpm start                 # Run production build
pnpm lint                  # Run ESLint
```

### File Paths Quick Reference

- **Server Actions**: `app/actions/{domain}.ts`
- **Prisma Client**: `lib/prisma.ts`
- **Utilities**: `lib/utils.ts`
- **Components**: `components/` (custom), `components/ui/` (ShadCN)
- **Hooks**: `hooks/use-{name}.ts`
- **Types**: `types/` or colocate with features
- **Schema**: `prisma/schema.prisma`

### Import Aliases (from [`tsconfig.json`](tsconfig.json))

```tsx
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createPost } from "@/app/actions/posts";
import { usePosts } from "@/hooks/use-posts";
```

---

## 🚀 Getting Started (Day 1 of Hackathon)

1. **Clone this repo** (already done)

2. **Install dependencies**:

   ```bash
   pnpm install
   ```

3. **Create `.env.example`** (template for required environment variables):

   ```bash
   cat > .env.example << 'EOF'
   # Database (Docker Compose default)
   DATABASE_URL="postgresql://admin:password123@localhost:5432/hackathon"

   # Clerk Authentication (get from https://dashboard.clerk.com)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
   CLERK_SECRET_KEY="sk_test_..."

   # Optional: App URL (for production)
   # NEXT_PUBLIC_APP_URL="https://yourapp.com"
   EOF
   ```

4. **Setup environment variables** (copy `.env.example` to `.env.local`):

   ```bash
   cp .env.example .env.local
   # Then edit .env.local with your actual Clerk keys
   ```

5. **Create Prisma schema** (`prisma/schema.prisma`):

   ```prisma
   generator client {
     provider = "prisma-client-js"
   }

   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   model User {
     id        String   @id @default(cuid())
     clerkId   String   @unique
     email     String   @unique
     name      String?
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
   }
   ```

6. **Setup Clerk** (add `ClerkProvider` to `app/layout.tsx`, create `middleware.ts`)

7. **Start building**:

   ```bash
   pnpm hack:dev
   ```

8. **Install ShadCN components as needed**:
   ```bash
   npx shadcn@latest add button input card
   ```

---

## 📚 Additional Resources

- [Next.js 15 Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Clerk Docs](https://clerk.com/docs)
- [ShadCN UI](https://ui.shadcn.com)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)
- [SWR](https://swr.vercel.app)

---

**Last Updated**: 2025-11-29  
**Template Version**: 1.0.0
