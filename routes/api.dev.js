import express from "express";
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import db from "../db/insert.js"
import {scrapeVpData} from "../services/scrapeVp.js";
import {vpCheckForDifferences} from "../services/vpCheckForDifferences.js";

const router = express.Router();

// TODO: Add authentication middleware, and check if user exists
router.put('/users/:username/notification-token', async (req, res) => {
    const { username } = req.params;
    const { token } = req.body;

    console.log(req.body);
    console.log('Received token:', token);
    console.log('For user:', username);

    try {
        await db.insertUserNotificationToken(username, token);
        console.log('Token updated successfully');
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error updating token:', error);
        res.status(500).json({ success: false, message: 'Failed to update token' });
    }
});

router.get('/users/:username/marks', async (req, res) => {
    const { username } = req.params;

    console.log('Received :', username);

    db.getUserMarks(username).then((marks) => {
        console.log('Marks:', marks);
        res.status(200).json({success: true, marks});
        sendNotificationToUser("Rafael.Beckmann", "user Noten angefragt", username, "high")
    }).catch((error) => {
        console.error('Error getting marks:', error);
        res.status(500).json({success: false, message: 'Failed to get marks'});
    });
})

router.get('/users/:username/:courseId/marks', async (req, res) => {
    const { username, courseId } = req.params;

    console.log('Received :', username);
    console.log('Course ID:', courseId);

    db.getUserMarksForCourse(username, courseId).then((marks) => {
        console.log('Marks:', marks);
        res.status(200).json({success: true, marks});
    }).catch((error) => {
        console.error('Error getting marks:', error);
        res.status(500).json({success: false, message: 'Failed to get marks'});
    });
})

router.get('/users/:username/courses', async (req, res) => {
    const { username } = req.params;

    console.log('Received courses fetch request:', username);

    db.getUserCourseNames(username).then((courses) => {
        // Rename course_id to courseId in each course object
        const formattedCourses = courses.map(course => ({
            courseId: course.course_id,
            name: course.name
        }));
        console.log('Courses:', formattedCourses);
        res.status(200).json({success: true, courses: formattedCourses});
    }).catch((error) => {
        console.error('Error getting courses:', error);
        res.status(500).json({success: false, message: 'Failed to get courses'});
    });
})

router.get('/users/:username/vpSelectedCourses', async (req, res) => {
    const { username } = req.params;

    console.log('Received courses fetch request:', username);

    db.getUserVpSelectedCourses(username).then((courses) => {
        // Extract the single course name string instead of mapping to array of objects
        const courseName = courses.length > 0 ? courses[0].course_name : null;
        console.log('Course:', courseName);
        res.status(200).json({success: true, courseName});
    }).catch((error) => {
        console.error('Error getting courses:', error);
        res.status(500).json({success: false, message: 'Failed to get courses'});
    });
})

router.post('/users/:username/vpSelectedCourses', async (req, res) => {
    const { username } = req.params;
    const { courseName } = req.body;

    console.log('Received course selection:', username, courseName);

    try {
        await db.insertUserVpSelectedCourses(username, courseName);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error inserting course:', error);
        res.status(500).json({ success: false, message: 'Failed to insert course' });
    }
});

// dev
router.get('/triggerUpdate', async (req, res) => {

    console.log('Received trigger update for user:');
    try {
        await updateAllSpUserData("Rafael.Beckmann", "RafaelBigFail5-", 6078)
        res.status(200).json({success: true, message: 'Update triggered successfully'});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
});

// dev
router.get('/sendNotification' , (req, res) => {

    sendNotificationToUser("Rafael.Beckmann", "test", "test", "high", "1")
        .then(() => {
            res.status(200).json({ success: true, message: 'Notification sent successfully' });
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});

// dev
router.get('/vpUpdate', async (req, res) => {
    console.log('Received trigger update');
    try {
        const data = await vpCheckForDifferences();
        res.status(200).json({success: true, message: data});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
})

// dev
router.get('/vpSubstitutions/:courseName', async (req, res) => {
    const { courseName } = req.params;

    //  url decode
    const decodedCourseName = decodeURIComponent(courseName);

    console.log('decoded Received trigger update for course:', decodedCourseName);

    try {
        const data = await db.getVpSubstitutions(decodedCourseName);
        console.log(data)
        res.status(200).json({success: true, substitutions: data});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
})
// dev
/* //ist noch alt, mit data, funktioniert so nicht
router.post('/vpSubstitutions', async (req, res) => {
    console.log('Received trigger update');
    try {
        const { courseName, data } = req.body;

        console.log('Received trigger update, courseName:', courseName, 'data:', data);
        await db.insertVpSubstitution(courseName, data);
        res.status(200).json({success: true, message: "Inserted"});
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({success: false, message: 'Failed to trigger update'});
    }
})
*/

router.get('/vp', async (req, res) => {
    try {
        const data = await scrapeVpData("https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html");
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error scraping VP data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch VP data' });
    }
});





router.get("/rick", (req, res) => {
    res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});



export default router;