import {getLoginCookies} from "./auth.js";
import {getMarks} from "./marks.js";
import {sendNotificationToUser} from "./notifications.js";
import {getTeachers} from "./teachers.js";
import fetch from "node-fetch";
import {CHANNEL_NAMES, USER_AGENT} from "../config/constants.js";
import * as cheerio from "cheerio";
import {spGetMessages} from "./messagesOldReinkopiert.js";
import {buildDeeplink} from "../utils/deepLinkBuilder.js";
import {createDefaultUserRepository} from "../db/repositories/userRepository.js";
import {createDefaultCourseRepository} from "../db/repositories/courseRepository.js";
import {createDefaultMarkRepository} from "../db/repositories/marksRepository.js";
import {createDefaultTeacherRepository} from "../db/repositories/teacherRepository.js";

export async function updateAllSpUserData(
    userId, schoolId = 6078,
    {
        userRepo = createDefaultUserRepository(),
        courseRepo = createDefaultCourseRepository(),
        marksRepo = createDefaultMarkRepository(),
        teacherRepo = createDefaultTeacherRepository()
    } = {}
) {
    try {
        console.time('Script');

        const user = userRepo.getUserMerged(userId);
        console.log(user);
        if (!user) {
            console.error(`User not found for ID: ${userId}`);
            return;
        }
        const spUsername = user.sp_username;
        console.log(spUsername);
        const spPassword = user.sp_password;
        console.log(spPassword);

        console.time('Login');
        const loginCookies = await getLoginCookies(spUsername, spPassword, schoolId);
        console.timeEnd('Login');

        const URL = "https://start.schulportal.hessen.de/meinunterricht.php";
        const response = await fetch(URL, {
            method: "GET",
            headers: {
                "Cookie": loginCookies,
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Referer": "https://connect.schulportal.hessen.de/",
            }
        });
        if (response.status !== 200) {
            console.error("Failed to fetch page:", response.status, response.statusText);
            return;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        const courses = getCourses2($);

        for (const course of courses) {
            courseRepo.insertCourse(course.id, course.name);
        }
        for (const course of courses) {
            courseRepo.addUserCourse(userId, course.id);
        }

        for (const halfYearToProcess of [1, 2]) {
            console.log("user:", userId + " / " + spUsername);
            const existingMarks = marksRepo.getUserMarks(userId)
            console.log("Existing marks:", existingMarks.length);
            const existingMarksForHalfYear = existingMarks.filter(mark => mark.half_year === halfYearToProcess);

            console.log("Existing marks for half year:", halfYearToProcess);

            // Store all new marks for this half year
            const newMarksForHalfYear = [];

            // Collect all new marks from the API
            console.log(`Processing half year ${halfYearToProcess}`);
            for (const course of courses) {
                const marks = await getMarks(loginCookies, course.id, halfYearToProcess);

                //console.log(marks);

                marks.forEach(mark => {
                    newMarksForHalfYear.push({
                        name: mark.name,
                        date: mark.date,
                        grade: mark.grade,
                        courseId: course.id,
                        halfYear: halfYearToProcess,
                        SpUsername: spUsername, // TODO: remove
                        userId: userId
                    });
                });
            }

            // Find truly new marks by comparing name, date and courseId
            const trulyNewMarks = newMarksForHalfYear.filter(newMark => {
                return !existingMarksForHalfYear.some(existingMark =>
                    existingMark.name === newMark.name &&
                    existingMark.date === newMark.date &&
                    existingMark.course_id === newMark.courseId
                );
            });


            const newMarksByCourse = {};
            for (const mark of trulyNewMarks) {
                if (!newMarksByCourse[mark.courseId]) {
                    newMarksByCourse[mark.courseId] = [];
                }
                newMarksByCourse[mark.courseId].push(mark);
            }



            // Send notifications for new marks
            for (const courseId in newMarksByCourse) {
                const courseName = courses.find(c => c.id.toString() === courseId.toString())?.name || "Unbekannter Kurs";
                const newMarks = newMarksByCourse[courseId];

                // Create detailed message about the new marks
                let message = `Du hast ${newMarks.length} neue ${newMarks.length === 1 ? 'Note' : 'Noten'} in ${courseName}:`;
                newMarks.forEach(mark => {
                    message += `\n- ${mark.name}: ${mark.grade}`;
                });

                // TODO: soll die Note ein query argument sein?
                const uri = buildDeeplink(`revealmark/${newMarks[0].grade.toString()}`)
                await sendNotificationToUser(
                    userId,
                    `Neue ${newMarks.length === 1 ? 'Note' : 'Noten'} eingetragen`,
                    message,
                    { "deepLink": uri, "channel_id": CHANNEL_NAMES.CHANNEL_GRADES}
                );
            }


            //await db.connect();
            // Now delete and insert all marks
            // TODO: i mean what the fuck
            marksRepo.deleteMarksOfHalfYear(userId, halfYearToProcess);

            // Insert all new marks
            for (const mark of newMarksForHalfYear) {
                console.log("Inserting mark:", JSON.stringify(mark));
                const res = marksRepo.insertMark(mark)
                //console.log("Inserted mark:", res);
            }
        }




        console.time("getTeachers");
        const { teachers, coursesTeachers } = await getTeachers2($);
        console.log("Teachers found:", teachers.length);
        console.log("Course-Teacher relationships found:", coursesTeachers.length);

        for (const teacher of teachers) {
            teacherRepo.insertTeacher(teacher);
        }
        for (const relation of coursesTeachers) {
            console.log(relation);
            teacherRepo.linkCourseTeacher(relation.courseId, relation.teacherId);
        }
        console.timeEnd("getTeachers");


        try {
            await spGetMessages(loginCookies);
        } catch (error) {
            console.error("Error fetching messages:", error);
        }







        /*
        console.time("getCourses");
        const courses = await getCourses(loginCookies);
        for (const course of courses) {
            await db.insertCourse({ id: course.id, name: course.name }); // Use db.insertCourse
        }
        console.timeEnd("getCourses");

        for (const course of courses) {
            await db.insertUserCourse(SpUsername, course.id);
        }

        console.time("getMarks");

        /*
        // Process both half years
        for (const halfYearToProcess of [1, 2]) {
            await db.deleteAllMarksOfHalfYear(SpUsername, halfYearToProcess); // Delete second half year

            console.log(`Processing half year ${halfYearToProcess}`);
            for (const course of courses) {
                const marks = await getMarks(loginCookies, course.id, halfYearToProcess);

                for (const mark of marks) {
                    await db.insertMark({
                        name: mark.name,
                        date: mark.date,
                        grade: mark.grade,
                        courseId: course.id,
                        halfYear: halfYearToProcess,
                        SpUsername: SpUsername,
                    });
                }
            }
        }
        */
/*
        for (const halfYearToProcess of [1, 2]) {
            const existingMarks = await db.getUserGrades(SpUsername);
            const existingMarksForHalfYear = existingMarks.filter(mark => mark.half_year === halfYearToProcess);

            // Store all new marks for this half year
            const newMarksForHalfYear = [];

            // Collect all new marks from the API
            console.log(`Processing half year ${halfYearToProcess}`);
            for (const course of courses) {
                const marks = await getMarks(loginCookies, course.id, halfYearToProcess);

                marks.forEach(mark => {
                    newMarksForHalfYear.push({
                        name: mark.name,
                        date: mark.date,
                        grade: mark.grade,
                        courseId: course.id,
                        halfYear: halfYearToProcess,
                        SpUsername: SpUsername,
                    });
                });
            }

            // Find truly new marks by comparing name, date and courseId
            const trulyNewMarks = newMarksForHalfYear.filter(newMark => {
                return !existingMarksForHalfYear.some(existingMark =>
                    existingMark.name === newMark.name &&
                    existingMark.date === newMark.date &&
                    existingMark.course_id === newMark.courseId
                );
            });


            const newMarksByCourse = {};
            for (const mark of trulyNewMarks) {
                if (!newMarksByCourse[mark.courseId]) {
                    newMarksByCourse[mark.courseId] = [];
                }
                newMarksByCourse[mark.courseId].push(mark);
            }


            // Send notifications for new marks
            for (const courseId in newMarksByCourse) {
                const courseName = courses.find(c => c.id.toString() === courseId.toString())?.name || "Unbekannter Kurs";
                const newMarks = newMarksByCourse[courseId];

                // Create detailed message about the new marks
                let message = `Du hast ${newMarks.length} neue ${newMarks.length === 1 ? 'Note' : 'Noten'} in ${courseName}:`;
                newMarks.forEach(mark => {
                    message += `\n- ${mark.name}: ${mark.grade}`;
                });

                await sendNotificationToUser(
                    SpUsername,
                    `Neue ${newMarks.length === 1 ? 'Note' : 'Noten'} eingetragen`,
                    message,
                    "high"
                );
            }

            // Now delete and insert all marks
            await db.deleteAllMarksOfHalfYear(SpUsername, halfYearToProcess);

            // Insert all new marks
            for (const mark of newMarksForHalfYear) {
                await db.insertMark(mark);
            }
        }




        console.timeEnd("getMarks");

        console.time("getTeachers");
        const { teachers, coursesTeachers } = await getTeachers(loginCookies);
        console.log("Teachers found:", teachers.length);
        console.log("Course-Teacher relationships found:", coursesTeachers.length);

        for (const teacher of teachers) {
            await db.insertTeacher({
                id: teacher.id,
                name: teacher.text,
                type: teacher.type,
                logo: teacher.logo,
                abbreviation: teacher.abbreviation,
                email: teacher.email
            });
        }
        for (const relation of coursesTeachers) {
            await db.insertCourseTeacher(relation.courseId, relation.teacherId);
        }


        console.timeEnd("getTeachers");

*/
        console.timeEnd('Script');

    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script');
    }
}

function getCourses2($) {
    const courses = [];

    $("#anwesend table.table tbody tr").each((i, row) => {
        const $row = $(row);
        const $courseCell = $row.find('td').first();
        const $courseLink = $courseCell.find('a');

        const course = {
            name: $courseLink.text().trim(),
            id: extractIdFromHref($courseLink.attr('href')),
        };

        courses.push(course);
    });

    function extractIdFromHref(href) {
        if (!href) return null;
        const match = href.match(/id=(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    return courses;
}



async function getTeachers2($) {

    let teachers = [];
    let coursesTeachers = [];

    $("#aktuellTable tbody tr").each((i, courseRow) => {
        const $courseRow = $(courseRow);
        const courseId = $courseRow.attr('data-book');

        if (!courseId) return;

        $courseRow.find(".teacher .btn-group").each((j, btnGroup) => {
            const $btnGroup = $(btnGroup);
            const $button = $btnGroup.find('button.btn-xs');

            if (!$button.length || !$button.attr('title')) return;

            const title = $button.attr('title');
            const abbreviation = $button.text().trim().replace(/\s.*$/, '');
            const nameMatch = title.match(/(.*?)\s+\(.*?\)/);
            const name = nameMatch ? nameMatch[1] : title;

            const $messageLink = $btnGroup.find('a[href^="nachrichten.php?to[]"]');
            const encodedId = $messageLink.length ?
                $messageLink.attr('href').match(/to\[]=(.*?)}/)?.[1] : null;
            const decodedId = encodedId ? Buffer.from(encodedId, 'base64').toString() : null;

            const $emailLink = $btnGroup.find('a[href^="mailto:"]');
            const email = $emailLink.length ? $emailLink.attr('href').replace('mailto: ', '') : null;

            if (decodedId && !teachers.some(t => t.id === decodedId)) {
                const teacher = {
                    type: "lul",
                    teacherId: decodedId,
                    logo: "fa fa-user",
                    name: name,
                    abbreviation: abbreviation,
                    email: email
                };
                teachers.push(teacher);
            }

            if (decodedId) {
                coursesTeachers.push({
                    courseId: parseInt(courseId),
                    teacherId: decodedId
                });
            }
        });
    });

    return { teachers, coursesTeachers };
}