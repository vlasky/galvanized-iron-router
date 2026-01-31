/**
 * Server entry point for Galvanized Iron Router
 *
 * This file aggregates all server-side exports for ESM usage.
 */

// Core modules
export { Iron } from './core/iron_core.js';
export { Url } from './url/url.js';
export { Handler } from './middleware/handler.js';
export { MiddlewareStack } from './middleware/middleware_stack.js';
export { DynamicTemplate } from './dynamic-template/dynamic_template.js';
export { Layout, DEFAULT_REGION } from './layout/layout.js';
export { Controller } from './controller/controller.js';
export { RouteController } from './router/route_controller.js';
export { Route } from './router/route.js';

// Side-effect imports (extensions that modify prototypes)
import './dynamic-template/blaze_overrides.js';
import './controller/controller_server.js';
import './router/route_controller_server.js';
import './router/body_parser_server.js';
import './router/router_server.js';
import './router/hooks.js';
import './router/plugins.js';
import './router/version_conflict_error.js';

// Global router instance - must be last
export { Router, RouteController as RC } from './router/global_router.js';
