import {Router} from "express";
import {getCourses, getSubstitutions, postSubstitutions} from "../../controllers/substitutionsController.js";
import {authenticateToken} from "../../middleware/authMiddleware.js";
import {deleteEnrolled, getEnrolled, postEnrolled} from "../../controllers/enrolledController.js";

const router = Router();

router.get("/substitutions", getSubstitutions);
router.post("/substitutions", postSubstitutions);

router.get("/courses", getCourses)

router.get("/enrolled", authenticateToken, getEnrolled); // TODO: unsure of this api structure and name
router.post("/enrolled", authenticateToken, postEnrolled);
router.delete("/enrolled/:courseId", authenticateToken, deleteEnrolled)

export default router;