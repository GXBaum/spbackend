import express, {type Application} from "express";
import v1Routes from "./routes/v1/index.js"
import {requestLogger} from "./middleware/requestLogger.js";
import {scrapeVp} from "./services/vpScraperService.js";
import {Day} from "./generated/prisma/enums.js";

const app: Application = express();
const port = 3000;

app.set("trust proxy", 1)

// Enable URL-encoded form data parsing // brauche ich das?
app.use(express.urlencoded({extended: true}));

// parse json bodies
app.use(express.json());


app.use(requestLogger);

app.use(express.static("src/public")); // TODO: geht nur weil src noch da ist, wird aber nicht in dist kopiert
app.use("/api/v1", v1Routes);

app.listen(port, () => {
    console.log(`server listening on http://localhost:${port}`);

    // TODO move this?
    setInterval(async () => {
        try {
            await scrapeVp(Day.today);
            console.log("Scraped today");

            await scrapeVp(Day.tomorrow);
            console.log("Scraped tomorrow");
        } catch {
            console.log("scrape failed");
        }
    }, 10_000)
});
