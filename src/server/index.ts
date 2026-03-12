/**
 * Cloudflare Worker entry point for the Crash Game.
 *
 * Routing:
 * - WebSocket / party upgrade requests → `routePartykitRequest` → `CrashGame` Durable Object.
 * - All other HTTP requests → `env.ASSETS` (auto-binding serving `public/` Vite build output).
 *
 * @see docs/project-architecture.md §1.2
 */
import { routePartykitRequest } from 'partyserver';
import { CrashGame } from './crash-game';

export { CrashGame };

export default {
  async fetch(
    request: Request,
    env: { CrashGame: DurableObjectNamespace; ASSETS: Fetcher },
    _ctx: ExecutionContext,
  ): Promise<Response> {
    // Route WebSocket and party requests to the Durable Object
    const partyResponse = await routePartykitRequest(request, env);
    if (partyResponse) return partyResponse;

    // Serve static assets for everything else
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
