import {cert, initializeApp} from "firebase-admin/app";
import {getMessaging} from "firebase-admin/messaging";

const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
if (!serviceAccountRaw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON env variable")

const serviceAccount = JSON.parse(serviceAccountRaw)

initializeApp({
    credential: cert(serviceAccount)
});

export const messaging = getMessaging()