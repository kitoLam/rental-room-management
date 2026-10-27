// Run with mongosh against the intended database before accepting traffic.
// The application creates these indexes automatically in development as well.
// Roles are a Java enum stored in users.role: TENANT | MANAGER | ADMIN.
for (const name of ["users", "verification_tokens", "refresh_tokens"]) {
    if (!db.getCollectionNames().includes(name)) db.createCollection(name);
}
db.users.createIndex({email: 1}, {unique: true, name: "email"});
db.users.createIndex({phone: 1}, {unique: true, name: "phone"});
for (const name of ["verification_tokens", "refresh_tokens"]) {
    const collection = db.getCollection(name);
    collection.createIndex({tokenHash: 1}, {unique: true, name: "tokenHash"});
    collection.createIndex({userId: 1}, {name: "userId"});
    collection.createIndex({purgeAt: 1}, {expireAfterSeconds: 0, name: "purgeAt"});
}
