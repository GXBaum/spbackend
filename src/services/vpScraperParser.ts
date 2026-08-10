import * as cheerio from "cheerio";
import {parse} from "date-fns";
import {de} from "date-fns/locale/de";
import { logger } from "../logger.js";

export interface VpSubstitution {
    hour: string;
    course: string;
    original: string;
    replacement: string;
    description: string;
}

export interface VpData {
    rawPage: string;
    timestamp: Date;
    websiteDate: string;
    details: string;
    missingTeachers: string[];
    missingClasses: string[];
    missingRooms: string[];
    differentRooms: VpSubstitution[];
    substitutions: VpSubstitution[];

    targetDateTest: Date;
}

// TODO: rewrite (burn everything)
export function parseVpHtml(html: string, timestamp = new Date()): VpData {
    const formattedData = html.replace(/>\s*</g, ">\n<");
    const $ = cheerio.load(formattedData);

    // Helper function to clean text by removing extra whitespace
    const cleanText = (text: string) => text.replace(/\s+/g, " ").trim();

    // Find table that follows specific text
    function findTableAfterText(text: string) {
        let foundText = false;
        let tableElement = null;

        // Check plain text nodes
        $("body").contents().each(function () {
            if (this.type === "text" && $(this).text().trim() === text) {
                foundText = true;
                // @ts-ignore
            } else if (foundText && this.name === "table") {
                tableElement = this;
                return false;
            }
        });

        // If not found, check text inside tags
        if (!tableElement) {
            $("body").find("*").each(function () {
                if ($(this).children().length === 0 && $(this).text().trim().includes(text)) {
                    foundText = true;
                } else if (foundText && this.name === "table") {
                    tableElement = this;
                    return false;
                }
            });
        }

        return tableElement ? $(tableElement) : null;
    }

    function findTableAfterHr(differentRoomsTable: any) {
        let result = null;

        $("hr").each(function () {
            const nextSibling = this.nextSibling;
            const nextElement = $(this).next();
            // Check if the next sibling is either null or a text node with only whitespace
            const isWhitespace = nextSibling && nextSibling.nodeType === 3 && nextSibling.nodeValue.trim() === "";

            if (nextElement.is("table") && (nextSibling === null || isWhitespace)) {
                if (differentRoomsTable && nextElement.is(differentRoomsTable)) {
                    // Skip this table because it's the Ersatzraumplan table
                    logger.debug("substitutions table not found");
                    return;
                }
                result = nextElement;
                return false;
            }
        });

        return result;
    }

    function scrapeTableData(table: any) {
        const rows: any = [];

        if (table) {
            table.find("tr").each((i: any, row: any) => {
                const entries: any = [];
                $(row).find("td").each((i, td) => {
                    entries.push($(td).text().trim());
                });

                for (let i = 0; i < entries.length; i += 2) {
                    rows.push(entries.slice(i, i + 2));
                }
            });
        }
        return rows;
    }

    function scrapeSchedule(table: any) {
        const changes: any = [];
        let currentGroup = "";

        if (!table) {
            return [];
        }

        table.find("tr").each((index: any, element: any) => {
            const $element = $(element);

            if ($element.find("th").length > 0) {
                // This is a header row
                currentGroup = cleanText($element.find("th").text());
            } else {
                // This is a data row
                const columns = $element.find("td").map((i, el) => {
                    if (i !== 2) {
                        return cleanText($(el).text());
                    }
                    return undefined;
                }).get();

                if (columns.length) {
                    const filteredColumns = columns.filter(col => col !== undefined);
                    changes.push({
                        course: currentGroup,
                        hour: filteredColumns[0],
                        original: filteredColumns[1],
                        replacement: filteredColumns[2],
                        description: filteredColumns[3]
                    });
                }
            }
        });

        return changes;
    }

    // Extract key information
    //const websiteDate = "Freitag, 04. Apr 2025"
    const websiteDate = cleanText($('h3').eq(1).text().replace('Vertretungsplan für ', ''));


    let uniqueBlocks: string[] = [];

    $('big').each((index, element) => {
        const blockText = cleanText($(element).text()).trim();

        // Nur hinzufügen, wenn wir diesen Textblock nicht schon holding haben
        // und er nicht leer ist
        if (blockText && !uniqueBlocks.includes(blockText)) {
            uniqueBlocks.push(blockText);
        }
    });

    // Verbindet die einzelnen Blöcke wieder mit Absätzen
    const details = uniqueBlocks.join('\n\n');
    const formatString = "EEEE, dd. MMM yyyy";

    // all month shorthands are correct except march.
    // vp uses: Jan, Feb, Mrz, Apr, Mai, Jun, Jul, Aug, Sep, Okt, Nov, Dez
    const localTime = parse(websiteDate.replace("Mrz", "Mär"), formatString, new Date(), {locale: de});
    const targetDate = new Date(Date.UTC(localTime.getFullYear(), localTime.getMonth(), localTime.getDate())); // otherwise it would be offset by -2 hours in germany local time and show the wrong date
    logger.debug({targetDate});


    // TODO: remove this
    /*
    const test = "Freitag, 06. Mrz 2026\n" +
        "Freitag, 13. Mrz 2026\n" +
        "Freitag, 16. Jan 2026\n" +
        "Freitag, 20. Mrz 2026\n" +
        "Freitag, 23. Jan 2026\n" +
        "Dienstag, 05. Mai 2026\n" +
        "Dienstag, 24. Feb 2026\n" +
        "Dienstag, 24. Mrz 2026\n" +
        "Dienstag, 27. Jan 2026\n" +
        "Dienstag, 28. Okt 2025\n" +
        "Donnerstag, 07. Mai 2026\n" +
        "Mittwoch, 28. Jan 2026\n" +
        "Mittwoch, 29. Okt 2025\n" +
        "Montag, 04. Mai 2026\n" +
        "Montag, 23. Feb 2026\n" +
        "Montag, 27. Okt 2025\n" +
        "Donnerstag, 30. Okt 2025\n" +
        "Dienstag, 11. Nov 2025\n" +
        "Freitag, 17. Apr 2026\n" +
        "Freitag, 19. Dez 2025\n" +
        "Freitag, 31. Okt 2025\n" +
        "Dienstag, 13. Jan 2026\n" +
        "Dienstag, 10. Mrz 2026\n" +
        "Donnerstag, 21. Mai 2026\n" +
        "Donnerstag, 19. Mrz 2026\n" +
        "Donnerstag, 26. Mrz 2026\n" +
        "Freitag, 26. Sep 2025\n" +
        "Freitag, 14. Nov 2025\n" +
        "Mittwoch, 12. Nov 2025\n" +
        "Mittwoch, 22. Okt 2025\n" +
        "Freitag, 22. Mai 2026\n" +
        "Mittwoch, 11. Feb 2026\n" +
        "Mittwoch, 10. Dez 2025\n" +
        "Mittwoch, 18. Feb 2026\n" +
        "Mittwoch, 25. Feb 2026\n" +
        "Mittwoch, 11. Mrz 2026\n" +
        "Mittwoch, 21. Jan 2026\n" +
        "Mittwoch, 03. Dez 2025\n" +
        "Donnerstag, 12. Feb 2026\n" +
        "Donnerstag, 27. Nov 2025\n" +
        "Mittwoch, 06. Mai 2026\n" +
        "Mittwoch, 19. Nov 2025\n" +
        "Mittwoch, 20. Mai 2026\n" +
        "Mittwoch, 24. Sep 2025\n" +
        "Mittwoch, 26. Nov 2025\n" +
        "Montag, 08. Dez 2025\n" +
        "Montag, 09. Feb 2026\n" +
        "Montag, 10. Nov 2025\n" +
        "Montag, 12. Jan 2026\n" +
        "Montag, 15. Sep 2025\n" +
        "Montag, 20. Apr 2026\n" +
        "Montag, 24. Nov 2025\n" +
        "Montag, 29. Sep 2025\n" +
        "Montag, 02. Mrz 2026\n" +
        "Montag, 27. Apr 2026\n" +
        "Mittwoch, 15. Apr 2026\n" +
        "Mittwoch, 22. Apr 2026\n" +
        "Freitag, 06. Feb 2026\n" +
        "Freitag, 24. Apr 2026\n" +
        "Freitag, 28. Nov 2025\n" +
        "Freitag, 12. Dez 2025\n" +
        "Freitag, 20. Feb 2026\n" +
        "Freitag, 05. Dez 2025\n" +
        "Freitag, 21. Nov 2025\n" +
        "Mittwoch, 01. Okt 2025\n" +
        "Mittwoch, 13. Mai 2026\n" +
        "Mittwoch, 17. Dez 2025\n" +
        "Donnerstag, 18. Sep 2025\n" +
        "Donnerstag, 05. Mrz 2026\n" +
        "Donnerstag, 11. Dez 2025\n" +
        "Donnerstag, 12. Mrz 2026\n" +
        "Donnerstag, 18. Dez 2025\n" +
        "Freitag, 27. Feb 2026\n" +
        "Mittwoch, 14. Jan 2026\n" +
        "Mittwoch, 17. Sep 2025\n" +
        "Montag, 01. Dez 2025\n" +
        "Montag, 11. Mai 2026\n" +
        "Mittwoch, 04. Feb 2026\n" +
        "Donnerstag, 13. Nov 2025\n" +
        "Donnerstag, 23. Apr 2026\n" +
        "Donnerstag, 25. Sep 2025\n" +
        "Donnerstag, 29. Jan 2026\n" +
        "Donnerstag, 26. Feb 2026\n" +
        "Donnerstag, 30. Apr 2026\n" +
        "Donnerstag, 16. Apr 2026\n" +
        "Donnerstag, 06. Nov 2025\n" +
        "Montag, 02. Feb 2026\n" +
        "Montag, 09. Mrz 2026\n" +
        "Donnerstag, 02. Okt 2025\n" +
        "Donnerstag, 19. Feb 2026\n" +
        "Dienstag, 09. Dez 2025\n" +
        "Dienstag, 14. Apr 2026\n" +
        "Dienstag, 23. Sep 2025\n" +
        "Dienstag, 25. Nov 2025\n" +
        "Donnerstag, 04. Dez 2025\n" +
        "Montag, 15. Dez 2025\n" +
        "Donnerstag, 05. Feb 2026\n" +
        "Donnerstag, 20. Nov 2025\n" +
        "Dienstag, 02. Dez 2025\n" +
        "Dienstag, 03. Mrz 2026\n" +
        "Dienstag, 10. Feb 2026\n" +
        "Dienstag, 16. Sep 2025\n" +
        "Dienstag, 18. Nov 2025\n" +
        "Dienstag, 21. Apr 2026\n" +
        "Dienstag, 21. Okt 2025\n" +
        "Dienstag, 28. Apr 2026\n" +
        "Montag, 13. Apr 2026\n" +
        "Montag, 17. Nov 2025\n" +
        "Montag, 22. Sep 2025\n" +
        "Montag, 18. Mai 2026\n" +
        "Montag, 20. Okt 2025\n" +
        "Montag, 03. Nov 2025\n" +
        "Dienstag, 20. Jan 2026\n" +
        "Dienstag, 30. Sep 2025\n" +
        "Mittwoch, 04. Mrz 2026\n" +
        "Mittwoch, 29. Apr 2026\n" +
        "Freitag, 13. Feb 2026\n" +
        "Freitag, 07. Nov 2025\n" +
        "Freitag, 24. Okt 2025\n" +
        "Freitag, 08. Mai 2026\n" +
        "Freitag, 19. Sep 2025\n" +
        "Dienstag, 04. Nov 2025\n" +
        "Dienstag, 16. Dez 2025\n" +
        "Donnerstag, 22. Jan 2026\n" +
        "Donnerstag, 15. Jan 2026\n" +
        "Freitag, 12. Sep 2025\n" +
        "Dienstag, 19. Mai 2026\n" +
        "Dienstag, 03. Feb 2026\n" +
        "Montag, 26. Jan 2026\n" +
        "Dienstag, 12. Mai 2026\n" +
        "Mittwoch, 05. Nov 2025\n" +
        "Montag, 19. Jan 2026\n" +
        "Dienstag, 12. Mai\n" +
        "Donnerstag, 23. Okt 2025\n" +
        "Dienstag, 17. Mrz 2026\n" +
        "Montag, 16. Mrz 2026\n" +
        "Montag, 23. Mrz 2026\n" +
        "Freitag, 27. Mrz 2026\n" +
        "Freitag, 30. Jan 2026\n" +
        "Mittwoch, 18. Mrz 2026\n" +
        "Freitag, 04. Apr 2025\n" +
        "Dienstag, 22. Apr 2025\n" +
        "Mittwoch, 23. Apr 2025\n" +
        "Donnerstag, 24. Apr 2025\n" +
        "Freitag, 25. Apr 2025\n" +
        "Montag, 28. Apr 2025\n" +
        "Dienstag, 29. Apr 2025\n" +
        "Mittwoch, 30. Apr 2025\n" +
        "Freitag, 02. Mai 2025\n" +
        "Montag, 05. Mai 2025\n" +
        "Dienstag, 06. Mai 2025\n" +
        "Mittwoch, 07. Mai 2025\n" +
        "Donnerstag, 08. Mai 2025\n" +
        "Freitag, 09. Mai 2025\n" +
        "Montag, 12. Mai 2025\n" +
        "Dienstag, 13. Mai 2025\n" +
        "Mittwoch, 14. Mai 2025\n" +
        "Donnerstag, 15. Mai 2025\n" +
        "Freitag, 16. Mai 2025\n" +
        "Montag, 19. Mai 2025\n" +
        "Dienstag, 20. Mai 2025\n" +
        "Mittwoch, 21. Mai 2025\n" +
        "Donnerstag, 22. Mai 2025\n" +
        "Freitag, 23. Mai 2025\n" +
        "Montag, 26. Mai 2025\n" +
        "Dienstag, 27. Mai 2025\n" +
        "Mittwoch, 28. Mai 2025\n" +
        "Montag, 02. Jun 2025\n" +
        "Dienstag, 03. Jun 2025\n" +
        "Mittwoch, 04. Jun 2025\n" +
        "Donnerstag, 05. Jun 2025\n" +
        "Freitag, 06. Jun 2025\n" +
        "Dienstag, 10. Jun 2025\n" +
        "Mittwoch, 11. Jun 2025\n" +
        "Donnerstag, 12. Jun 2025\n" +
        "Freitag, 13. Jun 2025\n" +
        "Montag, 23. Jun 2025\n" +
        "Dienstag, 24. Jun 2025\n" +
        "Mittwoch, 25. Jun 2025\n" +
        "Donnerstag, 26. Jun 2025\n" +
        "Freitag, 27. Jun 2025\n" +
        "Montag, 30. Jun 2025\n" +
        "Donnerstag, 03. Jul 2025\n" +
        "Freitag, 04. Jul 2025\n" +
        "Montag, 18. Aug 2025\n" +
        "Dienstag, 19. Aug 2025\n" +
        "Mittwoch, 20. Aug 2025\n" +
        "Donnerstag, 21. Aug 2025\n" +
        "Freitag, 22. Aug 2025\n" +
        "Montag, 25. Aug 2025\n" +
        "Dienstag, 26. Aug 2025\n" +
        "Mittwoch, 27. Aug 2025\n" +
        "Donnerstag, 28. Aug 2025\n" +
        "Freitag, 29. Aug 2025\n" +
        "Montag, 08. Sep 2025\n" +
        "Dienstag, 09. Sep 2025\n" +
        "Mittwoch, 10. Sep 2025\n" +
        "Donnerstag, 11. Sep 2025\n" +
        "Freitag, 12. Sep 2025\n" +
        "Montag, 15. Sep 2025";

    const array = test.split("\n");

    array.forEach(item => {
        console.log("---")
        const formatString = "EEEE, dd. MMM yyyy";
        console.log(item.replace("Mrz", "Mär"))

        const localTime = parse(item.replace("Mrz", "Mär"), formatString, new Date(), {locale: de});
        const targetDate = new Date(Date.UTC(localTime.getFullYear(), localTime.getMonth(), localTime.getDate()));
        console.log(targetDate);
    })
    */


    // Find relevant tables
    const missingTeachersTable = findTableAfterText("fehlende Lehrer:");
    const missingClassesTable = findTableAfterText("fehlende Klassen:");
    const missingRoomsTable = findTableAfterText("fehlende Räume:");
    const differentRoomsTable = findTableAfterText("Ersatzraumplan");
    const substitutionsTable = findTableAfterHr(differentRoomsTable);

    // Assemble the result
    return {
        rawPage: html.toString(),
        timestamp,
        websiteDate,
        details,
        missingTeachers: scrapeTableData(missingTeachersTable),
        missingClasses: scrapeTableData(missingClassesTable),
        missingRooms: scrapeTableData(missingRoomsTable),
        differentRooms: scrapeSchedule(differentRoomsTable),
        substitutions: scrapeSchedule(substitutionsTable),

        targetDateTest: targetDate
    }
}