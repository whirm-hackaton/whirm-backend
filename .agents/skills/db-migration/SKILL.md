---
name: db-migration
description: Handle database schema changes using the repository's migration tooling, including test cleanup and seed data updates.
---

# Database Migrations

Find the schema, migration configuration, and commands in the repository. Follow existing conventions.

1. Edit the schema and generate a named migration, or write one if the project uses handwritten migrations.
2. Review for unintended data loss, especially renames and new constraints on existing rows. Keep migration metadata in sync. Don't rewrite applied or shared migrations.
3. Apply to the intended local/test database using the project's commands.
4. Update affected test cleanup, fixtures, seed data, and queries.
5. Run relevant build/type checks and database tests. Review the schema, migration, and metadata diff; report any checks that couldn't run.
