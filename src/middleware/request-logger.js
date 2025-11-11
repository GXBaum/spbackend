export function requestLogger(req, res, next) {
    console.log(`Incoming request: ${req.method} ${req.originalUrl} ip: ${req.ip}`);
    next();
}