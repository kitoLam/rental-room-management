package com.kitolam.rentalroommanagement.modules.contract.document;

import java.time.Instant;

public record ContractEvidenceHistoryEntry(String action, Instant at, String note) {
}
