import fitz
import sys

def html_to_pdf(input_path, output_path):
    try:
        doc = fitz.open(input_path)
        pdf_bytes = doc.convert_to_pdf()
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)
        doc.close()
    except Exception as e:
        print(f"Error converting HTML to PDF: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python html_to_pdf.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    html_to_pdf(sys.argv[1], sys.argv[2])
