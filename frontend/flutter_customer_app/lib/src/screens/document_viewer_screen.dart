import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

class DocumentViewerScreen extends StatefulWidget {
  const DocumentViewerScreen({
    super.key,
    required this.title,
    required this.url,
    required this.accessToken,
  });

  final String title;
  final String url;
  final String accessToken;

  @override
  State<DocumentViewerScreen> createState() => _DocumentViewerScreenState();
}

class _DocumentViewerScreenState extends State<DocumentViewerScreen> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) => setState(() => _loading = false),
        ),
      )
      ..loadRequest(
        Uri.parse(widget.url),
        headers: {
          'Authorization': 'Bearer ${widget.accessToken}',
        },
      );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        backgroundColor: const Color(0xFF090C1A),
        foregroundColor: const Color(0xFFEFEEE8),
      ),
      backgroundColor: const Color(0xFF060816),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading)
            Center(
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  color: const Color(0xCC0B0F19),
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: const Color(0x668224E3)),
                ),
                child: const Center(
                  child: CircularProgressIndicator(color: Color(0xFF8224E3)),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

