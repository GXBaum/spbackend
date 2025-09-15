import jwt from 'jsonwebtoken';
import {randomBytes} from 'crypto';
import {createDefaultAuthRepository} from "./db/repositories/authRepository.js";

export const login = async (
    req,
    res,
    {
        authRepo = createDefaultAuthRepository()
    } = {}
) => {
    console.log("Received login request:", req.body);
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    try {
        // TODO: encrypt passwords in db
        const user = authRepo.getUserByUsername(username);

        if (!user || user.sp_password !== password) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // User is authenticated, create tokens
        const accessToken = jwt.sign(
            { username: user.sp_username, uid: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        const refreshToken = randomBytes(64).toString('hex');

        // Store refresh token in DB
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + 90); // 90-day expiry
        authRepo.storeRefreshToken(user.id, refreshToken, expiryDate.toISOString());

        res.json({ success: true, accessToken, refreshToken, userId: user.id });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const refreshToken = async (req, res, { authRepo = createDefaultAuthRepository() } = {}) => {
    const { token } = req.body;
    if (!token) return res.sendStatus(401);

    try {
        const storedToken = authRepo.getRefreshToken(token);
        if (!storedToken) return res.sendStatus(403);

        // Optional expiry enforcement
        /*
        if (new Date(storedToken.expires_at) < new Date()) {
            authRepo.deleteRefreshToken(token);
            return res.status(403).json({ success: false, message: 'Refresh token expired' });
        }
        */

        const accessToken = jwt.sign(
            { username: storedToken.sp_username, uid: storedToken.user_id },
            process.env.JWT_SECRET,
            { expiresIn: '5m' }
        );

        res.json({ success: true, accessToken });
    } catch (error) {
        console.error('Refresh token error:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        console.log('Authentication error: No token provided.');
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Authentication error: Token is invalid.', err.message);
            return res.sendStatus(401);
        }
        req.user = user;
        next();
    });
};

export const authorizeUser = (req, res, next) => {
    if (Number(req.user.uid) !== Number(req.params.userId)) {
        console.log(`Authorization error: User ${req.user.uid} is not authorized for resource owned by ${req.params.userId}.`);
        return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    next();
};
