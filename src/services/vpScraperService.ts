import axios from "axios";
import * as cheerio from "cheerio";
import {prisma} from "../db/prisma.js";
import {Day, VpType} from "../generated/prisma/enums.js";
import type {MulticastMessage} from "firebase-admin/messaging";
import {messaging} from "../firebase.js";

export async function scrapeVp(day: Day) {
    const dayNumber = day === Day.today ? 1 : 2;
    const url = `https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/${dayNumber}/vp.html`;
    const data = await scrapeVpData(url)

    const allCourseNames = [
        ...data.differentRooms.map(item => ({
            name: item.course
        })),
        ... data.substitutions.map(item => ({
            name: item.course
        }))
    ];
    await prisma.vpCourse.createMany({
        data: allCourseNames,
        skipDuplicates: true
    });



    const oldSubstitutions = await prisma.vpSubstitution.findMany({
        where: {
            isDeleted: false,
            day: day,
            vpDate: data.websiteDate
        }
    });




    const allSubstitutions = [
        ...data.differentRooms.map(item => ({
            day: day,
            hour: item.hour,
            original: item.original,
            replacement: item.replacement,
            description: item.description,
            vpDate: data.websiteDate,
            isDeleted: false,
            VpType: VpType.differentRoom,
            courseName: item.course
        })),
        ...data.substitutions.map(item => ({
            day: day,
            hour: item.hour,
            original: item.original,
            replacement: item.replacement,
            description: item.description,
            vpDate: data.websiteDate,
            isDeleted: false,
            VpType: VpType.substitution,
            courseName: item.course
        }))
    ];
    await prisma.vpSubstitution.createMany({
        data: allSubstitutions,
        skipDuplicates: true
    });



    // TODO: improve types
    interface deletedSubs {
        id: number,
        day: Day,
        hour: string,
        original: string,
        replacement: string,
        description: string,
        vpDate: string,
        isDeleted: boolean,
        VpType: VpType,
        courseName: string,
        createdAt: Date,
        updatedAt: Date
    }

    // TODO: add types
    function generateSetKey(sub: any) {
        return `${sub.courseName} ~~~~~~~~|o|~~HELP~~~~ ${sub.hour ?? ""} | ${sub.original ?? ""} | ${sub.replacement ?? ""} | ${sub.description ?? ""}`
    }
    // TODO: add types
    function findDeleted(oldSubs: any[], newSubs: any[]): deletedSubs[] {
        const newSubsSet = new Set(newSubs.map(sub => (generateSetKey(sub))));

        return oldSubs.filter(sub => !newSubsSet.has(generateSetKey(sub)))
    }

    // TODO: maybe replace with prisma .createManyAndReturn instead of this?
    // TODO: add types
    function findNew(oldSubs: any[], newSubs: any[]) {
        const oldSubsSet = new Set(oldSubs.map(sub => (generateSetKey(sub))));

        return newSubs.filter(sub => !oldSubsSet.has(generateSetKey(sub)))
    }

    console.log(oldSubstitutions.length);
    console.log(allSubstitutions.length);

    const deleted = findDeleted(oldSubstitutions, allSubstitutions);
    console.log("GELÖSCHT???????? ", deleted);

    const deletedRows = await prisma.vpSubstitution.updateManyAndReturn({
        where: {
            id: {
                in: deleted.map(item => item.id)
            }
        },
        data: {
            isDeleted: true
        }
    })
    console.log(deletedRows);

    const newSubstitutions = findNew(oldSubstitutions, allSubstitutions);
    const updatedCourses = new Set(newSubstitutions.map(sub => (sub.courseName)));
    console.log(updatedCourses);

    for (const course of updatedCourses) {
        console.log(course);

        const subs = await prisma.vpSubstitution.findMany({
            where: {
                courseName: course,
                vpDate: data.websiteDate
            }
        })

        const title = `${course}: Vertretung ${day}`
        const body = subs.map(sub =>
            `${sub.hour}: ${sub.original || "—"} → ${sub.replacement || "—"} ${sub.description ? `(${sub.description})` : ""}`
        ).join("\n");

        /*
        const message: TokenMessage = {
            token: "token",
            data: {
                title: title,
                body: body
            }
        }
        await messaging.send(message);
        */


        const tokens = await prisma.userNotificationToken.findMany({
            where: {
                user: {
                    vpCourses: {
                        some: {
                            course: course
                        }
                    }
                }
            }
        })

        if (tokens.length === 0) {
            continue;
        }

        const message: MulticastMessage = {
            tokens: tokens.map(row => row.token),
            data: {
                title: title,
                body: body
            }
        }
        await messaging.sendEachForMulticast(message)
    }

    /*const user = await prisma.user.create({
        data: {}
    })*/

    /*
    await prisma.userVpCourse.create({
        data: {
            course: "Q3/Q4",
            userId: user.id
        }
    })*/


    /*
    const tokenInsert = await prisma.userNotificationToken.create({
        data: {
            token: "token",
            userId: "8de5d9f5-d037-4b0a-9272-8e7908709880"
        }
    })

    console.log(tokenInsert);
    console.log("tokens");
    console.log(tokens)
    */

}


