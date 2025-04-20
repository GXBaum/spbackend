import {scrapeVpData} from "./scrapeVp.js";
import db from "../db/insert.js"


export async function vpCheckForDifferences() {
    const data = await scrapeVpData("https://www.kleist-schule.de/vertretungsplan/schueler/aktuelle%20plaene/1/vp.html")
    const oldRawData = await db.getVpDifferences("today")

    if (oldRawData === data.rawPage) {
        console.log("no changes")
        return
    }

    console.log("changes detected")

    //TODO: remove
    await db.insertVpDifferences("today", data.rawPage)


    const oldData = await db.getVpDifferences("today")

    /*await db.deleteVpSubstitutionsForDay("today")

    data.substitutions.forEach((substitution) => {
        console.log("substitution", JSON.stringify(substitution));
        db.insertVpSubstitution(substitution.course, JSON.stringify(substitution.data))
    })*/







}

