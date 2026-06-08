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

    # ── Step 5: Advanced Binary Search Quality Optimizer ──────────────────────
    configs = [
        {"scale": 0.6, "quality": 20}, # 0
        {"scale": 0.7, "quality": 25}, # 1
        {"scale": 0.8, "quality": 32}, # 2
        {"scale": 0.9, "quality": 40}, # 3
        {"scale": 1.0, "quality": 48}, # 4
        {"scale": 1.1, "quality": 54}, # 5
        {"scale": 1.2, "quality": 60}, # 6
        {"scale": 1.3, "quality": 65}, # 7
        {"scale": 1.4, "quality": 70}, # 8
        {"scale": 1.5, "quality": 75}, # 9
        {"scale": 1.6, "quality": 79}, # 10
        {"scale": 1.7, "quality": 83}, # 11
        {"scale": 1.8, "quality": 86}, # 12
        {"scale": 1.9, "quality": 89}, # 13
        {"scale": 2.0, "quality": 92}  # 14
    ]

    if target_bytes <= 0:
        # Simple save
        build_raster_pdf(75, 1.5)
        doc.close()
    else:
        low = 0
        high = len(configs) - 1
        best_size = 0
        has_found_valid = False

        # Temp path for testing passes
        temp_output_path = output_path + ".tmp"

        for step in range(4):
            if low > high:
                break
            mid = (low + high) // 2
            conf = configs[mid]
            
            # Render a raster PDF to temp path
            out_doc2 = fitz.open()
            for page in doc:
                rect = page.rect
                mat = fitz.Matrix(conf["scale"], conf["scale"])
                pix = page.get_pixmap(matrix=mat, alpha=False)
                img_bytes = pix.tobytes(output="jpg", jpg_quality=conf["quality"])
                
                new_page = out_doc2.new_page(width=rect.width, height=rect.height)
                new_page.insert_image(rect, stream=img_bytes)
                
            out_doc2.save(temp_output_path, garbage=4, deflate=True)
            out_doc2.close()
            
            size = os.path.getsize(temp_output_path)
            print(f"[Compress Step {step + 1}] index={mid}, scale={conf['scale']}, quality={conf['quality']} -> size={size / 1024:.1f} KB")

            # Allow a tiny 8% tolerance threshold to prevent massive quality loss when a config is just 1-2% over target
            if size <= target_bytes * 1.08:
                # Valid pass: copy temp to final output
                best_size = size
                has_found_valid = True
                
                # Copy temp to output path
                try:
                    if os.path.exists(output_path):
                        os.remove(output_path)
                    os.rename(temp_output_path, output_path)
                except Exception as e:
                    print(f"Error saving best size: {e}", file=sys.stderr)

                # Early exit if within 8% of target
                if size >= target_bytes * 0.92 and size <= target_bytes * 1.08:
                    print(f"[Compress] Close match found: {size/1024:.1f} KB. Stopping early.")
                    break
                    
                low = mid + 1
            else:
                # Too big, try to get a smaller file size
                high = mid - 1
                try:
                    if os.path.exists(temp_output_path):
                        os.remove(temp_output_path)
                except:
                    pass

        # Cleanup final temp if left
        try:
            if os.path.exists(temp_output_path):
                os.remove(temp_output_path)
        except:
            pass

        # Fallback: if not even the lowest configuration was under target, build with lowest configuration
        if not has_found_valid:
            print(f"[Compress] Target size too small. Fallback to lowest compression settings.")
            conf = configs[0]
            build_raster_pdf(conf["quality"], conf["scale"])

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
