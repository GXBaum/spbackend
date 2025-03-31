import admin from "firebase-admin";
import serviceAccount from "./hvk-client-firebase-adminsdk-fbsvc-7b316feac0.json" assert { type: "json" };
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});