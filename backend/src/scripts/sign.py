import fitz
import sys
import os

def sign_pdf(input_path, output_path, signature_text, signature_image_path):
    try:
        doc = fitz.open(input_path)
        if len(doc) == 0:
            print("Error: Empty PDF document.", file=sys.stderr)
            sys.exit(1)
            
        last_page = doc[len(doc) - 1]
        rect = last_page.rect
        
        # Position box at bottom right
        x0 = rect.width - 220
        y0 = rect.height - 110
        x1 = rect.width - 20
        y1 = rect.height - 20
        
        if signature_image_path and os.path.exists(signature_image_path) and os.path.getsize(signature_image_path) > 0:
            last_page.insert_image(fitz.Rect(x0, y0, x1, y1), filename=signature_image_path, keep_proportion=True)
        elif signature_text:
            text_rect = fitz.Rect(x0, y0 + 35, x1, y1)
            # Draw line above signature
            last_page.draw_line(fitz.Point(x0, y0 + 30), fitz.Point(x1, y0 + 30), color=(0.1, 0.1, 0.1), width=1)
            last_page.insert_textbox(
                text_rect,
                f"Signed by:\n{signature_text}",
                fontsize=11,
                fontname="helv",
                align=fitz.TEXT_ALIGN_CENTER,
                color=(0.1, 0.1, 0.1)
            )
            
        doc.save(output_path, clean=True)
        doc.close()
    except Exception as e:
        print(f"Error signing PDF: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python sign.py <input_path> <output_path> [signature_text] [signature_image_path]", file=sys.stderr)
        sys.exit(1)
        
    in_p = sys.argv[1]
    out_p = sys.argv[2]
    sig_text = sys.argv[3] if len(sys.argv) > 3 else "OmniPDF User"
    sig_img = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4].strip() and sys.argv[4] != "undefined" else ""
    
    sign_pdf(in_p, out_p, sig_text, sig_img)
