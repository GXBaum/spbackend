import {getLoginCookies} from "./auth.js";
import {getMarks} from "./marks.js";
import {sendNotificationToUser} from "./notifications.js";
import fetch from "node-fetch";
import {CHANNEL_NAMES, USER_AGENT} from "../config/constants.js";
import * as cheerio from "cheerio";
import {spGetMessages} from "./messagesOldReinkopiert.js";
import {buildDeeplink} from "../utils/deepLinkBuilder.js";
import {createDefaultUserRepository} from "../db/repositories/userRepository.js";
import {createDefaultCourseRepository} from "../db/repositories/courseRepository.js";
import {createDefaultMarkRepository} from "../db/repositories/marksRepository.js";
import {createDefaultTeacherRepository} from "../db/repositories/teacherRepository.js";

// TODO FIXME: manchmal ist finalUrl connect.schulportal.hessen.de/weiterleitung.html, daher kommen die falschen trigger glaube ich
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

        const courses = getCourses($);

        for (const course of courses) {
            courseRepo.insertCourse(course.id, course.name);
        }
        for (const course of courses) {
            courseRepo.addUserCourse(userId, course.id);
        }

        for (const halfYearToProcess of [1, 2]) {
            console.log("user:", userId + " / " + spUsername);
            const existingMarks = marksRepo.getUserActiveMarks(userId);
            console.log("Existing marks:", existingMarks.length);
            const existingMarksForHalfYear = existingMarks.filter(mark => mark.half_year === halfYearToProcess);

            console.log("Existing marks for half year ", halfYearToProcess);

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
                    existingMark.course_id === newMark.courseId &&
                    existingMark.grade === newMark.grade
                );
            });
            const deletedMarks = existingMarksForHalfYear.filter(existingMark => {
                return !newMarksForHalfYear.some(newMark =>
                    existingMark.name === newMark.name &&
                    existingMark.date === newMark.date &&
                    existingMark.course_id === newMark.courseId &&
                    existingMark.grade === newMark.grade
                )
            })

            console.log("new Marks: " + trulyNewMarks);
            console.log("deleted Marks: " + deletedMarks);

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
                    //message += `\n- ${mark.name}: ${mark.grade}`;
                    message += `\n- ${mark.name}`;
                });
                message += "\ntippen, um Note zu öffnen"

                // TODO: soll die Note ein query argument sein?
                const uri = buildDeeplink(`revealmark/${newMarks[0].grade.toString()}`)
                console.log(message);
                await sendNotificationToUser(
                    userId,
                    `Neue ${newMarks.length === 1 ? 'Note' : 'Noten'} eingetragen`,
                    message,
                    { "deepLink": uri, "channel_id": CHANNEL_NAMES.CHANNEL_GRADES}
                );
            }


            trulyNewMarks.forEach(mark => {
                marksRepo.insertMark(mark);
            });
            deletedMarks.forEach(mark => {
                //marksRepo.markMarkAsDeleted(mark)
                // TODO: improve
                marksRepo.markMarkAsDeleted({
                    name: mark.name,
                    date: mark.date,
                    grade: mark.grade,
                    halfYear: mark.half_year,
                    courseId: mark.course_id,
                    userId: mark.user_id
                });
                console.log("Marked as deleted:", JSON.stringify(mark));
            })
        }




        console.time("getTeachers");
        const { teachers, coursesTeachers } = await getTeachers($);
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

        console.timeEnd('Script');

    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script');
    }
}

function getCourses($) {
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



async function getTeachers($) {

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