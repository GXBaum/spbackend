import axios from "axios";
import * as cheerio from "cheerio";

/**
 * Scrapes data from a vertretungsplan (substitution plan) URL
 * @param {string} url - The URL to scrape
 * @returns {Promise<Object|null>} - The scraped data or null if an error occurred
 */
export async function scrapeVpData(url) {
    const timestamp = new Date().toISOString(); // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ

    try {
        const { data } = await axios.get(url);
        const formattedData = data.replace(/>\s*</g, ">\n<");
        const $ = cheerio.load(formattedData);

        // Helper function to clean text by removing extra whitespace
        const cleanText = (text) => text.replace(/\s+/g, " ").trim();

        // Find table that follows specific text
        function findTableAfterText(text) {
            let foundText = false;
            let tableElement = null;

            // Check plain text nodes
            $("body").contents().each(function () {
                if (this.type === "text" && $(this).text().trim() === text) {
                    foundText = true;
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

        function findTableAfterHr(differentRoomsTable) {
            let result = null;

            $("hr").each(function () {
                const nextSibling = this.nextSibling;
                const nextElement = $(this).next();
                // Check if the next sibling is either null or a text node with only whitespace
                const isWhitespace = nextSibling && nextSibling.nodeType === 3 && nextSibling.nodeValue.trim() === "";

                if (nextElement.is("table") && (nextSibling === null || isWhitespace)) {
                    if (differentRoomsTable && nextElement.is(differentRoomsTable)) {
                        // Skip this table because it's the Ersatzraumplan table
                        console.log("no substitutions table")
                        return;
                    }
                    result = nextElement;
                    return false;
                }
            });

            return result;
        }

        function scrapeTableData(table) {
            const rows = [];

            if (table) {
                table.find("tr").each((i, row) => {
                    const entries = [];
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

        function scrapeSchedule(table) {
            const changes = [];
            let currentGroup = "";

            if (!table) {
                return [];
            }

            table.find("tr").each((index, element) => {
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
                        changes.push({
                            course: currentGroup,
                            data: columns.filter(col => col !== undefined)
                        });
                    }
                }
            });

            return changes;
        }

        // Extract key information
        const websiteDate = cleanText($('h3').eq(1).text().replace('Vertretungsplan für ', ''));
        const details = cleanText($('big').text());

        // Find relevant tables
        const missingTeachersTable = findTableAfterText("fehlende Lehrer:");
        const missingClassesTable = findTableAfterText("fehlende Klassen:");
        const missingRoomsTable = findTableAfterText("fehlende Räume:");
        const differentRoomsTable = findTableAfterText("Ersatzraumplan");
        const substitutionsTable = findTableAfterHr(differentRoomsTable);

        // Assemble the result
        return {
            rawPage: data.toString(),
            timestamp,
            websiteDate,
            details,
            missingTeachers: scrapeTableData(missingTeachersTable),
            missingClasses: scrapeTableData(missingClassesTable),
            missingRooms: scrapeTableData(missingRoomsTable),
            differentRooms: scrapeSchedule(differentRoomsTable),
            substitutions: scrapeSchedule(substitutionsTable),
        }

    } catch (error) {
        console.error("Error fetching or parsing the HTML:", error);
        return {
            timestamp,
            error: true,
            message: error.message,
            status: error.response?.status
        };
    }
}

//scrapeData("/Users/Rafael/Downloads/vp1.html")
//scrapeData("http://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html");
//scrapeData("http://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/2/vp.html");