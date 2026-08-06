/**
 * Global error handler middleware.
 * Catches errors from controllers and returns a consistent JSON response.
 */
export function errorHandler(err, req, res, next) {
  console.error("Error:", err.message);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}

/**
 * Wraps an async route handler so thrown errors go to the error handler
 * instead of crashing the server.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
