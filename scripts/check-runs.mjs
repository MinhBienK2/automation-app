import { getDbConnection } from "./lib/db-cli-helper.mjs";

async function main() {
  let dbInfo;
  try {
    dbInfo = await getDbConnection();
    const db = dbInfo.connection;

    const runs = await db.query(
      `SELECT id, workflow_id, status, started_at, finished_at, error_json, outputs_json 
       FROM runs 
       ORDER BY started_at DESC LIMIT 5`
    );

    console.log(`Checking last ${runs.length} runs:`);
    for (const run of runs) {
      console.log(`-----------------------------------------------`);
      console.log(`Run ID: ${run.id}`);
      console.log(`Workflow ID: ${run.workflow_id}`);
      console.log(`Status: ${run.status}`);
      console.log(`Started At: ${run.started_at}`);
      console.log(`Finished At: ${run.finished_at}`);
      console.log(`Error JSON: ${run.error_json}`);
      console.log(`Outputs JSON: ${run.outputs_json}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error("Failed to query runs:", error);
    process.exit(1);
  } finally {
    if (dbInfo && dbInfo.close) {
      await dbInfo.close();
    }
  }
}

main();
