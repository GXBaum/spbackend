import axios from 'axios';

// Make sure to use the correct URL for your running application
const API_ENDPOINT = 'https://rafaelbeckmann.de/api/dev/vpSubstitutions/G10b';
const REQUEST_COUNT = 210;

async function testRateLimiter() {
    console.log(`Starting rate limit test with ${REQUEST_COUNT} requests...`);

    for (let i = 1; i <= REQUEST_COUNT; i++) {
        const startTime = Date.now();
        try {
            const response = await axios.get(API_ENDPOINT);
            const duration = Date.now() - startTime;
            console.log(`Request #${i}: Status ${response.status} | Duration: ${duration}ms`);
        } catch (error) {
            const duration = Date.now() - startTime;
            if (error.response) {
                console.error(`Request #${i}: Status ${error.response.status} | Duration: ${duration}ms`);
            } else {
                console.error(`Request #${i}: Error: ${error.message}`);
            }
        }
    }
}

testRateLimiter();