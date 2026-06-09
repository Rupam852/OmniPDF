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

// Global memory API key store for the active app session
String globalGeminiApiKey = '';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await Firebase.initializeApp();
  } catch (e) {
    debugPrint("Firebase init error: $e");
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

  String _targetLanguage = 'Spanish';
  double _compressionPercent = 50.0;
  String _splitMode = 'all'; // 'all', 'half', 'range'
  double _watermarkOpacity = 0.15;
  String _pageNumPosition = 'bottom-center';
  String _rotateAngle = '90';
  String _organizeMode = 'reverse'; // 'reverse', 'normal', 'custom'
  int? _pageCount;

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
      final result = await FilePicker.platform.pickFiles(
        type: isJpgToPdf ? FileType.image : FileType.custom,
        allowedExtensions: isJpgToPdf ? null : ['pdf'],
        allowMultiple: widget.tool['id'] == 'merge' || widget.tool['id'] == 'jpg-to-pdf',
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
            if (widget.tool['id'] == 'merge' || widget.tool['id'] == 'jpg-to-pdf') {
              _pickedFiles.addAll(validFiles);
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
    final isAiTool = widget.tool['id'] == 'ai_summarizer' || widget.tool['id'] == 'translate';

    if (isAiTool && apiKey.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('A Google Gemini API key must be provided to use this tool.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
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

      setState(() {
        _progress = 0.3;
      });

      // Add file(s)
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

          if (widget.tool['id'] == 'ai_summarizer') {
            _summaryText = resData['summary'] ?? 'No summary returned.';
            _responseDataBase64 = resData['fileData'];
            _successMessage = 'Your PDF has been summarized successfully using Gemini AI!';
            _actionText = 'Download Summary PDF';
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
      if (Platform.isAndroid) {
        await Permission.storage.request();
      }

      final Uint8List bytes = base64Decode(base64Content);
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
    final isAiTool = widget.tool['id'] == 'ai_summarizer' || widget.tool['id'] == 'translate';

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
                  if (_responseDataBase64 != null &&
                      widget.tool['id'] != 'pdf-to-jpg') ...[
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

            // AI Option settings panel
            if (isAiTool) ...[
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
                        'AI Option Settings',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF60A5FA),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _keyController,
                        obscureText: true,
                        onChanged: (val) {
                          globalGeminiApiKey = val.trim();
                        },
                        decoration: const InputDecoration(
                          labelText: 'Google Gemini API Key',
                          labelStyle:
                              TextStyle(fontSize: 13, color: Colors.grey),
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.vpn_key_rounded, size: 20),
                          contentPadding: EdgeInsets.symmetric(
                              horizontal: 12, vertical: 10),
                        ),
                      ),
                      if (widget.tool['id'] == 'translate') ...[
                        const SizedBox(height: 16),
                        DropdownButtonFormField<String>(
                          value: _targetLanguage,
                          dropdownColor: const Color(0xFF0B1329),
                          decoration: const InputDecoration(
                            labelText: 'Target Language',
                            labelStyle:
                                TextStyle(fontSize: 13, color: Colors.grey),
                            border: OutlineInputBorder(),
                            prefixIcon:
                                Icon(Icons.language_rounded, size: 20),
                            contentPadding: EdgeInsets.symmetric(
                                horizontal: 12, vertical: 10),
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
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Protect PDF configuration panel
            if (widget.tool['id'] == 'protect') ...[
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
                        'Protection Settings',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF60A5FA),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _protectPasswordController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'Password to Encrypt PDF',
                          labelStyle: TextStyle(fontSize: 13, color: Colors.grey),
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.lock_rounded, size: 20),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Unlock PDF configuration panel
            if (widget.tool['id'] == 'unlock') ...[
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
                        'Unlock Settings',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF60A5FA),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _protectPasswordController,
                        obscureText: true,
                        decoration: const InputDecoration(
                          labelText: 'PDF Password to Unlock',
                          labelStyle: TextStyle(fontSize: 13, color: Colors.grey),
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.lock_open_rounded, size: 20),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Compress PDF configuration panel
            if (widget.tool['id'] == 'compress') ...[
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Compression Level',
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF60A5FA),
                            ),
                          ),
                          Text(
                            '${_compressionPercent.toInt()}% (${((_pickedFiles.isNotEmpty ? _pickedFiles[0].size : 0) * (_compressionPercent / 100) / 1024).toStringAsFixed(0)} KB)',
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF60A5FA),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
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
                            Text('High (10%)', style: TextStyle(fontSize: 10, color: Colors.grey)),
                            Text('Medium (50%)', style: TextStyle(fontSize: 10, color: Colors.grey)),
                            Text('Low (90%)', style: TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Split PDF configuration panel
            if (widget.tool['id'] == 'split') ...[
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
                        'Split Settings',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _splitMode,
                        dropdownColor: const Color(0xFF0B1329),
                        decoration: const InputDecoration(
                          labelText: 'Split Mode',
                          labelStyle: TextStyle(fontSize: 13, color: Colors.grey),
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                        const SizedBox(height: 12),
                        TextField(
                          controller: _splitPageRangesController,
                          decoration: const InputDecoration(
                            labelText: 'Page Ranges (e.g. 1-3,4-6,7)',
                            labelStyle: TextStyle(fontSize: 13, color: Colors.grey),
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Watermark PDF configuration panel
            if (widget.tool['id'] == 'watermark') ...[
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
                        'Watermark Settings',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _watermarkTextController,
                        decoration: const InputDecoration(
                          labelText: 'Watermark Text',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _watermarkFontSizeController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Font Size',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Opacity', style: TextStyle(fontSize: 13, color: Colors.grey)),
                          Text('${(_watermarkOpacity * 100).toInt()}%', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.blueAccent)),
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
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Page Numbers configuration panel
            if (widget.tool['id'] == 'page-numbers') ...[
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
                        'Page Numbering Settings',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _pageNumPosition,
                        dropdownColor: const Color(0xFF0B1329),
                        decoration: const InputDecoration(
                          labelText: 'Position',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
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
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pageNumStartController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                          labelText: 'Start Number',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _pageNumPrefixController,
                        decoration: const InputDecoration(
                          labelText: 'Prefix (optional, e.g. "Page ")',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Rotate PDF configuration panel
            if (widget.tool['id'] == 'rotate') ...[
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
                        'Rotation Settings',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _rotateAngle,
                        dropdownColor: const Color(0xFF0B1329),
                        decoration: const InputDecoration(
                          labelText: 'Rotation Angle',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        items: const [
                          DropdownMenuItem(value: '90', child: Text('90° Clockwise')),
                          DropdownMenuItem(value: '180', child: Text('180° Upside Down')),
                          DropdownMenuItem(value: '270', child: Text('270° Counter-Clockwise')),
                        ],
                        onChanged: (val) {
                          if (val != null) setState(() { _rotateAngle = val; });
                        },
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _rotatePagesController,
                        decoration: const InputDecoration(
                          labelText: 'Pages to Rotate (e.g. all OR 1,3,5)',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Remove Pages configuration panel
            if (widget.tool['id'] == 'remove-pages') ...[
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
                        'Pages to Remove',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _removePagesController,
                        decoration: const InputDecoration(
                          labelText: 'Page Numbers (comma-separated, e.g. 1,3,5)',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Extract Pages configuration panel
            if (widget.tool['id'] == 'extract-pages') ...[
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
                        'Pages to Extract',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _extractPagesController,
                        decoration: const InputDecoration(
                          labelText: 'Page Ranges (comma-separated, e.g. 1-3,5,7-9)',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Organize PDF configuration panel
            if (widget.tool['id'] == 'organize-pdf') ...[
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
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'Organize Page Order',
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                          ),
                          if (_pageCount != null)
                            Text(
                              'Detected $_pageCount pages',
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                            ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: _organizeMode,
                        dropdownColor: const Color(0xFF0B1329),
                        decoration: const InputDecoration(
                          labelText: 'Page Order Mode',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        ),
                        items: [
                          DropdownMenuItem(
                            value: 'reverse',
                            child: Text(_pageCount != null
                                ? 'Down to Up ($_pageCount to 1)'
                                : 'Down to Up (Reverse Pages)'),
                          ),
                          DropdownMenuItem(
                            value: 'normal',
                            child: Text(_pageCount != null
                                ? 'Up to Down (1 to $_pageCount)'
                                : 'Up to Down (Keep Original Order)'),
                          ),
                          DropdownMenuItem(
                            value: 'custom',
                            child: const Text('Custom Page Order'),
                          ),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _organizeMode = val;
                            });
                          }
                        },
                      ),
                      if (_organizeMode == 'custom') ...[
                        const SizedBox(height: 12),
                        TextField(
                          controller: _organizePagesController,
                          decoration: InputDecoration(
                            labelText: _pageCount != null
                                ? 'Custom Page Order (e.g. 3,1,2 for $_pageCount-page PDF)'
                                : 'Custom Page Order (comma-separated, e.g. 3,1,2)',
                            border: const OutlineInputBorder(),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 20),
            ],

            if (_pickedFiles.isEmpty)
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
              )
            else ...[
              Column(
                children: _pickedFiles.map((platformFile) {
                  final sizeMB = ((platformFile.size) / (1024 * 1024)).toStringAsFixed(2);
                  return Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.only(bottom: 8),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Row(
                        children: [
                          Icon(
                            widget.tool['id'] == 'jpg-to-pdf'
                                ? Icons.image_outlined
                                : Icons.picture_as_pdf,
                            color: widget.tool['id'] == 'jpg-to-pdf'
                                ? Colors.amber
                                : Colors.redAccent,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              '${platformFile.name} ($sizeMB MB)',
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete, color: Colors.redAccent),
                            onPressed: () {
                              setState(() {
                                _pickedFiles.remove(platformFile);
                              });
                              _detectPageCount();
                            },
                          )
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 12),
              if (widget.tool['id'] == 'merge' || widget.tool['id'] == 'jpg-to-pdf') ...[
                TextButton.icon(
                  onPressed: _pickFiles,
                  icon: const Icon(Icons.add),
                  label: Text(widget.tool['id'] == 'jpg-to-pdf' ? 'Add More Images' : 'Add More Files'),
                ),
                const SizedBox(height: 12),
              ],
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
                    minimumSize: const Size(220, 52),
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: const Text('Start Operations'),
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
              'Provide your own Gemini API key. The key is stored locally in memory and sent via secure headers to run AI Summarizer and Translate PDF tools.',
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
              onPressed: () {
                globalGeminiApiKey = _keyController.text.trim();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('API Key saved successfully!'),
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
