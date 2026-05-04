import type { RequestHandler, Router as ExpressRouter } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.ts';
import { asyncHandler } from '../middleware';

// ============================================================================
// Helper Types
// ============================================================================

interface RouteMetadata {
  method: 'get' | 'post' | 'patch' | 'delete' | 'put';
  path: string;
  middlewares: RequestHandler[];
  propertyKey: string;
}

// ============================================================================
// Typed storage for metadata (WeakMap instead of Symbols assigned to Objects)
// ============================================================================

const routesMap = new WeakMap<object, RouteMetadata[]>();
const middlewaresMap = new WeakMap<object, Map<string, RequestHandler[]>>();

function getRoutes(target: object): RouteMetadata[] {
  let routes = routesMap.get(target);
  if (!routes) {
    routes = [];
    routesMap.set(target, routes);
  }
  return routes;
}

function getMiddlewares(target: object, propertyKey: string): RequestHandler[] {
  let map = middlewaresMap.get(target);
  if (!map) {
    map = new Map<string, RequestHandler[]>();
    middlewaresMap.set(target, map);
  }

  let handlers = map.get(propertyKey);
  if (!handlers) {
    handlers = [];
    map.set(propertyKey, handlers);
  }
  return handlers;
}

function addMiddleware(
  target: object,
  propertyKey: string,
  middleware: RequestHandler,
) {
  const middlewares = getMiddlewares(target, propertyKey);
  // Decorators are called from bottom to top - add them at the very beginning
  middlewares.unshift(middleware);
}

// ============================================================================
// Decorators for HTTP Methods
// ============================================================================

function createMethodDecorator(method: RouteMetadata['method']) {
  return function (path = '') {
    return function (
      target: object,
      propertyKey: string,
      descriptor: PropertyDescriptor,
    ): PropertyDescriptor {
      const routes = getRoutes(target);
      const middlewares = getMiddlewares(target, propertyKey);

      routes.push({
        method,
        path,
        middlewares,
        propertyKey,
      });

      return descriptor;
    };
  };
}

export const Get = createMethodDecorator('get');
export const Post = createMethodDecorator('post');
export const Patch = createMethodDecorator('patch');
export const Delete = createMethodDecorator('delete');
export const Put = createMethodDecorator('put');

// ============================================================================
// Decorator Validate
// ============================================================================
export function Validate(schema: z.ZodSchema) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const validationMiddleware: RequestHandler = validate(schema);

    addMiddleware(target, propertyKey, validationMiddleware);
    return descriptor;
  };
}

// ============================================================================
// Decorator UseMiddleware
// ============================================================================

export function UseMiddleware(...middlewares: RequestHandler[]) {
  return function (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    for (const middleware of middlewares.reverse()) {
      addMiddleware(target, propertyKey, middleware);
    }
    return descriptor;
  };
}

// ============================================================================
// Builder to create Router from Controller
// ============================================================================

export function buildRouter(controllerInstance: object): ExpressRouter {
  const router = Router();
  let proto = Object.getPrototypeOf(controllerInstance);
  let routes: RouteMetadata[] = [];

  while (proto && proto !== Object.prototype) {
    const foundRoutes = routesMap.get(proto);
    if (foundRoutes && foundRoutes.length > 0) {
      routes = foundRoutes;
      break;
    }
    proto = Object.getPrototypeOf(proto);
  }

  if (routes.length === 0) {
    console.warn(
      `⚠️ buildRouter: No routes found for ${(controllerInstance as { constructor: { name: string } }).constructor.name}. ` +
        `Ensure decorators (@Get, @Post) are applied correctly.`,
    );
  }

  for (const route of routes) {
    const methodOrUndefined = (controllerInstance as Record<string, unknown>)[
      route.propertyKey
    ];
    if (typeof methodOrUndefined !== 'function') continue;
    const handler = asyncHandler(
      methodOrUndefined.bind(controllerInstance) as RequestHandler,
    );
    const allHandlers = [...route.middlewares, handler];

    switch (route.method) {
      case 'get':
        router.get(route.path, ...allHandlers);
        break;
      case 'post':
        router.post(route.path, ...allHandlers);
        break;
      case 'patch':
        router.patch(route.path, ...allHandlers);
        break;
      case 'delete':
        router.delete(route.path, ...allHandlers);
        break;
      case 'put':
        router.put(route.path, ...allHandlers);
        break;
      default:
        throw new Error(`Unsupported method: ${route.method}`);
    }
  }

  return router;
}
