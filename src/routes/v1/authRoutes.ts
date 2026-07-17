import {Router} from "express";
import {postLogout, postRefresh, postRegister} from "../../controllers/authController.js";

const router = Router();

router.post("/register", postRegister);
// router.post("/login", postLogin); // FIXME
router.post("/refresh", postRefresh);
router.post("/logout", postLogout);

export default router;