import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/callmiracle';

async function migrateMeetingLanguages() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const meetingsCollection = db.collection('meetings');

    // Find all meetings that need migration:
    // 1. Have old 'languages' field (array)
    // 2. Don't have 'language' field set (null or missing)
    const meetingsToMigrate = await meetingsCollection.find({
      $or: [
        { languages: { $exists: true, $type: 'array' } },
        { language: { $exists: false } },
        { language: null }
      ]
    }).toArray();

    console.log(`Found ${meetingsToMigrate.length} meetings to migrate`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const meeting of meetingsToMigrate) {
      const languages = meeting.languages as string[] | undefined;

      if (languages && Array.isArray(languages) && languages.length > 0) {
        // Take the first language from the array
        const language = languages[0];

        // Update the meeting: remove 'languages' array and add 'language' string
        await meetingsCollection.updateOne(
          { _id: meeting._id },
          {
            $set: { language },
            $unset: { languages: '' }
          }
        );

        migratedCount++;
        console.log(`Migrated meeting ${meeting._id}: ${JSON.stringify(languages)} -> ${language}`);
      } else {
        // If languages array is empty or missing, we need to get the group's language
        console.warn(`Meeting ${meeting._id} has no valid language, will try to get from group`);

        const groupsCollection = db.collection('groups');
        const group = await groupsCollection.findOne({ _id: meeting.groupId });

        if (group && group.language) {
          await meetingsCollection.updateOne(
            { _id: meeting._id },
            {
              $set: { language: group.language },
              $unset: { languages: '' }
            }
          );
          migratedCount++;
          console.log(`Migrated meeting ${meeting._id} using group language: ${group.language}`);
        } else {
          // Default to 'ru' if we can't find the group
          await meetingsCollection.updateOne(
            { _id: meeting._id },
            {
              $set: { language: 'ru' },
              $unset: { languages: '' }
            }
          );
          migratedCount++;
          console.log(`Migrated meeting ${meeting._id} using default language: ru`);
        }
      }
    }

    console.log(`\nMigration complete!`);
    console.log(`- Migrated: ${migratedCount} meetings`);
    console.log(`- Skipped: ${skippedCount} meetings`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

migrateMeetingLanguages();
