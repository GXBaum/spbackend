import express from "express";
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import db from "../db/insert.js"
import {scrapeVpData} from "../services/scrapeVp.js";

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


router.get('/vp', async (req, res) => {
    try {
        const data = await scrapeVpData("https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html");
        res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error scraping VP data:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch VP data' });
    }
});


router.get('/users/:username/marks', async (req, res) => {
    const { username } = req.params;

    console.log('Received :', username);

    db.getUserMarks(username).then((marks) => {
        console.log('Marks:', marks);
        res.status(200).json({success: true, marks});
        sendNotificationToUser("Rafael.Beckmann", "user Noten angefragt", spUsername, "high")
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

router.get('/getUserCourses', async (req, res) => {
    const spUsername = req.query.spUsername;

    console.log('Received :', spUsername);

    db.getUserCourseNames(spUsername).then((courses) => {
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


router.get("rick", (req, res) => {
    res.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
});



export default router;