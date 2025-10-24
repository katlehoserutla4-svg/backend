import mysql from "mysql2/promise";

const db = await mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "report_app",
  port: 3307
});

console.log("✅ Connected to MySQL database");
export default db;