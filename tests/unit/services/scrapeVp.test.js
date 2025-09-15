import {beforeEach, describe, expect, it, vi} from 'vitest';
import axios from 'axios';
import {readFileSync} from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {scrapeVpData} from '../../../src/services/scrapeVp.js';

vi.mock('axios');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve: tests/unit/services -> ../../fixtures/vp-examples/vp.html
const sampleHtml = readFileSync(
  path.resolve(__dirname, '..', '..', 'fixtures', 'vp-examples', 'vp.html'),
  'utf8'
);

describe('scrapeVpData', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('parses expected fields', async () => {
        axios.get.mockResolvedValue({ data: sampleHtml });

        const result = await scrapeVpData('http://example.test/vp.html');

        expect(result.error).toBeUndefined();
        expect(result.websiteDate).toBe('Donnerstag, 20. Feb 2025');
        //expect(result.details).toBe('Zweite große Pause Kartenverkauf  Theaterwerkstatt in Raum 016 !!!');


        /*expect(result.missingTeachers).toEqual([
            ['Müller', 'krank'],
            ['Schmidt', 'Fortbildung']
        ]);*/
        expect(result.missingTeachers).toHaveLength(48);

        /*expect(result.missingClasses).toEqual([
            ['10A', 'Wandertag']
        ]);*/
        expect(result.missingClasses).toHaveLength(14);


        /*expect(result.missingRooms).toEqual([
            ['201', 'gesperrt']
        ]);*/
        expect(result.missingRooms).toHaveLength(22);


        expect(result.substitutions[0]).toMatchObject({
            course: 'Int.2',
            hour: '3',
            original: 'Ed FöD',
            replacement: '-----',
            description: 'in die Klassen',
            data: ['3','Ed FöD','-----','in die Klassen']
        });

        //expect(result.substitutions).toHaveLength(1);
        console.log(result.differentRooms[0])
        expect(result.differentRooms[0]).toMatchObject({
            course: 'G7a',
            hour: '3',
            original: 'Ul F',
            replacement: 'Ul F 045',
            description: 'in Raum 045',
            data: ['3','Ul F','Ul F 045','in Raum 045']
        });

        expect(typeof result.rawPage).toBe('string');
        expect(result.timestamp).toBeTruthy();
    });

    it('returns error info on failure', async () => {
        axios.get.mockRejectedValue({
            message: 'Not Found',
            response: { status: 404 }
        });

        const result = await scrapeVpData('http://example.test/missing.html');
        expect(result.error).toBe(true);
        expect(result.status).toBe(404);
        expect(result.message).toBe('Not Found');
        expect(result.timestamp).toBeTruthy();
    });
});
