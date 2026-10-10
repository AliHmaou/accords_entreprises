import * as duckdb from '@duckdb/duckdb-wasm';
import { DUCKDB_CODE_SECTION_NAF_CASE, DUCKDB_SECTION_NAF_CASE } from './nafConstants';

let db: duckdb.AsyncDuckDB | null = null;
let conn: duckdb.AsyncDuckDBConnection | null = null;

export const initDuckDB = async () => {
    if (db) return { db, conn };

    console.log("🦆 [DuckDB] Initialisation démarre...");
    console.time("🦆 [DuckDB] Temps d'initialisation");

    const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
    // Select the best bundle for the browser
    const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);

    const worker = await duckdb.createWorker(bundle.mainWorker!);
    const logger = new duckdb.ConsoleLogger();
    
    db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    conn = await db.connect();

    console.timeEnd("🦆 [DuckDB] Temps d'initialisation");
    console.log("🦆 [DuckDB] Prêt.");
    
    return { db, conn };
};

export const enrichWithNafSections = async (tableName: string) => {
    if (!conn) return;
    try {
        console.time(`🦆 [DuckDB] Enrichissement NAF pour ${tableName}`);
        await conn.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS CODE_SECTION_NAF VARCHAR`);
        await conn.query(`ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS SECTION_NAF VARCHAR`);
        await conn.query(`
            UPDATE ${tableName} SET 
                CODE_SECTION_NAF = ${DUCKDB_CODE_SECTION_NAF_CASE},
                SECTION_NAF = ${DUCKDB_SECTION_NAF_CASE}
            WHERE SECTION_NAF IS NULL
        `);
        console.timeEnd(`🦆 [DuckDB] Enrichissement NAF pour ${tableName}`);
        console.log(`🦆 [DuckDB] Table ${tableName} enrichie avec les sections NAF.`);
    } catch (e) {
        console.warn("🦆 [DuckDB] Impossible d'enrichir avec les sections NAF:", e);
    }
};

export const loadParquetFile = async (tableName: string, url: string) => {
    if (!conn || !db) throw new Error("DuckDB not initialized");

    console.log(`🦆 [DuckDB] Chargement du fichier Parquet depuis : ${url}`);
    console.time(`🦆 [DuckDB] Téléchargement et création table ${tableName}`);

    // Register the file URL
    await db.registerFileURL(tableName + '.parquet', url, duckdb.DuckDBDataProtocol.HTTP, false);
    
    // Create table directly from the parquet file
    await conn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_parquet('${tableName}.parquet')`);

    console.timeEnd(`🦆 [DuckDB] Téléchargement et création table ${tableName}`);

    // Enrich with NAF macro-sections (A à U)
    await enrichWithNafSections(tableName);
    
    const countResult = await conn.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    const count = countResult.toArray()[0].count; // Access safely based on Arrow structure
    console.log(`🦆 [DuckDB] Table ${tableName} créée avec ${count} lignes.`);
};

export const loadJsonJSONL = async (tableName: string, jsonContent: string) => {
    if (!conn || !db) throw new Error("DuckDB not initialized");
    
    console.log(`🦆 [DuckDB] Chargement du fichier JSONL local...`);
    console.time(`🦆 [DuckDB] Parsing JSONL vers ${tableName}`);

    await db.registerFileText(`${tableName}.json`, jsonContent);
    
    // DuckDB read_json_auto is very powerful
    await conn.query(`CREATE OR REPLACE TABLE ${tableName} AS SELECT * FROM read_json_auto('${tableName}.json')`);
    
    console.timeEnd(`🦆 [DuckDB] Parsing JSONL vers ${tableName}`);

    // Enrich with NAF macro-sections (A à U)
    await enrichWithNafSections(tableName);
    
    const countResult = await conn.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    // Handle Arrow structural typing loosely here for display
    console.log(`🦆 [DuckDB] Table locale ${tableName} créée.`);
};

export const runQuery = async (query: string) => {
    if (!conn) throw new Error("DuckDB not initialized");

    console.log(`🦆 [DuckDB] Exécution requête SQL : ${query}`);
    console.time("🦆 [DuckDB] Temps requête");
    const result = await conn.query(query);
    console.timeEnd("🦆 [DuckDB] Temps requête");
    
    // Convert Arrow table to JS array of objects and normalize types (Date -> string, BigInt -> string)
    const rows = result.toArray().map((row) => {
        const obj = row.toJSON();
        Object.keys(obj).forEach(key => {
            const val = obj[key];
            if (val instanceof Date) {
                // Convert Date to YYYY-MM-DD string to match the expected interface and avoid React errors
                obj[key] = val.toISOString().split('T')[0];
            } else if (typeof val === 'bigint') {
                // Convert BigInt to string to ensure JSON serialization compatibility
                obj[key] = val.toString();
            }
        });
        return obj;
    });

    console.log(`🦆 [DuckDB] ${rows.length} résultats retournés.`);
    return rows;
};
