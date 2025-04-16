import { MongoClient } from "mongodb";

// Your MongoDB Atlas connection URI.
const uri =
  "mongodb+srv://shahnoor-dev:7204408035pass@dummydash.k215o.mongodb.net/?retryWrites=true&w=majority&appName=dummyDash";

// Replace these with your actual database and collection names.
const dbName = "test";
const collectionName = "users";

/**
 * Removes duplicate documents from the collection based on the 'number' field.
 * For each unique number value, only the first document is kept, and duplicates are deleted.
 *
 * @param {Collection} collection - A MongoDB collection instance.
 */
async function removeDuplicateRecords(collection) {
  // Group documents by the "number" field.
  const cursor = collection.aggregate([
    {
      $group: {
        _id: "$number", // Group by the number field.
        ids: { $push: "$_id" }, // Collect all document IDs in this group.
        count: { $sum: 1 }, // Count documents per group.
      },
    },
    {
      $match: { count: { $gt: 1 } }, // Only process groups with duplicates.
    },
  ]);

  // Process each group of duplicates.
  for await (const doc of cursor) {
    // Retain the first document (_id) and delete the remaining.
    const [firstId, ...duplicateIds] = doc.ids;
    if (duplicateIds.length > 0) {
      const result = await collection.deleteMany({
        _id: { $in: duplicateIds },
      });
      console.log(
        `For number "${doc._id}", kept document ${firstId} and deleted ${result.deletedCount} duplicate(s).`
      );
    }
  }
}

/**
 * Main function: connects to the MongoDB Atlas cluster, performs duplicate cleanup, and closes the connection.
 */
async function main() {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    await client.connect();
    console.log("Connected successfully to MongoDB Atlas");

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Remove duplicate records.
    await removeDuplicateRecords(collection);
    console.log("Duplicate cleanup completed.");
  } catch (error) {
    console.error("Error while removing duplicates:", error);
  } finally {
    await client.close();
  }
}

// Run the main function.
main().catch(console.error);
