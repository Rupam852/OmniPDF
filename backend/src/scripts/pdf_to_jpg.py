import fitz
import sys
import zipfile

def pdf_to_jpg(input_path, output_zip_path, scale=2.0, quality=85):
    doc = fitz.open(input_path)
    
    with zipfile.ZipFile(output_zip_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for i, page in enumerate(doc):
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img_bytes = pix.tobytes(output="jpg", jpg_quality=quality)
            
            # Name pages starting from 1
            filename = f"page_{i + 1}.jpg"
            zip_file.writestr(filename, img_bytes)
            
    doc.close()

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python pdf_to_jpg.py <input_path> <output_zip_path>", file=sys.stderr)
        sys.exit(1)
    pdf_to_jpg(sys.argv[1], sys.argv[2])
