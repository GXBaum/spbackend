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

// TODO: bisschen goofy, im build script ist einfach cp vom ordner. vielleicht sollte das lieber in einem anderen repo sein
app.use(express.static("dist/public", {
    extensions: ["html"] // accept path without .html
}));

app.use("/v1", v1Routes);

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
