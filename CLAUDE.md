# CLAUDE.md

## IMPORTANT RULES

- Always write specifications to describe new features when developing new features before planning work
- Always refer to relevant documentation in `docs/` and `docs/specs/` to provide context for writing new specifications
- Always review the specification yourself, report the results, and don't move forward with implementation planning until the specification is approved
- Always plan out the implementation in a plan file before implementing
- Always make use of superpowers (especially brainstorming) when planning features
- Always build implementation plans using a TDD-approach and plan out the critical path for an agent swarm development process
- Always plan to perform several passes of reviews and self-correction at the end of implementation before considering the implmentation complete
- Always review the implementation plan yourself, report the results, and don't move forward with implementation until the plan is approved
- If an implementation step encounters problems due to system configuration that require the user's attention, always stop and ask for their intervention rather than working around the problem
- If there is any risk of context/conversation compacting when performing an operation, always warn the user first rather than executing the instructions without confirmation

## Commands to Use

When making tool calls to execute commands defined in package.json, prefer using them as written in this section.

- Set correct node version: `nvm use v20.20.1`
- Build client: `npm run build:client`
- Host client locally for dev: `npm run dev:client`
- Host workers locally for dev: `npm run dev:server`
- Run vitest tests: `npm run test`
- Run worker tests: `npm run test:workers`
- Run typecheck: `npm run typecheck`
- Run linting: `npm run lint`
- Run formatting: `npm run format`
- Run format check: `npm run check`

## Local Hosting for Development

- Hosted at: http://localhost:8787

## Tech Stack

- Svelte 5 with Vite
- Node v20.20.1
- PartyKit (partyserver 0.3.3 & partysocket 1.1.16)
- Cloudflare Workers
- See package.json and package-lock.json for dependency versions

## Documentation

### Specifications

- Store implementation plans (current and historical) in `docs/specs/`
- Use date-prefixed filenames: `YYYY-MM-DD-short-description.md`

### Implementation Plans

- Store implementation plans (current and historical) in `docs/plans/`
- Use date-prefixed filenames: `YYYY-MM-DD-short-description.md`

### Permanent Documentation

- Store user-targeted and technical documentation in `docs/`
- Use descriptive non-dated file names in kebab-case: `project-architecture.md`