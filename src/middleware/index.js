// Add any custom middleware here
const exampleMiddleware = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

module.exports = {
  exampleMiddleware
};
