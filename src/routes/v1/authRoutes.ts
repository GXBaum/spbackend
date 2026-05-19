import {Router} from "express";
import {postLogin, postLogout, postRefresh, postRegister} from "../../controllers/authController.js";

const router = Router();

router.post("/register", postRegister);
router.post("/login", postLogin);
router.post("/refresh", postRefresh);
router.post("/logout", postLogout);

export default router;