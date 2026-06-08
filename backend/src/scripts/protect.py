import fitz
import sys

def protect_pdf(input_path, output_path, password):
    doc = fitz.open(input_path)
    # Encrypt the PDF using the password
    # AES-256 encryption is supported by setting encryption=fitz.PDF_ENCRYPT_AES_256
    doc.save(
        output_path,
        user_pw=password,
        owner_pw=password,
        encryption=fitz.PDF_ENCRYPT_AES_256
    )
    doc.close()

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python protect.py <input_path> <output_path> <password>", file=sys.stderr)
        sys.exit(1)
    protect_pdf(sys.argv[1], sys.argv[2], sys.argv[3])
