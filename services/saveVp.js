import {scrapeVpData} from "./scrapeVp.js";

export function saveVp() {
    const data = scrapeVpData("https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html")

    console.log(data)
}

saveVp()