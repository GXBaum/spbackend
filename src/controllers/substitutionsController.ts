import {type Request, type Response} from "express";
import {scrapeVp} from "../services/vpScraperService.js";
import {Day} from "../generated/prisma/enums.js";
import {prisma} from "../db/prisma.js";
import {Prisma} from "../generated/prisma/client.js";

function castAsDay(value: any): Day | null {
    if( Object.values(Day).includes(value) ) {
        return value as Day
    } else {
        return null
    }
}

export const getSubstitutions = async (req: Request, res: Response): Promise<void> => {
    const { courses, day } = req.query;

    const whereStatement: Prisma.VpSubstitutionWhereInput = {};

    // enforce array
    const coursesArray = (courses
        ? (Array.isArray(courses) ? courses : [courses]) // to array if not null
        : [] // fallback if null
    ) as string[];

    // if no courses query param, get all
    if (coursesArray.length > 0) {
        whereStatement.courseName = { in: coursesArray }
    }


    const dayCast = castAsDay(day);
    if (dayCast) {
        whereStatement.day = dayCast
    }


    const result = await prisma.vpSubstitution.findMany({
        where: whereStatement
    });

    res.send(result);
};


export const postSubstitutions = async (req: Request, res: Response) => {
    const result = await scrapeVp(Day.today)
    await scrapeVp(Day.tomorrow)

    res.send(result);
}