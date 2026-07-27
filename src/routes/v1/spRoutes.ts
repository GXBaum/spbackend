import {Router} from "express";
import {getCourseMarks, getCourses, getTest, postAuthCookie} from "../../controllers/spController.js";

const router = Router();

router.post("/authCookie", postAuthCookie);

router.get("/courses", getCourses)
router.get("/courses/:courseId/marks", getCourseMarks)

router.get("/test", getTest)

export default router;