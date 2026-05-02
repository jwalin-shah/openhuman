use once_cell::sync::Lazy;
use regex::Regex;

static EMAIL: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b").unwrap());

// Catches typical local forms like (415) 555-0123 and +1-415-555-0123, plus
// E.164 compact numbers such as +14155550123 and +358401234567.
// The regex requires either a country-coded compact pattern or a separator-rich
// local form so short numeric IDs like 8-digit invoices are not redacted.
// Rust's `regex` crate doesn't support lookaround, so we rely on input shape and
// `redact()` ordering (CC runs before PHONE) to avoid mid-number matches.
static PHONE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?x)
        (?:
            # E.164 compact form: +<1-15 digits>, no separators required.
            \+[1-9]\d{9,14}
            |
            # With country code: +1-NXX-NXX-XXXX or 1-NXX-NXX-XXXX style
            \+?\d{1,3}[\s\-.]           # country code + mandatory separator
            (?:\(\d{2,4}\)|\d{2,4})[\s\-.]?
            \d{3}[\s\-.]?\d{4}          # 7-digit local with separator gives 10+ total
            |
            # Without country code: must have exactly 10 digits (NXX-NXX-XXXX)
            (?:\(\d{3}\)|\d{3})[\s\-.]  # area code 3 digits + mandatory separator
            \d{3}[\s\-.]?\d{4}          # 7-digit local = 10 digits total
        )
    ",
    )
    .unwrap()
});

static SSN: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b\d{3}-\d{2}-\d{4}\b").unwrap());

// Matches typical 13-19 digit credit card numbers with dashes/spaces every 4.
static CC: Lazy<Regex> = Lazy::new(|| Regex::new(r"\b(?:\d[ \-]?){12,18}\d\b").unwrap());

/// Apply best-effort PII redaction. Order matters: emails first (so phone regex
/// doesn't eat the local-part of an email's digit run), then SSN (specific shape),
/// then CC (long digit runs), then phone.
pub fn redact(input: &str) -> String {
    let s = EMAIL.replace_all(input, "<EMAIL>").into_owned();
    let s = SSN.replace_all(&s, "<SSN>").into_owned();
    let s = CC.replace_all(&s, "<CC>").into_owned();
    PHONE.replace_all(&s, "<PHONE>").into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_emails_phones_ssn_and_credit_cards() {
        let cases = [
            (
                "contact me at sarah@example.com today",
                "contact me at <EMAIL> today",
            ),
            (
                "call (415) 555-0123 or +1-415-555-0123",
                "call <PHONE> or <PHONE>",
            ),
            ("ssn 123-45-6789 then", "ssn <SSN> then"),
            ("card 4111-1111-1111-1111 expires", "card <CC> expires"),
            ("nothing sensitive here", "nothing sensitive here"),
            ("call +14155550123", "call <PHONE>"),
            ("my e164 +358401234567", "my e164 <PHONE>"),
        ];
        for (input, expected) in cases {
            assert_eq!(redact(input), expected, "input: {input}");
        }
    }

    #[test]
    fn idempotent_on_already_redacted_text() {
        let s = "see <EMAIL> and <PHONE>";
        assert_eq!(redact(s), s);
    }

    #[test]
    fn short_numeric_ids_not_redacted() {
        // 8-digit order/invoice IDs must NOT be redacted as phone numbers.
        let cases = ["order #12345678", "invoice 87654321", "ref: 00001234"];
        for input in cases {
            let out = redact(input);
            assert!(
                !out.contains("<PHONE>"),
                "8-digit ID was falsely redacted: input={input:?} out={out:?}"
            );
        }
    }
}
