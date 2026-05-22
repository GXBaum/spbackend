import {type Request, type Response} from "express";
import {prisma} from "../db/prisma.js";

export const getEnrolled = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const result = await prisma.userVpCourse.findMany({
        where: {
            userId: id
        },
        select: {
            course: true,
            createdAt: true,
            updatedAt: true
        }
    });

    res.send({result});
}

// TODO: implement
export const postEnrolled = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const { course } = req.body;

    const result = await prisma.userVpCourse.create({
        data: {
            course: course,
            userId: id
        }
    });

    res.sendStatus(201);
}

// TODO: implement
export const deleteEnrolled = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const { course } = req.params;

    if (!course) return res.sendStatus(400);
    if (Array.isArray(course)) return res.sendStatus(400);

    const result = await prisma.userVpCourse.delete({
        where: {
            userId_course: {
                userId: id,
                course: course
            }
        },
        select: {
            course: true,
            createdAt: true,
            updatedAt: true
        }
    });
    if (!result) return res.sendStatus(401);

    res.send({result});
}
