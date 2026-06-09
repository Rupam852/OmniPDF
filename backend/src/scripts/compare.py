import fitz
import sys
import difflib

def compare_pdfs(pdf1_path, pdf2_path, report_path):
    try:
        doc1 = fitz.open(pdf1_path)
        doc2 = fitz.open(pdf2_path)
        
        text1 = ""
        for page in doc1:
            text1 += page.get_text() + "\n"
            
        text2 = ""
        for page in doc2:
            text2 += page.get_text() + "\n"
            
        doc1.close()
        doc2.close()
        
        lines1 = text1.splitlines()
        lines2 = text2.splitlines()
        
        diff = list(difflib.ndiff(lines1, lines2))
        
        html_report = "<html><body style='font-family: monospace; padding: 30px; font-size: 11px; line-height: 1.5; color: #1e293b;'>"
        html_report += "<h2 style='font-family: Arial, sans-serif; color: #1e3a8a; margin-top: 0;'>PDF Comparison Report</h2>"
        html_report += "<p style='font-family: Arial, sans-serif; font-size: 12px; color: #64748b;'>Comparing Document A and Document B (highlights differences)</p>"
        html_report += "<div style='border: 1px solid #e2e8f0; border-radius: 6px; padding: 15px; background-color: #f8fafc; font-size: 10px;'>"
        
        change_detected = False
        for line in diff:
            if line.startswith('+ '):
                html_report += f"<div style='color: #16a34a; background-color: #f0fdf4; padding: 2px 5px;'><b>+</b> {line[2:]}</div>"
                change_detected = True
            elif line.startswith('- '):
                html_report += f"<div style='color: #dc2626; background-color: #fef2f2; padding: 2px 5px;'><b>-</b> {line[2:]}</div>"
                change_detected = True
            elif line.startswith('? '):
                continue
            else:
                # Show context lines only if not completely empty
                if line.strip():
                    html_report += f"<div style='color: #64748b; padding: 2px 5px;'>&nbsp;&nbsp;{line[2:]}</div>"
                    
        if not change_detected:
            html_report += "<div style='color: #16a34a; font-family: Arial, sans-serif; text-align: center; padding: 20px; font-size: 13px;'><b>No differences found. The documents are identical!</b></div>"
            
        html_report += "</div></body></html>"
        
        fitz_doc = fitz.open(stream=html_report.encode('utf-8'), filetype='html')
        pdf_bytes = fitz_doc.convert_to_pdf()
        with open(report_path, "wb") as f:
            f.write(pdf_bytes)
        fitz_doc.close()
    except Exception as e:
        print(f"Error comparing PDFs: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 4:
        print("Usage: python compare.py <pdf1_path> <pdf2_path> <report_path>", file=sys.stderr)
        sys.exit(1)
    compare_pdfs(sys.argv[1], sys.argv[2], sys.argv[3])
