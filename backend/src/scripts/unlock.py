import fitz
import sys

def unlock_pdf(input_path, output_path, password=""):
    doc = fitz.open(input_path)
    if doc.is_encrypted:
        success = doc.authenticate(password)
        if not success:
            print("AUTH_FAILED", file=sys.stderr)
            sys.exit(1)
    
    try:
        # Save the document decrypted (encryption=0 removes encryption)
        doc.save(output_path, encryption=0)
    except Exception as e:
        print(f"Standard decrypt save failed: {e}. Trying page insertion fallback...", file=sys.stderr)
        try:
            # Create a brand new document to strip encryption and restrictions
            new_doc = fitz.open()
            new_doc.insert_pdf(doc)
            new_doc.save(output_path)
            new_doc.close()
        except Exception as e2:
            print(f"Fallback decryption failed: {e2}", file=sys.stderr)
            sys.exit(1)
    finally:
        doc.close()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python unlock.py <input_path> <output_path> [password]", file=sys.stderr)
        sys.exit(1)
        
    in_p = sys.argv[1]
    out_p = sys.argv[2]
    pwd = sys.argv[3] if len(sys.argv) > 3 else ""
    unlock_pdf(in_p, out_p, pwd)
