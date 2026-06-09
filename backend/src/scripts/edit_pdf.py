import fitz
import sys

def edit_pdf_gemini(input_path, output_path, prompt, gemini_key):
    try:
        import google.generativeai as genai
    except ImportError:
        print("Required google-generativeai package not found.", file=sys.stderr)
        sys.exit(1)
        
    try:
        genai.configure(api_key=gemini_key)
        with open(input_path, "rb") as f:
            pdf_data = f.read()
            
        model = genai.GenerativeModel('gemini-2.5-flash')
        full_prompt = (
            f"Analyze this PDF document and edit it according to the user's request: '{prompt}'. "
            "Return only the edited document content. Preserve layout structure as much as possible."
        )
        
        response = model.generate_content([
            {
                "mime_type": "application/pdf",
                "data": pdf_data
            },
            full_prompt
        ])
        edited_text = response.text
    except Exception as e:
        print(f"Gemini AI edit failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Convert the edited text back to a PDF using PyMuPDF HTML engine
    # Basic markdown parsing to html
    formatted_html = edited_text.replace('\n', '<br/>')
    html_content = f"<html><body style='font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; color: #1e293b;'>{formatted_html}</body></html>"
    try:
        fitz_doc = fitz.open(stream=html_content.encode('utf-8'), filetype='html')
        pdf_bytes = fitz_doc.convert_to_pdf()
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)
        fitz_doc.close()
    except Exception as e:
        print(f"Error saving edited PDF: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: python edit_pdf.py <input_path> <output_path> <prompt> <gemini_api_key>", file=sys.stderr)
        sys.exit(1)
        
    edit_pdf_gemini(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4])
