declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string,
                hi?: string,
                iat?: number,
                exp?: number
            }; // TODO: not sure if this makes sense
        }
    }
}

export {}; // treat file as module