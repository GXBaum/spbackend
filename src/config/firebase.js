import admin from "firebase-admin";
// TODO: apparently deprectated but fails with recommended wiht keyword (maybe update node?) error: The 'assert' keyword for import attributes is deprecated. Use the 'with' syntax instead.
import serviceAccount from "./hvk-client-firebase-adminsdk-fbsvc-7b316feac0.json" with {type: "json"};

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

export default admin