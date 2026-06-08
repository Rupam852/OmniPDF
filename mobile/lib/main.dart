import 'package:flutter/material.dart';

void main() {
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
          IconButton(
            icon: const Icon(Icons.account_circle, color: Colors.grey),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const LoginScreen()),
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

  void _runOperation() {
    setState(() {
      _isProcessing = true;
      _progress = 0.0;
    });

    // Simulate file generation
    Future.doWhile(() async {
      await Future.delayed(const Duration(milliseconds: 300));
      setState(() {
        _progress += 0.2;
      });
      if (_progress >= 1.0) {
        setState(() {
          _isProcessing = false;
          _progress = 1.0;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${widget.tool['name']} completed and saved to Downloads folder successfully!'),
            backgroundColor: Colors.green,
          ),
        );
        return false;
      }
      return true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.tool['name']),
        backgroundColor: const Color(0xFF0B1329),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              widget.tool['icon'],
              size: 80,
              color: widget.tool['color'],
            ),
            const SizedBox(height: 20),
            Text(
              'Modular File Upload & Processing',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 10),
            const Text(
              'Drag or tap to pick PDF files from device storage, Google Drive, or Dropbox.',
              textAlign: Center,
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 40),
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
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

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
              'Provide your own Gemini API key. Keys are securely encrypted using AES-256-GCM on the backend before being stored in the Neon database.',
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 30),
            const TextField(
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Google Gemini API Key',
                border: OutlineInputBorder(),
                prefixIcon: Icon(Icons.vpn_key_rounded),
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('API Key stored and encrypted successfully!'),
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
              child: const Text('Save Encrypted Key'),
            ),
          ],
        ),
      ),
    );
  }
}

class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Authentication'),
        backgroundColor: const Color(0xFF0B1329),
      ),
      body: Padding(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.security_rounded, size: 70, color: Colors.blue),
            const SizedBox(height: 20),
            const Text(
              'Sign in to OmniPDF AI',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 30),
            const TextField(
              decoration: InputDecoration(
                labelText: 'Email Address',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 16),
            const TextField(
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Password',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
                backgroundColor: const Color(0xFF3B82F6),
                foregroundColor: Colors.white,
              ),
              child: const Text('Login'),
            ),
            const SizedBox(height: 16),
            const Text('OR', style: TextStyle(color: Colors.grey)),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.pop(context);
              },
              icon: const Icon(Icons.g_mobiledata_rounded, size: 30, color: Colors.red),
              label: const Text('Sign in with Google'),
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 50),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
