import {Router} from "express";
import {getTest, postAuthCookie, PostAuthCookieSchema} from "../../controllers/spController.js";

const router = Router();

router.post("/authCookie", postAuthCookie);

router.get("/test", getTest)

export default router;