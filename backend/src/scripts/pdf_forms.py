import fitz
import sys

def flatten_forms(input_path, output_path):
    try:
        doc = fitz.open(input_path)
        # Flatten form fields (make interactive inputs static text)
        doc.flatten()
        doc.save(output_path, clean=True)
        doc.close()
    except Exception as e:
        print(f"Error flattening forms: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf_forms.py <input_path> <output_path>", file=sys.stderr)
        sys.exit(1)
    flatten_forms(sys.argv[1], sys.argv[2])
