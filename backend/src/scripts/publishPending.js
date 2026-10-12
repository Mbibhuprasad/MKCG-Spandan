/* eslint-disable no-console */
// Usage:
//   npm run content:publish-pending              (dry run: shows what would change)
//   npm run content:publish-pending -- --apply   (publishes)
//
// One-off step after removing admin approval: content that was still waiting
// for review becomes visible. Rejected items, items of suspended or deleted
// accounts and comments on unpublished content are left untouched.
// Safe to run more than once.
const { getEnv } = require('../config/env');
const { connectDatabase, disconnectDatabase } = require('../config/db');
const { publishPendingContent } = require('../services/legacyContent.service');

async function main() {
  const apply = process.argv.includes('--apply');
  await connectDatabase(getEnv().mongoUri);
  const report = await publishPendingContent({ apply });

  console.log(apply ? 'Published content that was waiting for approval:' : 'Dry run — nothing was changed. This would happen:');
  for (const [type, c] of Object.entries(report)) {
    console.log(
      `  ${type.padEnd(8)} pending: ${c.pending}  ${apply ? 'published' : 'to publish'}: ${c.published}` +
        `  skipped (owner suspended or missing): ${c.skippedOwner}` +
        (type === 'comment' ? `  skipped (target not published): ${c.skippedTarget}` : '')
    );
  }
  if (!apply) console.log('Run again with "-- --apply" to publish.');
}

main()
  .then(() => disconnectDatabase())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error(`Failed: ${err.message}`);
    await disconnectDatabase().catch(() => {});
    process.exit(1);
  });
