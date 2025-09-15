// tests/unit/services/vpCheckForDifferences.test.js
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {describe, expect, test} from 'vitest';
import {vpCheckForDifferences} from '../../../src/services/vpCheckForDifferences.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createMockVpRepository({ usersConfig = { userA: ['MATH', 'EN'], userB: ['EN'] } } = {}) {
    const planHtml = {};          // dayString -> html
    const substitutions = [];     // stored substitution rows
    const userCourses = new Map();// userId -> Set(course)

    Object.entries(usersConfig).forEach(([user, courses]) => {
        userCourses.set(user, new Set(courses));
    });

    return {
        getPlanHtml(dayString) {
            return planHtml[dayString];
        },
        upsertPlanHtml(dayString, html) {
            planHtml[dayString] = html;
        },
        listSubstitutions(course, day, vpDate) {
            return substitutions.filter(
                s => s.course === course && s.day === day && s.vp_date === vpDate
            );
        },
        insertSubstitution(row) {
            substitutions.push(row);
        },
        getUsersWithSelectedCourses(course) {
            const list = [];
            for (const [userId, set] of userCourses.entries()) {
                if (set.has(course)) list.push({ user_id: userId });
            }
            return list;
        },
        getUserVpSelectedCourses(userId) {
            const set = userCourses.get(userId);
            if (!set) return [];
            return [...set].map(course => ({ course }));
        }
    };
}

describe('vpCheckForDifferences (Vitest)', () => {
    const fixtureDir = path.resolve(__dirname, '../../fixtures/vp-examples');
    const htmlFixtureName = process.env.VP_FIXTURE || 'vp.html';
    const baseName = htmlFixtureName.replace(/\.html$/i, '');
    const fixtureHtmlFile = path.join(fixtureDir, htmlFixtureName);
    const expectedFile = path.join(fixtureDir, `${baseName}.expected.json`);

    // Edit this array to reflect what the scraper should parse from the HTML fixture
    const fixtureSubstitutions = [
        {
            course: 'MATH',
            hour: '1',
            original: 'Müller',
            replacement: 'Schmidt',
            description: 'Vertretung'
        },
        {
            course: 'EN',
            hour: '3',
            original: 'Smith',
            replacement: null,
            description: 'Raum 101'
        }
    ];

    const websiteDate = '2025-09-13'; // adjust if needed

    function makeScraperReturningFixture() {
        return async function scraperStub(_url) {
            const rawPage = fs.readFileSync(fixtureHtmlFile, 'utf8');
            return {
                rawPage,
                substitutions: fixtureSubstitutions,
                websiteDate
            };
        };
    }

    function normalizeNotifications(list) {
        return [...list].sort((a, b) =>
            (a.userId + a.title).localeCompare(b.userId + b.title)
        );
    }

    test('creates or matches expected notification snapshot, then no duplicates on second run', async () => {
        if (!fs.existsSync(fixtureHtmlFile)) {
            throw new Error(`Missing HTML fixture at: ${fixtureHtmlFile}`);
        }

        const sentNotifications = [];
        const notifier = async (userId, title, message, data) => {
            sentNotifications.push({ userId, title, message, data });
        };

        const deepLinkBuilder = (_screen, params) => `app://vp?course=${params.course}`;
        const channelNames = { CHANNEL_VP_UPDATES: 'vp_updates' };

        const vpRepository = createMockVpRepository();
        const scraper = makeScraperReturningFixture();

        // First run (should detect changes)
        await vpCheckForDifferences(1, {
            vpRepository,
            scraper,
            notifier,
            deepLinkBuilder,
            channelNames
        });

        const normalized = normalizeNotifications(sentNotifications);
        const actualResult = { notifications: normalized };

        if (process.env.UPDATE_EXPECTED === '1' || !fs.existsSync(expectedFile)) {
            fs.writeFileSync(expectedFile, JSON.stringify(actualResult, null, 2), 'utf8');
            // eslint-disable-next-line no-console
            console.log(`Expected file written: ${expectedFile}`);
        }

        const expected = JSON.parse(fs.readFileSync(expectedFile, 'utf8'));
        expect(actualResult).toEqual(expected);

        // Second run: should produce no new notifications
        const secondRunNotifications = [];
        await vpCheckForDifferences(1, {
            vpRepository,
            scraper,
            notifier: async (u, t, m, d) => secondRunNotifications.push({ u, t, m, d }),
            deepLinkBuilder,
            channelNames
        });
        expect(secondRunNotifications).toHaveLength(0);
    });
});
