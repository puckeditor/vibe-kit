# @puckeditor/vibe-kit

Let the people in your company build their own tools by describing them. You connect your APIs and describe your design system. AI builds each app on your data, in your style, and your server checks every call.

```
"A table of open orders, where I can refund each one"
        │
        ▼
  AI designs the app ──► scripts call your APIs ──► your server checks and answers
```

## How it works

1. **You write a kit.** It lists the APIs apps may call to read and change data, and rules for how apps look.
2. **A colleague describes an app** in the app builder, such as "A table of open orders, where I can refund each one".
3. **The AI designs the app.** It writes each part of the page, with HTML, CSS and a script, to your design rules. Scripts reach your data only by calling your APIs by name.
4. **Your server runs each call** through the handler you wrote, as the person signed in. It checks the input first, and only returns the fields you declare.
5. **The colleague publishes the app**, and anyone signed in can open it.

vibe-kit builds on [Puck](https://puckeditor.com), a visual editor for React. You don't need to know Puck to use it.

| Term              | What it is                                                                                |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Puck Cloud        | Puck's hosted service. It saves each app, runs the AI, and signs people in                |
| Puck AI           | The AI in the app builder's chat. It designs every app                                    |
| Sign in with Puck | How people sign in to your app builder: with the account they use for Puck Cloud          |
| Kit               | Your APIs and rules, from `defineVibeKit`                                                 |
| App frame         | Your layout around every app, such as a header and your theme. Optional                   |
| `window.vibeKit`  | What the AI's scripts call your APIs with, such as `await vibeKit.read("listOrders", {})` |

## Before you start

You need:

- A [Next.js](https://nextjs.org) app that uses the App Router, with React 19. vibe-kit works in other React apps too, but these docs use Next.js.
- A [Puck Cloud](https://cloud.puckeditor.com) account. Create a project for your apps, then an API key for it under **Settings › API Keys**. The key decides which project apps are saved in.
- Everyone who'll build or use apps to sign in with Puck. Members of the project's organisation can, and you can invite anyone else as an editor from the project's **Auth** page.

## Set up

### 1. Install

vibe-kit isn't on npm yet, so install it from GitHub, with the Puck packages it builds on:

```sh
pnpm add git+https://github.com/puckeditor/vibe-kit.git @puckeditor/core @puckeditor/cloud-client @puckeditor/plugin-ai @puckeditor/plugin-pages @puckeditor/plugin-auth @puckeditor/ai-types zod
```

vibe-kit ships TypeScript, so tell Next.js to compile it:

```js
// next.config.js
module.exports = {
  transpilePackages: ["@puckeditor/vibe-kit"],
};
```

Add your API key to `.env.local`:

```sh
PUCK_API_KEY=your-api-key
```

### 2. Define your kit

A kit lists your APIs and how the AI should build. Describe each API's input and output with [zod](https://zod.dev) schemas. The AI reads the descriptions to choose an API, and the server checks every call against the schemas.

```ts
// kit.ts
import { defineVibeKit } from "@puckeditor/vibe-kit";
import { z } from "zod/v4";

const order = z.object({
  id: z.string(),
  customer: z.string(),
  total: z.number().meta({ format: "currency" }),
  status: z.enum(["open", "refunded"]),
});

export const kit = defineVibeKit({
  reads: {
    listOrders: {
      description: "Orders, newest first.",
      input: z.object({ status: z.enum(["open", "refunded"]).optional() }),
      output: z.array(order),
    },
  },
  writes: {
    refundOrder: {
      description: "Refund an order in full.",
      input: z.object({ id: z.string() }),
      output: order,
      confirm: "Refund this order?", // Asked before every call
    },
  },
  ai: {
    context: "We sell coffee beans. Apps are for our support team.",
    designRules: `Use var(--brand) for the main button. Put content in white
cards with 16px corners and a 1px grey border. Never use shadows.`,
  },
});
```

The kit holds schemas, not code that reaches your data, so it's safe to import in the browser.

### 3. Serve your APIs

One route serves your APIs and everything the app builder needs from Puck Cloud. It must live at `/api/puck`.

```ts
// app/api/puck/[...all]/route.ts
import {
  createVibeKitHandler,
  VibeKitError,
} from "@puckeditor/vibe-kit/server";
import { kit } from "../../../../kit";
import { db } from "../../../../db"; // Your data

const handler = createVibeKitHandler(kit, {
  reads: {
    listOrders: ({ status }) => db.orders.list({ status }),
  },
  writes: {
    // `user` is the person signed in with Puck
    refundOrder: async ({ id }, { user }) => {
      const order = await db.orders.get(id);

      // A VibeKitError's message is shown to the person in the app
      if (order.total > 500) {
        throw new VibeKitError("Refunds over $500 need finance's approval");
      }

      return db.orders.refund(id, { by: user.email });
    },
  },
});

export { handler as DELETE, handler as GET, handler as POST };
```

TypeScript checks each handler against the kit's schemas.

### 4. Add the app builder

People must sign in before they build. Add a helper that sends them to Sign in with Puck:

```ts
// lib/session.ts
import puckCloud, { loginUrl } from "@puckeditor/cloud-client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const puck = puckCloud(); // Reads PUCK_API_KEY

export async function requireSession(returnTo: string) {
  const session = await puck.auth.getSession(await headers());

  if (!session) redirect(loginUrl(returnTo));

  return session;
}
```

The builder runs in the browser, so put it in a client component, then show it from a page:

```tsx
// components/Builder.tsx
"use client";

import { AppBuilder, type InitialPrompt } from "@puckeditor/vibe-kit/builder";
import { kit } from "../kit";

export function Builder({ initialPrompt }: { initialPrompt?: InitialPrompt }) {
  return (
    <AppBuilder
      kit={kit}
      examplePrompts={["Add a table of open orders"]}
      initialPrompt={initialPrompt}
    />
  );
}
```

```tsx
// app/build/page.tsx
import { Builder } from "../../components/Builder";
import { requireSession } from "../../lib/session";

export default async function Page() {
  await requireSession("/build");

  return <Builder />;
}

export const dynamic = "force-dynamic";
```

### 5. Show published apps

Published apps run at `/apps/<name>`, where the builder's **View page** link opens them:

```tsx
// components/App.tsx
"use client";

import type { Data } from "@puckeditor/core";
import { AppView } from "@puckeditor/vibe-kit/client";
import { kit } from "../kit";

export function App({ data }: { data: Data }) {
  return <AppView kit={kit} data={data} />;
}
```

```tsx
// app/apps/[...path]/page.tsx
import { notFound } from "next/navigation";
import { App } from "../../../components/App";
import { puck, requireSession } from "../../../lib/session";

export default async function Page({
  params,
}: {
  params: Promise<{ path: string[] }>;
}) {
  const path = `/${(await params).path.join("/")}`;

  await requireSession(`/apps${path}`);

  // Each app is a page in Puck Cloud, at its own path
  const page = await puck.pages.getPublished(path);

  if (!page) notFound();

  return <App data={page.data} />;
}

export const dynamic = "force-dynamic";
```

### 6. Build your first app

Run `pnpm dev` and open http://localhost:3000/build. Sign in, describe an app in the chat, then publish it with **Save & publish**.

Sign-in works on localhost straight away. Wherever else the app builder runs, set its address as the project's **App URL**, from **Settings** in the menu on the project's **Auth** page in Puck Cloud.

## Make apps look like yours

### Write design rules

Without design rules, the AI designs in its own style. Write `ai.designRules` as you'd brief a designer: the colours, fonts, sizes and corners to use, how parts such as buttons, tables and charts look, and what never to do. The more exact the rules, the more alike your apps look.

Name CSS variables rather than repeating values, and set them in your app frame:

```ts
designRules: `## Our design rules

- Colours: var(--brand) for the main action, var(--text) for text, var(--border) for every border.
- Font: var(--font). Sizes 14px, 16px and 24px only.
- Cards: white, 1px solid var(--border), 16px corners, 24px padding, no shadows.
- Buttons: 40px high, 8px corners, 14px bold text, named after what they do, such as "Refund Order".
- Show "Loading…" while data loads, and the error's message when a call fails.`,
```

See [vibe-kit-huntington](https://github.com/puckeditor/vibe-kit-huntington/blob/main/kit/design-rules.ts) for complete rules, taken from a bank's design system.

### Add an app frame

The frame is your layout around every app. It gets the app's name, and the AI's components as `children`. Set your CSS variables on it, so every app has them:

```tsx
// components/AppFrame.tsx
import type { CSSProperties, ReactNode } from "react";

export function AppFrame({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      style={
        {
          "--brand": "#2a6df4",
          "--text": "#1a1a1a",
          "--border": "#dddddd",
          "--font": "Inter, sans-serif",
          fontFamily: "var(--font)",
        } as CSSProperties
      }
    >
      <h1>{title}</h1>
      <main>{children}</main>
    </div>
  );
}
```

Pass it to both the builder and published apps, so they match:

```tsx
<AppBuilder kit={kit} frame={AppFrame} />
<AppView kit={kit} data={data} frame={AppFrame} />
```

### Start apps from a prompt

Let people start an app by naming and describing it, on your home page. `useCreateApp` saves the new app, then the builder opens it and sends the description to the AI:

```tsx
// components/NewApp.tsx
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useCreateApp } from "@puckeditor/vibe-kit/builder";

export function NewApp() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const { create, error, isCreating } = useCreateApp();

  const start = async (event: FormEvent) => {
    event.preventDefault();

    // Resolves to the app's path, such as "/refund-desk"
    const path = await create({ name, prompt });

    if (path) router.push(`/build?${new URLSearchParams({ path, prompt })}`);
  };

  return (
    <form onSubmit={start}>
      <input
        placeholder="App name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <textarea
        placeholder="What should it do?"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
      />
      {error && <p role="alert">{error}</p>}
      <button disabled={isCreating}>Build App</button>
    </form>
  );
}
```

```tsx
// app/page.tsx
import { NewApp } from "../components/NewApp";
import { requireSession } from "../lib/session";

export default async function Page() {
  await requireSession("/");

  return <NewApp />;
}

export const dynamic = "force-dynamic";
```

Then have the builder's page pass the description on, once the app has loaded:

```tsx
// app/build/page.tsx
import { Builder } from "../../components/Builder";
import { puck, requireSession } from "../../lib/session";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ path?: string; prompt?: string }>;
}) {
  const { path, prompt } = await searchParams;

  await requireSession(`/build?${new URLSearchParams(path ? { path } : {})}`);

  // The builder knows the app has loaded when it shows the app's name
  const page = prompt && path ? await puck.pages.getByPath(path) : null;
  const appTitle = page?.data.root.props?.title;

  return (
    <Builder
      initialPrompt={prompt && appTitle ? { prompt, appTitle } : undefined}
    />
  );
}

