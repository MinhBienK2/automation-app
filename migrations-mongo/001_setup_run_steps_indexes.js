export const up = async (db, client) => {
  // Create index on run_id and owner_id for run_steps collection
  await db.collection("run_steps").createIndex({ run_id: 1 });
  await db.collection("run_steps").createIndex({ owner_id: 1 });
};

export const down = async (db, client) => {
  // Drop index on run_id and owner_id for run_steps collection
  try {
    await db.collection("run_steps").dropIndex("run_id_1");
  } catch (error) {
    console.warn("Could not drop run_id_1 index (it might not exist):", error.message);
  }
  
  try {
    await db.collection("run_steps").dropIndex("owner_id_1");
  } catch (error) {
    console.warn("Could not drop owner_id_1 index (it might not exist):", error.message);
  }
};
