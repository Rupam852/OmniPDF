import fitz
import sys

def crop_pdf(input_path, output_path, left, top, right, bottom):
    try:
        doc = fitz.open(input_path)
        for page in doc:
            rect = page.rect
            x0 = rect.x0 + rect.width * (float(left) / 100.0)
            y0 = rect.y0 + rect.height * (float(top) / 100.0)
            x1 = rect.x1 - rect.width * (float(right) / 100.0)
            y1 = rect.y1 - rect.height * (float(bottom) / 100.0)
            
            if x0 < x1 and y0 < y1:
                page.set_cropbox(fitz.Rect(x0, y0, x1, y1))
        
        doc.save(output_path, clean=True)
        doc.close()
    except Exception as e:
        print(f"Error cropping PDF: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python crop.py <input_path> <output_path> [left] [top] [right] [bottom]", file=sys.stderr)
        sys.exit(1)
        
    l = sys.argv[3] if len(sys.argv) > 3 else 10
    t = sys.argv[4] if len(sys.argv) > 4 else 10
    r = sys.argv[5] if len(sys.argv) > 5 else 10
    b = sys.argv[6] if len(sys.argv) > 6 else 10
    
    crop_pdf(sys.argv[1], sys.argv[2], l, t, r, b)
