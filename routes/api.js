import express from "express";
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";
import db from "../db/db.js";

const router = express.Router();

router.post('/updateToken', async (req, res) => {
    const {token, spUsername} = req.body;

    console.log(req.body);
    console.log('Received token:', token);
    console.log('For user:', spUsername);

    await db.connect();
    db.setNotificationToken(spUsername, token).then(
        () => {
            console.log('Token updated successfully');
            res.status(200).json({success: true, message: 'Token updated successfully'});
        }
    )
    await db.close()
});

router.post('/userMarks', async (req, res) => {
    const {spUsername} = req.body;

    try {
        await sendNotificationToUser("Rafael.Beckmann", "user Noten angefragt", spUsername, "high")
    } catch (error) {
        console.error('Error sending notification:', error);
    }

    await db.connect();
    db.getUserMarks().then((marks) => {
        res.status(200).json({success: true, marks});
    })
    await db.close();
});

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

    sendNotificationToUser("Rafael.Beckmann", "test", "test", "high")
        .then(() => {
            res.status(200).json({ success: true, message: 'Notification sent successfully' });
        })
        .catch(error => {
            console.error('Error sending notification:', error);
            res.status(500).json({ success: false, message: 'Failed to send notification' });
        });
});






export default router;