import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

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
                                color: Colors.white,
                              ),
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
  bool _hasFile = false;

  // New success state controller
  bool _isCompleted = false;
  String? _downloadUrl;
  String? _summaryText;
  final String _fileName = 'selected_document.pdf';

  late final TextEditingController _keyController;
  String _targetLanguage = 'Spanish';
  final List<String> _languages = ['Spanish', 'French', 'German', 'Hindi', 'Japanese', 'Italian', 'Portuguese'];

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

  void _runOperation() async {
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

    setState(() {
      _isProcessing = true;
      _progress = 0.1;
      _isCompleted = false;
    });

    if (isAiTool) {
      try {
        final uri = widget.tool['id'] == 'ai_summarizer'
            ? Uri.parse('https://omnipdf-backed.onrender.com/api/tools/ai-summarizer')
            : Uri.parse('https://omnipdf-backed.onrender.com/api/tools/translate');

        var request = http.MultipartRequest('POST', uri);
        request.headers['x-gemini-key'] = apiKey;

        if (widget.tool['id'] == 'translate') {
          request.fields['targetLanguage'] = _targetLanguage;
        }

        request.files.add(http.MultipartFile.fromBytes(
          'file',
          utf8.encode('Simulated mobile PDF file bytes for processing'),
          filename: 'selected_document.pdf',
        ));

        setState(() {
          _progress = 0.5;
        });

        var streamedResponse = await request.send();
        var response = await http.Response.fromStream(streamedResponse);

        if (response.statusCode == 200) {
          final resData = jsonDecode(response.body);
          setState(() {
            _isProcessing = false;
            _isCompleted = true;
            _progress = 1.0;
            if (widget.tool['id'] == 'ai_summarizer') {
              _summaryText = resData['summary'] ?? 'No summary returned.';
            } else {
              _downloadUrl = resData['downloadUrl'] ?? '';
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Network Error: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    } else {
      // Simulate non-AI operations locally
      Future.doWhile(() async {
        await Future.delayed(const Duration(milliseconds: 300));
        setState(() {
          _progress += 0.2;
        });
        if (_progress >= 1.0) {
          final toolDbName = widget.tool['name'].toString().toUpperCase().replaceAll(' ', '_');
          try {
            await http.post(
              Uri.parse('https://omnipdf-backed.onrender.com/api/tools/log'),
              headers: {
                'Content-Type': 'application/json',
              },
              body: jsonEncode({
                'toolName': toolDbName,
                'status': 'COMPLETED',
                'processingTime': 1500,
              }),
            );
          } catch (_) {}

          setState(() {
            _isProcessing = false;
            _isCompleted = true;
            _progress = 1.0;
            _downloadUrl = 'https://omnipdf-bucket.s3.amazonaws.com/processed/guest/simulated_document.pdf';
          });
          return false;
        }
        return true;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isAiTool = widget.tool['id'] == 'ai_summarizer' || widget.tool['id'] == 'translate';

    // If task is completed, render a dedicated success/download page
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
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 12),
                Text(
                  'Your file "$_fileName" has been processed successfully.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 14, color: Colors.grey),
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
                            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF60A5FA)),
                          ),
                          const SizedBox(height: 12),
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: 200),
                            child: SingleChildScrollView(
                              child: Text(
                                _summaryText!,
                                style: const TextStyle(color: Color(0xFFE2E8F0), fontSize: 13, height: 1.5),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                ] else if (_downloadUrl != null) ...[
                  ElevatedButton.icon(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Downloading: $_downloadUrl'),
                          backgroundColor: Colors.green,
                        ),
                      );
                    },
                    icon: const Icon(Icons.file_download_rounded),
                    label: const Text('Download PDF File'),
                    style: ElevatedButton.styleFrom(
                      minimumSize: const Size(double.infinity, 50),
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
                  const SizedBox(height: 20),
                ],

                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _isCompleted = false;
                      _hasFile = false;
                      _progress = 0.0;
                      _summaryText = null;
                      _downloadUrl = null;
                    });
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    side: BorderSide(color: Colors.white.withOpacity(0.15)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Process Another File'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: const Text('Back to Dashboard', style: TextStyle(color: Colors.blueAccent)),
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
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
              ),
              const SizedBox(height: 10),
              const Text(
                'Drag or tap to pick PDF files from device storage, Google Drive, or Dropbox.',
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
                            labelStyle: TextStyle(fontSize: 13, color: Colors.grey),
                            border: OutlineInputBorder(),
                            prefixIcon: Icon(Icons.vpn_key_rounded, size: 20),
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          ),
                        ),
                        if (widget.tool['id'] == 'translate') ...[
                          const SizedBox(height: 16),
                          DropdownButtonFormField<String>(
                            value: _targetLanguage,
                            dropdownColor: const Color(0xFF0B1329),
                            decoration: const InputDecoration(
                              labelText: 'Target Language',
                              labelStyle: TextStyle(fontSize: 13, color: Colors.grey),
                              border: OutlineInputBorder(),
                              prefixIcon: Icon(Icons.language_rounded, size: 20),
                              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                            ),
                            items: _languages.map((String lang) {
                              return DropdownMenuItem<String>(
                                value: lang,
                                child: Text(lang),
                              );
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

              if (!_hasFile)
                ElevatedButton.icon(
                  onPressed: () {
                    setState(() {
                      _hasFile = true;
                    });
                  },
                  icon: const Icon(Icons.file_upload_outlined),
                  label: const Text('Pick PDF Document'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(200, 50),
                    backgroundColor: const Color(0xFF3B82F6),
                    foregroundColor: Colors.white,
                  ),
                )
              else ...[
                const Card(
                  color: Color(0xFF1E293B),
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.picture_as_pdf, color: Colors.redAccent),
                        SizedBox(width: 12),
                        Text('selected_document.pdf (4.8 MB)'),
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

      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
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
              const Icon(Icons.security_rounded, size: 70, color: Color(0xFF3B82F6)),
              const SizedBox(height: 20),
              Text(
                _isSignUp ? 'Sign up for OmniPDF AI' : 'Sign in to OmniPDF AI',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
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
                        color: !_isSignUp ? const Color(0xFF3B82F6) : Colors.grey,
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
                        color: _isSignUp ? const Color(0xFF3B82F6) : Colors.grey,
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
                    style: const TextStyle(color: Colors.redAccent, fontSize: 13),
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
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text(_isSignUp ? 'Sign Up' : 'Login'),
                ),
                const SizedBox(height: 20),
                const Row(
                  children: [
                    Expanded(child: Divider(color: Colors.grey)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 10),
                      child: Text('OR', style: TextStyle(color: Colors.grey, fontSize: 12)),
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
                    errorBuilder: (context, error, stackTrace) => const Icon(Icons.g_mobiledata_rounded, size: 24, color: Colors.red),
                  ),
                  label: const Text('Continue with Google'),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(double.infinity, 50),
                    side: BorderSide(color: Colors.white.withOpacity(0.15)),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
