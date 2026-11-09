import {type Request, type Response} from "express";
import jwt from "jsonwebtoken";
import {prisma} from "../db/prisma.js";
import {randomBytes} from "node:crypto";
import * as z from "zod";

const loginCredential = z.string().min(1)
const loginRequestSchema = z.object({
    id: loginCredential,
    password: loginCredential
});

export function signAccessToken(userId: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("Missing JWT_SECRET env variable") // TODO: potentially use zod?
    }

    return jwt.sign(
        {
            id: userId,
            hi: "hat sich nicht gelohnt das auszulesen, oder?"
        },
        secret,
        {
            expiresIn: "15m"
        }
    )
}

export async function createAndSaveRefreshToken(userId: string) {
    const refreshToken = randomBytes(64).toString("hex");

    await prisma.userRefreshToken.create({
        data: {
            userId: userId,
            token: refreshToken
        }
    });

    return refreshToken
}

export const postRegister = async (req: Request, res: Response) => {
    const {  } = req.query;

    const result = await prisma.user.create({
        data: {}
    });

    const token = signAccessToken(result.id);
    const refreshToken = await createAndSaveRefreshToken(result.id);

    res.send({id: result.id, token, refreshToken});
};

// TODO: implement FIXME
// TODO: temporary way to manually get my account
export const postLogin = async (req: Request, res: Response) => {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(401).send({ error: "Invalid credentials" });
    }

    const { id: userId, password } = parsed.data;
    const result = await prisma.userRefreshToken.findUnique({
        where: {
            userId_token: {
                userId,
                token: password
            }
        },
        select: { userId: true }
    });

    if (!result) {
        return res.status(401).send({ error: "Invalid credentials" });
    }

    const token = signAccessToken(result.userId);
    const refreshToken = await createAndSaveRefreshToken(result.userId);

    res.send({userId: result.userId, accessToken: token, refreshToken});
}

// TODO: implement
export const postRefresh = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const result = await prisma.userRefreshToken.findUnique({
        where: {
            token: refreshToken
        }
    });
    if (!result) return res.sendStatus(401);

    const token = signAccessToken(result.userId);

    res.send({token});
}

// TODO: implement
export const postLogout = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;

    const result = await prisma.userRefreshToken.delete({
        where: {
            token: refreshToken
        }
    });

    res.sendStatus(204);
}