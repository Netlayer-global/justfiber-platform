import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class SerialScanScreen extends StatefulWidget {
  const SerialScanScreen({
    super.key,
    required this.title,
    required this.subtitle,
  });

  final String title;
  final String subtitle;

  @override
  State<SerialScanScreen> createState() => _SerialScanScreenState();
}

class _SerialScanScreenState extends State<SerialScanScreen> {
  final MobileScannerController _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    facing: CameraFacing.back,
  );

  bool _handled = false;
  String _latestCode = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _finish(String code) {
    if (_handled || code.trim().isEmpty) return;
    _handled = true;
    Navigator.of(context).pop(code.trim());
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(title: Text(widget.title)),
      backgroundColor: const Color(0xFFFCFAF7),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Stack(
                children: [
                  MobileScanner(
                    controller: _controller,
                    onDetect: (capture) {
                      final value = capture.barcodes
                          .map((barcode) => barcode.rawValue ?? '')
                          .firstWhere((item) => item.trim().isNotEmpty, orElse: () => '');
                      if (value.isEmpty) return;
                      setState(() => _latestCode = value);
                      _finish(value);
                    },
                  ),
                  Center(
                    child: Container(
                      width: 250,
                      height: 180,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(28),
                        border: Border.all(color: const Color(0xFF8224E3), width: 2),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x448224E3),
                            blurRadius: 24,
                            spreadRadius: 2,
                          ),
                        ],
                      ),
                    ),
                  ),
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 24,
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xF2FFFFFF),
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: const Color(0x228224E3)),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x16000000),
                            blurRadius: 18,
                            offset: Offset(0, 8),
                          ),
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.subtitle,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: const Color(0xFF6E6A67),
                              height: 1.45,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            _latestCode.isEmpty ? 'Point camera at barcode or QR code.' : _latestCode,
                            style: const TextStyle(
                              color: Color(0xFF131313),
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: () => Navigator.of(context).pop(),
                                  child: const Text('Cancel'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: FilledButton(
                                  onPressed: _latestCode.trim().isEmpty ? null : () => _finish(_latestCode),
                                  child: const Text('Use code'),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
