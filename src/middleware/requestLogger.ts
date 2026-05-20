import type {NextFunction, Request, Response} from "express";

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    const { method, url, ip } = req;

    const startDate = Date.now();
    const timestamp = new Date().toISOString();

    res.on("finish", () => {
        const duration = Date.now() - startDate;
        const statusCode = res.statusCode;

        console.log(
            `[${timestamp}] ${method} ${url} - Status: ${statusCode} - Client IP: ${ip} - Duration: ${duration}ms`
        );
    });

    next();
}