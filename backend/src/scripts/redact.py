import fitz
import sys

def redact_pdf(input_path, output_path, term_to_redact):
    try:
        doc = fitz.open(input_path)
        redact_count = 0
        for page in doc:
            areas = page.search_for(term_to_redact)
            for rect in areas:
                page.add_redact_annot(rect, fill=(0, 0, 0)) # black fill
                redact_count += 1
            if areas:
                page.apply_redactions()
        doc.save(output_path, clean=True)
        doc.close()
        print(f"Successfully redacted {redact_count} instances of '{term_to_redact}'.")
    except Exception as e:
        print(f"Error redacting PDF: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python redact.py <input_path> <output_path> <term_to_redact>", file=sys.stderr)
        sys.exit(1)
    redact_pdf(sys.argv[1], sys.argv[2], sys.argv[3])
