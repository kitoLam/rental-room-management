// Migration: backfill contracts.contractUrl từ field cũ contracts.templateDownloadUrl.
// An toàn khi chạy lại: chỉ đụng document chưa có key contractUrl.
// Chạy: mongosh "<MONGO_URI>" --file migrations/2026-11-11-contract-url-backfill.js
db.contracts.updateMany(
  { contractUrl: { $exists: false } },
  [{ $set: { contractUrl: "$templateDownloadUrl" } }]
)
printjson({ migrated: db.contracts.countDocuments({ contractUrl: { $exists: true, $ne: null } }) })