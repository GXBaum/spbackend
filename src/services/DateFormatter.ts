import {addDays, format, isSameDay} from "date-fns";

export function relativeDateFormatter(date: Date): string {
    const now = new Date();

    if (isSameDay(date, now)) {
        return "Heute";
    }

    if (isSameDay(date, addDays(now, 1))) {
        return "Morgen";
    }

    if (isSameDay(date, addDays(now, 2))) {
        return "Übermorgen";
    }

    if (date.getFullYear() === now.getFullYear()) {
        return format(date, "dd.MM.");
    }

    return format(date, "dd.MM.yyyy");
}