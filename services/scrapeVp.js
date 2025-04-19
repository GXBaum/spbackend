import axios from "axios";
import * as cheerio from "cheerio";


export async function scrapeVpData(url) {
    const timestamp = new Date().toISOString(); // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ

    try {
        const {data} = await axios.get(url);
        const formattedData = data.replace(/>\s*</g, ">\n<");
        const $ = cheerio.load(formattedData);

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
            let rows = [];

            if (table) {
                table.find("tr").each((i, row) => {
                    let entries = [];
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


        const cleanText = (text) => text.replace(/\s+/g, " ").trim();

        const scrapeSchedule = (table) => {
            const changes = [];
            let currentGroup = "";

            if (table) {
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
                        }).get();

                        if (columns.length) {
                            changes.push({
                                course: currentGroup,
                                data: columns.filter(col => col !== undefined)
                            });
                        }
                    }
                });
            } else {
                return [];
            }
            return changes;
        };


        const websiteDate = cleanText($('h3').eq(1).text().replace('Vertretungsplan für ', ''));
        const details = cleanText($('big').text());

        const missingTeachersTable = findTableAfterText("fehlende Lehrer:");
        const missingClassesTable = findTableAfterText("fehlende Klassen:");
        const missingRoomsTable = findTableAfterText("fehlende Räume:");
        const differentRoomsTable = findTableAfterText("Ersatzraumplan");
        const substitutionsTable = findTableAfterHr(differentRoomsTable);

        let scrapedData = {
            timestamp,
            websiteDate,
            details,
            missingTeachers: scrapeTableData(missingTeachersTable),
            missingClasses: scrapeTableData(missingClassesTable),
            missingRooms: scrapeTableData(missingRoomsTable),
            differentRooms: scrapeSchedule(differentRoomsTable),
            substitutions: scrapeSchedule(substitutionsTable),
        };

        console.log(scrapedData);
        return scrapedData

    } catch (error) {
        console.error("Error fetching or parsing the HTML:", error);
    }
}

//scrapeData("/Users/Rafael/Downloads/vp1.html")
//scrapeData("http://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html");
//scrapeData("http://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/2/vp.html");