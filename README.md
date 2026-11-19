# @puckeditor/vibe-kit

Let people build apps from your components and APIs with Puck AI, within the rules you set.

You define a kit: the APIs apps read and write, and how the AI may build them. Apps are Puck pages, so the AI composes your components and binds them to your APIs by name. It never writes code that reaches your data.

## Install

It isn't on npm yet. Install it from this repo, alongside the Puck packages it builds on:

```sh
pnpm add git+https://github.com/puckeditor/vibe-kit.git @puckeditor/core @puckeditor/cloud-client @puckeditor/plugin-ai @puckeditor/plugin-pages @puckeditor/plugin-auth @puckeditor/ai-types zod
```

It ships TypeScript source, so let your bundler compile it. In Next.js:

```js
// next.config.js
module.exports = { transpilePackages: ["@puckeditor/vibe-kit"] };
```

In Vitest, add `server: { deps: { inline: ["@puckeditor/vibe-kit"] } }` to `test`.

See [vibe-kit-huntington](https://github.com/puckeditor/vibe-kit-huntington) for a complete app builder.

## Develop

```sh
pnpm install
pnpm test
pnpm typecheck
pnpm format:check
```

## Define a kit

Import the kit on the server and in the editor. It holds schemas, not handlers.

```ts
// kit.ts
import { defineVibeKit } from "@puckeditor/vibe-kit";
import { z } from "zod/v4";

export const kit = defineVibeKit({
  reads: {
    listTickets: {
      description: "Support tickets, newest first.",
      input: z.object({ status: z.enum(["open", "closed"]).optional() }),
      output: z.array(z.object({ id: z.string(), subject: z.string() })),
    },
  },
  writes: {
    closeTicket: {
      description: "Mark a ticket as resolved.",
      input: z.object({ id: z.string() }),
      confirm: "Close this ticket?", // Asked before every call
    },
  },
  ai: {
    context: "We build internal tools for our support team.",
    designMode: { allowed: false }, // Only your components
    readData: false, // The AI sees schemas, never data
  },
});
```

`ai` takes the policy options of `puckHandler`'s `ai`, such as `designMode.allowed` and `designMode.scripts`, plus `readData`. With `readData`, the AI gets a tool per read API, and can leave out optional inputs with `null`.

## Serve the APIs

Serve the kit's APIs and Puck's routes from one route handler.

```ts
// app/api/puck/[...all]/route.ts
import {
  VibeKitError,
  createVibeKitHandler,
} from "@puckeditor/vibe-kit/server";

const handler = createVibeKitHandler(kit, {
  reads: {
    listTickets: ({ status }, { user }) => db.tickets.list({ status }),
  },
  writes: {
    closeTicket: ({ id }, { user }) => {
      if (!canClose(user)) throw new VibeKitError("Only leads can close", 403);

      return db.tickets.close(id);
    },
  },
});

export { handler as DELETE, handler as GET, handler as POST };
```

| Route                         | What it does                                                         |
| ----------------------------- | -------------------------------------------------------------------- |
| `POST /api/puck/reads/:name`  | Checks who's calling and the input, runs the read, checks its output |
| `POST /api/puck/writes/:name` | The same for writes. `dryRun: true` only checks the input            |
| Anything else                 | `puckHandler`, with Sign in with Puck and the kit's AI rules         |

The routes only answer the kit's own client, which sends an `x-puck-vibe-kit` header, so generated code goes through `vibeKit`.

Handlers get the Sign in with Puck user by default. Pass `context(request)` to use your own auth, and `puck` to pass options to `puckHandler`.

Output schemas strip fields they don't declare, so apps only see what you allow. Throw `VibeKitError` to show a message to the user. Other errors show as a generic failure.

## Bind components

Use the field factories in your Puck config. The AI can only pick APIs and fields the kit declares, and each field tells it what they return.

```tsx
import { inputField, keyField, readField } from "@puckeditor/vibe-kit";

const Table = {
  fields: {
    source: readField(kit, { shape: "list" }),
    filters: inputField(kit),
    column: keyField(kit, { shape: "list" }),
  },
  // Offer the chosen read's fields and inputs in the editor
  resolveFields: ({ props }, { fields }) => ({
    ...fields,
    filters: inputField(kit, { read: props.source }),
    column: keyField(kit, { shape: "list", read: props.source }),
  }),
  render: (props) => <MyTable {...props} />,
};
```

| Helper          | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `readField`     | Select a read, optionally only those returning a `list` or `record` |
| `writeField`    | Select a write                                                      |
| `keyField`      | Select a field of a read's output, optionally of one type           |
| `inputField`    | List fixed input for a read, such as filters. Empty by default      |
| `pickReadInput` | Turn an `inputField` value into the chosen read's input             |

Puck AI must fill every field it sees, so `inputField` is a list: the AI only adds the filters an app needs, rather than choosing a value for every read's every input. `pickReadInput` reports the ones the chosen read refuses, so components can show them in the editor.

## Call the APIs

Wrap the editor and the rendered app in `VibeKitProvider`, then use `useRead` and `useWrite` in components.

```tsx
"use client";
import { pickReadInput } from "@puckeditor/vibe-kit";
import { useVibeKit, useRead, useWrite } from "@puckeditor/vibe-kit/client";

function MyTable({ source, filters }) {
  const { kit } = useVibeKit();
  const { input } = pickReadInput(kit, source, filters);
  const { data, error, isLoading } = useRead(source, input);
  const close = useWrite("closeTicket");

  // close.call({ id }) checks the input, asks to confirm, then reads again
}
```

Set `dryRun` on the editor's provider, so trying an app while building it changes nothing. Add `createVibeKitPlugin()` so scripts in the editor's preview get `vibeKit` too.

```tsx
<VibeKitProvider kit={kit} dryRun>
  <Puck
    config={config}
    plugins={[...plugins, createVibeKitPlugin()]}
    data={{}}
  />
</VibeKitProvider>
```

## Call the APIs from scripts

When the rules allow `designMode.scripts`, the AI can design components whose scripts call the kit's APIs through `window.vibeKit`. The kit adds how to use it to the AI's design-mode instructions.

```js
const customers = await vibeKit.read("listCustomers", { plan: "growth" });
const { data, dryRun } = await vibeKit.write("closeTicket", { id });
const stop = vibeKit.onChange(() => render()); // After every write that changes data
```

| Method                       | What it does                                                                                                    |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `vibeKit.read(name, input)`  | Returns the read's data. Shares requests with `useRead`                                                         |
| `vibeKit.write(name, input)` | Returns `{ data, dryRun }`. Checks the input and asks to confirm, like `useWrite`                               |
| `vibeKit.onChange(callback)` | Calls `callback` after every write that changes data, from scripts or components. Returns a function that stops |

`read` and `write` throw on failure, with the reason in `message`, invalid inputs in `issues`, and `cancelled` when the user declines to confirm. `VibeKitProvider` puts `vibeKit` on the window it renders in, and `createVibeKitPlugin()` on the editor's preview.

## Render apps

`AppView` runs a published page under the kit's rules. It only renders AI-designed components when the rules allow design mode, and removes their scripts unless the rules allow scripts.

```tsx
"use client";
import { AppView } from "@puckeditor/vibe-kit/client";

<AppView kit={kit} config={config} data={page.data} />;
```

`applyRules(kit, config, data)` does the preparing, for your own `<Render>`.

## Build apps

`@puckeditor/vibe-kit/builder` has a ready-made editor for building apps, and a hook to create them. It needs `@puckeditor/plugin-pages` and `@puckeditor/plugin-auth`.

```tsx
"use client";
import { AppBuilder, useCreateApp } from "@puckeditor/vibe-kit/builder";

// Puck AI's chat in the plugin bar, the live app filling the rest
<AppBuilder
  kit={kit}
  config={config} // The app frame
  examplePrompts={["Add our key numbers at the top"]}
  initialPrompt={{ prompt, appTitle }} // Sent once the app loads
/>;

// Creates a page titled with the app's name, and resolves to its path
const { create, error, isCreating } = useCreateApp();
const path = await create({ name: "Fraud queue", prompt });
```

The editor stays in design mode when the rules allow it, starts the app interactive, and only checks writes' input, so trying an app's actions while building it changes nothing.

## Describe schemas

`describeFields(schema)` lists an object schema's fields, or an array's items', with labels, types, formats and enum options. Use it to render forms or columns. Set labels and formats with zod's `meta`:

```ts
z.number().meta({ title: "MRR", format: "currency" });
```

`describeKit(kit)` returns the Markdown the AI gets about the kit's APIs.
