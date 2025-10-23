import { Request, Response, NextFunction } from "express";
import { gzip, deflate } from "zlib";
import { promisify } from "util";

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);

/**
 * Custom compression middleware for trends API
 */
export const trendsCompression = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only compress trends API responses
  if (!req.path.includes("/trends")) {
    return next();
  }

  const originalSend = res.send;

  res.send = function (data: any) {
    const acceptEncoding = req.headers["accept-encoding"] || "";

    if (acceptEncoding.includes("gzip")) {
      res.setHeader("Content-Encoding", "gzip");
      res.setHeader("Vary", "Accept-Encoding");

      gzipAsync(Buffer.from(data))
        .then((compressed) => {
          res.setHeader("Content-Length", compressed.length);
          originalSend.call(this, compressed);
        })
        .catch(() => {
          originalSend.call(this, data);
        });
    } else if (acceptEncoding.includes("deflate")) {
      res.setHeader("Content-Encoding", "deflate");
      res.setHeader("Vary", "Accept-Encoding");

      deflateAsync(Buffer.from(data))
        .then((compressed) => {
          res.setHeader("Content-Length", compressed.length);
          originalSend.call(this, compressed);
        })
        .catch(() => {
          originalSend.call(this, data);
        });
    } else {
      originalSend.call(this, data);
    }
  };

  next();
};

/**
 * Cache headers middleware for trends API
 */
export const trendsCacheHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only apply to trends API
  if (!req.path.includes("/trends")) {
    return next();
  }

  // Set cache headers for trends
  res.setHeader(
    "Cache-Control",
    "public, max-age=3600, stale-while-revalidate=7200"
  );
  res.setHeader("ETag", `"trends-${Date.now()}"`);
  res.setHeader("Last-Modified", new Date().toUTCString());

  // Check if client has cached version
  const ifNoneMatch = req.headers["if-none-match"];
  const ifModifiedSince = req.headers["if-modified-since"];

  if (ifNoneMatch && ifNoneMatch.includes("trends-")) {
    return res.status(304).end();
  }

  if (ifModifiedSince) {
    const modifiedSince = new Date(ifModifiedSince);
    const now = new Date();
    const diff = now.getTime() - modifiedSince.getTime();

    // If less than 1 hour old, return 304
    if (diff < 3600000) {
      return res.status(304).end();
    }
  }

  next();
};

/**
 * Performance monitoring middleware
 */
export const trendsPerformanceMonitoring = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.path.includes("/trends")) {
    return next();
  }

  const startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - startTime;
    const status = res.statusCode;

    console.log(
      `📊 Trends API Performance: ${req.method} ${req.path} - ${status} - ${duration}ms`
    );

    // Log slow requests
    if (duration > 5000) {
      console.warn(`⚠️ Slow trends request: ${duration}ms`);
    }
  });

  next();
};

export default {
  trendsCompression,
  trendsCacheHeaders,
  trendsPerformanceMonitoring,
};
