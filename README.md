# Selected Reply

A desktop plugin for stock Paseo. Select part of an assistant message, click **Reply**, and optionally add a comment. The quote becomes an editable attachment in the normal chat draft. Press Enter in the main composer to send when ready.

## Install

Clone this repository and install its dependencies:

```sh
gh repo clone loftiskg/paseo-reply
cd paseo-reply
npm ci --ignore-scripts
```

In Paseo Settings → Plugins, install the cloned directory. Or, from that directory, use the bundled macOS CLI:

```sh
/Applications/Paseo.app/Contents/Resources/bin/paseo plugin add "$PWD"
```

If plugins are disabled, enable them in Paseo Settings first. Disable other selection/reply plugins to avoid overlapping selection toolbars. Use the default plugin ID `selected-reply`; installing under an overridden ID is not supported. Lucide icons are bundled at compile time, and the plugin has no daemon code.

## Use

1. Highlight text within one assistant message, including a code block.
2. Click **Reply**, type an optional comment, and click **Add to chat** (or press Enter). Shift+Enter inserts a newline. Escape or the close control abandons that editor without adding a quote.
3. Repeat to collect several quotes. Existing message text and other attachments stay intact.
4. Click a quote attachment, then its excerpt to expand the complete selected text, edit its comment, or remove it. The quote text itself is immutable. Saving a blank comment keeps the quote.
5. Send using Paseo's usual composer controls, including an otherwise empty message containing only quote attachments.

Draft quotes use Paseo's native local draft storage, including switching chats and reloading. They are not synchronized to other devices by this plugin. Once sent, Paseo owns the submitted attachment; this version does not add editing controls to sent messages. Side chats and mobile selection are not included.

## Compatibility and data

This version supports the **installed macOS Paseo 0.13.0 renderer** whose script is `index-f1a1407fb8de7ac3fefc1cc576f0e46f.js`. The manifest accepts 0.13.x, but the runtime adapter deliberately refuses other renderer fingerprints, including other builds of the same version. Unknown builds show a compatibility message and do not modify drafts. A version upgrade requires a reviewed adapter update.

The plugin does not modify Paseo files. It reads the selected DOM text, source message ID, and private React props to identify the conversation and host; it accesses Paseo's existing draft store through a guarded private Metro module. That bridge is in `client/web.ts`; draft mutation is in `client/draft.ts`. One shared UI instance handles all connected hosts, always using a host-qualified draft key. The plugin has no network requests, external backend, clipboard access, or direct agent-send calls.

Quote text and optional comments are stored as native `plugin_resource` attachments. Selected text retains its exact DOM Range string, including code whitespace; this is rendered text, not the original Markdown markup. Source identity and editable text are stored in the attachment's schema-supported subtitle. The agent receives the selected text and comment paired in the attachment body through Paseo's normal submission path.

The native draft store owns submission, queueing, clearing and failure restoration. If persistence fails, the editor reports that saving is unconfirmed and offers **Retry saving**; it never blindly rolls back newer text. Do not reload or disable the plugin while a save is unconfirmed. Disabling the plugin leaves existing native draft attachments intact.

## Development and verification

```sh
npm ci --ignore-scripts
npm run check
npm run preview
```

The preview is at http://127.0.0.1:4318. It uses the real plugin UI and React fibers with a mock draft store and mock sending. No agent receives preview messages.

Tests cover whitespace preservation, empty comments, multiple annotations, unrelated attachments, host isolation, concurrent edits, stale/sent annotations, hydration, persistence failures, selection boundaries, compatibility rejection, and UI cleanup. An installed-renderer contract test executes only the app's pure schema/serialization modules, ensuring native persistence retains our metadata and native submission receives quote text. That test is skipped if the supported macOS bundle is absent; set `PASEO_RENDERER_BUNDLE` to its path elsewhere.

Validation on 2026-10-26: typecheck and all 16 automated tests passed, including dark/light contrast regressions. Compiled and reloaded successfully with Paseo 0.13.0's plugin compiler. Browser fixture checks covered blank comments, code, edits, chat switching/reload, removal, annotation-only sending, and persistence retry. Installed and exercised in a real Paseo chat: selected quotes and a quote with a comment reached the agent. Live queued/failed submissions still need smoke testing.

Built from scratch against Paseo's source and installed renderer contracts. No community plugin implementation was copied.
