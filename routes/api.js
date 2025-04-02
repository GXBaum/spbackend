import express from "express";
import {db as api} from "../db/db.js";
import {sendNotificationToUser} from "../services/notifications.js";
import {updateAllSpUserData} from "../services/updateAllSpUserData.js";

const router = express.Router();

router.post('/updateToken', (req, res) => {
    const { token, spUsername } = req.body;

    console.log(req.body);
    console.log('Received token:', token);
    console.log('For user:', spUsername);

    api.insertUserNotificationToken(spUsername, token)
        .then(() => {
            res.status(200).json({ success: true, message: 'Token updated successfully' });
        })
        .catch(error => {
            console.error('Error updating token:', error);
            res.status(500).json({ success: false, message: 'Failed to update token' });
        });
});

router.post('/userGrades', (req, res) => {
    const { spUsername } = req.body;

    try {
        sendNotificationToUser("Rafael.Beckmann", "user Noten angefragt", spUsername, "high")
    } catch (error) {
        console.error('Error sending notification:', error);
    }

    api.getUserGrades(spUsername)
        .then((grades) => {
            console.log('Fetched grades:', grades);
            res.status(200).json({ success: true, grades });
        })
        .catch(error => {
            console.error('Error fetching grades:', error);
            res.status(500).json({ success: false, message: 'Failed to fetch grades' });
        });
});

router.get('/triggerUpdate', (req, res) => {

    console.log('Received trigger update for user:');

    try {
        updateAllSpUserData("Rafael.Beckmann", "RafaelBigFail5-", 6078)
        res.status(200).json({ success: true, message: 'Update triggered successfully' });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ success: false, message: 'Failed to trigger update' });
    }

});


export default router;