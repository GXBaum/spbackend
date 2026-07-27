import type {CheerioAPI} from "cheerio";

// TODO: copied to test if it logs in
export function parseCourses($: CheerioAPI): {id: number, name: string}[] {
    const courses: any = [];

    $("#anwesend table.table tbody tr").each((i, row) => {
        const $row = $(row);
        const $courseCell = $row.find('td').first();
        const $courseLink = $courseCell.find('a');

        const course = {
            name: $courseLink.text().trim(),
            id: extractIdFromHref($courseLink.attr('href')),
        };

        courses.push(course);
    });

    function extractIdFromHref(href: any) {
        if (!href) return null;
        const match = href.match(/id=(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    return courses;
}

export interface mark {
    name: string;
    date: string;
    grade: string;
    id: number;
}
// TODO: copied
export function parseMarks($: CheerioAPI, courseId: number, halb: number) {
    const marks: mark[] = [];

    $('#marks table.table tbody tr').each((i, row) => {
        const $row = $(row);
        const markData = {
            name: $row.find('td').eq(0).text().trim(),
            date: $row.find('td').eq(1).text().trim(),
            grade: $row.find('td').eq(2).find('span.badge').text().trim(),
            id: Math.floor(Math.random() * 100000) + 1, // FIXME this is a crime
            courseId: courseId,
            halfYear: halb,
            isDeleted: false // the bad code will continue until morale improves
        };
        marks.push(markData);
    });

    return marks
}

export function parseChats($: CheerioAPI) {

}