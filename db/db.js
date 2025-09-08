import sqlite from "sqlite3";
import {DB_PATH} from "../config/constants.js";

const db = new sqlite.Database(DB_PATH);