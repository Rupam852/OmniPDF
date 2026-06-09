import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

// Global memory API key store for the active app session
String globalGeminiApiKey = '';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint("Firebase init error: $e");
  }
  
  // Load saved API Key permanently from local storage
  try {
    final prefs = await SharedPreferences.getInstance();
    globalGeminiApiKey = prefs.getString('gemini_api_key') ?? '';
  } catch (e) {
    debugPrint("SharedPreferences load error: $e");
  }
  
  runApp(const OmniPdfApp());
}

class OmniPdfApp extends StatelessWidget {
  const OmniPdfApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'OmniPDF',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF080D1A),
        primaryColor: const Color(0xFF3B82F6),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF3B82F6),
          secondary: Color(0xFF1D4ED8),
          surface: Color(0xFF0B1329),
          background: Color(0xFF080D1A),
        ),
        fontFamily: 'Roboto',
        useMaterial3: true,
      ),
      home: const DashboardScreen(),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    FirebaseAuth.instance.authStateChanges().listen((User? user) {
      if (mounted) {
        setState(() {});
      }
    });
  }
  
  final List<Map<String, dynamic>> _tools = [
    {
      'id': 'merge',
      'name': 'Merge PDF',
      'desc': 'Combine multiple PDFs into a single document.',
      'color': const Color(0xFFF97316),
      'icon': Icons.merge_type_rounded,
    },
    {
      'id': 'split',
      'name': 'Split PDF',
      'desc': 'Separate one page or a whole set from a PDF.',
      'color': const Color(0xFFFF5722),
      'icon': Icons.call_split_rounded,
    },
    {
      'id': 'compress',
      'name': 'Compress PDF',
      'desc': 'Reduce file size while keeping high quality.',
      'color': const Color(0xFF22C55E),
      'icon': Icons.compress_rounded,
    },
    {
      'id': 'pdf-to-jpg',
      'name': 'PDF to JPG',
      'desc': 'Convert PDF pages into high quality JPGs.',
      'color': const Color(0xFFEAB308),
      'icon': Icons.image_outlined,
    },
    {
      'id': 'jpg-to-pdf',
      'name': 'JPG to PDF',
      'desc': 'Convert JPG/PNG images into a PDF file.',
      'color': const Color(0xFFCA8A04),
      'icon': Icons.picture_as_pdf_outlined,
    },
    {
      'id': 'ai_summarizer',
      'name': 'AI Summarizer',
      'desc': 'Get structured executive summaries via Gemini.',
      'color': const Color(0xFF8B5CF6),
      'icon': Icons.auto_awesome_rounded,
    },
    {
      'id': 'translate',
      'name': 'Translate PDF',
      'desc': 'Translate document pages keeping formatting.',
      'color': const Color(0xFF6366F1),
      'icon': Icons.translate_rounded,
    },
    {
      'id': 'watermark',
      'name': 'Watermark',
      'desc': 'Stamp an opacity text over your PDF.',
      'color': const Color(0xFFEC4899),
      'icon': Icons.branding_watermark_rounded,
    },
    {
      'id': 'page-numbers',
      'name': 'Page Numbers',
      'desc': 'Number your pages starting from any value.',
      'color': const Color(0xFF14B8A6),
      'icon': Icons.format_list_numbered_rounded,
    },
    {
      'id': 'rotate',
      'name': 'Rotate PDF',
      'desc': 'Rotate pages by 90, 180 or 270 degrees.',
      'color': const Color(0xFF06B6D4),
      'icon': Icons.rotate_right_rounded,
    },
    {
      'id': 'remove-pages',
      'name': 'Remove Pages',
      'desc': 'Delete selected pages from your PDF file.',
      'color': const Color(0xFFEF4444),
      'icon': Icons.delete_sweep_rounded,
    },
    {
      'id': 'extract-pages',
      'name': 'Extract Pages',
      'desc': 'Extract page ranges into a new document.',
      'color': const Color(0xFFD946EF),
      'icon': Icons.unfold_more_rounded,
    },
    {
      'id': 'organize-pdf',
      'name': 'Organize PDF',
      'desc': 'Rearrange the pages in a custom order.',
      'color': const Color(0xFF64748B),
      'icon': Icons.low_priority_rounded,
    },
    {
      'id': 'protect',
      'name': 'Protect PDF',
      'desc': 'Encrypt your PDF with password restrictions.',
      'color': const Color(0xFF3B82F6),
      'icon': Icons.lock_outline_rounded,
    },
    {
      'id': 'unlock',
      'name': 'Unlock PDF',
      'desc': 'Remove password lock from protected files.',
      'color': const Color(0xFF0284C7),
      'icon': Icons.lock_open_rounded,
    },
    {
      'id': 'repair',
      'name': 'Repair PDF',
      'desc': 'Fix structural corruption in PDF files.',
      'color': const Color(0xFF84CC16),
      'icon': Icons.healing_rounded,
    },
    {
      'id': 'ocr',
      'name': 'OCR PDF',
      'desc': 'Convert scanned PDF using Gemini AI. Requires Gemini Key.',
      'color': const Color(0xFF10B981),
      'icon': Icons.document_scanner_rounded,
    },
    {
      'id': 'word-to-pdf',
      'name': 'Word to PDF',
      'desc': 'Convert DOCX files into PDF documents.',
      'color': const Color(0xFF2563EB),
      'icon': Icons.description_rounded,
    },
    {
      'id': 'powerpoint-to-pdf',
      'name': 'PowerPoint to PDF',
      'desc': 'Convert PPTX slides into PDF documents.',
      'color': const Color(0xFFEA580C),
      'icon': Icons.slideshow_rounded,
    },
    {
      'id': 'excel-to-pdf',
      'name': 'Excel to PDF',
      'desc': 'Convert XLSX spreadsheets into PDF.',
      'color': const Color(0xFF16A34A),
      'icon': Icons.table_chart_rounded,
    },
    {
      'id': 'html-to-pdf',
      'name': 'HTML to PDF',
      'desc': 'Convert HTML pages into PDF documents.',
      'color': const Color(0xFF0D9488),
      'icon': Icons.html_rounded,
    },
    {
      'id': 'pdf-to-word',
      'name': 'PDF to Word',
      'desc': 'Convert PDF to editable DOCX (AI optional).',
      'color': const Color(0xFF3B82F6),
      'icon': Icons.file_present_rounded,
    },
    {
      'id': 'pdf-to-powerpoint',
      'name': 'PDF to PowerPoint',
      'desc': 'Convert PDF to editable PPTX (AI optional).',
      'color': const Color(0xFFF97316),
      'icon': Icons.present_to_all_rounded,
    },
    {
      'id': 'pdf-to-excel',
      'name': 'PDF to Excel',
      'desc': 'Extract tables from PDF to XLSX (AI optional).',
      'color': const Color(0xFF22C55E),
      'icon': Icons.grid_on_rounded,
    },
    {
      'id': 'pdf-to-pdfa',
      'name': 'PDF to PDF/A',
      'desc': 'Convert PDF to archive standard PDF/A.',
      'color': const Color(0xFF64748B),
      'icon': Icons.archive_rounded,
    },
    {
      'id': 'crop',
      'name': 'Crop PDF',
      'desc': 'Crop page margins by a percentage.',
      'color': const Color(0xFF06B6D4),
      'icon': Icons.crop_rounded,
    },
    {
      'id': 'edit-pdf',
      'name': 'AI Edit PDF',
      'desc': 'Edit your PDF content using AI instructions.',
      'color': const Color(0xFF8B5CF6),
      'icon': Icons.edit_note_rounded,
    },
    {
      'id': 'pdf-forms',
      'name': 'Flatten PDF Forms',
      'desc': 'Flatten interactive PDF form fields.',
      'color': const Color(0xFFF43F5E),
      'icon': Icons.view_list_rounded,
    },
    {
      'id': 'sign',
      'name': 'Sign PDF',
      'desc': 'Place a text signature on the last page.',
      'color': const Color(0xFFEC4899),
      'icon': Icons.draw_rounded,
    },
    {
      'id': 'redact',
      'name': 'Redact PDF',
      'desc': 'Permanently blackout sensitive text.',
      'color': const Color(0xFF1E293B),
      'icon': Icons.visibility_off_rounded,
    },
    {
      'id': 'compare',
      'name': 'Compare PDF',
      'desc': 'Diff two PDFs and generate report.',
      'color': const Color(0xFF6366F1),
      'icon': Icons.compare_arrows_rounded,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'OmniPDF',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: const Color(0xFF0B1329),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.blueAccent),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const SettingsScreen()),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 10),
              const Text(
                'Every tool you need to work with PDFs',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Select any modular utility below to start processing:',
                style: TextStyle(
                  fontSize: 14,
                  color: Colors.grey,
                ),
              ),
              const SizedBox(height: 24),
              LayoutBuilder(
                builder: (context, constraints) {
                  final double screenWidth = constraints.maxWidth;
                  final double textScale = MediaQuery.of(context).textScaleFactor;
                  final double cellWidth = (screenWidth - 14) / 2;
                  // Safe dynamic aspect ratio calculation based on width and text scaling
                  final double childAspectRatio = (cellWidth / (105 + 62 * textScale)).clamp(0.60, 0.95);

                  return GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 14,
                      mainAxisSpacing: 14,
                      childAspectRatio: childAspectRatio,
                    ),
                    itemCount: _tools.length,
                    itemBuilder: (context, index) {
                      final tool = _tools[index];
                      return Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              const Color(0xFF0F172A).withOpacity(0.9),
                              const Color(0xFF0B1329).withOpacity(0.95),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withOpacity(0.06)),
                          boxShadow: [
                            BoxShadow(
                              color: (tool['color'] as Color).withOpacity(0.04),
                              blurRadius: 12,
                              spreadRadius: 1,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              borderRadius: BorderRadius.circular(20),
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (context) => ToolRunnerScreen(tool: tool),
                                  ),
                                );
                              },
                              child: Padding(
                                padding: const EdgeInsets.all(16.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: (tool['color'] as Color).withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(10),
                                        boxShadow: [
                                          BoxShadow(
                                            color: (tool['color'] as Color).withOpacity(0.1),
                                            blurRadius: 8,
                                            spreadRadius: 1,
                                          )
                                        ]
                                      ),
                                      child: Icon(
                                        tool['icon'],
                                        color: tool['color'],
                                        size: 26,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        mainAxisAlignment: MainAxisAlignment.end,
                                        children: [
                                          Text(
                                            tool['name'],
                                            style: const TextStyle(
                                                fontSize: 15,
                                                fontWeight: FontWeight.bold,
                                                color: Colors.white),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            tool['desc'],
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              color: Colors.grey,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ToolRunnerScreen extends StatefulWidget {
  final Map<String, dynamic> tool;

  const ToolRunnerScreen({super.key, required this.tool});

  @override
  State<ToolRunnerScreen> createState() => _ToolRunnerScreenState();
}

class _ToolRunnerScreenState extends State<ToolRunnerScreen> {
  bool _isProcessing = false;
  double _progress = 0.0;
  List<PlatformFile> _pickedFiles = [];

  // Success screen controllers
  bool _isCompleted = false;
  String? _responseDataBase64;
  List<Map<String, dynamic>> _processedFiles = [];
  String? _summaryText;
  String _successMessage = 'Your PDF has been processed successfully!';
  String _actionText = 'Download Processed PDF';

  late final TextEditingController _keyController;
  late final TextEditingController _targetSizeController;
  late final TextEditingController _protectPasswordController;
  
  // New tool controllers & states
  late final TextEditingController _splitPageRangesController;
  late final TextEditingController _watermarkTextController;
  late final TextEditingController _watermarkFontSizeController;
  late final TextEditingController _pageNumStartController;
  late final TextEditingController _pageNumPrefixController;
  late final TextEditingController _rotatePagesController;
  late final TextEditingController _removePagesController;
  late final TextEditingController _extractPagesController;
  late final TextEditingController _organizePagesController;
  late final TextEditingController _cropLeftController;
  late final TextEditingController _cropTopController;
  late final TextEditingController _cropRightController;
  late final TextEditingController _cropBottomController;
  late final TextEditingController _editPromptController;
  late final TextEditingController _signatureTextController;
  late final TextEditingController _redactTermController;

  String _targetLanguage = 'Spanish';
  double _compressionPercent = 50.0;
  String _splitMode = 'all'; // 'all', 'half', 'range'
  double _watermarkOpacity = 0.15;
  String _pageNumPosition = 'bottom-center';
  String _rotateAngle = '90';
  String _organizeMode = 'reverse'; // 'reverse', 'normal', 'custom'
  int? _pageCount;
  bool _saveKeyPermanently = true;

  bool _isOptionsExpanded = false;
  bool _obscurePassword = true;



  final List<String> _languages = [
    'Spanish', 'French', 'German', 'Hindi', 'Bengali', 'Marathi',
    'Telugu', 'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Odia',
    'Malayalam', 'Punjabi', 'Assamese', 'Chinese (Simplified)',
    'Chinese (Traditional)', 'Japanese', 'Korean', 'Russian',
    'Arabic', 'Portuguese', 'Italian', 'Turkish', 'Vietnamese',
    'Dutch', 'Indonesian', 'Polish'
  ];

  @override
  void initState() {
    super.initState();
    _keyController = TextEditingController(text: globalGeminiApiKey);
    _saveKeyPermanently = true; // default to true to auto-save entered keys
    _targetSizeController = TextEditingController(text: '500');
    _protectPasswordController = TextEditingController();
    
    _splitPageRangesController = TextEditingController();
    _watermarkTextController = TextEditingController(text: 'OmniPDF');
    _watermarkFontSizeController = TextEditingController(text: '40');
    _pageNumStartController = TextEditingController(text: '1');
    _pageNumPrefixController = TextEditingController();
    _rotatePagesController = TextEditingController(text: 'all');
    _removePagesController = TextEditingController();
    _extractPagesController = TextEditingController();
    _organizePagesController = TextEditingController();
    _cropLeftController = TextEditingController(text: '10');
    _cropTopController = TextEditingController(text: '10');
    _cropRightController = TextEditingController(text: '10');
    _cropBottomController = TextEditingController(text: '10');
    _editPromptController = TextEditingController(text: 'Fix formatting and layout');
    _signatureTextController = TextEditingController(text: 'Signed by OmniPDF');
    _redactTermController = TextEditingController();
  }

  @override
  void dispose() {
    _keyController.dispose();
    _targetSizeController.dispose();
    _protectPasswordController.dispose();
    
    _splitPageRangesController.dispose();
    _watermarkTextController.dispose();
    _watermarkFontSizeController.dispose();
    _pageNumStartController.dispose();
    _pageNumPrefixController.dispose();
    _rotatePagesController.dispose();
    _removePagesController.dispose();
    _extractPagesController.dispose();
    _organizePagesController.dispose();
    _cropLeftController.dispose();
    _cropTopController.dispose();
    _cropRightController.dispose();
    _cropBottomController.dispose();
    _editPromptController.dispose();
    _signatureTextController.dispose();
    _redactTermController.dispose();
    super.dispose();
  }

  void _detectPageCount() async {
    if (widget.tool['id'] != 'organize-pdf' || _pickedFiles.isEmpty) {
      setState(() {
        _pageCount = null;
      });
      return;
    }
    final file = _pickedFiles.first;
    try {
      List<int>? bytes;
      if (file.bytes != null) {
        bytes = file.bytes;
      } else if (file.path != null) {
        final ioFile = File(file.path!);
        if (await ioFile.exists()) {
          bytes = await ioFile.readAsBytes();
        }
      }
      if (bytes != null) {
        final count = _parsePdfPageCount(bytes);
        setState(() {
          _pageCount = count;
        });
      } else {
        setState(() {
          _pageCount = null;
        });
      }
    } catch (e) {
      debugPrint('Error loading PDF for page detection: $e');
      setState(() {
        _pageCount = null;
      });
    }
  }

  int? _parsePdfPageCount(List<int> bytes) {
    try {
      final content = String.fromCharCodes(bytes);
      
      // Look for "/Type /Pages /Count N" or similar
      final regExp = RegExp(r'\/Type\s*\/Pages[\s\S]*?\/Count\s*(\d+)');
      final match = regExp.firstMatch(content);
      if (match != null) {
        return int.tryParse(match.group(1) ?? '');
      }
      
      // Sometimes /Count N comes before /Type /Pages
      final regExpReverse = RegExp(r'\/Count\s*(\d+)[\s\S]*?\/Type\s*\/Pages');
      final matchReverse = regExpReverse.firstMatch(content);
      if (matchReverse != null) {
        return int.tryParse(matchReverse.group(1) ?? '');
      }
      
      // Fallback: search for all /Count N and find the maximum number
      final fallbackRegExp = RegExp(r'\/Count\s*(\d+)');
      final matches = fallbackRegExp.allMatches(content);
      if (matches.isNotEmpty) {
        int maxCount = 0;
        for (final m in matches) {
          final val = int.tryParse(m.group(1) ?? '');
          if (val != null && val > maxCount) {
            maxCount = val;
          }
        }
        if (maxCount > 0) return maxCount;
      }
    } catch (e) {
      debugPrint('Error parsing PDF page count: $e');
    }
    return null;
  }

  void _pickFiles() async {
    try {
      final isJpgToPdf = widget.tool['id'] == 'jpg-to-pdf';
      List<String>? allowedExtensions = ['pdf'];
      FileType fileType = FileType.custom;

      if (isJpgToPdf) {
        fileType = FileType.image;
        allowedExtensions = null;
      } else if (widget.tool['id'] == 'word-to-pdf') {
        allowedExtensions = ['docx'];
      } else if (widget.tool['id'] == 'powerpoint-to-pdf') {
        allowedExtensions = ['pptx'];
      } else if (widget.tool['id'] == 'excel-to-pdf') {
        allowedExtensions = ['xlsx'];
      } else if (widget.tool['id'] == 'html-to-pdf') {
        allowedExtensions = ['html', 'htm'];
      }

      final bool allowMultiple = ['merge', 'jpg-to-pdf', 'compare', 'compress'].contains(widget.tool['id']);

      final result = await FilePicker.platform.pickFiles(
        type: fileType,
        allowedExtensions: allowedExtensions,
        allowMultiple: allowMultiple,
      );
      if (!mounted) return;
      if (result != null && result.files.isNotEmpty) {
        final List<PlatformFile> validFiles = [];
        final List<String> tooLargeNames = [];

        for (var file in result.files) {
          if (file.size > 10 * 1024 * 1024) {
            tooLargeNames.add(file.name);
          } else {
            validFiles.add(file);
          }
        }

        if (tooLargeNames.isNotEmpty) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('File(s) too large: ${tooLargeNames.join(', ')}. Maximum allowed size is 10MB.'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }

        if (validFiles.isNotEmpty) {
          setState(() {
            if (allowMultiple) {
              if (widget.tool['id'] == 'compress' && _pickedFiles.length + validFiles.length > 10) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Maximum upload limit is 10 files for compression.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                // add up to 10
                final spaceLeft = 10 - _pickedFiles.length;
                if (spaceLeft > 0) {
                  _pickedFiles.addAll(validFiles.take(spaceLeft));
                }
              } else if (widget.tool['id'] == 'compare' && _pickedFiles.length + validFiles.length > 2) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Compare PDF tool accepts exactly 2 files.'),
                    backgroundColor: Colors.redAccent,
                  ),
                );
                final spaceLeft = 2 - _pickedFiles.length;
                if (spaceLeft > 0) {
                  _pickedFiles.addAll(validFiles.take(spaceLeft));
                }
              } else {
                _pickedFiles.addAll(validFiles);
              }
            } else {
              _pickedFiles = [validFiles.first];
            }
          });
          _detectPageCount();
        }
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to pick files: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  void _runOperation() async {
    if (_pickedFiles.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please pick file(s) first.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    final apiKey = _keyController.text.trim();
    final isAiRequired = ['ai_summarizer', 'translate', 'ocr', 'edit-pdf'].contains(widget.tool['id']);

    if (isAiRequired && apiKey.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A Google Gemini API key must be provided to use this tool.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (_saveKeyPermanently && apiKey.isNotEmpty) {
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('gemini_api_key', apiKey);
        globalGeminiApiKey = apiKey;
      } catch (e) {
        debugPrint('SharedPreferences save error: $e');
      }
    }

    if (widget.tool['id'] == 'protect' && _protectPasswordController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A password must be provided to protect this PDF.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (widget.tool['id'] == 'unlock' && _protectPasswordController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A password must be provided to unlock this PDF.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (widget.tool['id'] == 'edit-pdf' && _editPromptController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter editing instructions for the AI.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (widget.tool['id'] == 'redact' && _redactTermController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please enter a term to redact from the PDF.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    if (widget.tool['id'] == 'compare' && _pickedFiles.length != 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select exactly two PDF files to compare.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    // ── SEQUENTIAL MULTIPLE FILE COMPRESSION LOOP ──
    if (widget.tool['id'] == 'compress' && _pickedFiles.length > 1) {
      setState(() {
        _isProcessing = true;
        _progress = 0.1;
        _isCompleted = false;
        _responseDataBase64 = null;
        _processedFiles = [];
        _summaryText = null;
      });

      try {
        final List<Map<String, dynamic>> results = [];
        double totalOriginal = 0;
        double totalCompressed = 0;

        for (int i = 0; i < _pickedFiles.length; i++) {
          final platformFile = _pickedFiles[i];
          final uri = Uri.parse('https://omnipdf-backed.onrender.com/api/tools/compress');
          var request = http.MultipartRequest('POST', uri);

          final double originalSize = platformFile.size.toDouble();
          final double targetBytes = originalSize * (_compressionPercent / 100.0);
          final double targetKB = targetBytes / 1024.0;
          request.fields['targetSize'] = targetKB.toStringAsFixed(1);
          request.fields['targetUnit'] = 'KB';

          if (platformFile.bytes != null) {
            request.files.add(http.MultipartFile.fromBytes(
              'file',
              platformFile.bytes!,
              filename: platformFile.name,
            ));
          } else if (platformFile.path != null) {
            request.files.add(await http.MultipartFile.fromPath(
              'file',
              platformFile.path!,
              filename: platformFile.name,
            ));
          }

          var streamedResponse = await request.send();
          var response = await http.Response.fromStream(streamedResponse);

          if (response.statusCode == 200) {
            final resData = jsonDecode(response.body);
            final double compSize = resData['compressedSize'] != null
                ? (resData['compressedSize'] as num).toDouble()
                : originalSize * 0.5;
            totalOriginal += originalSize;
            totalCompressed += compSize;

            final dotIdx = platformFile.name.lastIndexOf('.');
            final base = dotIdx != -1 ? platformFile.name.substring(0, dotIdx) : platformFile.name;

            results.add({
              'fileName': '${base}_compressed.pdf',
              'fileData': resData['fileData'],
            });
          } else {
            throw Exception('Failed to compress ${platformFile.name}');
          }

          setState(() {
            _progress = 0.1 + (0.8 * (i + 1) / _pickedFiles.length);
          });
        }

        final reductionPct = (((totalOriginal - totalCompressed) / totalOriginal) * 100).toStringAsFixed(1);

        setState(() {
          _isProcessing = false;
          _isCompleted = true;
          _progress = 1.0;
          _processedFiles = results;
          _successMessage = 'Successfully compressed ${_pickedFiles.length} PDFs! Total reduction: ${(totalOriginal / 1024).toStringAsFixed(1)} KB → ${(totalCompressed / 1024).toStringAsFixed(1)} KB ($reductionPct% reduction).';
          _actionText = 'Download Compressed PDFs';
        });
      } catch (e) {
        setState(() {
          _isProcessing = false;
        });
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Compression Failed: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
      return;
    }

    // ── STANDARD OPERATION REQUEST FLOW ──
    setState(() {
      _isProcessing = true;
      _progress = 0.1;
      _isCompleted = false;
      _responseDataBase64 = null;
      _processedFiles = [];
      _summaryText = null;
    });

    try {
      final endpointMap = {
        'merge': 'merge',
        'split': 'split',
        'compress': 'compress',
        'protect': 'protect',
        'unlock': 'unlock',
        'ai_summarizer': 'ai-summarizer',
        'translate': 'translate',
        'watermark': 'watermark',
        'page-numbers': 'page-numbers',
        'rotate': 'rotate',
        'remove-pages': 'remove-pages',
        'extract-pages': 'extract-pages',
        'organize-pdf': 'organize-pdf',
        'repair': 'repair',
        'pdf-to-jpg': 'pdf-to-jpg',
        'jpg-to-pdf': 'jpg-to-pdf',
        'ocr': 'ocr',
      };

      final endpoint = endpointMap[widget.tool['id']] ?? widget.tool['id'];
      final uri = Uri.parse('https://omnipdf-backed.onrender.com/api/tools/$endpoint');

      var request = http.MultipartRequest('POST', uri);
      if (apiKey.isNotEmpty) {
        request.headers['x-gemini-key'] = apiKey;
      }

      // Populate Request Parameters
      if (widget.tool['id'] == 'translate') {
        request.fields['targetLanguage'] = _targetLanguage;
      }

      if (widget.tool['id'] == 'compress') {
        final double originalSize = _pickedFiles.isNotEmpty ? _pickedFiles[0].size.toDouble() : 0.0;
        final double targetBytes = originalSize * (_compressionPercent / 100.0);
        final double targetKB = targetBytes / 1024.0;
        request.fields['targetSize'] = targetKB.toStringAsFixed(1);
        request.fields['targetUnit'] = 'KB';
      }

      if (widget.tool['id'] == 'protect' || widget.tool['id'] == 'unlock') {
        request.fields['password'] = _protectPasswordController.text.trim();
      }

      if (widget.tool['id'] == 'split') {
        request.fields['splitMode'] = _splitMode;
        if (_splitMode == 'range') {
          request.fields['pageRanges'] = _splitPageRangesController.text.trim();
        }
      }

      if (widget.tool['id'] == 'watermark') {
        request.fields['watermarkText'] = _watermarkTextController.text.trim().isEmpty ? 'OmniPDF' : _watermarkTextController.text.trim();
        request.fields['opacity'] = _watermarkOpacity.toString();
        request.fields['fontSize'] = _watermarkFontSizeController.text.trim().isEmpty ? '40' : _watermarkFontSizeController.text.trim();
      }

      if (widget.tool['id'] == 'page-numbers') {
        request.fields['position'] = _pageNumPosition;
        request.fields['startNumber'] = _pageNumStartController.text.trim().isEmpty ? '1' : _pageNumStartController.text.trim();
        request.fields['prefix'] = _pageNumPrefixController.text;
      }

      if (widget.tool['id'] == 'rotate') {
        request.fields['angle'] = _rotateAngle;
        request.fields['pages'] = _rotatePagesController.text.trim().isEmpty ? 'all' : _rotatePagesController.text.trim();
      }

      if (widget.tool['id'] == 'remove-pages') {
        request.fields['pageNumbers'] = _removePagesController.text.trim();
      }

      if (widget.tool['id'] == 'extract-pages') {
        request.fields['pageRanges'] = _extractPagesController.text.trim();
      }

      if (widget.tool['id'] == 'organize-pdf') {
        request.fields['pageOrder'] = _organizeMode == 'custom'
            ? _organizePagesController.text.trim()
            : _organizeMode;
      }

      if (widget.tool['id'] == 'crop') {
        request.fields['left'] = _cropLeftController.text.trim().isEmpty ? '10' : _cropLeftController.text.trim();
        request.fields['top'] = _cropTopController.text.trim().isEmpty ? '10' : _cropTopController.text.trim();
        request.fields['right'] = _cropRightController.text.trim().isEmpty ? '10' : _cropRightController.text.trim();
        request.fields['bottom'] = _cropBottomController.text.trim().isEmpty ? '10' : _cropBottomController.text.trim();
      }

      if (widget.tool['id'] == 'edit-pdf') {
        request.fields['prompt'] = _editPromptController.text.trim().isEmpty ? 'Fix formatting and layout' : _editPromptController.text.trim();
      }

      if (widget.tool['id'] == 'sign') {
        request.fields['signatureText'] = _signatureTextController.text.trim().isEmpty ? 'Signed by OmniPDF' : _signatureTextController.text.trim();
      }

      if (widget.tool['id'] == 'redact') {
        request.fields['term'] = _redactTermController.text.trim();
      }

      setState(() {
        _progress = 0.3;
      });

      // Add file(s)
      if (widget.tool['id'] == 'compare') {
        for (int i = 0; i < 2; i++) {
          final platformFile = _pickedFiles[i];
          final fieldName = 'file${i + 1}';
          if (platformFile.bytes != null) {
            request.files.add(http.MultipartFile.fromBytes(
              fieldName,
              platformFile.bytes!,
              filename: platformFile.name,
            ));
          } else if (platformFile.path != null) {
            request.files.add(await http.MultipartFile.fromPath(
              fieldName,
              platformFile.path!,
              filename: platformFile.name,
            ));
          }
        }
      } else {
        final isMultiple = widget.tool['id'] == 'merge' || widget.tool['id'] == 'jpg-to-pdf';
        for (var platformFile in _pickedFiles) {
          if (platformFile.bytes != null) {
            request.files.add(http.MultipartFile.fromBytes(
              isMultiple ? 'files' : 'file',
              platformFile.bytes!,
              filename: platformFile.name,
            ));
          } else if (platformFile.path != null) {
            request.files.add(await http.MultipartFile.fromPath(
              isMultiple ? 'files' : 'file',
              platformFile.path!,
              filename: platformFile.name,
            ));
          }
        }
      }

      setState(() {
        _progress = 0.6;
      });

      var streamedResponse = await request.send();
      var response = await http.Response.fromStream(streamedResponse);
      if (!mounted) return;

      if (response.statusCode == 200) {
        final resData = jsonDecode(response.body);
        setState(() {
          _isProcessing = false;
          _isCompleted = true;
          _progress = 1.0;

          if (widget.tool['id'] == 'ai_summarizer' || widget.tool['id'] == 'ocr') {
            _summaryText = resData['summary'] ?? 'No text returned.';
            _responseDataBase64 = resData['fileData'];
            _successMessage = widget.tool['id'] == 'ocr'
                ? 'Your PDF has been OCR-processed successfully!'
                : 'Your PDF has been summarized successfully using Gemini AI!';
            _actionText = widget.tool['id'] == 'ocr'
                ? 'Download OCR PDF'
                : 'Download Summary PDF';
          } else if (widget.tool['id'] == 'split') {
            if (resData['files'] != null) {
              _processedFiles = List<Map<String, dynamic>>.from(resData['files']);
            }
            _successMessage = 'Your PDF has been split successfully!';
            _actionText = 'Download Split PDFs';
          } else {
            _responseDataBase64 = resData['fileData'];
            _successMessage = resData['message'] ?? 'Your PDF has been processed successfully!';
            
            // Map corresponding action text
            final actionTextMap = {
              'merge': 'Download Merged PDF',
              'compress': 'Download Compressed PDF',
              'protect': 'Download Protected PDF',
              'unlock': 'Download Unlocked PDF',
              'translate': 'Download Translated PDF',
              'watermark': 'Download Watermarked PDF',
              'page-numbers': 'Download Numbered PDF',
              'rotate': 'Download Rotated PDF',
              'remove-pages': 'Download Cleaned PDF',
              'extract-pages': 'Download Extracted PDF',
              'organize-pdf': 'Download Organized PDF',
              'repair': 'Download Repaired PDF',
              'pdf-to-jpg': 'Download Images ZIP',
              'jpg-to-pdf': 'Download Converted PDF',
              'word-to-pdf': 'Download Converted PDF',
              'powerpoint-to-pdf': 'Download Converted PDF',
              'excel-to-pdf': 'Download Converted PDF',
              'html-to-pdf': 'Download Converted PDF',
              'pdf-to-word': 'Download Word Doc',
              'pdf-to-powerpoint': 'Download PowerPoint',
              'pdf-to-excel': 'Download Excel Sheet',
              'pdf-to-pdfa': 'Download PDF/A Archive',
              'crop': 'Download Cropped PDF',
              'edit-pdf': 'Download Edited PDF',
              'pdf-forms': 'Download Flattened PDF',
              'sign': 'Download Signed PDF',
              'redact': 'Download Redacted PDF',
              'compare': 'Download Comparison Report',
            };
            _actionText = actionTextMap[widget.tool['id']] ?? 'Download Processed PDF';
          }
        });
      } else {
        setState(() {
          _isProcessing = false;
        });
        String errMsg = 'Request failed.';
        try {
          final errData = jsonDecode(response.body);
          errMsg = errData['message'] ?? errData['error'] ?? errMsg;
        } catch (_) {}
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $errMsg'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isProcessing = false;
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Network Error: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  Future<void> _saveBase64File(String base64Content, String defaultName) async {
    try {
      final Uint8List bytes = base64Decode(base64Content);

      if (Platform.isAndroid) {
        // Try native MethodChannel first
        try {
          const channel = MethodChannel('com.omnipdf.app/download');
          String mimeType = 'application/pdf';
          if (defaultName.endsWith('.zip')) {
            mimeType = 'application/zip';
          } else if (defaultName.endsWith('.docx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          } else if (defaultName.endsWith('.pptx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
          } else if (defaultName.endsWith('.xlsx')) {
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          } else if (defaultName.endsWith('.jpg') || defaultName.endsWith('.jpeg')) {
            mimeType = 'image/jpeg';
          }

          final String? savedPath = await channel.invokeMethod<String>('saveToDownloads', {
            'bytes': bytes,
            'fileName': defaultName,
            'mimeType': mimeType,
          });

          if (savedPath != null) {
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text('Saved to: $savedPath'),
                backgroundColor: Colors.green,
                duration: const Duration(seconds: 5),
                action: SnackBarAction(
                  label: 'OK',
                  textColor: Colors.white,
                  onPressed: () {},
                ),
              ),
            );
            return; // Exit early if native save succeeded
          }
        } catch (nativeErr) {
          debugPrint('Native MethodChannel save failed: $nativeErr. Falling back to legacy storage...');
        }
      }

      // Legacy fallback (iOS and older Android/failing cases)
      if (Platform.isAndroid) {
        await Permission.storage.request();
      }

      Directory? dir;
      if (Platform.isAndroid) {
        dir = Directory('/storage/emulated/0/Download');
        if (!await dir.exists()) {
          if (!mounted) return;
          dir = await getExternalStorageDirectory();
        }
      } else {
        dir = await getApplicationDocumentsDirectory();
      }

      if (!mounted) return;
      if (dir == null) {
        throw Exception("Could not resolve local documents/download directory.");
      }

      final String filePath = '${dir.path}/$defaultName';
      final File file = File(filePath);
      await file.writeAsBytes(bytes);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Saved to: $filePath'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 5),
          action: SnackBarAction(
            label: 'OK',
            textColor: Colors.white,
            onPressed: () {},
          ),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to save file: $e'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAiRequired = ['ai_summarizer', 'translate', 'ocr', 'edit-pdf'].contains(widget.tool['id']);
    final isAiOptional = ['pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel'].contains(widget.tool['id']);

    if (_isCompleted) {
      return PopScope(
        canPop: false,
        onPopInvokedWithResult: (didPop, result) {
          if (didPop) return;
          setState(() {
            _isCompleted = false;
            _pickedFiles = [];
            _progress = 0.0;
            _summaryText = null;
            _responseDataBase64 = null;
            _processedFiles = [];
          });
          _detectPageCount();
        },
        child: Scaffold(
          appBar: AppBar(
            title: Text(widget.tool['name']),
            backgroundColor: const Color(0xFF0B1329),
          ),
          body: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.green.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_circle_outline_rounded,
                      color: Colors.green,
                      size: 80,
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    '${widget.tool['name']} Completed!',
                    style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _successMessage,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        fontSize: 15,
                        color: Color(0xFFCBD5E1),
                        fontWeight: FontWeight.w500),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Processed File(s): ${_pickedFiles.map((f) => f.name).join(', ')}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 30),
                  if (_summaryText != null) ...[
                    Card(
                      color: const Color(0xFF1E293B),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(color: Colors.white.withOpacity(0.08)),
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'AI Summary Results',
                              style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF60A5FA)),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              _summaryText!,
                              style: const TextStyle(
                                  fontSize: 13,
                                  height: 1.5,
                                  color: Color(0xFFE2E8F0)),
                            ),
                            const SizedBox(height: 16),
                            ElevatedButton.icon(
                              onPressed: () {
                                Clipboard.setData(
                                    ClipboardData(text: _summaryText!));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Summary copied to clipboard!'),
                                    backgroundColor: Colors.green,
                                  ),
                                );
                              },
                              icon: const Icon(Icons.copy, size: 16),
                              label: const Text('Copy to Clipboard'),
                              style: ElevatedButton.styleFrom(
                                  minimumSize: const Size(double.infinity, 36)),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  if (_responseDataBase64 != null) ...[
                    ElevatedButton.icon(
                      onPressed: () {
                        String outputName = 'processed_${DateTime.now().millisecondsSinceEpoch}.pdf';
                        if (_pickedFiles.isNotEmpty) {
                          final original = _pickedFiles[0].name;
                          final dotIdx = original.lastIndexOf('.');
                          final base = dotIdx != -1 ? original.substring(0, dotIdx) : original;
                          String suffix = '_processed';
                          String ext = '.pdf';
                          if (widget.tool['id'] == 'merge') {
                            suffix = '_merged';
                          } else if (widget.tool['id'] == 'compress') {
                            suffix = '_compressed';
                          } else if (widget.tool['id'] == 'protect') {
                            suffix = '_protected';
                          } else if (widget.tool['id'] == 'rotate') {
                            suffix = '_rotated';
                          } else if (widget.tool['id'] == 'watermark') {
                            suffix = '_watermarked';
                          } else if (widget.tool['id'] == 'remove-pages') {
                            suffix = '_pages_removed';
                          } else if (widget.tool['id'] == 'extract-pages') {
                            suffix = '_extracted';
                          } else if (widget.tool['id'] == 'organize-pdf') {
                            suffix = '_organized';
                          } else if (widget.tool['id'] == 'repair') {
                            suffix = '_repaired';
                          } else if (widget.tool['id'] == 'pdf-to-jpg') {
                            suffix = '_images';
                            ext = '.zip';
                          } else if (widget.tool['id'] == 'jpg-to-pdf') {
                            suffix = '_converted';
                          } else if (widget.tool['id'] == 'word-to-pdf' ||
                                     widget.tool['id'] == 'powerpoint-to-pdf' ||
                                     widget.tool['id'] == 'excel-to-pdf' ||
                                     widget.tool['id'] == 'html-to-pdf') {
                            suffix = '_converted';
                            ext = '.pdf';
                          } else if (widget.tool['id'] == 'pdf-to-word') {
                            suffix = '_converted';
                            ext = '.docx';
                          } else if (widget.tool['id'] == 'pdf-to-powerpoint') {
                            suffix = '_converted';
                            ext = '.pptx';
                          } else if (widget.tool['id'] == 'pdf-to-excel') {
                            suffix = '_converted';
                            ext = '.xlsx';
                          } else if (widget.tool['id'] == 'pdf-to-pdfa') {
                            suffix = '_archive';
                            ext = '.pdf';
                          } else if (widget.tool['id'] == 'crop') {
                            suffix = '_cropped';
                          } else if (widget.tool['id'] == 'edit-pdf') {
                            suffix = '_edited';
                          } else if (widget.tool['id'] == 'pdf-forms') {
                            suffix = '_flattened';
                          } else if (widget.tool['id'] == 'sign') {
                            suffix = '_signed';
                          } else if (widget.tool['id'] == 'redact') {
                            suffix = '_redacted';
                          } else if (widget.tool['id'] == 'compare') {
                            suffix = '_comparison';
                            ext = '.pdf';
                          }
                          outputName = '$base$suffix$ext';
                        }
                        _saveBase64File(_responseDataBase64!, outputName);
                      },
                      icon: const Icon(Icons.file_download_rounded),
                      label: Text(_actionText),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(double.infinity, 50),
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  if (widget.tool['id'] == 'pdf-to-jpg' &&
                      _processedFiles.isNotEmpty) ...[
                    ..._processedFiles.map((f) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 12.0),
                        child: ElevatedButton.icon(
                          onPressed: () {
                            _saveBase64File(f['fileData'], f['fileName']);
                          },
                          icon: const Icon(Icons.file_download_rounded),
                          label: Text('Download ${f['fileName']}'),
                          style: ElevatedButton.styleFrom(
                            minimumSize: const Size(double.infinity, 48),
                            backgroundColor: Colors.blueAccent,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8)),
                          ),
                        ),
                      );
                    }).toList(),
                    const SizedBox(height: 20),
                  ],
                  OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _isCompleted = false;
                        _pickedFiles = [];
                        _progress = 0.0;
                        _summaryText = null;
                        _responseDataBase64 = null;
                        _processedFiles = [];
                      });
                      _detectPageCount();
                    },
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      side: BorderSide(color: Colors.white.withOpacity(0.15)),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                    child: const Text('Process Another File'),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    onPressed: () {
                      Navigator.pop(context);
                    },
                    child: const Text('Back to Dashboard',
                        style: TextStyle(color: Colors.blueAccent)),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.tool['name']),
        backgroundColor: const Color(0xFF0B1329),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            if (_pickedFiles.isEmpty) ...[
              const SizedBox(height: 20),
              Icon(
                widget.tool['icon'],
                size: 80,
                color: widget.tool['color'],
              ),
              const SizedBox(height: 20),
              Text(
                widget.tool['name'],
                style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white),
              ),
              const SizedBox(height: 8),
              Text(
                widget.tool['desc'],
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
              const SizedBox(height: 30),
              ElevatedButton.icon(
                onPressed: _pickFiles,
                icon: const Icon(Icons.file_upload_outlined),
                label: Text(widget.tool['id'] == 'merge' || widget.tool['id'] == 'jpg-to-pdf'
                    ? (widget.tool['id'] == 'jpg-to-pdf' ? 'Pick Images' : 'Pick PDF Documents')
                    : 'Pick PDF Document'),
                style: ElevatedButton.styleFrom(
                  minimumSize: const Size(220, 52),
                  backgroundColor: const Color(0xFF3B82F6),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ] else ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Selected Files (${_pickedFiles.length})',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Row(
                    children: [
                      if (['merge', 'jpg-to-pdf', 'compress'].contains(widget.tool['id']))
                        TextButton.icon(
                          onPressed: _pickFiles,
                          icon: const Icon(Icons.add, size: 16),
                          label: const Text('Add', style: TextStyle(fontSize: 12)),
                          style: TextButton.styleFrom(padding: EdgeInsets.zero),
                        ),
                      const SizedBox(width: 8),
                      TextButton.icon(
                        onPressed: () {
                          setState(() {
                            _pickedFiles.clear();
                          });
                          _detectPageCount();
                        },
                        icon: const Icon(Icons.clear, size: 16, color: Colors.redAccent),
                        label: const Text('Clear', style: TextStyle(fontSize: 12, color: Colors.redAccent)),
                        style: TextButton.styleFrom(padding: EdgeInsets.zero),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),

              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _pickedFiles.length,
                itemBuilder: (context, index) {
                  final platformFile = _pickedFiles[index];
                  final sizeMB = (platformFile.size / (1024 * 1024)).toStringAsFixed(2);
                  final dotIdx = platformFile.name.lastIndexOf('.');
                  final fileExt = dotIdx != -1 ? platformFile.name.substring(dotIdx + 1).toUpperCase() : 'FILE';

                  Color fileColor = const Color(0xFF64748B); // Slate
                  if (fileExt == 'PDF') {
                    fileColor = const Color(0xFFEF4444); // Red
                  } else if (fileExt == 'DOCX' || fileExt == 'DOC') {
                    fileColor = const Color(0xFF2563EB); // Blue
                  } else if (fileExt == 'PPTX' || fileExt == 'PPT') {
                    fileColor = const Color(0xFFEA580C); // Orange
                  } else if (fileExt == 'XLSX' || fileExt == 'XLS') {
                    fileColor = const Color(0xFF16A34A); // Green
                  } else if (fileExt == 'HTML' || fileExt == 'HTM') {
                    fileColor = const Color(0xFFCA8A04); // Yellow
                  }

                  return Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.only(bottom: 8),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.white.withOpacity(0.08)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          // Sequence Number Badge
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.08),
                              shape: BoxShape.circle,
                            ),
                            child: Center(
                              child: Text(
                                '${index + 1}',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF94A3B8),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // File Type Format Badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: fileColor,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              fileExt,
                              style: const TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          // File Details (Name & Size)
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  platformFile.name,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFFF1F5F9),
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '$sizeMB MB',
                                  style: const TextStyle(
                                    fontSize: 10,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          // Delete button on the far right
                          IconButton(
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              size: 20,
                              color: Colors.redAccent,
                            ),
                            onPressed: () {
                              setState(() {
                                _pickedFiles.remove(platformFile);
                              });
                              _detectPageCount();
                            },
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
              const SizedBox(height: 20),

              Card(
                color: const Color(0xFF1E293B),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: BorderSide(color: Colors.white.withOpacity(0.08)),
                ),
                child: Theme(
                  data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    initiallyExpanded: _isOptionsExpanded,
                    onExpansionChanged: (val) {
                      setState(() {
                        _isOptionsExpanded = val;
                      });
                    },
                    leading: const Icon(Icons.settings_suggest_rounded, color: Colors.blueAccent),
                    title: const Text(
                      'Changes Box (Settings)',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                    ),
                    subtitle: Text(
                      'Configure output options for this tool',
                      style: TextStyle(fontSize: 11, color: Colors.white.withOpacity(0.5)),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Divider(color: Colors.white12, height: 1, indent: 0, endIndent: 0),
                            const SizedBox(height: 12),
                            // AI Option settings panel
                            if (isAiRequired || isAiOptional) ...[
                              const Text(
                                'AI Option Settings',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF60A5FA),
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _keyController,
                                obscureText: true,
                                onChanged: (val) async {
                                  final key = val.trim();
                                  globalGeminiApiKey = key;
                                  if (_saveKeyPermanently) {
                                    try {
                                      final prefs = await SharedPreferences.getInstance();
                                      await prefs.setString('gemini_api_key', key);
                                    } catch (e) {
                                      debugPrint('SharedPreferences save error: $e');
                                    }
                                  }
                                },
                                decoration: const InputDecoration(
                                  labelText: 'Google Gemini API Key',
                                  labelStyle: TextStyle(fontSize: 12, color: Colors.grey),
                                  border: OutlineInputBorder(),
                                  prefixIcon: Icon(Icons.vpn_key_rounded, size: 18),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  SizedBox(
                                    height: 20,
                                    width: 20,
                                    child: Checkbox(
                                      value: _saveKeyPermanently,
                                      activeColor: Colors.blueAccent,
                                      onChanged: (val) async {
                                        setState(() {
                                          _saveKeyPermanently = val ?? false;
                                        });
                                        if (_saveKeyPermanently) {
                                          final prefs = await SharedPreferences.getInstance();
                                          await prefs.setString('gemini_api_key', _keyController.text.trim());
                                        } else {
                                          final prefs = await SharedPreferences.getInstance();
                                          await prefs.remove('gemini_api_key');
                                        }
                                      },
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  const Text(
                                    'Save API Key permanently on this device',
                                    style: TextStyle(fontSize: 11, color: Colors.grey),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                isAiRequired
                                    ? '* This tool requires a Gemini API Key to function.'
                                    : '* Gemini AI is optional here. Leave empty to use direct conversion.',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontStyle: FontStyle.italic,
                                  color: isAiRequired ? Colors.amberAccent : Colors.grey,
                                ),
                              ),
                              if (widget.tool['id'] == 'translate') ...[
                                const SizedBox(height: 12),
                                DropdownButtonFormField<String>(
                                  value: _targetLanguage,
                                  dropdownColor: const Color(0xFF0B1329),
                                  decoration: const InputDecoration(
                                    labelText: 'Target Language',
                                    labelStyle: TextStyle(fontSize: 12, color: Colors.grey),
                                    border: OutlineInputBorder(),
                                    prefixIcon: Icon(Icons.language_rounded, size: 18),
                                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                  items: _languages.map((String lang) {
                                    return DropdownMenuItem<String>(
                                        value: lang, child: Text(lang));
                                  }).toList(),
                                  onChanged: (String? newVal) {
                                    if (newVal != null) {
                                      setState(() {
                                        _targetLanguage = newVal;
                                      });
                                    }
                                  },
                                ),
                              ],
                              const SizedBox(height: 16),
                            ],

                            // Protect PDF configuration panel
                            if (widget.tool['id'] == 'protect') ...[
                              const Text(
                                'Protection Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _protectPasswordController,
                                obscureText: _obscurePassword,
                                decoration: InputDecoration(
                                  labelText: 'Password to Encrypt PDF',
                                  labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                                  border: const OutlineInputBorder(),
                                  prefixIcon: const Icon(Icons.lock_rounded, size: 18),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                      size: 18,
                                      color: Colors.grey,
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _obscurePassword = !_obscurePassword;
                                      });
                                    },
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Unlock PDF configuration panel
                            if (widget.tool['id'] == 'unlock') ...[
                              const Text(
                                'Unlock Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _protectPasswordController,
                                obscureText: _obscurePassword,
                                decoration: InputDecoration(
                                  labelText: 'PDF Password to Unlock',
                                  labelStyle: const TextStyle(fontSize: 12, color: Colors.grey),
                                  border: const OutlineInputBorder(),
                                  prefixIcon: const Icon(Icons.lock_open_rounded, size: 18),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  suffixIcon: IconButton(
                                    icon: Icon(
                                      _obscurePassword ? Icons.visibility_off_rounded : Icons.visibility_rounded,
                                      size: 18,
                                      color: Colors.grey,
                                    ),
                                    onPressed: () {
                                      setState(() {
                                        _obscurePassword = !_obscurePassword;
                                      });
                                    },
                                  ),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Compress PDF configuration panel
                            if (widget.tool['id'] == 'compress') ...[
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Compression Level',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                                  ),
                                  Text(
                                    '${_compressionPercent.toInt()}% (${((_pickedFiles.isNotEmpty ? _pickedFiles[0].size : 0) * (_compressionPercent / 100) / 1024).toStringAsFixed(0)} KB)',
                                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Slider(
                                min: 10.0,
                                max: 90.0,
                                divisions: 8,
                                value: _compressionPercent,
                                activeColor: Colors.blueAccent,
                                inactiveColor: const Color(0xFF0F172A),
                                onChanged: (double val) {
                                  setState(() {
                                    _compressionPercent = val;
                                  });
                                },
                              ),
                              const Padding(
                                padding: EdgeInsets.symmetric(horizontal: 8.0),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('High (10%)', style: TextStyle(fontSize: 9, color: Colors.grey)),
                                    Text('Medium (50%)', style: TextStyle(fontSize: 9, color: Colors.grey)),
                                    Text('Low (90%)', style: TextStyle(fontSize: 9, color: Colors.grey)),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Split PDF configuration panel
                            if (widget.tool['id'] == 'split') ...[
                              const Text(
                                'Split Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<String>(
                                value: _splitMode,
                                dropdownColor: const Color(0xFF0B1329),
                                decoration: const InputDecoration(
                                  labelText: 'Split Mode',
                                  labelStyle: TextStyle(fontSize: 12, color: Colors.grey),
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'all', child: Text('Every Page (one PDF per page)')),
                                  DropdownMenuItem(value: 'half', child: Text('Split in Half (2 parts)')),
                                  DropdownMenuItem(value: 'range', child: Text('Custom Page Ranges')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() { _splitMode = val; });
                                },
                              ),
                              if (_splitMode == 'range') ...[
                                const SizedBox(height: 8),
                                TextField(
                                  controller: _splitPageRangesController,
                                  decoration: const InputDecoration(
                                    labelText: 'Page Ranges (e.g. 1-3,4-6,7)',
                                    labelStyle: TextStyle(fontSize: 12, color: Colors.grey),
                                    border: OutlineInputBorder(),
                                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 16),
                            ],

                            // Watermark PDF configuration panel
                            if (widget.tool['id'] == 'watermark') ...[
                              const Text(
                                'Watermark Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _watermarkTextController,
                                decoration: const InputDecoration(
                                  labelText: 'Watermark Text',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _watermarkFontSizeController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Font Size',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text('Opacity', style: TextStyle(fontSize: 12, color: Colors.grey)),
                                  Text('${(_watermarkOpacity * 100).toInt()}%', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueAccent, fontSize: 12)),
                                ],
                              ),
                              Slider(
                                min: 0.05,
                                max: 1.0,
                                value: _watermarkOpacity,
                                onChanged: (val) {
                                  setState(() { _watermarkOpacity = val; });
                                },
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Page Numbers configuration panel
                            if (widget.tool['id'] == 'page-numbers') ...[
                              const Text(
                                'Page Numbering Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<String>(
                                value: _pageNumPosition,
                                dropdownColor: const Color(0xFF0B1329),
                                decoration: const InputDecoration(
                                  labelText: 'Position',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                                items: const [
                                  DropdownMenuItem(value: 'bottom-center', child: Text('Bottom Center')),
                                  DropdownMenuItem(value: 'bottom-left', child: Text('Bottom Left')),
                                  DropdownMenuItem(value: 'bottom-right', child: Text('Bottom Right')),
                                  DropdownMenuItem(value: 'top-center', child: Text('Top Center')),
                                  DropdownMenuItem(value: 'top-left', child: Text('Top Left')),
                                  DropdownMenuItem(value: 'top-right', child: Text('Top Right')),
                                ],
                                onChanged: (val) {
                                  if (val != null) setState(() { _pageNumPosition = val; });
                                },
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _pageNumStartController,
                                keyboardType: TextInputType.number,
                                decoration: const InputDecoration(
                                  labelText: 'Start Number',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _pageNumPrefixController,
                                decoration: const InputDecoration(
                                  labelText: 'Prefix (e.g. Page )',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Organize PDF options panel
                            if (widget.tool['id'] == 'organize-pdf') ...[
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Text(
                                    'Page Order Settings',
                                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                                  ),
                                  if (_pageCount != null)
                                    Text(
                                      'Detected $_pageCount pages',
                                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amberAccent),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              DropdownButtonFormField<String>(
                                value: _organizeMode,
                                dropdownColor: const Color(0xFF0B1329),
                                decoration: const InputDecoration(
                                  labelText: 'Organize Mode',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                                items: [
                                  DropdownMenuItem(
                                    value: 'reverse',
                                    child: Text(_pageCount != null ? 'Down to Up ($_pageCount to 1)' : 'Down to Up (Reverse Pages)'),
                                  ),
                                  DropdownMenuItem(
                                    value: 'normal',
                                    child: Text(_pageCount != null ? 'Up to Down (1 to $_pageCount)' : 'Up to Down (Keep Order)'),
                                  ),
                                  const DropdownMenuItem(value: 'custom', child: Text('Custom Page Order')),
                                ],
                                onChanged: (val) {
                                  if (val != null) {
                                    setState(() { _organizeMode = val; });
                                  }
                                },
                              ),
                              if (_organizeMode == 'custom') ...[
                                const SizedBox(height: 8),
                                TextField(
                                  controller: _organizePagesController,
                                  decoration: InputDecoration(
                                    labelText: 'Custom Order (e.g. 3,1,2)',
                                    helperText: _pageCount != null ? 'Enter page indices in order for $_pageCount-page PDF' : 'e.g. 3,1,2',
                                    helperStyle: const TextStyle(fontSize: 10),
                                    border: const OutlineInputBorder(),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 16),
                            ],

                            // Crop PDF options panel
                            if (widget.tool['id'] == 'crop') ...[
                              const Text(
                                'Crop Margins Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _cropLeftController,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                        labelText: 'Left (%)',
                                        border: OutlineInputBorder(),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: TextField(
                                      controller: _cropTopController,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                        labelText: 'Top (%)',
                                        border: OutlineInputBorder(),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Row(
                                children: [
                                  Expanded(
                                    child: TextField(
                                      controller: _cropRightController,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                        labelText: 'Right (%)',
                                        border: OutlineInputBorder(),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: TextField(
                                      controller: _cropBottomController,
                                      keyboardType: TextInputType.number,
                                      decoration: const InputDecoration(
                                        labelText: 'Bottom (%)',
                                        border: OutlineInputBorder(),
                                        contentPadding: EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                            ],

                            // AI Edit PDF configuration panel
                            if (widget.tool['id'] == 'edit-pdf') ...[
                              const Text(
                                'AI Edit Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _editPromptController,
                                maxLines: 3,
                                decoration: const InputDecoration(
                                  labelText: 'Editing Instructions',
                                  hintText: 'e.g. Translate headers to French and format bullet points...',
                                  border: OutlineInputBorder(),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Sign PDF configuration panel
                            if (widget.tool['id'] == 'sign') ...[
                              const Text(
                                'Signature Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _signatureTextController,
                                decoration: const InputDecoration(
                                  labelText: 'Signature Text',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],

                            // Redact PDF configuration panel
                            if (widget.tool['id'] == 'redact') ...[
                              const Text(
                                'Redaction Settings',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                              ),
                              const SizedBox(height: 8),
                              TextField(
                                controller: _redactTermController,
                                decoration: const InputDecoration(
                                  labelText: 'Text Term to Redact (e.g. Email or Name)',
                                  border: OutlineInputBorder(),
                                  contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                ),
                              ),
                              const SizedBox(height: 16),
                            ],
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),

              if (_isProcessing) ...[
                LinearProgressIndicator(
                  value: _progress,
                  backgroundColor: const Color(0xFF1E293B),
                  color: const Color(0xFF3B82F6),
                ),
                const SizedBox(height: 10),
                Text('Processing: ${( _progress * 100).toInt()}%'),
              ] else
                ElevatedButton(
                  onPressed: _runOperation,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 52),
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text('⚡ ${widget.tool['name']}'),
                ),
            ]
          ],
        ),
      ),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late final TextEditingController _keyController;

  @override
  void initState() {
    super.initState();
    _keyController = TextEditingController(text: globalGeminiApiKey);
  }

  @override
  void dispose() {
    _keyController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Gemini API Settings'),
        backgroundColor: const Color(0xFF0B1329),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Bring Your Own Key (BYOK) Configuration',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const Text(
              'Provide your own Gemini API key. The key is stored locally in memory and sent via secure headers to run AI Summarizer, Translate, and OCR PDF tools.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 30),
            TextField(
              controller: _keyController,
              obscureText: true,
              decoration: const InputDecoration(
                labelText: 'Google Gemini API Key',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.vpn_key_rounded),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () async {
                final apiKey = _keyController.text.trim();
                globalGeminiApiKey = apiKey;
                try {
                  final prefs = await SharedPreferences.getInstance();
                  await prefs.setString('gemini_api_key', apiKey);
                } catch (e) {
                  debugPrint("Failed to save API Key to SharedPreferences: $e");
                }
                if (!mounted) return;
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('API Key saved permanently!'),
                    backgroundColor: Colors.green,
                  ),
                );
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                backgroundColor: const Color(0xFF3B82F6),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Save Key'),
            ),
          ],
        ),
      ),
    );
  }
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isSignUp = false;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleAuth() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      setState(() {
        _errorMessage = 'Email and Password cannot be empty.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      if (_isSignUp) {
        await FirebaseAuth.instance.createUserWithEmailAndPassword(
          email: email,
          password: password,
        );
      } else {
        await FirebaseAuth.instance.signInWithEmailAndPassword(
          email: email,
          password: password,
        );
      }
      if (mounted) {
        Navigator.pop(context);
      }
    } on FirebaseAuthException catch (e) {
      setState(() {
        _errorMessage = e.message ?? 'Authentication failed.';
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'An unexpected error occurred.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final GoogleSignInAccount? googleUser = await GoogleSignIn().signIn();
      if (googleUser == null) {
        setState(() {
          _isLoading = false;
        });
        return;
      }

      final GoogleSignInAuthentication googleAuth =
          await googleUser.authentication;
      final AuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );

      await FirebaseAuth.instance.signInWithCredential(credential);

      if (mounted) {
        Navigator.pop(context);
      }
    } on FirebaseAuthException catch (e) {
      setState(() {
        _errorMessage = e.message ?? 'Google Sign-in failed.';
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'An error occurred during Google Sign-in.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isSignUp ? 'Create Account' : 'Authentication'),
        backgroundColor: const Color(0xFF0B1329),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.security_rounded,
                  size: 70, color: Color(0xFF3B82F6)),
              const SizedBox(height: 20),
              Text(
                _isSignUp ? 'Sign up for OmniPDF' : 'Sign in to OmniPDF',
                textAlign: TextAlign.center,
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _isSignUp = false;
                        _errorMessage = null;
                      });
                    },
                    child: Text(
                      'Login',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color:
                            !_isSignUp ? const Color(0xFF3B82F6) : Colors.grey,
                      ),
                    ),
                  ),
                  const Text('|', style: TextStyle(color: Colors.grey)),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _isSignUp = true;
                        _errorMessage = null;
                      });
                    },
                    child: Text(
                      'Sign Up',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color:
                            _isSignUp ? const Color(0xFF3B82F6) : Colors.grey,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              if (_errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    _errorMessage!,
                    style:
                        const TextStyle(color: Colors.redAccent, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 20),
              ],
              TextField(
                controller: _emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email Address',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.email_outlined),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock_outline),
                ),
              ),
              const SizedBox(height: 24),
              if (_isLoading)
                const Center(child: CircularProgressIndicator())
              else ...[
                ElevatedButton(
                  onPressed: _handleAuth,
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(_isSignUp ? 'Sign Up' : 'Login'),
                ),
                const SizedBox(height: 20),
                const Row(
                  children: [
                    Expanded(child: Divider(color: Colors.grey)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: Text('OR',
                          style: TextStyle(color: Colors.grey, fontSize: 12)),
                    ),
                    Expanded(child: Divider(color: Colors.grey)),
                  ],
                ),
                const SizedBox(height: 20),
                OutlinedButton.icon(
                  onPressed: _handleGoogleSignIn,
                  icon: Image.network(
                    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/24px-Google_%22G%22_logo.svg.png',
                    height: 20,
                    errorBuilder: (context, error, stackTrace) => const Icon(
                        Icons.g_mobiledata_rounded,
                        size: 24,
                        color: Colors.red),
                  ),
                  label: const Text('Continue with Google'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    side: BorderSide(color: Colors.white.withOpacity(0.15)),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
