import admin from "firebase-admin";
import serviceAccount from "./hvk-client-firebase-adminsdk-fbsvc-7b316feac0.json" with {type: "json"};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

export default admin