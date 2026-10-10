---
name: fetch-ticket
description: Fetch a ticket/issue from a connected Kaneo MCP and load its context into the conversation. Use when the user references a ticket by ID or description ("look at APP-12", "what's this issue about", "find the ticket for X") without pasting its full content.
---

# Fetch Ticket

Use the connected **Kaneo** MCP. Server names, tool prefixes, and parameter names vary by
configuration; discover available tools through the environment's tool discovery mechanism
and inspect their schemas. Common operations include `list_tasks`, `get_task`,
`list_projects`, and `list_task_comments`. Don't guess ticket content or fabricate IDs.

## 1. Resolve the server and project

Use the user's specified server/project or an existing repository tracker mapping when
available. Otherwise, discover workspaces and projects using the selected MCP's available
read operations, matching the ticket prefix or repository context against returned project
metadata. If multiple servers or projects remain plausible, ask the user to choose.

Prefer scoped, paginated, or metadata-only discovery when supported. Some `list_projects`
implementations return full nested task trees; avoid unbounded responses and narrow the
workspace/project before fetching tasks. Reuse the resolved mapping within the conversation,
and keep all calls on the same MCP server.

## 2. Find the ticket

Prefer a direct identifier lookup or task search if the MCP supports it. Otherwise, ticket
IDs like `APP-12` typically combine a project prefix with the task's `number` field:

- List tasks in the resolved project using the actual tool schema, then match the requested
  number. Follow pagination when needed; don't treat a partial list as proof that a task is absent.
- If the user only described the ticket (e.g. "the one about group invites"), list tasks and match
  on title/description instead. If multiple candidates match, show the short list (ID + title) and
  ask the user to pick.
- Once you have the task's internal `id`, prefer `get_task(taskId: ...)` for any follow-up fetch
  (e.g. comments) instead of re-listing.

## 3. Bring it into context

Summarize for the user: number, title, status, priority, and the key ask/description — don't dump
raw JSON. Fetch comments (`list_task_comments`) too if they look relevant.

## 4. Memory

Don't save ticket content (title, description, status, ask) to memory — tickets are always a
re-fetch away and their state changes. If persistent memory is available, store only a confirmed
repository-to-server/workspace/project mapping, including the server identity so IDs aren't
reused against another connection.

If the user changes the tracker/project mapping, use the new mapping and update the existing
mapping record when appropriate. Don't assume a particular memory filename or hardcoded IDs.
