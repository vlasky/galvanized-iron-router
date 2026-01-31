import { Iron } from '../core/iron_core.js';
import { Router as RouterClass } from './router.js';
import { RouteController } from './route_controller.js';

const Router = new RouterClass();

// Backward compatibility - attach to globals
Iron.utils.global.Router = Router;
Iron.utils.global.RouteController = RouteController;

export { Router, RouteController };
