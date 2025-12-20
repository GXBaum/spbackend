import admin from "firebase-admin";
import 'dotenv/config';

// convert the json adminsdk file to base64 and put it into the environment variable FIREBASE_ADMINSDK_JSON_BASE64
const encodedString = process.env.FIREBASE_ADMINSDK_JSON_BASE64
if(!encodedString) {
    throw new Error("missing FIREBASE_ADMINSDK_JSON_BASE64 environment variable")
}
const serviceAccountString = Buffer.from(encodedString, "base64").toString("utf8");
console.log(serviceAccountString)
const serviceAccount = JSON.parse(serviceAccountString)
console.log(serviceAccount)
console.log(serviceAccount)

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

export default admin