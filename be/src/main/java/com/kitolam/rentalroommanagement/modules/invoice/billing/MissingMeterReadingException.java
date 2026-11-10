package com.kitolam.rentalroommanagement.modules.invoice.billing;

import java.util.List;

/** A room the contract lives in still has a metered service without a confirmed reading for the period. */
public class MissingMeterReadingException extends RuntimeException {

    private final List<String> missing;

    public MissingMeterReadingException(List<String> missing) {
        super("MISSING_METER_READING: chưa chốt chỉ số " + String.join(", ", missing));
        this.missing = List.copyOf(missing);
    }

    public List<String> getMissing() {
        return missing;
    }
}
