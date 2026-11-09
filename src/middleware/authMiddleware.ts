import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {logger} from "../logger.js";

const log = logger.child({ service: "auth" });

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1]
    if (!token) {
        log.info({reason: "missing_token"}, "auth rejected");
        return res.sendStatus(401);
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        log.fatal("Missing JWT_SECRET env variable");
        throw new Error("Missing JWT_SECRET env variable") // TODO: should this throw? maybe? i don't know
    }

    let user: string | jwt.JwtPayload;
    try {
        user = jwt.verify(token, secret);
    } catch (error) {
        if (!(error instanceof jwt.JsonWebTokenError)) throw error;

        const reason = error instanceof jwt.TokenExpiredError ? "expired_token" : "invalid_token";
        log.info({reason}, "auth rejected");
        return res.sendStatus(401);
    }

    if (typeof user !== "object" || user === null || typeof user.id !== "string") {
        log.info({reason: "invalid_payload"}, "auth rejected");
        return res.sendStatus(401);
    }

    log.info({id: user.id}, "auth succeeded");
    req.user = user as NonNullable<Request["user"]>;
    next();
}
