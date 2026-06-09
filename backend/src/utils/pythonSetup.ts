import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

let isPythonReady = false;
let pythonError: string | null = null;

/**
 * Returns the current python environment status.
 */
export function getPythonStatus() {
  return {
    ready: isPythonReady,
    error: pythonError
  };
}

/**
 * Runs a command and returns true if it completes with code 0.
 */
async function checkCommand(cmd: string, args: string): Promise<boolean> {
  try {
    await execAsync(`"${cmd}" ${args}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks for required python libraries and installs them if missing.
 * Runs in background to avoid blocking server startup.
 */
export async function checkAndInstallPythonDependencies(): Promise<void> {
  console.log('[Python Setup] Starting Python dependency verification...');
  
  let pythonCmd = process.env.PYTHON_PATH || 'python';
  
  // 1. Detect Python command
  let isPythonAvailable = await checkCommand(pythonCmd, '--version');
  if (!isPythonAvailable && !process.env.PYTHON_PATH) {
    console.log('[Python Setup] "python" not found, trying "python3"...');
    pythonCmd = 'python3';
    isPythonAvailable = await checkCommand(pythonCmd, '--version');
  }
  
  if (!isPythonAvailable) {
    const errorMsg = 'Python interpreter not found. Please install Python and add it to your system PATH.';
    console.error(`[Python Setup] ERROR: ${errorMsg}`);
    pythonError = errorMsg;
    isPythonReady = false;
    return;
  }
  
  console.log(`[Python Setup] Using Python command: ${pythonCmd}`);
  
  // 2. Check if dependencies are already installed
  const importCheckCode = 'import fitz, docx, pptx, openpyxl, pdf2docx, google.generativeai';
  const checkInstalled = await checkCommand(pythonCmd, `-c "${importCheckCode}"`);
  
  if (checkInstalled) {
    console.log('[Python Setup] All Python dependencies are already installed and verified!');
    isPythonReady = true;
    pythonError = null;
    return;
  }
  
  console.log('[Python Setup] Missing dependencies detected. Attempting automatic installation...');
  
  // 3. Find requirements.txt path
  const reqPath = path.join(__dirname, '../../requirements.txt');
  
  try {
    if (fs.existsSync(reqPath)) {
      console.log(`[Python Setup] Installing dependencies from ${reqPath}...`);
      await execAsync(`"${pythonCmd}" -m pip install -r "${reqPath}"`);
    } else {
      console.log('[Python Setup] requirements.txt not found, installing packages individually...');
      const packages = ['pymupdf', 'python-docx', 'python-pptx', 'openpyxl', 'pdf2docx', 'google-generativeai'];
      await execAsync(`"${pythonCmd}" -m pip install ${packages.join(' ')}`);
    }
    
    // Verify installation
    const verifyInstalled = await checkCommand(pythonCmd, `-c "${importCheckCode}"`);
    if (verifyInstalled) {
      console.log('[Python Setup] Automatic dependency installation completed successfully!');
      isPythonReady = true;
      pythonError = null;
    } else {
      throw new Error('Verification failed after installation.');
    }
  } catch (err: any) {
    // If pip install fails, try --user flag as fallback
    try {
      console.warn('[Python Setup] Standard installation failed, trying with --user flag...');
      if (fs.existsSync(reqPath)) {
        await execAsync(`"${pythonCmd}" -m pip install --user -r "${reqPath}"`);
      } else {
        const packages = ['pymupdf', 'python-docx', 'python-pptx', 'openpyxl', 'pdf2docx', 'google-generativeai'];
        await execAsync(`"${pythonCmd}" -m pip install --user ${packages.join(' ')}`);
      }
      
      const verifyInstalled = await checkCommand(pythonCmd, `-c "${importCheckCode}"`);
      if (verifyInstalled) {
        console.log('[Python Setup] Automatic dependency installation (--user) completed successfully!');
        isPythonReady = true;
        pythonError = null;
      } else {
        throw new Error('Verification failed after --user installation.');
      }
    } catch (fallbackErr: any) {
      const errorMsg = `Failed to install Python dependencies. Please run 'pip install pymupdf python-docx python-pptx openpyxl pdf2docx google-generativeai' manually. Details: ${fallbackErr.message}`;
      console.error(`[Python Setup] ERROR: ${errorMsg}`);
      pythonError = errorMsg;
      isPythonReady = false;
    }
  }
}
