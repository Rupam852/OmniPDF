# OmniPDF AI - Flutter Mobile Architecture & Native Android Storage Blueprint

This guide provides technical specs, codebase layouts, and code snippets for integrating the OmniPDF AI backend and cloud storage options in the **Flutter mobile application**.

---

## 1. Project Directory Layout

```
mobile/
├── android/
│   └── app/src/main/AndroidManifest.xml (Permission configurations)
├── lib/
│   ├── main.dart
│   ├── models/
│   │   └── pdf_tool.dart
│   ├── services/
│   │   ├── auth_service.dart          (Firebase Authenticator)
│   │   ├── api_service.dart           (Connects to Render Node.js backend)
│   │   ├── drive_service.dart         (Google Drive sync)
│   │   └── storage_service.dart       (Android native download manager)
│   └── screens/
│       ├── home_screen.dart           (Matching the iLovePDF layout grid)
│       ├── tool_screen.dart           (Specific tool screen with settings)
│       └── settings_screen.dart       (Gemini API key BYOK configuration)
└── pubspec.yaml
```

---

## 2. Dependencies Setup (`pubspec.yaml`)

Add these core packages to support operations:

```yaml
dependencies:
  flutter:
    sdk: flutter
  
  # Firebase Authentication
  firebase_core: ^2.27.0
  firebase_auth: ^4.17.8
  google_sign_in: ^6.2.1

  # API Communications
  http: ^1.2.0
  http_parser: ^4.0.0
  path: ^1.9.0

  # Storage and Path Resolution
  path_provider: ^2.1.2
  permission_handler: ^11.3.1
  file_picker: ^8.0.0

  # Integrations
  googleapis: ^11.4.0
  googleapis_auth: ^1.4.1
```

---

## 3. Native Android Permission Setup (`AndroidManifest.xml`)

To allow importing/exporting from local storage and saving directly to the **Download** folder, update `mobile/android/app/src/main/AndroidManifest.xml`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Network access to hit Render backend -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- Legacy Storage access for older Android versions -->
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
                     android:maxSdkVersion="29" />
</manifest>
```

---

## 4. API Service: Connecting to Node.js Server (`api_service.dart`)

This Dart class sends multipart files with Firebase ID tokens to the Node.js API.

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ApiService {
  static const String baseUrl = "https://omnipdf-backend.onrender.com/api";
  final FirebaseAuth _auth = FirebaseAuth.instance;

  Future<String?> _getAuthToken() async {
    return await _auth.currentUser?.getIdToken();
  }

  /// Sends multiple files to the backend for merging
  Future<Map<String, dynamic>> mergePdfs(List<File> files) async {
    final token = await _getAuthToken();
    final url = Uri.parse('$baseUrl/tools/merge');
    
    var request = http.MultipartRequest('POST', url);
    
    // Attach Firebase Auth Bearer token
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    // Attach PDF files
    for (var file in files) {
      request.files.add(
        await http.MultipartFile.fromPath(
          'files',
          file.path,
          contentType: MediaType('application', 'pdf'),
        ),
      );
    }

    final response = await request.send();
    final responseData = await http.Response.fromStream(response);

    if (response.statusCode == 200) {
      return jsonDecode(responseData.body);
    } else {
      throw Exception(jsonDecode(responseData.body)['message'] ?? 'Merge failed.');
    }
  }

  /// Sends API key configuration settings
  Future<bool> saveGeminiKey(String key) async {
    final token = await _getAuthToken();
    final url = Uri.parse('$baseUrl/keys');
    
    final response = await http.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'apiKey': key}),
    );

    return response.statusCode == 200;
  }
}
```

---

## 5. Storage Service: Saving to Download Folder (`storage_service.dart`)

To store files directly into the Android default `"Download"` folder, use the directory path resolution:

```dart
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:permission_handler/permission_handler.dart';
import 'package:path_provider/path_provider.dart';

class StorageService {
  
  /// Requests storage permission if required (up to Android 10)
  Future<bool> requestStoragePermission() async {
    if (Platform.isAndroid) {
      if (await Permission.storage.request().isGranted) {
        return true;
      }
      // On Android 11+ (API 30+), WRITE_EXTERNAL_STORAGE is ignored.
      // Saving to public folders like "Download" can be done directly via file stream.
      return true; 
    }
    return false;
  }

  /// Downloads file from URL and writes to native /storage/emulated/0/Download
  Future<File?> downloadToAndroidDownloadFolder(String fileUrl, String fileName) async {
    try {
      final isPermissionGranted = await requestStoragePermission();
      if (!isPermissionGranted) return null;

      // Fetch the public Download directory
      Directory? downloadsDirectory;
      if (Platform.isAndroid) {
        downloadsDirectory = Directory('/storage/emulated/0/Download');
        if (!await downloadsDirectory.exists()) {
          // Fallback to application storage
          downloadsDirectory = await getExternalStorageDirectory();
        }
      } else {
        downloadsDirectory = await getApplicationDocumentsDirectory();
      }

      final savePath = "${downloadsDirectory!.path}/$fileName";
      final file = File(savePath);

      // Download file stream
      final response = await http.get(Uri.parse(fileUrl));
      if (response.statusCode == 200) {
        await file.writeAsBytes(response.bodyBytes);
        print("File successfully saved natively at: $savePath");
        return file;
      }
      return null;
    } catch (e) {
      print("Error downloading file natively: $e");
      return null;
    }
  }
}
```