interface VpSubstitution {
    hour: string,
    course: string,
    original: string,
    replacement: string,
    description: string,
}

interface VpData {
    rawPage: string,
    timestamp: Date,
    websiteDate: string,
    details: string,
    missingTeachers: string[],
    missingClasses: string[],
    missingRooms: string[],
    differentRooms: VpSubstitution[],
    substitutions: VpSubstitution[]
}


// TODO: rewrite (burn everything)
export async function scrapeVpData(url: string): Promise<VpData> {
    const timestamp = new Date();

    try {
        const { data } = await axios.get(url)
        const formattedData = data.replace(/>\s*</g, ">\n<");
        const $ = cheerio.load(formattedData);

        // Helper function to clean text by removing extra whitespace
        const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();

        // Find table that follows specific text
        function findTableAfterText(text: string) {
            let foundText = false;
            let tableElement = null;

            // Check plain text nodes
            $("body").contents().each(function () {
                if (this.type === "text" && $(this).text().trim() === text) {
                    foundText = true;
                    // @ts-ignore
                } else if (foundText && this.name === "table") {
                    tableElement = this;
                    return false;
                }
            });

            // If not found, check text inside tags
            if (!tableElement) {
                $("body").find("*").each(function () {
                    if ($(this).children().length === 0 && $(this).text().trim().includes(text)) {
                        foundText = true;
                    } else if (foundText && this.name === "table") {
                        tableElement = this;
                        return false;
                    }
                });
            }

            return tableElement ? $(tableElement) : null;
        }

        function findTableAfterHr(differentRoomsTable: any) {
            let result = null;

            $("hr").each(function () {
                const nextSibling = this.nextSibling;
                const nextElement = $(this).next();
                // Check if the next sibling is either null or a text node with only whitespace
                const isWhitespace = nextSibling && nextSibling.nodeType === 3 && nextSibling.nodeValue.trim() === "";

                if (nextElement.is("table") && (nextSibling === null || isWhitespace)) {
                    if (differentRoomsTable && nextElement.is(differentRoomsTable)) {
                        // Skip this table because it's the Ersatzraumplan table
                        console.log("no substitutions table")
                        return;
                    }
                    result = nextElement;
                    return false;
                }
            });

            return result;
        }

        function scrapeTableData(table: any) {
            const rows: any = [];

            if (table) {
                table.find("tr").each((i: any, row: any) => {
                    const entries: any = [];
                    $(row).find("td").each((i, td) => {
                        entries.push($(td).text().trim());
                    });

                    for (let i = 0; i < entries.length; i += 2) {
                        rows.push(entries.slice(i, i + 2));
                    }
                });
            }
            return rows;
        }

        function scrapeSchedule(table: any) {
            const changes: any = [];
            let currentGroup = "";

            if (!table) {
                return [];
            }

            table.find("tr").each((index: any, element: any) => {
                const $element = $(element);

                if ($element.find("th").length > 0) {
                    // This is a header row
                    currentGroup = cleanText($element.find("th").text());
                } else {
                    // This is a data row
                    const columns = $element.find("td").map((i, el) => {
                        if (i !== 2) {
                            return cleanText($(el).text());
                        }
                        return undefined;
                    }).get();

                    if (columns.length) {
                        const filteredColumns = columns.filter(col => col !== undefined);
                        changes.push({
                            course: currentGroup,
                            hour: filteredColumns[0],
                            original: filteredColumns[1],
                            replacement: filteredColumns[2],
                            description: filteredColumns[3]
                        });
                    }
                }
            });

            return changes;
        }

        // Extract key information
        //const websiteDate = "Freitag, 04. Apr 2025"
        const websiteDate = cleanText($('h3').eq(1).text().replace('Vertretungsplan für ', ''));
        const details = cleanText($('big').text());

        // Find relevant tables
        const missingTeachersTable = findTableAfterText("fehlende Lehrer:");
        const missingClassesTable = findTableAfterText("fehlende Klassen:");
        const missingRoomsTable = findTableAfterText("fehlende Räume:");
        const differentRoomsTable = findTableAfterText("Ersatzraumplan");
        const substitutionsTable = findTableAfterHr(differentRoomsTable);

        // Assemble the result
        return {
            rawPage: data.toString(),
            timestamp,
            websiteDate,
            details,
            missingTeachers: scrapeTableData(missingTeachersTable),
            missingClasses: scrapeTableData(missingClassesTable),
            missingRooms: scrapeTableData(missingRoomsTable),
            differentRooms: scrapeSchedule(differentRoomsTable),
            substitutions: scrapeSchedule(substitutionsTable),
        }

    } catch (error) {
        console.error("Error fetching or parsing the HTML:", error);
        throw error
    }
}

//scrapeData("/Users/Rafael/Downloads/vp1.html")
//scrapeData("http://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html");
//scrapeData("http://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/2/vp.html");