export const dynamic = "force-dynamic";
```

## How apps reach your data

The AI gives every part of an app that shows or changes data a script. Scripts call your APIs with `window.vibeKit`, which `AppBuilder` and `AppView` set up:

```js
const orders = await vibeKit.read("listOrders", { status: "open" });
const { data, dryRun } = await vibeKit.write("refundOrder", { id });
const stop = vibeKit.onChange(() => render()); // After every write that changes data
```

| Method                       | What it does                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `vibeKit.read(name, input)`  | Returns the read's data. Repeated reads share one request until a write changes data          |
| `vibeKit.write(name, input)` | Checks the input, asks to confirm when the API has `confirm`, then returns `{ data, dryRun }` |
| `vibeKit.onChange(callback)` | Calls `callback` after every write that changes data. Returns a function that stops           |

`read` and `write` throw on failure, with the reason in `message`, invalid input in `issues`, and `cancelled` when the person declines to confirm.

In the builder, writes are test runs: they check the input, but your handler doesn't run, so trying an app changes nothing.

## Keep data safe

- **Your server decides.** Apps only reach data through your handlers, which run on your server as the person signed in.
- **Every call is checked.** The server checks input against the API's schema before your handler runs, and drops any output field the schema doesn't declare.
- **Only your client gets in.** The API routes refuse requests without the header `vibeKit` sends, so the AI's scripts can't call them any other way.
- **The AI sees schemas, not data.** Unless you set `ai.readData`, the AI only knows what your APIs return, not what's in them.
- **Scripts run as the person.** The AI's scripts run in the browser of whoever opens the app, so they can do what that person can do through your APIs, and nothing more.

Throw `VibeKitError` from a handler to show the person why a call failed. Other errors show as "Something went wrong".

To use your own sign-in instead of Puck's, pass `context(request)` to `createVibeKitHandler`. It returns what your handlers get as their second argument, or `null` to refuse the call.

## Reference

### `defineVibeKit(kit)`

From `@puckeditor/vibe-kit`. Returns the kit.

| Option   | Type                               | What it is                                    |
| -------- | ---------------------------------- | --------------------------------------------- |
| `reads`  | Record of [read APIs](#read-api)   | The APIs apps read data from, keyed by name   |
| `writes` | Record of [write APIs](#write-api) | The APIs apps change data with, keyed by name |
| `ai`     | [AI rules](#ai-rules)              | How the AI builds apps                        |

#### Read API

| Option        | Type       | What it is                                                               |
| ------------- | ---------- | ------------------------------------------------------------------------ |
| `description` | String     | What it returns, so the AI knows when to use it. Required                |
| `output`      | zod schema | What it returns. Fields it doesn't declare never reach the app. Required |
| `input`       | zod object | What apps may send, such as filters                                      |
| `label`       | String     | A readable name, such as "Orders". Defaults to its key, in sentence case |

#### Write API

| Option        | Type       | What it is                                                                   |
| ------------- | ---------- | ---------------------------------------------------------------------------- |
| `description` | String     | What it does, so the AI knows when to use it. Required                       |
| `input`       | zod object | What apps must send. The server checks it before your handler runs. Required |
| `output`      | zod schema | What it returns                                                              |
| `confirm`     | String     | A question to ask before every call, such as "Refund this order?"            |
| `label`       | String     | A readable name. Defaults to its key, in sentence case                       |

Set a field's label and format with zod's `meta`, such as `z.number().meta({ title: "Total", format: "currency" })`.

#### AI rules

| Option            | Type    | What it is                                                                                |
| ----------------- | ------- | ----------------------------------------------------------------------------------------- |
| `context`         | String  | What the AI should know about your business and the people using the apps                 |
| `designRules`     | String  | How every part of every app must look and behave                                          |
| `readData`        | Boolean | Let the AI call your read APIs while it builds, to design around real data. Default false |
| `model`           | String  | The AI model, such as `"openai/gpt-5.6-luna"`. Defaults to Puck's                         |
| `maxIterations`   | Number  | How many steps the AI may take for each prompt. Capped at 50                              |
| `providerOptions` | Object  | Options for the model's provider, such as `{ openai: { reasoningEffort: "low" } }`        |

### `createVibeKitHandler(kit, options)`

From `@puckeditor/vibe-kit/server`. Returns a function that takes a `Request` and returns a `Response`.

| Option    | What it is                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `reads`   | Your handler for each read API: `(input, context) => data`. Required                                   |
| `writes`  | Your handler for each write API: `(input, context) => data`. Required                                  |
| `context` | `(request) => context`: who's calling, or `null` to refuse. Defaults to the person signed in with Puck |
| `puck`    | Options for Puck Cloud, such as `apiKey` and `host`. Defaults to `PUCK_API_KEY`                        |

| Route                           | What it does                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `POST /api/puck/reads/:name`    | Checks who's calling and the input, runs your read handler, checks its output |
| `POST /api/puck/writes/:name`   | The same for writes. With `dryRun: true`, only checks the input               |
| Anything else under `/api/puck` | Puck Cloud: the AI, saving and publishing apps, and signing in                |

### `VibeKitError(message, status?)`

From `@puckeditor/vibe-kit/server`. Throw it from a handler to show `message` to the person. `status` defaults to 400.

### `AppBuilder`

From `@puckeditor/vibe-kit/builder`. The editor where people describe and build apps.

| Prop             | What it is                                                                    |
| ---------------- | ----------------------------------------------------------------------------- |
| `kit`            | The kit. Required                                                             |
| `frame`          | Your [app frame](#add-an-app-frame)                                           |
| `examplePrompts` | Prompts the chat suggests, such as `["Add a table of open orders"]`           |
| `initialPrompt`  | `{ prompt, appTitle }`: a prompt to send once the app called `appTitle` loads |
| `siteUrl`        | Where published apps run, for the **View page** link. Defaults to `/apps`     |

### `AppView`

From `@puckeditor/vibe-kit/client`. Runs a published app.

| Prop    | What it is                                                      |
| ------- | --------------------------------------------------------------- |
| `kit`   | The kit. Required                                               |
| `data`  | The app, from Puck Cloud's `pages.getPublished(path)`. Required |
| `frame` | Your [app frame](#add-an-app-frame)                             |

### `useCreateApp()`

From `@puckeditor/vibe-kit/builder`. Returns `{ create, error, isCreating }`. `create({ name, prompt })` saves a new app named `name`, and resolves to its path, or to `undefined` with the reason in `error`.

### Other exports

| Export                                   | What it is                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `toAppPath(name)`                        | The path an app called `name` gets, such as `/refund-desk`             |
| `humanize(key)`                          | A key in sentence case, such as "List orders" for `listOrders`         |
| `describeKit(kit)`                       | The Markdown the AI gets about your APIs                               |
| `VibeKitProvider`, `createVibeKitPlugin` | For building your own editor with Puck, rather than using `AppBuilder` |

## Example

[vibe-kit-huntington](https://github.com/puckeditor/vibe-kit-huntington) is a complete app builder for a bank, with a home page, design rules taken from the bank's website, and mocked APIs.

## Develop

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm format:check
```
