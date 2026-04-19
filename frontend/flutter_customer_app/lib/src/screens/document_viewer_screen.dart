import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:share_plus/share_plus.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../core/theme.dart';

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
  String? _error;
  List<int>? _pdfBytes;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0E0E1A))
      ..setNavigationDelegate(NavigationDelegate(
        onPageFinished: (_) => setState(() => _loading = false),
        onWebResourceError: (_) => setState(() => _loading = false),
      ));
    _loadPdf();
  }

  Future<void> _loadPdf() async {
    setState(() { _loading = true; _error = null; });
    try {
      final response = await http.get(
        Uri.parse(widget.url),
        headers: {'Authorization': 'Bearer ${widget.accessToken}'},
      ).timeout(const Duration(seconds: 30));
      if (response.statusCode != 200) {
        setState(() { _error = 'Failed to load (${response.statusCode})'; _loading = false; });
        return;
      }
      _pdfBytes = response.bodyBytes;
      final base64Pdf = base64Encode(response.bodyBytes);
      final html = _buildHtml(base64Pdf);
      await _controller.loadHtmlString(html);
    } catch (e) {
      setState(() { _error = 'Could not load document.'; _loading = false; });
    }
  }

  String _buildHtml(String base64Pdf) => '''
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #0E0E1A; }
#viewer { width: 100%; padding: 8px 0; }
canvas { display: block; margin: 0 auto 8px; box-shadow: 0 2px 12px #0006; }
#loading { color: #fff; text-align: center; padding: 40px; font-family: sans-serif; }
</style>
</head>
<body>
<div id="loading">Loading PDF...</div>
<div id="viewer"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
<script>
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const base64 = '$base64Pdf';
const raw = atob(base64);
const bytes = new Uint8Array(raw.length);
for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
pdfjsLib.getDocument({ data: bytes }).promise.then(pdf => {
  document.getElementById('loading').style.display = 'none';
  const viewer = document.getElementById('viewer');
  const scale = window.innerWidth / 595;
  for (let i = 1; i <= pdf.numPages; i++) {
    pdf.getPage(i).then(page => {
      const vp = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      canvas.style.width = '100%';
      viewer.appendChild(canvas);
      page.render({ canvasContext: canvas.getContext('2d'), viewport: vp });
    });
  }
}).catch(() => {
  document.getElementById('loading').innerText = 'Failed to render PDF.';
});
</script>
</body>
</html>
''';

  Future<void> _download() async {
    if (_pdfBytes == null) return;
    final file = File(
        '${Directory.systemTemp.path}/${widget.title.replaceAll(' ', '_')}.pdf');
    await file.writeAsBytes(_pdfBytes!);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('PDF saved. Use Share to open.')));
  }

  Future<void> _share() async {
    if (_pdfBytes == null) return;
    final file = File(
        '${Directory.systemTemp.path}/${widget.title.replaceAll(' ', '_')}.pdf');
    await file.writeAsBytes(_pdfBytes!);
    await Share.shareXFiles([XFile(file.path)], subject: widget.title);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBg,
      body: Column(
        children: [
          // ── Header ─────────────────────────────────────────────────────
          Container(
            decoration: const BoxDecoration(color: Color(0xFF8224E3)),
            child: SafeArea(
              bottom: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 8, 16),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_ios_rounded,
                          color: Colors.white, size: 20),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    Expanded(
                      child: Text(
                        widget.title,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                          fontSize: 16,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (_pdfBytes != null) ...[
                      IconButton(
                        icon: const Icon(Icons.share_rounded,
                            color: Colors.white, size: 22),
                        onPressed: _share,
                        tooltip: 'Share',
                      ),
                      IconButton(
                        icon: const Icon(Icons.download_rounded,
                            color: Colors.white, size: 22),
                        onPressed: _download,
                        tooltip: 'Download',
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),

          // ── Body ────────────────────────────────────────────────────────
          Expanded(
            child: _error != null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.error_outline_rounded,
                            color: Colors.red, size: 48),
                        const SizedBox(height: 12),
                        Text(_error!,
                            style: GoogleFonts.inter(
                                color: Colors.white70, fontSize: 14)),
                        const SizedBox(height: 16),
                        FilledButton(
                            onPressed: _loadPdf,
                            child: const Text('Retry')),
                      ],
                    ),
                  )
                : Stack(
                    children: [
                      WebViewWidget(controller: _controller),
                      if (_loading)
                        const Center(
                          child: CircularProgressIndicator(color: kPrimary),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }
}
