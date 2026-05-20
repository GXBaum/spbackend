import { Request } from 'express';

declare global {
    namespace Express {
        interface Request {
            user?: string | JwtPayload; // TODO: not sure if this makes sense
        }
    }
}