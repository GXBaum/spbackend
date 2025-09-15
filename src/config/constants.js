export const USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15";
export const EXPRESS_PORT = 5000;
export const DB_PATH = "./db/database_test_v2.db";

export const TABLE_NAMES = {
    USER: "user",
    COURSE: "course",
    USER_COURSE: "user_course",
    MARK: "mark",
    TEACHER: "teacher",
    COURSE_TEACHER: "course_teacher",
    USER_NOTIFICATION_TOKEN: "user_notification_token",
    //USER_NOTIFICATION_PREFS: "user_notification_prefs"
    USER_VP_SELECTED_COURSE: "user_vp_selected_course",
    VP_DIFFERENCES: "vp_differences",
    VP_SUBSTITUTION: "vp_substitution",
    REFRESH_TOKEN: "refresh_token"
};

export const CHANNEL_NAMES = {
    CHANNEL_GRADES: "grade_notifications",
    CHANNEL_VP_UPDATES: "vp_updates",
    CHANNEL_OTHER: "other_notifications",
}