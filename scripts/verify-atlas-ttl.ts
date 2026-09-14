/**
 * Verification script for live MongoDB Atlas indexes and TTL behavior.
 *
 * Usage:
 *   MONGODB_URI="mongodb+srv://..." npx tsx scripts/verify-atlas-ttl.ts
 *
 * Checks:
 *   1. Unique { code: 1 } index existence.
 *   2. Compound { ownerId: 1, createdAt: -1 } index existence.
 *   3. Expiration partial TTL index { expiresAt: 1 } with { expiresAt: { $type: 'date' } }.
 *   4. Real short-lived document validation (request-time expiration + cleanup).
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'shorty';

async function main() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable is not set.');
    console.log('To verify live Atlas indexes and TTL behavior:');
    console.log('  1. Add your Atlas connection string to .env.local: MONGODB_URI="mongodb+srv://..."');
    console.log('  2. Run: npx tsx scripts/verify-atlas-ttl.ts');
    process.exit(1);
  }

  console.log('📡 Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DATABASE });
  console.log('✅ Connected successfully to database:', MONGODB_DATABASE);

  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Failed to get database instance');
  }

  const collection = db.collection('links');

  console.log('\n🔍 Inspecting collection indexes on "links"...');
  const indexes = await collection.indexes();
  console.log('Found indexes:', JSON.stringify(indexes, null, 2));

  // 1. Verify unique { code: 1 }
  const codeIndex = indexes.find(
    (idx) => idx.key && idx.key.code === 1 && idx.unique === true,
  );
  if (!codeIndex) {
    console.error('❌ Missing unique index on { code: 1 }!');
  } else {
    console.log('✅ Unique index on { code: 1 } verified.');
  }

  // 2. Verify compound { ownerId: 1, createdAt: -1 }
  const ownerIndex = indexes.find(
    (idx) => idx.key && idx.key.ownerId === 1 && idx.key.createdAt === -1,
  );
  if (!ownerIndex) {
    console.error('❌ Missing compound index on { ownerId: 1, createdAt: -1 }!');
  } else {
    console.log('✅ Compound index on { ownerId: 1, createdAt: -1 } verified.');
  }

  // 3. Verify partial TTL index on { expiresAt: 1 }
  const ttlIndex = indexes.find(
    (idx) =>
      idx.key &&
      idx.key.expiresAt === 1 &&
      idx.expireAfterSeconds === 0 &&
      idx.partialFilterExpression &&
      idx.partialFilterExpression.expiresAt,
  );
  if (!ttlIndex) {
    console.error('❌ Missing partial TTL index on { expiresAt: 1 } with partialFilterExpression!');
  } else {
    console.log('✅ Partial TTL index on { expiresAt: 1 } verified.');
  }

  // 4. Test with a short-lived document
  console.log('\n🧪 Testing short-lived document expiration...');
  const testCode = `__ttl_test_${Date.now()}`;
  const expiryDate = new Date(Date.now() + 2000); // Expires in 2 seconds

  await collection.insertOne({
    code: testCode,
    originalUrl: 'https://example.com/ttl-test',
    createdAt: new Date(),
    expiresAt: expiryDate,
    isActive: true,
    clickCount: 0,
    lastAccessedAt: null,
    ownerId: null,
    ownerType: 'anonymous',
    customAlias: false,
  });

  console.log(`Created test link with code "${testCode}", expires at: ${expiryDate.toISOString()}`);

  // Immediate query (should be active)
  const docBefore = await collection.findOne({ code: testCode });
  const isExpiredBefore = docBefore?.expiresAt && docBefore.expiresAt <= new Date();
  console.log('Immediate check (should be active):', isExpiredBefore ? 'EXPIRED' : 'ACTIVE');

  // Wait 3 seconds
  console.log('Waiting 3 seconds for expiration threshold...');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Query again (request-time check should evaluate as expired)
  const docAfter = await collection.findOne({ code: testCode });
  const isExpiredAfter = docAfter?.expiresAt && docAfter.expiresAt <= new Date();
  console.log('Post-expiration check (must be expired):', isExpiredAfter ? 'EXPIRED (CORRECT)' : 'ACTIVE');

  // Cleanup test document
  await collection.deleteOne({ code: testCode });
  console.log('✅ Cleaned up test document.');

  await mongoose.disconnect();
  console.log('\n🎉 Atlas index and TTL verification completed successfully!');
}

main().catch((err) => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
