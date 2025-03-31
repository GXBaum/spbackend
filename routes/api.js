import express from "express";
//const cors = require("cors");
//const app = express();

const router = express.Router();

//app.use(express.json());

router.post('/updateToken', (req, res) => {
    // Access the token data from req.body
    const { token, userId } = req.body;

    console.log('Received token:', token);
    console.log('For user:', userId);

    // Process the token and return a response
    res.status(200).json({ success: true });
});


export default router;