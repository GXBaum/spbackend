import {readdirSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, expect, it} from "vitest";
import {parseVpHtml, type VpData} from "../../../src/services/vpScraperParser.js";

const fixtureDir = fileURLToPath(new URL("../../fixtures/vp", import.meta.url));
const fixtureFiles = readdirSync(fixtureDir)
    .filter(file => file.endsWith(".html"))
    .sort((a, b) => a.localeCompare(b));

const timestamp = new Date("2025-03-04T12:34:56.000Z");

describe("parseVpHtml", () => {
    if (fixtureFiles.length === 0) {
        it("is ready for fixture-backed cases", () => {
            expect(fixtureFiles).toEqual([]);
        });

        return;
    }

    for (const fixtureFile of fixtureFiles) {
        it(`parses ${fixtureFile}`, () => {
            const htmlPath = join(fixtureDir, fixtureFile);
            const jsonPath = join(fixtureDir, fixtureFile.replace(/\.html$/, ".json"));

            const html = readFileSync(htmlPath, "utf8");
            const expected = JSON.parse(readFileSync(jsonPath, "utf8")) as VpData;

            const result = parseVpHtml(html, timestamp);

            expect(result.rawPage).toBe(html);
            expect(result.timestamp.toISOString()).toBe(timestamp.toISOString());
            expect(result.websiteDate).toBe(expected.websiteDate);
            expect(result.details).toBe(expected.details);
            expect(result.missingTeachers).toEqual(expected.missingTeachers);
            expect(result.missingClasses).toEqual(expected.missingClasses);
            expect(result.missingRooms).toEqual(expected.missingRooms);
            expect(result.differentRooms).toEqual(expected.differentRooms);
            expect(result.substitutions).toEqual(expected.substitutions);
            expect(result.targetDateTest.toISOString()).toBe(expected.targetDateTest);
        });
    }
});
