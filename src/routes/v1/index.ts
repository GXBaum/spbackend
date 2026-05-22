import {Router} from "express";
import vpRoutes from "./vpRoutes.js";
import authRoutes from "./authRoutes.js";
import userRoutes from "./userRoutes.js";
import {authenticateToken} from "../../middleware/authMiddleware.js";

const router = Router();

router.use("/vp", vpRoutes);
router.use("/auth", authRoutes);
router.use("/users/me", authenticateToken, userRoutes)


export default router;