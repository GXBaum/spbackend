import type {NextFunction, Request, Response} from "express";
import jwt from "jsonwebtoken";
import {logger} from "../logger.js";

const log = logger.child({ service: "auth" });

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader?.split(" ")[1]
    if (!token) return res.sendStatus(401)

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        log.fatal("Missing JWT_SECRET env variable");
        throw new Error("Missing JWT_SECRET env variable") // TODO: should this throw? maybe? i don't know
    }

    try {
        const user = jwt.verify(
            token,
            secret
        );

        if (typeof user == "string" || typeof user.id != "string"){
            log.debug("auth rejected: invalid token payload");
            return res.sendStatus(401);
        }

        logger.debug({user}, "auth succeeded");

        req.user = user as NonNullable<Request["user"]>;
        next();
    } catch (error) {
        log.warn({err: error}, "auth failed");
        return res.sendStatus(401);
    }

}