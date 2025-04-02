import {db} from "../db/db.js";
import {getLoginCookies} from "./auth.js";
import {getCourses} from "./courses.js";
import {getMarks} from "./marks.js";
import {sendNotificationToUser} from "./notifications.js";
import {getTeachers} from "./teachers.js";

export async function updateAllSpUserData(SpUsername, SpPassword, schoolId= 6078) {
    try {
        console.time('Script');

        // TODO: remove this
        await db.insertUser(SpUsername, SpPassword, 1);

        console.time('Login');
        const loginCookies = await getLoginCookies(SpUsername, SpPassword, schoolId);
        console.timeEnd('Login');

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


        console.timeEnd('Script');

    } catch (error) {
        console.error("Error:", error);
        console.timeEnd('Script'); // Ensure it still ends even on error
    } finally {
        await db.close(); // Close the database connection when done
    }
}