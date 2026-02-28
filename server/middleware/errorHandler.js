/**
 * Global Error Handler Middleware
 * Normalizes all errors to consistent JSON format
 * 
 * Standard error response:
 * {
 *   "success": false,
 *   "message": "Human-readable error message"
 * }
 */

export function errorHandler(err, req, res, next) {
  console.error('Error caught by global handler:', err);

  // Default error response
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal server error';

  // Handle specific error types
  
  // Validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = err.message;
  }

  // SQLite constraint errors
  if (err.code === 'SQLITE_CONSTRAINT' || err.message?.includes('UNIQUE constraint failed')) {
    statusCode = 409;
    if (err.message.includes('login_id')) {
      message = 'Login ID already exists';
    } else if (err.message.includes('employee_id')) {
      message = 'Employee ID already exists';
    } else {
      message = 'Duplicate entry detected';
    }
  }

  // Foreign key constraint errors
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.message?.includes('FOREIGN KEY constraint failed')) {
    statusCode = 400;
    message = 'Referenced record does not exist';
  }

  // Authentication errors
  if (err.name === 'UnauthorizedError' || message.includes('Unauthorized') || message.includes('Authentication')) {
    statusCode = 401;
    message = message.includes('Authentication') ? message : 'Authentication required';
  }

  // Permission errors
  if (message.includes('Forbidden') || message.includes('Permission denied')) {
    statusCode = 403;
  }

  // Send normalized error response
  res.status(statusCode).json({
    success: false,
    message: message
  });
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors and pass to error handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
}
