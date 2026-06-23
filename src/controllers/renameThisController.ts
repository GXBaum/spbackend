import {type Request, type Response} from "express";
import {prisma} from "../db/prisma.js";

export const getEnrolled = async (req: Request, res: Response) => {
    const id = req.user?.id;
    if (!id) return res.sendStatus(401);

    const enrolled = await prisma.userVpCourse.findMany({
        where: {
            userId: id
        },
        select: {
            course: true,
            createdAt: true,
            updatedAt: true
        }
    });

    const verified = await prisma.vpCourse.findMany({
        where: {
            name: {
                in: enrolled.map(course => course.course)
            }
        }
    })

    const verifiedNamesSet = new Set(
        verified.map(c => c.name)
    )

    const enrolledWithVerified = enrolled.map( e => ({
        ...e,
        verified: verifiedNamesSet.has(e.course)
    }))

    res.send({
        courses: enrolledWithVerified
    });
}

// TODO: should this be put? yeah
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
