import fitz  # PyMuPDF
import sys
import os

def compress_pdf(input_path, output_path, target_kb, target_unit):
    target_unit = target_unit.upper()
    target_bytes = target_kb * 1024 * 1024 if target_unit == 'MB' else target_kb * 1024
    
    original_size = os.path.getsize(input_path)
    
    # Try opening the PDF
    doc = fitz.open(input_path)
    
    # Try a simple save with garbage collection and compression first
    doc.save(output_path, garbage=4, deflate=True, clean=True)
    simple_size = os.path.getsize(output_path)
    
    if target_bytes <= 0 or simple_size <= target_bytes:
        # Simple compression was enough or no target specified
        doc.close()
        return
        
    # If target is still not met, perform rasterization compression
    def build_raster_pdf(quality, scale):
        out_doc = fitz.open()
        for page in doc:
            rect = page.rect
            mat = fitz.Matrix(scale, scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            
            # Convert pixmap to JPEG bytes
            img_bytes = pix.tobytes(output="jpg", jpg_quality=quality)
            
            # Create a page in the output doc matching the original size
            new_page = out_doc.new_page(width=rect.width, height=rect.height)
            # Insert the compressed JPEG image
            new_page.insert_image(rect, stream=img_bytes)
            
        out_doc.save(output_path, garbage=4, deflate=True)
        out_doc.close()

    # Determine initial quality and scale based on target ratio
    ratio = target_bytes / original_size
    scale = 1.5
    if ratio >= 0.9:
        scale = 2.0
    elif ratio >= 0.7:
        scale = 1.8
    elif ratio >= 0.5:
        scale = 1.5
    elif ratio >= 0.3:
        scale = 1.25
    else:
        scale = 1.0

    if ratio >= 0.9:
        quality = 90
    elif ratio >= 0.7:
        quality = 82
    elif ratio >= 0.5:
        quality = 72
    elif ratio >= 0.3:
        quality = 58
    elif ratio >= 0.2:
        quality = 45
    else:
        quality = 35

    build_raster_pdf(quality, scale)
    compressed_size = os.path.getsize(output_path)
    
    # ── Refinement Pass ────────────────────────────────────────────────
    margin_min = target_bytes * 0.75
    margin_max = target_bytes

    if compressed_size < margin_min and (quality < 92 or scale < 2.0):
        # Too small! Let's increase quality and scale for a better result
        new_quality = int(min(92, quality + 15))
        new_scale = min(2.0, scale * 1.25)
        
        temp_output_path = output_path + ".tmp"
        
        out_doc2 = fitz.open()
        for page in doc:
            rect = page.rect
            mat = fitz.Matrix(new_scale, new_scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img_bytes = pix.tobytes(output="jpg", jpg_quality=new_quality)
            
            new_page = out_doc2.new_page(width=rect.width, height=rect.height)
            new_page.insert_image(rect, stream=img_bytes)
            
        out_doc2.save(temp_output_path, garbage=4, deflate=True)
        out_doc2.close()
        
        temp_size = os.path.getsize(temp_output_path)
        if temp_size <= target_bytes:
            # Only swap if it stays below the target
            doc.close()
            try:
                os.remove(output_path)
                os.rename(temp_output_path, output_path)
            except Exception as e:
                print(f"Error swapping files: {e}", file=sys.stderr)
        else:
            try:
                os.remove(temp_output_path)
            except:
                pass
            doc.close()
            
    elif compressed_size > margin_max and quality > 30:
        # Too big! Let's reduce quality and scale to fit
        new_quality = int(max(25, quality * 0.65))
        new_scale = max(0.8, scale * 0.75)
        
        temp_output_path = output_path + ".tmp"
        
        out_doc2 = fitz.open()
        for page in doc:
            rect = page.rect
            mat = fitz.Matrix(new_scale, new_scale)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img_bytes = pix.tobytes(output="jpg", jpg_quality=new_quality)
            
            new_page = out_doc2.new_page(width=rect.width, height=rect.height)
            new_page.insert_image(rect, stream=img_bytes)
            
        out_doc2.save(temp_output_path, garbage=4, deflate=True)
        out_doc2.close()
        
        temp_size = os.path.getsize(temp_output_path)
        if temp_size < compressed_size:
            doc.close()
            try:
                os.remove(output_path)
                os.rename(temp_output_path, output_path)
            except Exception as e:
                print(f"Error swapping files: {e}", file=sys.stderr)
        else:
            try:
                os.remove(temp_output_path)
            except:
                pass
            doc.close()
    else:
        doc.close()

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: python compress_pdf.py <input_path> <output_path> <target_kb> <target_unit>", file=sys.stderr)
        sys.exit(1)
        
    in_p = sys.argv[1]
    out_p = sys.argv[2]
    try:
        t_kb = float(sys.argv[3])
    except ValueError:
        t_kb = 500.0
    t_unit = sys.argv[4]
    
    compress_pdf(in_p, out_p, t_kb, t_unit)
