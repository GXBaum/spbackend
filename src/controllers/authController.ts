import {type Request, type Response} from "express";
import jwt from "jsonwebtoken";
import {prisma} from "../db/prisma.js";
import {randomBytes} from "node:crypto";

function signAccessToken(userId: string) {
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

async function createAndSaveRefreshToken(userId: string) {
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

// TODO: implement
export const postLogin = async (req: Request, res: Response) => {
    const { id, password } = req.body;

    // FIXME: doesn't make sense
    const result = await prisma.user.findUnique({
        where: {
            id: id,
            spData: {
                spPassword: password
            }
        }
    })

    res.send(result);
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