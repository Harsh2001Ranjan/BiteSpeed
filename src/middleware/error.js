const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    error: {
      message: 'Not Found',
      path: req.originalUrl,
    },
  });
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || 500;
  
  res.status(statusCode).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
