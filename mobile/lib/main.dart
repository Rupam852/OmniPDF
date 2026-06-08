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
      title: 'OmniPDF AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF030712),
        primaryColor: const Color(0xFF3B82F6),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF3B82F6),
          secondary: Color(0xFF1D4ED8),
          surface: Color(0xFF0B1329),
          background: Color(0xFF030712),
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
      'desc': 'Combine multiple PDFs into a single file.',
      'color': Colors.orange,
      'icon': Icons.merge_type_rounded,
    },
    {
      'id': 'split',
      'name': 'Split PDF',
      'desc': 'Separate one page or a whole set from a PDF.',
      'color': Colors.deepOrange,
      'icon': Icons.call_split_rounded,
    },
    {
      'id': 'compress',
      'name': 'Compress PDF',
      'desc': 'Reduce file size while keeping high quality.',
      'color': Colors.green,
      'icon': Icons.compress_rounded,
    },
    {
      'id': 'ai_summarizer',
      'name': 'AI Summarizer',
      'desc': 'Get instant summaries via Gemini BYOK SDK.',
      'color': Colors.purple,
      'icon': Icons.star_rounded,
    },
    {
      'id': 'translate',
      'name': 'Translate PDF',
      'desc': 'Translate document pages keeping formatting.',
      'color': Colors.indigo,
      'icon': Icons.translate_rounded,
    },
    {
      'id': 'protect',
      'name': 'Protect PDF',
      'desc': 'Encrypt your PDF with password restrictions.',
      'color': Colors.blue,
      'icon': Icons.lock_outline_rounded,
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'OmniPDF AI',
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
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 14,
                  mainAxisSpacing: 14,
                  childAspectRatio: 0.85,
                ),
                itemCount: _tools.length,
                itemBuilder: (context, index) {
                  final tool = _tools[index];
                  return Card(
                    color: const Color(0xFF0B1329),
                    elevation: 4,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Colors.white.withOpacity(0.05)),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
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
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                tool['icon'],
                                color: tool['color'],
                                size: 28,
                              ),
                            ),
                            const Spacer(),
                            Text(
                              tool['name'],
                              style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.white),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              tool['desc'],
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
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
  String _targetUnit = 'KB';
  String _targetLanguage = 'Spanish';
  double _compressionPercent = 50.0;
  final List<String> _languages = [
    'Spanish',
    'French',
    'German',
    'Hindi',
    'Japanese',
    'Italian',
    'Portuguese'
  ];

  @override
  void initState() {
    super.initState();
    _keyController = TextEditingController(text: globalGeminiApiKey);
    _targetSizeController = TextEditingController(text: '500');
    _protectPasswordController = TextEditingController();
  }

  @override
  void dispose() {
    _keyController.dispose();
    _targetSizeController.dispose();
    _protectPasswordController.dispose();
    super.dispose();
  }

  void _pickFiles() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        allowMultiple: widget.tool['id'] == 'merge',
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
            if (widget.tool['id'] == 'merge') {
              _pickedFiles.addAll(validFiles);
            } else {
              _pickedFiles = [validFiles.first];
            }
          });
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
          content: Text('Please pick a PDF file first.'),
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
        'ai_summarizer': 'ai-summarizer',
        'translate': 'translate',
      };

      final endpoint = endpointMap[widget.tool['id']] ?? widget.tool['id'];
      final uri = Uri.parse('https://omnipdf-backed.onrender.com/api/tools/$endpoint');

      var request = http.MultipartRequest('POST', uri);
      if (apiKey.isNotEmpty) {
        request.headers['x-gemini-key'] = apiKey;
      }

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

      if (widget.tool['id'] == 'protect') {
        request.fields['password'] = _protectPasswordController.text.trim();
      }

      setState(() {
        _progress = 0.3;
      });

      // Add file(s)
      for (var platformFile in _pickedFiles) {
        if (platformFile.bytes != null) {
          request.files.add(http.MultipartFile.fromBytes(
            widget.tool['id'] == 'merge' ? 'files' : 'file',
            platformFile.bytes!,
            filename: platformFile.name,
          ));
        } else if (platformFile.path != null) {
          request.files.add(await http.MultipartFile.fromPath(
            widget.tool['id'] == 'merge' ? 'files' : 'file',
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
            _actionText = 'Download Processed PDF';

            if (widget.tool['id'] == 'merge') {
              _actionText = 'Download Merged PDF';
            } else if (widget.tool['id'] == 'compress') {
              _actionText = 'Download Compressed PDF';
            } else if (widget.tool['id'] == 'protect') {
              _actionText = 'Download Protected PDF';
            } else if (widget.tool['id'] == 'translate') {
              _actionText = 'Download Translated PDF';
            }
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
        var status = await Permission.storage.request();
        if (!mounted) return;
        if (!status.isGranted) {
          // Fallback or request photo/audio/video/media permissions
        }
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
      return Scaffold(
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
                            'AI Summary Result',
                            style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF60A5FA)),
                          ),
                          const SizedBox(height: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: 200),
                            child: SingleChildScrollView(
                              child: Text(
                                _summaryText!,
                                style: const TextStyle(
                                    color: Color(0xFFE2E8F0),
                                    fontSize: 13,
                                    height: 1.5),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton.icon(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: _summaryText!));
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Summary copied to clipboard!'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    },
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy Summary Text'),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      backgroundColor: Colors.blueAccent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_responseDataBase64 != null) ...[
                    ElevatedButton.icon(
                      onPressed: () {
                        _saveBase64File(_responseDataBase64!, 'summary_${_pickedFiles[0].name}.pdf');
                      },
                      icon: const Icon(Icons.file_download_rounded),
                      label: const Text('Download Summary PDF'),
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
                ] else if (_processedFiles.isNotEmpty) ...[
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'Download Split Parts:',
                      style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                  const SizedBox(height: 12),
                  ..._processedFiles.map((f) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: ElevatedButton.icon(
                        onPressed: () {
                          _saveBase64File(f['fileData'], f['fileName']);
                        },
                        icon: const Icon(Icons.file_download_rounded),
                        label: Text('Download ${f['fileName']}'),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(double.infinity, 45),
                          backgroundColor: Colors.green,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8)),
                        ),
                      ),
                    );
                  }),
                  const SizedBox(height: 20),
                ] else if (_responseDataBase64 != null) ...[
                  ElevatedButton.icon(
                    onPressed: () {
                      String outputName = 'processed_document.pdf';
                      if (_pickedFiles.isNotEmpty) {
                        final original = _pickedFiles[0].name;
                        final dotIdx = original.lastIndexOf('.');
                        final base = dotIdx != -1 ? original.substring(0, dotIdx) : original;
                        final ext = dotIdx != -1 ? original.substring(dotIdx) : '.pdf';
                        
                        String suffix = '_processed';
                        if (widget.tool['id'] == 'merge') {
                          suffix = '_merged';
                        } else if (widget.tool['id'] == 'compress') {
                          suffix = '_compressed';
                        } else if (widget.tool['id'] == 'protect') {
                          suffix = '_protected';
                        } else if (widget.tool['id'] == 'translate') {
                          suffix = '_translated_$_targetLanguage';
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
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.tool['name']),
        backgroundColor: const Color(0xFF0B1329),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: SingleChildScrollView(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const SizedBox(height: 20),
              Icon(
                widget.tool['icon'],
                size: 80,
                color: widget.tool['color'],
              ),
              const SizedBox(height: 20),
              const Text(
                'Modular File Upload & Processing',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white),
              ),
              const SizedBox(height: 10),
              const Text(
                'Pick PDF files from device storage to start processing. (Max 10MB per file)',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey),
              ),
              const SizedBox(height: 30),

              // AI tool configuration panel
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
                            initialValue: _targetLanguage,
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
                            labelText: 'PDF Password',
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

              if (_pickedFiles.isEmpty)
                ElevatedButton.icon(
                  onPressed: _pickFiles,
                  icon: const Icon(Icons.file_upload_outlined),
                  label: Text(widget.tool['id'] == 'merge' ? 'Pick PDF Documents' : 'Pick PDF Document'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(200, 50),
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
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
                            const Icon(Icons.picture_as_pdf, color: Colors.redAccent),
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
                              },
                            )
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
                if (widget.tool['id'] == 'merge') ...[
                  TextButton.icon(
                    onPressed: _pickFiles,
                    icon: const Icon(Icons.add),
                    label: const Text('Add More Files'),
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
                      minimumSize: const Size(200, 50),
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Start Operations'),
                  ),
              ]
            ],
          ),
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
      body: Padding(
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
                _isSignUp ? 'Sign up for OmniPDF AI' : 'Sign in to OmniPDF AI',
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
                        borderRadius: BorderRadius.circular(8)),
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
                        borderRadius: BorderRadius.circular(8)),
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
