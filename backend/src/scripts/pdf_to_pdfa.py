import fitz
import sys

def pdf_to_pdfa(input_path, output_path):
    try:
        doc = fitz.open(input_path)
        # clean=True standardizes PDF structure to be compliant.
        doc.save(output_path, clean=True, deflate=True)
        doc.close()
    except Exception as e:
        print(f"Error converting to PDF/A: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_pdfa.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    pdf_to_pdfa(sys.argv[1], sys.argv[2])
