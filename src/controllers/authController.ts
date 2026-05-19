import {type Request, type Response} from "express";
import {prisma} from "../db/prisma.js";


export const postRegister = async (req: Request, res: Response) => {
    const {  } = req.query;

    const result = await prisma.user.create({
        data: {}
    })

    res.send(result);
};

// TODO: implement
export const postLogin = async (req: Request, res: Response) => {
    const {  } = req.query;

    //const result

    //res.send(result);
}

// TODO: implement
export const postRefresh = async (req: Request, res: Response) => {
    const {  } = req.query;

    //const result

    //res.send(result);
}

// TODO: implement
export const postLogout = async (req: Request, res: Response) => {
    const {  } = req.query;

    //const result

    //res.send(result);
}