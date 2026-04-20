const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  console.error('❌ Error:', {
    status,
    message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(status).json({
    success: false,
    message,
    error: err.code || 'INTERNAL_ERROR',
  });
};

module.exports = errorHandler;
