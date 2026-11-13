// Chọn database của ứng dụng trong MongoDB Compass rồi chạy trong MongoDB Shell.
{
  const fields = [
    "landlordName", "landlordIdNumber", "landlordAddress",
    "landlordDateOfBirth", "landlordIdIssueDate", "landlordIdIssuePlace", "landlordPhone",
    "tenantIdNumber", "tenantAddress",
    "tenantDateOfBirth", "tenantIdIssueDate", "tenantIdIssuePlace", "tenantPhone",
    "signingAddress", "paymentMethod", "electricityRate", "waterRate", "signedDate"
  ];

  const missingAnyField = {
    $or: fields.map(field => ({ [field]: { $exists: false } }))
  };
  const setMissingFields = Object.fromEntries(fields.map(field => [
    field,
    { $cond: [{ $eq: [{ $type: `$${field}` }, "missing"] }, null, `$${field}`] }
  ]));

  printjson(db.contracts.updateMany(missingAnyField, [{ $set: setMissingFields }]));
  printjson({ remaining: db.contracts.countDocuments(missingAnyField) });
}
